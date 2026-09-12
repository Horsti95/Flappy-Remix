-- 0033_atomic_counters.sql
--
-- INTEGRITY FIX: lost updates under concurrency.
--
-- Three hot paths read a counter, add to it in JavaScript, then write the
-- ABSOLUTE result back. Any two requests that interleave between the read and
-- the write silently discard one of the increments:
--
--  * api/submit-run.ts  — profiles.total_games and profiles.xp
--      read `total_games, xp`, compute `next = prev + 1`, `newXp = prevXp +
--      gain`, then `update profiles set total_games = next, xp = newXp`.
--      Two runs finishing together => one game and one XP award vanish.
--
--  * api/submit-run.ts  — elo_ratings counters
--      the match settle itself is already guarded by the `version` column
--      from 0025, but the Elo write reads games_played/wins/losses/draws for
--      BOTH players and upserts absolute values. A player with two matches
--      settling at once (different opponents — nothing prevents that) loses
--      one match's worth of rating and counters.
--
--  * api/redeem-code.ts — skin_codes.uses
--      checks `uses >= max_uses`, then later `update ... set uses = uses + 1`
--      from the value it read. N parallel redemptions of a 25-use code all
--      pass the check and all redeem. (The per-user duplicate IS safe: 0005
--      has primary key (user_id, code). The limit is what leaks.)
--
-- The fix is to do the arithmetic in SQL, where `col = col + n` is atomic
-- under the row lock the UPDATE already takes. Each function below is one
-- statement (or an explicitly lock-ordered pair), so it is a transaction by
-- itself — no read-modify-write window remains.
--
-- All three are SECURITY DEFINER and service-role-only: they are called from
-- api/* with the service key, never from the browser. Explicit revokes at the
-- bottom, so this file is safe even if applied before 0031's default-privilege
-- change.
--
-- Re-runnable. Apply via the Supabase SQL Editor (paste + Run).

-- ---------------------------------------------------------------------------
-- 1. Profile counters after an accepted run.
--
-- total_games and xp are ADDITIVE (atomic increments). streak_days and
-- last_daily_play_at are computed date logic from api/_lib/streak.ts and are
-- deterministic for a given day, so concurrent runs compute the same answer
-- and a plain assignment is correct. last_play_at uses greatest() so a
-- late-arriving offline-queue submission can't drag the timestamp backwards.
--
-- Returns the post-update values so the API can report accurate totals to the
-- client instead of the stale ones it computed.
-- ---------------------------------------------------------------------------
create or replace function public.bump_profile_after_run(
  p_user_id             uuid,
  p_xp_gain             integer,
  p_streak_days         integer,
  p_last_daily_play_at  timestamptz,
  p_played_at           timestamptz default now()
)
returns table (total_games integer, xp integer, streak_days integer)
language sql
security definer
set search_path = public
as $$
  update public.profiles p
     set total_games        = p.total_games + 1,
         xp                 = p.xp + greatest(p_xp_gain, 0),
         streak_days        = p_streak_days,
         last_daily_play_at = coalesce(p_last_daily_play_at, p.last_daily_play_at),
         last_play_at       = greatest(coalesce(p.last_play_at, p_played_at), p_played_at)
   where p.user_id = p_user_id
  returning p.total_games, p.xp, p.streak_days;
$$;

-- ---------------------------------------------------------------------------
-- 2. Ranked Elo settlement.
--
-- Takes RATING DELTAS, not absolutes. Each match snapshots a_rating_before /
-- b_rating_before on the match row at creation, so `after - before` is a
-- fixed, match-specific delta that does not depend on any other match. Adding
-- deltas therefore composes correctly when two of a player's matches settle
-- concurrently, whereas writing absolutes loses one of them.
--
-- p_a_base / p_b_base seed the row when a player has no rating for the season
-- yet (first ranked match of the season): rating starts at base + delta.
--
-- The two rows are written in a deterministic order (lower uuid first) so two
-- concurrent settlements involving the same pair can never deadlock.
-- ---------------------------------------------------------------------------
create or replace function public.settle_ranked_elo(
  p_season_id integer,
  p_a         uuid,
  p_b         uuid,
  p_a_delta   integer,
  p_b_delta   integer,
  p_a_base    integer,
  p_b_base    integer,
  p_result    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  first_is_a boolean := p_a < p_b;
begin
  if p_result not in ('a_win', 'b_win', 'draw') then
    raise exception 'settle_ranked_elo: bad result %', p_result;
  end if;

  -- Deterministic lock order.
  if first_is_a then
    perform public._apply_elo_row(p_season_id, p_a, p_a_delta, p_a_base,
              p_result = 'a_win', p_result = 'b_win', p_result = 'draw');
    perform public._apply_elo_row(p_season_id, p_b, p_b_delta, p_b_base,
              p_result = 'b_win', p_result = 'a_win', p_result = 'draw');
  else
    perform public._apply_elo_row(p_season_id, p_b, p_b_delta, p_b_base,
              p_result = 'b_win', p_result = 'a_win', p_result = 'draw');
    perform public._apply_elo_row(p_season_id, p_a, p_a_delta, p_a_base,
              p_result = 'a_win', p_result = 'b_win', p_result = 'draw');
  end if;
end
$$;

create or replace function public._apply_elo_row(
  p_season_id integer,
  p_user_id   uuid,
  p_delta     integer,
  p_base      integer,
  p_won       boolean,
  p_lost      boolean,
  p_drew      boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.elo_ratings (
    user_id, season_id, rating, games_played, wins, losses, draws, updated_at
  )
  values (
    p_user_id, p_season_id, coalesce(p_base, 1200) + coalesce(p_delta, 0), 1,
    case when p_won then 1 else 0 end,
    case when p_lost then 1 else 0 end,
    case when p_drew then 1 else 0 end,
    now()
  )
  on conflict (user_id, season_id) do update
    set rating       = public.elo_ratings.rating + coalesce(p_delta, 0),
        games_played = public.elo_ratings.games_played + 1,
        wins         = public.elo_ratings.wins   + case when p_won  then 1 else 0 end,
        losses       = public.elo_ratings.losses + case when p_lost then 1 else 0 end,
        draws        = public.elo_ratings.draws  + case when p_drew then 1 else 0 end,
        updated_at   = now();
$$;

-- ---------------------------------------------------------------------------
-- 3. Promo code use, claimed atomically.
--
-- Returns true only if this call actually consumed a use. The WHERE clause
-- re-checks the limit inside the same statement that increments, so the
-- check-then-act window is gone: with max_uses = 25, exactly 25 callers can
-- ever get true, no matter how many fire at once.
--
-- api/redeem-code.ts must call this BEFORE minting the skin, and treat false
-- as "depleted".
-- ---------------------------------------------------------------------------
create or replace function public.claim_code_use(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with claimed as (
    update public.skin_codes
       set uses = uses + 1
     where code = p_code
       and (expires_at is null or expires_at > now())
       and (max_uses is null or uses < max_uses)
    returning code
  )
  select exists (select 1 from claimed);
$$;

-- Give a use back if the redemption fails after claiming it, so a transient
-- error doesn't silently burn a slot on a limited code. Floors at zero.
create or replace function public.release_code_use(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.skin_codes
     set uses = greatest(uses - 1, 0)
   where code = p_code;
$$;

-- ---------------------------------------------------------------------------
-- 4. Service-role only. These mutate counters with the definer's rights, so
--    they must never be reachable with an anon/authenticated JWT.
-- ---------------------------------------------------------------------------
revoke all on function public.bump_profile_after_run(uuid, integer, integer, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.settle_ranked_elo(integer, uuid, uuid, integer, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public._apply_elo_row(integer, uuid, integer, integer, boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public.claim_code_use(text) from public, anon, authenticated;
revoke all on function public.release_code_use(text) from public, anon, authenticated;

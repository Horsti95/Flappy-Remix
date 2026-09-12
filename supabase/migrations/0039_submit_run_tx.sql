-- 0039_submit_run_tx.sql
--
-- One transaction for the run-submit write path, and with it the last
-- read-then-act race in the API.
--
-- WHAT WAS STILL BROKEN. 0033 made each individual counter update atomic, but
-- api/submit-run.ts still performed the *decisions* in the application across
-- separate round trips:
--
--   1. count this user's daily runs for today        <-- read
--   2. if count >= 3, demote the run to casual
--   3. read the best prior score to decide isNewPb   <-- read
--   4. insert the run                                <-- write
--   5. bump the profile counters                     <-- write
--
-- Two submissions from the same player that interleave between (1) and (4)
-- both see the old count and both insert as `daily`, so the player gets 4+
-- daily attempts and 4 entries competing on a board that allows 3. The same
-- window makes both runs think they are a personal best, paying the +50 XP
-- bonus twice. And because (4) and (5) are separate statements, a failure
-- between them leaves a recorded run whose game and XP were never counted.
--
-- THE FIX. Do all of it inside one function, and take `FOR UPDATE` on the
-- player's profile row FIRST. That row is the natural serialisation point:
-- every submission by a given player touches it, so holding it makes that
-- player's submissions strictly sequential while leaving different players
-- fully concurrent. The daily count, the PB comparison, the insert and the
-- counter bump then all observe the same consistent state, and either all
-- commit or none do.
--
-- DELIBERATELY OUTSIDE THIS TRANSACTION (keep it short — it holds a row lock):
--   * replay validation / simulation — pure JS, expensive, no DB needed
--   * ranked settlement — already guarded by ranked_matches.version optimistic
--     concurrency plus settle_ranked_elo() from 0033
--   * challenge updates and skin/level minting — need JS generators, and are
--     compensated by the caller on failure
--
-- XP: the formula lives in src/game/xp.ts and must not be duplicated in SQL.
-- But its result depends on two things only this transaction can decide —
-- whether the daily cap demoted the run, and whether it is a personal best. So
-- the caller passes the handful of possible answers as `p_xp_by_outcome`
-- (keyed `<mode>_pb` / `<mode>_nopb`) and the transaction picks the one that
-- matches what it decided. One source of truth, one round trip.
--
-- Re-runnable. Apply via the Supabase SQL Editor (paste + Run).

create or replace function public.submit_run_tx(
  p_user_id            uuid,
  p_seed               bigint,
  p_score              integer,
  p_ticks              integer,
  p_inputs             jsonb,
  p_inputs_count       integer,
  p_inputs_hash        text,
  p_requested_mode     text,
  p_daily_date         date,
  p_equipped_skin_id   uuid,
  p_shape              text,
  p_body_r             smallint,
  p_body_g             smallint,
  p_body_b             smallint,
  p_accent_r           smallint,
  p_accent_g           smallint,
  p_accent_b           smallint,
  p_xp_by_outcome      jsonb,
  p_streak_days        integer,
  p_last_daily_play_at timestamptz,
  p_daily_max_attempts integer default 3,
  p_daily_seed         bigint default null
)
returns table (
  accepted             boolean,
  reason               text,
  run_id               uuid,
  effective_mode       text,
  effective_daily_date date,
  daily_over_cap       boolean,
  is_new_pb            boolean,
  xp_gain              integer,
  total_games          integer,
  xp_total             integer,
  streak_days          integer,
  prev_total_games     integer,
  prev_xp              integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev_games  integer;
  v_prev_xp     integer;
  v_mode        text := p_requested_mode;
  v_daily_date  date := p_daily_date;
  v_over_cap    boolean := false;
  v_is_pb       boolean;
  v_xp_gain     integer;
  v_run_id      uuid;
  v_attempts    integer;
  v_dupe_owner  uuid;
  v_new_games   integer;
  v_new_xp      integer;
  v_new_streak  integer;
begin
  -- 1. SERIALISATION POINT. Everything below reads and writes this player's
  --    state; locking the row makes their concurrent submissions sequential.
  --    Different players never contend, so this costs nothing at scale.
  select p.total_games, p.xp
    into v_prev_games, v_prev_xp
    from public.profiles p
   where p.user_id = p_user_id
     for update;

  if not found then
    return query select false, 'no_profile'::text, null::uuid, v_mode, null::date,
                        false, false, 0, 0, 0, 0, 0, 0;
    return;
  end if;

  -- 2. Duplicate / stolen replay. The unique index from 0032 is the real
  --    guarantee; checking here first lets us return the precise reason
  --    instead of surfacing a constraint violation.
  if p_inputs_hash is not null then
    select r.user_id into v_dupe_owner
      from public.runs r
     where r.inputs_hash = p_inputs_hash
     limit 1;
    if v_dupe_owner is not null then
      return query select
        false,
        case when v_dupe_owner = p_user_id then 'duplicate_run' else 'replay_theft' end::text,
        null::uuid, v_mode, null::date, false, false, 0,
        v_prev_games, v_prev_xp, 0, v_prev_games, v_prev_xp;
      return;
    end if;
  end if;

  -- 3. Personal best, decided under the lock so two runs can't both claim it.
  select p_score > coalesce(max(r.score), -1)
    into v_is_pb
    from public.runs r
   where r.user_id = p_user_id;
  v_is_pb := coalesce(v_is_pb, true);

  -- 4. Daily best-of-N. Counted under the lock, so the cap actually caps.
  if p_requested_mode = 'daily' then
    select count(*)
      into v_attempts
      from public.runs r
     where r.user_id = p_user_id
       and r.mode = 'daily'::public.run_mode
       and r.daily_date = p_daily_date;
    if v_attempts >= p_daily_max_attempts then
      v_over_cap := true;
      v_mode := 'casual';
      v_daily_date := null;
    end if;
  elsif p_requested_mode <> 'daily' then
    v_daily_date := case when p_requested_mode = 'challenge' then p_daily_date else null end;
  end if;

  -- 5. XP for the outcome we just decided (formula stays in src/game/xp.ts).
  v_xp_gain := coalesce(
    (p_xp_by_outcome ->> (v_mode || case when v_is_pb then '_pb' else '_nopb' end))::integer,
    0
  );
  if v_xp_gain < 0 then v_xp_gain := 0; end if;

  -- 6. The run itself.
  insert into public.runs (
    user_id, seed, score, ticks, inputs, inputs_count, inputs_hash,
    equipped_skin_id, mode, daily_date,
    shape, body_r, body_g, body_b, accent_r, accent_g, accent_b
  ) values (
    p_user_id, p_seed, p_score, p_ticks, p_inputs, p_inputs_count, p_inputs_hash,
    p_equipped_skin_id, v_mode::public.run_mode, v_daily_date,
    p_shape, p_body_r, p_body_g, p_body_b, p_accent_r, p_accent_g, p_accent_b
  )
  returning id into v_run_id;

  -- 7. Counters, in the same transaction as the insert.
  update public.profiles p
     set total_games        = p.total_games + 1,
         xp                 = p.xp + v_xp_gain,
         streak_days        = p_streak_days,
         last_daily_play_at = coalesce(p_last_daily_play_at, p.last_daily_play_at),
         last_play_at       = greatest(coalesce(p.last_play_at, now()), now())
   where p.user_id = p_user_id
  returning p.total_games, p.xp, p.streak_days
       into v_new_games, v_new_xp, v_new_streak;

  -- 8. Daily play counter / seed record, only when the run actually counted.
  if v_mode = 'daily' and v_daily_date is not null and p_daily_seed is not null then
    insert into public.daily_seeds (date, seed, plays_count)
    values (v_daily_date, p_daily_seed, 1)
    on conflict (date)
    do update set plays_count = public.daily_seeds.plays_count + 1;
  end if;

  return query select
    true, null::text, v_run_id, v_mode, v_daily_date, v_over_cap, v_is_pb,
    v_xp_gain, v_new_games, v_new_xp, v_new_streak, v_prev_games, v_prev_xp;
exception
  -- The unique replay-hash index fired between our check and the insert: a
  -- genuinely concurrent duplicate. Report it as such rather than a 500.
  when unique_violation then
    return query select false, 'duplicate_run'::text, null::uuid, v_mode, null::date,
                        false, false, 0, v_prev_games, v_prev_xp, 0,
                        v_prev_games, v_prev_xp;
end
$$;

-- NOTE on what this supersedes. bump_profile_after_run() (0033) and
-- upsert_daily_seed() (0002) are no longer called by api/submit-run.ts — their
-- work happens inside this transaction. They are intentionally NOT dropped:
-- dropping a function that a rollback, a cron job or an operator script might
-- still reference is riskier than leaving two unused ones in place, and
-- bump_profile_after_run() remains a correct standalone atomic bump if
-- anything ever needs one. They keep their grants from 0037.

-- Server-only: api/submit-run.ts calls this with the service-role key.
revoke all on function public.submit_run_tx(
  uuid, bigint, integer, integer, jsonb, integer, text, text, date, uuid, text,
  smallint, smallint, smallint, smallint, smallint, smallint, jsonb, integer,
  timestamptz, integer, bigint
) from public, anon, authenticated;

grant execute on function public.submit_run_tx(
  uuid, bigint, integer, integer, jsonb, integer, text, text, date, uuid, text,
  smallint, smallint, smallint, smallint, smallint, smallint, jsonb, integer,
  timestamptz, integer, bigint
) to service_role;

-- 0035_account_durability.sql
--
-- "If someone doesn't play for a long time, can their account be deleted or
-- overwritten?"  Auditing that question turned up one server-side risk worth
-- hardening. (The client-side risks are covered in src/social/auth.ts and
-- docs/account-durability.md.)
--
-- cleanup_stale_anonymous_users() (0021) deletes anonymous accounts that are
-- >30 days old with `total_games = 0` and no username. The intent is right —
-- reap tyre-kickers — but the predicate trusts ONE denormalised counter to
-- decide that an account is empty, and `profiles.total_games` is exactly the
-- field that could be wrong:
--
--   * it was written non-atomically until 0033, so a lost update could leave a
--     player who HAS played sitting at a stale count;
--   * api/submit-run.ts inserts the run row first and bumps the profile
--     second, and the bump is non-fatal on failure (by design — the run is
--     already recorded). A player whose only sessions all hit that failure
--     path has runs but total_games = 0;
--   * any future bug in that one write makes real accounts look empty.
--
-- The consequence is unrecoverable: deleting auth.users cascades profiles,
-- skins, friendships and ratings. So the predicate now also requires that the
-- account owns no actual CONTENT. Counters are a hint; rows are the truth.
--
-- Re-runnable. Apply via the Supabase SQL Editor (paste + Run).

create or replace function public.cleanup_stale_anonymous_users(
  older_than interval default '30 days'
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  deleted_count integer;
begin
  with stale as (
    select u.id
    from auth.users u
    join public.profiles p on p.user_id = u.id
    where u.is_anonymous = true
      and u.created_at < now() - older_than
      -- Denormalised hints (as before).
      and coalesce(p.total_games, 0) = 0
      and coalesce(p.xp, 0) = 0
      and coalesce(p.streak_days, 0) = 0
      and p.username is null
      and p.last_play_at is null
      -- Hard evidence. A row anywhere means this account is NOT a
      -- tyre-kicker, whatever the counters say.
      and not exists (select 1 from public.runs r where r.user_id = u.id)
      and not exists (select 1 from public.skins s where s.user_id = u.id)
      and not exists (select 1 from public.friendships f
                       where f.user_id = u.id or f.friend_id = u.id)
      and not exists (select 1 from public.elo_ratings e where e.user_id = u.id)
      and not exists (select 1 from public.skin_code_redemptions x where x.user_id = u.id)
      and not exists (select 1 from public.challenges c
                       where c.creator_id = u.id or c.responder_id = u.id)
      and not exists (select 1 from public.ranked_matches m
                       where m.player_a = u.id or m.player_b = u.id)
  ),
  del as (
    delete from auth.users
    where id in (select id from stale)
    returning id
  )
  select count(*) into deleted_count from del;
  return deleted_count;
end
$$;

comment on function public.cleanup_stale_anonymous_users(interval) is
  'Deletes anonymous accounts older than the interval that own NO content (no runs, skins, friends, ratings, redemptions, challenges or matches) and have zero counters. Counters alone are never sufficient - see 0035. Returns the number removed.';

revoke all on function public.cleanup_stale_anonymous_users(interval) from public;
revoke all on function public.cleanup_stale_anonymous_users(interval) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dry run BEFORE you ever schedule this. It must only list accounts you are
-- happy to lose forever:
--
--   select count(*) from auth.users u
--   join public.profiles p on p.user_id = u.id
--   where u.is_anonymous = true
--     and u.created_at < now() - interval '30 days'
--     and coalesce(p.total_games,0) = 0 and p.username is null
--     and not exists (select 1 from public.runs r where r.user_id = u.id);
--
-- NOT scheduled by this migration, on purpose. An unattended reaper that can
-- delete player accounts should be an explicit decision, not a side effect of
-- applying a migration.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Support-side recovery helper.
--
-- An anonymous player who loses their localStorage (cleared site data, browser
-- storage eviction, new device) cannot reach their account again: there is no
-- credential to prove ownership with. The app now shows each player a short
-- "recovery reference" (the first 8 characters of their user_id -- see
-- src/ui/account.ts), so that if they contact you, you can FIND the account.
--
-- This looks one up. Read-only and service-role only; it deliberately returns
-- no tokens and grants no access -- it exists so you can identify an account
-- and then attach a real credential to it (e.g. set an email on it via the
-- admin API and send a magic link), which is the only sound way to hand an
-- account back.
-- ---------------------------------------------------------------------------
create or replace function public.find_account_by_reference(p_ref text)
returns table (
  user_id      uuid,
  username     text,
  total_games  integer,
  xp           integer,
  streak_days  integer,
  runs_count   bigint,
  skins_count  bigint,
  created_at   timestamptz,
  last_play_at timestamptz,
  is_anonymous boolean
)
language sql
security definer
set search_path = public, auth
as $$
  select p.user_id,
         p.username,
         p.total_games,
         p.xp,
         p.streak_days,
         (select count(*) from public.runs r  where r.user_id = p.user_id),
         (select count(*) from public.skins s where s.user_id = p.user_id),
         p.created_at,
         p.last_play_at,
         u.is_anonymous
    from public.profiles p
    join auth.users u on u.id = p.user_id
   where length(coalesce(p_ref, '')) >= 6
     and p.user_id::text like lower(p_ref) || '%'
   order by p.created_at
   limit 25;
$$;

revoke all on function public.find_account_by_reference(text) from public;
revoke all on function public.find_account_by_reference(text) from anon, authenticated;

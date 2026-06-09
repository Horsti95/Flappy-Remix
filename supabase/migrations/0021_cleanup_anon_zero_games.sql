-- 0021_cleanup_anon_zero_games.sql
-- Reclaim "tyre-kicker" accounts. Every first visit mints a real anonymous
-- auth.users row (see src/social/auth.ts -> signInAnonymously). Visitors who
-- never actually play leave behind empty rows that bloat auth.users over time.
--
-- This adds a function that deletes anonymous accounts which:
--   * are still anonymous (never linked Google/Discord/Apple/email),
--   * have zero games on their profile,
--   * never claimed a username, and
--   * are older than `older_than` (default 30 days — a generous grace window).
--
-- Deleting the auth.users row cascades to profiles and everything keyed off it
-- (the same cascade the account-delete endpoint relies on). A 0-game anon has
-- no runs / skins / ranked rows anyway, so this is a safe, narrow sweep.
--
-- Apply via the Supabase SQL editor (paste + Run). Then either schedule it
-- (see the pg_cron block at the bottom) or call it from a trusted server
-- context. It is intentionally NOT exposed to the client (no RLS grant).

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
      and coalesce(p.total_games, 0) = 0
      and p.username is null
      and u.created_at < now() - older_than
  ),
  del as (
    delete from auth.users
    where id in (select id from stale)
    returning id
  )
  select count(*) into deleted_count from del;
  return deleted_count;
end;
$$;

comment on function public.cleanup_stale_anonymous_users(interval) is
  'Deletes anonymous, never-played, never-named accounts older than the given interval. Returns the number removed.';

-- Lock it down: only the service role / postgres should ever run this.
revoke all on function public.cleanup_stale_anonymous_users(interval) from public;
revoke all on function public.cleanup_stale_anonymous_users(interval) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dry-run preview (safe to run anytime — counts what WOULD be deleted):
--
--   select count(*)
--   from auth.users u
--   join public.profiles p on p.user_id = u.id
--   where u.is_anonymous = true
--     and coalesce(p.total_games, 0) = 0
--     and p.username is null
--     and u.created_at < now() - interval '30 days';
--
-- Run the cleanup manually:
--
--   select public.cleanup_stale_anonymous_users();          -- 30-day default
--   select public.cleanup_stale_anonymous_users('7 days');  -- more aggressive
--
-- Schedule it daily with pg_cron (enable the extension in Dashboard first):
--
--   select cron.schedule(
--     'cleanup-stale-anon',
--     '0 4 * * *',                                  -- 04:00 UTC daily
--     $$ select public.cleanup_stale_anonymous_users('30 days'); $$
--   );
-- ---------------------------------------------------------------------------

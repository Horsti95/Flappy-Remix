-- 0037_service_role_grants.sql
--
-- Make the server's own access EXPLICIT instead of inherited.
--
-- 0031 revoked client EXECUTE on every non-client function. It deliberately
-- did not touch `service_role`, and on a standard Supabase project that is
-- enough: Supabase's init runs
--
--   alter default privileges in schema public
--     grant execute on functions to postgres, anon, authenticated, service_role;
--
-- so every function gets an explicit service_role grant at creation time, and
-- `revoke ... from public, anon, authenticated` leaves it intact. Verified:
-- with those defaults in place, service_role can call all of the RPCs below
-- while anon/authenticated cannot.
--
-- That is still a bad thing to DEPEND on:
--
--   * it is an implicit platform default, not a stated intent of this schema;
--   * `service_role` is NOT a superuser and is NOT a member of `postgres`
--     (the function owner), so it has no inherent right to execute these —
--     if that default is ever absent, altered, or undone by a blanket
--     `revoke ... from service_role`, the grants silently disappear;
--   * the failure mode is severe and quiet. `bump_profile_after_run` would
--     start failing, api/submit-run.ts only logs that and falls back to local
--     arithmetic for the RESPONSE, so the client shows correct-looking numbers
--     while the database never records the game or the XP. Players would stop
--     making progress with no visible error. Promo redemption would 500,
--     ranked ratings would freeze, and feedback would 503.
--
-- So: state it. These grants are idempotent and make the dependency explicit
-- and greppable. scripts/test-migrations.sh now asserts them.
--
-- Re-runnable. Apply via the Supabase SQL Editor (paste + Run).

-- ---------------------------------------------------------------------------
-- Called by api/* with the service-role key.
-- ---------------------------------------------------------------------------
do $$
declare
  fn record;
  granted int := 0;
  -- Every function the server calls, plus the cron/maintenance helpers.
  -- Client-facing RPCs are granted to authenticated/anon by 0031 and are
  -- listed here too: api/* may legitimately call them server-side, and an
  -- explicit grant costs nothing.
  server_fns constant text[] := array[
    -- api/submit-run.ts
    'upsert_daily_seed',
    'bump_profile_after_run',
    'settle_ranked_elo',
    '_apply_elo_row',
    'submit_run_tx',
    -- api/redeem-code.ts
    'claim_code_use',
    'release_code_use',
    -- api/feedback.ts
    'claim_feedback_slot',
    -- api/link-code.ts
    'purge_link_codes',
    -- cron / maintenance / support
    'roll_season',
    'cleanup_stale_anonymous_users',
    'find_account_by_reference',
    -- client RPCs, also reachable server-side
    'add_friend_by_username',
    'incoming_friend_requests',
    'accept_friend_request',
    'decline_friend_request',
    'remove_friend',
    'inbox_incoming',
    'inbox_outgoing',
    'inbox_unseen_count',
    'inbox_mark_seen',
    'decline_challenge',
    'friends_leaderboard',
    'leaderboard_by',
    'public_profile',
    'best_run_ghost',
    'challenge_replay',
    'current_season'
  ];
begin
  for fn in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname = any(server_fns)
      and not exists (
        select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format(
      'grant execute on function public.%I(%s) to service_role',
      fn.proname, fn.args
    );
    granted := granted + 1;
  end loop;

  raise notice 'service_role: explicit EXECUTE on % function(s)', granted;

  if granted = 0 then
    raise exception 'no server functions matched - refusing to leave api/* without EXECUTE';
  end if;
end
$$;

-- Tables: api/* uses the service-role key for all privileged writes. Supabase
-- grants these by default too; restate it so a future column-level revoke
-- (0036 does one on runs) can never accidentally narrow the SERVER's access
-- while narrowing the client's.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Verify — every row must show t. Run this after applying.
--
--   select p.proname,
--          has_function_privilege('service_role', p.oid, 'execute') as svc
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('upsert_daily_seed','bump_profile_after_run',
--                       'settle_ranked_elo','_apply_elo_row','claim_code_use',
--                       'release_code_use','claim_feedback_slot',
--                       'purge_link_codes','submit_run_tx')
--   order by 1;
-- ---------------------------------------------------------------------------

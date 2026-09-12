-- 0031_function_privilege_lockdown.sql
--
-- SECURITY FIX (critical). PostgreSQL grants EXECUTE on every new function to
-- PUBLIC by default. Supabase's `anon` and `authenticated` roles inherit
-- PUBLIC, and PostgREST exposes the whole `public` schema over /rest/v1/rpc/*.
-- Result: every SECURITY DEFINER helper in this schema has been callable by
-- anyone holding the (publishable) anon key since the day it was created.
--
-- Nothing in migrations 0001-0030 revokes EXECUTE from a client role. Two of
-- the exposed functions are destructive:
--
--   roll_season()        — ends the live ranked season, snapshots the
--                          leaderboard, opens a new one and soft-resets every
--                          player's ELO toward 1200. A single anonymous
--                          POST /rest/v1/rpc/roll_season wipes a season.
--
--   upsert_daily_seed()  — worse than the counter nuisance it looks like. The
--                          body is `insert into daily_seeds (date, seed, ...)
--                          values (d, s, 1) on conflict (date) do update set
--                          plays_count = plays_count + 1`, so the SEED is
--                          caller-supplied on the INSERT path. Calling it for a
--                          FUTURE date pre-seeds that day's daily with a seed
--                          the caller has already practised — a daily
--                          leaderboard exploit, not just counter vandalism.
--
-- APPROACH. Rather than hand-listing signatures (which drifts every time a
-- function is re-created with new args — `leaderboard_by` has been rebuilt 5
-- times, `friends_leaderboard` 4), this revokes EXECUTE from anon+authenticated
-- on EVERY function in `public` EXCEPT an explicit allowlist of the RPCs the
-- client actually calls. That is still surgical (the allowlist protects the
-- app) but it cannot be defeated by an overload left behind by an
-- out-of-order apply, and it covers functions added before this migration that
-- nobody remembered to list.
--
-- The service-role key used by api/* is the schema owner's role and bypasses
-- these grants entirely, so the edge/node functions keep working. pg_cron runs
-- as postgres, likewise unaffected.
--
-- Re-runnable and idempotent. Apply via the Supabase SQL Editor (paste + Run).

-- ---------------------------------------------------------------------------
-- 1-3. The allowlist, the revoke, and the explicit re-grant.
--
-- The allowlist is every RPC called from src/ (verified by grep over
-- src/social/*.ts and src/ui/*.ts). Add to it when you add a client RPC.
--
-- It lives in a plpgsql array rather than a temp table on purpose: a
-- `create temporary table ... on commit drop` is dropped the moment the
-- statement commits under autocommit (psql, and the Supabase SQL Editor's
-- per-statement mode), so the following INSERT would fail with "relation does
-- not exist". An array has no such coupling and keeps this file runnable as a
-- single paste, inside a transaction or not.
-- ---------------------------------------------------------------------------
do $$
declare
  -- Called from the client with the anon/authenticated JWT. MUST stay granted.
  client_rpcs constant text[] := array[
    -- src/social/friends.ts
    'add_friend_by_username',
    'incoming_friend_requests',
    'accept_friend_request',
    'decline_friend_request',
    'remove_friend',            -- added in 0034 (symmetric removal)
    -- src/social/challenges.ts
    'inbox_incoming',
    'inbox_outgoing',
    'inbox_unseen_count',
    'inbox_mark_seen',
    'decline_challenge',
    -- src/social/leaderboard.ts
    'friends_leaderboard',
    'leaderboard_by',
    -- src/social/profile.ts
    'public_profile',
    'best_run_ghost',           -- added in 0036 (scoped ghost inputs)
    -- src/social/ranked.ts (season lookup)
    'current_season'
  ];
  -- Of those, the ones that are world-readable data (no auth.uid() in the
  -- body) and also feed the OG/share renderer, so `anon` keeps them.
  anon_rpcs constant text[] := array[
    'leaderboard_by',
    'public_profile',
    'best_run_ghost',
    'current_season'
  ];
  fn        record;
  revoked   int := 0;
  granted   int := 0;
begin
  for fn in
    select p.proname,
           pg_get_function_identity_arguments(p.oid) as args,
           p.proname = any(client_rpcs) as is_client
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'                      -- plain functions only
      -- Skip anything owned by an EXTENSION. Supabase keeps pgcrypto/uuid-ossp
      -- in the `extensions` schema, but a self-hosted or locally-scaffolded DB
      -- may have installed them into `public` -- and revoking EXECUTE on, say,
      -- gen_random_uuid() from `authenticated` breaks every INSERT that uses it
      -- as a column DEFAULT (defaults run as the inserting role). Extension
      -- privileges are the extension's business, not ours.
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    if fn.is_client then
      execute format(
        'grant execute on function public.%I(%s) to authenticated',
        fn.proname, fn.args
      );
      if fn.proname = any(anon_rpcs) then
        execute format(
          'grant execute on function public.%I(%s) to anon',
          fn.proname, fn.args
        );
      end if;
      granted := granted + 1;
    else
      execute format(
        'revoke all on function public.%I(%s) from public, anon, authenticated',
        fn.proname, fn.args
      );
      revoked := revoked + 1;
    end if;
  end loop;

  raise notice 'privilege lockdown: revoked % function(s), re-granted % client RPC(s)',
    revoked, granted;

  -- Fail loudly if the allowlist has rotted (a renamed/dropped RPC would
  -- otherwise silently leave the client with a 404 at runtime).
  if granted = 0 then
    raise exception 'allowlist matched no functions - refusing to lock out the client';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Close the door on FUTURE functions. Without this, the next `create
--    function` in this schema is world-executable all over again.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- 5. Verify. Run this after applying — it must return ZERO rows. Any row is a
--    public.* function still executable by a client role.
-- ---------------------------------------------------------------------------
--
--   select p.proname,
--          pg_get_function_identity_arguments(p.oid) as args,
--          r.rolname
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral (values ('anon'),('authenticated')) as r(rolname)
--   where n.nspname = 'public'
--     and p.prokind = 'f'
--     and has_function_privilege(r.rolname, p.oid, 'execute')
--     and p.proname not in (
--       'add_friend_by_username','incoming_friend_requests',
--       'accept_friend_request','decline_friend_request','remove_friend',
--       'inbox_incoming','inbox_outgoing','inbox_unseen_count',
--       'inbox_mark_seen','decline_challenge',
--       'friends_leaderboard','leaderboard_by','public_profile',
--       'best_run_ghost','current_season'
--     )
--   order by 1, 3;
--
-- And confirm the two critical ones are actually dead, as anon:
--
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/roll_season" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--     -H 'content-type: application/json' -d '{}'
--   -- expect: 404 / "Could not find the function" or 42501 permission denied
-- ---------------------------------------------------------------------------

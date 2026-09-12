-- 0040_search_path_hardening.sql
--
-- HARDENING (defence in depth, not a live hole).
--
-- Every SECURITY DEFINER function in this schema already pins a search_path —
-- none is left mutable, which is the actual vulnerability Supabase's linter
-- flags (`function_search_path_mutable`). But most pin it to `public`, and the
-- stronger form is an EMPTY search_path plus fully-qualified names:
--
--     set search_path = ''
--     ... select ... from public.runs ...
--
-- Why it is stronger: a SECURITY DEFINER function runs with the owner's
-- rights, so if an attacker can create an object in a schema on the function's
-- search_path, they can shadow a table or function the body refers to and have
-- it run as the owner. With `search_path = ''` nothing but `pg_catalog` is
-- searched implicitly, so every reference must be explicit and there is
-- nothing to shadow.
--
-- Why this is hardening rather than a fix: the shadowing route is already shut
-- on this project. `anon` and `authenticated` hold no CREATE privilege on
-- `public` (verified: has_schema_privilege(...,'public','create') is false for
-- both), so no client role can place an object there to shadow anything. This
-- removes the dependency on that remaining true.
--
-- HOW: `alter function ... set search_path` rather than recreating each body.
-- Argument and return types were resolved to OIDs at CREATE time and are not
-- re-resolved, so only the body's own references matter — and those were
-- already written fully qualified (`public.runs`, `auth.users`,
-- `public.run_mode`). scripts/test-migrations.sh exercises every function
-- below, so if any reference were in fact unqualified it fails there rather
-- than in production.
--
-- Scope: only functions introduced by migrations 0033-0039, whose bodies this
-- project owns and whose behaviour is covered by tests. The pre-existing
-- functions from 0001-0030 keep `search_path = public`; flipping those blind
-- would be a change to bodies nothing here verifies. They are safe as-is for
-- the reason above, and can be migrated individually as coverage grows.
--
-- Re-runnable. Apply via the Supabase SQL Editor (paste + Run).

alter function public.bump_profile_after_run(
  p_user_id uuid, p_xp_gain integer, p_streak_days integer,
  p_last_daily_play_at timestamptz, p_played_at timestamptz
) set search_path = '';

alter function public.settle_ranked_elo(
  p_season_id integer, p_a uuid, p_b uuid, p_a_delta integer,
  p_b_delta integer, p_a_base integer, p_b_base integer, p_result text
) set search_path = '';

alter function public._apply_elo_row(
  p_season_id integer, p_user_id uuid, p_delta integer, p_base integer,
  p_won boolean, p_lost boolean, p_drew boolean
) set search_path = '';

alter function public.claim_code_use(p_code text) set search_path = '';
alter function public.release_code_use(p_code text) set search_path = '';
alter function public.remove_friend(p_friend_id uuid) set search_path = '';
alter function public.enforce_run_skin_ownership() set search_path = '';
alter function public.purge_link_codes() set search_path = '';
alter function public.claim_feedback_slot(p_user_id uuid, p_cooldown interval) set search_path = '';
alter function public.cleanup_stale_anonymous_users(older_than interval) set search_path = '';
alter function public.find_account_by_reference(p_ref text) set search_path = '';
alter function public.best_run_ghost(p_username text) set search_path = '';

-- submit_run_tx (0039) was written with search_path = '' from the start.

-- ---------------------------------------------------------------------------
-- Verify: every function this project owns should show search_path='' , and
-- NONE may have a mutable (unset) search_path.
--
--   select p.proname, p.proconfig
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef
--   order by 1;
--
-- Anything with proconfig IS NULL is a mutable search_path and must be fixed.
-- ---------------------------------------------------------------------------

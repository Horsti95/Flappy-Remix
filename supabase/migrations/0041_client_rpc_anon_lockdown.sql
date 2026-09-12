-- 0041_client_rpc_anon_lockdown.sql
--
-- Three fixes. The first is a gap in MY OWN 0031; the other two are
-- pre-existing bugs that hunting the first one uncovered.
--
-- ===========================================================================
-- 1. THE GAP IN 0031 (reported by Supabase's advisor, and it is right)
-- ===========================================================================
--
-- 0031 walks every function in `public` and branches:
--
--     if <function is a client RPC> then
--       grant execute ... to authenticated;       -- and to anon for a few
--     else
--       revoke all ... from public, anon, authenticated;
--     end if;
--
-- The allowlist branch only ever GRANTS. It never revokes the PUBLIC default
-- the function was created with — so all 12 "authenticated-only" RPCs stayed
-- executable by `anon`. Verified: after 0001-0040, has_function_privilege(
-- 'anon', ...) was TRUE for every one of them.
--
-- Actual exploitability is low, because each of these checks auth.uid() itself
-- and the `anon` role has none: add_friend_by_username, accept/decline_friend_
-- request and remove_friend all return {"error":"unauthenticated"}, and the
-- inbox readers return empty. But that is the FUNCTION BODIES defending
-- themselves, which is exactly what a privilege layer exists to make
-- unnecessary — one future edit that reads a parameter before checking
-- auth.uid() turns it into a live hole. Close it at the grant level.
--
-- public_profile, leaderboard_by, best_run_ghost and current_season keep anon
-- deliberately: they serve world-readable data and feed the OG/share renderer.

do $$
declare
  fn record;
  -- Per-caller RPCs: they act on auth.uid(), so an unauthenticated caller has
  -- no business reaching them at all.
  auth_only constant text[] := array[
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
    'friends_leaderboard'
  ];
  fixed int := 0;
begin
  for fn in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname = any(auth_only)
      and not exists (
        select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    -- Revoke from PUBLIC first: that is where anon's inherited grant came
    -- from. Then re-grant to authenticated only.
    execute format('revoke all on function public.%I(%s) from public, anon',
                   fn.proname, fn.args);
    execute format('grant execute on function public.%I(%s) to authenticated',
                   fn.proname, fn.args);
    execute format('grant execute on function public.%I(%s) to service_role',
                   fn.proname, fn.args);
    fixed := fixed + 1;
  end loop;

  raise notice 'anon lockdown: % per-caller RPC(s) are now authenticated-only', fixed;

  if fixed = 0 then
    raise exception 'matched no functions - the allowlist has rotted, refusing to no-op silently';
  end if;
end
$$;

-- ===========================================================================
-- 2. friends_leaderboard() HAS BEEN BROKEN SINCE 0013
-- ===========================================================================
--
-- Found while testing whether the anon grant above was exploitable: calling it
-- fails for EVERY caller, authenticated included:
--
--     ERROR: column reference "user_id" is ambiguous
--     LINE 8: select friend_id from public.friendships where user_id = auth.uid()
--
-- The RETURNS TABLE declares an OUT column named `user_id`, so inside the body
-- a bare `user_id` could mean that OUT parameter or friendships.user_id, and
-- PostgreSQL refuses to guess. It is a plpgsql function, so the ambiguity only
-- surfaces at CALL time — which is why it shipped: nothing in the test suite
-- ever called this one with a real auth.uid().
--
-- Meaning: the "friends" tab on the leaderboard has been erroring in
-- production since migration 0013.
--
-- Second bug in the same query, visible once it stops erroring: no status
-- filter. friendships rows can be 'pending' (0014), and src/social/friends.ts
-- listFriends() filters `status = 'accepted'` — this did not, so a player you
-- had merely SENT a request to would appear on your friends board before they
-- accepted.
--
-- Fixed by aliasing the subquery table and filtering on status.

create or replace function public.friends_leaderboard(
  p_period text default 'weekly',
  p_mode text default 'all'
)
returns table (
  run_id uuid,
  user_id uuid,
  username text,
  score integer,
  seed bigint,
  mode text,
  daily_date date,
  created_at timestamptz,
  equipped_shape text,
  body_r smallint, body_g smallint, body_b smallint,
  accent_r smallint, accent_g smallint, accent_b smallint,
  skin_rarity text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  return query
    select l.run_id, l.user_id, l.username, l.score, l.seed, l.mode,
           l.daily_date, l.created_at, l.equipped_shape,
           l.body_r, l.body_g, l.body_b,
           l.accent_r, l.accent_g, l.accent_b, l.skin_rarity
    from public.leaderboard_by(p_period, p_mode) l
    where l.user_id = auth.uid()
       or l.user_id in (
         -- `f.` alias: a bare user_id here collides with the OUT parameter of
         -- the same name above and raises "column reference is ambiguous".
         -- `status`: only confirmed friendships, matching listFriends().
         select f.friend_id
           from public.friendships f
          where f.user_id = auth.uid()
            and f.status = 'accepted'
       )
    order by l.score desc, l.created_at desc
    limit 100;
end;
$$;

-- Re-granted here because CREATE OR REPLACE keeps existing grants, but if this
-- ever runs on a database where the function was dropped first, the new one
-- would carry only the PUBLIC default.
revoke all on function public.friends_leaderboard(text, text) from public, anon;
grant execute on function public.friends_leaderboard(text, text) to authenticated, service_role;

-- ===========================================================================
-- 3. security_invoker ON THE LEADERBOARD VIEWS
-- ===========================================================================
--
-- Supabase's advisor flags six views (`_lb_runs` and the five leaderboard_*
-- views) as SECURITY DEFINER. A view runs with its OWNER's privileges by
-- default, so it can read past the caller's RLS and column grants.
--
-- Checked before acting: none of these selects `runs.inputs`, so 0036's
-- column revoke is NOT bypassed, and everything they do expose (scores,
-- usernames, cosmetics) is already world-readable by design. So this is
-- hygiene, not a live hole.
--
-- Still worth doing: `security_invoker = true` (PostgreSQL 15+) makes them
-- respect the caller's own privileges, so a future column revoke on `runs`
-- automatically applies through the views too instead of silently not.
do $$
declare
  v record;
  n int := 0;
begin
  for v in
    select c.relname
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relkind = 'v'
      and c.relname in ('_lb_runs', 'leaderboard_all_time', 'leaderboard_weekly',
                        'leaderboard_monthly', 'leaderboard_daily', 'leaderboard_total')
  loop
    execute format('alter view public.%I set (security_invoker = true)', v.relname);
    n := n + 1;
  end loop;
  raise notice 'security_invoker set on % leaderboard view(s)', n;
end
$$;

-- ===========================================================================
-- Verify: the first query must return ZERO rows.
--
--   select p.proname
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute')
--     and p.proname in ('add_friend_by_username','incoming_friend_requests',
--       'accept_friend_request','decline_friend_request','remove_friend',
--       'inbox_incoming','inbox_outgoing','inbox_unseen_count',
--       'inbox_mark_seen','decline_challenge','friends_leaderboard');
--
-- And the friends leaderboard must actually run (as a signed-in user):
--   select count(*) from public.friends_leaderboard('weekly','casual');
-- ===========================================================================

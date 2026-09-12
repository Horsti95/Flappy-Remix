-- 0034_friends_symmetry_and_hygiene.sql
--
-- Four fixes that share no theme beyond "should have been like this already".

-- ---------------------------------------------------------------------------
-- 1. SYMMETRIC FRIEND REMOVAL  (trust / safety)
--
-- Friendships are stored as two directional rows, and
-- `friendships_delete_self` (0003) only permits deleting the row where
-- auth.uid() = user_id. src/social/friends.ts removeFriend() therefore deleted
-- ONE direction and said so in a comment ("Only delete our own side").
--
-- The result is not merely inconsistent data: the person you removed still has
-- you in their friends list, still sees you on their friends leaderboard, and
-- can still send you challenges. "Remove" that leaves the other party's access
-- intact is a broken safety control — if someone removes a friend to get away
-- from them, this did not do that.
--
-- SECURITY DEFINER so it can delete the row the caller doesn't own, scoped
-- strictly to friendships involving the caller. Also drops any leftover
-- pending request rows in either direction, so removing and re-adding starts
-- from a clean state instead of resurrecting a stale 'pending'.
-- ---------------------------------------------------------------------------
create or replace function public.remove_friend(p_friend_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  removed int;
begin
  if me is null then
    return json_build_object('error', 'not_authenticated');
  end if;
  if p_friend_id is null or p_friend_id = me then
    return json_build_object('error', 'bad_target');
  end if;

  -- Both directions, but ONLY pairs that include the caller. A caller can
  -- never use this to sever two other people's friendship.
  delete from public.friendships
   where (user_id = me and friend_id = p_friend_id)
      or (user_id = p_friend_id and friend_id = me);
  get diagnostics removed = row_count;

  return json_build_object('ok', true, 'removed', removed);
end
$$;

grant execute on function public.remove_friend(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. RUN COSMETIC OWNERSHIP  (entitlement)
--
-- 0023 added a trigger enforcing that profiles.equipped_skin_id references a
-- skin you own. runs.equipped_skin_id got no such guard, and
-- api/submit-run.ts writes it straight from the client payload
-- (`equipped_skin_id: body.equipped_skin_id ?? null`). So a player could
-- submit a run wearing someone else's rare skin and have it render that way on
-- the leaderboard and share card.
--
-- Enforced with a trigger rather than an API check so it also covers the
-- service-role write path, exactly like 0023 does for profiles.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_run_skin_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.equipped_skin_id is not null then
    if not exists (
      select 1 from public.skins s
      where s.id = new.equipped_skin_id
        and s.user_id = new.user_id
    ) then
      -- Don't reject the run — the score is legitimate, only the cosmetic
      -- claim isn't. Strip it and carry on, so a stale client can't lose a
      -- player's genuine run.
      new.equipped_skin_id := null;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists runs_enforce_skin_ownership on public.runs;
create trigger runs_enforce_skin_ownership
  before insert or update on public.runs
  for each row execute function public.enforce_run_skin_ownership();

revoke all on function public.enforce_run_skin_ownership() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. LINK CODE RETENTION  (secrets at rest)
--
-- link_codes stores a RAW Supabase refresh token per row (0029). api/link-code
-- marks a code consumed but never deletes the row, and nothing purges expired
-- ones — so the table accumulates working-then-stale session tokens forever.
-- A database backup or a leaked service key exposes historical sessions.
--
-- The API now deletes the row on redemption (see api/link-code.ts). This adds
-- the sweep for rows that are expired or were never redeemed, plus a helper
-- the API calls opportunistically so the table stays small even with no cron.
-- ---------------------------------------------------------------------------
create or replace function public.purge_link_codes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted int;
begin
  delete from public.link_codes
   where expires_at < now()
      or consumed_at is not null;
  get diagnostics deleted = row_count;
  return deleted;
end
$$;

revoke all on function public.purge_link_codes() from public, anon, authenticated;

-- One-time cleanup of everything already stale.
select public.purge_link_codes();

-- Optional: schedule it (pg_cron). Hourly is plenty — codes live ~10 minutes.
--   select cron.schedule('purge-link-codes', '0 * * * *',
--     $$ select public.purge_link_codes(); $$);

-- ---------------------------------------------------------------------------
-- 4. FEEDBACK RATE LIMIT  (abuse)
--
-- api/feedback.ts rate-limits with an in-process Map, which is per instance.
-- Serverless spreads requests across instances, so the limit was trivially
-- bypassed by retrying until a cold instance answered. A tiny table makes it
-- shared and durable.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_rate_limit (
  user_id   uuid primary key references public.profiles(user_id) on delete cascade,
  last_sent timestamptz not null default now(),
  sent_count integer not null default 1
);

alter table public.feedback_rate_limit enable row level security;
-- No client policies: service-role only.
revoke all on public.feedback_rate_limit from anon, authenticated;

-- Returns true if the caller may send now, and records the send. One statement,
-- so it is not raceable across instances.
create or replace function public.claim_feedback_slot(
  p_user_id  uuid,
  p_cooldown interval default '10 minutes'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  insert into public.feedback_rate_limit (user_id, last_sent, sent_count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
    set last_sent  = now(),
        sent_count = public.feedback_rate_limit.sent_count + 1
    where public.feedback_rate_limit.last_sent < now() - p_cooldown
  returning true into allowed;

  return coalesce(allowed, false);
end
$$;

revoke all on function public.claim_feedback_slot(uuid, interval) from public, anon, authenticated;

-- 0007_challenge_inbox.sql
-- Direct challenges: a challenge can target a specific friend, who
-- then sees it in an "incoming" inbox and explicitly accepts (plays)
-- or declines it. Open links (target_user_id null) keep working
-- exactly as before — they just never appear in anyone's inbox.
--
-- Adds:
--   * challenges.target_user_id  — the addressed friend (nullable)
--   * challenges.status          — 'pending' | 'accepted' | 'declined'
--                                  (only meaningful when targeted)
--   * challenges.seen_at         — when the recipient first opened the
--                                  inbox row (drives the unseen badge)
--
-- Plus two RPCs the client calls:
--   * inbox_incoming()  — pending targeted challenges sent TO me
--   * inbox_outgoing()  — targeted challenges I sent, with their status
--
-- Apply via Supabase SQL Editor (paste this file, hit Run).

alter table public.challenges
  add column if not exists target_user_id uuid references public.profiles(user_id) on delete set null,
  add column if not exists status text not null default 'open',
  add column if not exists seen_at timestamptz default null;

-- 'open' = shareable link (legacy behaviour). 'pending'/'accepted'/
-- 'declined' only apply to targeted challenges.
alter table public.challenges
  drop constraint if exists challenges_status_chk;
alter table public.challenges
  add constraint challenges_status_chk
  check (status in ('open', 'pending', 'accepted', 'declined'));

create index if not exists challenges_target_idx
  on public.challenges(target_user_id, status, created_at desc)
  where target_user_id is not null;

-- Incoming: pending challenges addressed to the caller. Includes the
-- creator's handle + score so the inbox can render without extra
-- round-trips.
create or replace function public.inbox_incoming()
returns table (
  short_id text,
  creator_id uuid,
  creator_username text,
  creator_score integer,
  created_at timestamptz,
  seen_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select c.short_id, c.creator_id, p.username, c.creator_score, c.created_at, c.seen_at
  from public.challenges c
  join public.profiles p on p.user_id = c.creator_id
  where c.target_user_id = auth.uid()
    and c.status = 'pending'
    and c.expires_at > now()
  order by c.created_at desc
  limit 50;
$$;

grant execute on function public.inbox_incoming() to authenticated;

-- Outgoing: targeted challenges the caller has sent, with status +
-- the recipient's handle so the sender sees who still owes them a run.
create or replace function public.inbox_outgoing()
returns table (
  short_id text,
  target_username text,
  status text,
  creator_score integer,
  responder_score integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select c.short_id, p.username, c.status, c.creator_score, c.responder_score, c.created_at
  from public.challenges c
  join public.profiles p on p.user_id = c.target_user_id
  where c.creator_id = auth.uid()
    and c.target_user_id is not null
    and c.expires_at > now()
  order by c.created_at desc
  limit 50;
$$;

grant execute on function public.inbox_outgoing() to authenticated;

-- Mark all of the caller's pending incoming rows as seen (clears the
-- unseen badge). Returns the count touched.
create or replace function public.inbox_mark_seen()
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.challenges
    set seen_at = now()
    where target_user_id = auth.uid()
      and status = 'pending'
      and seen_at is null
    returning 1
  )
  select count(*)::int from updated;
$$;

grant execute on function public.inbox_mark_seen() to authenticated;

-- Count of unseen incoming challenges — cheap call for the menu badge.
create or replace function public.inbox_unseen_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public.challenges
  where target_user_id = auth.uid()
    and status = 'pending'
    and seen_at is null
    and expires_at > now();
$$;

grant execute on function public.inbox_unseen_count() to authenticated;

-- Decline a targeted challenge (recipient only).
create or replace function public.decline_challenge(p_short_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.challenges
  set status = 'declined'
  where short_id = p_short_id
    and target_user_id = auth.uid()
    and status = 'pending'
  returning true;
$$;

grant execute on function public.decline_challenge(text) to authenticated;

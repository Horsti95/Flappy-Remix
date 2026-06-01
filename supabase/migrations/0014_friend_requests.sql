-- 0014: friend requests (accept/decline) replacing instant auto-accept.
--
-- Until now add_friend_by_username inserted BOTH directional rows
-- immediately, so sending = friends. This adds a per-row `status`:
--   'accepted' — a confirmed friendship (both users see each other)
--   'pending'  — a sent request awaiting the other side
--
-- Model: the directional rows already exist (user_id -> friend_id). A request
-- A→B inserts ONE row (A→B, pending = "I asked"); we DON'T insert the reverse
-- until B accepts. Accepting inserts/sets both rows to 'accepted'. Existing
-- rows are backfilled to 'accepted' so current friendships keep working.
--
-- Additive column + new RPCs; no data lost. Re-runnable.

alter table public.friendships
  add column if not exists status text not null default 'accepted';

alter table public.friendships
  drop constraint if exists friendships_status_chk;
alter table public.friendships
  add constraint friendships_status_chk check (status in ('pending', 'accepted'));

-- Send a friend request (or auto-accept if they already requested you).
-- Returns json { ok, state: 'accepted'|'requested', friend_id } or { error }.
create or replace function public.add_friend_by_username(target_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  target_uid uuid;
  reverse_exists boolean;
begin
  if caller is null then
    return json_build_object('error', 'unauthenticated');
  end if;
  select user_id into target_uid from public.profiles where username = lower(target_username);
  if target_uid is null then
    return json_build_object('error', 'not_found');
  end if;
  if target_uid = caller then
    return json_build_object('error', 'self');
  end if;

  -- Already accepted? Nothing to do.
  if exists (select 1 from public.friendships
             where user_id = caller and friend_id = target_uid and status = 'accepted') then
    return json_build_object('ok', true, 'state', 'accepted', 'friend_id', target_uid);
  end if;

  -- Did the target already request the caller? Then accept: both rows accepted.
  select exists (select 1 from public.friendships
                 where user_id = target_uid and friend_id = caller and status = 'pending')
    into reverse_exists;

  if reverse_exists then
    update public.friendships set status = 'accepted'
      where user_id = target_uid and friend_id = caller;
    insert into public.friendships (user_id, friend_id, status)
      values (caller, target_uid, 'accepted')
      on conflict (user_id, friend_id) do update set status = 'accepted';
    return json_build_object('ok', true, 'state', 'accepted', 'friend_id', target_uid);
  end if;

  -- Otherwise record a single pending request caller -> target.
  insert into public.friendships (user_id, friend_id, status)
    values (caller, target_uid, 'pending')
    on conflict (user_id, friend_id) do nothing;
  return json_build_object('ok', true, 'state', 'requested', 'friend_id', target_uid);
end;
$$;

grant execute on function public.add_friend_by_username(text) to authenticated;

-- Incoming pending requests addressed to the caller (someone asked them).
create or replace function public.incoming_friend_requests()
returns table (user_id uuid, username text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select f.user_id, p.username, f.created_at
  from public.friendships f
  join public.profiles p on p.user_id = f.user_id
  where f.friend_id = auth.uid()
    and f.status = 'pending'
    and not exists (
      select 1 from public.friendships f2
      where f2.user_id = auth.uid() and f2.friend_id = f.user_id and f2.status = 'accepted'
    )
  order by f.created_at desc;
$$;

grant execute on function public.incoming_friend_requests() to authenticated;

-- Accept a request from `requester_id`: both rows become accepted.
create or replace function public.accept_friend_request(requester_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then return json_build_object('error', 'unauthenticated'); end if;
  -- Must be a real pending request to the caller.
  if not exists (select 1 from public.friendships
                 where user_id = requester_id and friend_id = caller and status = 'pending') then
    return json_build_object('error', 'no_request');
  end if;
  update public.friendships set status = 'accepted'
    where user_id = requester_id and friend_id = caller;
  insert into public.friendships (user_id, friend_id, status)
    values (caller, requester_id, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';
  return json_build_object('ok', true, 'friend_id', requester_id);
end;
$$;

grant execute on function public.accept_friend_request(uuid) to authenticated;

-- Decline a request from `requester_id`: drop their pending row.
create or replace function public.decline_friend_request(requester_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then return json_build_object('error', 'unauthenticated'); end if;
  delete from public.friendships
    where user_id = requester_id and friend_id = caller and status = 'pending';
  return json_build_object('ok', true);
end;
$$;

grant execute on function public.decline_friend_request(uuid) to authenticated;

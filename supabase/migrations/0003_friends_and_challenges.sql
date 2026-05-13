-- M4: friendships (denormalized two-row), challenges, ghost replay
-- storage, depth cap.

create table public.friendships (
  user_id    uuid not null references public.profiles(user_id) on delete cascade,
  friend_id  uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index friendships_friend_id_idx on public.friendships(friend_id);

alter table public.friendships enable row level security;

create policy "friendships_select_self"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "friendships_delete_self"
  on public.friendships for delete
  using (auth.uid() = user_id);

-- Bi-directional add via RPC under security definer so it bypasses
-- RLS for the symmetric insert.
create or replace function public.add_friend_by_username(target_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  target_uid uuid;
begin
  if caller is null then
    return json_build_object('error', 'unauthenticated');
  end if;
  select user_id into target_uid
    from public.profiles
    where username = lower(target_username);
  if target_uid is null then
    return json_build_object('error', 'not_found');
  end if;
  if target_uid = caller then
    return json_build_object('error', 'self');
  end if;
  insert into public.friendships (user_id, friend_id) values (caller, target_uid)
    on conflict do nothing;
  insert into public.friendships (user_id, friend_id) values (target_uid, caller)
    on conflict do nothing;
  return json_build_object('ok', true, 'friend_id', target_uid);
end;
$$;

grant execute on function public.add_friend_by_username(text) to authenticated;

-- Challenges
create table public.challenges (
  id            uuid primary key default gen_random_uuid(),
  short_id      text unique not null,
  creator_id    uuid not null references public.profiles(user_id) on delete cascade,
  source_run_id uuid references public.runs(id) on delete set null,
  seed          bigint not null,
  inputs        jsonb not null,
  creator_score integer not null,
  parent_id     uuid references public.challenges(id) on delete set null,
  depth         integer not null default 1,
  responder_id  uuid references public.profiles(user_id) on delete set null,
  responder_score integer,
  responder_run_id uuid references public.runs(id) on delete set null,
  responded_at  timestamptz,
  expires_at    timestamptz not null default (now() + interval '14 days'),
  created_at    timestamptz not null default now(),
  constraint challenge_depth_cap check (depth between 1 and 2)
);
create index challenges_creator_idx on public.challenges(creator_id, created_at desc);
create index challenges_responder_idx on public.challenges(responder_id, created_at desc)
  where responder_id is not null;
create index challenges_short_idx on public.challenges(short_id);
create index challenges_parent_idx on public.challenges(parent_id);

alter table public.challenges enable row level security;

create policy "challenges_select_short_id"
  on public.challenges for select using (true);

-- Friend code generator already exists for profiles; reuse it for
-- the short_id alphabet but at length 8 for challenges to keep
-- collision odds low.
create or replace function public.gen_challenge_short_id()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  exists_count int;
  attempts int := 0;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    select count(*) into exists_count from public.challenges where short_id = code;
    exit when exists_count = 0;
    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'could not allocate challenge short_id';
    end if;
  end loop;
  return code;
end;
$$;

-- Friends-only leaderboard view. PostgREST passes auth.uid() via the
-- request context, so policies on `runs` already enforce select; we
-- just need a query the client can hit. We expose it as a function
-- so the user filter is implicit.
create or replace function public.friends_leaderboard()
returns table (
  run_id uuid,
  user_id uuid,
  username text,
  score integer,
  seed bigint,
  mode text,
  daily_date date,
  created_at timestamptz,
  body_r smallint, body_g smallint, body_b smallint,
  accent_r smallint, accent_g smallint, accent_b smallint,
  skin_rarity text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.id, r.user_id, p.username, r.score, r.seed, r.mode::text,
    r.daily_date, r.created_at,
    s.body_r, s.body_g, s.body_b,
    s.accent_r, s.accent_g, s.accent_b,
    s.rarity
  from public.runs r
  left join public.profiles p on p.user_id = r.user_id
  left join public.skins s on s.id = r.equipped_skin_id
  where r.mode in ('casual','daily','challenge')
    and (
      r.user_id = auth.uid()
      or r.user_id in (
        select friend_id from public.friendships where user_id = auth.uid()
      )
    )
  order by r.score desc, r.created_at desc
  limit 100;
$$;

grant execute on function public.friends_leaderboard() to authenticated, anon;

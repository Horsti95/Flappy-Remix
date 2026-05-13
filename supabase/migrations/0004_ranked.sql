-- M5: ranked best-of-three, ELO, seasons.

create table public.seasons (
  id          serial primary key,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  name        text
);

-- Bootstrap a current season for the schema to satisfy NOT NULL refs
-- below. The season-reset RPC handles flipping this each month.
insert into public.seasons (started_at, name)
  values (now(), to_char(now() at time zone 'utc', 'YYYY-MM'));

create table public.elo_ratings (
  user_id       uuid primary key references public.profiles(user_id) on delete cascade,
  season_id     int not null references public.seasons(id),
  rating        int not null default 1200,
  games_played  int not null default 0,
  wins          int not null default 0,
  losses        int not null default 0,
  draws         int not null default 0,
  updated_at    timestamptz not null default now()
);

-- Snapshot rating at the end of each season so the top-100 badge is
-- stable forever.
create table public.elo_season_snapshots (
  season_id  int not null references public.seasons(id) on delete cascade,
  user_id    uuid not null references public.profiles(user_id) on delete cascade,
  rating     int not null,
  rank       int not null,
  snapshotted_at timestamptz not null default now(),
  primary key (season_id, user_id)
);
create index elo_season_snapshots_top_idx on public.elo_season_snapshots(season_id, rank);

create type public.match_state as enum ('pending', 'in_progress', 'completed', 'expired', 'cancelled');

create table public.ranked_matches (
  id           uuid primary key default gen_random_uuid(),
  season_id    int not null references public.seasons(id),
  player_a     uuid not null references public.profiles(user_id) on delete cascade,
  player_b     uuid not null references public.profiles(user_id) on delete cascade,
  seeds        bigint[] not null,
  a_scores     int[] not null default '{}',
  b_scores     int[] not null default '{}',
  a_run_ids    uuid[] not null default '{}',
  b_run_ids    uuid[] not null default '{}',
  state        match_state not null default 'in_progress',
  winner_id    uuid references public.profiles(user_id),
  a_rating_before int,
  b_rating_before int,
  a_rating_after  int,
  b_rating_after  int,
  expires_at   timestamptz not null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  check (array_length(seeds, 1) = 3),
  check (player_a <> player_b)
);
create index ranked_matches_player_a_idx on public.ranked_matches(player_a, state);
create index ranked_matches_player_b_idx on public.ranked_matches(player_b, state);
create index ranked_matches_season_idx on public.ranked_matches(season_id, completed_at desc);

create table public.matchmaking_queue (
  user_id        uuid primary key references public.profiles(user_id) on delete cascade,
  season_id      int not null references public.seasons(id),
  rating_at_join int not null,
  joined_at      timestamptz not null default now()
);

alter table public.seasons enable row level security;
alter table public.elo_ratings enable row level security;
alter table public.elo_season_snapshots enable row level security;
alter table public.ranked_matches enable row level security;
alter table public.matchmaking_queue enable row level security;

create policy "seasons_select_all" on public.seasons for select using (true);
create policy "elo_ratings_select_all" on public.elo_ratings for select using (true);
create policy "elo_snapshots_select_all" on public.elo_season_snapshots for select using (true);
create policy "ranked_matches_select_participant"
  on public.ranked_matches for select
  using (auth.uid() = player_a or auth.uid() = player_b);
create policy "queue_select_self"
  on public.matchmaking_queue for select using (auth.uid() = user_id);

create or replace function public.current_season()
returns int
language sql
stable
as $$
  select id from public.seasons where ended_at is null order by started_at desc limit 1;
$$;

grant execute on function public.current_season() to authenticated, anon;

-- Snapshot top 100 of the current season, mark it ended, open a new
-- one. Run monthly via supabase cron or a manual admin trigger.
create or replace function public.roll_season(new_name text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  old_id int;
  new_id int;
begin
  select id into old_id from public.seasons where ended_at is null order by started_at desc limit 1;
  if old_id is null then
    raise exception 'no active season';
  end if;

  insert into public.elo_season_snapshots (season_id, user_id, rating, rank)
    select old_id, user_id, rating, row_number() over (order by rating desc)
    from public.elo_ratings
    where season_id = old_id;

  update public.seasons set ended_at = now() where id = old_id;

  insert into public.seasons (started_at, name)
    values (now(), coalesce(new_name, to_char(now() at time zone 'utc', 'YYYY-MM')))
    returning id into new_id;

  -- Carry over ratings as soft-reset toward 1200 (75% pull-back) so
  -- early-season climbing matters.
  insert into public.elo_ratings (user_id, season_id, rating, games_played)
    select user_id, new_id, round(1200 + (rating - 1200) * 0.25)::int, 0
    from public.elo_ratings
    where season_id = old_id;

  return new_id;
end;
$$;

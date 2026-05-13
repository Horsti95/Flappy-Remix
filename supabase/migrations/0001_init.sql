-- Pflug initial schema.
-- Auth users live in auth.users (managed by Supabase). Public-facing
-- metadata lives in `profiles`. Game state (skins, runs, daily seeds)
-- lives in dedicated tables. Friends/challenges/ranked land in later
-- migrations.

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  username     text unique,
  total_games  integer not null default 0,
  streak_days  integer not null default 0,
  last_play_at timestamptz,
  equipped_skin_id uuid,
  created_at   timestamptz not null default now(),
  constraint username_format check (
    username is null
    or (username ~ '^[a-z0-9]{3,8}$')
  )
);

create table public.skins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  body_r      smallint not null check (body_r between 0 and 255),
  body_g      smallint not null check (body_g between 0 and 255),
  body_b      smallint not null check (body_b between 0 and 255),
  accent_r    smallint not null check (accent_r between 0 and 255),
  accent_g    smallint not null check (accent_g between 0 and 255),
  accent_b    smallint not null check (accent_b between 0 and 255),
  encoded_int bigint not null,
  rarity      text not null check (rarity in ('common','uncommon','rare','epic','legendary')),
  unlocked_at_games integer not null,
  unlocked_at timestamptz not null default now()
);
create index skins_user_id_idx on public.skins(user_id);
create unique index skins_user_encoded_idx on public.skins(user_id, encoded_int);

alter table public.profiles
  add constraint profiles_equipped_skin_fk
  foreign key (equipped_skin_id) references public.skins(id) on delete set null;

create type public.run_mode as enum ('casual','daily','challenge','ranked');

create table public.runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(user_id) on delete set null,
  seed          bigint not null,
  score         integer not null check (score >= 0),
  ticks         integer not null check (ticks >= 0),
  inputs        jsonb not null,
  inputs_count  integer not null,
  equipped_skin_id uuid references public.skins(id) on delete set null,
  mode          run_mode not null default 'casual',
  daily_date    date,
  created_at    timestamptz not null default now()
);
create index runs_user_id_idx on public.runs(user_id);
create index runs_score_idx on public.runs(score desc, created_at desc);
create index runs_daily_idx on public.runs(daily_date, score desc) where daily_date is not null;
create index runs_created_idx on public.runs(created_at desc);

create table public.daily_seeds (
  date       date primary key,
  seed       bigint not null,
  plays_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- RLS

alter table public.profiles enable row level security;
alter table public.skins enable row level security;
alter table public.runs enable row level security;
alter table public.daily_seeds enable row level security;

-- Profiles: anyone can read (for leaderboard display names); owners can
-- create / update their own row.
create policy "profiles_select_all"
  on public.profiles for select using (true);
create policy "profiles_insert_self"
  on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_self"
  on public.profiles for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Skins: readable by anyone (for skin display on leaderboards / share
-- cards), but only the server (service role) can mint new ones.
create policy "skins_select_all"
  on public.skins for select using (true);

-- Runs: readable by anyone (leaderboard queries). Direct inserts are
-- denied — the /api/submit-run edge function uses the service role key
-- after server-side replay validation.
create policy "runs_select_all"
  on public.runs for select using (true);

-- Daily seeds: world-readable.
create policy "daily_seeds_select_all"
  on public.daily_seeds for select using (true);

-- Auto-create a profile row when an auth user signs up. The trigger
-- runs as the postgres role so it bypasses RLS.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Materialized helpers for leaderboards. Use plain views — Supabase
-- exposes them through PostgREST and the indexes on runs make them
-- cheap.

create or replace view public.leaderboard_all_time as
  select
    r.id        as run_id,
    r.user_id,
    r.score,
    r.seed,
    r.mode,
    r.daily_date,
    r.created_at,
    p.username,
    p.equipped_skin_id,
    s.body_r, s.body_g, s.body_b,
    s.accent_r, s.accent_g, s.accent_b,
    s.rarity   as skin_rarity
  from public.runs r
  left join public.profiles p on p.user_id = r.user_id
  left join public.skins s on s.id = r.equipped_skin_id
  where r.mode in ('casual','daily')
  order by r.score desc, r.created_at desc;

create or replace view public.leaderboard_weekly as
  select * from public.leaderboard_all_time
  where created_at >= now() - interval '7 days';

create or replace view public.leaderboard_daily as
  select * from public.leaderboard_all_time
  where daily_date = (now() at time zone 'utc')::date
    and mode = 'daily';

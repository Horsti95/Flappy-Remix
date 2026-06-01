-- 0012: persist + expose equipped SHAPE so other players' shapes render on
-- the leaderboard and on public profiles (not just their colors).
--
-- The equipped shape was client-only (localStorage). This adds
-- profiles.equipped_shape and threads it through the leaderboard views, the
-- friends_leaderboard() RPC, and public_profile(). Views are dropped +
-- recreated (rather than create-or-replace) so the new column can sit in a
-- stable position; this migration is the authoritative definition of them.
--
-- Additive column; no run/score data is touched. Re-runnable.

alter table public.profiles add column if not exists equipped_shape text;

-- Rebuild the leaderboard view stack with equipped_shape included.
drop view if exists public.leaderboard_all_time;
drop view if exists public.leaderboard_weekly;
drop view if exists public.leaderboard_monthly;
drop view if exists public.leaderboard_daily;
drop view if exists public.leaderboard_total;
drop view if exists public._lb_runs;

-- Per-run projection with display joins (one row per run). Period views
-- dedupe over this to one row per user. `runs`/`profiles`/`skins` are already
-- world-readable for leaderboards, so this exposes nothing new.
create view public._lb_runs as
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
    p.equipped_shape,
    s.body_r, s.body_g, s.body_b,
    s.accent_r, s.accent_g, s.accent_b,
    s.rarity   as skin_rarity
  from public.runs r
  left join public.profiles p on p.user_id = r.user_id
  left join public.skins s on s.id = r.equipped_skin_id
  where r.mode in ('casual','daily');

-- All-time: each player's best run ever.
create view public.leaderboard_all_time as
  select distinct on (user_id)
    run_id, user_id, score, seed, mode, daily_date, created_at,
    username, equipped_skin_id, equipped_shape,
    body_r, body_g, body_b, accent_r, accent_g, accent_b, skin_rarity
  from public._lb_runs
  order by user_id, score desc, created_at desc;

-- Weekly: best run in the last 7 days.
create view public.leaderboard_weekly as
  select distinct on (user_id)
    run_id, user_id, score, seed, mode, daily_date, created_at,
    username, equipped_skin_id, equipped_shape,
    body_r, body_g, body_b, accent_r, accent_g, accent_b, skin_rarity
  from public._lb_runs
  where created_at >= now() - interval '7 days'
  order by user_id, score desc, created_at desc;

-- Monthly: best run in the current UTC calendar month.
create view public.leaderboard_monthly as
  select distinct on (user_id)
    run_id, user_id, score, seed, mode, daily_date, created_at,
    username, equipped_skin_id, equipped_shape,
    body_r, body_g, body_b, accent_r, accent_g, accent_b, skin_rarity
  from public._lb_runs
  where created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc')
  order by user_id, score desc, created_at desc;

-- Daily: best daily-mode run for today's UTC date.
create view public.leaderboard_daily as
  select distinct on (user_id)
    run_id, user_id, score, seed, mode, daily_date, created_at,
    username, equipped_skin_id, equipped_shape,
    body_r, body_g, body_b, accent_r, accent_g, accent_b, skin_rarity
  from public._lb_runs
  where mode = 'daily'
    and daily_date = (now() at time zone 'utc')::date
  order by user_id, score desc, created_at desc;

-- Total: aggregated sum-of-scores per user (one row each).
create view public.leaderboard_total as
  select
    (array_agg(r.id order by r.score desc, r.created_at desc))[1] as run_id,
    r.user_id,
    sum(r.score)::integer as score,
    null::bigint as seed,
    null::run_mode as mode,
    null::date as daily_date,
    max(r.created_at) as created_at,
    p.username,
    p.equipped_skin_id,
    p.equipped_shape,
    s.body_r, s.body_g, s.body_b,
    s.accent_r, s.accent_g, s.accent_b,
    s.rarity as skin_rarity
  from public.runs r
  left join public.profiles p on p.user_id = r.user_id
  left join public.skins s on s.id = p.equipped_skin_id
  where r.mode in ('casual','daily')
  group by
    r.user_id, p.username, p.equipped_skin_id, p.equipped_shape,
    s.body_r, s.body_g, s.body_b, s.accent_r, s.accent_g, s.accent_b, s.rarity
  order by score desc;

grant select on public.leaderboard_all_time to anon, authenticated;
grant select on public.leaderboard_weekly to anon, authenticated;
grant select on public.leaderboard_monthly to anon, authenticated;
grant select on public.leaderboard_daily to anon, authenticated;
grant select on public.leaderboard_total to anon, authenticated;

-- Friends leaderboard, period-aware, now also returning equipped_shape.
drop function if exists public.friends_leaderboard(text);
create function public.friends_leaderboard(p_period text default 'weekly')
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
declare
  v_view text;
begin
  v_view := case p_period
    when 'daily'   then 'leaderboard_daily'
    when 'monthly' then 'leaderboard_monthly'
    when 'total'   then 'leaderboard_total'
    else 'leaderboard_weekly'
  end;
  return query execute format(
    'select l.run_id, l.user_id, l.username, l.score, l.seed, l.mode::text,'
    || ' l.daily_date, l.created_at, l.equipped_shape, l.body_r, l.body_g, l.body_b,'
    || ' l.accent_r, l.accent_g, l.accent_b, l.skin_rarity'
    || ' from public.%I l'
    || ' where l.user_id = auth.uid()'
    || '    or l.user_id in (select friend_id from public.friendships where user_id = auth.uid())'
    || ' order by l.score desc, l.created_at desc'
    || ' limit 100',
    v_view
  );
end;
$$;

grant execute on function public.friends_leaderboard(text) to anon, authenticated;

-- public_profile: also return the equipped shape so the profile card can
-- draw the player's real shape, not a default plane.
drop function if exists public.public_profile(text);
create function public.public_profile(p_username text)
returns table (
  user_id uuid,
  username text,
  created_at timestamptz,
  total_games integer,
  streak_days integer,
  best_score integer,
  total_score bigint,
  avg_score numeric,
  ranked_rating integer,
  ranked_wins integer,
  ranked_losses integer,
  ranked_draws integer,
  best_rank integer,
  equipped_shape text,
  equipped_body_r smallint, equipped_body_g smallint, equipped_body_b smallint,
  equipped_accent_r smallint, equipped_accent_g smallint, equipped_accent_b smallint,
  equipped_rarity text
)
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select * from public.profiles where username = lower(p_username)
  ),
  run_stats as (
    select
      r.user_id,
      max(r.score) as best_score,
      sum(r.score)::bigint as total_score,
      round(avg(r.score), 1) as avg_score
    from public.runs r
    join p on p.user_id = r.user_id
    where r.mode in ('casual','daily')
    group by r.user_id
  ),
  elo as (
    select e.user_id, e.rating, e.wins, e.losses, e.draws
    from public.elo_ratings e
    join p on p.user_id = e.user_id
    order by e.season_id desc
    limit 1
  ),
  badge as (
    select s.user_id, min(s.rank) as best_rank
    from public.elo_season_snapshots s
    join p on p.user_id = s.user_id
    group by s.user_id
  )
  select
    p.user_id,
    p.username,
    p.created_at,
    coalesce(p.total_games, 0),
    coalesce(p.streak_days, 0),
    coalesce(rs.best_score, 0),
    coalesce(rs.total_score, 0)::bigint,
    coalesce(rs.avg_score, 0),
    elo.rating,
    coalesce(elo.wins, 0),
    coalesce(elo.losses, 0),
    coalesce(elo.draws, 0),
    badge.best_rank,
    p.equipped_shape,
    sk.body_r, sk.body_g, sk.body_b,
    sk.accent_r, sk.accent_g, sk.accent_b,
    sk.rarity
  from p
  left join run_stats rs on rs.user_id = p.user_id
  left join elo on elo.user_id = p.user_id
  left join badge on badge.user_id = p.user_id
  left join public.skins sk on sk.id = p.equipped_skin_id;
$$;

grant execute on function public.public_profile(text) to anon, authenticated;

-- 0009: leaderboard dedupe — one row per player (their BEST run) per period.
--
-- Until now the period views (all_time / weekly / monthly / daily) returned
-- one row PER RUN, so a single strong player could occupy many rows on the
-- board. This redefines each period view to show each player ONCE, with their
-- best run inside that period's window (MAX score, newest as tie-break). The
-- `total` view already aggregates per player and is left untouched.
--
-- This is also a prerequisite for daily "3 attempts, best counts": the daily
-- board must rank a player's best attempt, not list all three.
--
-- Views only — no data is touched. Re-runnable (create or replace).

-- Internal per-run projection with display joins. Each period view dedupes
-- over this with DISTINCT ON. Not exposed to clients directly; the public
-- period views (which carry the existing grants) read from it. `runs` is
-- already world-readable (see 0001 RLS), so this exposes nothing new.
create or replace view public._lb_runs as
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
  where r.mode in ('casual','daily');

-- All-time: each player's best run ever. Column list + order match the
-- original 0001 definition so dependent objects and the client keep working.
create or replace view public.leaderboard_all_time as
  select * from (
    select distinct on (user_id) *
    from public._lb_runs
    order by user_id, score desc, created_at desc
  ) best
  order by score desc, created_at desc;

-- Weekly: each player's best run in the last 7 days.
create or replace view public.leaderboard_weekly as
  select * from (
    select distinct on (user_id) *
    from public._lb_runs
    where created_at >= now() - interval '7 days'
    order by user_id, score desc, created_at desc
  ) best
  order by score desc, created_at desc;

-- Monthly: each player's best run in the current UTC calendar month.
create or replace view public.leaderboard_monthly as
  select * from (
    select distinct on (user_id) *
    from public._lb_runs
    where created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc')
    order by user_id, score desc, created_at desc
  ) best
  order by score desc, created_at desc;

-- Daily: each player's best daily-mode run for today's UTC date.
create or replace view public.leaderboard_daily as
  select * from (
    select distinct on (user_id) *
    from public._lb_runs
    where mode = 'daily'
      and daily_date = (now() at time zone 'utc')::date
    order by user_id, score desc, created_at desc
  ) best
  order by score desc, created_at desc;

grant select on public.leaderboard_all_time to anon, authenticated;
grant select on public.leaderboard_weekly to anon, authenticated;
grant select on public.leaderboard_monthly to anon, authenticated;
grant select on public.leaderboard_daily to anon, authenticated;

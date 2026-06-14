-- 0027: snapshot the SHAPE + skin COLORS a run was flown with, so the
-- leaderboard shows the cosmetics the run actually used — not whatever the
-- player happens to have equipped now.
--
-- Adds nullable snapshot columns to public.runs. Old rows stay null; the
-- leaderboard RPCs coalesce the run snapshot over the live profile/skin join
-- so historical runs still render a plane (their player's *current* look) and
-- new runs render their captured look. All columns additive / re-runnable.

alter table public.runs add column if not exists shape    text;
alter table public.runs add column if not exists body_r   smallint;
alter table public.runs add column if not exists body_g   smallint;
alter table public.runs add column if not exists body_b   smallint;
alter table public.runs add column if not exists accent_r smallint;
alter table public.runs add column if not exists accent_g smallint;
alter table public.runs add column if not exists accent_b smallint;

-- Defensive range checks (smallint can hold out-of-range values otherwise).
-- Validated only against new rows so the migration never fails on legacy data.
alter table public.runs drop constraint if exists runs_snapshot_color_range;
alter table public.runs add constraint runs_snapshot_color_range check (
  (body_r is null or body_r between 0 and 255) and
  (body_g is null or body_g between 0 and 255) and
  (body_b is null or body_b between 0 and 255) and
  (accent_r is null or accent_r between 0 and 255) and
  (accent_g is null or accent_g between 0 and 255) and
  (accent_b is null or accent_b between 0 and 255)
) not valid;

-- Rebuild leaderboard_by() to prefer the per-run snapshot, falling back to the
-- live profile/skin join (old rows where the snapshot columns are null).
drop function if exists public.leaderboard_by(text, text);
create function public.leaderboard_by(
  p_period text default 'weekly',
  p_mode text default 'all'
)
returns table (
  run_id uuid,
  user_id uuid,
  score integer,
  seed bigint,
  mode text,
  daily_date date,
  created_at timestamptz,
  username text,
  equipped_skin_id uuid,
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
  v_mode_filter text;
  v_where text;
begin
  if p_mode = 'casual' or p_mode = 'daily' or p_mode = 'ranked' then
    v_mode_filter := format('r.mode = %L::run_mode', p_mode);
  else
    v_mode_filter := $q$r.mode in ('casual','daily','ranked')$q$;
  end if;

  if p_period = 'total' then
    -- Aggregated sum-of-scores per user (one row each). The cosmetic snapshot
    -- shown is from the user's best single run (the one whose id is picked),
    -- coalesced over their live equipped look for older snapshot-less runs.
    return query execute format($q$
      with agg as (
        select
          (array_agg(r.id order by r.score desc, r.created_at desc))[1] as run_id,
          r.user_id,
          sum(r.score)::integer as score,
          max(r.created_at) as created_at
        from public.runs r
        where %s
        group by r.user_id
      )
      select
        agg.run_id,
        agg.user_id,
        agg.score,
        null::bigint as seed,
        null::text as mode,
        null::date as daily_date,
        agg.created_at,
        p.username,
        p.equipped_skin_id,
        coalesce(br.shape, p.equipped_shape) as equipped_shape,
        coalesce(br.body_r, s.body_r), coalesce(br.body_g, s.body_g), coalesce(br.body_b, s.body_b),
        coalesce(br.accent_r, s.accent_r), coalesce(br.accent_g, s.accent_g), coalesce(br.accent_b, s.accent_b),
        s.rarity as skin_rarity
      from agg
      left join public.runs br on br.id = agg.run_id
      left join public.profiles p on p.user_id = agg.user_id
      left join public.skins s on s.id = p.equipped_skin_id
      order by agg.score desc
    $q$, v_mode_filter);
    return;
  end if;

  v_where := case p_period
    when 'daily' then
      $q$r.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')$q$
    when 'monthly' then
      $q$r.created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc')$q$
    when 'weekly' then
      $q$r.created_at >= now() - interval '7 days'$q$
    else
      $q$true$q$
  end;

  return query execute format($q$
    select distinct on (r.user_id)
      r.id as run_id,
      r.user_id,
      r.score,
      r.seed,
      r.mode::text,
      r.daily_date,
      r.created_at,
      p.username,
      p.equipped_skin_id,
      coalesce(r.shape, p.equipped_shape) as equipped_shape,
      coalesce(r.body_r, s.body_r), coalesce(r.body_g, s.body_g), coalesce(r.body_b, s.body_b),
      coalesce(r.accent_r, s.accent_r), coalesce(r.accent_g, s.accent_g), coalesce(r.accent_b, s.accent_b),
      s.rarity as skin_rarity
    from public.runs r
    left join public.profiles p on p.user_id = r.user_id
    left join public.skins s on s.id = r.equipped_skin_id
    where %s and %s
    order by r.user_id, r.score desc, r.created_at desc
  $q$, v_mode_filter, v_where);
end;
$$;

grant execute on function public.leaderboard_by(text, text) to anon, authenticated;

-- Rebuild the _lb_runs projection + period views (used by friends_leaderboard)
-- to carry the per-run snapshot, coalesced over the live join as above.
drop view if exists public.leaderboard_all_time;
drop view if exists public.leaderboard_weekly;
drop view if exists public.leaderboard_monthly;
drop view if exists public.leaderboard_daily;
drop view if exists public.leaderboard_total;
drop view if exists public._lb_runs;

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
    coalesce(r.shape, p.equipped_shape) as equipped_shape,
    coalesce(r.body_r, s.body_r) as body_r,
    coalesce(r.body_g, s.body_g) as body_g,
    coalesce(r.body_b, s.body_b) as body_b,
    coalesce(r.accent_r, s.accent_r) as accent_r,
    coalesce(r.accent_g, s.accent_g) as accent_g,
    coalesce(r.accent_b, s.accent_b) as accent_b,
    s.rarity   as skin_rarity
  from public.runs r
  left join public.profiles p on p.user_id = r.user_id
  left join public.skins s on s.id = r.equipped_skin_id
  where r.mode in ('casual','daily');

create view public.leaderboard_all_time as
  select distinct on (user_id)
    run_id, user_id, score, seed, mode, daily_date, created_at,
    username, equipped_skin_id, equipped_shape,
    body_r, body_g, body_b, accent_r, accent_g, accent_b, skin_rarity
  from public._lb_runs
  order by user_id, score desc, created_at desc;

create view public.leaderboard_weekly as
  select distinct on (user_id)
    run_id, user_id, score, seed, mode, daily_date, created_at,
    username, equipped_skin_id, equipped_shape,
    body_r, body_g, body_b, accent_r, accent_g, accent_b, skin_rarity
  from public._lb_runs
  where created_at >= now() - interval '7 days'
  order by user_id, score desc, created_at desc;

create view public.leaderboard_monthly as
  select distinct on (user_id)
    run_id, user_id, score, seed, mode, daily_date, created_at,
    username, equipped_skin_id, equipped_shape,
    body_r, body_g, body_b, accent_r, accent_g, accent_b, skin_rarity
  from public._lb_runs
  where created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc')
  order by user_id, score desc, created_at desc;

create view public.leaderboard_daily as
  select distinct on (user_id)
    run_id, user_id, score, seed, mode, daily_date, created_at,
    username, equipped_skin_id, equipped_shape,
    body_r, body_g, body_b, accent_r, accent_g, accent_b, skin_rarity
  from public._lb_runs
  where mode = 'daily'
    and daily_date = (now() at time zone 'utc')::date
  order by user_id, score desc, created_at desc;

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

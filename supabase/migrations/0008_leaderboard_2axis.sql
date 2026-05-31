-- Leaderboard 2-axis: scope {global, friends} × period {daily, weekly, monthly, total}.
--
-- Adds the two missing periods as views (monthly best-run, total
-- aggregated score-per-user) and reworks friends_leaderboard() into a
-- period-parameterised function so friends scope covers all four periods.
--
-- daily / weekly already exist from 0001_init.sql. This migration adds
-- monthly + total and the parameterised friends RPC. Re-runnable.

-- Monthly = best single run in the current UTC calendar month.
-- Reuses the leaderboard_all_time projection, same as weekly/daily.
create or replace view public.leaderboard_monthly as
  select * from public.leaderboard_all_time
  where created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc');

-- Total = aggregated SUM of all of a user's run scores (casual + daily),
-- one row per user, ranked by that sum. There is no single run, so:
--   run_id     -> the user's top-scoring run (handy for linking)
--   seed/mode/daily_date -> null (not meaningful for an aggregate)
--   created_at -> the user's most recent run
--   skin       -> the user's *currently equipped* profile skin
-- Column list + order mirror leaderboard_all_time so the client can read
-- the same field names.
create or replace view public.leaderboard_total as
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
    s.body_r, s.body_g, s.body_b,
    s.accent_r, s.accent_g, s.accent_b,
    s.rarity as skin_rarity
  from public.runs r
  left join public.profiles p on p.user_id = r.user_id
  left join public.skins s on s.id = p.equipped_skin_id
  where r.mode in ('casual','daily')
  group by
    r.user_id, p.username, p.equipped_skin_id,
    s.body_r, s.body_g, s.body_b, s.accent_r, s.accent_g, s.accent_b, s.rarity
  order by score desc;

grant select on public.leaderboard_monthly to anon, authenticated;
grant select on public.leaderboard_total to anon, authenticated;

-- Friends leaderboard, now period-aware. Drop the old no-arg version
-- first since adding a defaulted parameter changes the signature.
drop function if exists public.friends_leaderboard();

create or replace function public.friends_leaderboard(p_period text default 'weekly')
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
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_view text;
begin
  -- Whitelist the view name (no user input reaches %I directly).
  v_view := case p_period
    when 'daily'   then 'leaderboard_daily'
    when 'monthly' then 'leaderboard_monthly'
    when 'total'   then 'leaderboard_total'
    else 'leaderboard_weekly'
  end;
  return query execute format(
    'select l.run_id, l.user_id, l.username, l.score, l.seed, l.mode::text,'
    || ' l.daily_date, l.created_at, l.body_r, l.body_g, l.body_b,'
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

-- 0016: add 'ranked' to the leaderboard MODE axis → {all, casual, ranked, daily}.
--
-- 0013 gave us leaderboard_by(period, mode) with mode in {all, casual, daily},
-- where 'all' meant mode in ('casual','daily'). This widens the axis:
--   * p_mode = 'ranked'  → r.mode = 'ranked'
--   * p_mode = 'casual'  → r.mode = 'casual'   (unchanged)
--   * p_mode = 'daily'   → r.mode = 'daily'    (unchanged)
--   * p_mode = 'all'     → r.mode in ('casual','daily','ranked')  (now incl. ranked)
--
-- Re-runnable; no schema/data changes. friends_leaderboard delegates to
-- leaderboard_by so it inherits the new axis automatically.

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
  -- Normalize / validate the mode axis.
  if p_mode = 'casual' or p_mode = 'daily' or p_mode = 'ranked' then
    v_mode_filter := format('r.mode = %L::run_mode', p_mode);
  else
    v_mode_filter := $q$r.mode in ('casual','daily','ranked')$q$;
  end if;

  if p_period = 'total' then
    -- Aggregated sum-of-scores per user (one row each), filtered by mode.
    return query execute format($q$
      select
        (array_agg(r.id order by r.score desc, r.created_at desc))[1] as run_id,
        r.user_id,
        sum(r.score)::integer as score,
        null::bigint as seed,
        null::text as mode,
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
      where %s
      group by
        r.user_id, p.username, p.equipped_skin_id, p.equipped_shape,
        s.body_r, s.body_g, s.body_b, s.accent_r, s.accent_g, s.accent_b, s.rarity
      order by score desc
    $q$, v_mode_filter);
    return;
  end if;

  -- Per-period best-run-per-user. Build the period predicate, then dedupe.
  v_where := case p_period
    when 'daily' then
      $q$r.mode = 'daily'::run_mode and r.daily_date = (now() at time zone 'utc')::date$q$
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
      p.equipped_shape,
      s.body_r, s.body_g, s.body_b,
      s.accent_r, s.accent_g, s.accent_b,
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

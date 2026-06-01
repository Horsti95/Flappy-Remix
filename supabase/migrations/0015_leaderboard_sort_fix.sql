-- 0015: fix leaderboard_by per-period ordering.
--
-- 0013's per-period branch used `distinct on (r.user_id) ... order by
-- r.user_id, r.score desc` to keep each player's best run. That dedupes
-- correctly but RETURNS rows ordered by user_id, not by score — so the board
-- looked unsorted (rank 1 might show a lower score than rank 2). Wrap the
-- DISTINCT ON in an outer query that re-sorts by score desc.
--
-- Only the per-period branch changes; the `total` branch already ordered by
-- score. Re-runnable.

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
  if p_mode = 'casual' or p_mode = 'daily' then
    v_mode_filter := format('r.mode = %L::run_mode', p_mode);
  else
    v_mode_filter := $q$r.mode in ('casual','daily')$q$;
  end if;

  if p_period = 'total' then
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

  -- Dedupe to each user's best run (inner DISTINCT ON), THEN sort by score.
  return query execute format($q$
    select * from (
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
    ) best
    order by best.score desc, best.created_at desc
  $q$, v_mode_filter, v_where);
end;
$$;

grant execute on function public.leaderboard_by(text, text) to anon, authenticated;

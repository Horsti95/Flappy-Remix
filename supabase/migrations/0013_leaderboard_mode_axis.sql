-- 0013: add a third leaderboard axis — MODE {all, casual, daily}.
--
-- The period views (0012) always filter `r.mode in ('casual','daily')`, i.e.
-- they are implicitly the "all" mode. This adds a `leaderboard_by(period, mode)`
-- RPC that returns the same column shape as those views but lets the caller
-- narrow to a single mode ('casual' or 'daily'), or keep 'all'.
--
-- p_mode in ('all','casual','daily'): 'all' = mode in ('casual','daily'),
-- otherwise mode = p_mode. The "total" period sums per user, filtered by mode.
--
-- friends_leaderboard() gains an optional p_mode param so the friends scope can
-- use the same axis. No schema/data changes; re-runnable.

-- Global, period-aware + mode-aware leaderboard.
-- Returns the same column shape as the 0012 leaderboard views (incl.
-- equipped_shape) so the client mapping is unchanged.
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
  if p_mode = 'casual' or p_mode = 'daily' then
    v_mode_filter := format('r.mode = %L::run_mode', p_mode);
  else
    v_mode_filter := $q$r.mode in ('casual','daily')$q$;
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

-- Friends leaderboard, now also mode-aware. Keeps the 0012 single-arg
-- signature working (p_mode defaults to 'all') and adds a two-arg variant.
drop function if exists public.friends_leaderboard(text);
drop function if exists public.friends_leaderboard(text, text);
create function public.friends_leaderboard(
  p_period text default 'weekly',
  p_mode text default 'all'
)
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
begin
  return query
    select l.run_id, l.user_id, l.username, l.score, l.seed, l.mode,
           l.daily_date, l.created_at, l.equipped_shape,
           l.body_r, l.body_g, l.body_b,
           l.accent_r, l.accent_g, l.accent_b, l.skin_rarity
    from public.leaderboard_by(p_period, p_mode) l
    where l.user_id = auth.uid()
       or l.user_id in (
         select friend_id from public.friendships where user_id = auth.uid()
       )
    order by l.score desc, l.created_at desc
    limit 100;
end;
$$;

grant execute on function public.friends_leaderboard(text, text) to anon, authenticated;

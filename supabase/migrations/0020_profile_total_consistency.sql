-- Align the profile card's totals with the leaderboard and the intended
-- scoring rules.
--
-- Two bugs this fixes:
--   1. total_score on the profile summed only ('casual','daily'), while the
--      leaderboard "total" axis (0019_leaderboard_today.sql) sums
--      ('casual','daily','ranked'). Ranked runs showed up on the scoreboard
--      total but not the profile total, so the two numbers disagreed. The
--      rule is now uniform: total counts every mode EXCEPT 'challenge'.
--   2. best_score (the player's personal record) excluded 'challenge' and
--      'ranked' runs, so a high score set while challenging a profile's best
--      never became your record. Best now spans ALL modes — every run can set
--      a record. (The competitive public "best" leaderboard stays in
--      leaderboard_by() and still excludes 'challenge' to avoid fixed-seed
--      grinding; this only changes your own profile record.)

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
  -- Total + average: every mode except challenge (matches the leaderboard).
  run_stats as (
    select
      r.user_id,
      sum(r.score)::bigint as total_score,
      round(avg(r.score), 1) as avg_score
    from public.runs r
    join p on p.user_id = r.user_id
    where r.mode in ('casual','daily','ranked')
    group by r.user_id
  ),
  -- Personal record: any run, any mode, can set your best.
  best_stats as (
    select
      r.user_id,
      max(r.score) as best_score
    from public.runs r
    join p on p.user_id = r.user_id
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
    coalesce(bs.best_score, 0),
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
  left join best_stats bs on bs.user_id = p.user_id
  left join elo on elo.user_id = p.user_id
  left join badge on badge.user_id = p.user_id
  left join public.skins sk on sk.id = p.equipped_skin_id;
$$;

grant execute on function public.public_profile(text) to anon, authenticated;

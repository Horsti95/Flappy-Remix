-- 0011: public_profile() RPC — read-only aggregate view of any player by
-- username, for the in-app profile inspector.
--
-- Exposes ONLY safe aggregates (handle, ranked W/L/D + rating, best score,
-- total score, games played, derived average, top season badge). Never raw
-- runs, inputs, email, or auth data. SECURITY DEFINER so it can read the
-- aggregate tables under a fixed search_path without widening RLS on them.
--
-- Tables read are already world-readable for leaderboards (profiles, runs,
-- skins) or hold no PII (elo_ratings, elo_season_snapshots); this just
-- packages them behind one stable call.

create or replace function public.public_profile(p_username text)
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
    -- Most recent season's rating row for the player.
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

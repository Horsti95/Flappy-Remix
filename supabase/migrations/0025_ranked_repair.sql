-- 0025_ranked_repair.sql
--
-- Three structural fixes for the ranked subsystem:
--
--  1. elo_ratings had PRIMARY KEY (user_id) but roll_season() inserts a
--     second row per user for the new season — every season roll would have
--     aborted on a PK violation. Seasonal composite key fixes it before the
--     first real roll.
--  2. ranked_matches.version: optimistic-concurrency stamp so two players
--     settling the same match concurrently can't overwrite each other's
--     round scores or settle Elo twice (submit-run retries on a version
--     mismatch).
--  3. (Used by the API) expired in_progress matches get closed lazily; no
--     schema change needed beyond what exists — state 'expired' is already
--     in the match_state enum.

-- 1. Seasonal Elo rows.
alter table public.elo_ratings drop constraint elo_ratings_pkey;
alter table public.elo_ratings add primary key (user_id, season_id);

-- 2. Optimistic lock for settlement.
alter table public.ranked_matches
  add column if not exists version integer not null default 0;

-- 0036_run_inputs_privacy.sql
--
-- PRIVACY FIX. `runs_select_all using (true)` (0001) makes every column of
-- every run world-readable with the publishable anon key — including `inputs`,
-- the per-tick trace of exactly when a player tapped. So this worked for
-- anyone:
--
--   GET /rest/v1/runs?select=user_id,inputs&order=score.desc
--
-- i.e. bulk-harvest the behavioural trace of every player who has ever played.
-- That is re-identifiable timing data, and PRIVACY.md tells players nobody
-- else gets their data.
--
-- WHY IT WAS LIKE THIS: ghost duels replay someone else's inputs, so the
-- client genuinely needs them — but only in two deliberate cases:
--
--   1. An accepted CHALLENGE. `challenges` keeps its OWN copy of `inputs`
--      (0003), and a challenge is an explicit invitation to replay that run,
--      so that path is untouched here.
--   2. "Duel a player's best run" (short_id `best:<username>`), the single
--      client read of runs.inputs in the whole app
--      (src/social/challenges.ts).
--
-- Neither needs blanket SELECT over the column. So: revoke the column, and
-- serve case 2 through a function that returns exactly one run for one named
-- player. Scores, leaderboards and profiles are unaffected — they never
-- selected `inputs`.
--
-- Re-runnable. Apply via the Supabase SQL Editor (paste + Run).

-- ---------------------------------------------------------------------------
-- 1. Column-level revoke.
--
-- RLS decides which ROWS a role may read; column privileges decide which
-- COLUMNS. `runs_select_all` stays as-is (scores must stay public for
-- leaderboards) — this narrows it to everything except the trace.
--
-- Supabase grants table-wide DML to anon/authenticated by default, so we
-- re-grant SELECT explicitly per column and leave `inputs` out. Keep this list
-- in sync when you add a column to `runs`.
-- ---------------------------------------------------------------------------
revoke select on public.runs from anon, authenticated;

grant select (
  id, user_id, seed, score, ticks, inputs_count, equipped_skin_id,
  mode, daily_date, created_at, inputs_hash,
  shape, body_r, body_g, body_b, accent_r, accent_g, accent_b
) on public.runs to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The one legitimate client read, scoped to a single run.
--
-- Returns the single best run for a named player, which is exactly what the
-- "duel their best" feature shows. SECURITY DEFINER so it can read the column
-- the caller can no longer select directly.
--
-- This intentionally still exposes ONE run's inputs per named player — that is
-- the product feature. What it stops is enumerating everybody's. A copied
-- replay is separately unusable: the canonical inputs hash is UNIQUE (0032),
-- so re-submitting someone's run is rejected as replay_theft.
-- ---------------------------------------------------------------------------
create or replace function public.best_run_ghost(p_username text)
returns table (
  seed             bigint,
  score            integer,
  inputs           jsonb,
  equipped_skin_id uuid,
  mode             run_mode,
  daily_date       date,
  equipped_shape   text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.seed,
         r.score,
         r.inputs,
         r.equipped_skin_id,
         r.mode,
         r.daily_date,
         p.equipped_shape
    from public.profiles p
    join public.runs r on r.user_id = p.user_id
   where p.username = lower(p_username)
     and r.score > 0
   order by r.score desc, r.created_at desc
   limit 1;
$$;

grant execute on function public.best_run_ghost(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. Verify. The first must FAIL (or return no `inputs`), the second must work.
--
--   -- as anon: bulk harvest, should be denied
--   curl -s "$SUPABASE_URL/rest/v1/runs?select=inputs&limit=1" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
--   -- expect: 42501 permission denied for column inputs / table runs
--
--   -- as anon: scores still readable (leaderboards must not break)
--   curl -s "$SUPABASE_URL/rest/v1/runs?select=score,mode&limit=1" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
-- ---------------------------------------------------------------------------

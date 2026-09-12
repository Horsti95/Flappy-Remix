-- 0038_challenge_inputs_privacy.sql
--
-- PRIVACY FIX, completing 0036.
--
-- 0036 revoked client SELECT on `runs.inputs` so the per-tick tap trace of
-- every player could no longer be bulk-harvested. It left the SAME data
-- readable on the other table that stores it:
--
--   challenges_select_short_id  on public.challenges  for select using (true)
--
-- `challenges.inputs` is a full copy of a run's input trace (0003), and that
-- policy is unconditional, so this still worked with only the anon key:
--
--   GET /rest/v1/challenges?select=creator_id,inputs
--
-- Leaving it made 0036 a half-measure: the column was closed on one table and
-- open on the other.
--
-- Unlike 0036 this needs NO replacement RPC. Verified against the codebase:
-- the client never reads `challenges.inputs`. Its only reads of this table are
-- `select creator_score, responder_score` (src/social/friends.ts), and the
-- inputs a ghost needs are delivered over HTTP by api/challenge.ts, which uses
-- the service-role key and is unaffected by client column privileges. The
-- inbox RPCs (inbox_incoming / inbox_outgoing) are SECURITY DEFINER and
-- likewise unaffected.
--
-- So the whole fix is: take the column away from client roles. The unconditional
-- row policy stays — a challenge must remain openable by anyone holding the
-- link, which is the product.
--
-- Re-runnable. Apply via the Supabase SQL Editor (paste + Run).

revoke select on public.challenges from anon, authenticated;

-- Re-grant every column EXCEPT `inputs`. Keep this list in sync when you add a
-- column to `challenges`; a forgotten column shows up as a client read failing,
-- not as a silent leak, which is the safe direction.
grant select (
  id, short_id, creator_id, source_run_id, seed, creator_score,
  parent_id, depth, responder_id, responder_score, responder_run_id,
  responded_at, expires_at, created_at, target_user_id, status, seen_at,
  creator_shape, creator_theme, daily_date
) on public.challenges to anon, authenticated;

-- The server reads and writes everything, including `inputs`.
grant all on public.challenges to service_role;

-- ---------------------------------------------------------------------------
-- Verify. The first must FAIL, the second must work.
--
--   curl -s "$SUPABASE_URL/rest/v1/challenges?select=inputs&limit=1" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
--   -- expect: 42501 permission denied for ... challenges
--
--   curl -s "$SUPABASE_URL/rest/v1/challenges?select=short_id,creator_score&limit=1" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
--   -- expect: rows
--
-- And the product path, which goes through the server, must still work:
--   GET /api/challenge?id=<short_id>   -> includes `inputs`
-- ---------------------------------------------------------------------------

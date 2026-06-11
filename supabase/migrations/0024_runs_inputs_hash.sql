-- 0024_runs_inputs_hash.sql
--
-- Anti replay-theft: run inputs are necessarily public (ghost duels replay
-- them), so the protection is server-side — /api/submit-run hashes the
-- canonical (seed, inputs-up-to-death) of every accepted run and rejects a
-- submission whose hash already exists for ANY user:
--   * a thief pasting the #1 player's seed+inputs is rejected, and
--   * the same player re-submitting an already-accepted run (offline-queue
--     retry) is answered idempotently instead of double-counting.
-- Old rows have a NULL hash and are not retro-protected (acceptable for the
-- playtest population; a backfill would need the exact same JS-side
-- canonicalisation, so it is intentionally not done in SQL).

alter table public.runs add column if not exists inputs_hash text;

create index if not exists runs_inputs_hash_idx
  on public.runs (inputs_hash)
  where inputs_hash is not null;

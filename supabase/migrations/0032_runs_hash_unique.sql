-- 0032_runs_hash_unique.sql
--
-- INTEGRITY FIX. 0024 created a NON-unique index on runs.inputs_hash and left
-- duplicate detection to an application-level read-then-insert in
-- api/submit-run.ts:
--
--     select user_id from runs where inputs_hash = $1 limit 1   -- check
--     insert into runs (...)                                    -- act
--
-- Two requests interleaving between the check and the insert both see "no
-- match" and both insert. That is the whole anti-replay-theft mechanism, and
-- it fails exactly when it matters: an attacker firing the same stolen replay
-- N times in parallel gets several of them accepted. The same race
-- double-counts a legitimate player's offline-queue retry.
--
-- The fix is a UNIQUE index, so the database is the arbiter and the loser of
-- the race gets a constraint violation instead of a second row. The API keeps
-- its pre-check (it produces the nicer replay_theft / duplicate_run reasons)
-- but no longer depends on it for correctness.
--
-- Old rows have a NULL hash and are not retro-protected (0024's note still
-- applies); the partial predicate keeps them out of the constraint.

-- ---------------------------------------------------------------------------
-- 1. Report existing duplicates. A unique index cannot be built over them, so
--    this must come back empty before step 3 will succeed. If it does not, the
--    rows are either genuine theft that got through or offline-queue
--    double-submits — inspect them, then run step 2.
-- ---------------------------------------------------------------------------
do $$
declare
  dupes int;
begin
  select count(*) into dupes from (
    select inputs_hash
    from public.runs
    where inputs_hash is not null
    group by inputs_hash
    having count(*) > 1
  ) d;
  if dupes > 0 then
    raise warning
      'runs.inputs_hash has % duplicated hash value(s) - step 2 below will keep the earliest run of each and NULL the rest',
      dupes;
  else
    raise notice 'runs.inputs_hash: no duplicates, safe to add the unique index';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. De-duplicate, conservatively: keep the EARLIEST run for each hash (the
--    original submission) and blank the hash on the later copies. We null the
--    column rather than delete the rows so nobody's score silently disappears
--    from a leaderboard — the duplicates simply stop being hash-protected,
--    exactly like pre-0024 history.
-- ---------------------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by inputs_hash
           order by created_at asc, id asc
         ) as rn
  from public.runs
  where inputs_hash is not null
)
update public.runs r
   set inputs_hash = null
  from ranked
 where ranked.id = r.id
   and ranked.rn > 1;

-- ---------------------------------------------------------------------------
-- 3. Replace the non-unique index with a unique one.
-- ---------------------------------------------------------------------------
drop index if exists public.runs_inputs_hash_idx;

create unique index if not exists runs_inputs_hash_key
  on public.runs (inputs_hash)
  where inputs_hash is not null;

-- ---------------------------------------------------------------------------
-- 4. Verify: must return 0.
--
--   select count(*) from (
--     select inputs_hash from public.runs
--     where inputs_hash is not null
--     group by inputs_hash having count(*) > 1) d;
-- ---------------------------------------------------------------------------

# TODO

## #4 — Ranked ghost (replay the opponent's round)

**Goal:** after both players finish a ranked round, let each player race the
other's recorded run as a ghost (like challenges already do), so ranked feels
head-to-head instead of two blind solo runs.

**Why it's not built yet:** ranked rounds intentionally store only seeds +
scores, never the per-tick `inputs`. Exposing an opponent's inputs is what makes
the ghost possible — but it's also a cheating vector if exposed too early (a
player could study the opponent's line before taking their own turn).

**Plan when we pick it up:**
1. **Schema:** add a per-round inputs store to `ranked_matches`
   (e.g. `a_run_inputs jsonb[]`, `b_run_inputs jsonb[]`), written by
   `api/submit-run.ts` alongside `a_scores` / `b_scores`.
2. **API:** new endpoint (or extend `api/ranked-match.ts`) that returns the
   opponent's inputs for a round **only after the requester has already
   submitted their own score for that round** — never before. Validate
   ownership + round state server-side.
3. **Client:** in `ranked.ts` / `main.ts`, once a round is locked, offer
   "race their round" that builds a `GhostSim` from the fetched inputs (reuse
   the challenge ghost path) and plays it back.
4. **Anti-cheat:** keep the reveal gated on "your score for this round exists";
   re-validate the opponent inputs by replay before trusting the ghost.

Tracked from the round-4 idea list as "#4 ranked ghost".

## #10 — Gallery restructure

Scope to be confirmed with the owner before building (the original idea text
wasn't fully recoverable). The gallery is currently a 3-group accordion
(Player / World / Goals) with sub-tabs; the main historical pain ("loads and
loads") was slow Supabase fetches, since addressed with local-first caching.

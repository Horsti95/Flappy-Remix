# TODO

## Parked — decided/started, picked up later (added 2026-06-09)

- **Onboarding misses deep-link arrivals.** The first-launch guided practice
  run only fires on the menu path (`!tutorialSeen()` in `main.ts`); the
  challenge / run / daily deep-link branches `return` before it, so friends who
  arrive via a shared link never get the intro. Plan: show a lightweight
  first-time "new here? try Practice" pointer (arrow at the Practice button) on
  the menu for anyone who hasn't seen the tutorial, regardless of entry path —
  so deep-link arrivals get pointed to practice after their first run. (Owner
  leaning toward replacing the auto guided run with this lighter pointer.)
- **Supporter badge → redeem-code grant.** The badge exists (badges-catalog.ts,
  `grantBadge`) and the redeem-code flow exists (`api/redeem-code.ts`); wire a
  code to also grant the "supporter" badge so the BMC Glider tier is
  end-to-end. Small server + client extension.
- **Seasonal-event rewards.** The new-year / pride / red-ribbon criteria in
  `unlock-criteria.ts` are date-gated. Needs date-latched stat flags (earned
  during the window, then kept) before they can grant real rewards.
- **Emailless "sync code".** Privacy-first cross-device option (generate a code
  on one device, enter on another to move/link the account) so progress can
  travel without collecting an email. Reuses the redeem-code pattern.
- **Art-dependent TBA rewards.** The fx-trail / background / shape planned
  rewards in `unlock-criteria.ts` need real particle/art work (the expensive
  tier) — deferred from the cosmetics variety pass.


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

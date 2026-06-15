# TODO

> See `ROADMAP.md` "Status snapshot — 2026-06-15" for phase-level status.
> This file is the granular backlog.

## ✅ Resolved (2026-06-15)

- ~~**Supporter badge → redeem-code grant.**~~ Shipped: `skin_codes.unlocks_badge`
  (migration 0028) → `api/redeem-code` returns it → client `grantBadge`.
- ~~**Emailless "sync code".**~~ Shipped as device link codes (migration 0029,
  `api/link-code.ts`, `auth.createLinkCode/redeemLinkCode`). ⚠ Untested against a
  live two-device Supabase session — verify before relying on it.
- ~~**Onboarding misses deep-link arrivals.**~~ Superseded: there's no auto tour
  now — the in-game coach pop-ups fire on the **first run of any mode**, so
  deep-link arrivals get them too.

## Parked — decided/started, picked up later

- **Seasonal-event rewards — finish the wiring.** Date-latched participation now
  exists (`game/events.ts`) and the World Cup package ships, but the
  `unlock-criteria.ts` seasonal entries (new-year / pride / red-ribbon) still
  aren't wired to grant real rewards off those flags. Fold them into the event
  framework.
- **Art-dependent TBA rewards.** The fx-trail / background / shape planned
  rewards in `unlock-criteria.ts` need real particle/art work (the expensive
  tier) — deferred from the cosmetics variety pass. Overlaps `feat/trails`.
- **Shape-variety goals (proposed).** Optional "fly shape X for N games → a
  globally-usable reward" goals, to reward sprite variety without per-sprite
  colour gating (owner reasoning 2026-06-15: keep colours global).
- **Full country packs.** The World Cup event reuses existing cosmetics; the
  richer per-nation packs (flag badge + per-country origami livery) are still
  open (Phase 1 `feat/country-packs`).

## Next up (recommended order)

1. `feat/trails` + `feat/gate-fx` — finish the per-run reward feel (Phase 2).
2. `feat/daily-aftermath` — the daily's 3rd attempt becomes a results screen
   with shareable emoji-row text (viral artifact).
3. `feat/country-packs` — richer World Cup event.
4. `feat/monetization-v1` groundwork — now unblocked (Phase 0 complete).
5. `feat/ghost-watch` — unblocked now that the leaderboard cosmetic snapshot
   ships.


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

# Prompt: start the Arcade Mode (new session)

Paste this to a fresh AI agent that has access to the `horsti95/flappy-remix`
repo. It defines a big, self-contained branch for an experimental mode.

---

You are working on **Glide**, a deterministic Flappy-style game (TypeScript +
Vite + Supabase). Your task: design and build a **brand-new "Arcade Mode"** on
a dedicated long-lived branch — do NOT touch the core game's determinism.

## Hard rules (read first)
1. The existing modes (casual / daily / ranked / challenge) rely on a
   **byte-deterministic sim** (`src/game/sim.ts`, fixed `DEFAULT_CONFIG`,
   seeded RNG) so replays validate server-side. **Arcade must NOT change or
   risk that.** Build Arcade as a *separate* sim/loop path (e.g.
   `src/game/arcade/`), or a clearly-gated variant — never edit the shared sim
   in a way that alters scored-mode behavior. Arcade is **non-deterministic,
   non-leaderboard, not server-validated** — purely for fun.
2. Work on branch `arcade/mode-v1`. Land it behind a flag / hidden entry until
   it's good — it's a WIP mode.
3. Keep the project green: `npx tsc -b --noEmit`, `npm run build`, and
   `npx vitest run` must all pass before every commit. Read files before
   editing; never leave half-applied edits.
4. Read `IDEAS.md` (top "MASTER BACKLOG") and `devlog/` for context first.

## What Arcade Mode is
A power-up-driven sandbox that makes runs feel varied and chaotic, the
opposite of the pure ranked loop. Start with a **work-in-progress** version
(one new screen + the mechanics scaffolding), then iterate.

### Mechanics to design in (phase them — don't do all at once)
- **Power-ups** (timed pickups that spawn in the world):
  shield (one free hit), slow-time, gravity flip, mini/giant size, coin
  magnet, second life, pipe-breaker, temporary rocket boost.
- **Collectibles**: coins in risky spots; a coin balance.
- **Obstacles beyond pipes**: rotating saws / moving hazards.
- **Scoring spice**: combo meter for near-misses ("perfect pass"), score
  multipliers for flying close to obstacles, bonus gates harder than normal.
- **Optional input variant**: tap-and-hold to fall slower (decide if Arcade-
  only).

### Suggested architecture
- New folder `src/game/arcade/` with its own `ArcadeSim` (can import shared
  helpers but owns its own step/collision so the core sim stays untouched).
- A power-up system: entities with spawn rules, pickup detection, active-effect
  timers, and render hooks.
- Reuse the renderer where possible; add arcade-only draw layers.
- A menu entry "Arcade (beta)" that's easy to hide.

### Deliverables for v1
- The branch builds + tests pass.
- A playable Arcade run with: coins, at least 2 power-ups (e.g. shield +
  slow-time), and one new obstacle (saw). Combo meter optional in v1.
- A short `devlog/` entry describing what shipped.
- A written plan (in the PR body) for phases 2+.

Ask the human for decisions only when a choice is genuinely theirs (e.g.
"should tap-hold be Arcade-only?"); otherwise pick sensible defaults and note
them. Open a PR but do NOT merge to main without approval.

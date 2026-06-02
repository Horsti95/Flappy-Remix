# #4 — Arcade Mode (beta)

*Vibe-coding a Flappy game, post 4 — the chaos branch.*

Every mode so far (casual / daily / ranked / challenge) shares one
**byte-deterministic** sim so replays validate server-side. That determinism
is sacred — it's what makes the leaderboard trustworthy. So Arcade Mode, which
is all about chaos and power-ups, was built as a **completely separate path**.
Nothing about it can perturb a scored run.

## What shipped in v1

A new, **non-deterministic, non-leaderboard, for-fun** sandbox living entirely
in `src/game/arcade/`:

- **`ArcadeSim`** — its own step + collision loop. Borrows the gap-spawn feel of
  the core sim but owns everything else, so the shared `Sim` is untouched.
- **`ArcadeLoop`** — a trimmed sibling of `GameLoop` (no replay recording).
- **`ArcadeRenderer`** — standalone draw layers for the arcade-only entities,
  reusing the shared sky/theme + shape drawing for a familiar look.

Mechanics in v1:

- **Coins** — spawn across the world (often in risky spots); a coin balance,
  and each pickup feeds the score (times the current multiplier).
- **Power-ups** — **shield** (absorbs one otherwise-fatal hit) and **slow-time**
  (the world crawls for a few seconds while the bird stays crisp).
- **Saws** — spinning, vertically-bobbing hazards that ride in with pipes.
- **Combo / multiplier** — threading a pipe gap edge counts as a *PERFECT pass*:
  combo climbs, multiplier rises (capped), bonus points. Taking a hit (even a
  shielded one) resets the combo.
- **Juice** — floating `+score` / `PERFECT` / `BLOCKED!` labels, a slow-time
  sky wash, a shield ring around the bird.

## Guardrails

- `DEFAULT_CONFIG` is never mutated — Arcade tunes its own `ARCADE_CONFIG`
  (a copy), and there's a test asserting the default is left alone.
- Arcade is gated on a single `arcadeLoop` handle being non-null; all the
  scored-mode plumbing is left exactly as it was.
- The entry is a small **"🎮 Arcade (beta)"** button on the menu. (Owner picked
  always-visible beta over a hidden flag.)
- `tsc -b`, `npm run build`, and `vitest` all green.

## Decisions

- **Tap-and-hold-to-glide**: deferred to phase 2 (keep v1 focused).
- **Entry point**: always-visible beta link (owner's call).

## Phases 2+ (planned)

- More power-ups: gravity flip, mini/giant size, coin magnet, second life,
  pipe-breaker, rocket boost.
- More hazards: moving/rotating gates, bonus gates harder than normal.
- Tap-and-hold-to-fall-slower (Arcade-only input variant).
- Coin economy: spend coins on in-run perks or cosmetics.
- A local-only Arcade high-score (never server-validated).
- Sound/haptics pass for pickups and combos.

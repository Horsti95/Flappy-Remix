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

Mechanics:

- **Coins** — trickle in along the flight path (around the gap centre, so
  they're reachable, with spread into riskier spots); a coin balance, and each
  pickup feeds the score (× the current multiplier).
- **Power-ups** (7) — **shield** (absorbs one fatal hit), **second-life**
  (revives once on death with brief invulnerability), **slow-time** (true
  bullet-time), **magnet** (pulls nearby coins in), **mini** (shrinks the
  hitbox), **gravity-flip** (inverts gravity + flap), **rocket** (timed climb).
- **Saws** — spinning, vertically-bobbing hazards that ride in with pipes.
- **Combo / multiplier** — threading a pipe gap edge counts as a *PERFECT pass*:
  combo climbs, multiplier rises (capped), bonus points. Taking a hit (even a
  saved one) resets the combo.
- **Juice** — floating labels (`+score` / `PERFECT` / `BLOCKED!` / `REVIVE!`),
  per-effect sky washes, magnet aura, shield/1-up ring, rocket flame, invuln
  blink, and a live effects HUD with countdowns.

## Smarter-model review pass (fixes folded into v1)

A second self-review caught three real bugs, all fixed + regression-tested:

1. **Difficulty ramped off `score`** — but Arcade inflates score with
   coins/combos, so speed exploded within seconds. Now keyed off a separate
   `pipesCleared` counter (distance), like the core game.
2. **Slow-time slowed the world but not the bird** — making it *harder*
   vertically, the opposite of the intent. Now it's true bullet-time: world
   *and* bird scale together (flap impulses still land instantly).
3. **Coins spawned uniformly across full height** — often buried unreachable
   inside pipe bodies. Now biased onto the flight path with spread.

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

- Remaining power-ups: giant size, pipe-breaker.
- More hazards: moving/rotating gates, lasers, bonus gates harder than normal.
- Tap-and-hold-to-fall-slower (Arcade-only input variant).
- Coin economy: spend coins on in-run perks or cosmetics.
- A local-only Arcade high-score (never server-validated).
- Sound/haptics pass for pickups and combos.

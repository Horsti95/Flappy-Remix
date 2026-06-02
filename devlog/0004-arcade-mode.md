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

## Phase 2 — world variety (shipped on this branch)

The same isolation rules hold; everything lives in `src/game/arcade/`.

- **Moving pillars** — a pillar's gap oscillates vertically as it scrolls
  (`bobAmp`/`bobPhase`, gap re-clamped to stay in-world each step).
- **Double-gate gates** — a dividing bar splits the gap into *two smaller
  gaps*; you pick one. Modelled generically: a pillar is now a list of solid
  segments (top / bottom / optional mid bar), shared by collision + render, so
  more multi-gap shapes are easy later. Threading next to *any* edge — including
  the bar — counts as a PERFECT pass.
- **Portals** — linked pairs (shared hue) that scroll in; fly into one and you
  warp vertically to its partner's mouth, with a short grace so you don't clip
  the exit.
- **3 more power-ups** — **ghost** (phase through pipes & saws), **giant**
  (bigger hitbox but you *smash* saws for points; mutually exclusive with mini),
  **2× score frenzy**.
- **Special events** — timed, periodic world states announced with a banner:
  **Coin Rush** (coins everywhere), **Low Gravity**, **Saw Storm**, **Portal
  Storm**. A small scheduler picks one every ~14–24s for an 8s window.

That's 10 power-ups, 4 pillar/hazard types (plain / moving / double-gate / saw),
portals, and 4 events. All seeded (reproducible in tests), all non-deterministic
at runtime, none of it server-validated.

## Phases 3+ (planned)

- Remaining power-ups: pipe-breaker, freeze.
- More hazards: lasers, rotating bars, homing drones.
- Tap-and-hold-to-fall-slower (Arcade-only input variant).
- Coin economy: spend coins on in-run perks or cosmetics.
- A local-only Arcade high-score (never server-validated).
- Sound/haptics pass for pickups, combos, and events.

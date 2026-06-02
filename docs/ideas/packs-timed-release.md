# Idea: content packs + timed "hidden until date" release

**Status:** 💡 Queued — wanted for the beta → launch transition
**Date:** 2026-06

## The pitch

Group related cosmetics into **packs** and release them on a schedule. The
content ships in the build but stays **hidden until a date**, so we can
drip-feed "drops" and create event moments without redeploying each time.

Example pack — **Germany**: football shape + pretzel shape + stadium theme +
stadium pillar + Germany skin, all flipping visible together on one date.

## Mechanism

- A small **pack registry**: `{ id, name, items: [...cosmetic ids], availableFrom: ISODate }`.
- Items belonging to a pack with a **future** `availableFrom` are hidden in the
  gallery (or shown as "🔒 coming soon — <date>"); they unlock automatically
  when `now >= availableFrom`. No redeploy needed.
- Their normal unlock conditions still apply *after* the release date (so a
  pack can drop AND still be earned, or be free-on-release).

## Caveats / decisions

- **Client-clock gating is spoofable** (change device time). Fine for
  cosmetics; if anything competitive is ever gated, enforce server-side.
- Decide per pack: on release, is it **free to all**, or does it just become
  *earnable* (unlock conditions apply)?
- "Coming soon" teasers build hype but also reveal upcoming content — optional
  per pack (`teaser: true|false`).

## Scope when picked up

1. `src/game/packs.ts` — the registry + `isReleased(packId)` / `packForItem(id)`.
2. Gallery: hide unreleased items, or render a locked "coming soon — <date>" card.
3. (Optional) a "new this week" badge when a pack has released in the last N days.

Purely client-side and cosmetic — no migration, no determinism impact.

# Idea: "Beat the dev" ghost — cosmetic reward (maybe later / as an event)

**Status:** 💡 Parked — good candidate for a future **timed event**
**Date:** 2026-06
**Relationship:** The safe, cosmetic alternative to
[`beat-the-dev-prize-money.md`](./beat-the-dev-prize-money.md) (declined).

## The pitch

Capture the "tournament" dopamine of beating the developer — **without money**.
The reward is a flex, not a payout.

- The dev publishes a **target run**: a fixed seed + the dev's recorded input
  stream (we already store these for replay/validation).
- Players race that **ghost** (the existing ghost-rendering path already
  supports flying against a recorded run).
- Beating the dev's score on that seed unlocks an **exclusive cosmetic**:
  a "beat-the-dev" badge, a special skin, or a one-off pillar/shape.

## Why this works where money doesn't

- **Determinism is a feature here, not a hole.** The same recorded-run plumbing
  that makes real-money payouts unsafe makes a *cosmetic* ghost race perfect:
  the dev's ghost is reproducible for everyone, and a faked unlock only ever
  yields a cosmetic — nothing worth cheating for.
- **Zero legal/financial surface.** No KYC, no tax, no gambling law. Just a
  badge.
- **Reuses what exists:** ghost sim + recorded inputs + the cosmetic/unlock
  system (shapes, skins, pillar styles, themes).

## Shape it as an EVENT (the "maybe later")

Rather than a permanent fixture, run it as a recurring limited-time event so the
cosmetic stays special:

- **"Beat the Dev Week"** — a fixed featured seed for ~7 days, dev ghost
  attached, exclusive badge for anyone who beats it in the window.
- Could rotate with **daily-seed** variants ("beat the dev on today's daily").
- Optional friends framing: "X friends beat the dev this week" on the menu.

## Rough scope when picked up

1. A way for the dev to mark a run as the *featured target* (seed + inputs +
   score threshold + event window).
2. Surface it in the menu: "🏁 Beat the Dev — ends in 3d", launching a run
   against the dev ghost on that seed.
3. Grant the exclusive cosmetic on success; persist the badge.
4. Event scheduling (start/end), so it appears and retires automatically.

Server-side validation is optional and *cheap* here precisely because the prize
is cosmetic — even a fully client-side honour-system version is acceptable for a
friends-and-family build.

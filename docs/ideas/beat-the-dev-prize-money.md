# Idea: "Beat the dev" with real prize money — DECLINED

**Status:** ❌ Declined (kept here as a record of the reasoning, not a backlog item)
**Date:** 2026-06
**Origin:** Brainstorm — "what if there's a real-money bonus for beating the dev's score?"

## The pitch

Put up a small real-money reward (or a revenue-share pot) for any player who
beats the developer's score on a given run / seed / season. A real stake on top
of the leaderboard, meant to drive the same dopamine as a tournament.

## Why we said no

1. **It's trivially farmable.** The whole game runs on a *byte-deterministic*
   sim — runs are recorded as input streams and replayed/validated. A fixed
   "beat score X" bar against deterministic physics is exactly the kind of
   target that gets reverse-engineered, tool-assisted, or replayed. Paying real
   money against a beatable-by-construction target is asking to be drained.

2. **Legal / regulatory drag.** Real payouts or revenue share pull in:
   - KYC / identity + age verification on winners,
   - tax reporting obligations,
   - prize-competition and (depending on jurisdiction) **gambling** law —
     "pay/play to win money" is a regulated activity in many regions.
   For a friends-and-family hobby game this is wildly disproportionate risk.

3. **Adversarial incentive flip.** The moment money is on the line, every
   anti-cheat weakness becomes a financial liability instead of a leaderboard
   asterisk. It turns a fun project into a fraud-surface to defend.

## What we'd do instead

See [`beat-the-dev-ghost.md`](./beat-the-dev-ghost.md): the same "beat the dev"
dopamine, delivered as a **cosmetic** reward (exclusive skin / badge / ghost
race) with zero money and zero legal exposure.

If real stakes are ever genuinely wanted, keep them **symbolic and manually
gifted** — e.g. "first friend to beat my daily-seed ghost this week gets a
coffee, hand-sent by me." No automated payout, no pot, no platform liability.

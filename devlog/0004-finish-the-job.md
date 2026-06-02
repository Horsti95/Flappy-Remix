# #4 — Finish the job (onboarding, clarity, lifetime goals)

*Vibe-coding a Flappy game, post 4.*

A focused "clear the backlog" stretch. One theme tied most of it together:
**make the first five minutes — and the next five hundred — clearer.**

- **Onboarding tutorial**: brand-new players now get a short, skippable
  how-to-play walkthrough — tap-to-fly, mind the gaps, score & streaks, the
  modes, and unlocks — ending in a **can't-die practice run** so the first
  taps carry zero stakes. Replayable any time from the menu.
- **Instant early rewards**: your 2nd and 3rd games each pop an unlock. The
  dopamine should land before the difficulty does.
- **Lifetime milestones**: a new cumulative-score stat tracks every point you
  ever score, with goals at 500 / 1k / 2k / 5k / 10k / 100k — something to
  chase even when a single run won't budge your best.
- **Goals, not quests**: folded the old "quests" tab into one **Goals**
  catalog. One place to look, less redundancy.
- **Gallery, decluttered**: seven scrolling tabs became three collapsible
  groups — Your plane / World / Progress — expand on tap, no more sideways
  scrolling.
- **Leaderboard, squared up**: three full-width filter rows (who · when · how),
  plus a new **ranked** filter.
- **Flap-effect colours**: tint your tap effect from a 16-colour palette.
- **Patch notes that don't expire**: read the whole history any time from
  Settings → What's new.
- **Bug fix**: the odd disc behind some legendary planes was the skin glow —
  it now only shows underwater, where it reads as a diver's light.
- **Retired friend codes**: friends are added by @handle now, so the legacy
  code (and its column) is gone.

Still vibe-coding: every one of these shipped as its own small, verified PR
(typecheck + build + tests green before merge). Next up: the Arcade mode where
we finally get to break the determinism rules on purpose.

# RESUME — historical snapshot (2026-06-13) — SUPERSEDED

> ⚠️ **This file is a point-in-time handoff note and is now stale.** It
> predates the v0.20/v0.21 releases: the Pflug→Glide rename it lists as open
> has shipped, trails/gate-FX/auras exist, and migrations now run past 0030.
> For current status see `ROADMAP.md` (canonical backlog + status snapshot).
> Kept for context only — do not work from this list.

Original intro: single source of truth for picking the project back up. Pairs
with `ROADMAP.md` (phase plan + event calendar) and
`devlog/0005-studio-review.md` (every locked decision + idea inventory).

---

## 1. Branches — what's live, what to keep

| Branch | Purpose | Keep? | State |
|---|---|---|---|
| `main` | production (Vercel) | ✅ | Behind: last merge (PR #122) predates v0.19.0. **Re-merge `claude/trusting-rubin-1jevio` to ship the new work.** Has the uploaded sprite PNGs + ideas doc. |
| `claude/trusting-rubin-1jevio` | **the main work branch** — all systems/gameplay/content since the review | ✅ | Green (213 tests, build ok). Pushed. The merge source. |
| `claude/paper-menu-experiment` | UI/redesign lab — paper-note buttons, daily weather report, "Hangar" rename | ✅ | Green. Synced with trusting-rubin. Judge its preview; cherry-pick keepers. |
| `claude/font-caveat` | **Caveat** (SIL OFL) handwritten font applied **app-wide** on the paper UI | ✅ | Compare its preview vs font-patrick-hand; merge the winner. |
| `claude/font-patrick-hand` | **Patrick Hand** (SIL OFL) handwritten font app-wide on the paper UI | ✅ | Sibling comparison branch. |
| `claude/font-embolism` | Embolism Spark `.ttf` | ⚠ DO NOT MERGE | Superseded — author restricts free use to non-commercial. Kept only for reference. |
| `arcade/mode-v1` | parked arcade-mode experiment | ✅ | Long-lived, untouched. |
| `origin/claude/a*`, `origin/feat/*`, `origin/fix/*` (~30) | already-merged historical feature branches | ❌ | Safe to delete on GitHub (all merged long ago). Cleanup only — no code lives only there. |

**To ship to playtesters:** open a PR from `claude/trusting-rubin-1jevio`
→ `main` and merge. The v0.19.0 "what's new" modal then fires once per
player.

## 2. Before the next run — env / DB checklist

- **Supabase migrations**: apply through **0026** in order if not already
  (0026 = `profiles.xp`). 0022–0025 were applied earlier per your note.
- **Vercel env** (optional, when ready):
  - `GITHUB_FEEDBACK_TOKEN` (fine-grained PAT, issues:write) +
    `GITHUB_FEEDBACK_REPO=Horsti95/Flappy-Remix` → turns on in-app feedback.
    ⚠ The token you pasted in chat earlier should be **revoked + reissued**.
  - `glide.uno` → add as a domain in Vercel project settings (Phase 1).

## 3. Open tasks by phase (status)

**Phase 0 — trust/security/feel — ✅ DONE** (RLS lockdown, replay-theft
dedupe, ranked repair, share-link fix, crumple death, haptic timing,
difficulty cap).

**Phase 1 — World Cup window (~2 wks):**
- ⬜ Rename→Glide everywhere + wire `glide.uno` (storage-key migration shim).
- ⬜ Country packs: origami national animals (art via prep script + prompts).
- ⬜ Leaderboard cosmetic snapshot (shape+colors+mode as flown) — migration;
  also unblocks the leaderboard-row redesign.
- ✅ Gate-pitch setting (shipped, score-50 unlock).
- ⬜ Onboarding v2 (show-don't-tell; ≤5 words/card, interactive steps).

**Phase 2 — reward layer:**
- ✅ Pilot XP + death-screen beat; ✅ server XP + level-5 skin mints;
  ✅ PB-ghost "race your best" (score-30); ✅ auras (prestige glow class).
- ⬜ Mint-choice (pick 1 of 3 liveries; also where level tokens spend).
- ⬜ Trails (persistent ribbon class — biggest visible flex).
- ⬜ Gate-pass FX (spark/paper-burst/firework every 10th gate).
- ⬜ Full unlock-remap: merge rarity+tier into one earned-meaning ladder;
  merge gallery "owned" vs "palettes"; fill any remaining score-40→100 gap.
- ⬜ Ascent mastery (unlock theme at 100, each stage individually at-stage).

**Phase 3 — retention/ritual:**
- ⬜ Streak UI + weekly freeze (**fix attempts-vs-days counting first**).
- ⬜ Daily aftermath = results screen + emoji share text + tomorrow teaser.
- ⬜ Push notifications (new-daily ~10:00 local; streak-at-risk 3h pre-reset).
- ⬜ Champions pyramid (daily crown → weekly Paper Crown → monthly hidden
  mythic = sum of daily bests). Daily-champion mint already shipped.
- ⬜ Ghost watch ("watch/challenge" any player's PB with their cosmetics).

**Phase 4 — identity/revenue:**
- ⬜ Paper-Sky full art pass (replace canvas shapes incl. fable with prepped
  origami sprites — see SPRITE-PIPELINE.md); crumple already done.
- ⬜ Evolving plane (stickers/decals accumulate; full detail on profile plane).
- ⬜ Monetization v1 (cosmetic packs + Founder pack via Stripe link →
  existing grant infra; **ETHICS.md amend first; hard-blocked by Phase-0,
  which is done**). NOTE the font licence (§5) gates commercial too.
- ⬜ Seasons (free 8-week track); arcade mode.

## 4. Page-rework audit (worst→best)

1. **Main menu** — paper-button experiment on UI branch (you liked it).
2. **Daily landing** — weather-report rework on UI branch (story lines;
   font pending the `.ttf`).
3. **Gallery loadout strip** — cramped; ⬜ redesign.
4. **Leaderboard rows** — ⬜ improves automatically with the cosmetic snapshot.
5. **Profile card** — ⬜ will carry level/badges/W-L once profile-xp migration
   exposes them.
6. **Inbox/friends** — ok for now.
7. **Death screen + account** — ✅ done.

Bigger structural idea (post-World-Cup, own branch): **flight-journal hub**
(one journal surface: Fly / Daily / Hangar / Journal / Social) instead of
ever more menu buttons. Don't ship a navigation rewrite near the event.

## 5. Loose threads / tech debt

- ⬜ Profile-level migration: expose `profiles.xp` via `public_profile()` so
  level shows on other players' profiles + leaderboard.
- ⬜ Backend latency: not the Supabase region (eu-west-2 is fine from DE) —
  it's free-tier pausing + multi-round-trip panels. Consider Pro; collapse
  leaderboard/ranked reads into single RPCs.
- ⬜ Celebration batching: cap to 2–3 unlock cards/run, "+N in gallery".
- ⬜ Transfer-code login for anonymous accounts (one-time, short-lived).
- ⬜ Two diverging shape renderers (canvas vs SVG) — unify in the art pass.
- ⬜ `fable` is a canvas placeholder; replace with a prepped origami fox sprite.

## 6. Font — decision pending (two OFL options to compare)

Embolism Spark was **dropped**: the author (Koplexs Studio) restricts free
use to non-commercial, which conflicts with monetization. Replaced with two
**SIL OFL (commercially safe)** handwritten fonts, each self-hosted +
precached and applied **app-wide** on the paper UI:

- `claude/font-caveat` — **Caveat**: tighter, more legible "marker" hand.
  Safer for number-dense screens (leaderboards/settings).
- `claude/font-patrick-hand` — **Patrick Hand**: rounder, friendlier,
  more "kid's notebook". More character, slightly less crisp at small sizes.

**Action on return:** open both previews, pick one, merge it. (Kalam and
Nothing You Could Do are also downloaded/available if neither fits.) The
work branch's `.font-hand` currently falls back to system cursive until a
choice is merged. Licence files: `design/fonts/`.

**Why the font didn't show before:** the `.ttf` was on `font-embolism`
while you previewed a different branch → the CSS fell back to system
cursive your device didn't have. The OFL branches fix this by shipping the
binary + CSS together on the same branch.

## 7. Uploaded sprites — usable, single-tint (see SPRITE-PIPELINE.md)

Proven: `scripts/prep-sprite.mjs` turns the colored origami PNGs into clean
grayscale-transparent 256² sprites that tint beautifully — but **single
colour** (body); accent is ignored by the sprite tint today. True
two-colour needs a keyed-accent pipeline upgrade (optional, later). Next
generations: prompt for grayscale, not colour.

## 8. Ideas captured elsewhere (don't re-derive)

- `ROADMAP.md` — phases + **event-package calendar** (World Cup, Pride,
  Christmas, New Year, birthday month, summer, Halloween, Oktoberfest=pretzel,
  lunar NY, Easter, April Fools, sakura) with "build dark, flip live".
- `devlog/0005-studio-review.md` — every locked decision + the signature-
  feature shortlist (evolving plane, gauntlet crowns, mint choice,
  replays-at-day-close).
- `design/prompts-paper-sky.md` — AI art prompts (use grayscale variant).
- `IDEAS.md` — older backlog (superseded by ROADMAP where they overlap).

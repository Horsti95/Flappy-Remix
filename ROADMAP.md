# Glide — Implementation Roadmap

> Sequencing doc. `IDEAS.md` stays the idea **inbox**; this file is the
> **order of execution**. Updated 2026-06-10 after the full studio review.
>
> Working agreement: every item ships on its **own branch** with its own
> Vercel preview deploy, small verified PRs (typecheck + build + tests
> green). Tiny fixes may be batched into one "fix-pack" branch per phase.
>
> ⚠ **Shared-DB caveat**: preview deploys point at the same Supabase
> project as prod. Branches containing **migrations** must be merged and
> `db push`-ed in order, one at a time — never run two migration branches
> in parallel.

---

## Phase 0 — Trust & breakage (before anything public or paid)

The game's brand is "a score you can trust"; these holes contradict it.
Nothing in later phases (champion rewards, paid cosmetics) is safe to
ship until Phase 0 lands.

| Branch | Scope | Size | Notes |
|---|---|---|---|
| `fix/security-profiles-rls` | Column-restrict `profiles` UPDATE policy; ownership check on `equipped_skin_id`; server-side username filter | `m` | Migration. Blocks: forged stats, self-minted milestone skins, equipping others' skins |
| `fix/security-replay-theft` | Stop exposing `runs.inputs` publicly; inputs visible only after the daily closes ("replays unlock at day close" — doubles as a feature); bind submissions to submitter | `m` | Migration + api. Closes copy-the-#1-run cheat |
| `fix/ranked-repair` | Run-insert *after* ranked validation; optimistic-lock match settlement; fix `elo_ratings` PK before season 2; match expiry (48 h auto-forfeit, unblocks queue); auth + consent + dedupe on `/api/ranked-challenge`; W/L/D actually written; ranked.ts winner-line render bug | `l` | Migration. One branch — the pieces interlock |
| `fix/share-links` | SW `navigateFallbackDenylist` for `/run/`, `/api/`; challenge carries sim config so daily-twist ghosts replay correctly ("share button loads nothing" bug) | `s` | Restores the viral loop |
| `fix/run-routing-pack` | Daily-without-`dailyInfo` random-seed bug; `R`-key bypass of ranked/daily safeguards; daily deep-link race; offline queue dropping contextual ranked rejects | `m` | Fix-pack, no migration |
| `fix/feel-pack` | Haptic fired at input capture (rumble lag); particle timing → wall-clock dt; speed-ramp cap (prevents eventual collision tunneling — must land **before** anyone approaches it; determinism forbids fixing later); mirror-day HUD un-mirrored; stop loop after death | `s` | No migration |

## Phase 1 — World Cup window (target: ~2 weeks)

Goal: event-ready, identity settled. Scope-cut aggressively; the event
needs packages + a window, not a full season system.

| Branch | Scope | Size | Notes |
|---|---|---|---|
| `feat/rename-glide` | Name → **Glide** everywhere (manifest, storage key prefix w/ migration shim, OG cards, README); wire `glide.uno`; tagline on daily screen: "Everyone flies the same wind today" | `s`–`m` | Do first; everything brands against it |
| `feat/country-packs` | Country packages: origami-animal shape + 2-color national livery + flag profile badge, unlockable in event window (A13 model, national-day ± window → World-Cup window for launch). Start: DE, BR, FR, ES, EN, AR, JP, US | `l` | Sprites via paper-fold pipeline (see appendix). Uses existing grants/codes infra |
| `feat/leaderboard-snapshot` | Runs snapshot **shape + skin colors + mode** at submit time; leaderboard rows render them | `m` | Migration. Also prereq for ghost-watch (Phase 3) |
| `feat/gate-sound-pitch` | Unlockable setting: gate pitch follows gap height (default stays uniform) | `xs` | Settings toggle, unlock at score 50 |
| `feat/feedback-github` | `/api/feedback` → GitHub issue (fine-grained token); form modal; server-granted reviewer badge on first accepted submission | `s` | Replaces mailto + honor-system achievement |
| `feat/onboarding-v2` | Show-don't-tell rewrite: ≤5 words per card, icons, interactive micro-steps, persistent PRACTICE watermark, always-visible skip, "that was practice — ready?" end card | `m` | Fixes both "too much text" (kids) and "don't get it" (parents) |

## Phase 2 — The reward layer (fixes "nothing happens per run")

| Branch | Scope | Size | Notes |
|---|---|---|---|
| `feat/death-screen-v2` | PB delta ("2 away from your best"), instant retry, XP bar tick, single next-unlock line ("next: ocean theme — 3 more games") | `m` | The highest-leverage screen in the game |
| `feat/pilot-xp` | Account XP + levels (design in appendix): XP ≈ score + flat activity bonuses, NOT per-gate exponential; level ring on profile; level rewards incl. livery-choice tokens | `l` | Migration (xp on profile). Death-screen bar depends on this |
| `feat/pb-ghost` | Personal-best ghost in casual — **earned at score 30** ("you can now race your own ghost", settings toggle) | `s` | Ghost tech exists; unlock framing avoids new-player confusion |
| `feat/mint-choice` | Milestone mints become **pick 1 of 3** generated liveries (others gone forever), generative names, reveal moment | `m` | Server generates 3 candidates; existing rarity math as quality floor |
| `feat/trails` | New cosmetic class: persistent trails (~10 designs, appendix); most visible flex in ghosts/duels | `m` | Render-layer only, determinism-safe |
| `feat/gate-fx` | Gate-pass FX class: spark, paper-burst, confetti, drag-race firework on every 10th gate | `s` | Pairs with unlock remap |
| `feat/unlock-remap` | Fill the score-40→100 desert + reduce color-drip: remap catalog onto new classes (trails, gate FX, stickers), new criteria types (precision, time-of-day, daily-tier clears), merge rarity+tier into one earned-meaning ladder | `l` | Pure client/data, big design diff — own review |
| `feat/ascent-mastery` | Ascent unlocks at score 100; each of its 9 stage backdrops becomes individually equippable when you *reach that stage* on ascent; same "world mastery" pattern later for ocean/space zones | `s` | |

## Phase 3 — Retention & ritual

| Branch | Scope | Size | Notes |
|---|---|---|---|
| `feat/streaks-v2` | Visible streak flame, **fix attempts-vs-days counting bug**, 1 streak-freeze earned/week | `m` | Don't make streaks load-bearing before the bug fix |
| `feat/daily-aftermath` | After 3rd attempt the daily landing **becomes** the results screen (no new menu button): percentile, friends, emoji-row share text (`Glide daily #142 · 🌪 hard · 31/47/52 · top 9%`), tomorrow's tier teaser | `m` | Text share grammar is the viral artifact |
| `feat/push-notifications` | Web push (VAPID): (1) "new daily" at local ~10:00 default, configurable; (2) "streak at risk" 3 h before UTC reset only if streak ≥3 and unplayed. Max 1–2/day; permission asked only after 2nd completed daily | `l` | Needs push endpoint + subscription table (migration) |
| `feat/champions` | Day-close cron: daily top-N minted livery grant; **weekly Paper Crown** badge (held, defended weekly, removed if not re-earned; permanent "crowned week N" memento sticker); monthly ladder = **sum of daily bests**, top 10 get hidden mythic-with-provenance gift | `l` | Migration + cron. Depends on Phase 0 security |
| `feat/hidden-unlocks` | Easter-egg class (no breadcrumbs): score 6 then 7 in consecutive runs → "Six-Seven!" sticker; score exactly 67; 404 lifetime → glitch trail; 42; 1337 lifetime | `s` | Share-bait for the young audience |
| `feat/ghost-watch` | "Watch / Challenge" a player's PB from profile & leaderboard, replayed with their full cosmetic snapshot (needs Phase 1 snapshot) + weather | `m` | Inputs-visibility rules from Phase 0 apply |

## Phase 4 — Identity & revenue

| Branch | Scope | Size | Notes |
|---|---|---|---|
| `feat/paper-sky-art` | Crumple-and-flutter death animation; paper/journal UI pass (buttons, handwritten accents); sprite restyle to folded-paper grayscale-tintable set; novelty shapes (pretzel, soccer-ball, submarine, ghost) reclassified into a labeled "Contraband" category; background readability pass (flight-corridor clutter rule) | `xl` | The big visual identity branch; appendix has the AI sprite prompt template |
| `feat/evolving-plane` | Signature system: equipped plane accumulates decals/stickers from milestones; **full detail on the large profile/gallery plane**, only big-milestone cues in flight (foil edge, glow) — solves the small-sprite problem | `l` | Migration (sticker inventory) |
| `feat/monetization-v1` | Amend ETHICS.md first. Cosmetic-only: country/event packs + Founder pack via Stripe payment link on web (entitlement through existing redeem/grant infra); platform IAP later if app-store packaged. No pay-to-win, everything-significant earnable | `l` | **Hard-blocked by Phase 0 security** (no paid cosmetics while clients can self-grant). Banner joke stays until public launch, then env-gated off |
| `feat/seasons-v1` | 8-week free cosmetic track fed by daily/weekly goals; first season themed = event reuse (World Cup learnings) | `xl` | |
| `arcade/mode-v1` | Existing arcade plan — long-lived separate branch, feeds pilot XP when it lands | `xl` | Deliberately **after** the reward layer |

## Shipped 2026-06-10 (session batch 1, on `claude/trusting-rubin-1jevio`)

- ✅ 13 secret achievements (undocumented by design) + 6 plumbing-pending
  draft criteria (elo upsets, precision, extreme daily, perfect week…)
- ✅ `/api/feedback` → GitHub issue + in-app textarea form (owner wires
  `GITHUB_FEEDBACK_TOKEN` + `GITHUB_FEEDBACK_REPO`; falls back to the
  external link until then)
- ✅ Daily champion skins: lazy day-close mint for yesterday's top 3
- ✅ Flap haptic fired before sim/audio work (rumble-lag fix)
- ✅ Particle tick on wall-clock dt (120 Hz fix)
- ✅ Paper-crumple death animation (crumple → flutter → dust puff)
- ✅ Paper Sky v1: chip buttons + grain, daily tagline, shape categories
  + "Contraband" gallery grouping
- ✅ Docs: devlog/0005 decisions, design/prompts-paper-sky.md

## Shipped 2026-06-10 (session batch 2 — Phase-0 trust fixes)

- ✅ SW `navigateFallbackDenylist`: installed PWAs no longer swallow
  `/run/:id` share links ("share loaded nothing" bug)
- ✅ Challenge twist physics end-to-end: `challenges.daily_date`
  (**migration 0022 — apply in Supabase**), ghost + responder + server
  validator all replay daily-twist challenges under the right config
- ✅ submit-run auths BEFORE running the replay simulation
- ✅ Daily-without-seed fallback now starts an honest casual run (never a
  mislabelled "daily"), both from the landing shortcut and inside startRun
- ✅ `R`-key restart mirrors play-again routing (no ranked re-submit, no
  daily-cap bypass)
- ✅ Ranked match list actually shows "you won / you lost"

Still open in Phase 0 (needs a focused pass + sequential DB migrations):
`fix/security-profiles-rls`, `fix/security-replay-theft`,
`fix/ranked-repair`, speed-ramp cap (client+server sim together).

## Shipped 2026-06-10 (session batch 3 — security & ranked repair)

- ✅ `fix/security-profiles-rls` → **migration 0023**: clients can only
  update username / equipped_skin_id / equipped_shape; skin-ownership +
  username-permanence trigger; progression counters server-only
- ✅ `fix/security-replay-theft` → **migration 0024** + submit-run:
  inputs-hash dedupe (cross-account = replay_theft, same-account =
  idempotent duplicate), inputs-after-death rejected
- ✅ `fix/ranked-repair` → **migration 0025** + api: seasonal Elo PK
  (season rolls won't abort), optimistic-locked settlement (no lost
  rounds / double Elo), W/L/D actually recorded, ranked leaderboard
  bypass closed (validate before insert, orphans deleted), lazy match
  expiry in queue/challenge/submit, ranked-challenge needs accepted
  friendship + one live match per pair

⚠ **Apply migrations 0022 → 0023 → 0024 → 0025 in order** in the
Supabase SQL editor. Remaining Phase-0 item: speed-ramp cap (client +
server sim together, own pass).

## Shipped 2026-06-10 (session batch 4 — reward layer + Phase 0 complete)

- ✅ `feat/pilot-xp` + `feat/death-screen-v2`: flat XP economy
  (`src/game/xp.ts`, curve 100×1.12^level, gate milestones 50/100/250),
  death screen now shows PB delta ("2 away from your best"), animated XP
  bar + LEVEL UP, and a next-unlock breadcrumb (`src/game/next-unlock.ts`,
  stat-probing — no per-item criterion metadata needed). Level shown on
  the account panel. Practice runs grant nothing.
- ✅ Speed-ramp cap at difficulty level 20 (score 400) — locked into the
  replay contract (`maxDifficultyLevel` in config.ts), pinned by
  tests/difficulty-cap.test.ts. **Phase 0 is now fully shipped.**

Next up (Phase 2 continuation): `feat/pb-ghost` (earned at score 30),
`feat/mint-choice`, `feat/trails`, `feat/gate-fx`, `feat/unlock-remap`,
`feat/ascent-mastery`. Level-up *rewards* (livery tokens etc.) deferred
to `feat/mint-choice` so tokens have something to spend on.

## Shipped 2026-06-11 (session batch 5 — playtester-feedback round)

- ✅ Crumple-anchor bug: startRun now stops the leaked previous loop (the
  stale dead sim was hijacking the animation anchor); rendering also stops
  2.5 s after death (battery)
- ✅ Server-authoritative XP (**migration 0026 — apply!**): profiles.xp
  mirrors the client formula; **a color skin is minted every 5 account
  levels**; client adopts the server total
- ✅ Goals grant real rewards: 9 scratchpad criteria promoted to
  achievements with color skins; 5 new criterion types (comeback, 25-runs
  -a-day, all four modes, 30+ with ≤40 flaps, weekend ritual); **+15 new
  secret achievements** (undocumented by design — 28 secrets total now)
- ✅ Death screen is a solid card with skin-coloured accent strip/score/XP
  bar; feedback form moved to Settings (shared ui/feedback-form.ts);
  account panel shortened
- ✅ Sounds: defaults ON for fresh installs; +2 tap (bubble, page flick),
  +2 gate (koto, pop choir), death sound now selectable (classic /
  crumple / whistle-down) with a gallery picker
- ✅ rocket + cyber-plane reclassified contraband → paper fleet

Open questions parked: menu redesign = flight-journal hub (post-World-Cup
branch); celebration batching when many unlocks pop at once; backend
latency (see devlog/0005 notes — region + roundtrips, not tier).

## Standing decisions
- **Name: Glide** (domain glide.uno). Art direction: **Paper Sky**.
- One branch per item, preview deploy per branch; `fix-pack` batching
  allowed for `xs`/`s` non-migration fixes.
- Migration branches: serialize. Never two in flight.
- Speed ramp stays capped (rhythm > chaos); difficulty variety comes from
  dailies/arcade, not faster base game.
- Daily stays 3 attempts; **no hard daily playtime lock** — scarcity via
  attempts, not lockouts.

---

## Appendix A — Pilot XP design (v1 proposal)

- **XP per run** = `score + 5` (finishing anything pays a little).
  Bonuses: daily attempt +25, new PB +50, goal/quest completions as
  listed. **No per-gate exponential scaling** — skill is already paid by
  the score ladders; levels measure time + dedication so weak players
  still progress every session.
- **Curve**: `next(level) = 100 × 1.12^(level−1)`, soft cap ~60.
  Level 2 lands inside session one.
- **Rewards**: every level something small; every 5 levels a
  livery-choice token; stickers at milestones; titles at 10/25/50.
- **Visibility**: bar tick on death screen; level ring on profile;
  optional small number on leaderboard rows.

## Appendix B — Trail set (v1)

paper streamer (15 games) · contrail (score 35) · petal drift (streak 5)
· ink stroke (precision: 10 dead-center gates) · confetti snips (3 duel
wins) · origami cranes (crane quest) · ember fold (hard daily 30+) ·
bubble stream (ocean trench) · star dust (space galaxy) · golden foil
(level 30) · glitch (secret, 404) · rainbow ribbon (June event).
Render: ring buffer of interpolated positions → fading polyline /
particle stamps, render-layer only (determinism-safe).

## Appendix C — Paper-fold sprite prompt template

> Flat vector game sprite of an origami {paper airplane | crane | eagle |
> macaw}, folded-paper style, visible crisp fold lines, subtle paper
> grain, **two-tone grayscale** (body #CCCCCC, accent #888888) for
> programmatic tinting, side view facing right, centered, no shadow,
> **transparent background**, clean edges, minimal, 512×512.

Grayscale is mandatory — the multiply-tint pipeline only recolors
cleanly on grayscale art (see IDEAS.md Q-block note). Country packs =
origami national animal + national-color tint preset + flag badge.

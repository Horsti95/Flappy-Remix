# Ideas — idea inventory (superseded by ROADMAP.md for status)

Sizes: `xs` < 1h, `s` < half day, `m` < day, `l` < week, `xl` more.

> **`ROADMAP.md` is the canonical backlog** — phases, status snapshot, and the
> event calendar live there. This file is the raw idea inventory that feeds it;
> statuses here (last updated 2026-06-01) may lag what actually shipped.
> Everything below the `--- HISTORY ---` divider is kept for context only.

## MASTER BACKLOG (updated 2026-06-01)

> **2026-06-10 — full studio review.** Decisions + idea inventory live in
> `devlog/0005-studio-review.md`; execution order in `ROADMAP.md` (new).
> Headlines: name **Glide** (fallback "Paper Sky" if the art lands),
> Paper Sky art direction, pilot XP, champions pyramid (daily crown /
> weekly Paper Crown / monthly hidden mythic), secret unlock class,
> mint-pick-1-of-3, monetization opens (cosmetic-only, ETHICS amend
> first, blocked by Phase-0 security), no DB reset (consolidation
> migrations instead), menu redesign = flight-journal hub (open design
> question). AI art prompts: `design/prompts-paper-sky.md`.

### A. Decided — ranked easy → hard  (A1–A9 SHIPPED 2026-06-01)
| # | Item | Size | Status / Notes |
|---|------|------|-------|
| A1 | Friend requests (accept/decline) | `m` | ✅ #70 — `status` column (migration 0014) + accept/decline RPCs + requests UI. |
| A2 | Surface the 26 placeholder criteria | `s` | ✅ #66 — goals list in the quests tab. |
| A3 | Patch-notes / "what's new" modal | `s` | ✅ #67 — version-based, once per update; bump `APP_VERSION` + prepend `CHANGELOG`. |
| A4 | Feedback button | `s` | ⬜ NEXT. Decide delivery: `mailto:` (exposes address) vs serverless email API (Resend/SendGrid, private). |
| A5 | Sprite glow FX | `s` | ✅ #69 — legendary skins glow; `RenderOptions.glow`. |
| A6 | Ranked-friend run UX | `s` | ✅ #68 — game-over routes to match ("round N/3 submitted"), not replay. |
| A7 | Player-pickable pillar style | `m` | ✅ #71 — solid/stone/neon/glass; glass see-through + harder-daily. |
| A8 | Daily intensity meter | `m` | ✅ #72 — per-modifier multipliers, compounding; bands easy→extreme + %. |
| A9 | Background image pipeline | `m`–`l` | ✅ #73 — `Theme.backgroundImage`; neo_city + fairy_spires themes. (Sprite half = #63.) |
| A10 | Vectorize uploaded toucan → recolorable layers | `s` | flat ref → body/accent so skin system tints cleanly. |
| A11 | Cosmetic packages (mix-and-match, Fortnite-style) | `m` | bundle {sprite+bg+pillar+sound}, independently mixable. Pipeline ready (A9). |
| A12 | 3-color premium skins (primary/secondary/tertiary) | `m` | base stays 2-color; premium/packages get optional 3rd slot. Do with A11. |
| A13 | Country / national-day packages | `m` | unlock on national day ±1 day (NOT GPS); country-color sprite + country-flag PROFILE BADGE. Germany first. |
| A14 | Event skins + badge-shapes | `m` | placeholders coded (pride/new-year/red-ribbon). Pipeline ready (A9). |
| A15 | City + beach background redesign | `l` | real art via A9. |
| A16 | Sound redesign / juice pass | `m` | post-dev; characterful synth/samples with final visuals. |
| A17 | Achievement/unlock DEEPER merge | `l` | make registry the single source presets/quests read (foundation #54). |

**Remaining A-block, recommended order:** A4 (feedback, quick) → A10 (vectorize toucan) → A11+A12 (packages + 3-color, together) → A13 (country packs) / A14 (events) → A15/A16 (redesign, post-dev) → A17 (deeper merge).

**Pending migration to apply:** 0014 (friend requests). 0009–0013 already applied.

### B. Ideas to reason / decide before building
- **A11/A12 — packages + 3-color skins (deferred, maybe special-only):**
  cosmetic bundles {sprite+bg+pillar+sound} + an optional 3rd color slot. The
  pipeline is ready (A9). LEANING (owner): do 3-color ONLY for new special
  skins, not the base pool. Build when we commit to the first package.
- **A13 — country / national-day packages (deferred):** unlock on a national
  day ±1 day (not GPS); country-color sprite + country-flag profile badge.
- **Feedback → GitHub issues (#10):** instead of mailto, a serverless
  `/api/feedback` that opens a GitHub Issue in the repo via the GitHub API
  (fine-grained token w/ issues:write as a Vercel secret). Feedback lands as
  triageable issues, not email. Small endpoint + a textarea modal replacing
  the mailto link. RECOMMENDED next feedback step. Needs: the token + decide
  public vs private repo (public repo issues are world-readable — fine, or
  use a separate private feedback repo).
- **Uploads contribution link (#5):** friends drop AI-generated art in
  `design/uploads/` (specs in its README) → we review + wire usable ones.
  For now: share the GitHub folder URL, or a Drive/Dropbox folder you link
  there. A true in-app uploader is the bigger "upload-your-own-sprite" item
  below.
- **Community skin gifting (#9):** give a skin to another player; it's then
  permanently locked for the giver. Feasible but needs: a transfer record,
  anti-abuse (rate limit, no gifting event/limited items?), and a "gifted by
  @x" provenance tag. Nice social hook; medium. Decide gift economy rules.
- **Upload-your-own sprite (#10):** users upload a custom sprite, synced to
  the DB so anyone can use it. BIG risks: (1) **moderation** — hate symbols
  (Hakenkreuz etc.), NSFW, slurs → MUST have human review/report+takedown
  before public sharing, or legal/store removal; (2) storage + cost; (3)
  perf (arbitrary image sizes). RECOMMENDATION: if ever done, gate behind
  approval queue + report system, start private-only (your own use), public
  sharing much later. High effort + ongoing moderation burden.
- **GPS regional unlocks:** REJECTED as a criterion (spoofable, permission
  friction, port dependency). The country-PACKAGE idea (A13) replaces it via
  national-day windows instead.
- **2- vs 3-color skins:** DECIDED — base 2-color, premium optional 3rd (A12).

### Q-block — answers to recent questions
- **#7 ranked-friend "ranked" naming:** (a) YES it affects Elo — it's a real
  ranked best-of-3 reusing the same match/Elo path. (b) The "infinite play
  again" is a UI bug only: the SERVER rejects a second submit for an
  already-played round (`round_already_played`), so it can't actually be
  farmed — but the game-over shouldn't offer plain "Play again". (c) FIX
  (A6): ranked game-over should read "Submit round 1/3" → then "round 2 of
  3", not "Play again".
- **Tinted skins on non-grayscale art (#11):** the multiply-tint only works
  cleanly on GRAYSCALE sprites (like the toucan). A pre-colored sprite would
  get muddy when multiplied. So: tintable sprites must be authored grayscale;
  already-colored art ships as fixed-color skins (no recolor). Noted for A10/A11.

--- HISTORY (superseded by the master backlog above) ---

## Session 2026-05-31 — decisions + idea inflow

Captured so nothing drifts. Decisions are locked; the build items are
sequenced into their own branches.

### Decisions locked this session
- **Achievement/unlock unification** — deep (incl. server skins),
  "achievement" stays the single unlock primitive. *(Not started.)*
- **Dead `minimalist` achievement** — now tracked (25+ under 80 taps,
  latches). **Shipped** (PR #32).
- **`challengeWins` tracking** — was never incremented; now synced from
  resolved duels. **Shipped** (PR #32).
- **Challenge share-link bug** — `?c=` carried friend_code, app reads it
  as challenge short_id → 404. Fixed. **Shipped** (branch
  `challenge-ranked-fixes-ph2`).
- **Ranked per-round reveal** — opponent's round score hidden until you
  take your own shot, then revealed (was hidden until match end).
  **Shipped** (branch `challenge-ranked-fixes-ph2`).
- **Leaderboard dedupe** — best-run-per-player per period (was every
  run). **Shipped** (PR #33, needs `db push`).
- **Challenge model** — casual duel: sender score hidden, BOTH players
  unlimited tries, receiver can give-up or win-and-brag. PLUS a
  friend-directed **ranked** best-of-3 (one shot/round, affects Elo).
  Random ranked stays as is.
- **Ranked margin bonus** — flat, capped (+1 / +2 / +3 for win-margin
  5 / 25 / 50), winner-only, added *after* Elo so the ladder math stays
  self-correcting.
- **Leaderboard 3-axis matrix** — scope {global, friends} × mode {all,
  casual, daily} × period {today, week, month, total}.
- **Public profiles** — build it. One `public_profile(username)` RPC
  (aggregates only, never raw runs/email). average = total / total_games.
  Opened from Friends + tappable leaderboard/duel names. + Badges tab.
- **Local-time ambient sky + alt-shape color variants** — skipped; keep
  the play-at-night/morning unlocks instead.
- **Monetisation** — non-tracking banner only (no ad SDK, kid-friendly
  audience), + Buy Me a Coffee tip button + cosmetic supporter chip.
  No pay-to-win, no pay-for-playtime. `ETHICS.md` to be amended *before*
  the code lands.
- **Quest-chains-in-Gallery** — prototype on a separate branch to
  compare against keeping the quests panel (avoid re-crowding the
  gallery).

### Build queue (each its own branch)
Status as of 2026-06-01 — most of the queue has shipped to `main`.
1. ✅ **Challenge overhaul** — sender cosmetics flex (#36), unlimited
   best-counts response (#38), game-over UX + Send/Brag/Give-up (#39).
2. ✅ **Daily best-of-3** — 3 attempts/day, best counts, server backstop
   (#43/#44).
3. ✅ **Public profiles** — `public_profile()` RPC + card from friends /
   leaderboard (#41/#42). Full **Badges tab** still TODO (profile shows
   the headline season badge only).
4. ✅ **Visual daily modifiers** — night / sunset / blinding sun / rain (#40).
5. ✅ **Monetisation foundation** — ETHICS amend + tip button + non-tracking
   banner slot (#35).
6. ✅ **Equipped-shape display** — persist shape; show it on leaderboard +
   profile (#45, migration 0012).
7. ✅ **Leaderboard 3-axis matrix** — mode axis {all, casual, daily}
   alongside scope × period (#49, migration 0013).
8. ✅ **Ranked margin bonus** — flat capped +1/+2/+3 for win-margin 5/25/50,
   winner-only, after Elo (#48).
9. ✅ **Full Badges tab** in the gallery (per-season list) (#50).
10. ⬜ **Quest-chains-in-Gallery cross-tab breadcrumbs** — LOW priority /
    experimental. Note: quests are ALREADY a gallery tab (`data-tab="quests"`),
    so the "separate quest panel" concern is resolved. Remaining idea is just
    cross-tab "next unlock →" breadcrumbs; keep as a standalone compare branch.
11. ⬜ **Friend-directed ranked challenge** — challenge a friend to a ranked
    best-of-3 (reuses ranked_matches/Elo). IN PROGRESS this session.
12. ⬜ **Achievement/unlock unification** — the big deep refactor. Deferred:
    touches the same gallery/achievements code as Badges + quest-in-gallery,
    needs its own focused pass.

**Pending migrations to apply (Supabase SQL Editor, in order):** 0013
(leaderboard mode axis). 0009–0012 already applied.


### New idea inflow (not yet scheduled)
- **Pipes letterboxing** (`xs`, bug) — world is fixed 360×640; when the
  canvas box isn't exactly 9:16 the world is letterboxed and pillars
  stop short of the screen edge (sky bands top/bottom). Fix: extend the
  pillar/ground fills past the world bounds, or cover-fit, or lock the
  stage to 9:16. Gameplay is correct; cosmetic only.
- **Sprite/art pipeline** (`m`–`l`) — the renderer draws everything with
  canvas primitives; there's no image/sprite loader, so AI-generated art
  (the `design/prompts.md` templates) is reference-only and can't drop
  in. To make a realistic art-style refresh possible we'd add a sprite +
  tiling layer (load PNGs for plane / tiling pillar / background, matched
  to the collision box `pipeWidth 56` / cap `14`). Prereq for any new
  art style.
- **Score counter glow-up** (`s`) — the per-run number counter is plain;
  punch it up (animated tick, scale-pop on increment). Probably bundle
  with a broader design refresh.
- **Social / flex**: shareable profile *card* image (badges + best +
  rank, not just score); head-to-head record on a friend's profile
  ("you 7–3 vs @lennart"); spectate/replay a friend's top run as a ghost.
- **Progression**: seasonal cosmetic track (ranked season grants an
  exclusive skin/shape, not just a badge); per-shape **mastery** (fly X
  games with the butterfly → a tinted variant); daily-login / streak
  cosmetic milestones (respect the no-nag ETHICS rule).
- **Modes** (place carefully — don't overcrowd the menu): endless **zen**
  mode (no death, no leaderboard, practice); weekly rotating modifier
  **playlist** (featured daily-twist combo); a weekly global **nightmare**
  seed for bragging.
- **Onboarding / clarity** (want to preview button placement on a
  branch/Vercel): first-run tutorial ghost showing the tap rhythm;
  in-game rules/help screen; first-time tooltips explaining ranked vs
  duel vs daily.
- **Feedback button** (`s`) — opens a small form that emails the input
  to the maintainer. Needs a delivery decision: `mailto:` (zero backend
  but exposes the address) vs a tiny serverless endpoint using an email
  API (Resend/SendGrid) so the address stays private.

### Design-phase decisions (2026-06-01) — deferred to a post-dev polish pass

- **Sound redesign (`m`, post-dev).** Current SFX are clean synthesized
  Web Audio tones — inoffensive but not characterful/cute. For positive
  emotion: hand-tuned multi-layer synth (pitch bends, smiling envelopes)
  or short recorded samples, designed *after* the visuals are final so
  audio + art share one personality. Dedicated "juice" milestone.
- **Background redesigns (`l`, post-dev).** City (fillRect skyline) and
  beach (gradient + horizon band) are functional, not beautiful. Best
  path = build the **sprite/art pipeline** first (image loader + tiling),
  which also unlocks the AI-art prompts, event skins, and nicer pillars.
  So "prettier backgrounds" really means "do the sprite pipeline, then
  art." Bigger than a quick fix.
- **Sprite glow FX (`s`, design-phase OK to prototype).** Soft radial /
  shadowBlur glow around the shape, tinted to the skin accent. Should be
  an *unlockable FX option* (like flap effects), respect reduced-motion,
  and ideally auto-apply to **legendary** skins so rarity is visible in
  motion. Hang it on the existing flap-FX system.
- **Daily hardness % (`m`, LATER — NOT the current additive rng).**
  Replace the label-only tier with a **multiplicative** intensity score:
  each modifier carries a hardness factor (e.g. tight gaps 1.3, rush
  1.25, heavy 1.15; friendly <1.0 like floaty 0.85); multiply them →
  e.g. 1.2×1.2 = 1.44 = "+44% intensity"; map the product to tiers
  (<1.0 easy … >1.7 super-hard) so the **tier is DERIVED** from the mods
  (today tier + mods are rolled independently). Display "today: 160%
  intensity" on the landing. Keep physics from the modifiers themselves
  — display/derivation only, stays deterministic.
  - **Workflow the owner wants:** Claude lists every modifier; the OWNER
    assigns each a hardness %; then we encode those weights. Do the
    list-and-assign step before coding.
- **GPS / regional unlocks — investigated, NOT building.** Geolocation
  as an unlock criterion is weak: permission friction, trivially
  spoofable (VPN/emulator), and adds a native-permission dependency for
  the iOS/Android port. If ever done, only as opt-in *local-only*
  regional flair, never a required criterion.
- **Selling geolocation data — rejected on business merit (ethics
  aside).** Brokers pay only at massive DAU scale (≈0 for a new game);
  Apple/Google **prohibit selling location data** → app rejection/removal
  (kills the port); GDPR/CCPA consent burden. High risk, ~zero yield,
  blocks mobile. Revenue stays: tips + cosmetics + non-tracking banner.
- **Event skins + badge-shapes (`m`).** Time-gated unlocks (Pride, New
  Year, World AIDS Day red ribbon) — available only in a date window,
  owned forever once earned; free + respectful (no grind, no paywall on
  a cause skin). A "purple badge" doubles as a flyable **shape** AND a
  **profile badge** (profile already renders shape + season badges).
  (The old `unlock-criteria.ts` placeholder criteria were retired in the
  debt cleanup — surviving drafts live in ROADMAP.md "Reward drafts".)
- **Richer unlock criteria catalog — superseded.** The placeholder-criteria
  scratchpad (#56) was retired in the debt cleanup; the still-unshipped
  drafts are preserved in ROADMAP.md "Reward drafts". Attach real
  skins/shapes/backgrounds/pillars/sounds/fx as they're designed.
- **Adjustable screen ratios — done the safe way (#57); the rest is a
  no.** Keep the fixed 360×640 world (it's what makes runs deterministic
  + replay-verifiable + port-safe). Only the *presentation* fills the
  screen: pillar-edge bleed + letterbox framing shipped. True
  gameplay-affecting variable aspect ratio is intentionally NOT built —
  it would break determinism/fairness.

### Next-iteration backlog (2026-06-01) — ranked easy → hard

The consolidated "what to build next" list. Most rows are unbuilt; the
ones marked SHIPPED are done and kept here for context.

| # | Item | Effort | Status / notes |
|---|------|--------|----------------|
| — | 8-bit bird preview ≠ playable skin | `xs` | **SHIPPED** (#61) — SVG regenerated from canvas bitmap |
| 1 | Surface planned-reward drafts in the gallery | `s` | superseded — the criteria scratchpad was retired; drafts live in ROADMAP.md "Reward drafts" |
| 2 | Feedback button | `s` | needs delivery decision: `mailto:` (exposes address) vs serverless email API (Resend/SendGrid, private) |
| 3 | Sprite glow FX | `s` | unlockable FX option; auto-apply to legendary skins; hang on flap-FX system; respect reduced-motion |
| 4 | **Player-pickable pillar style** | `m` | NEW equip axis `{pillarStyle}`: solid / glass / neon / stone. Player picks favorite (like shape/theme). Unlockable via the registry (`pillar` reward kind already reserved). |
| 4a | Glass pillars see-through always | — | part of #4: glass renders semi-transparent in ALL modes |
| 4b | Glass on the DAILY adds a difficulty level | — | glass = harder to read → counts as a hardness modifier on daily ONLY; cosmetic-only in casual/ranked; never changes hitboxes (determinism) |
| 5 | Daily hardness-% logic (multiplicative, tier derived) | `m` | OWNER assigns each modifier a hardness % first, THEN encode. Product maps to tier; show "today: 160% intensity". Display/derivation only — physics still from the modifiers. |
| 6 | **Sprite / background image pipeline** | `m`–`l` | THE gate. No `drawImage` loader exists today. Add: async image loader, `backgroundImage` draw path (under pillars, center lane kept clear), `spriteImage` path (bitmap at bird pos/rotation, sized to collision radius). Unlocks #7–#11 + the uploaded art in `design/uploads/`. |
| 7 | Vectorize the uploaded toucan → 2-color recolorable sprite | `s` (after #6) | flat JPG can't recolor; trace to body/accent layers so the skin system tints it |
| 8 | Cosmetic **packages** (Fortnite-style mix-and-match bundles) | `m` (after #6) | a package = {sprite + background + pillar + sound}, all independently mixable. Registry is the home. e.g. "realistic cyberpunk pack", "pink fairy pack". |
| 9 | Country packages + national-day unlocks | `m` (after #6/#8) | unlock on a national day ±1 day (NOT GPS). Recolor sprite to country colors + a country-flag PROFILE BADGE. Germany pack = first. |
| 10 | City + beach background redesign | `l` (after #6) | replace fillRect skyline / gradient with real art |
| 11 | Sound redesign / juice pass | `m` | post-dev; characterful/cute synth or samples, designed with final visuals |
| 12 | Event skins + badge-shapes | `m` | placeholders coded (`new_year_flight`, `pride_wings`, `red_ribbon`); needs #6 for art |
| 13 | Achievement/unlock DEEPER merge | `l` | make the registry the single source presets/quests read from (foundation shipped in #54) |

**Recommended order:** quick wins 1→2→3, then pillar system (4), then
commit to the image pipeline (6) since it gates the art direction
(7,8,9,10) and the uploaded references.

### Open design questions (owner to decide)

- **2- vs 3-color skins.** Today skins are `{body, accent}` (2 colors).
  Considering primary/secondary/tertiary (3 colors) for richer skins.
  Trade-off: 3 colors = more expressive but touches the skin type, the
  renderer's per-shape draw (each shape decides where accent goes), the
  procedural rarity math, and the share-card. Medium refactor; worth it
  for premium/package skins, maybe overkill for the base pool. LEANING:
  keep base skins 2-color, add an optional 3rd "tertiary" slot that only
  richer shapes/packages use. Decide before the package work (#8).
- **National-day reward shape:** country colors on the sprite AND/OR a
  country-flag profile badge — owner likes both; do both with #9.
- **Feedback delivery:** `mailto:` vs serverless (see #2).

## Next — concrete, deciding what to start

### Daily twist — pre-game warning + remaining modifiers (`s` to `m` each)

The daily twist core shipped in `src/game/daily-twist.ts`: tier
picker (1/3/2/1 weighting for easy/medium/hard/super-hard), modifier
registry, `applyModifiers()` composing config overrides onto a base
`SimConfig`, server-side replay validator running under the same
overridden physics, tier chip + modifier name on the home button,
tier badge + modifier label on share cards.

**What still needs to happen** for the daily to feel complete:

- **Pre-game warning screen** (`s`). Tap "today's daily" → currently
  starts the run immediately. Replace with a landing screen showing
  the tier label, modifier list, one-line warning
  (`SUPER HARD — tight gaps + heavy gravity. you've been warned.`),
  and a "play anyway" button. This is also where the missing daily
  context belongs: your best so far, attempts remaining, plays
  count, recent friend scores. Pulls together with the
  "pre-game daily landing screen" tech-debt item.
- **Visual modifiers** (half-day each, blocked on the renderer
  theme abstraction — see tech debt):
  - **Fog** — visibility ~ 60% of screen, radial reveal around the plane
  - **Night sky** — dark gradient, dim pipes
  - **Sunset** — purple → orange → gold gradient
  - **Blinding sun** — bright radial bloom on the right side, makes incoming pipes hard to read until close (pairs naturally with sunset)
  - **Rain** — light particle pass, mild visual noise
- **Mechanical modifiers** (half-day each):
  - **Headwind** — small leftward force pulses every ~2s
  - **Wind gusts** — short bursts of headwind, randomized within the run (still seed-deterministic)
- **Geometric extras** not in the first cut:
  - **Tunnel** (`m`) — pipes are doubled (two gaps in quick succession)
  - **Mirror** (`s`) — flip the world horizontally at the renderer level. The sim is already left-scrolling-deterministic, so only the canvas transform flips; collision math stays the same.

Already in the registry and live: wider gaps, tighter gaps, faster
scroll, heavier gravity, floaty gravity, big flap, small hitbox,
big hitbox. Sim determinism preserved across all modifiers
(13 tests in `tests/daily-twist.test.ts`).

### Daily: 3 attempts, best counts (`m`)

Replace today's "play once" daily with **3 attempts per UTC day, best
score counts**. Three reasons:

- Removes the panic loop ("bad RNG ruined my streak")
- Rewards learning the day's seed across attempts
- Maps to the user's instinct: best-of-3 framing

**Implementation sketch**:
- Schema: allow up to 3 runs per (user_id, daily_date). Daily
  leaderboard view ranks by `MAX(score)` per player on the date.
- UI: pre-game screen shows "attempt 1 of 3 · your best so far: 18".
  Game-over: "attempt 1 done · score 18 · play again? (2 left)".
- Locked at 3 attempts per UTC day per player. Submissions past 3
  are accepted as casual runs (no daily leaderboard credit).

### Gallery — add Themes tab + Badges tab (`s`)

The Shapes + Colors gallery shipped (replaces old skin-picker). Still
missing: a **Themes** tab (once themes become equippable cosmetics)
and a **Badges** tab (season-end placements, ordinal-tier marker).
Both are data we already have; the tab scaffold in `gallery.ts` is
ready to extend.

### Local-time ambient sky (`s`, after theme abstraction)

> **Strict scope**: only **casual / challenge / ranked** runs use the
> player's local time for the ambient sky. The **daily** is always
> global — same modifier, same physics, same sky for everyone
> worldwide, on the UTC date hash. Daily fairness over personal mood.

Two players in different timezones should not see the same sky when
their wall clocks disagree. The **daily modifier** stays global
(Berlin and LA both get "fog day"). The **ambient sky** is derived
from the *player's local time*:

| local time      | sky theme |
|-----------------|-----------|
| 06:00 – 08:00   | dawn      |
| 08:00 – 18:00   | sunny (current default) |
| 18:00 – 20:00   | sunset    |
| 20:00 – 06:00   | night     |

When the daily picks a visual modifier (fog, blinding sun), it
**layers over** the ambient sky. So Berlin player at 2am gets "fog
over night" and LA player at 6pm same day gets "fog over sunset" —
same physics, different mood. No anti-cheat concern (no scoring
advantage to spoofing your clock for a different ambient).

### "Challenge a friend" — remaining polish (`xs`)

The top-level button + friend picker + auto-create-on-death shipped.
Still missing: the picker doesn't show the friend's recent score for
context ("@lennart's best today: 18 — beat that?"), and the share
text could include the challenge short_id in the URL (currently it
uses the friend_code param which doesn't route to the ghost).

### Random color variants on alternate plane shapes (`s`)

The skin system today rolls two RGB colors for the default paper
plane shape. Once we add alternate shapes (paper crane, dart, kite),
the same procedural skin pool should apply to them too — your
"legendary crimson-on-cyan" unlock should work as a paper plane, a
paper crane, *and* a dart. Lets players mix shape and color freely.

Implementation: equipped state becomes `{ shape, skin }` instead of
just `skin`. Skin picker becomes a two-axis picker (or two pickers
side by side).

### Apple Sign-In + ~~email magic link~~ + ~~Discord~~ — email & Discord SHIPPED 2026-06-09 (`s`)

Email magic link + Discord buttons + anonymous→account linking shipped in
`account.ts` / `social/auth.ts` (3-row sign-in: email / Google / Discord).
Code is dormant until the providers are enabled in Supabase — see
`docs/auth-setup.md`. **Apple Sign-In is still TODO** (iOS-only requirement;
needs the Apple Developer Program). Note: email magic-link stores the address
in `auth.users`; a truly anonymous "sync code" alternative is parked in TODO.md.

### Friends-test deploy on Vercel (`xs`)

Run `vercel --prod`, share the URL. Documented in `docs/deploy.md`.
No code change, but it's the unblock for everything social.

### Auto-assign random handle on profile creation (`xs`)

Right now new players see "claim a handle" friction. Default
`username` to a generated 6-char code like `K7F9PQ` on profile
creation (server-side trigger). Player can change it later in the
account panel. Removes the gate from the first-five-minutes flow.

### Ordinal-position skins with RGB decay (`m`)

Different from the contrast-based rarity we have today. Reward early
joiners with skins keyed to **when** they joined, not **what**
colors rolled. Concrete plan:

- New column `profiles.signup_index` (a monotonic counter assigned
  server-side at profile creation).
- Define tier breakpoints — proposal:
  - first 50: pure white plane (`rgb(255,255,255)`)
  - 51-500: light grey
  - 501-5,000: medium grey
  - 5,001-50,000: dark grey
  - 50,001+: standard procedural pool only

  The actual RGB **decays continuously** through that range so two
  players in the same tier still have visibly different planes —
  someone at index 1,000 isn't identical to someone at index 4,999.
  Roughly: `lightness = 1 - (signup_index / 50000)` clamped, then
  map to a grey RGB. Adds a "I joined earlier" tell.
- The shape itself stays a paper plane, but consider a **new shape
  variant** for the very first tier (50 players): a folded paper
  crane or a slightly different fold pattern. Worn proudly.

## Later — agreed valuable, not started

### Menu refactor: tabbed taxonomy (`s`)

Current menu is a flat list (Daily, Casual, Ranked, Skins, Board,
Friends, Account) and getting crowded. Group under three tabs:

- **Play** (casual, challenge a friend, ranked)
- **You** (skins, themes, friends, account)
- **Board** (leaderboard, daily standings)

Daily stays as the hero button above the tabs. Settings stays below.

### Background themes + time-of-day unlocks (`l`)

Themes: night sky, cloudy, sunny, sunset, dawn. Each is a different
sky gradient + maybe a particle pass (stars, clouds). Themes unlock
via play conditions: "play 50 matches between 20:00 and 02:00 local
time to unlock night sky," etc. Both an aesthetic surface and a
gameplay loop. Equippable separately from skins, *layered under* the
local-time ambient and the daily modifier.

### Second challenge mode: "pick your best of 3" (`m`)

Today's ranked is **win two of three rounds** (each round scored
head-to-head). A second mode worth building: each player plays 3
attempts, **only their best score** counts, single comparison wins
the match. Different competitive shape — rewards your peak instead
of your consistency. Surface both modes side-by-side as
"Best of three" vs "Single peak."

### Daily play cap + opt-in session limit (`s`)

Two layers, both anti-engagement.

**Daily-leaderboard cap** (always on): after 10 daily runs the player
can keep playing **casual** but daily-leaderboard submissions stop
until tomorrow. Button copy: "you've played 10 today — touch grass."
Creates artificial scarcity without holding the game hostage.

**Optional session limit** (off by default, opt-in in settings):
choose either "20 min/day total" or "20 min then 9h cooldown." When
the limit hits, the play buttons go quiet for the cooldown window
with a one-line "come back at 18:00 — go outside" message. Toggle
lives in account settings under a "wellbeing" section.

Important: do **not** add streak-loss anxiety prompts, push
notifications, or "your friend just played" pings — those are
explicitly banned in `ETHICS.md`. Likewise, **never** unlock playtime
for money. The cap is a feature, not a paywall.

### ~~Feedback panel~~ — SHIPPED 2026-06-09 (`s`)

Shipped as a **"send feedback" button** in the account panel: opens a
configurable channel (`VITE_FEEDBACK_URL`, default GitHub issues) and grants
the hidden "kinda game dev" skin + "reviewer" badge on first use. The
table-backed form + weekly AI digest below remain a separate, still-open
enhancement if we want structured feedback later.

A simple form in the menu posting to a `feedback (id, user_id,
text, created_at)` table. Free-text only. No "feature request" radio
buttons — those bias responses. Read it weekly.

The **AI-summarize-weekly** part is a separate Tuesday-afternoon
project: a tiny script that pulls the table and asks Claude for a
themed digest. Not part of the panel itself.

### In-game help / rules screen (`s`)

Streak rules, daily seed behavior, ghost mode, ranked best-of-3 — all
currently only in the README. New player has no in-game way to learn
them. One scrollable panel in the account menu or a (?) icon next to
the hero daily button.

### Game-over screen — fill the empty space (`s`)

Game-over today: score + share + restart/menu. Lots of empty space.
Worth filling with **data we already store**:

- **Mini leaderboard strip**: top 3 today + your rank
  ("you: #47 of 14k")
- **Personal best chip**: "your daily PB: 32 — beat it next attempt"
- **Recent friends scores** on the same daily (1-2), with an inline
  "challenge them back" button
- **Next unlock hint**: "play 4 more games to mint a new skin"
- **Streak progress bar** — how close to the next milestone

Build the mini-leaderboard + PB first. Pure data, no schema change,
fits the existing layout.

### Pipe sprite redesign — distance from Flappy Bird (`s`)

Current pipes are `#3d8b58` green with caps. Reads as Mario warp
pipes. Brief explicitly says "distinct from Flappy Bird in name and
visual." Three options:

- **Folded paper columns**: cream body + tan center crease + dark
  outline, matches the player skin language. Recommended.
- **Geometric monoliths**: dark grey towers, no caps, slight bevel.
  Reads as obstacle, not pipe.
- **Theme-driven**: pipes change look per background — paper at
  default, neon at night, charred at sunset. Layered with the
  theme abstraction (already a prereq for visual modifiers).

Recommendation: paper columns first. Single change in `render.ts`,
half a day. Theme variants come along when the theme abstraction
lands.

### Butterfly as alternate character shape (`m`)

User-provided sprite. Two upper wings (cream), two lower wings
(tan), thin body, antennae. Front-view symmetric, very different
silhouette from the side-view plane. Could ship as:

- A **rare unlock** (e.g. play during the first day of spring, or
  reach a specific score milestone)
- A **selectable shape** alongside paper-plane in the gallery once
  we ship the `{ shape, skin }` two-axis equip flow

Sketch lives at `design/skins/butterfly.svg`. When porting into the
renderer, hand-translate the path commands into canvas polygon
commands inside `drawPlane` (rename to `drawShape` and dispatch on
shape id).

## Maybe — interesting but unclear payoff

### Crews / clans (`xl`)

Group identity surface. Adds a governance dimension (admin roles,
bans, name policies) that needs real product thought first. Defer
until people are *asking* for it.

### Replay watching for top global runs (`l`)

We have all the data — every accepted run carries its input trace.
Add a viewer that lets anyone watch the world's #1 run. Probably
v2.1 territory.

### Live synchronous VS over WebSocket (`xl`)

Two players in the same room, same seed, side-by-side. Async ghost
mode covers most of the social pull. Sync adds latency complexity
that isn't worth shipping to test the core loop.

### Native iOS/Android wrappers (`m` each)

Capacitor for store presence. Skip unless there's a real reason —
PWA install already handles 90% of "feels like an app."

### Daily compete *against* an AI bot (`l`)

A bot that plays the daily at adjustable skill levels. Casual
players who don't have a friend on the app still get a ghost to
race against. Risks feeling fake; would need careful balancing.

### "Old man" mode (`m`)

Adjustable assists: bigger gaps, slower scroll, no death on first
mistake. Toggle in settings. Scores in this mode don't post to
leaderboards. Welcoming surface for less twitchy players without
turning the game into something else.

### Per-run replay sharing (`m`)

Instead of just a score on the share card, embed a **24-frame GIF**
of your run's last few seconds. Visual proof. Probably needs a
server-side renderer.

### Pro tournaments / formal seasons (`xl`)

Top-N players from a season get invited to a bracket. Stake nothing,
win a special skin. Could be very engaging once player base is real.

### Monetisation paths — ethics-aligned (`s` to `m` each)

`ETHICS.md` rules out aggressive ads, microtransactions, loot boxes,
and push spam. What's left if the project ever needs revenue:

| approach                    | mechanic                                                       | feel       |
|-----------------------------|----------------------------------------------------------------|------------|
| Ko-fi / Buy Me a Coffee     | One link in account panel: "support the project"               | clean      |
| Patreon supporter badge     | One-time or monthly, permanent cosmetic supporter chip         | clean      |
| Sponsored daily             | A brand pays for a small logo on one daily's share card        | risky      |
| Premium skin pack           | Once-off purchase of a curated set, no random rolls            | borderline (would need an ETHICS update) |
| Banner / interstitial ads   | What we said we don't want                                     | forbidden  |

Recommendation: **start with Ko-fi**. One button, no functional
gate, nothing to nag the player about. Patreon supporter chip later
if the project grows.

### Capacitor app store builds (`m`)

Wraps the same web build into a real iOS / Android binary that
goes through the App Store / Play Store. Same code, two more deploy
targets. Performance ~95% of native — Canvas + RAF runs fine in
mobile webviews. Issues: Apple's 30% cut on in-app purchases (moot
if no purchases), Apple's review process (4-7 days, occasionally
rejects PWAs that "duplicate web functionality"), push notifications
need native plumbing (we don't ship push by design).

Skip until there's a real reason. PWA install handles 90% of "feels
like an app." Half a week to set up cleanly when the time comes.

## Tech debt / pain points

Honest record of where the code is starting to creak. Each gets a
"when to fix" note.

### ~~Renderer has no `theme` abstraction~~ — SHIPPED

Shipped in feat/theme-abstraction. 6 themes registered, fog overlay
wired, sun-spot hook ready. Unblocks visual modifiers + ambient sky.

### `api/submit-run.ts` is doing too many things (`m` to split)

Validates the run, checks daily-seed correctness, updates streak,
increments daily play count, attaches challenge response, settles
ranked BO3 ELO, mints skin unlocks. Adding daily-twist + daily-best-
of-3 makes it touch 9 things in one 200-line file.

**When to fix**: when adding the next mode (daily-best-of-3 or
challenge-a-friend). Not before — premature splits tend to produce
worse boundaries than waiting for the second concrete need.

### Menu is a flat list (`s` to refactor)

7 entries today, 10-11 with planned additions. Will feel cramped.

**When to fix**: when adding the "Challenge a friend" top-level
button, do the tabbed refactor at the same time so the new entry
doesn't make the flat list worse first.

### No `mode` polymorphism — modes are an enum (`m` to refactor)

`runs.mode` is an enum (casual / daily / challenge / ranked). Adding
daily-best-of-3 means either reusing `daily` with extra state or a
new enum value plus a column. Neither scales.

**When to fix**: only if we add 2+ more modes. For now, "daily" can
carry the best-of-3 state via an `attempt_number` column.

### ~~Skin picker doesn't preview locked items~~ — SHIPPED

Shipped in feat/shape-gallery. Gallery shows all shapes with lock
state + unlock hints. Colors tab shows owned procedural skins.

### ~~Pre-game daily landing screen is missing~~ — SHIPPED

Shipped in feat/pregame-daily-landing. Shows tier, modifiers, PB,
streak, plays count. Still missing: friend scores + attempts counter
(those arrive with daily-best-of-3).

---

## Shipped

| Date       | What                                                                |
|------------|---------------------------------------------------------------------|
| 2026-06-09 | feat: gameplay haptics (flap/score/crash) + Vibration setting; iOS Safari is a no-op until a native Taptic bridge |
| 2026-06-09 | feat: feedback button + hidden "kinda game dev" skin + "reviewer" badge |
| 2026-06-09 | feat: collectible badge system (badges-catalog.ts) surfaced in the gallery badges tab |
| 2026-06-09 | feat: cosmetics variety pass — 4 pillar colors, 5 preset skins, "feather" flap sound, each gated on a different stat axis |
| 2026-06-09 | feat: 3-row sign-in (email magic link / Google / Discord) + anonymous→account linking (dormant until providers configured) |
| 2026-06-09 | chore: cleanup_stale_anonymous_users() migration; docs/packaging-notes.md + docs/auth-setup.md; README refresh |
| 2026-05-26 | feat/challenge-friend-button: top-level menu entry + friend picker + auto-create challenge on death |
| 2026-05-26 | feat/shape-gallery: 6 shapes (plane/v2/dart/kite/crane/butterfly) + gallery with unlock predicates replacing old skin picker |
| 2026-05-26 | feat/pregame-daily-landing: pre-game screen with tier/modifier/PB/streak before daily starts |
| 2026-05-26 | feat/theme-abstraction: 6 themes (sunny/cloudy/sunset/dawn/night/fog) + fog radial overlay + sun-spot hook |
| 2026-05-26 | chore/doc-refresh: README 76→101 tests, daily-twist mention, IDEAS shipped/remaining split |
| 2026-05-15 | daily-twist: physics + geometry modifiers, tier picker (1/3/2/1), server-side replay under modifier-aware cfg, tier chip on home screen + share card |
| 2026-05-14 | docs: design gallery v2 (paper-plane-v2 + butterfly sprites)        |
| 2026-05-14 | docs: design gallery (SVG sketches for skins / themes / palettes)   |
| 2026-05-14 | M6 — offline queue, a11y pass, GDPR endpoints, LICENSE/PRIVACY/ETHICS |
| 2026-05-14 | M5 — ranked best-of-three, ELO, seasons, season-end top-100 badges  |
| 2026-05-14 | M4 — friends, ghost-mode challenges, depth-2 cap, comparison screen |
| 2026-05-14 | M3 — daily seed, streak counter, share card, OG image, deep links   |
| 2026-05-13 | M2 — Supabase auth, skins + ΔE2000 rarity, leaderboards, validation |
| 2026-05-13 | M1 — deterministic sim, canvas renderer, PWA shell, settings        |

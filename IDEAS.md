# Ideas

Long-running list. Four buckets: **next**, **later**, **maybe**, plus
**tech debt** at the bottom. Each entry has a rough size (`xs` < 1h,
`s` < half day, `m` < day, `l` < week, `xl` more) and a one-line
shape so future-you remembers what you meant.

> When you ship something on this list, move it to the bottom under
> **Shipped** with the date.

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
1. **Challenge overhaul** (`m`–`l`) — real sender cosmetics (store
   `creator_shape` + `creator_theme` on the challenge; render the ghost
   as the real sender shape + paint their theme/sky/pillars so they
   flex); hide sender score until you finish; new game-over layout
   (improve · submit · brag · back) + receiver give-up / win-and-brag;
   friend-picker shows the friend's recent score.
2. **Daily best-of-3** (`m`) — 3 attempts/day, best counts, then blocked
   (unblocked by the leaderboard dedupe).
3. **Public profiles + Badges tab** (`m`).
4. **Visual daily modifiers** (`m`) — blinding sun / light source, night,
   sunset, rain, on top of the existing fog.
5. **Leaderboard 3-axis matrix** (`s`–`m`).
6. **Monetisation foundation** (`s`) — ETHICS.md amend + BMC tip button
   + non-tracking banner slot + cosmetic supporter chip.
7. **Quest-chains-in-Gallery** (`s`, separate compare branch).

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

### Apple Sign-In + email magic link (`s`)

Supabase supports both natively. Add provider toggles + buttons in
`account.ts`. Same plumbing as the Google button. Email magic link
is the more user-friendly option for people who avoid OAuth.

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

### Feedback panel (`s`)

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

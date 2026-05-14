# Ideas

Long-running list. Three buckets: **next**, **later**, **maybe**.
Each entry has a rough size (`xs` < 1h, `s` < half day, `m` < day,
`l` < week, `xl` more) and a one-line shape so future-you remembers
what you meant.

> When you ship something on this list, move it to the bottom under
> **Shipped** with the date.

## Next — concrete, deciding what to start

### Daily twist (`m`)

The daily seed currently only varies pipe positions. Boring after a
few days. Derive a **single modifier** from the same seed each day so
the daily has a clear identity ("today is wide-gap day", "today is
fog day"). The pick is deterministic (`seed % modifier_count`), same
for everyone worldwide.

Modifier candidates:

- Physics-only (1-2 hours each):
  - Wider gaps (`gapH + 20`)
  - Tighter gaps (`gapH - 15`)
  - Faster scroll (`* 1.25`)
  - Heavier gravity (`* 1.15`)
  - Floaty (`gravity * 0.85`)
  - Big flap (`flapImpulse * 1.2`)
- Visual (half-day each):
  - Foggy — render only ahead ~220px, fade the rest
  - Night sky — dark gradient, dim pipes
  - Sunset — red/orange gradient
- Mechanical:
  - Headwind — small leftward force pulses every ~2s

Surface the modifier name on the home screen ("today: fog day · 14k
played") and bake it into the share card + OG image so people can
brag about beating a specific twist.

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

## Later — agreed valuable, not started

### Background themes + time-of-day unlocks (`l`)

Themes: night sky, cloudy, sunny, sunset. Each is a different sky
gradient + maybe a particle pass (stars, clouds). Themes unlock via
play conditions: "play 50 matches between 20:00 and 02:00 local time
to unlock night sky," etc. Both an aesthetic surface and a gameplay
loop. Equippable separately from skins.

### Second challenge mode: "pick your best of 3" (`m`)

Today's ranked is **win two of three rounds** (each round scored
head-to-head). A second mode worth building: each player plays 3
attempts, **only their best score** counts, single comparison wins
the match. Different competitive shape — rewards your peak instead
of your consistency. Surface both modes side-by-side as
"Best of three" vs "Single peak."

### Daily play cap with rest copy (`s`)

After 10 daily runs the player can keep playing **casual** mode but
**daily-leaderboard submissions stop until tomorrow**. The button
copy says something like "you've played 10 today — touch grass." Use
the cap to create artificial scarcity *without* holding the game
hostage. Important: do **not** add streak-loss anxiety prompts, push
notifications, or "your friend just played" pings — those are
explicitly banned in `ETHICS.md`.

### Feedback panel (`s`)

A simple form in the menu posting to a `feedback (id, user_id,
text, created_at)` table. Free-text only. No "feature request" radio
buttons — those bias responses. Read it weekly.

The **AI-summarize-weekly** part is a separate Tuesday-afternoon
project: a tiny script that pulls the table and asks Claude for a
themed digest. Not part of the panel itself.

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

---

## Shipped

| Date       | What                                                                |
|------------|---------------------------------------------------------------------|
| 2026-05-14 | M6 — offline queue, a11y pass, GDPR endpoints, LICENSE/PRIVACY/ETHICS |
| 2026-05-14 | M5 — ranked best-of-three, ELO, seasons, season-end top-100 badges  |
| 2026-05-14 | M4 — friends, ghost-mode challenges, depth-2 cap, comparison screen |
| 2026-05-14 | M3 — daily seed, streak counter, share card, OG image, deep links   |
| 2026-05-13 | M2 — Supabase auth, skins + ΔE2000 rarity, leaderboards, validation |
| 2026-05-13 | M1 — deterministic sim, canvas renderer, PWA shell, settings        |

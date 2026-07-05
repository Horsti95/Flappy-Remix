# Glide — project overview (for personal website)

> Play it: **[glide.uno](https://glide.uno)** · Source: `github.com/horsti95/flappy-remix`
> *(confirm the canonical play URL before publishing — see note at the bottom)*

---

## A. Blog-post paragraph (short)

**Glide** is a daily, one-button arcade game that runs entirely in the
browser — no install, mobile-first, playable offline. On the surface it's a
Flappy-Bird-style "thread the gaps" game with a folded paper plane; underneath
it's built around a single technical decision: the whole simulation is
**deterministic**. The same daily seed plus the same taps produce a byte-for-byte
identical run on every device, which is what makes everything else trustworthy —
a worldwide **daily challenge** where everyone flies the exact same wind, a
**ranked** ladder with server-side replay validation (cheated scores simply
don't post), and **ghost duels** where a friend replays your run as a translucent
plane in your colours. It's written in vanilla TypeScript on an HTML5 canvas with
a hand-rolled 60 Hz physics engine, backed by Supabase (auth + Postgres) and
Vercel edge functions, and shipped as an installable PWA — around 186 automated
tests keep the sim, the anti-cheat, and the reward economy honest.

---

## B. Detailed writeup (~2 pages)

### What it is

Glide is a solo-built, browser-only arcade game. You tap (or click, or hit space)
to keep a paper plane aloft and thread it through gaps in a scrolling wall of
pillars, chasing a score. It's mobile-first, installs as a Progressive Web App,
and the core game plays fully offline. The name is Glide (domain `glide.uno`); the
character is a **folded paper plane**, not a bird — a deliberate choice to stay
visually and legally distinct from Flappy Bird while mapping cleanly onto the
game's two-colour cosmetic system.

The project was built incrementally as a "vibe-coding" exercise: many small,
individually-verified changes (typecheck + build + tests green before each merge)
rather than a few large drops. The result is a surprisingly complete product —
auth, leaderboards, a ranked ELO ladder, a daily event, a cosmetics economy,
social features, GDPR endpoints, and a documented roadmap.

### The one decision everything leans on: determinism

The most important design decision was to make the simulation **fully
deterministic**. The physics run on a fixed 60 Hz timestep with semi-implicit
Euler integration, and all randomness comes from a seeded Mulberry32 PRNG. Given
the same seed and the same sequence of taps, a run replays identically — byte for
byte — across machines. Rendering is decoupled from simulation (interpolated
between ticks, and skipped under `prefers-reduced-motion`), so visuals never leak
into the sim.

That "boring" foundation is what unlocks the interesting features, because every
one of them reduces to *replaying inputs against a seed*:

- **Daily challenge** — one shared seed per UTC date; literally everyone in the
  world flies the same level. Tagline: *"Everyone flies the same wind today."*
- **Ranked** — both players get the same three seeds; the server re-simulates the
  submitted inputs and rejects any run whose score doesn't match. Cheating doesn't
  post.
- **Ghost duels** — a run is just a list of taps, so a friend can replay your
  "ghost" on your seed and try to beat it.

From that point on, the design rule for every new feature became a single
question: *does this keep the sim deterministic?* Cosmetics: yes. Power-ups: no —
which is exactly why they're deferred to a separate "Arcade" mode that opts out of
the rules on purpose.

### Architecture at a glance

- **Frontend:** vanilla TypeScript on an HTML5 canvas — no game engine, no
  framework. DPR-aware letterboxing for crisp rendering across devices. Built with
  Vite, styled with Tailwind, shipped as an installable PWA with offline support.
- **Backend:** Supabase for authentication and a Postgres database, with
  Row-Level Security enabled on every table. Vercel edge functions handle the
  trust-sensitive work: replay validation, ranked ELO settlement, ghost-challenge
  creation, social-share image rendering, and GDPR data export/delete.
- **Auth model:** anonymous sign-in on first load (you can play immediately),
  with an optional upgrade to Google, Discord, or email magic-link — including
  anonymous→account **linking** so progress carries over.
- **Offline-first:** solo play needs no network; run submissions queue in
  local storage and flush automatically when connectivity or tab focus returns.
- **Testing:** ~186 unit and integration tests (Vitest) cover PRNG stability, sim
  determinism, the replay validator (cadence, score-mismatch, tampering), daily
  seed math (including UTC boundaries and leap years), ELO and best-of-three
  settlement, and the full death → challenge → friend-plays loop.

### Design decisions worth calling out

- **Server-authoritative anti-cheat by replay, not by trust.** Rather than trust
  client-reported scores, the server keeps its own copy of the sim and re-runs
  your inputs. This is only possible *because* of determinism — it's the payoff of
  the core decision.
- **The daily "twist."** Each day's seed also rolls a difficulty tier (easy /
  medium / hard / super-hard) plus one or two physics modifiers — wider or tighter
  gaps, floaty or heavy gravity, a bigger flap, a larger or smaller hitbox, faster
  scroll. The modifier is the same for everyone worldwide, and both client and
  server replay under the *matched* physics, so the leaderboard stays honest even
  as the game itself changes shape day to day.
- **A cosmetics system built on colour science.** Skins are just two RGB colours
  (body + accent fold — matching the paper plane's two faces). Rarity isn't
  hand-assigned; it's *computed* from the colour pair using ΔE2000 perceptual
  contrast and complementary-hue detection, then gated behind lifetime-play
  milestones. Milestone skins are becoming a "pick 1 of 3 generated liveries"
  moment, where the generator itself is the signature feature.
- **Cosmetic, never pay-to-win.** Expression stacks across independent axes —
  plane shape, colours, pillar styles (solid / stone / neon / glass), themes,
  interactive worlds (Ocean, Space) that shift as you go deeper, and daily
  "weather" that ranges from pure mood to genuine added difficulty. None of it
  touches the sim.
- **Ethics as a design constraint.** A committed `ETHICS.md`: no ads, no loot
  boxes, no contact scraping, no fake notifications. Privacy is first-class —
  GDPR data-export and account-delete endpoints ship in the account panel.
- **Character design as a considered choice.** The paper plane was picked over a
  geometric creature and a comet/shooting-star: it reads legibly at favicon and
  share-card sizes, avoids IP collision, maps to the two-colour skin encoding, and
  pitches naturally with vertical velocity so the tilt looks *motivated* rather
  than decorative.

### The social & retention layer

Beyond the core loop: friends by username (mutual, no contact scraping), a
global-vs-friends × today/week/month/all-time leaderboard matrix, streak
counters, a ranked best-of-three ELO ladder with monthly seasons and a permanent
top-100 badge, and shareable runs — every run mints a `/run/<id>` link that
unfurls with a server-rendered preview image on WhatsApp, X, Discord, Slack, and
Telegram, plus a 1080×1920 share card rendered client-side.

### What I took away from it

The throughline of the project is that **one well-chosen technical constraint can
define an entire product.** Committing to determinism early made the daily
challenge, ranked integrity, ghost duels, and anti-cheat almost fall out for free
— while the same constraint cleanly quarantined the features that *couldn't* live
in that world (power-ups) into a separate mode. It's also an exercise in shipping
a genuinely complete, production-shaped web app solo: real auth, RLS-secured data,
edge functions, an offline-capable PWA, a tested reward economy, and a documented
roadmap — not a prototype, but something you can actually play today.

---

### Note on the play link

The intended public URL is **glide.uno**. Depending on when you publish, the
game may currently live on its Vercel deploy URL instead (the `glide.uno` domain
wiring is a roadmap item). Confirm which URL is live before you paste the link
into the site, so "play directly" actually works for visitors.

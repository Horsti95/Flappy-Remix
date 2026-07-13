# Glide

A daily flap-through-gaps arcade game. Mobile-first, browser-only, no
install required (PWA-installable). Vanilla TypeScript on HTML5 canvas
with a hand-rolled deterministic sim, Supabase auth + postgres, and
Vercel edge functions for replay validation, OG image rendering, and
matchmaking.

> **Name**: Glide (domain `glide.uno`). The character is a paper plane,
> not a bird. Both choices were made deliberately to be distinct from
> Flappy Bird in name and visual. (Earlier drafts used the codename
> "Pflug"; a few internal identifiers like the `pflug.*` localStorage
> keys still carry it — an invisible namespace token, intentionally
> left as-is so existing players keep their saved data.)

## Trying it out

**Locally on your PC** (offline-only without env vars):

```sh
git clone https://github.com/horsti95/flappy-remix.git pflug
cd pflug
npm install
npm run dev
```

Open <http://localhost:5173>. Tap, click, or space to flap.

**Sharing with a friend** (~5 minutes via Vercel):

```sh
npm i -g vercel
vercel login
vercel --prod
```

Gives you a `https://pflug-something.vercel.app` URL friends can open
from anywhere. Free tier handles way more traffic than you'll need.
For the full backend (leaderboards, friends, ranked), set up Supabase
first — see [`docs/deploy.md`](./docs/deploy.md) for the 6-step path.

**Branch strategy for adding features**:

- `main` is what's deployed publicly — keep it stable
- Make a feature branch off `main` for each new thing
  (e.g. `feat/daily-twist`, `feat/apple-signin`)
- Vercel auto-deploys every branch to its own **preview URL**, so
  you can share a half-baked feature with a specific person without
  affecting the main URL
- When a feature feels good, merge it to `main` → Vercel re-deploys

```sh
git checkout main
git pull
git checkout -b feat/something
# ... commits ...
git push -u origin feat/something
# open a PR on GitHub when you're ready to merge
```

See [`IDEAS.md`](./IDEAS.md) for the running list of what to build next.

---

## What ships in v1

- Hand-rolled fixed-step sim (60 Hz, semi-implicit Euler) with a
  Mulberry32 PRNG. Same seed + same inputs = identical run, byte-for-
  byte across machines. This determinism is the foundation for ghost
  mode, daily seeds, ranked, and anti-cheat.
- Mobile-first canvas renderer with DPR-aware letterboxing, render-
  interpolated between sim ticks (skipped under prefers-reduced-motion).
- 24-bit body+accent RGB skin system with rarity tiers driven by
  ΔE2000 color contrast and complementary-hue detection. Skins mint at
  1, 10, 50, 100, 200, 500, 1000, 2000, 5000 lifetime games.
- Anonymous Supabase auth on first load; optional upgrade to Google,
  Discord, or email (magic link) with anonymous→account linking so
  progress carries over; 3–8 char alphanumeric usernames with a curated
  profanity blocklist.
- Server-side replay validation via a Vercel edge function. Every
  accepted run is re-simulated and rejected if its score doesn't match.
- Daily seed shared by every player on a given UTC date, with a daily
  leaderboard view and home-screen plays-count surface.
- Daily twist: the daily seed also rolls a difficulty tier (easy / medium
  / hard / super hard at 1/3/2/1 frequency) plus 1-2 physics modifiers
  (wider/tighter gaps, floaty/heavy gravity, big flap, small/big hitbox,
  faster scroll). Same modifier worldwide; both client and server
  replay under matched physics so the daily leaderboard stays honest.
- Streak counter (any mode +1 per day, daily +2 — bonus once per day).
- 1080×1920 PNG share card rendered client-side; 1200×630 OG image
  rendered server-side via @vercel/og; `/run/<id>` URLs unfurl on
  WhatsApp / X / Discord / Slack / Telegram with the right meta tags.
- Friends by username (mutual auto-add, no contact scraping). Friends-
  only leaderboard tab.
- Ghost-mode challenges: any run becomes a `?c=<id>` link; the friend
  plays the same seed with the original input trace overlaid as a
  translucent ghost in the creator's skin colors. Capped at 2 deep.
- Ranked best-of-three with ELO, monthly seasons, soft 75% reset
  toward 1200, top-100 badge persisted forever via season snapshots.
  Matchmaking pool widens at 5/10/15 minutes.
- Offline-first PWA: solo play works without a network; submissions
  queue in localStorage and flush automatically when you're back
  online (or when the tab regains focus).
- GDPR data export and account-delete endpoints in the account panel.
- Haptic feedback on flap / score / crash, toggled by a Vibration setting
  (no-op on iOS Safari until a native Taptic bridge in the wrapped app).
- Collectible badges (earned from play / feedback / supporter) shown in the
  gallery, plus a "send feedback" button that grants a hidden skin + badge.
- Variety-pass cosmetics: pillar colors, preset skins, and flap sounds gated
  on mixed axes (time-of-day, streaks, daily tiers) rather than one number.

## Local dev

```sh
npm install
cp .env.example .env       # fill in if you have a Supabase project
npm run dev
```

Open <http://localhost:5173>. Without `.env` values you play offline-
only — runs aren't persisted and there is no leaderboard, friends, or
ranked. The game itself plays the same.

```sh
npm test                   # vitest — fast unit + integration suite
npm run typecheck          # tsc --noEmit
npm run build              # production build to dist/
npm run icons              # regenerate PWA / OG icons from the SVG
```

## Backend setup

The backend is Supabase (auth + postgres) plus Vercel edge functions.
Both are free tier for the scale you're likely to start at.

1. Create a project at <https://supabase.com>.
2. Install the Supabase CLI: `brew install supabase/tap/supabase`.
3. Link this repo: `supabase link --project-ref YOUR-REF`.
4. Apply migrations: `supabase db push`. Migrations live in
   `supabase/migrations/` numbered sequentially (`0001_init.sql` onward —
   30 and counting); apply them in order.
5. In the Supabase dashboard: enable **Anonymous Sign-Ins**
   (Authentication → Providers). To offer account sign-in, enable the
   **Email**, **Google**, and **Discord** providers, turn on **Manual
   Linking**, and set the URL config — full checklist in
   [`docs/auth-setup.md`](./docs/auth-setup.md). Native-packaging and
   store/monetization notes live in
   [`docs/packaging-notes.md`](./docs/packaging-notes.md).
6. Copy keys into `.env`:

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   PUBLIC_SITE_URL=http://localhost:5173
   ```

The `VITE_`-prefixed pair is bundled into the browser build (the anon
key is safe to expose under RLS). The unprefixed keys are for Vercel
edge functions only and must never leak to the client.

### Schema

Tables (RLS enabled on all):

| table                   | rows                                                            |
|-------------------------|-----------------------------------------------------------------|
| `profiles`              | username, total games, streak, xp, equipped skin                |
| `skins`                 | per-user 6-byte RGB skin records + rarity                       |
| `runs`                  | every accepted run with full input trace                        |
| `daily_seeds`           | one per UTC date with plays_count                               |
| `friendships`           | denormalized two-row mutual friendship                          |
| `challenges`            | ghost challenges with parent_id chains capped at depth 2        |
| `ranked_matches`        | best-of-three with seeds[3], score arrays, ELO before/after     |
| `matchmaking_queue`     | ephemeral, scanned by the queue endpoint                        |
| `seasons`               | monthly buckets, one active                                      |
| `elo_ratings`           | per-season live rating                                          |
| `elo_season_snapshots`  | end-of-season rank for permanent top-100 badges                 |
| `skin_codes`            | redeemable promo codes → skin/badge grants (service-role only)  |
| `link_codes`            | short-lived device-link codes for cross-device profile carry    |

Views: `leaderboard_all_time`, `leaderboard_weekly`, `leaderboard_daily`.
RPCs: `add_friend_by_username`, `friends_leaderboard`, `current_season`,
`roll_season`, `gen_challenge_short_id`, `upsert_daily_seed`.

### API surface

Vercel edge functions in `api/`:

- `POST /api/submit-run` — server-side replay validation; mints
  unlocks, settles ranked ELO when a BO3 finishes
- `GET  /api/daily` — today's seed + plays count
- `POST /api/challenge-create`, `GET /api/challenge` — ghost mode
- `POST /api/ranked-queue` (`DELETE` to leave),
  `GET /api/ranked-match` — matchmaking + match detail
- `GET  /api/og` — 1200×630 OG image via @vercel/og
- `GET  /api/og-meta` — `/run/<id>` HTML shell with OG/Twitter meta
- `GET  /api/me-export`, `POST /api/me-delete` — GDPR endpoints
- `POST /api/feedback` — files in-app feedback as a GitHub issue
- `POST /api/redeem-code` — promo-code redemption (skins / badges)
- `POST /api/link-code` — device-link codes (profile on a second device)
- `POST /api/ranked-challenge` — direct ranked challenge to a friend

In dev, the same handlers are mounted by `dev-api.ts` as a Vite
middleware so `npm run dev` exercises them without needing
`vercel dev`.

### Operations

- Monthly season rotation: see `docs/ranked-ops.md` for the
  `roll_season()` cron snippet.
- Skin alphabet, rarity bands, unlock thresholds: tunable in
  `src/game/rarity.ts` and `api/_lib/unlock.ts`.
- Physics constants: `src/game/config.ts`.

## Vercel deploy

```sh
vercel link
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add PUBLIC_SITE_URL
vercel --prod
```

`vercel.json` sets the build command, output directory, and rewrites
`/run/:id` to the OG-meta function so link previews unfurl correctly.

## Name

The name is **Glide** (domain `glide.uno`), settled after the earlier
"Pflug" codename. Everything player-facing — the PWA manifest, OG meta,
in-game headings, and share cards — already reads "Glide". The only
remaining "pflug" references are internal: the `pflug.*` localStorage
namespace (left as-is so existing players keep their saved data) and the
GitHub repo slug. Renaming the storage keys would orphan player data for
no user-visible gain, so it's intentionally not done.

## Character design

The player character is a **folded paper plane**, not a bird.
Two-tone (body + accent fold) maps directly to the 6-byte skin
encoding. Reasons:

- Distinct from Flappy Bird, Mario, Pikachu, etc. — no IP collision.
- Maps cleanly to the procedural skin system: every skin is just two
  RGB colors and a paper plane has two faces.
- Reads at any size — silhouette is legible at favicon and share-card
  resolutions.
- Naturally pitches with vertical velocity, so the renderer's tilt
  reads as motivated rather than decorative.

Two alternatives I considered:

- **Geometric creature** (rounded triangle with eye, hexagonal blob).
  Lower IP risk, but less immediately legible.
- **Comet / shooting star** with a glowing trail. Strong motion feel
  but flap physics on a comet reads as odd.

## Privacy & ethics

See [PRIVACY.md](./PRIVACY.md) for what we store and how to get it back.
See [ETHICS.md](./ETHICS.md) for the design choices we've committed to —
no ads, no microtransactions, no loot boxes, no contact scraping, no
fake notifications.

## Tests

The vitest suite covers: PRNG stability, sim determinism, ΔE2000 + rarity
classification, replay validator (cadence, score mismatch, tampering),
daily seed determinism + UTC boundary + leap-year math, all 8 streak
rules, ELO math (16 cases), BO3 settlement, season soft-reset chain,
daily-twist tier distribution + modifier-aware replay divergence,
the death → challenge → friend-plays integration loop. A Playwright
spec scaffold lives at `tests/e2e/` for browser-driven verification
when a runner is added to CI.

## License

MIT — see [LICENSE](./LICENSE).

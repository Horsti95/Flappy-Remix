# Pflug

A daily flap-through-gaps arcade game. Mobile-first, browser-only, no
install required (PWA-installable). Vanilla TypeScript on HTML5 canvas
with a hand-rolled deterministic sim, Supabase auth + postgres, and
Vercel edge functions for replay validation, OG image rendering, and
matchmaking.

> **Working title**: "Pflug". See [brand options](#brand-options).
> The character is a paper plane, not a bird. Both choices were made
> deliberately to be distinct from Flappy Bird in name and visual.

## What ships in v1

- Hand-rolled fixed-step sim (60 Hz, semi-implicit Euler) with a
  Mulberry32 PRNG. Same seed + same inputs = identical run, byte-for-
  byte across machines. This determinism is the foundation for ghost
  mode, daily seeds, ranked, and anti-cheat.
- Mobile-first canvas renderer with DPR-aware letterboxing, render-
  interpolated between sim ticks (skipped under prefers-reduced-motion).
- 281T-skin RGB system with rarity tiers driven by ΔE2000 color
  contrast and complementary-hue detection. Unlocks at 1, 10, 50, 100,
  200, 500, 1000, 2000, 5000 lifetime games.
- Anonymous Supabase auth on first load, optional Google upgrade,
  3–8 char alphanumeric usernames with a curated profanity blocklist.
- Server-side replay validation via a Vercel edge function. Every
  accepted run is re-simulated and rejected if its score doesn't match.
- Daily seed shared by every player on a given UTC date, with a daily
  leaderboard view and home-screen plays-count surface.
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
npm test                   # vitest — 76 unit + integration tests
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
   `supabase/migrations/000{1,2,3,4}_*.sql`.
5. In the Supabase dashboard: enable **Anonymous Sign-Ins**
   (Authentication → Providers). Configure Google OAuth if you want
   it.
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
| `profiles`              | username, friend code, total games, streak, equipped skin       |
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

## Brand options

The placeholder is **Pflug** ("plough" in German — short, two
syllables, no English collision). Three alternatives I've sketched:

1. **Pflug** — current placeholder. Pros: short, memorable, unique
   trademark-wise. Cons: most English speakers will mispronounce it.
2. **Skim** — evokes flight just over an obstacle. Three letters,
   one syllable.
3. **Drift** — neutral, calm; pairs well with the paper-plane visual.

Pick one before any external launch; the working title only affects
the manifest, OG meta, and headings.

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

76 vitest tests cover: PRNG stability, sim determinism, ΔE2000 + rarity
classification, replay validator (cadence, score mismatch, tampering),
daily seed determinism + UTC boundary + leap-year math, all 8 streak
rules, ELO math (16 cases), BO3 settlement, season soft-reset chain,
the death → challenge → friend-plays integration loop. A Playwright
spec scaffold lives at `tests/e2e/` for browser-driven verification
when a runner is added to CI.

## License

MIT — see [LICENSE](./LICENSE).

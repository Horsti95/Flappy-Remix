# Pflug

A daily flap-through-gaps arcade game. Mobile-first, browser-only, no
install required (PWA-installable). Built with vanilla TypeScript on
HTML5 canvas, a hand-rolled deterministic sim, Supabase auth +
postgres, and Vercel edge functions for replay validation and OG image
generation.

> **Working title**: "Pflug". Final brand TBD — see
> [brand options](#brand-options) below. Must be distinct from Flappy
> Bird in both name and visual design.

## What's playable today

Milestone M1 complete: solo offline-only game. Paper-plane character
on a deterministic seeded sim, score, pause, settings, PWA install.
Leaderboards / skins / daily seed / share cards / friends / ranked
land in M2–M5.

## Local dev

```sh
npm install
cp .env.example .env       # fill in if you have a Supabase project
npm run dev
```

Open <http://localhost:5173>. Without `.env` values you'll play
offline-only — runs aren't persisted and there is no leaderboard.

```sh
npm test                   # vitest unit tests
npm run typecheck          # tsc --noEmit
npm run build              # production build to dist/
npm run icons              # regenerate PWA / OG icons from the SVG
```

## Backend setup

The backend is Supabase (auth + postgres) plus Vercel edge functions
for privileged operations.

1. Create a free Supabase project at <https://supabase.com>.
2. Install the Supabase CLI: `brew install supabase/tap/supabase`
   (or see the [official guide](https://supabase.com/docs/guides/cli)).
3. Link this repo: `supabase link --project-ref YOUR-REF`.
4. Apply migrations: `supabase db push`.
5. In the Supabase dashboard, enable **Anonymous Sign-Ins** under
   Authentication → Providers. Configure Google OAuth there if you
   want it (M2.2).
6. Copy your project URL and anon key into `.env`:

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   ```

The `VITE_`-prefixed pair is for the browser bundle (safe — only the
anon key with RLS enforced). The unprefixed `SUPABASE_SERVICE_ROLE_KEY`
is for Vercel edge functions only and must never leak to the client.

## Schema overview

See `supabase/migrations/` for the source of truth. Tables in M2:

| table         | rows                                            | RLS                                     |
|---------------|-------------------------------------------------|-----------------------------------------|
| `profiles`    | one per auth user, username + counters          | public read, self write                 |
| `skins`       | per-user owned skin records (6-byte RGB pair)   | public read, server-only insert         |
| `runs`        | every accepted run (seed, score, inputs jsonb)  | public read, server-only insert         |
| `daily_seeds` | one per UTC date                                | public read, server-only insert         |

Views: `leaderboard_all_time`, `leaderboard_weekly`, `leaderboard_daily`.

## Brand options

The placeholder name is **Pflug** ("plough" in German — short, two
syllables, no English collision). Three alternatives I've sketched
out for the final pick:

1. **Pflug** — current placeholder. Pros: short, memorable, unique
   trademark-wise. Cons: most English speakers will mispronounce it.
2. **Skim** — evokes flight just over an obstacle. Three letters.
   Single-syllable.
3. **Drift** — neutral, calm; pairs well with the paper-plane visual.

Pick one before any external launch; the working title only affects
the manifest, OG meta, and headings.

## Character design

The player character is a **folded geometric paper plane**, not a
bird. Two-tone: body + accent fold maps directly to the 6-byte skin
encoding (3 bytes per color). Justifications:

- **Distinct from Flappy Bird** (or Mario, Pikachu, etc.): a paper
  plane has no eyes, no organic anatomy, no IP collision.
- **Maps cleanly to the procedural skin system**: every skin is just
  two RGB colors; the plane has two faces.
- **Reads at any resolution**: a triangle silhouette is legible at
  16×16 favicon size and at 1080×1920 share-card size.
- **Visually motivated tilt**: planes naturally pitch with velocity,
  so the renderer can rotate it according to `vy / 600` for feel.

Two alternatives I considered:

- **Geometric creature** (rounded triangle with eye, or a hexagonal
  blob with two fins). More abstract, lowest IP risk, but a paper
  plane is more immediately legible.
- **Comet / shooting star** with a glowing trail. Strong motion feel
  but flap physics on a comet reads as odd.

## Privacy & ethics

See [PRIVACY.md](./PRIVACY.md) and [ETHICS.md](./ETHICS.md) (drafted
in M6 once the backend behaviour is finalised).

## License

MIT — see [LICENSE](./LICENSE).

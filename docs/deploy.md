# Deploy

Path from a fresh clone to a live URL. ~30 minutes if you've used
Supabase + Vercel before.

## 1. Supabase

1. `supabase.com` → New project. Save the project ref and the database
   password somewhere.
2. **Authentication → Providers → Anonymous Sign-Ins** → enable.
3. (Optional) **Google** → enable, paste your Google Cloud OAuth
   credentials.
4. Locally:

   ```sh
   brew install supabase/tap/supabase   # or your platform's equivalent
   supabase login
   supabase link --project-ref YOUR-REF
   supabase db push                     # applies 0001 .. 0004
   ```

   > **Back up before every `db push`.** Our migrations are additive
   > (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN`), so existing
   > rows survive and new columns start empty. Still, take a restore point
   > first — it's a guaranteed undo if a change goes wrong:
   >
   > ```sh
   > SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run backup
   > ```
   >
   > This dumps every table to `backups/pflug-backup-<timestamp>.json`
   > (gitignored). Supabase's own automatic daily backups / PITR are the
   > second layer — confirm they're enabled for your plan.

5. (Optional, for monthly season rotation) **Database → Extensions** →
   enable `pg_cron`, then run:

   ```sql
   select cron.schedule(
     'pflug-season-roll',
     '0 0 1 * *',
     $$ select public.roll_season() $$
   );
   ```

6. **Project Settings → API** → copy the **Project URL**, the **anon
   public** key, and the **service_role** key. The service role key
   bypasses RLS — never paste it into a client-side file.

## 2. Vercel

```sh
vercel link
vercel env add VITE_SUPABASE_URL          # production + preview
vercel env add VITE_SUPABASE_ANON_KEY     # production + preview
vercel env add SUPABASE_URL               # production + preview (server)
vercel env add SUPABASE_SERVICE_ROLE_KEY  # production + preview (server)
vercel env add PUBLIC_SITE_URL            # e.g. https://pflug.app
vercel --prod
```

`vercel.json` already wires:

- `outputDirectory: dist`
- `rewrites`: `/run/:id` → `/api/og-meta?id=:id` so link previews
  unfurl with the right per-run image

## 3. Supabase auth → site URL

In Supabase **Authentication → URL Configuration**, set:

- Site URL = your Vercel production URL (e.g. `https://pflug.app`)
- Redirect URLs include both the preview wildcard and production

Without this, Google OAuth bounces fail.

## 4. Smoke test the deploy

Hit each of these on the live URL:

| URL                     | Expected                                              |
|-------------------------|-------------------------------------------------------|
| `/`                     | Title screen with daily hero button                    |
| `/api/daily`            | JSON `{ date, seed, plays_count }`                     |
| `/api/og?run=anything`  | 1200×630 PNG (fallback card if `run` doesn't exist)    |
| `/run/<anything>`       | HTML with `<meta property="og:image">` pointing at /api/og |

Open the site in two browsers (or a private window), play a run in
each, and verify your second client sees the first's score on the
leaderboard within ~5s.

## 5. Custom domain

Vercel → Domains → add the apex + www. Update `PUBLIC_SITE_URL` env
var so canonical links and OG image URLs reflect the new host, then
redeploy (`vercel --prod` re-bakes the env vars into the build).

## 6. Brand

Before any external announcement, decide on a final brand name (see
"Brand options" in README) and replace **Pflug** in:

- `index.html` (title, meta tags)
- `vite.config.ts` (manifest `name` / `short_name` / `description`)
- `src/social/share-card.ts` (brand watermark, defaults to "Pflug")
- `api/og.ts` (heading text)
- README.md and the docs files

That's three find-and-replace passes; everything else inherits.

## Rollback

```sh
vercel rollback   # vercel keeps every prod deploy, instant rollback
supabase db reset --linked   # NUKES the database; only on a staging project
```

For schema rollbacks, write a follow-up migration rather than rolling
back files — migrations only flow forward in `supabase db push`.

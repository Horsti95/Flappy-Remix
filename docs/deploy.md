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
   supabase db push                     # applies every migration in order
   ```

   > **How many migrations there are is NOT fixed.** `supabase/migrations/`
   > is the source of truth — count the files rather than trusting a number
   > written in a doc. This line used to say "applies 0001 .. 0004", which was
   > stale by 30+ migrations and gave a badly wrong impression of the schema
   > state during a deploy.
   >
   > Several of the later migrations are **security** changes that the app now
   > depends on (function privileges, a unique replay-hash index, atomic
   > counter RPCs, column-level input privacy). Deploying the app code without
   > them leaves known holes open; applying them without the app code breaks
   > one feature. See
   > [`pre-deploy-checklist.md`](./pre-deploy-checklist.md) for the required
   > order.
   >
   > Migrations 0031+ are written for the **Supabase SQL Editor** (paste + Run)
   > rather than `db push`, because each one carries verification queries and
   > owner actions in comments. Either path works; the SQL Editor is what the
   > checklist assumes.

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

## Function regions (latency)

Every API route except the two OG renderers is **database-bound**: it makes a
series of sequential Supabase calls. Supabase Postgres is single-region, so
where the *function* runs decides how far each of those calls travels.

Running them at the edge was the worst case: a player in Sydney hitting an edge
node in Sydney, talking to Postgres in Frankfurt, paid a full inter-continental
round trip **per call**. `submit-run` makes ~10, so ~2-3s of pure network time
before any work happened.

They now run on regional Node, pinned next to the database:

```jsonc
// vercel.json
"regions": ["fra1"],                          // <- must match your Supabase region
"functions": {
  "api/og.ts":      { "runtime": "edge" },    // @vercel/og needs edge
  "api/og-meta.ts": { "runtime": "edge" }     // crawler-facing, no heavy DB work
}
```

**Set `regions` to your own Supabase region.** Check it in the Supabase
dashboard under Project Settings → General → Region, then map it to the nearest
Vercel region:

| Supabase region      | Vercel region |
| -------------------- | ------------- |
| `eu-central-1`       | `fra1`        |
| `eu-west-1`          | `dub1`        |
| `eu-west-2`          | `lhr1`        |
| `us-east-1`          | `iad1`        |
| `us-west-1`          | `sfo1`        |
| `ap-southeast-2`     | `syd1`        |

A mismatch here is silently expensive — everything still works, just slowly.

### Verify it took effect

After deploying, time a real submission from a device far from the region:

```bash
curl -o /dev/null -s -w 'total=%{time_total}s\n' \
  -X POST https://YOUR-APP/api/submit-run \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"seed":1,"score":0,"ticks":30,"inputs":[],"mode":"casual"}'
```

Measure p50 and p95 before and after, from the same device — the win is in the
function↔database leg, and the browser still has to reach the region, so don't
expect the end-to-end number to drop by the full amount.

### Note on the handler signature

These routes export a Web-standard `async function handler(req: Request):
Promise<Response>`, which Vercel's Node runtime supports directly — removing
`export const config = { runtime: "edge" }` was a config change, not a rewrite.
Smoke-test one write path (`/api/submit-run`) and one read path (`/api/daily`)
on the first deploy after this change.

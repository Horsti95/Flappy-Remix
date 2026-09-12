# Pre-deploy checklist

Ordered by consequence. Items 1–4 are **owner actions in the live Supabase
project / Vercel dashboard** — code alone cannot do them, and the deploy is not
safe until they are done.

## 1. Apply migrations 0031–0034

Paste each into the Supabase SQL Editor in order and Run:

| Migration | What it fixes |
| --- | --- |
| `0031_function_privilege_lockdown.sql` | **Critical.** Revokes client `EXECUTE` on every non-client function. Before this, any holder of the anon key could `POST /rest/v1/rpc/roll_season` and end the ranked season, or call `upsert_daily_seed` for a future date to pre-set that day's daily seed to one they had already practised. |
| `0032_runs_hash_unique.sql` | Makes `runs.inputs_hash` UNIQUE, so duplicate-replay detection is enforced by the database rather than a raceable application check. Reports and de-duplicates any existing collisions first. |
| `0033_atomic_counters.sql` | Atomic RPCs for profile totals/XP, ranked ELO, and promo-code uses. Removes the lost-update races. |
| `0034_friends_symmetry_and_hygiene.sql` | Symmetric friend removal, run-cosmetic ownership trigger, link-code purge, durable feedback rate limit. |
| `0035_account_durability.sql` | Stops `cleanup_stale_anonymous_users()` deleting an account that has content but a stale `total_games` counter. Adds `find_account_by_reference()` for support-side recovery. |
| `0036_run_inputs_privacy.sql` | Revokes client `SELECT` on `runs.inputs` (it allowed bulk-harvesting every player's per-tick tap trace) and serves the one legitimate ghost read through `best_run_ghost()`. |

Then run 0031's **step 5 verification query** — it must return zero rows.

Also run 0031's one-off default-privilege change (it is in the file, step 4):

```sql
alter default privileges in schema public revoke execute on functions from public;
```

Without it, the next function you add is world-executable all over again.

## 2. Rotate the burned promo codes

`PLAYTEST2025`, `FOUNDER` and `FRIENDSFAMILY` were committed in plaintext in
`0005_skin_codes.sql`, so they are in git history forever. `FRIENDSFAMILY` is
uncapped (`max_uses = null`) and grants the supporter badge.

```bash
node scripts/rotate-codes.mjs        # prints SQL; new codes go to stderr
```

Paste the SQL into the Supabase SQL Editor, then store the new codes in a
password manager. Do not commit them.

## 3. Set the function region

`vercel.json` pins serverless functions to `fra1`. **Change it if your Supabase
project is not in `eu-central-1`.** See [`deploy.md`](./deploy.md#function-regions-latency)
for the region mapping. A mismatch is silently slow, not broken.

## 4. Decide the banner

`VITE_BANNER_ENABLED` defaults to **on**. The default label is now a neutral
house message, so shipping as-is is safe — but set `VITE_BANNER_LABEL` to what
you actually want to say, or set `VITE_BANNER_ENABLED=false` to hide the slot.

If you are switching it to real Google ads, read the block comment in
`src/game/support.ts` first: it needs an ETHICS.md/PRIVACY.md rewrite, a
Google-certified consent CMP for EEA/UK traffic, and a CSP change. None of
those are optional.

## 4b. Enable an auth provider — the biggest remaining risk

**Every account is anonymous, and an anonymous account lives only in one
browser's `localStorage`.** Clearing site data, browser storage eviction, or a
new phone loses it permanently — there is no credential to sign back in with.

The UI to fix this now exists (Account → "Secure this account"), but it cannot
work until you enable at least one provider in Supabase:

- **Email** (most universal) — Authentication → Providers → Email, and
  configure SMTP under Project Settings → Auth. Without SMTP, magic links
  don't send.
- **Google / Discord** — enable in Supabase *and* set up OAuth credentials in
  that provider's console, with your Vercel URL as the redirect.

Until then the buttons surface Supabase's real error instead of failing
silently, but players still have no way to make an account durable. See
[`account-durability.md`](./account-durability.md) for the full scenario table.

## 5. Verify locally

```bash
npm run typecheck                 # clean
npm test                          # 252 tests
npm run build                     # precache should be ~1.2MB, not 6.4MB
./scripts/test-migrations.sh      # migrations + privilege + race assertions
```

`test-migrations.sh` spins up a throwaway Postgres, applies all 36 migrations,
and asserts the security, privacy and concurrency invariants (including that 40
parallel claims on a 5-use promo code consume exactly 5, and that the reaper
spares an account with a stale counter but real runs). It needs a local
`postgresql-16` install, and **now runs in CI** as a second job.

## 6. Smoke-test after deploying

The DB-bound routes moved from the edge runtime to regional Node. The handlers
use the Web `Request`/`Response` signature, which Vercel's Node runtime
supports unchanged — but verify rather than assume:

- `POST /api/submit-run` — a real run submits and the score appears
- `GET /api/daily` — today's seed loads
- `GET /run/:id` — a share link still renders its OG preview (this one is
  still on edge)
- Install the PWA on Android and confirm the status bar is **black**, not
  sky blue, and that no strip of menu shows above the game

## 7. Known gaps (accepted, not fixed)

- **Anonymous accounts depend on one browser's storage.** Fixed as far as code
  can (see 4b) — but until a provider is enabled, a storage wipe still loses an
  account permanently. This is the top remaining risk in the project.
- **One run's inputs are still exposed per named player** via
  `best_run_ghost()` — that is the "duel their best" feature working as
  intended. Bulk harvesting is closed (0036).
- **Device link codes share one refresh-token lineage.** When a second device
  redeems a code, the originating device's stored token is rotated away. It no
  longer silently becomes a new guest account (that was the account-loss bug),
  but it does have to re-link. Supabase exposes no admin "mint a session for
  user X" API for anonymous users, so this is inherent to the approach.
- **`submit-run` is still ~10 sequential round trips**, now intra-region. The
  races are fixed via atomic RPCs, but collapsing the whole write path into a
  single `submit_run_tx()` transaction would cut it to one. Worth doing before
  a public ranked launch.
- **No API-level integration tests.** `test-migrations.sh` covers SQL (and now
  runs in CI); the HTTP handlers are still only covered indirectly. The
  Playwright spec in `tests/e2e/` remains a scaffold.
- **`pflug.*` localStorage keys and `supabase/config.toml`'s `project_id`
  deliberately keep the old name** — see `README.md`. Renaming the keys would
  wipe every existing player's local save.

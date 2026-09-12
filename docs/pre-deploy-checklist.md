# Pre-deploy checklist

**Run this first — it checks most of the list for you:**

```bash
npm run preflight        # local config only
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_ANON_KEY=... npm run preflight
```

With credentials it queries your live project and verifies what actually
matters: that `submit_run_tx()` exists, that `anon` genuinely cannot reach
`roll_season()`, that `runs.inputs` and `challenges.inputs` are closed to
clients, that the committed promo codes are rotated, and whether a real auth
provider is enabled. It exits non-zero on anything blocking; warnings are
listed but do not fail it, because a beta may ship with known gaps.

The two items most worth checking that way are the two that fail **silently**
in production: an unapplied `0031` leaves the ranked season resettable by
anyone holding the publishable anon key, and an unapplied `0037` makes
`submit-run` stop persisting progress while still returning correct-looking
numbers to the client.

Ordered by consequence below. Items 1–4 are **owner actions in the live
Supabase project / Vercel dashboard** — code alone cannot do them, and the
deploy is not safe until they are done.

## 1. Apply the security migrations

**If the Supabase CLI is linked, use it — it owns the migration ledger:**

```bash
supabase db push --linked
npm run migrate:verify        # then prove the invariants actually hold
```

`db push` applies exactly what is missing and records it. `migrate:verify`
adds the 27 read-only checks that prove the effect, which `db push` does not do.

**If the CLI is not set up**, or you want apply-and-verify in one step:

Get the connection string from Supabase → your project → **Connect** →
*Connection string*. Take the **direct** connection on port **5432** — not the
transaction pooler on 6543, which cannot run some of this DDL.

```powershell
# PowerShell
$env:SUPABASE_DB_URL="postgresql://postgres:YOUR-PASSWORD@db.YOUR-REF.supabase.co:5432/postgres"
npm run migrate
```

```bash
# bash / zsh
export SUPABASE_DB_URL='postgresql://postgres:YOUR-PASSWORD@db.YOUR-REF.supabase.co:5432/postgres'
npm run migrate
```

If the password contains `@ : / ? # %`, URL-encode it (`@` → `%40`).

It applies 0031-0040, then runs 16 read-only checks that prove they took
effect — `anon` really cannot reach `roll_season()`, `service_role` really can
execute `submit_run_tx()`, `runs.inputs` and `challenges.inputs` really are
closed, scores really are still readable. Output ends in either
`✔ MIGRATIONS OK` or `✘ MIGRATIONS NOT OK` with the failing checks named.

Useful variants:

```bash
npm run migrate -- --dry-run    # list what would run, change nothing
npm run migrate:verify          # skip applying, just re-run the 16 checks
npm run migrate -- --from 1     # a brand-new EMPTY project (applies all 40)
```

Safe to re-run at any time: 0031+ are written to be idempotent, and each file
is sent as one query so Postgres applies it all-or-nothing. `--from` defaults
to 31 because 0001-0030 are **not** re-runnable (0001 does a bare
`create table`) and are already applied on any project where the app has ever
worked; the script refuses to continue if that baseline is missing and tells
you to use `--from 1`.

It also **reads and writes the CLI's migration ledger**
(`supabase_migrations.schema_migrations`): versions already recorded there are
skipped, and versions it applies are recorded, so `supabase db push` and this
script agree afterwards instead of each thinking the other's work is missing.
Pass `--force` to re-apply recorded versions anyway. If the ledger table is
absent it says so and applies anyway — it deliberately does **not** create that
table, because its shape belongs to the CLI and guessing it is how you break
`db push`.

Promo-code rotation is reported separately, under **STILL TO DO** — it is an
owner action, not a migration, because the new codes have to be secrets.

### Alternative: the SQL Editor

If you would rather paste it:

```bash
npm run migration:bundle      # writes migration-bundle.sql (gitignored)
```

One ordered file for the Supabase SQL Editor. Deliberately not wrapped in a
single transaction — a few statements (`ALTER DEFAULT PRIVILEGES`,
`CREATE INDEX`) behave differently inside one, and a half-applied bundle is
recoverable by re-running whereas a silently rolled-back one looks like
success. Verify afterwards with `npm run migrate:verify`.

Applying files individually also works — in order, no skips:

| Migration | What it fixes |
| --- | --- |
| `0031_function_privilege_lockdown.sql` | **Critical.** Revokes client `EXECUTE` on every non-client function. Before this, any holder of the anon key could `POST /rest/v1/rpc/roll_season` and end the ranked season, or call `upsert_daily_seed` for a future date to pre-set that day's daily seed to one they had already practised. |
| `0032_runs_hash_unique.sql` | Makes `runs.inputs_hash` UNIQUE, so duplicate-replay detection is enforced by the database rather than a raceable application check. Reports and de-duplicates any existing collisions first. |
| `0033_atomic_counters.sql` | Atomic RPCs for profile totals/XP, ranked ELO, and promo-code uses. Removes the lost-update races. |
| `0034_friends_symmetry_and_hygiene.sql` | Symmetric friend removal, run-cosmetic ownership trigger, link-code purge, durable feedback rate limit. |
| `0035_account_durability.sql` | Stops `cleanup_stale_anonymous_users()` deleting an account that has content but a stale `total_games` counter. Adds `find_account_by_reference()` for support-side recovery. |
| `0036_run_inputs_privacy.sql` | Revokes client `SELECT` on `runs.inputs` (it allowed bulk-harvesting every player's per-tick tap trace) and serves the one legitimate ghost read through `best_run_ghost()`. |
| `0037_service_role_grants.sql` | Makes the server's own `EXECUTE` explicit instead of relying on a Supabase default privilege. Without it, a missing default would make `submit-run` stop persisting progress **silently**. |
| `0038_challenge_inputs_privacy.sql` | Closes the same input-trace hole on `challenges`, which 0036 left open — it made 0036 a half-measure. |
| `0039_submit_run_tx.sql` | One transaction under a profile row lock for the whole run-submit write path. Fixes the last read-then-act race: the daily best-of-3 cap could be exceeded, and the PB bonus paid twice, by two concurrent submissions. |
| `0040_search_path_hardening.sql` | Moves this project's `SECURITY DEFINER` functions to `search_path = ''`. Hardening, not a live hole — no client role can create objects in `public`. |
| `0041_client_rpc_anon_lockdown.sql` | Fixes a gap in 0031: its allowlist branch only GRANTED and never revoked the PUBLIC default, so the 11 per-caller RPCs stayed executable by `anon`. Also repairs `friends_leaderboard()`, which had been raising "column reference user_id is ambiguous" for **every** caller since 0013, and sets `security_invoker` on the six leaderboard views. |
| `0042_search_path_remaining.sql` | Pins `search_path` on the last two unpinned functions (`current_season`, `gen_challenge_short_id`). Low severity — both are SECURITY INVOKER, so there is no escalation — but it clears Supabase's remaining advisor warnings. 0040 missed them because its check filtered on `SECURITY DEFINER`. |
| `0043_disable_burned_promo_codes.sql` | Disables all **six** promo codes that were committed as literals (0005, 0006, 0028 — including `THANKYOU`, which grants the supporter badge). Rows are kept, not deleted: `skin_code_redemptions` references them `ON DELETE CASCADE`, so deleting would wipe players' redemption history and let them redeem again. |

Then run 0031's **step 5 verification query** — it must return zero rows.

Also run 0031's one-off default-privilege change (it is in the file, step 4):

```sql
alter default privileges in schema public revoke execute on functions from public;
```

Without it, the next function you add is world-executable all over again.

## 2. Promo codes — handled by migration 0043

**No longer a blocker.** Six codes were committed as literals across `0005`,
`0006` and `0028`:

| Code | Why it mattered |
| --- | --- |
| `FRIENDSFAMILY` | `max_uses = null` — unlimited |
| `THANKYOU` | grants the **supporter badge** (an entitlement, not a cosmetic) |
| `PLAYTEST2025`, `FOUNDER`, `LENNART2`, `ISA_S2` | legendary/epic skins, `ISA_S2` also a shape |

Migration `0043` disables all six. That needs no secret, so it lives in the
repo and `npm run migrate` applies it — which is why this stopped being
something you owe.

Players who already redeemed keep their skin and badge; only new redemptions
are refused. The rows are **not** deleted, because
`skin_code_redemptions.code` references them `ON DELETE CASCADE` — deleting one
would wipe the redemption history of everyone who used it and let them redeem
again once the `(user_id, code)` primary key vanished with it.

**To hand out codes later** (optional, whenever you want to):

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
npm test                          # all green (count grows; don't pin it)
npm run build                     # precache should be ~1.2MB, not 6.4MB
npm run test:migrations           # migrations + privilege + race assertions
npm run preflight                 # deploy config + live-project checks

# and, against a running preview, that the app actually BOOTS:
npm run build && npm run preview &
npm i -D --no-save playwright-core && npm run smoke
```

`npm run smoke` is the only check that opens a browser. Nothing else verifies
the thing a tester notices first — that the app starts at all. A bundling
mistake or a top-level throw passes typecheck, tests and build, then shows a
black screen. It also proves the crash reporter appears, because a crash screen
that silently doesn't work is worse than none: you believe you have reporting
and you don't.

`test-migrations.sh` spins up a throwaway Postgres, applies every migration,
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
- **`submit-run` makes ~13 round trips**, down from 18 and all intra-region.
  The write path (duplicate check, daily cap, PB, insert, counters, daily seed)
  is now a single transaction (0039). What remains sequential is the ranked
  settlement (already guarded by optimistic versioning), the challenge update,
  and skin/level minting — each needs a JS generator or a compensating delete,
  so they were deliberately left outside the lock to keep the transaction
  short.
- **No API-level integration tests.** `test-migrations.sh` covers SQL (and now
  runs in CI); the HTTP handlers are still only covered indirectly. The
  Playwright spec in `tests/e2e/` remains a scaffold.
- **`pflug.*` localStorage keys and `supabase/config.toml`'s `project_id`
  deliberately keep the old name** — see `README.md`. Renaming the keys would
  wipe every existing player's local save.

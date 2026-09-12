# Account durability — what survives what

Answering directly: **can an account be overwritten or deleted while someone is
away, so their progress is gone when they come back?**

Before this release: **yes, easily, and it was the most likely bug in the app.**
After it: the transient causes are fixed, one structural cause remains, and it
now has a real remedy.

## The core fact

Every player starts as a **Supabase anonymous account**
(`enable_anonymous_sign_ins = true`). An anonymous account has no password, no
email, no credential of any kind. The only proof that a device owns it is a
refresh token in that browser's `localStorage`, under
`sb-<project-ref>-auth-token`.

So the account is not really "on the server" from the player's point of view.
It is reachable *only* through one browser storage entry on one device. The
server row is safe; the ability to reach it is what's fragile.

## Scenario table

| What happens | Account row | Reachable after? | Why |
| --- | --- | --- | --- |
| Doesn't play for months, storage intact | safe | ✅ yes | Refresh tokens don't expire on their own. Comes back fine. |
| Supabase project **paused** (free tier pauses after ~7 days idle) | safe | ✅ yes, once resumed | All requests fail while paused → `sessionLost` → retry screen. **Previously: replaced by a new guest account.** |
| Supabase transient 5xx / maintenance / offline | safe | ✅ yes | Same path — retry, no replacement. |
| Player offline, access token expired | safe | ✅ yes | Retries on `online` and tab focus. |
| **Site data cleared** (browser settings, "clear cookies", cleaner app) | safe | ❌ **no** | Token gone and no credential exists to re-prove ownership. |
| **Browser evicts storage** (iOS Safari caps script-writable storage for sites without recent interaction; Android Chrome evicts under pressure) | safe | ❌ **no** | Same as above, and the player did nothing wrong. |
| New phone / reinstall / different browser | safe | ❌ **no** | Nothing to carry the identity across. |
| Private / incognito window | n/a | ❌ no | By design — storage is discarded. |
| Device link code redeemed on a second device | safe | ⚠️ first device must re-link | Redeeming rotates the refresh token, killing the origin device's copy. **Previously: the origin device silently became a new guest.** |
| `cleanup_stale_anonymous_users()` runs | **deleted** | ❌ no | Only if >30 days old AND owns zero content — see below. |
| Supabase project deleted after a long pause | **deleted** | ❌ no | Platform-level. Check your dashboard's pause/retention notices; keep backups (`npm run backup`). |

The middle block is the honest remaining hole: **losing `localStorage` loses an
anonymous account, permanently.** No code change can prevent that, because
there is nothing else to prove ownership with.

Note the limit of the fix in `src/social/auth.ts`: the "this device had an
account" marker lives in `localStorage` too. That is deliberate — it reliably
separates *transient sign-in failure* (marker present, session missing → retry)
from *a genuinely new device* (neither → new account). But when storage is
wiped, both vanish together and the device is indistinguishable from a first
visit. That case is addressed by giving the account a real credential, not by
more client-side bookkeeping.

## What changed

**1. A failed sign-in no longer replaces the account.** `initAuth()` discarded
the error from `getSession()` and called `signInAnonymously()` whenever no
session came back — minting a new `user_id` and overwriting the stored token,
so any hiccup orphaned the real account. It now distinguishes the two cases and
shows a retry instead. This is what fixes every "Supabase was down / paused /
flaky" row above.

**2. Players can finally secure an account.** `signInWithEmail`,
`signInWithGoogle` and `signInWithDiscord` existed in `social/auth.ts` from the
start but **were not wired to any UI** — so in practice no player could ever
become non-anonymous. The account panel now has a "Secure this account"
section, and `src/ui/secure-account-nudge.ts` prompts anonymous players once
they have real progress (25+ games, escalating, dismissible — about six prompts
across 800 games).

⚠️ **This needs setup on your side to actually work.** Email needs SMTP
configured in Supabase; Google/Discord need the provider enabled in Supabase
*and* set up in that provider's developer console. Until then the buttons
surface Supabase's real error rather than failing silently — but players still
have no way to secure an account. **Enabling at least one provider is the single
highest-value thing you can do for account durability.**

**3. The reaper can't eat a real account.** `cleanup_stale_anonymous_users()`
decided "empty" from `profiles.total_games` alone — the one field most likely to
be wrong (non-atomic until 0033, and `submit-run` inserts the run before
bumping the profile, with the bump non-fatal on failure). A player with runs but
a stale `0` counter could be deleted, cascading their runs, skins and ratings.
It now also requires that the account owns no rows in `runs`, `skins`,
`friendships`, `elo_ratings`, `skin_code_redemptions`, `challenges` or
`ranked_matches`. Counters are a hint; rows are the truth. Verified by test.

It is still **not scheduled** by any migration, on purpose. Dry-run it before
you ever put it on a cron.

**4. Lost accounts are now identifiable.** The account panel shows a short
**recovery reference** (first 8 characters of the `user_id`, labelled `ref`).
If someone loses access, that string lets you find the account:

```sql
select * from public.find_account_by_reference('3f9ab2c1');
```

It returns profile, counts and timestamps — no tokens, and it grants no access.
To actually hand the account back you must attach a credential to it (set an
email on that `user_id` via the admin API, then send a magic link). That
requires email auth to be enabled, which is reason 2 again.

## If a player has already lost an account

Their data was never deleted. Find it by:

- the recovery reference, if they have it (`find_account_by_reference`)
- their username, if they claimed one: `select * from public.profiles where username = '...'`
- otherwise, `created_at` plus `total_games` / `streak_days` narrowed by what
  they remember:

```sql
select p.user_id, p.username, p.total_games, p.streak_days, p.created_at, p.last_play_at
  from public.profiles p
  join auth.users u on u.id = p.user_id
 where u.is_anonymous = true
   and p.total_games > 0
 order by p.last_play_at desc nulls last
 limit 50;
```

Then attach an email to that `user_id` and send them a magic link. Do **not**
try to transplant progress between accounts — re-pointing the credential at the
existing row keeps runs, skins, streak and ranked history intact.

## Recommended, in order

1. **Enable one auth provider** (email via SMTP is the most universal). Without
   it, item 2 above is a button that can't succeed, and every account stays one
   storage wipe from gone.
2. Leave `cleanup_stale_anonymous_users()` unscheduled until you've dry-run it.
3. Schedule `npm run backup` — it covers the project-deletion row, which
   nothing in the app can.
4. Keep an eye on the free-tier pause. Pausing itself is now harmless to
   accounts, but a long pause is a platform-level risk to the whole project.

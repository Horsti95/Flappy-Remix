# Testing this branch on a Vercel preview

Branch: `claude/compassionate-archimedes-6n0uwm`. **Do not merge yet.**

## ⚠️ First, the thing that can bite you

**A Vercel preview deploy talks to the same Supabase project as production.**
Vercel gives you an isolated *frontend* per branch; it does not give you an
isolated *database*. So the moment you apply these migrations to test the
preview, **production is running against the new schema too** — while
production's code is still the old `main` build.

Almost all of the migrations are safe in that situation. **One is not:**

| Migration | Safe to apply before merging `main`? |
| --- | --- |
| `0031` privilege lockdown | ✅ Yes — nothing in the client calls the revoked functions. |
| `0032` unique replay hash | ✅ Yes — the old duplicate pre-check still runs first. |
| `0033` atomic counters | ✅ Yes — adds functions; old code simply doesn't call them. |
| `0034` friends / hygiene | ✅ Yes — old one-sided removal still works (RLS permits your own row). |
| `0035` account durability | ✅ Yes — narrows a reaper, adds a lookup. |
| `0036` run-inputs privacy | ⚠️ **No — apply this one AFTER merging.** |

`0036` revokes client `SELECT` on `runs.inputs`. The old `main` code reads that
column directly for "duel a player's best run"
(`src/social/challenges.ts`). With `0036` applied and old code live, that one
feature stops working — it fails soft (three retries, then "couldn't load
challenge"), so nothing crashes and no data is at risk, but it is broken until
the new code ships.

**Recommended order:**

1. Apply `0031`–`0035` now. Test the preview.
2. Merge to `main`, let production deploy.
3. Apply `0036`.
4. Re-test "duel a player's best run" on production.

If you would rather test everything at once, point the preview at a **separate
Supabase project** (Vercel → Settings → Environment Variables, set the
`SUPABASE_*` / `VITE_SUPABASE_*` values for the *Preview* environment only)
and apply all of them there. That is the clean way, and it is also how you'd test
`cleanup_stale_anonymous_users()` without risk.

## Setup

**Environment variables — set them for the Preview environment**, not just
Production. A preview with missing Supabase vars boots in offline mode and none
of the account work is testable:

```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY     # browser
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY       # server
PUBLIC_SITE_URL                               # the preview URL, for OG images
```

**Supabase redirect URLs.** The account-securing flow uses
`redirectTo: window.location.origin`, which on a preview is the preview
hostname. Add the Vercel preview wildcard under Authentication → URL
Configuration, or email/OAuth links will bounce:

```
https://*-<your-vercel-scope>.vercel.app/**
```

**Region.** `vercel.json` pins functions to `fra1`. If your Supabase project
isn't in `eu-central-1`, change it first — see
[`deploy.md`](./deploy.md#function-regions-latency).

## What to look out for

Highest risk first. The first three are things I changed but could not verify
from here.

### 1. The runtime change (highest risk)

Twelve API routes moved from the edge runtime to regional Node. They use the Web
`Request`/`Response` signature, which Vercel's Node runtime supports — but this
is the change most likely to surprise on a real deploy.

- Finish a run → score saves, appears on the leaderboard (`/api/submit-run`)
- Open the daily → seed loads (`/api/daily`)
- Create and accept a challenge (`/api/challenge-create`, `/api/challenge`)
- Redeem a promo code (`/api/redeem-code`)
- Open a share link `/run/:id` → OG preview renders (**still edge** — if this
  one breaks, it's unrelated to the runtime change)

A 500 on any of these with a `FUNCTION_INVOCATION_FAILED` in the Vercel logs is
the signature of a runtime mismatch. Check the function logs, not just the UI.

### 2. Installed-PWA look (Android)

Must be tested **installed**, not in a browser tab — the bug only appeared in
standalone mode:

- Install to home screen, open it
- Status bar is **black**, not sky blue
- No strip of menu-blue above the game
- Nothing hidden under the status bar / notch

If you still see blue: the old service worker is serving a cached manifest.
Uninstall, clear site data, reinstall.

### 3. The banner no longer moves the stage

- Joke placeholder shows on the menu, dashed "fake ad slot" styling intact
- **Start a run and watch the top edge**: the banner hides, but the play area
  must not jump or resize. Previously it shifted 36px and reallocated the
  canvas on every run start and menu return.
- Return to menu — banner reappears, again with no shift

### 4. Account durability (the new work)

- Account panel → **"Secure this account"** section is visible while anonymous
- Enter an email → expect either "Check your email" or a clear error. **An
  error here is expected until you enable email auth + SMTP in Supabase** —
  that's the point of the message, not a bug in the branch.
- Google / Discord buttons → either redirect, or say it isn't enabled yet
- Account → Progress shows a `ref` value (your recovery reference)
- The **back-up nudge** appears in the menu at 25+ games. To see it without
  playing 25 runs, in devtools:
  ```js
  localStorage.removeItem("pflug.secureNudge.v1")
  ```
  then reload with an account that has 25+ games. Dismiss it → it should not
  return until ~50 games.

To test the **session-lost** screen (the account-loss fix) without breaking
anything, in devtools on the preview:

```js
// Corrupt only the Supabase session, leaving the account marker intact —
// exactly what a failed refresh looks like.
Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  .forEach(k => localStorage.setItem(k, 'broken'));
location.reload();
```

You should get **"Couldn't reach your account"** with a Retry — **not** a fresh
guest account with zero games. That is the whole fix. Then clear site data
entirely and reload: you *should* get a new account, because that device now
genuinely has nothing.

### 5. Friend removal is two-sided

Needs two accounts (two browsers, or one incognito):

- Befriend A ↔ B
- Remove from A's side
- **Check B's friends list** — A must be gone there too. Previously B still had
  A and could still challenge them.

### 6. Duel a player's best run

This is the `0036` path. If you applied `0036`, this only works on the **new**
code — so test it on the preview, and expect it to be broken on production
until you merge:

- Open a player's profile → duel their best run → the ghost replays

### 7. First load size

- DevTools → Network → hard reload (empty cache)
- Total transferred should be roughly **1.2 MB**, not 6.4 MB
- All three previously-PNG backgrounds (fairy-spires, neo-city, stadium) still
  render correctly as webp — check a theme that uses each

## Quick regression sweep

Nothing here should have changed, but they sit next to code that did:

- Leaderboards load (all periods / modes) — `0036` touched `runs` privileges
- A profile page loads with stats
- Ranked: queue, challenge a friend, play a round
- Promo code redemption still grants a skin **and** its badge
- Settings, gallery, quests, inbox all open
- Offline: turn off the network mid-run, finish it, come back online → the
  queued run submits

## If something's wrong

Vercel → the preview deployment → **Runtime Logs** shows the server side; the
`console.error` calls I added are deliberately loud (`[submit-run]`, `[auth]`,
`[feedback]`, `[link-code]`, `[me-delete]`). Most of the new failure paths log
rather than fail silently, so the logs should name the problem.

Nothing in this branch is destructive to player data, with one exception worth
knowing: `0032` nulls the `inputs_hash` of **duplicate** runs before adding the
unique index (scores are kept, only the hash is cleared). It reports the count
first, and on a healthy database it finds none.

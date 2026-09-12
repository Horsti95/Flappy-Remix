# Testing this branch on a Vercel preview

Branch: `claude/compassionate-archimedes-6n0uwm`. **Merged into `main` in v0.25.0** —
kept because the checks below are still the right ones to run against a preview,
and because the next branch will want them.

## ⚠️ Read this first — the migrations are ALREADY applied

**A Vercel preview deploy talks to the same Supabase project as production.**
Vercel gives you an isolated *frontend* per branch; it does not give you an
isolated *database*. And `0031`–`0044` have all been applied to that shared
project already (the Supabase ledger is at `0044`).

So production — still serving the old `main` build — is running against the new
schema right now. Almost everything is fine there by design: the migrations add
functions old code doesn't call, and narrow privileges old code doesn't use.

**One thing is genuinely broken on production until you merge:**

> **"Duel a player's best run" does not work on production.** `0036` revoked
> client `SELECT` on `runs.inputs`, and `main`'s `src/social/challenges.ts`
> still reads that column directly. It fails soft — three retries, then
> "couldn't load challenge" — so nothing crashes and no data is at risk. The
> new code on this branch reads the same data through `best_run_ghost()`
> instead, so it works on the preview and will work on production the moment
> this branch ships.

That is the only user-visible regression from the current split, and merging is
what fixes it. Everything else in the list below is testable on the preview as-is.

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

**Region.** `vercel.json` pins functions to `lhr1`, which is the closest Vercel
region to a Supabase project in `eu-west-2`. This only takes effect once the
branch is deployed — see
[`deploy.md`](./deploy.md#function-regions-latency).

## What to look out for

Highest risk first. The first three are things I changed but could not verify
from here.

### 1. The runtime change (highest risk — it DID break, v0.25.1 fixes it)

Twelve API routes moved from the edge runtime to regional Node. The first
attempt kept `export default async function handler(req: Request)`, which the
edge runtime accepts and the **Node runtime does not**: a default-exported
function is taken for the legacy `(req, res)` signature and handed an
`IncomingMessage`, so `req.headers.get()` threw and every one of the twelve
routes answered 500. Symptom in the game: runs wouldn't save and the menu showed
"N queued". Node reaches a Web handler through `export default { fetch: handler }`,
which is what these files export now.

Nothing here type-checks or builds differently, so re-test the list below on any
future runtime change:

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

This is the `0036` path, and `0036` is applied — so this works on the **new**
code only. Test it on the preview; it is broken on production until you merge
(see the warning at the top):

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
first, and on a healthy database it finds none. It has already run.

## After you merge

Re-check the one thing the split was hiding: open a player's profile on
production and **duel their best run**. That is the feature `0036` took away
from the old code, and the merge is what gives it back.

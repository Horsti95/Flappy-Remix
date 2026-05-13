# Privacy

Plain-English summary of what Pflug stores, what it doesn't, and how to
get either back.

## What we store

Everything is keyed to a Supabase auth user id (a UUID). When you first
load the page we create that account anonymously, no email needed.

| Table                   | Rows about you                                                       |
|-------------------------|----------------------------------------------------------------------|
| `auth.users`            | UUID + (only if you sign in with Google) email + Google sub          |
| `profiles`              | username, friend code, total games, streak counters, equipped skin   |
| `skins`                 | RGB pairs you've unlocked + the rarity tier the server assigned      |
| `runs`                  | seed, score, tick count, full input trace (jsonb), mode, timestamps  |
| `daily_seeds`           | date + seed + plays count (per-date, not per-user)                   |
| `friendships`           | (you, friend) and (friend, you) rows when both sides accept          |
| `challenges`            | seeds + input traces + scores + which two users participated         |
| `ranked_matches`        | seeds + per-round scores + which two users participated              |
| `matchmaking_queue`     | your rating + a join timestamp while you're searching                |
| `elo_ratings`           | rating per season                                                    |
| `elo_season_snapshots`  | end-of-season placement (kept forever for top-100 badges)            |

## What we don't store

- IP addresses, beyond what Supabase / Vercel keep in their access logs
  for transient operational reasons (we don't read them and we don't ship
  them anywhere).
- Phone numbers. We never ask.
- Contact lists. There is no import, no scraping, no permission ask.
- Marketing identifiers. No Google Analytics, no Meta pixels, no
  third-party trackers.
- Ad SDK data. There are no ads in v1.
- Your real name. Even Google sign-in only stores the email + sub the
  OAuth provider gives us; we never display your real name.

## Cookies / local storage

We use `localStorage` for:

- Sound on/off, high-contrast on/off, reduced-motion on/off
- Your equipped skin id (so offline play still picks the right skin)
- Pending run submissions if you played without a network

Supabase auth uses cookies / localStorage to keep you signed in. There
are no advertising cookies and no analytics cookies.

## OAuth

If you sign in with Google, Supabase exchanges an OAuth code for an
identity. We receive your email and a Google subject id and store both
on `auth.users`. The id token itself is not retained.

## Export

In **account → export my data** you can download a single JSON file
with every row keyed to your account, including raw input traces. This
calls `GET /api/me-export`. The endpoint uses your authenticated session
and validates the token server-side.

## Delete

In **account → delete account** you'll be asked to type
`delete me forever` to confirm. This calls `POST /api/me-delete`, which:

1. Removes you from the matchmaking queue
2. Deletes your ELO ratings and end-of-season snapshots (you lose any
   top-100 badges)
3. Deletes the underlying `auth.users` row, which cascades to your
   profile, skins, runs, friendships, and any challenges or ranked
   matches you took part in

The cascade is permanent. There is no soft-delete and no recovery.

## Data sharing

Run scores and your skin appear on public leaderboards under your
username. Friends see your full match history when they look at
ranked or challenge surfaces with you in them. Nobody else gets
anything.

We do not sell your data and we do not share it with third parties
beyond the cloud vendors we use to run the service (Supabase for the
database/auth, Vercel for the static deploy and edge functions).

## Children

Pflug is rated for general audiences. We do not knowingly collect
data from children under 13 / 16 (depending on your jurisdiction).
If you're a parent and want a child's account removed, use the
delete flow above or email the contact in the README.

## Contact

Open an issue at the repository URL in the README, or use the contact
listed there.

# Ethics

The decisions we made deliberately, and the things we chose not to
build, written down so they don't drift.

## What we don't do

- **No ads.** No banners, no interstitials, no rewarded video.
- **No microtransactions.** The skin economy is the entire reward
  loop and it's earned by playing.
- **No gacha or loot boxes.** Skin rarity is a function of the colors
  the server happens to roll. There is nothing to spend money on.
- **No push notifications in v1.** Web push is great for utility apps
  and miserable for arcade games. We didn't ship it.
- **No fake notifications.** No "your friend just beat your score!"
  pings unless your friend actually just beat your score (and even
  then, not in v1 — we don't have any push channel).
- **No streak-loss anxiety.** There is no countdown timer, no "your
  streak resets in 4 hours!" warning, no win-back email.
- **No phone number import.** No SMS verification. No contact list
  permission ask.
- **No analytics, no trackers.** Plausible (self-hosted) may land in
  v2 if we genuinely need to debug a UX issue. Until then, nothing.
- **No real-name policy.** Display name is a username you pick.
  Google OAuth gives us an email; we never show it.
- **No dark-pattern unsubscribe.** There is one delete button and
  it does what it says.

## What we do

- **Anonymous play first.** You can play, compete on leaderboards in a
  limited way, and never give us anything beyond a UUID.
- **Optional Google sign-in** to keep your run history across devices.
  That's the only thing it gives you.
- **Username profanity filter** is a curated English wordlist applied
  client-side and re-checked at the database via a CHECK constraint.
  It's small. It will miss things. The plan is to iterate based on
  reports rather than block half the alphabet.
- **One streak rule** that's the same for everyone: every calendar day
  you play counts as +1; first daily of a day counts as +2; missing a
  day resets you. Documented in the README.
- **Server-side replay validation** on every run, not just suspicious
  ones. The validator runs the same sim the client does, on the same
  inputs, and only accepts the run if it produces the same score
  byte-for-byte. Cheaters get rejected silently — we don't reveal the
  rules.
- **No bans in v1.** Rejected runs simply don't post. If we have to add
  bans later we'll document the appeal flow before we add the button.
- **Friendly defaults.** Sound off by default. Reduced motion respected.
  High contrast available.
- **Open formats for export.** The GDPR export is a JSON file you can
  read in any text editor.

## Why we built ranked the way we did

- **24-hour round timer.** Long enough that you can play after work and
  on weekends. Short enough that a stale opponent doesn't lock your
  match for a week.
- **Best of three.** A single round is too coin-flippy on a chaotic
  procedurally-generated level; five rounds drags. Three is the right
  shape.
- **Soft season reset (75% pull toward 1200).** Repeating the same
  ladder grind every month exhausts people. Soft-resetting compresses
  the field so early-season climbing matters again, but veterans don't
  start from scratch.
- **Top-100 badge stays forever.** Competitive players want their wins
  to mean something. Snapshotting end-of-season placements solves
  that without making the live ladder lopsided.

## What's deferred

These are real product gaps, not philosophical objections. We just ran
out of milestone in v1 and chose to ship the rest.

- **Crews / clans.** Group identity is a great surface but it adds a
  whole governance dimension (admin roles, bans, name policies) that
  needs more thought.
- **Replay watching for top global runs.** We have all the data; the
  player just needs a viewer. Probably v2.1.
- **Live synchronous VS over WebSocket.** Async ghost mode covers most
  of the social pull. Sync adds latency complexity that we don't need
  to ship to test the core loop.
- **Native iOS/Android wrappers.** The PWA installs fine on both
  platforms today. Capacitor is on the table the moment store presence
  matters.

## When we change our minds

If we decide to add ads, ranked microtransactions, push notifications,
or any analytics that aren't self-hosted privacy-respecting, this file
gets updated *before* the code lands. If you're reading this and the
behavior doesn't match, that's a bug — open an issue.

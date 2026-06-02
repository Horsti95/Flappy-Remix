# #2 — Friends, duels, and a daily twist

*Vibe-coding a Flappy game, post 2.*

A score in a vacuum is lonely, so this stretch was all about other people and
reasons to come back.

**Daily challenge** got a personality: every UTC day hashes to a difficulty
tier plus 1–2 modifiers (wider/tighter gaps, heavy/floaty gravity, faster
scroll, mirror, upside-down…). Then **best-of-3** — you get three attempts a
day and your best counts, so one bad RNG start doesn't sink your day. A
pre-game screen shows the day's twist and your attempts left.

**Friends + challenges**: add people by handle, fire off a ghost duel (they
replay your run on your seed and try to beat it), and — the fun part — the
ghost now flies *your* shape and paints *your* sky, so you flex your setup.
Friend duels can also be **ranked** best-of-3 that move your ELO.

**Leaderboards** became a proper matrix: global vs friends × today/week/month/
all-time, each showing your *best* run per period (no more one player hogging
ten rows).

The throughline: every social feature rides the deterministic core, so a
"score" you see is a score you can trust.

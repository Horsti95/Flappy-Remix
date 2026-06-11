# #5 — The studio review (identity, rewards, and the plan)

*Vibe-coding a Flappy game, post 5 — 2026-06-10.*

A full internal review of the game (design + code), followed by a long
decision session. Everything agreed is captured here and sequenced in
[`ROADMAP.md`](../ROADMAP.md). `IDEAS.md` stays the idea inbox.

## The headline findings

- The game is a **Trackmania-style integrity core wearing a Flappy
  costume** — deterministic sim, replay validation, ghost duels, shared
  dailies. That's the identity; it just isn't *visible* yet.
- The emotional layer lags the systems layer: rewards are mostly flat
  color swaps, nothing accumulates per run, players never *choose*
  anything, and the content set reads as a grab bag (soccer ball next to
  origami crane).
- The viral loop (challenge links) is currently broken by two bugs
  (service-worker swallows `/run/:id`; daily-twist ghosts replay under
  wrong physics). Security holes (profile forging, replay theft) must be
  fixed before champion rewards or any monetization.

## Decisions locked (2026-06-10)

- **Name: Glide** (domain glide.uno). **Fallback: "Paper Sky"** as the
  game name if the paper artwork direction fully lands — decide at the
  rebrand moment, not before.
- **Art direction: Paper Sky** — paper/origami/wind. Crumple-and-flutter
  death, paper-chip buttons, handwritten accents, flight-journal UI.
  Off-vibe shapes (pixel-bird, soccer ball, pretzel, submarine, ghost…)
  move to a labeled novelty class: **"Contraband — things that have no
  business flying."**
- **Tagline** on the daily screen: *"Everyone flies the same wind
  today."*
- **Backgrounds readability rule**: nothing busy in the flight corridor;
  the plane silhouette must always separate. The skyline/building
  backgrounds are placeholders to be replaced. HD backdrops allowed only
  if muted in the corridor band. Character/pillar art is authored
  **grayscale and tinted**; backgrounds are the only fixed-color art.
- **Country packs = origami national animals** (DE eagle, BR macaw, FR
  rooster, JP crane…) + national-color livery + flag profile badge.
  Generated via AI prompts (`design/prompts-paper-sky.md`) — this stays
  a vibe-coding project, no manual art tools.
- **Determinism per mode** (confirmed working as designed): casual =
  fresh random seed every run; daily = one shared seed per UTC date;
  ranked = 3 random seeds per match, same for both players, each round
  different.
- **No full DB reset.** Existing playtester data is kept; instead a
  *consolidation* pass: the Phase-0 security migrations bring policies
  to a coherent state, plus (optional, later) a squashed schema file
  for fresh installs. Destructive "clean" migrations only if we ever
  truly wipe for launch — explicit decision then.
- **Speed ramp gets capped** (rhythm > chaos; also prevents the
  eventual collision-tunneling bug). Difficulty variety comes from
  dailies/arcade, not a faster base game. Must change client + server
  sim copies together.
- **Pilot XP**: flat (XP ≈ score + activity bonuses), **no escalating
  per-gate XP**; one-time in-run milestone bonuses at gates 50 / 100 /
  250. Levels measure dedication; score ladders already pay skill.
- **PB ghost** is *earned* at score 30 ("you can now race your own
  ghost"), settings toggle, off for new players.
- **Daily stays 3 attempts; no 20-minute playtime lock.** Optional
  wellbeing reminder setting instead. The daily landing screen *becomes*
  the aftermath/results screen once attempts are spent (no new button).
- **Monthly ladder = sum of your best result per day** (rewards showing
  up daily, not grinding attempts). Top 10 monthly get a **hidden**
  mythic-with-provenance gift. Champion pyramid: daily top-1 crown for
  a day → weekly **Paper Crown** (held & defended; permanent "crowned
  week N" memento) → monthly top-10 hidden mythic.
- **Daily champion skins**: minted server-side for yesterday's top
  daily players, granted lazily at day close. Fine to be generous while
  the playerbase is friends-and-family.
- **Mint choice**: milestone skins become *pick 1 of 3 generated*
  liveries (the other two gone forever), generative names, reveal
  moment. Generated within curated color constraints — the generator is
  the signature.
- **Secret unlock class** exists (6-7 and friends). Deliberately
  undocumented — no breadcrumbs, no list in docs; discovery and
  word-of-mouth are the feature. (Spoilers live only in the code.)
- **More unlock criteria than items is fine** — new criterion types
  (elo upsets like losing to someone −100 below you / beating +100
  above, precision passes, time-of-day, daily-tier clears) get drafted
  even before rewards are bound to them.
- **Leaderboards show the run's snapshot** — shape + skin colors + mode
  *as flown*, not current equips.
- **Push notifications**: (1) "new daily" ~10–11:00 local default,
  configurable; (2) "streak at risk" 3 h before UTC reset, only if
  streak ≥ 3 and unplayed. Max 1–2/day; permission asked only after the
  second completed daily.
- **Feedback → GitHub**: `/api/feedback` opens an issue via a
  fine-grained token (owner wires the token); modal in-app; reviewer
  badge becomes server-granted on first real submission.
- **Monetization opens up** (ETHICS.md to be amended first): cosmetic
  packs (country/event, 2–4 €), Founder pack, later cosmetic season
  track. Stripe payment link on web feeding the existing
  redeem/grant infra; platform IAP only when app-packaged. No
  pay-to-win, everything meaningful earnable. Hard-blocked by the
  Phase-0 security fixes. The 100k€ banner joke stays for the
  friends-and-family era; env-gate off at public launch.
- **App packaging (later)**: Android = TWA via Bubblewrap (lightweight,
  the PWA *is* the app); iOS = Capacitor wrapper. See
  `docs/packaging-notes.md`. Apple sign-in becomes mandatory the day an
  iOS app offers other social logins.
- **Cross-device**: keep Supabase accounts as durable identity; add a
  **one-time short-lived transfer code** (~15 min validity, rate
  limited) to link a new device — a bridge, not a credential. Passkeys
  worth evaluating later.
- **Onboarding v2**: show-don't-tell. ≤5 words per card, interactive
  micro-steps (tap → hop → gate appears), persistent PRACTICE
  watermark, always-visible skip, "that was practice — ready?" end.
- **Menu crowding concern** (open design question): before adding more
  panels, explore the **flight-journal hub** redesign — one journal
  surface with tabs/pages (Fly / Daily / Hangar / Journal / Social)
  instead of ever more buttons. Aftermath, monthly ladder, and champions
  live *inside* existing surfaces (daily landing, profile, leaderboard
  trophy tab) — not as new menu entries.
- **Monthly-ladder UI** (open design question): don't add a 4th filter
  row to the leaderboard. Proposal: a **Champions/trophy tab** on the
  leaderboard panel (crown holder, monthly race top-10, past months) —
  prestige surface, separate from the score matrix.

## Idea inventory (so nothing is lost)

- **Evolving Plane** (signature candidate): equipped plane accumulates
  stickers/decals from milestones; full detail on the large
  profile/gallery portrait, only foil-edge/glow cues in flight.
- **Trails** (new cosmetic class, most visible flex): paper streamer,
  contrail, petal drift, ink stroke, confetti snips, origami cranes,
  ember fold, bubble stream, star dust, golden foil, glitch (secret),
  rainbow ribbon (June). Ring-buffer polyline, render-only.
- **Gate-pass FX** class: spark, paper-burst, confetti, drag-race
  firework every 10th gate.
- **Gate sound pitch setting** (unlockable ~score 50): pitch follows
  gap height; default stays uniform (rhythm anchor).
- **Other cosmetic classes**: death FX variants, score-counter skins,
  journal covers, titles, ghost styles, victory stamps (duel win),
  ambient music tracks.
- **Ascent mastery**: theme unlocks at score 100; each of its 9 stage
  backdrops becomes individually equippable when you reach that stage
  on ascent. Generalize to ocean (Trench) and space (Galaxy).
- **Gauntlet chains with crowns**: surface the existing challenge
  parent/depth as "beaten 4× — crown held by @x".
- **Ghost watch/challenge** from profile & leaderboard with full
  cosmetic + weather snapshot; replays publicly visible only after the
  daily closes (doubles as the anti-replay-theft fix).
- **Daily aftermath share text**: `Glide daily #142 · 🌪 hard ·
  31/47/52 · top 9%` + tomorrow's tier teaser.
- **Streaks v2**: visible flame, weekly streak-freeze, fix
  attempts-vs-days counting first.
- **Head-to-head records** ("you 7–3 vs @lennart") + rival slot.
- **Skin gifting** (later): permanent lock for giver + provenance tag.
- **Weekly Gauntlet**: one fixed seed all week, unlimited attempts,
  top-% badge.

## Shipped this session

See ROADMAP.md status markers and the commit log on
`claude/trusting-rubin-1jevio`.

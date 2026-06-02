# #3 — Make it yours (cosmetics, worlds, polish)

*Vibe-coding a Flappy game, post 3.*

With the loop and the social layer solid, this stretch was about
**expression** and **feel** — all of it cosmetic, none of it touching the
deterministic sim.

- **Cosmetic axes you mix freely**: shape (plane, bird, kite, crane sprite…),
  colors/skins, **pillar styles** (solid / stone / neon / glass), and themes.
  Glass pillars are see-through — and on the daily that counts as a harder
  challenge.
- **Worlds**: a background-image pipeline plus new themes — **Ocean** (warm
  light shafts, bubbles) and **Space** (starfield). These are **interactive
  backgrounds**: every 25 points the scene shifts — you descend deeper / soar
  higher (Shallows → Trench, City → Galaxy).
- **Daily weather**: fog, blinding sun, night, sunset, rain — some are just
  mood, some genuinely raise the difficulty, all fed into an on-screen
  "intensity %" meter.
- **Progression**: a unified unlock registry, a goals list, season badges,
  public profiles, legendary skins that glow.
- **Quality of life**: patch-notes on launch, a practice mode with infinite
  lives, a calmer design pass (button hierarchy, grouped settings, tidier
  account), fairer gap generation so the path stops doing the brutal
  top↔bottom zigzag.

It's a vibe-coding project, so the cadence is lots of tiny verified PRs rather
than big drops. Next up: an onboarding tutorial and — eventually — an Arcade
mode where we finally get to break the determinism rules on purpose.

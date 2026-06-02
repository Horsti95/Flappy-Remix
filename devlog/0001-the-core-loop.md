# #1 — The core loop (and why it's deterministic)

*Vibe-coding a Flappy game, post 1.*

Glide started as the classic one-button loop: tap to flap, thread the gaps,
chase a score. But under the hood there's one decision everything else leans
on — **the simulation is fully deterministic**. Same seed + same taps = the
exact same run, byte for byte.

Why care? Because it makes three things trustworthy:

- **Daily challenge** — everyone worldwide flies the *same* level on a given
  UTC date.
- **Ranked** — two players get the same three seeds; we can validate scores by
  replaying the inputs server-side. Cheating just… doesn't post.
- **Ghost duels** — your run is a list of taps; a friend replays your ghost on
  your seed.

Determinism is the boring foundation that makes the fun stuff possible. Pretty
much every feature after this had to answer one question: *does this keep the
sim deterministic?* (Cosmetics: yes. Power-ups: that's why they'll live in a
separate Arcade mode later.)

Shipped so far: the sim, canvas renderer, PWA shell, Supabase auth, skins +
rarity, leaderboards, server-side replay validation.

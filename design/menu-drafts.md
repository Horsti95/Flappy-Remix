# Main menu — design draft directions

Current menu (`src/ui/menu.ts:32-139`) is functional but flat: a dark
backdrop, a plain word "Pflug", buttons all the same colour. Below are
three directions we could take. The implementation in this branch
adopts **Direction A**; we can iterate from there.

---

## A — Atmospheric paper (implemented on this branch)

Mood: cozy, mascot-led, "the game's character is the menu's character".

```
        ╱│╲          <- animated floating paper plane (mascot)
       ╱ │ ╲             gentle wobble, faint shadow
      ╲╲╲│╱╱╱

      G L I D E       <- huge wordmark, drop-shadow, subtle letter-spacing
       paper-thin     <- tagline in italic, calmer than "tap to flap"

   ┌──────┬──────┐
   │ Play │Daily │    <- rounded-3xl, brighter hover, button shadow
   └──────┴──────┘    <- daily tile shows tier as a coloured pill on top-right
   ┌─────────────┐
   │ Challenge   │
   └─────────────┘
   [Ranked][Gallery][Awards][Board][Friends]
   [Sound: off  ][Contrast: off][Motion: off]
```

Why it works: leaning into the paper-plane identity makes the menu feel
like part of the game world rather than a settings screen. The floating
mascot tells brand-new players "this is what you control" without copy.

Trade-offs: a CSS animation runs all the time on the menu (cheap, but
worth disabling under `prefers-reduced-motion`).

---

## B — Bold arcade

Mood: high-energy, "score chase", competitive.

```
   ┌─────────────────────────┐
   │  G L I D E              │  <- neon-glow wordmark, animated
   │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
   └─────────────────────────┘

   ┏━━━━━━━━━━━━━━━━━━━━━━┓
   ┃   ▶  P L A Y         ┃  <- huge primary CTA, animated chevron
   ┗━━━━━━━━━━━━━━━━━━━━━━┛
   ┌──────────┬───────────┐
   │  Daily   │  Ranked   │   <- equal-weight secondary tier
   └──────────┴───────────┘

   small ticker: "world score today · 12,847" running across
```

Why it works: signals competitive depth from frame 1. Players who like
leaderboards immediately see the loop.

Trade-offs: dominates more than the paper-plane vibe; can feel busier.

---

## C — Editorial / minimal

Mood: design-conscious, mature, "this is a quality piece of software".

```
   GLIDE         no.247   <- big serif/display title, with daily issue # like a magazine
   ─────────────────────

   THE DAILY
   easy · heavy gravity
   3,205 played today
   ─────────────────────

   Play freely        →
   Challenge a friend →
   Ranked match       →
   ─────────────────────
   gallery · awards · board · friends
```

Why it works: trades game-y vibes for editorial confidence. Maps well
to how a NYT Games / The Browser audience reads a homepage.

Trade-offs: less inviting to a casual mobile player; conversion from
landing → first tap may dip vs A.

---

## What this branch ships

Direction **A** ("Atmospheric paper") applied to the live menu so you
can compare the preview URL to current `main`. The other two directions
are described above but not implemented — say which (B or C) and I'll
build a parallel preview branch.

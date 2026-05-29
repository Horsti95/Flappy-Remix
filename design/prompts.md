# Design prompt blueprints

Reusable prompt templates for generating game assets with AI image
tools (Midjourney, DALL·E, Stable Diffusion, Nano Banana, etc.). Each
template locks the **technical spec** so the output drops straight
into the codebase. The **style** is left to you — fill the bracketed
slots and run.

> Save outputs into `design/<category>/` so they're versioned with
> the rest of the source.

---

## How to use a template

1. Pick a template below.
2. Replace `{STYLE}` with your idea (e.g. `8-bit NES`, `cyberpunk
   neon-noir`, `watercolor children's book`, `chrome y2k`).
3. Replace any other bracketed slot.
4. Paste the resulting prompt into your image tool.
5. Save the file at the suggested path.

---

## 1. Player sprite (paper plane / bird / character)

Drop-in replacement for the canvas-rendered plane polygon. Lives at
`public/sprites/plane-<theme>.png` and is fed via skin metadata.

```
Single character sprite, {STYLE} style.

Technical:
- 256×256 px square canvas, transparent background (no padding letterbox)
- Subject centred, facing 30° upward right, takes up ~70% of the canvas
- Clearly readable silhouette at 32×32 px — heavy outline, no fine details that disappear when scaled
- Two-color body palette: PRIMARY = {HEX_BODY}, ACCENT = {HEX_ACCENT}
- 1.5 px dark outline at native resolution (will scale)
- No drop shadows, no glow, no background gradients (game adds those)
- Pivot point is exact image centre — the plane will rotate around it
- Designed to read against a light blue sky (#87ceeb)

Stylistic:
- {STYLE}, energetic, playful
- Distinct front/back so it doesn't look symmetrical
- Optional: tiny accent detail (eye / fold / chevron) that says "this is the front"

Output: PNG with alpha. Pixel-perfect, no JPEG compression artifacts.
```

Save to: `public/sprites/plane-{theme}.png`

---

## 2. Background / parallax layer

Used as the sky behind the canvas. The renderer expects a 9:16 portrait
that tiles vertically OR a single static image stretched to fit.

```
Game background, portrait orientation, {STYLE} style.

Technical:
- 1080×1920 px (9:16 mobile portrait)
- Seamless vertical tile: pixel at y=0 matches pixel at y=1919 for repeat scrolling
- Subjects positioned in the LEFT 30% and RIGHT 30% only — middle 40% must stay simple/empty (the paper plane lives there)
- Low local contrast in the middle band — busy textures kill gameplay readability
- Sky-blue base tone (#87ceeb±15%) so existing pillar art still reads
- No text, no logos, no faces / characters in centre
- Foreground depth implied with darker bottom (≥40% luminance drop bottom-to-top)

Stylistic:
- {STYLE}, atmospheric, evocative
- Calm mid-range energy — this is a backdrop not a focal point
- Implied movement direction left-to-right (clouds drift, lights streak)

Output: PNG, no transparency needed. Optional: deliver as 3 parallax layers
(far, mid, near) at the same 1080×1920 each, with mid + near having alpha.
```

Save to: `public/backgrounds/{theme}.png` (or
`{theme}-far.png`, `{theme}-mid.png`, `{theme}-near.png` for parallax)

---

## 3. Pillars / obstacle pair

The vertical bars the player flies between. Both halves of the same
pair share a theme. Currently rendered as solid blocks — these become
sprite overlays.

```
Tileable vertical pillar segments, {STYLE} style.

Technical:
- Two separate PNGs, both 160 px wide
- TOP segment 160×512 px, tile-bar (top pixel-row repeats up infinitely)
- BOTTOM segment 160×512 px, tile-bar (bottom pixel-row repeats down infinitely)
- A defined CAP zone at the inside edge (~120×100 px) where the pillar meets the gap — this is the most-visible part
- Solid alpha — no soft edges (collision is sharp, art shouldn't suggest otherwise)
- Bright enough to read against {SKY_COLOR=#87ceeb}
- Single-hue + accent palette so it can be color-shifted at runtime
- No text, no faces, no overly busy textures (player needs to read the gap fast)

Stylistic:
- {STYLE}, matches the {BACKGROUND_THEME}
- Cap zone has the most personality — it's what the player aims between

Output: 2 PNG files with alpha.
```

Save to: `public/pillars/{theme}-top.png`, `public/pillars/{theme}-bottom.png`

---

## 4. Achievement badge / skin icon

Used in the gallery + achievement reveal. Currently rendered as the
plane polygon in the reward color — these would be richer custom art.

```
Game badge icon, {STYLE} style.

Technical:
- 512×512 px, transparent background
- Subject centred, occupies 80% of canvas
- Single-focus emblem — no scenes, no characters interacting
- 2-3 colors max in the foreground
- Heavy outline (8-12 px at native scale) — reads at 64×64 in lists
- Optional inner glow restricted to a {RARITY_COLOR} hue
- No text rendered into the badge (label is overlaid in HTML)

Stylistic:
- {STYLE}, related to {ACHIEVEMENT_THEME} (e.g. flame for streak, gear for skill, crown for win count)
- Feels like a coin / sticker / collectible — flat is fine, depth is fine, both can work

Output: PNG with alpha, square aspect.
```

Save to: `design/skins/{rarity}-{name}.png` (and pipe into the gallery
icon mapping later if we add custom badges).

---

## 5. Daily-tier hero card

The art that appears on the daily landing screen tied to the day's
tier (easy / medium / hard / super hard). Currently text-only.

```
Hero card illustration, {STYLE} style, themed {TIER_MOOD}.

Technical:
- 1080×720 px landscape, 3:2 ratio
- Subject in the LEFT half so text can overlay the RIGHT half
- Right half has a {DARKEN_BAND_RGBA=rgba(0,0,0,0.4)} gradient or low-contrast zone (we'll overlay tier-name + modifier badges)
- 80px safe padding on all edges (text margins live there)
- Mood-specific palette per tier:
  - easy: pastel sky, soft pink/yellow
  - medium: balanced blue, mid contrast
  - hard: storm grey, electric accents
  - super hard: crimson + black, lightning yellow
- No text rendered in the card

Stylistic:
- {STYLE}, references {TIER_MOOD} weather/mood
- Cinematic, single-image, no comic panels
- Plane silhouette can appear small in the scene (optional)

Output: PNG, no alpha needed.
```

Save to: `design/daily/{tier}-{date}.png`

---

## 6. Share-card frame / OG overlay

The decorative frame around the existing 1080×1920 share card. Currently
just a gradient + rounded watermark — could become a branded frame.

```
Square / portrait card frame, {STYLE} style.

Technical:
- 1080×1920 px (or 1200×630 for OG landscape variant)
- Transparent middle region 800×1200 centred — this is where the score and plane render
- Decorative frame ONLY in the outer 140px margin (4 sides)
- Top-left 380×220 zone reserved for the brand wordmark (keep design light here)
- Bottom-right 280×120 zone reserved for QR / call-to-action (keep design light here)
- Palette neutral enough to not fight whatever skin color drops in

Stylistic:
- {STYLE}, reads as "premium share artifact"
- Optional micro-typography in the corners (tickmarks, version stamp) — those CAN be rendered in
- No interior subjects — middle is reserved

Output: PNG with alpha around the cut-out.
```

Save to: `public/share-frames/{theme}.png`

---

## 7. Sound / haptic cue (descriptive prompt, not visual)

For when you want to generate / commission new sound effects. Not for
image tools — this is for ElevenLabs, Soundraw, Riffusion, etc. Or as
a brief for a human sound designer.

```
Game sound effect, {STYLE_GENRE} mood.

Function: {USE_CASE} (e.g. "flap when player taps", "score tick on
passing a pillar", "death crunch when colliding")

Technical:
- Mono, 48kHz, 16-bit WAV
- Duration: {DURATION_MS} ms hard cap (we layer 10+ per second for flap)
- Peak level: -6 dBFS (leaves headroom for game mix)
- No fade-in (must trigger crisp on tap)
- Fade-out length: max 50% of total duration
- No reverb tail beyond 80 ms (delay/echo gets messy when sounds overlap)
- Pitched at C5 (≈523 Hz) center frequency so it sits above the music

Stylistic:
- {STYLE_GENRE} — describe the texture (e.g. "paper crinkle", "8-bit blip", "synth blip")
- {EMOTIONAL_TONE} — describe the feeling (e.g. "satisfying", "neutral", "punchy")
- {VARIANTS} — produce 5 distinct alternatives so we can A/B
```

Save to: `public/sfx/{useCase}-{variant}.wav` — and add to the picker
in `src/game/sfx.ts` so it's selectable.

---

## Quick checklist before you commit an asset

- [ ] Dimensions match the spec exactly (no `0.5 px` drift)
- [ ] Transparent where spec says transparent
- [ ] Reads at the smallest in-game scale you'll see it
- [ ] No compression artifacts (always export PNG, never JPG)
- [ ] Filename matches `{category}/{theme}-{role}.png` so the picker
      logic in code stays predictable
- [ ] File size sane (under 200 KB for sprites/icons, under 500 KB for
      backgrounds — PWA precache will gobble everything)

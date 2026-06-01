# Uploaded design references

Drop concept art here (sprites, backgrounds, pillars). We review each and,
if usable, process + wire it into the game. **Nothing here is automatically
in the game** — see the pipeline notes below.

## How to contribute (for friends / collaborators)

1. AI-generate or draw your asset (Gemini, Midjourney, etc.).
2. Drop the file in this folder (`design/uploads/`) via a PR or share link.
3. Use these specs so it can actually drop in:
   - **Sprites (plane/bird/character):** grayscale, **transparent background**,
     square (≥512², ideally 1024²). Grayscale because the game **tints** it to
     the player's color — a pre-colored sprite can't recolor. PNG with real
     alpha. (A JPG with a baked checkerboard works too — we knock the
     background out with `scripts/knockout-bg.mjs`, but PNG+alpha is cleaner.)
   - **Backgrounds:** 9:16 portrait (e.g. 1080×1920 or ~941×1672). Keep the
     **center vertical lane clear** (designs in the left/right thirds) — the
     background is static and pillars scroll through the middle.
   - **Pillars:** describe the style; pillar art isn't image-driven yet.
   - **No baked watermark** in the final (crop the Gemini ✦ etc.).

## Pipeline status

- **Sprites:** ✅ live. `src/game/sprites.ts` loads + tints grayscale PNGs.
  Add a source there + a shape in `shapes.ts`. (toucan #63, crane this PR.)
- **Backgrounds:** ✅ live. `src/game/backgrounds.ts` + `Theme.backgroundImage`
  (#73). neo_city + fairy_spires themes use the uploaded art.
- **Pillars:** styles are code-drawn (`src/game/pillars.ts`), not image-driven.

## Inventory

| File | Type | Status |
|------|------|--------|
| `sprite-toucan-paper.jpg` | sprite ref | shipped → `public/sprites/toucan.png` (#63) |
| `982993c6-…crane.jpg` | sprite ref | shipped → `public/sprites/crane.png` (bg knocked out via sharp) |
| `bg-cyberpunk-pixel.png` | background | shipped → `public/backgrounds/neo-city.png` (#73) |
| `bg-pink-fairy.png` | background | shipped → `public/backgrounds/fairy-spires.png` (#73) |
| `bg-cyberpunk-comic.jpg` | background | pending — busier center lane, lower priority |

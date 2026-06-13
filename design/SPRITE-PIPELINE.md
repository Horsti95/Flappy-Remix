# Sprite pipeline — using the AI origami art

**Verdict (2026-06-13): the uploaded origami PNGs ARE usable and look
great tinted — but as SINGLE-colour sprites, not independent two-colour
ones. Nothing breaks; the second "colour" becomes fold-shading.**

## How the in-game tint actually works

`src/game/sprites.ts` → `getTintedSprite(id, skin)`:

1. draws a **grayscale, transparent-background** PNG,
2. `multiply`s the skin's **body** colour over it (keeps fold shading +
   black outlines),
3. restores alpha so the background stays transparent.

Key facts:
- It uses **`skin.body` ONLY**. `skin.accent` is **ignored** for sprite
  shapes (the cache key is `id:body`). So a sprite is a one-hue object;
  its darker panels are just darker shades of the body colour.
- The source MUST be **grayscale + transparent**, or the multiply muddies.

## What the uploaded files are

`design/uploads/1781*.png` (and the Gemini set): origami animals, **RGB
(no alpha), ~1664×928, flat near-white background, cream `#f8f4e8` +
tan `#d4c4a8` fills + black outlines.** Beautiful, on-brand — but three
mismatches with the pipeline: no transparency, colour (not grayscale),
oversized/landscape.

## The fix — proven working

`scripts/prep-sprite.mjs` (run it on any of them):

```sh
node scripts/prep-sprite.mjs design/uploads/1781298542.png \
  public/sprites/swan.png
```

It flood-fills the background to transparent (corner-connected only, so
interior cream survives), desaturates to grayscale, trims, and fits to
256×256 RGBA. The swan was verified: tinting a blue body over the result
produces a clean blue origami swan with natural fold shadows. (Preview
images were generated during review, not committed.)

## Wiring a prepped sprite (the remaining step, ~30 min each)

1. `node scripts/prep-sprite.mjs <in> public/sprites/<name>.png`
2. eyeball it (some images may need a higher bg tolerance arg, or a manual
   crop if the subject touches an edge),
3. register it in `src/game/sprites.ts` (mirror the `crane` entry),
4. add a `ShapeMeta` in `src/game/shapes.ts` with `draw: drawSpriteFallback`
   (or the crane's pattern) + an SVG twin in `shape-svg.ts`/`gallery.ts`
   for the previews, and an unlock.

The current canvas-drawn shapes (incl. `fable`) can be **replaced** by
prepped sprites of the same subject for a big quality jump — that's the
Phase-4 "paper-sky full art pass".

## If we want TRUE two-colour sprites (later, optional)

Author each sprite with the **accent region keyed to a flat colour**
(e.g. pure magenta `#ff00ff`), keep everything else grayscale. Then tint
in two passes: grayscale→body (multiply), magenta-mask→accent (replace).
Needs a pipeline upgrade in `sprites.ts` + re-exported art. Until then,
single-tint origami looks good and ships today.

## Prompt tweak for future generations

The prompt in `design/uploads/ideas for new designs.md` asks for **coloured**
output (`#f8f4e8` / `#d4c4a8`). For the tint pipeline, ask instead for
**two-tone GRAYSCALE on a transparent background** (light-gray body
`#cccccc`, mid-gray folds `#888888`, black outlines) — see
`design/prompts-paper-sky.md`. Grayscale skips the colour→gray step and
tints most cleanly. The prep script handles either, but grayscale-native
is best.

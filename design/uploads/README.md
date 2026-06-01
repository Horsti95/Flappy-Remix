# Uploaded design references

Concept art dropped in for the look-and-feel exploration. **None of these
are wired into the running game yet** — see the reasoning below.

| File | Type | Notes |
|------|------|-------|
| `sprite-toucan-paper.jpg` | sprite | Yellow/green origami toucan, paper-fold style. Gemini-generated (watermark bottom-right). |
| `bg-cyberpunk-comic.jpg` | background | Neon ramen-alley, comic/pixel. Left/right buildings, clear center lane. |
| `bg-cyberpunk-pixel.png` | background | Pixel-art neon city, V-shaped lane, sky center. |
| `bg-pink-fairy.png` | background | Pink fairy-tale spires, V-shaped lane, sky center. |

## Why they're not in the game yet (the blocker)

The renderer draws **everything** with canvas primitives (`fillRect`,
gradients, polygons). There is **no image/sprite loader** — `grep` for
`drawImage`/`new Image` in `src/` returns nothing. So a PNG/JPG cannot be
shown in-game until we build a small **sprite/background image pipeline**:

1. An async image loader (preload + cache `HTMLImageElement` / `ImageBitmap`).
2. A `RenderOptions.backgroundImage` path: draw the image stretched/letterboxed
   behind the world, *under* the pillars, with the center lane kept readable.
3. (For the sprite) a `RenderOptions.spriteImage` path that draws a bitmap at
   the bird position + rotation instead of the polygon `drawShape`, sized to
   the collision radius so fairness is unchanged.
4. Watermark: the Gemini logo (bottom-right ✦) must be cropped/removed before
   any asset ships.

These backgrounds are **static** (designs in the left/right margins, empty
center) — which fits our existing "background doesn't scroll, pillars do"
model. Good. The pink-fairy and pixel-city both keep a clear vertical lane.

## Recolor-by-country idea

The toucan sprite could be re-tinted to a player's country colors (the
"Germany package" idea). That needs the sprite as **separable layers** (body
vs accent) or a tintable silhouette — a flat JPG can't be recolored cleanly.
Plan: trace it to a 2-color vector/sprite-sheet, then the existing skin
{body, accent} system can recolor it for free.

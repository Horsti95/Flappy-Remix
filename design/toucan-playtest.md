# Brazil toucan playtest

The generated origami toucan is available immediately in Gallery > shape.
Select Brazil under Gallery > colours for a green body and yellow beak.
Both the shape and palette are unlocked from the first game.

## Assets and generation

- Source: `design/uploads/toucan-generated.png` (local, ignored raw artwork).
- Body: `public/sprites/toucan.png`.
- Accent: `public/sprites/toucan-accent.png`.
- Both runtime layers are 256 x 256 RGBA grayscale PNGs.
- Generated with the built-in image-generation tool.
- The generated orange marks the beak/underwing accent for preparation;
  runtime layers contain no fixed orange colour and support any equipped skin.

Rebuild from the saved source:

```powershell
node scripts/prep-sprite-2color.mjs design/uploads/toucan-generated.png public/sprites toucan --alpha
```

The `--alpha` option preserves the generated cutout and antialiased edges.
It rejects an opaque source instead of guessing a background.
The existing opaque-upload preparation remains the default.

The sprite is registered in gameplay, the gallery swatches, and shared
menu/profile SVG previews. Share cards and ghosts resolve it through the
existing shape/sprite registry. Collision and scoring use the existing
fixed radius. No database migration is required.

## Sizing review (2026-09-13)

- Collision stays at the shared default radius of 14 world pixels (diameter 28).
  Daily radius modifiers still affect all shapes equally.
- The PNG alpha crop is x=12, y=53, width=232, height=149 on its 256px canvas.
  No accent pixels above the renderer's alpha threshold lie outside this crop.
- Shared `getSpriteFrame` maps the longest side of EVERY bitmap sprite to
  1.25 times the collision diameter: toucan = 35 x 22.4784 world pixels.
  Its aspect ratio and normal-play appearance have not been changed.
- The toucan-only polygon fallback is now centred and uses the same 35px
  geometric width (before its outline stroke), instead of 37.1px with a
  rightward offset. This affects pre-load/high-contrast rendering, not physics.
- A circle cannot exactly match a winged silhouette. Beak/wing tips remain
  decorative; this is the existing convention, not pixel-perfect collision.
- `tests/sprite-layout.test.ts` protects the shared size, real asset crop,
  aspect ratio, radius-modifier scaling and fallback transform.
- Local comparison: `/design/art-review/` on the Vite development server.

This is a local playtest addition. Publish it through the normal game
deployment when it has been reviewed. Existing installations need that
deployment to receive the new assets.

## Generation prompt

```text
Use case: stylized-concept
Asset type: a single production game sprite for Glide, a tiny side-scrolling origami bird game.
Primary request: one appealing origami toco toucan flying to the RIGHT, constructed from a small number of crisp folded-paper polygons, with a prominent broad polygonal toucan beak, compact rounded-angular body, one raised folded wing, short tucked tail, tiny simple black eye. Match a flat origami fleet: clean dark charcoal outlines, sparse dark fold seams, restrained flat paper shading, no realism.
Composition: one bird only, centered in a square, full silhouette inside frame with generous transparent padding. Horizontal flying pose, no feet dangling. Keep beak distinctive but relatively compact, total silhouette width about 1.2 times its height so the body remains readable at 35 pixels wide.
Color coding for the game's two recolorable layers: body, head, tail and wing strictly neutral LIGHT GRAYS (#e8e8e8 with #c8c8c8 fold shading); BEAK and one small visible underwing fold are warm GOLDEN ORANGE (#ffa000 with #d88500 shading). Dark outlines #202020. This limited color separation is mandatory; no other colors. Beak is golden orange to make a clean accent mask; the game will tint it yellow and the grayscale body green.
Background: genuinely TRANSPARENT alpha around the bird and between the wing and body. No white field, no checkerboard drawn into pixels, no backdrop, no ground or cast shadow, no glow.
Constraints: minimal clean silhouette, bold readable folds, no paper grain noise, no fine feathers, no text, no flags, no logo, no watermark, no panels, no additional objects. High quality transparent PNG game asset.
```

# Paper Sky — AI art generation prompts

The art direction (devlog/0005): folded paper, origami, wind. This file
holds copy-paste prompts for generating sprites, backgrounds, and UI
textures in a consistent style. This is a vibe-coding project — all art
is generated, then reviewed against the rules below.

## Hard rules (every asset)

1. **Sprites/pillars: two-tone grayscale** (body `#CCCCCC`, accent
   `#888888`) — the multiply-tint pipeline only recolors cleanly on
   grayscale art. Backgrounds are the only fixed-color art.
2. **Transparent background** for sprites (PNG, alpha).
3. **Readability rule for backgrounds**: the central flight corridor
   (vertical middle ~60% of the frame) must stay low-contrast and
   uncluttered — the plane silhouette must always separate. Detail
   lives at the top and bottom edges.
4. Match the collision art boxes: plane fits a 28 px circle (radius 14
   world units), pillars are 56 wide with a 14 cap.

## Sprite prompt template (shapes / country animals)

> Flat vector game sprite of an origami {paper airplane | crane |
> eagle | macaw | rooster | butterfly | kite | leaf}, folded-paper
> style, crisp visible fold lines, subtle paper grain, **two-tone
> grayscale only** (light gray body #CCCCCC, mid gray accent #888888),
> side view facing right, centered, no shadow, no outline glow,
> **transparent background**, clean sharp edges, minimal, game asset,
> 512×512.

Country packs: origami national animal (above) + national-color tint
preset applied in-engine + flag profile badge (flag = simple flat
rounded-rect, real colors, 128×128, transparent bg).

## Background prompt template (themes)

> Soft minimal game background, layered cut-paper / papercraft style,
> {sunset over paper mountains | night sky with paper stars | ocean
> with layered paper waves | stadium of folded paper banners}, muted
> {warm | cool} palette, large calm empty area across the vertical
> middle of the frame (gameplay corridor), detail only near top and
> bottom edges, gentle paper-grain texture, no characters, no text,
> flat lighting, 1080×1920 portrait.

Existing keepers by this standard: sunset, fairy spires (already
muted). The skyline/building backgrounds fail the corridor rule and
are slated for replacement.

## Pillar prompt template

> Seamless vertical tile of a folded-paper column, papercraft style,
> subtle fold creases every ~80 px, **two-tone grayscale** #CCCCCC /
> #888888, flat front-on view, transparent background, crisp edges,
> 56 px wide content with a distinct 14 px cap piece, tileable
> vertically.

## UI texture

> Subtle paper grain texture, very low contrast, light neutral gray,
> seamless tile, 256×256 — used at low opacity behind panels.

(For the CSS-only v1, panels fake the grain with layered gradients —
no asset needed.)

## Workflow

1. Generate at 2× target size, downscale in the icons pipeline
   (`scripts/generate-icons.mjs` pattern) or with sharp.
2. Check grayscale purity (no color channels) before committing —
   tinting will look muddy otherwise.
3. Drop candidates in `design/uploads/` per its README; wire the
   winners.

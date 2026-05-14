# Design

Reference assets for ideas in `../IDEAS.md`. Nothing in this folder is
in the running game — it's a sketchpad you can open in a browser and
iterate on before committing to code.

## How to view

Double-click `index.html`. It opens in your default browser, no dev
server needed. Every card links to the raw SVG so you can pop it open
in a new tab to inspect the geometry or drag it into Figma / Inkscape.

## How to iterate

1. Open an SVG in any editor — VS Code, Inkscape, Figma (drag-import),
   or just a text editor for nudging numbers.
2. Save.
3. Refresh `index.html` in the browser.

When a design is ready to land in the actual game:

- **Skin shapes** → port the polygon coordinates into
  `src/game/render.ts` (`drawPlane` function).
- **Backgrounds** → the renderer currently draws a single gradient.
  We'd add a `theme` field to `RenderOptions` and switch the sky
  fill + add overlay layers based on theme.
- **Ordinal RGB ramp** → goes into a new RPC that assigns
  `signup_index` and computes the color server-side at profile
  creation. See `IDEAS.md` → "Ordinal-position skins."
- **Daily twist modifiers** → physics ones plug into
  `src/game/config.ts` overrides keyed off the daily seed. Visual
  ones (fog, night, sunset) plug into the renderer with a new
  `dailyTheme` field.

## What's here

```
design/
  index.html
  skins/
    paper-plane.svg     ← current default (shipped)
    paper-crane.svg     ← proposed for first-50 ordinal tier
    dart.svg            ← alternate: sharper racing feel
    kite.svg            ← alternate: diamond proportion, lift feel
  backgrounds/
    sunny.svg           ← current default (shipped)
    cloudy.svg          ← pale grey-blue with wisps
    sunset.svg          ← purple → orange → gold
    night.svg           ← deep blue, stars, crescent moon
    fog.svg              ← limited-visibility overlay
  palettes/
    ordinal-decay.svg            ← grey ramp + tier boxes
    daily-twist-modifiers.svg    ← physics + visual + mechanical hints
```

## Adding new sketches

Drop a new SVG into the right subfolder, add a `<a class="card">` block
to `index.html` pointing at it, refresh. The styles in `index.html`
auto-size everything to a consistent card grid.

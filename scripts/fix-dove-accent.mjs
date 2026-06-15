#!/usr/bin/env node
/**
 * One-off fix: punch the accent hole into the dove base layer.
 *
 * Every two-colour origami sprite is authored so the base (`<id>.png`) is
 * TRANSPARENT wherever the accent (`<id>-accent.png`) is opaque — the accent is
 * drawn beneath and shows through that hole (see prep-sprite-2color.mjs). The
 * dove shipped without that hole: dove.png was opaque across the whole bird, so
 * the body tint painted right over the wing accent and the dove rendered as a
 * single colour (the equipped accent never showed, in-game and in the gallery
 * previews alike).
 *
 * This rebuilds dove.png as its current art with every accent-opaque pixel made
 * transparent. Dark wing outlines live on the base (they're not in the accent
 * layer), so they survive and keep framing the now-visible accent — matching how
 * swan/butterfly/etc. are built (base coverage of the accent → 0%).
 *
 * Usage: node scripts/fix-dove-accent.mjs
 */
import sharp from "sharp";

const BASE = "public/sprites/dove.png";
const ACCENT = "public/sprites/dove-accent.png";

const base = await sharp(BASE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const acc = await sharp(ACCENT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (base.info.width !== acc.info.width || base.info.height !== acc.info.height) {
  throw new Error("dove base/accent size mismatch");
}

const { width, height } = base.info;
let punched = 0;
for (let p = 0; p < width * height; p++) {
  if (acc.data[p * 4 + 3] > 16 && base.data[p * 4 + 3] > 0) {
    base.data[p * 4 + 3] = 0; // punch the hole
    punched++;
  }
}

await sharp(base.data, { raw: { width, height, channels: 4 } }).png().toFile(BASE);
console.log(`dove: punched ${punched}px of accent hole into base → ${BASE}`);

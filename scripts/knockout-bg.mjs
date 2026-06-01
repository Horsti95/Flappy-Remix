#!/usr/bin/env node
/**
 * Knock out a near-white / light checkerboard background to transparency,
 * for turning a grayscale sprite JPG (which can't store alpha) into a
 * tintable PNG. Pixels that are light AND low-saturation become transparent.
 *
 * Usage:
 *   node scripts/knockout-bg.mjs <input.jpg> <output.png> [lumThreshold] [satThreshold]
 *
 * Defaults: lum > 222 and saturation < 18 → transparent. Tune per image.
 */
import sharp from "sharp";

const [, , input, output, lumArg, satArg] = process.argv;
if (!input || !output) {
  console.error("usage: knockout-bg.mjs <input> <output.png> [lum=222] [sat=18]");
  process.exit(1);
}
const LUM = Number(lumArg ?? 222);
const SAT = Number(satArg ?? 18);

const img = sharp(input).ensureAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
let cleared = 0;
for (let i = 0; i < data.length; i += channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (lum > LUM && sat < SAT) {
    data[i + 3] = 0;
    cleared++;
  }
}
await sharp(data, { raw: { width, height, channels } }).png().toFile(output);
console.log(`wrote ${output} (${width}x${height}); cleared ${cleared} px to transparent`);

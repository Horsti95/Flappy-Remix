#!/usr/bin/env node
/**
 * One-off: give the "love letter" (envelope) a second colour.
 *
 * The envelope art is a cream body with a lighter triangular FLAP, but the
 * generic 2-colour prep keys off a *tan* accent region and the flap's warm
 * cream isn't saturated enough to trip it — so it shipped single-layer. Here we
 * rebuild it from the clean source upload and split the flap GEOMETRICALLY:
 *
 *   envelope-accent.png — only the upper flap triangle (luminance), the rest
 *                         transparent, NO outlines.
 *   envelope.png (base) — body + ALL outlines as luminance, with the flap's
 *                         interior punched transparent so the accent layer
 *                         shows through (the fold lines stay on base, framing
 *                         it).
 *
 * Draw order (matches game/sprites.ts): accent BENEATH, base ON TOP.
 *
 * Uses the SAME trim/resize as scripts/prep-sprite-2color.mjs so the sprite
 * stays aligned with the in-game 32×32 crop.
 *
 * Usage: node scripts/split-envelope-flap.mjs
 */
import sharp from "sharp";

const SRC = "design/uploads/1781298838.png"; // the envelope upload
const SIZE = 256;
const PAD = 12;
const OUTLINE_LUM = 0.32; // < this (0..1) ⇒ a dark fold line → keep on base
const BG_LUM = 0.9;
const BG_SAT = 22;
// The two diagonals meet (apex of the downward flap) at this fraction of the
// envelope's content height. Tuned to the drawn fold lines.
const APEX_Y_FRAC = 0.56;

const lumOf = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const satOf = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);

const inner = SIZE - PAD * 2;
const { data, info } = await sharp(SRC)
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  .trim({ background: "#ffffff", threshold: 25 })
  .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
  .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 255, g: 255, b: 255 } })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

// Flood-fill the near-white background from the four corners (clean closed
// outline ⇒ the enclosed interior is preserved).
const bg = new Uint8Array(W * H);
const isBgish = (i) => lumOf(data[i], data[i + 1], data[i + 2]) > BG_LUM && satOf(data[i], data[i + 1], data[i + 2]) < BG_SAT;
const stack = [];
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const p = y * W + x;
  if (bg[p] || !isBgish(p * C)) return;
  bg[p] = 1;
  stack.push(p);
};
push(0, 0); push(W - 1, 0); push(0, H - 1); push(W - 1, H - 1);
while (stack.length) {
  const p = stack.pop();
  const x = p % W, y = (p / W) | 0;
  push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
}

// Content bounding box (non-background).
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let p = 0; p < W * H; p++) {
  if (bg[p]) continue;
  const x = p % W, y = (p / W) | 0;
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const x0 = minX, x1 = maxX, yTop = minY;
const xc = (minX + maxX) / 2;
const yApex = minY + (maxY - minY) * APEX_Y_FRAC;

// Lower boundary of the flap triangle at column x (the diagonal fold line).
function flapBottomY(x) {
  if (x < x0 || x > x1) return -1;
  if (x <= xc) return yTop + ((yApex - yTop) * (x - x0)) / (xc - x0);
  return yApex + ((yTop - yApex) * (x - xc)) / (x1 - xc);
}

const base = Buffer.alloc(W * H * 4, 0);
const accent = Buffer.alloc(W * H * 4, 0);

for (let p = 0; p < W * H; p++) {
  if (bg[p]) continue; // transparent in both
  const i = p * C, o = p * 4;
  const lum = lumOf(data[i], data[i + 1], data[i + 2]);
  const gray = Math.round(lum * 255);
  const x = p % W, y = (p / W) | 0;
  const inFlap = y >= yTop && y <= flapBottomY(x);
  // Outlines (fold lines) always stay on the base so they frame the accent.
  if (inFlap && lum >= OUTLINE_LUM) {
    accent[o] = accent[o + 1] = accent[o + 2] = gray;
    accent[o + 3] = 255;
  } else {
    base[o] = base[o + 1] = base[o + 2] = gray;
    base[o + 3] = 255;
  }
}

await sharp(base, { raw: { width: W, height: H, channels: 4 } }).png().toFile("public/sprites/envelope.png");
await sharp(accent, { raw: { width: W, height: H, channels: 4 } }).png().toFile("public/sprites/envelope-accent.png");

let nB = 0, nA = 0;
for (let p = 0; p < W * H; p++) {
  if (base[p * 4 + 3]) nB++;
  if (accent[p * 4 + 3]) nA++;
}
console.log(`envelope: base ${nB}px, accent(flap) ${nA}px → two-layer`);

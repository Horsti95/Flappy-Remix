#!/usr/bin/env node
/**
 * Flood-fill knockout that targets the specific grey checkerboard tones found
 * on the image border, so the connected background is removed while coloured
 * (and off-band grey) parts of the subject survive.
 * Usage: node scripts/knockout-flood.mjs <in> <out.png> [sat=26] [pad=14]
 */
import sharp from "sharp";
const [, , input, output, satArg, padArg] = process.argv;
const SAT = Number(satArg ?? 26);
const PAD = Number(padArg ?? 14);
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const lumAt = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
const satAt = (i) => Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
// Sample border low-sat luminance band.
let lo = 255, hi = 0;
const scan = (x, y) => { const i = (y * W + x) * C; if (satAt(i) < SAT) { const l = lumAt(i); if (l < lo) lo = l; if (l > hi) hi = l; } };
for (let x = 0; x < W; x++) { scan(x, 0); scan(x, H - 1); }
for (let y = 0; y < H; y++) { scan(0, y); scan(W - 1, y); }
lo -= PAD; hi += PAD;
const isBg = (i) => satAt(i) < SAT && lumAt(i) >= lo && lumAt(i) <= hi;
const seen = new Uint8Array(W * H), stack = [];
const push = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = y * W + x; if (seen[p] || !isBg(p * C)) return; seen[p] = 1; stack.push(p); };
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
let cleared = 0;
while (stack.length) { const p = stack.pop(); data[p * C + 3] = 0; cleared++; const x = p % W, y = (p / W) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toFile(output);
console.log(`${output.split("/").pop()}: band[${lo.toFixed(0)},${hi.toFixed(0)}] cleared ${(100*cleared/(W*H)).toFixed(1)}%`);

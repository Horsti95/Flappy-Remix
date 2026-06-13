// Prep an AI-generated origami PNG into a game-ready sprite for the tint
// pipeline (src/game/sprites.ts). The tint multiplies ONE color (the skin
// body) over a GRAYSCALE, transparent-background sprite — so this script:
//
//   1. flood-fills the flat background from the corners → transparent alpha
//      (corner-connected only, so cream areas INSIDE the subject survive),
//   2. desaturates to grayscale (cream→light, tan→mid, outlines→dark — which
//      becomes the fold shading the tint preserves),
//   3. trims to the subject and fits it into a centered square,
//   4. downscales to 256×256.
//
// Usage:  node scripts/prep-sprite.mjs <input.png> <output.png> [bgTolerance]
//
// NOTE: today's sprite tint uses the body colour only (accent is ignored for
// sprite shapes). True two-colour sprites need a second keyed region — see
// design/SPRITE-PIPELINE.md. This script produces the single-tint kind.
import sharp from "sharp";

const [, , inPath, outPath, tolArg] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node scripts/prep-sprite.mjs <input.png> <output.png> [bgTolerance]");
  process.exit(1);
}
const TOL = Number(tolArg ?? 32); // how close to the corner colour counts as background
const OUT = 256;

const src = sharp(inPath).ensureAlpha();
const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels } = info;
const at = (x, y) => (y * w + x) * channels;

// Background colour = average of the four corners (these images are a flat
// near-white field, so the corners are representative).
const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
let br = 0, bg = 0, bb = 0;
for (const [x, y] of corners) {
  const i = at(x, y);
  br += data[i]; bg += data[i + 1]; bb += data[i + 2];
}
br /= 4; bg /= 4; bb /= 4;

const isBg = (i) =>
  Math.abs(data[i] - br) <= TOL &&
  Math.abs(data[i + 1] - bg) <= TOL &&
  Math.abs(data[i + 2] - bb) <= TOL;

// Flood-fill alpha=0 from every border pixel that reads as background. Only
// background CONNECTED to the edge is removed, so a cream belly enclosed by
// black outlines keeps its alpha.
const seen = new Uint8Array(w * h);
const stack = [];
for (let x = 0; x < w; x++) { stack.push([x, 0], [x, h - 1]); }
for (let y = 0; y < h; y++) { stack.push([0, y], [w - 1, y]); }
let cleared = 0;
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= w || y >= h) continue;
  const p = y * w + x;
  if (seen[p]) continue;
  seen[p] = 1;
  const i = p * channels;
  if (!isBg(i)) continue;
  data[i + 3] = 0; // punch alpha
  cleared++;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

const cleaned = await sharp(data, { raw: { width: w, height: h, channels } })
  .grayscale()
  .png()
  .toBuffer();

// Trim the now-transparent margins, then fit into a centered transparent
// square (resize/contain pads symmetrically — no manual canvas needed).
const trimmed = await sharp(cleaned).trim().toBuffer();
await sharp(trimmed)
  .resize(OUT, OUT, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(outPath);

console.log(`bg≈rgb(${br | 0},${bg | 0},${bb | 0})  cleared ${cleared} px  →  ${outPath} (${OUT}×${OUT})`);

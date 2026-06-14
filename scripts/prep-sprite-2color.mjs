#!/usr/bin/env node
/**
 * Two-colour origami sprite pipeline.
 *
 * The uploaded origami art is a flat RGB render on a near-white background:
 * a cream body (#f8f4e8), a tan accent fold (#d4c4a8) and black outlines.
 * The in-game tint multiplies ONE colour over a single grayscale layer, so
 * the accent can never read as a second colour. This script splits the art
 * into TWO tintable grayscale-with-alpha PNGs so the renderer (and the SVG
 * previews) can multiply a body colour over one and an accent colour over the
 * other:
 *
 *   <name>-accent.png  — ONLY the tan/accent region, as luminance, transparent
 *                        everywhere else. NO outlines (the base draws those on
 *                        top so they frame the accent cleanly).
 *   <name>.png (base)  — the cream/body region as luminance + ALL black
 *                        outlines, with the accent region punched fully
 *                        TRANSPARENT (a hole) so the accent layer shows
 *                        through from beneath.
 *
 * Intended draw order: accent BENEATH, base ON TOP. The base's outlines and
 * the hole frame the accent region.
 *
 * Per-pixel classification (after a corner flood-fill clears the background):
 *   outline  : luminance < OUTLINE_LUM            (the dark fold lines)
 *   accent   : saturation >= ACCENT_SAT AND warm  (tan is far more saturated /
 *              warmer than the near-neutral cream — see thresholds below)
 *   body     : everything else
 *
 * If the accent region is negligible (e.g. the envelope is pure cream +
 * outline) we skip the accent layer and keep a single-colour base — so it
 * behaves like the existing crane.
 *
 * Usage:
 *   node scripts/prep-sprite-2color.mjs <input.png> <outdir> <name>
 *   node scripts/prep-sprite-2color.mjs --all [outdir=public/sprites]
 *     (process all design/uploads/1781*.png with the built-in subject names)
 *
 * Tunables (override via env): OUTLINE_LUM, ACCENT_SAT, ACCENT_WARM, BG_LUM,
 * BG_SAT.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SIZE = 256;

// --- Classification thresholds (0..255 for sat/warm, 0..1 for luminance) ---
// Tuned against the actual trimmed renders (not just the spec colours). After
// trim+resize the cream body clusters at saturation ~30 (warm ~0) and the tan
// accent at saturation ~70–93 (warm ~50–90); a clear gap sits between them, so
// saturation is the cleanest body↔accent discriminator. We require the pixel
// to be both saturated AND warm (r>b) so cool neutral shading never reads as
// accent. Outlines are split off first by their very low luminance.
const OUTLINE_LUM = Number(process.env.OUTLINE_LUM ?? 0.3); // < this ⇒ outline
const ACCENT_SAT = Number(process.env.ACCENT_SAT ?? 50); // >= this ⇒ accent
const ACCENT_WARM = Number(process.env.ACCENT_WARM ?? 25); // r-b must exceed this
const BG_LUM = Number(process.env.BG_LUM ?? 0.9); // > this AND ...
const BG_SAT = Number(process.env.BG_SAT ?? 22); // ... < this ⇒ background-ish

const lumOf = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const satOf = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);

// The uploads are wide (1664×928) with one centred subject and a lot of empty
// margin, so we trim the near-white border first and then fit the subject into
// a padded 256 box. Without the trim the subject letterboxes to a thin strip.
const PAD = 12; // px of transparent margin around the subject in the 256 box

/** Load + normalise an upload to a flat, trimmed, centred 256×256 RGB buffer. */
async function loadRGB(input) {
  const inner = SIZE - PAD * 2;
  const { data, info } = await sharp(input)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .trim({ background: "#ffffff", threshold: 25 })
    .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/**
 * Flood-fill the flat near-white background from the four corners. Returns a
 * Uint8Array mask (1 = background). Only the connected near-white region is
 * cleared, so a near-white highlight enclosed by the shape is kept.
 */
function bgMask(data, width, height, channels) {
  const isBgish = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return lumOf(r, g, b) > BG_LUM && satOf(r, g, b) < BG_SAT;
  };
  const mask = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (mask[p]) return;
    if (!isBgish(p * channels)) return;
    mask[p] = 1;
    stack.push(p);
  };
  push(0, 0);
  push(width - 1, 0);
  push(0, height - 1);
  push(width - 1, height - 1);
  while (stack.length) {
    const p = stack.pop();
    const x = p % width, y = (p / width) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  // Some uploads ship with a transparent (checkerboard) background; flattening
  // onto white leaves faint anti-aliased specks that the corner flood-fill
  // can't reach. Clear any remaining near-white, near-neutral pixel globally —
  // the cream body sits well above this saturation/below this luminance, so it
  // is never touched, but stray light specks are.
  for (let p = 0; p < width * height; p++) {
    if (mask[p]) continue;
    const i = p * channels;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (lumOf(r, g, b) > 0.93 && satOf(r, g, b) < 14) mask[p] = 1;
  }
  return mask;
}

/** Classify a non-background pixel: "outline" | "accent" | "body". */
function classify(r, g, b) {
  const lum = lumOf(r, g, b);
  if (lum < OUTLINE_LUM) return "outline";
  const sat = satOf(r, g, b);
  const warm = r - b;
  if (sat >= ACCENT_SAT && warm >= ACCENT_WARM) return "accent";
  return "body";
}

/** Build the two layers for one upload and write them to outdir/<name>{,-accent}.png. */
export async function prep(input, outdir, name) {
  const { data, width, height, channels } = await loadRGB(input);
  const bg = bgMask(data, width, height, channels);

  // RGBA output buffers.
  const base = Buffer.alloc(width * height * 4, 0);
  const accent = Buffer.alloc(width * height * 4, 0);

  for (let p = 0; p < width * height; p++) {
    const i = p * channels; // input stride (RGB after removeAlpha)
    const o = p * 4; // output stride (RGBA)
    if (bg[p]) continue; // transparent in both layers
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = lumOf(r, g, b);
    const gray = Math.round(lum * 255);
    const kind = classify(r, g, b);

    if (kind === "accent") {
      // Accent layer carries the luminance; base punches a hole here so the
      // accent shows through from beneath.
      accent[o] = accent[o + 1] = accent[o + 2] = gray;
      accent[o + 3] = 255;
      // base stays transparent (the hole)
    } else {
      // outline + body live on the base layer as luminance.
      base[o] = base[o + 1] = base[o + 2] = gray;
      base[o + 3] = 255;
    }
  }

  // Coverage report + accent decision. If the accent region is negligible
  // (e.g. the envelope is pure cream + outline), the tan classification only
  // caught stray AA pixels — write the base WITHOUT a hole and skip the accent
  // layer so the sprite behaves as a clean single-colour one (like the crane).
  let nBase = 0, nAcc = 0;
  for (let p = 0; p < width * height; p++) {
    if (base[p * 4 + 3]) nBase++;
    if (accent[p * 4 + 3]) nAcc++;
  }
  const MIN_ACCENT = 200; // px — below this, treat as a single-layer sprite.
  const twoLayer = nAcc >= MIN_ACCENT;

  if (!twoLayer && nAcc > 0) {
    // Fold the few stray accent pixels back into the base so there's no hole.
    for (let p = 0; p < width * height; p++) {
      const o = p * 4;
      if (accent[o + 3] && !base[o + 3]) {
        base[o] = accent[o];
        base[o + 1] = accent[o + 1];
        base[o + 2] = accent[o + 2];
        base[o + 3] = 255;
      }
    }
  }

  await mkdir(outdir, { recursive: true });
  const basePath = path.join(outdir, `${name}.png`);
  const accentPath = path.join(outdir, `${name}-accent.png`);
  await sharp(base, { raw: { width, height, channels: 4 } }).png().toFile(basePath);
  if (twoLayer) {
    await sharp(accent, { raw: { width, height, channels: 4 } }).png().toFile(accentPath);
  }

  console.log(
    `${name}: base ${nBase}px, accent ${nAcc}px ${twoLayer ? "→ two-layer" : "→ single-layer (accent skipped)"} → ${basePath}`,
  );
  return { basePath, accentPath: twoLayer ? accentPath : null, nBase, nAcc, twoLayer };
}

// Default subject naming for the batch run, in the SORTED order of the
// design/uploads/1781*.png files. Disambiguated duplicates: swan/swan2,
// dove/dove2. See the contact sheet used to derive these.
const BATCH_NAMES = [
  "swan", "envelope", "rocket", "swan2", "butterfly", "songbird", "sparrow",
  "heart", "dove", "eagle", "dove2", "submarine", "leaf",
];

async function batch(outdir) {
  const { readdirSync } = await import("node:fs");
  const dir = "design/uploads";
  const files = readdirSync(dir).filter((f) => /^1781.*\.png$/.test(f)).sort();
  if (files.length !== BATCH_NAMES.length) {
    throw new Error(`expected ${BATCH_NAMES.length} uploads, found ${files.length}`);
  }
  for (let i = 0; i < files.length; i++) {
    await prep(path.join(dir, files[i]), outdir, BATCH_NAMES[i]);
  }
  console.log(`\nbatch done: ${files.length} subjects → ${outdir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , a1, a2, a3] = process.argv;
  if (a1 === "--all") {
    // node scripts/prep-sprite-2color.mjs --all [outdir=public/sprites]
    await batch(a2 ?? "public/sprites");
  } else if (a1 && a2 && a3) {
    await prep(a1, a2, a3);
  } else {
    console.error(
      "usage:\n  prep-sprite-2color.mjs <input.png> <outdir> <name>\n  prep-sprite-2color.mjs --all [outdir=public/sprites]",
    );
    process.exit(1);
  }
}

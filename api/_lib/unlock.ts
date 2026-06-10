import { Rng, hashStringToSeed } from "../../src/game/rng";
import { classifyRarity, type Rarity } from "../../src/game/rarity";
import { encodeSkin, type SkinColors } from "../../src/game/skin";

export const UNLOCK_THRESHOLDS: readonly number[] = [1, 10, 50, 100, 200, 500, 1000, 2000, 5000];

export function thresholdsCrossed(prev: number, next: number): number[] {
  return UNLOCK_THRESHOLDS.filter((t) => prev < t && next >= t);
}

export interface GeneratedSkin {
  threshold: number;
  skin: SkinColors;
  rarity: Rarity;
  encoded: bigint;
}

export function generateSkinForThreshold(userId: string, threshold: number): GeneratedSkin {
  // Bias toward more interesting hues: pick two LCH-ish points by
  // sampling chroma > 30 and any hue. Higher thresholds widen the
  // chroma floor so unlocks at 1000 / 2000 / 5000 trend toward epic+.
  const minChroma = threshold >= 500 ? 80 : threshold >= 100 ? 60 : 30;
  const { skin, rarity, encoded } = generateSkinFromKey(`pflug-skin:${userId}:${threshold}`, minChroma);
  return { threshold, skin, rarity, encoded };
}

/** Deterministic skin mint for an arbitrary key (thresholds, daily champions, …). */
export function generateSkinFromKey(
  key: string,
  minChroma: number,
): { skin: SkinColors; rarity: Rarity; encoded: bigint } {
  const rng = new Rng(hashStringToSeed(key));
  const body = sampleColor(rng, minChroma);
  const accent = sampleColor(rng, minChroma);
  const skin: SkinColors = { body, accent };
  const rarity = classifyRarity(skin).rarity;
  return { skin, rarity, encoded: encodeSkin(skin) };
}

function sampleColor(rng: Rng, minChromaTarget: number): [number, number, number] {
  // Sample HSL with a chroma-friendly bias by drawing saturation in
  // [0.55, 1.0] and lightness in [0.35, 0.7]. Mapped to RGB via the
  // standard HSL -> RGB conversion.
  const h = rng.next();
  const sLow = Math.min(0.99, 0.55 + minChromaTarget / 200);
  const s = sLow + rng.next() * (1.0 - sLow);
  const l = 0.35 + rng.next() * 0.35;
  return hslToRgb(h, s, l);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h * 6) % 6;
  let r = 0;
  let g = 0;
  let b = 0;
  if (seg === 0) [r, g, b] = [c, x, 0];
  else if (seg === 1) [r, g, b] = [x, c, 0];
  else if (seg === 2) [r, g, b] = [0, c, x];
  else if (seg === 3) [r, g, b] = [0, x, c];
  else if (seg === 4) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

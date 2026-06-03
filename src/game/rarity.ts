import { deltaE2000, hueDistanceDeg, rgbToLch, type RGB } from "./color";
import type { SkinColors } from "./skin";

// "red" is a mythic tier ABOVE legendary. classifyRarity() NEVER returns it —
// it's granted by the dev / special events only (so it can't be farmed by
// picking the right colours) and stored directly on the skin row.
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "red";

// Background that skins are seen against in-game. ΔE against this
// matters for whether the skin is even legible. ΔE against the
// background is averaged across body and accent.
const SKY: RGB = [135, 206, 235];

const COMPLEMENTARY_TOLERANCE_DEG = 25;
const VIVID_MIN_CHROMA = 30;
const VIVID_MEAN_CHROMA = 50;

export interface RarityScore {
  rarity: Rarity;
  pairDeltaE: number;
  skyDeltaE: number;
  bodyChroma: number;
  accentChroma: number;
  hueGapDeg: number;
}

export function classifyRarity(skin: SkinColors): RarityScore {
  const pairDeltaE = deltaE2000(skin.body, skin.accent);
  const skyDeltaE = (deltaE2000(skin.body, SKY) + deltaE2000(skin.accent, SKY)) / 2;
  const bodyLch = rgbToLch(skin.body);
  const accentLch = rgbToLch(skin.accent);
  const bodyChroma = bodyLch.C;
  const accentChroma = accentLch.C;
  const hueGapDeg = hueDistanceDeg(bodyLch.H, accentLch.H);

  const visible = skyDeltaE > 12;
  const highPairContrast = pairDeltaE > 45;
  const meanChroma = (bodyChroma + accentChroma) / 2;
  const minChroma = Math.min(bodyChroma, accentChroma);
  const vivid = meanChroma > VIVID_MEAN_CHROMA && minChroma > VIVID_MIN_CHROMA;
  const complementary = Math.abs(hueGapDeg - 180) < COMPLEMENTARY_TOLERANCE_DEG;

  let rarity: Rarity = "common";
  if (visible && pairDeltaE > 18) rarity = "uncommon";
  if (visible && pairDeltaE > 32 && (bodyChroma > 30 || accentChroma > 30)) rarity = "rare";
  if (visible && highPairContrast && vivid) rarity = "epic";
  if (visible && highPairContrast && vivid && complementary) rarity = "legendary";

  return { rarity, pairDeltaE, skyDeltaE, bodyChroma, accentChroma, hueGapDeg };
}

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "red"];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9ca3af",
  uncommon: "#34d399",
  rare: "#60a5fa",
  epic: "#c084fc",
  legendary: "#facc15",
  red: "#ef4444",
};

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

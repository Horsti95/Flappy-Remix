/**
 * Deterministic colour-pair name. Procedurally-minted skins carry no authored
 * name (just RGB + rarity), so the gallery used to show "epic @17". This maps a
 * body+accent pair to a readable palette name — e.g. crimson body + near-black
 * accent → "crimson ink" — purely from the colours, so the same skin always
 * reads the same (no server/name storage needed).
 *
 * name = <tone?> <body hue word> <accent finish noun>, e.g. "deep teal dusk".
 */
type RGB = [number, number, number];

function toHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

// Hue buckets (upper bound, name). Wraps: >330 → rose.
const HUE_WORDS: Array<[number, string]> = [
  [15, "crimson"], [40, "amber"], [65, "gold"], [90, "lime"], [150, "green"],
  [175, "teal"], [200, "cyan"], [225, "sky"], [255, "azure"], [280, "indigo"],
  [310, "violet"], [330, "magenta"], [360, "rose"],
];

function hueWord(h: number, s: number, l: number): string {
  if (s < 0.12) {
    // Near-neutral → greyscale words by lightness.
    if (l < 0.22) return "charcoal";
    if (l < 0.45) return "slate";
    if (l < 0.72) return "silver";
    return "chalk";
  }
  return HUE_WORDS.find(([ub]) => h < ub)?.[1] ?? "rose";
}

/** Finish noun from the accent's lightness — the "second word". */
function accentFinish(l: number): string {
  if (l < 0.15) return "ink";
  if (l < 0.3) return "shadow";
  if (l < 0.45) return "dusk";
  if (l < 0.6) return "slate";
  if (l < 0.78) return "haze";
  return "mist";
}

export function colorName(body: RGB, accent: RGB): string {
  const b = toHsl(body[0], body[1], body[2]);
  const a = toHsl(accent[0], accent[1], accent[2]);
  const base = hueWord(b.h, b.s, b.l);
  // Tone prefix only for chromatic bodies at the extremes (greys already
  // encode lightness in their word).
  let tone = "";
  if (b.s >= 0.12) {
    if (b.l < 0.26) tone = "deep ";
    else if (b.l > 0.78) tone = "pale ";
  }
  return `${tone}${base} ${accentFinish(a.l)}`;
}

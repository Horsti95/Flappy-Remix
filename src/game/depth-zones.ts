import type { ThemeId } from "./themes";

/**
 * Depth zones — a "where am I now" progression *within a single run*, layered
 * on top of the score. Every ZONE_STEP points you advance to the next zone in
 * the equipped theme's ladder (e.g. space: city → orbit → solar system →
 * galaxy). Purely cosmetic: a label + an optional sky tint shift. The sim is
 * untouched, so determinism/replays are unaffected.
 *
 * PROTOTYPE — this is the first cut of the "go deeper / zoom out" idea. The
 * ladders are placeholders; tune copy + add per-zone art once the feel is
 * approved.
 */

export const ZONE_STEP = 25;

export interface Zone {
  label: string;
  /** Optional extra darken/tint applied over the theme, 0..1. */
  tint?: { color: string; alpha: number };
}

// Theme → ordered list of zones (index 0 = score 0..ZONE_STEP-1, etc.).
// Themes not listed here get no zone overlay.
const LADDERS: Partial<Record<ThemeId, Zone[]>> = {
  space: [
    { label: "🏙️ City lights" },
    { label: "🌆 Stratosphere", tint: { color: "#0b0626", alpha: 0.15 } },
    { label: "🛰️ Low orbit", tint: { color: "#0b0626", alpha: 0.3 } },
    { label: "🪐 Solar system", tint: { color: "#05030f", alpha: 0.45 } },
    { label: "🌌 The galaxy", tint: { color: "#05030f", alpha: 0.6 } },
  ],
  ocean: [
    { label: "🏖️ Shallows" },
    { label: "🐠 Reef", tint: { color: "#04263f", alpha: 0.15 } },
    { label: "🌊 Open water", tint: { color: "#04263f", alpha: 0.3 } },
    { label: "🦑 The deep", tint: { color: "#021018", alpha: 0.45 } },
    { label: "🕳️ The trench", tint: { color: "#01080f", alpha: 0.62 } },
  ],
};

/** The active zone for a theme + score, or null if the theme has no ladder. */
export function zoneFor(theme: ThemeId, score: number): Zone | null {
  const ladder = LADDERS[theme];
  if (!ladder) return null;
  const idx = Math.min(Math.floor(score / ZONE_STEP), ladder.length - 1);
  return ladder[idx];
}

export function hasZones(theme: ThemeId): boolean {
  return LADDERS[theme] !== undefined;
}

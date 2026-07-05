/**
 * Pillar colour — an optional player-pick that overrides the theme's pipe
 * colours for the equipped pillar style (so e.g. the candy style can be
 * red/white, the bamboo green, etc). "theme" keeps the theme's own colours.
 *
 * Cosmetic only; never touches the sim. High-contrast mode ignores it so the
 * a11y palette stays intact (handled in the renderer).
 */

import type { AchievementStats } from "./achievements";
import { isEventGranted } from "./events";

export interface PillarColor {
  id: string;
  name: string;
  /** Empty when id === "theme" (renderer falls back to the theme palette). */
  body: string;
  cap: string;
  /** Light unlock gate, mirroring pillar STYLES. "theme" is always free. */
  unlock(stats: AchievementStats): { unlocked: boolean; hint?: string };
}

export const PILLAR_COLORS: PillarColor[] = [
  { id: "theme",   name: "theme",   body: "",        cap: "",
    unlock: () => ({ unlocked: true }) },
  { id: "forest",  name: "forest",  body: "#3d8b58", cap: "#1f4f37",
    unlock: (s) => ({ unlocked: s.totalGames >= 5, hint: "play 5 games" }) },
  { id: "candy",   name: "candy",   body: "#e23b3b", cap: "#ffffff",
    unlock: (s) => ({ unlocked: s.totalGames >= 12, hint: "play 12 games" }) },
  { id: "sky",     name: "sky",     body: "#38bdf8", cap: "#0c4a6e",
    unlock: (s) => ({ unlocked: s.totalGames >= 15, hint: "play 15 games" }) },
  { id: "germany", name: "germany", body: "#dd0000", cap: "#ffce00",
    unlock: (s) => ({ unlocked: s.totalGames >= 25, hint: "play 25 games" }) },
  { id: "mint",    name: "mint",    body: "#5eead4", cap: "#0f4c4a",
    unlock: (s) => ({ unlocked: s.bestScore >= 20, hint: "score 20 in a single run" }) },
  { id: "gold",    name: "gold",    body: "#facc15", cap: "#5a4500",
    unlock: (s) => ({ unlocked: s.bestScore >= 40, hint: "score 40 in a single run" }) },
  { id: "grape",   name: "grape",   body: "#a855f7", cap: "#3a0a5e",
    unlock: (s) => ({ unlocked: s.totalScore >= 1000, hint: "score 1000 lifetime points" }) },
  { id: "mono",    name: "mono",    body: "#e6e6e6", cap: "#1a1a1a",
    unlock: (s) => ({ unlocked: s.streakDays >= 5, hint: "5-day streak" }) },
  // --- Variety pass: each gated on a *different* axis so unlocks don't all
  //     read as "reach a bigger number" (see docs / unlock-criteria ideas). ---
  { id: "marble",     name: "marble",     body: "#e8e8ea", cap: "#9a9aa0",
    unlock: (s) => ({ unlocked: s.bestScore >= 90, hint: "score 90 in a single run" }) },
  { id: "sunrise",    name: "sunrise",    body: "#ff9e5e", cap: "#c63b6e",
    unlock: (s) => ({ unlocked: s.dailyStreakDays >= 10, hint: "score 20+ on the daily 10 days running" }) },
  { id: "thunderhead", name: "thunderhead", body: "#4b5563", cap: "#1f2937",
    unlock: (s) => ({ unlocked: s.hardDailyBest >= 50, hint: "score 50+ on a hard daily" }) },
  { id: "moonlit",    name: "moonlit",    body: "#3b4a8c", cap: "#161f3f",
    unlock: (s) => ({ unlocked: s.nightGames >= 30, hint: "play 30 night games (22:00–04:00)" }) },
];

const BY_ID = new Map(PILLAR_COLORS.map((c) => [c.id, c]));

/** The chosen colour, or null for "theme" (use the theme's pipe colours). */
export function getPillarColor(id: string | null | undefined): PillarColor | null {
  if (!id || id === "theme") return null;
  return BY_ID.get(id) ?? null;
}

const KEY = "pflug.pillarColor.v1";

export function getEquippedPillarColorLocal(): string {
  try {
    return localStorage.getItem(KEY) ?? "theme";
  } catch {
    return "theme";
  }
}

export function setEquippedPillarColorLocal(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* localStorage blocked */
  }
}

// Lab mode bypasses every gate (used by playtester/dev tooling), mirroring
// preset-skins.ts / themes.ts.
let labMode = false;
export function setPillarColorLabMode(on: boolean): void { labMode = on; }
export function isPillarColorLabMode(): boolean { return labMode; }

/** Evaluate a pillar colour's unlock, honouring lab mode. */
export function pillarColorUnlocked(
  color: PillarColor,
  stats: AchievementStats,
): { unlocked: boolean; hint?: string } {
  if (labMode) return { unlocked: true };
  if (isEventGranted("pillar", color.id)) return { unlocked: true };
  return color.unlock(stats);
}

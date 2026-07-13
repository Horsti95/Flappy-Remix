import type { AchievementStats } from "./achievements";
import { isEventGranted } from "./events";
import type { UnlockResult } from "./unlockables";

/**
 * Gate-pass sound styles. Every style still pitches with the gap's vertical
 * position (high gap → higher, low gap → lower); they differ in timbre and
 * how wide that pitch swing is. Like skins, extra styles unlock from play
 * stats; the chosen one is stored client-side and read by playGatePass().
 */

export type GateSoundId = "classic" | "glide" | "wide" | "marimba" | "koto" | "pop_choir";

export interface GateSoundStyle {
  id: GateSoundId;
  name: string;
  blurb: string;
  unlock(stats: AchievementStats): UnlockResult;
}

export const GATE_SOUNDS: GateSoundStyle[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "the original two-note chirp",
    unlock: () => ({ unlocked: true }),
  },
  {
    id: "glide",
    name: "Glide",
    blurb: "one clean tone that slides with the gap",
    unlock: (s) => ({ unlocked: s.totalGames >= 25, hint: "play 25 games" }),
  },
  {
    id: "wide",
    name: "Wide",
    blurb: "two octaves — high and low gaps sound worlds apart",
    unlock: (s) => ({ unlocked: s.bestScore >= 100, hint: "score 100 in a run" }),
  },
  {
    id: "marimba",
    name: "Marimba",
    blurb: "warm, bell-like mallet tone",
    unlock: (s) => ({ unlocked: s.streakDays >= 7, hint: "7-day streak" }),
  },
  {
    id: "koto",
    name: "Koto",
    blurb: "a plucked string — bright attack, woody decay",
    unlock: (s) => ({ unlocked: s.bestScore >= 50, hint: "score 50 in a run" }),
  },
  {
    id: "pop_choir",
    name: "Pop choir",
    blurb: "a tiny two-note major chime",
    unlock: (s) => ({ unlocked: s.totalGames >= 100, hint: "play 100 games" }),
  },
];

const KEY = "pflug.gateSound.v1";

export function getEquippedGateSound(): GateSoundId {
  try {
    const v = localStorage.getItem(KEY) as GateSoundId | null;
    if (v && GATE_SOUNDS.some((g) => g.id === v)) return v;
  } catch {
    /* localStorage blocked */
  }
  return "classic";
}

export function setEquippedGateSound(id: GateSoundId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* localStorage blocked */
  }
}

export function getGateSound(id: string): GateSoundStyle | null {
  return GATE_SOUNDS.find((g) => g.id === id) ?? null;
}

let labMode = false;
export function setGateSoundLabMode(on: boolean): void {
  labMode = on;
}

export function gateSoundUnlocked(
  style: GateSoundStyle,
  stats: AchievementStats,
): UnlockResult {
  if (labMode) return { unlocked: true };
  if (isEventGranted("gate", style.id)) return { unlocked: true };
  return style.unlock(stats);
}

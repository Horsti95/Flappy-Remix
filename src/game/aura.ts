import type { AchievementStats } from "./achievements";
import type { UnlockResult } from "./unlockables";

/**
 * Auras — prestige glow effects drawn behind the player's plane. The point
 * is VISIBLE accomplishment: an aura is earned, never minted, and reads from
 * across the screen (and in ghost duels). Render-layer only — never touches
 * the sim. Off by default; equipping is a choice, not an auto-grant.
 */

export type AuraId = "off" | "gold_leaf" | "moonlight" | "ember";

export interface AuraOption {
  id: AuraId;
  label: string;
  blurb: string;
  /** Halo color while flying (CSS-able rgb triple). */
  color: [number, number, number];
  unlock(stats: AchievementStats): UnlockResult;
}

export const AURA_OPTIONS: AuraOption[] = [
  {
    id: "off",
    label: "No aura",
    blurb: "clean paper, no shine",
    color: [0, 0, 0],
    unlock: () => ({ unlocked: true }),
  },
  {
    id: "gold_leaf",
    label: "Gold leaf",
    blurb: "a gilded shimmer — you posted a 100",
    color: [255, 200, 80],
    unlock: (s) => ({ unlocked: s.bestScore >= 100, hint: "score 100 in a single run" }),
  },
  {
    id: "moonlight",
    label: "Moonlight",
    blurb: "a cool silver halo for night flyers",
    color: [200, 215, 255],
    unlock: (s) => ({ unlocked: s.nightGames >= 30, hint: "play 30 night games (22:00–04:00)" }),
  },
  {
    id: "ember",
    label: "Ember",
    blurb: "a warm glow that never went out — 30-day streak",
    color: [255, 130, 50],
    unlock: (s) => ({ unlocked: s.streakDays >= 30, hint: "30-day streak" }),
  },
];

const KEY = "pflug.aura.v1";

export function getEquippedAura(): AuraId {
  try {
    const stored = localStorage.getItem(KEY) as AuraId | null;
    if (stored && AURA_OPTIONS.some((o) => o.id === stored)) return stored;
  } catch {
    /* localStorage blocked */
  }
  return "off";
}

export function setEquippedAura(id: AuraId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* localStorage blocked */
  }
}

export function auraColor(id: AuraId): [number, number, number] | null {
  if (id === "off") return null;
  return AURA_OPTIONS.find((o) => o.id === id)?.color ?? null;
}

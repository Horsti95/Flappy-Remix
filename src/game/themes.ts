/**
 * Theme registry.
 *
 * A theme is the visual environment the player flies through: sky
 * gradient, pipe colors, optional overlay (fog/blinding sun/etc).
 * Themes are independent of shapes and skins — they layer underneath
 * everything else the renderer draws.
 *
 * For now themes are picked manually (always 'sunny' until the local-
 * time ambient sky or daily visual-modifier work lands). The
 * abstraction is here so those future features have a slot to plug
 * into without another render.ts refactor.
 */

export type ThemeId = "sunny" | "cloudy" | "sunset" | "night" | "dawn" | "fog";

export interface ThemeColors {
  skyTop: string;
  skyBottom: string;
  pipeBody: string;
  pipeCap: string;
  /** Optional bright spotlight overlay (e.g. blinding sun). */
  sunSpot?: { x: number; y: number; r: number; color: string; opacity: number };
  /** Optional visibility fog around the bird, 0..1 (0 = none, 1 = total). */
  fogIntensity?: number;
  /** High-contrast accessibility variant — drawn when the player toggles contrast mode. */
  highContrast: {
    skyTop: string;
    skyBottom: string;
    pipeBody: string;
    pipeCap: string;
  };
}

export interface Theme {
  id: ThemeId;
  name: string;
  blurb: string;
  colors: ThemeColors;
  unlock(stats: { totalGames: number; bestScore: number; streakDays: number; lateNightGames?: number }): { unlocked: boolean; hint?: string };
}

const HC_DEFAULT = {
  skyTop: "#000000",
  skyBottom: "#202020",
  pipeBody: "#ffffff",
  pipeCap: "#cccccc",
};

export const THEMES: Theme[] = [
  {
    id: "sunny",
    name: "sunny",
    blurb: "the default sky.",
    colors: {
      skyTop: "#87ceeb",
      skyBottom: "#b3e5fc",
      pipeBody: "#3d8b58",
      pipeCap: "#2b6f4d",
      highContrast: HC_DEFAULT,
    },
    unlock: () => ({ unlocked: true }),
  },
  {
    id: "cloudy",
    name: "cloudy",
    blurb: "pale grey-blue, soft.",
    colors: {
      skyTop: "#b8c2cc",
      skyBottom: "#d6dee5",
      pipeBody: "#8b9b8e",
      pipeCap: "#5f6b62",
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.totalGames >= 25, hint: "play 25 games" }),
  },
  {
    id: "sunset",
    name: "sunset",
    blurb: "purple → orange → gold.",
    colors: {
      skyTop: "#3a1f5e",
      skyBottom: "#f9c784",
      pipeBody: "#1f3540",
      pipeCap: "#0e1f29",
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.bestScore >= 50, hint: "score 50 in a single run" }),
  },
  {
    id: "dawn",
    name: "dawn",
    blurb: "pink wash, early-morning calm.",
    colors: {
      skyTop: "#2a1a3e",
      skyBottom: "#f4a6c0",
      pipeBody: "#5a4358",
      pipeCap: "#3a2839",
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.totalGames >= 100, hint: "play 100 games" }),
  },
  {
    id: "night",
    name: "night sky",
    blurb: "deep blue, distant stars.",
    colors: {
      skyTop: "#0b1226",
      skyBottom: "#1a2c4e",
      pipeBody: "#2b6f4d",
      pipeCap: "#1f4f37",
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({
      unlocked: (s.lateNightGames ?? 0) >= 1,
      hint: "play a run between 23:00 and 04:00",
    }),
  },
  {
    id: "fog",
    name: "fog",
    blurb: "limited visibility around the plane.",
    colors: {
      skyTop: "#cdd6dd",
      skyBottom: "#e7ecf0",
      pipeBody: "#3d8b58",
      pipeCap: "#2b6f4d",
      fogIntensity: 0.85,
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.bestScore >= 200, hint: "score 200 in a single run" }),
  },
];

const BY_ID = new Map<ThemeId, Theme>(THEMES.map((t) => [t.id, t]));

export const DEFAULT_THEME_ID: ThemeId = "sunny";

export function getTheme(id: ThemeId | string | null | undefined): Theme {
  if (!id) return BY_ID.get(DEFAULT_THEME_ID)!;
  return BY_ID.get(id as ThemeId) ?? BY_ID.get(DEFAULT_THEME_ID)!;
}

const THEME_KEY = "pflug.equippedTheme.v1";

export function getEquippedThemeLocal(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY) as ThemeId | null;
    if (v && BY_ID.has(v)) return v;
  } catch {
    /* localStorage blocked */
  }
  return DEFAULT_THEME_ID;
}

export function setEquippedThemeLocal(id: ThemeId): void {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    /* ignore */
  }
}

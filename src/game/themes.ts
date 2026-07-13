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

import type { AchievementStats } from "./achievements";
import type { UnlockResult } from "./unlockables";

export type ThemeId =
  | "sunny"
  | "cloudy"
  | "sunset"
  | "night"
  | "dawn"
  | "fog"
  | "beach"
  | "cyber_neon"
  | "cyber_sunset"
  | "cyber_rain"
  | "cyber_noir"
  | "neo_city"
  | "fairy_spires"
  | "ocean"
  | "space"
  | "stadium"
  | "ascent";

export interface CityBuilding {
  /** Left edge in world-units (world width is 360). */
  x: number;
  /** Width in world-units. */
  w: number;
  /** Top edge in world-units (world height is 640). */
  topY: number;
  /** Optional roof feature. */
  top?: "flat" | "antenna" | "step";
}

export interface CityLayer {
  silhouetteColor: string;
  /** Neon palette to colour window lights. Rotated per-building. */
  neonAccents: string[];
  buildings: CityBuilding[];
}

export interface HorizonBand {
  /** Top edge in world-units (world height is 640). */
  topY: number;
  /** Top color of the band gradient. */
  topColor: string;
  /** Bottom color of the band gradient (gradient runs to worldHeight). */
  bottomColor: string;
  /** Optional secondary band — drawn on top of the first (e.g. sand on water). */
  second?: { topY: number; topColor: string; bottomColor: string };
}

export interface ThemeColors {
  skyTop: string;
  skyBottom: string;
  pipeBody: string;
  pipeCap: string;
  /** Optional bright spotlight overlay (e.g. blinding sun). */
  sunSpot?: { x: number; y: number; r: number; color: string; opacity: number };
  /** Optional visibility fog around the bird, 0..1 (0 = none, 1 = total). */
  fogIntensity?: number;
  /** Optional skyline rendered between sky and pipes. */
  cityLayer?: CityLayer;
  /** Optional horizon band (ocean/sand/desert) painted under the pipes. */
  horizonBand?: HorizonBand;
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
  /** Optional full-bleed background image id (see game/backgrounds.ts). When
   *  its art is loaded the renderer paints it instead of the gradient. */
  backgroundImage?: string;
  /** Optional interactive backdrop: the renderer picks the image for the
   *  highest `fromScore` the player has reached, so the scene changes as the
   *  run climbs. Must be sorted ascending by `fromScore` (first entry is the
   *  starting backdrop, ideally fromScore 0). Cosmetic — never read by the sim. */
  backgroundStages?: { fromScore: number; image: string }[];
  unlock(stats: AchievementStats): UnlockResult;
}

const HC_DEFAULT = {
  skyTop: "#000000",
  skyBottom: "#202020",
  pipeBody: "#ffffff",
  pipeCap: "#cccccc",
};

// Skylines are static silhouettes painted between the sky gradient and
// the pipes. World is 360 wide / 640 tall; lower topY = taller building.
const SKYLINE_A: CityBuilding[] = [
  { x: 0,   w: 38, topY: 320, top: "antenna" },
  { x: 36,  w: 56, topY: 240, top: "step" },
  { x: 90,  w: 48, topY: 290, top: "flat" },
  { x: 136, w: 64, topY: 210, top: "antenna" },
  { x: 198, w: 44, topY: 270, top: "step" },
  { x: 240, w: 60, topY: 200, top: "flat" },
  { x: 296, w: 64, topY: 250, top: "antenna" },
];
const SKYLINE_B: CityBuilding[] = [
  { x: 0,   w: 52, topY: 300, top: "flat" },
  { x: 50,  w: 38, topY: 260, top: "step" },
  { x: 86,  w: 70, topY: 230, top: "flat" },
  { x: 154, w: 38, topY: 270, top: "antenna" },
  { x: 190, w: 56, topY: 240, top: "flat" },
  { x: 244, w: 50, topY: 280, top: "step" },
  { x: 292, w: 68, topY: 220, top: "antenna" },
];
const SKYLINE_C: CityBuilding[] = [
  { x: 0,   w: 44, topY: 280, top: "step" },
  { x: 42,  w: 36, topY: 320, top: "flat" },
  { x: 76,  w: 60, topY: 220, top: "antenna" },
  { x: 134, w: 50, topY: 260, top: "flat" },
  { x: 182, w: 70, topY: 200, top: "step" },
  { x: 250, w: 46, topY: 290, top: "flat" },
  { x: 294, w: 66, topY: 230, top: "antenna" },
];
const SKYLINE_D: CityBuilding[] = [
  { x: 0,   w: 60, topY: 250, top: "antenna" },
  { x: 58,  w: 42, topY: 300, top: "flat" },
  { x: 98,  w: 52, topY: 230, top: "step" },
  { x: 148, w: 38, topY: 290, top: "flat" },
  { x: 184, w: 70, topY: 200, top: "antenna" },
  { x: 252, w: 48, topY: 270, top: "step" },
  { x: 298, w: 62, topY: 240, top: "flat" },
];

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
      unlocked: (s.lateNightGames ?? 0) >= 5,
      hint: "play 5 runs between 23:00 and 04:00",
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
    unlock: (s) => ({ unlocked: s.bestScore >= 120, hint: "score 120 in a single run" }),
  },
  {
    id: "beach",
    name: "beach",
    blurb: "warm horizon over turquoise water and sand.",
    colors: {
      skyTop: "#fde2a4",
      skyBottom: "#ffd3a3",
      pipeBody: "#86b6c2",
      pipeCap: "#5a8a96",
      horizonBand: {
        topY: 380,
        topColor: "#5fb8c4",
        bottomColor: "#2c7a8a",
        second: {
          topY: 530,
          topColor: "#f3d28a",
          bottomColor: "#d6a861",
        },
      },
      sunSpot: { x: 100, y: 200, r: 110, color: "#fff2c4", opacity: 0.7 },
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: (s.morningGames ?? 0) >= 5, hint: "play 5 morning runs (05:00–07:00)" }),
  },
  {
    id: "cyber_neon",
    name: "neo tokyo",
    blurb: "violet sky over a glowing skyline.",
    colors: {
      skyTop: "#1a0d2e",
      skyBottom: "#6b1f8a",
      pipeBody: "#1f1633",
      pipeCap: "#ff2bd6",
      cityLayer: {
        silhouetteColor: "#0b0816",
        neonAccents: ["#ff2bd6", "#21e5ff", "#a0ff00", "#ffea00"],
        buildings: SKYLINE_A,
      },
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.totalGames >= 50, hint: "play 50 games" }),
  },
  {
    id: "cyber_sunset",
    name: "miami drive",
    blurb: "synthwave sunset, ocean horizon.",
    colors: {
      skyTop: "#ff2d75",
      skyBottom: "#ff8c42",
      pipeBody: "#0d2238",
      pipeCap: "#21e5ff",
      cityLayer: {
        silhouetteColor: "#0b1626",
        neonAccents: ["#21e5ff", "#ff2d75", "#ffea00"],
        buildings: SKYLINE_B,
      },
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.bestScore >= 75, hint: "score 75 in a single run" }),
  },
  {
    id: "cyber_rain",
    name: "acid rain",
    blurb: "wet city, toxic green neons.",
    colors: {
      skyTop: "#0d1f1a",
      skyBottom: "#1b3a32",
      pipeBody: "#0a1410",
      pipeCap: "#39ff14",
      cityLayer: {
        silhouetteColor: "#070d0b",
        neonAccents: ["#39ff14", "#ffea00", "#21e5ff"],
        buildings: SKYLINE_C,
      },
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: (s.dailyStreakDays ?? 0) >= 3, hint: "3-day daily streak with 20+ scores" }),
  },
  {
    id: "cyber_noir",
    name: "blood district",
    blurb: "crimson haze, shadow towers.",
    colors: {
      skyTop: "#1a0608",
      skyBottom: "#4a0e14",
      pipeBody: "#0e0205",
      pipeCap: "#ff2b3d",
      cityLayer: {
        silhouetteColor: "#06010a",
        neonAccents: ["#ff2b3d", "#ff9a2b", "#ffe14d"],
        buildings: SKYLINE_D,
      },
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: (s.challengeWins ?? 0) >= 5, hint: "win 5 challenges" }),
  },
  {
    id: "neo_city",
    name: "neo city",
    blurb: "a painted neon skyline — full-art background.",
    backgroundImage: "neo-city",
    colors: {
      // Fallback gradient (shown until the image loads / if it fails).
      skyTop: "#1b1140",
      skyBottom: "#3a2a6a",
      pipeBody: "#2a1d52",
      pipeCap: "#ff5cc8",
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.bestScore >= 75, hint: "score 75 in a single run" }),
  },
  {
    id: "fairy_spires",
    name: "fairy spires",
    blurb: "pink dreamlike towers — full-art background.",
    backgroundImage: "fairy-spires",
    colors: {
      skyTop: "#8ec5ff",
      skyBottom: "#e3b8ff",
      pipeBody: "#d98fc8",
      pipeCap: "#a85aa0",
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.streakDays >= 7, hint: "7-day streak" }),
  },
  {
    id: "ocean",
    name: "ocean",
    blurb: "dive below — deep blue water + drifting bubbles.",
    colors: {
      skyTop: "#1b6fa8",
      skyBottom: "#04263f",
      pipeBody: "#0e7c8c",
      pipeCap: "#0a5560",
      fogIntensity: 0.18,
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.totalGames >= 40, hint: "play 40 games" }),
  },
  {
    id: "space",
    name: "space",
    blurb: "the void — starfield + distant nebula.",
    colors: {
      skyTop: "#0b0626",
      skyBottom: "#020210",
      pipeBody: "#3a2d6e",
      pipeCap: "#6b54c4",
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.bestScore >= 90, hint: "score 90 in a single run" }),
  },
  {
    id: "stadium",
    name: "stadium",
    blurb: "match day — packed stands sweeping down to the pitch.",
    backgroundImage: "stadium",
    colors: {
      // Fallback gradient (shown until the full-art image loads). Sampled to
      // blend with the painted sky/pitch so the swap is barely noticeable.
      skyTop: "#7db4e6",
      skyBottom: "#bfe0c0",
      pipeBody: "#e6e9ee",
      pipeCap: "#aab2bd",
      highContrast: HC_DEFAULT,
    },
    unlock: (s) => ({ unlocked: s.bestScore >= 40, hint: "score 40 in a single run" }),
  },
  {
    id: "ascent",
    name: "the ascent",
    blurb: "legendary — the world zooms out as you climb: street → galaxy.",
    // Fallback gradient (street-dusk) shown until the first stage image loads.
    colors: {
      skyTop: "#caa6d8",
      skyBottom: "#f6c98f",
      pipeBody: "#6b4a7a",
      pipeCap: "#3f2b49",
      highContrast: HC_DEFAULT,
    },
    backgroundStages: [
      { fromScore: 0, image: "ascent-street" },
      { fromScore: 10, image: "ascent-suburb" },
      { fromScore: 20, image: "ascent-city" },
      { fromScore: 35, image: "ascent-countryside" },
      { fromScore: 50, image: "ascent-mountains" },
      { fromScore: 70, image: "ascent-world" },
      { fromScore: 95, image: "ascent-solar" },
      { fromScore: 125, image: "ascent-milkyway" },
      { fromScore: 160, image: "ascent-galaxy" },
    ],
    unlock: (s) => ({ unlocked: s.bestScore >= 100, hint: "score 100 in a single run" }),
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

/** When true, every theme reads as unlocked so the gallery can show
 *  the full backdrop catalogue. Toggled via ?themes=lab. */
let themesLabMode = false;
export function setThemesLabMode(on: boolean): void { themesLabMode = on; }
export function isThemesLabMode(): boolean { return themesLabMode; }

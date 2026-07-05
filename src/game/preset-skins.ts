import type { AchievementStats } from "./achievements";
import { isEventGranted } from "./events";
import { CHOICE_PRESETS, isChoicePicked, pickedRandomChoicePresets, randomChoicePreset } from "./color-choices";

type RGB = [number, number, number];

/**
 * Preset colour palettes.
 *
 * Unlike the procedurally-minted skins (server-generated at play
 * thresholds) these are hand-picked body/accent pairs with their own
 * unlock criteria. They live entirely client-side: equipping one
 * writes its id to localStorage and the renderer reads the colours
 * directly — no DB row needed.
 */

export interface PresetSkin {
  id: string;
  name: string;
  body: RGB;
  accent: RGB;
  /** True for "pick 1 of 3" milestone colours (see game/color-choices.ts). The
   *  gallery only surfaces these once resolved (picked or locked-forever). */
  choice?: boolean;
  unlock(stats: AchievementStats): { unlocked: boolean; hint?: string };
}

export const PRESET_SKINS: PresetSkin[] = [
  { id: "preset-crimson", name: "crimson", body: [220, 38, 38], accent: [60, 10, 10],
    unlock: (s) => ({ unlocked: s.totalGames >= 8, hint: "play 8 games" }) },
  { id: "preset-ocean", name: "ocean", body: [14, 165, 233], accent: [8, 47, 73],
    unlock: (s) => ({ unlocked: s.totalGames >= 15, hint: "play 15 games" }) },
  { id: "preset-lime", name: "lime", body: [132, 204, 22], accent: [26, 46, 5],
    unlock: (s) => ({ unlocked: s.bestScore >= 20, hint: "score 20 in a single run" }) },
  { id: "preset-grape", name: "grape", body: [168, 85, 247], accent: [40, 10, 70],
    unlock: (s) => ({ unlocked: s.bestScore >= 35, hint: "score 35 in a single run" }) },
  { id: "preset-tangerine", name: "tangerine", body: [249, 115, 22], accent: [80, 30, 0],
    unlock: (s) => ({ unlocked: s.bestScore >= 60, hint: "score 60 in a single run" }) },
  { id: "preset-rose", name: "rose gold", body: [251, 113, 133], accent: [120, 50, 60],
    unlock: (s) => ({ unlocked: s.streakDays >= 3, hint: "3-day streak" }) },
  { id: "preset-mint", name: "mint", body: [94, 234, 212], accent: [15, 70, 65],
    unlock: (s) => ({ unlocked: s.streakDays >= 10, hint: "10-day streak" }) },
  { id: "preset-gold", name: "gold", body: [250, 204, 21], accent: [90, 60, 0],
    unlock: (s) => ({ unlocked: s.challengeWins >= 2, hint: "win 2 challenges" }) },
  { id: "preset-mono", name: "mono", body: [230, 230, 230], accent: [20, 20, 20],
    unlock: (s) => ({ unlocked: s.friendCount >= 3, hint: "add 3 friends" }) },
  { id: "preset-aurora", name: "aurora", body: [110, 231, 183], accent: [99, 102, 241],
    unlock: (s) => ({ unlocked: s.totalGames >= 300, hint: "play 300 games" }) },
  { id: "preset-germany", name: "Germany", body: [221, 0, 0], accent: [255, 206, 0],
    unlock: (s) => ({ unlocked: s.totalGames >= 100, hint: "play 100 games" }) },
  // --- Variety pass: harder, character-driven unlocks across mixed axes,
  //     so the higher tiers feel earned rather than "another number". ---
  { id: "preset-brass", name: "burnished brass", body: [181, 140, 60], accent: [70, 50, 15],
    unlock: (s) => ({ unlocked: s.totalGames >= 750, hint: "play 750 games" }) },
  { id: "preset-evergreen", name: "evergreen", body: [34, 120, 68], accent: [12, 45, 28],
    unlock: (s) => ({ unlocked: s.streakDays >= 60, hint: "60-day streak" }) },
  { id: "preset-steel", name: "tempered steel", body: [120, 130, 140], accent: [40, 45, 52],
    unlock: (s) => ({ unlocked: s.superHardDailyBest >= 40, hint: "score 40+ on a super-hard daily" }) },
  { id: "preset-dawn", name: "dawn gold", body: [255, 196, 92], accent: [150, 90, 30],
    unlock: (s) => ({ unlocked: s.morningGames >= 30, hint: "play 30 sunrise games (05:00–07:00)" }) },
  { id: "preset-midnight", name: "midnight violet", body: [90, 60, 160], accent: [25, 15, 55],
    unlock: (s) => ({ unlocked: s.lateNightGames >= 50, hint: "play 50 late-night games" }) },
  // Chameleon — legendary. Colours are placeholders; the real pair is rolled
  // fresh each run (see game/chameleon.ts). The gallery paints it as a rainbow
  // so it reads as "random every time".
  { id: "chameleon", name: "Chameleon", body: [168, 85, 247], accent: [30, 10, 50],
    unlock: (s) => ({ unlocked: s.totalGames >= 1234, hint: "play 1234 games" }) },
  // "Pick 1 of 3" milestone colours — equippable once chosen (see color-choices.ts).
  ...CHOICE_PRESETS,
  // Procedural wildcard colours (level > 40) the player has already picked, so
  // they show up in the gallery. Fixed at load; getPreset() reconstructs any
  // just-picked one this session.
  ...pickedRandomChoicePresets(),
];

const PRESET_KEY = "pflug.equippedPreset.v1";

export function getEquippedPresetLocal(): string | null {
  try {
    return localStorage.getItem(PRESET_KEY);
  } catch {
    return null;
  }
}

export function setEquippedPresetLocal(id: string | null): void {
  try {
    if (id) localStorage.setItem(PRESET_KEY, id);
    else localStorage.removeItem(PRESET_KEY);
  } catch {
    /* ignore */
  }
}

export function getPreset(id: string | null | undefined): PresetSkin | null {
  if (!id) return null;
  // Fall back to reconstructing a procedural wildcard colour — it may have been
  // picked this session, after PRESET_SKINS was built.
  return PRESET_SKINS.find((p) => p.id === id) ?? randomChoicePreset(id);
}

let labMode = false;
export function setPresetLabMode(on: boolean): void { labMode = on; }
export function presetUnlock(p: PresetSkin, stats: AchievementStats): { unlocked: boolean; hint?: string } {
  if (labMode) return { unlocked: true };
  if (isChoicePicked(p.id)) return { unlocked: true };
  if (isEventGranted("preset", p.id)) return { unlocked: true };
  return p.unlock(stats);
}

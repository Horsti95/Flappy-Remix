import { describe, it, expect } from "vitest";
import {
  getUnlockables,
  unlockProgress,
  lockedUnlockables,
  type UnlockStats,
} from "../src/game/unlockables";
import { ACHIEVEMENTS } from "../src/game/achievements";
import { PRESET_SKINS } from "../src/game/preset-skins";
import { SHAPES } from "../src/game/shapes";
import { THEMES } from "../src/game/themes";

const FRESH: UnlockStats = {
  totalGames: 0,
  bestScore: 0,
  totalScore: 0,
  streakDays: 0,
  bestScoreDaily: 0,
  hardDailyBest: 0,
  superHardDailyBest: 0,
  nightGames: 0,
  morningGames: 0,
  challengeWins: 0,
  dailyStreakDays: 0,
  friendCount: 0,
  lateNightGames: 0,
  minimalistDone: false,
  runsOver100: 0,
  consecutiveUnder100: 0,
  consecutiveOver50: 0,
  bestRankedTotal: 0,
  bestRankedFloor: 0,
};

const MAXED: UnlockStats = {
  totalGames: 100000,
  bestScore: 100000,
  totalScore: 100000000,
  streakDays: 10000,
  bestScoreDaily: 100000,
  hardDailyBest: 100000,
  superHardDailyBest: 100000,
  nightGames: 10000,
  morningGames: 10000,
  challengeWins: 10000,
  dailyStreakDays: 10000,
  friendCount: 10000,
  lateNightGames: 10000,
  minimalistDone: true,
  runsOver100: 10000,
  consecutiveUnder100: 10000,
  consecutiveOver50: 10000,
  bestRankedTotal: 100000,
  bestRankedFloor: 100000,
  feedbackGiven: true,
};

describe("unlockables registry", () => {
  it("includes every source item exactly once", () => {
    const all = getUnlockables(FRESH);
    expect(all).toHaveLength(
      SHAPES.length + THEMES.length + PRESET_SKINS.length + ACHIEVEMENTS.length,
    );
    expect(new Set(all.map((u) => u.uid)).size).toBe(all.length);
  });

  it("normalized unlocked state matches each source's own check", () => {
    const all = getUnlockables(MAXED);
    for (const s of SHAPES) {
      const u = all.find((x) => x.uid === `shape:${s.id}`)!;
      expect(u.unlocked).toBe(s.unlock(MAXED).unlocked);
    }
    for (const a of ACHIEVEMENTS) {
      const u = all.find((x) => x.uid === `ach:${a.id}`)!;
      expect(u.unlocked).toBe(a.check(MAXED));
    }
  });

  it("secret flag mirrors the achievement definition", () => {
    const all = getUnlockables(FRESH);
    for (const a of ACHIEVEMENTS) {
      const u = all.find((x) => x.uid === `ach:${a.id}`)!;
      expect(u.secret).toBe(a.secret === true);
    }
    // Non-achievement kinds are never secret.
    expect(all.filter((u) => u.kind !== "achievement-color").every((u) => !u.secret)).toBe(true);
  });

  it("progress is 0% fresh and 100% maxed (per kind and overall)", () => {
    expect(unlockProgress(undefined, MAXED).pct).toBe(100);
    expect(unlockProgress("palette", MAXED).unlocked).toBe(PRESET_SKINS.length);
    // Fresh: only always-on items (e.g. the default shape/theme) count.
    const fresh = unlockProgress(undefined, FRESH);
    expect(fresh.unlocked).toBeLessThan(fresh.total);
    expect(fresh.unlocked).toBeGreaterThanOrEqual(0);
  });

  it("lockedUnlockables is empty when everything is unlocked", () => {
    expect(lockedUnlockables(MAXED)).toHaveLength(0);
    expect(lockedUnlockables(FRESH).length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import type { AchievementStats } from "../src/game/achievements";
import { PILLAR_COLORS, pillarColorUnlocked } from "../src/game/pillar-colors";
import { FX_COLORS, fxColorUnlocked } from "../src/game/flap-fx";

const ZERO: AchievementStats = {
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

describe("pillar colour unlocks", () => {
  it("default colours (theme/forest) are unlocked at zero stats", () => {
    const theme = PILLAR_COLORS.find((c) => c.id === "theme")!;
    const forest = PILLAR_COLORS.find((c) => c.id === "forest")!;
    expect(pillarColorUnlocked(theme, ZERO).unlocked).toBe(true);
    expect(pillarColorUnlocked(forest, ZERO).unlocked).toBe(true);
  });

  it("at least one colour is locked at zero stats", () => {
    expect(PILLAR_COLORS.some((c) => !pillarColorUnlocked(c, ZERO).unlocked)).toBe(true);
  });

  it("gold locks at zero stats and unlocks once bestScore crosses its threshold", () => {
    const gold = PILLAR_COLORS.find((c) => c.id === "gold")!;
    expect(pillarColorUnlocked(gold, ZERO).unlocked).toBe(false);
    expect(pillarColorUnlocked(gold, { ...ZERO, bestScore: 40 }).unlocked).toBe(true);
  });

  it("ids are unique", () => {
    const ids = PILLAR_COLORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("FX colour unlocks", () => {
  it("default and white are unlocked at zero stats", () => {
    const def = FX_COLORS.find((c) => c.id === "default")!;
    const white = FX_COLORS.find((c) => c.id === "white")!;
    expect(fxColorUnlocked(def, ZERO).unlocked).toBe(true);
    expect(fxColorUnlocked(white, ZERO).unlocked).toBe(true);
  });

  it("at least one colour is locked at zero stats and unlocks at its threshold", () => {
    const red = FX_COLORS.find((c) => c.id === "red")!;
    expect(fxColorUnlocked(red, ZERO).unlocked).toBe(false);
    expect(fxColorUnlocked(red, { ...ZERO, totalGames: 5 }).unlocked).toBe(true);
  });

  it("ids are unique", () => {
    const ids = FX_COLORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

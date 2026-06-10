import { describe, it, expect } from "vitest";
import { nextUnlockHint } from "../src/game/next-unlock";
import type { AchievementStats } from "../src/game/achievements";

const FRESH: AchievementStats = {
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

describe("next-unlock breadcrumb", () => {
  it("a fresh player gets a near games-based goal", () => {
    const hint = nextUnlockHint(FRESH);
    expect(hint).not.toBeNull();
    expect(hint!.effort).toMatch(/more game/);
  });

  it("mid-game players get a goal too (games or score push)", () => {
    const hint = nextUnlockHint({ ...FRESH, totalGames: 60, bestScore: 42, totalScore: 2500 });
    expect(hint).not.toBeNull();
    expect(hint!.effort).toMatch(/more game|reach score|streak day/);
  });

  it("the hint advances as stats grow (no stuck breadcrumb)", () => {
    const a = nextUnlockHint({ ...FRESH, totalGames: 4 });
    const b = nextUnlockHint({ ...FRESH, totalGames: 9 });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(`${a!.name}|${a!.effort}`).not.toBe(`${b!.name}|${b!.effort}`);
  });
});

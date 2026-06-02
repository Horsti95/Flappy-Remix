import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  getNewlyUnlocked,
  getUnlockedAchievements,
  updateStatsAfterRun,
  type AchievementStats,
} from "../src/game/achievements";

const EMPTY: AchievementStats = {
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
};

describe("achievements", () => {
  it("all ids are unique", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fresh player has no unlocks except first_flight after 1 game", () => {
    expect(getUnlockedAchievements(EMPTY)).toEqual([]);
    const after = updateStatsAfterRun(EMPTY, { score: 3, mode: "casual" });
    const unlocked = getUnlockedAchievements(after);
    expect(unlocked.map((a) => a.id)).toContain("first_flight");
  });

  it("bronze_pilot unlocks at score 50", () => {
    const s = { ...EMPTY, totalGames: 10, bestScore: 49 };
    expect(getUnlockedAchievements(s).map((a) => a.id)).not.toContain("bronze_pilot");
    const after = updateStatsAfterRun(s, { score: 50, mode: "casual" });
    expect(getUnlockedAchievements(after).map((a) => a.id)).toContain("bronze_pilot");
  });

  it("gold_legend unlocks at score 100", () => {
    const s = { ...EMPTY, totalGames: 50, bestScore: 99 };
    expect(getUnlockedAchievements(s).map((a) => a.id)).not.toContain("gold_legend");
    const s2 = { ...s, bestScore: 100 };
    expect(getUnlockedAchievements(s2).map((a) => a.id)).toContain("gold_legend");
  });

  it("weekender unlocks at 7-day streak", () => {
    const s = { ...EMPTY, streakDays: 6 };
    expect(getUnlockedAchievements(s).map((a) => a.id)).not.toContain("weekender");
    const s2 = { ...s, streakDays: 7 };
    expect(getUnlockedAchievements(s2).map((a) => a.id)).toContain("weekender");
  });

  it("storm_survivor unlocks at hard daily best 25", () => {
    const s = { ...EMPTY, hardDailyBest: 24 };
    expect(getUnlockedAchievements(s).map((a) => a.id)).not.toContain("storm_survivor");
    const s2 = { ...s, hardDailyBest: 25 };
    expect(getUnlockedAchievements(s2).map((a) => a.id)).toContain("storm_survivor");
  });

  it("getNewlyUnlocked detects transitions", () => {
    const before = { ...EMPTY, totalGames: 0 };
    const after = updateStatsAfterRun(before, { score: 5, mode: "casual" });
    const newOnes = getNewlyUnlocked(before, after);
    expect(newOnes.map((a) => a.id)).toContain("first_flight");
    expect(newOnes.length).toBeGreaterThan(0);
  });

  it("updateStatsAfterRun tracks night games", () => {
    const hour = new Date().getHours();
    const after = updateStatsAfterRun(EMPTY, { score: 5, mode: "casual" });
    if (hour >= 22 || hour < 4) {
      expect(after.nightGames).toBe(1);
    } else {
      expect(after.nightGames).toBe(0);
    }
  });

  it("updateStatsAfterRun tracks daily streak for on_fire", () => {
    let s = EMPTY;
    for (let i = 0; i < 5; i++) {
      s = updateStatsAfterRun(s, { score: 25, mode: "daily", tier: "medium" });
    }
    expect(s.dailyStreakDays).toBe(5);
    expect(s.bestScoreDaily).toBe(25);
    expect(getUnlockedAchievements(s).map((a) => a.id)).toContain("on_fire");
  });

  it("minimalist unlocks on a 25+ run with under 80 taps and latches", () => {
    const lean = updateStatsAfterRun(EMPTY, { score: 25, mode: "casual", inputCount: 79 });
    expect(getUnlockedAchievements(lean).map((a) => a.id)).toContain("minimalist");
    // A later tap-heavy run must not revoke it.
    const after = updateStatsAfterRun(lean, { score: 30, mode: "casual", inputCount: 200 });
    expect(getUnlockedAchievements(after).map((a) => a.id)).toContain("minimalist");
  });

  it("minimalist stays locked when taps >= 80 or score < 25", () => {
    const tappy = updateStatsAfterRun(EMPTY, { score: 40, mode: "casual", inputCount: 120 });
    expect(getUnlockedAchievements(tappy).map((a) => a.id)).not.toContain("minimalist");
    const lowScore = updateStatsAfterRun(EMPTY, { score: 10, mode: "casual", inputCount: 5 });
    expect(getUnlockedAchievements(lowScore).map((a) => a.id)).not.toContain("minimalist");
    // No tap data available → can't earn it.
    const noData = updateStatsAfterRun(EMPTY, { score: 99, mode: "casual" });
    expect(getUnlockedAchievements(noData).map((a) => a.id)).not.toContain("minimalist");
  });

  it("every achievement has a valid reward color", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.reward.body).toHaveLength(3);
      expect(a.reward.accent).toHaveLength(3);
      for (const c of [...a.reward.body, ...a.reward.accent]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });
});

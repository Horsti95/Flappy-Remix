import { describe, it, expect } from "vitest";
import { GATE_SOUNDS, gateSoundUnlocked } from "../src/game/gate-sounds";
import type { AchievementStats } from "../src/game/achievements";

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
  runsOver100: 0,
  consecutiveUnder100: 0,
  consecutiveOver50: 0,
  bestRankedTotal: 0,
  bestRankedFloor: 0,
};

describe("gate sounds", () => {
  it("has unique ids and a single always-on default", () => {
    const ids = GATE_SOUNDS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const freeOnes = GATE_SOUNDS.filter((g) => g.unlock(EMPTY).unlocked);
    expect(freeOnes.map((g) => g.id)).toEqual(["classic"]);
  });

  it("classic is unlocked from the start", () => {
    const classic = GATE_SOUNDS.find((g) => g.id === "classic")!;
    expect(gateSoundUnlocked(classic, EMPTY).unlocked).toBe(true);
  });

  it("glide unlocks at 25 games", () => {
    const glide = GATE_SOUNDS.find((g) => g.id === "glide")!;
    expect(gateSoundUnlocked(glide, EMPTY).unlocked).toBe(false);
    expect(gateSoundUnlocked(glide, { ...EMPTY, totalGames: 25 }).unlocked).toBe(true);
  });

  it("wide unlocks at a 100 run, marimba at a 7-day streak", () => {
    const wide = GATE_SOUNDS.find((g) => g.id === "wide")!;
    const marimba = GATE_SOUNDS.find((g) => g.id === "marimba")!;
    expect(gateSoundUnlocked(wide, { ...EMPTY, bestScore: 100 }).unlocked).toBe(true);
    expect(gateSoundUnlocked(wide, { ...EMPTY, bestScore: 99 }).unlocked).toBe(false);
    expect(gateSoundUnlocked(marimba, { ...EMPTY, streakDays: 7 }).unlocked).toBe(true);
    expect(gateSoundUnlocked(marimba, { ...EMPTY, streakDays: 6 }).unlocked).toBe(false);
  });

  it("locked styles still expose a hint", () => {
    for (const g of GATE_SOUNDS) {
      const u = g.unlock(EMPTY);
      if (!u.unlocked) expect(u.hint && u.hint.length).toBeGreaterThan(0);
    }
  });
});

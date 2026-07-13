import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHAPE_ID,
  SHAPES,
  getShape,
  listUnlockedShapeIds,
} from "../src/game/shapes";
import type { AchievementStats } from "../src/game/achievements";

const ZERO: AchievementStats = {
  totalGames: 0, bestScore: 0, totalScore: 0, streakDays: 0, bestScoreDaily: 0,
  hardDailyBest: 0, superHardDailyBest: 0, nightGames: 0, morningGames: 0,
  challengeWins: 0, dailyStreakDays: 0, friendCount: 0, lateNightGames: 0,
  minimalistDone: false, runsOver100: 0, consecutiveUnder100: 0,
  consecutiveOver50: 0, bestRankedTotal: 0, bestRankedFloor: 0,
};

describe("shape registry", () => {
  it("includes the default shape and starts it unlocked", () => {
    const def = SHAPES.find((s) => s.id === DEFAULT_SHAPE_ID);
    expect(def).toBeDefined();
    expect(def!.unlock(ZERO).unlocked).toBe(true);
  });

  it("all shape ids are unique", () => {
    const ids = SHAPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a fresh player sees only the default shape", () => {
    const unlocked = listUnlockedShapeIds(ZERO);
    expect(new Set(unlocked)).toEqual(new Set([DEFAULT_SHAPE_ID]));
  });

  it("origami sprites have real unlocks (not free at minute one)", () => {
    const fresh = ZERO;
    // None are available to a fresh player…
    for (const id of ["swan", "envelope", "leaf-origami", "heart-origami", "eagle"]) {
      expect(listUnlockedShapeIds(fresh)).not.toContain(id);
    }
    // …and each is gated on its own axis (score / games / streak).
    expect(listUnlockedShapeIds({ ...fresh, bestScore: 25 })).toContain("swan");
    expect(listUnlockedShapeIds({ ...fresh, totalGames: 25 })).toContain("leaf-origami");
    expect(listUnlockedShapeIds({ ...fresh, streakDays: 9 })).not.toContain("heart-origami");
    expect(listUnlockedShapeIds({ ...fresh, streakDays: 10 })).toContain("heart-origami");
    expect(listUnlockedShapeIds({ ...fresh, bestScore: 79 })).not.toContain("eagle");
    expect(listUnlockedShapeIds({ ...fresh, bestScore: 80 })).toContain("eagle");
  });

  it("paper-plane-v2 unlocks at 10 games", () => {
    expect(listUnlockedShapeIds({ ...ZERO, totalGames: 9 })).not.toContain(
      "paper-plane-v2",
    );
    expect(listUnlockedShapeIds({ ...ZERO, totalGames: 10 })).toContain(
      "paper-plane-v2",
    );
  });

  it("pixel-bird unlocks at a single-run score of 30", () => {
    expect(listUnlockedShapeIds({ ...ZERO, totalGames: 9999, bestScore: 29, streakDays: 0 })).not.toContain(
      "pixel-bird",
    );
    expect(listUnlockedShapeIds({ ...ZERO, bestScore: 30 })).toContain("pixel-bird");
  });

  it("kite unlocks at a 3-day streak", () => {
    expect(listUnlockedShapeIds({ ...ZERO, totalGames: 0, bestScore: 999, streakDays: 2 })).not.toContain(
      "kite",
    );
    expect(listUnlockedShapeIds({ ...ZERO, streakDays: 3 })).toContain("kite");
  });

  it("cyber-plane unlocks at 200 games", () => {
    expect(listUnlockedShapeIds({ ...ZERO, totalGames: 199, bestScore: 999, streakDays: 0 })).not.toContain(
      "cyber-plane",
    );
    expect(listUnlockedShapeIds({ ...ZERO, totalGames: 200 })).toContain(
      "cyber-plane",
    );
  });

  it("butterfly unlocks at 500 games OR a 14-day streak", () => {
    expect(
      listUnlockedShapeIds({ ...ZERO, totalGames: 499, bestScore: 0, streakDays: 13 }),
    ).not.toContain("butterfly");
    expect(
      listUnlockedShapeIds({ ...ZERO, totalGames: 500 }),
    ).toContain("butterfly");
    expect(
      listUnlockedShapeIds({ ...ZERO, streakDays: 14 }),
    ).toContain("butterfly");
  });

  it("getShape falls back to default for unknown ids", () => {
    expect(getShape("not-a-real-shape").id).toBe(DEFAULT_SHAPE_ID);
    expect(getShape(null).id).toBe(DEFAULT_SHAPE_ID);
    expect(getShape(undefined).id).toBe(DEFAULT_SHAPE_ID);
  });

  it("every shape's unlock hint is non-empty or explicitly null", () => {
    for (const shape of SHAPES) {
      const state = shape.unlock(ZERO);
      if (!state.unlocked) {
        expect(state.hint).toBeTruthy();
        expect(state.hint!.length).toBeGreaterThan(3);
      }
    }
  });
});

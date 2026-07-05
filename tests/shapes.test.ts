import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHAPE_ID,
  SHAPES,
  getShape,
  listUnlockedShapeIds,
} from "../src/game/shapes";

describe("shape registry", () => {
  it("includes the default shape and starts it unlocked", () => {
    const def = SHAPES.find((s) => s.id === DEFAULT_SHAPE_ID);
    expect(def).toBeDefined();
    expect(def!.unlock({ totalGames: 0, bestScore: 0, streakDays: 0 }).unlocked).toBe(true);
  });

  it("all shape ids are unique", () => {
    const ids = SHAPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a fresh player sees only the default shape", () => {
    const unlocked = listUnlockedShapeIds({ totalGames: 0, bestScore: 0, streakDays: 0 });
    expect(new Set(unlocked)).toEqual(new Set([DEFAULT_SHAPE_ID]));
  });

  it("origami sprites have real unlocks (not free at minute one)", () => {
    const fresh = { totalGames: 0, bestScore: 0, streakDays: 0 };
    // None are available to a fresh player…
    for (const id of ["swan", "envelope", "leaf-origami", "heart-origami", "eagle"]) {
      expect(listUnlockedShapeIds(fresh)).not.toContain(id);
    }
    // …and each is gated on its own axis (score / games / streak).
    expect(listUnlockedShapeIds({ ...fresh, bestScore: 25 })).toContain("swan");
    expect(listUnlockedShapeIds({ ...fresh, totalGames: 25 })).toContain("leaf-origami");
    expect(listUnlockedShapeIds({ ...fresh, streakDays: 5 })).toContain("heart-origami");
    expect(listUnlockedShapeIds({ ...fresh, bestScore: 79 })).not.toContain("eagle");
    expect(listUnlockedShapeIds({ ...fresh, bestScore: 80 })).toContain("eagle");
  });

  it("paper-plane-v2 unlocks at 10 games", () => {
    expect(listUnlockedShapeIds({ totalGames: 9, bestScore: 0, streakDays: 0 })).not.toContain(
      "paper-plane-v2",
    );
    expect(listUnlockedShapeIds({ totalGames: 10, bestScore: 0, streakDays: 0 })).toContain(
      "paper-plane-v2",
    );
  });

  it("pixel-bird unlocks at a single-run score of 30", () => {
    expect(listUnlockedShapeIds({ totalGames: 9999, bestScore: 29, streakDays: 0 })).not.toContain(
      "pixel-bird",
    );
    expect(listUnlockedShapeIds({ totalGames: 0, bestScore: 30, streakDays: 0 })).toContain("pixel-bird");
  });

  it("kite unlocks at a 3-day streak", () => {
    expect(listUnlockedShapeIds({ totalGames: 0, bestScore: 999, streakDays: 2 })).not.toContain(
      "kite",
    );
    expect(listUnlockedShapeIds({ totalGames: 0, bestScore: 0, streakDays: 3 })).toContain("kite");
  });

  it("cyber-plane unlocks at 200 games", () => {
    expect(listUnlockedShapeIds({ totalGames: 199, bestScore: 999, streakDays: 0 })).not.toContain(
      "cyber-plane",
    );
    expect(listUnlockedShapeIds({ totalGames: 200, bestScore: 0, streakDays: 0 })).toContain(
      "cyber-plane",
    );
  });

  it("butterfly unlocks at 500 games OR a 14-day streak", () => {
    expect(
      listUnlockedShapeIds({ totalGames: 499, bestScore: 0, streakDays: 13 }),
    ).not.toContain("butterfly");
    expect(
      listUnlockedShapeIds({ totalGames: 500, bestScore: 0, streakDays: 0 }),
    ).toContain("butterfly");
    expect(
      listUnlockedShapeIds({ totalGames: 0, bestScore: 0, streakDays: 14 }),
    ).toContain("butterfly");
  });

  it("getShape falls back to default for unknown ids", () => {
    expect(getShape("not-a-real-shape").id).toBe(DEFAULT_SHAPE_ID);
    expect(getShape(null).id).toBe(DEFAULT_SHAPE_ID);
    expect(getShape(undefined).id).toBe(DEFAULT_SHAPE_ID);
  });

  it("every shape's unlock hint is non-empty or explicitly null", () => {
    for (const shape of SHAPES) {
      const state = shape.unlock({ totalGames: 0, bestScore: 0, streakDays: 0 });
      if (!state.unlocked) {
        expect(state.hint).toBeTruthy();
        expect(state.hint!.length).toBeGreaterThan(3);
      }
    }
  });
});

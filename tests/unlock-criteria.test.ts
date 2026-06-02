import { describe, it, expect } from "vitest";
import {
  UNLOCK_CRITERIA,
  evaluateCriteria,
  isEventActive,
  type CriterionDef,
} from "../src/game/unlock-criteria";
import type { AchievementStats } from "../src/game/achievements";

const MAXED: AchievementStats = {
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
};

describe("unlock-criteria catalog", () => {
  it("has a healthy catalog size", () => {
    expect(UNLOCK_CRITERIA.length).toBeGreaterThanOrEqual(16);
    expect(UNLOCK_CRITERIA.length).toBeLessThanOrEqual(30);
  });

  it("has unique ids", () => {
    const ids = UNLOCK_CRITERIA.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("evaluateCriteria returns one entry per def, in order", () => {
    const results = evaluateCriteria(MAXED);
    expect(results).toHaveLength(UNLOCK_CRITERIA.length);
    results.forEach((r, i) => expect(r.def).toBe(UNLOCK_CRITERIA[i]));
  });

  it("a maxed-out stats object unlocks every non-event criterion", () => {
    const results = evaluateCriteria(MAXED);
    for (const r of results) {
      if (r.def.event) continue;
      expect(r.unlocked, `${r.def.id} should unlock when maxed`).toBe(true);
    }
  });

  it("event criteria check is participation (always true)", () => {
    const events = UNLOCK_CRITERIA.filter((c) => c.event);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.check(MAXED)).toBe(true);
    }
  });

  it("marks the intended secret criteria and leaves events non-secret", () => {
    const secretIds = UNLOCK_CRITERIA.filter((c) => c.secret).map((c) => c.id);
    expect(secretIds).toEqual(
      expect.arrayContaining([
        "perpetual_motion",
        "ace_of_aces",
        "calendar_conqueror",
        "eye_of_the_storm",
        "witching_hour",
        "social_butterfly",
        "zen_master",
      ]),
    );
    // Event entries are gated by date, not by secrecy.
    expect(UNLOCK_CRITERIA.filter((c) => c.event).some((c) => c.secret)).toBe(false);
  });

  it("every plannedReward label reads as a TBA placeholder", () => {
    for (const c of UNLOCK_CRITERIA) {
      expect(c.plannedReward.label).toMatch(/TBA/);
    }
  });
});

describe("isEventActive", () => {
  const same: CriterionDef = {
    id: "x",
    name: "x",
    hint: "x",
    event: { from: "06-01", until: "06-30" },
    plannedReward: { kind: "badge", label: "TBA · x" },
    check: () => true,
  };
  const wrap: CriterionDef = {
    id: "y",
    name: "y",
    hint: "y",
    event: { from: "12-26", until: "01-02" },
    plannedReward: { kind: "skin", label: "TBA · y" },
    check: () => true,
  };
  const nonEvent: CriterionDef = {
    id: "z",
    name: "z",
    hint: "z",
    plannedReward: { kind: "badge", label: "TBA · z" },
    check: () => true,
  };

  it("is true inside a normal window and false outside", () => {
    expect(isEventActive(same, new Date("2026-06-15T12:00:00"))).toBe(true);
    expect(isEventActive(same, new Date("2026-06-01T00:00:00"))).toBe(true);
    expect(isEventActive(same, new Date("2026-06-30T23:00:00"))).toBe(true);
    expect(isEventActive(same, new Date("2026-07-01T00:00:00"))).toBe(false);
    expect(isEventActive(same, new Date("2026-05-31T12:00:00"))).toBe(false);
  });

  it("handles a wrap-around Dec->Jan window", () => {
    expect(isEventActive(wrap, new Date("2026-12-31T12:00:00"))).toBe(true);
    expect(isEventActive(wrap, new Date("2026-12-26T00:00:00"))).toBe(true);
    expect(isEventActive(wrap, new Date("2026-01-01T12:00:00"))).toBe(true);
    expect(isEventActive(wrap, new Date("2026-01-02T23:00:00"))).toBe(true);
    expect(isEventActive(wrap, new Date("2026-01-03T00:00:00"))).toBe(false);
    expect(isEventActive(wrap, new Date("2026-12-25T12:00:00"))).toBe(false);
    expect(isEventActive(wrap, new Date("2026-06-15T12:00:00"))).toBe(false);
  });

  it("is always false for non-event criteria", () => {
    expect(isEventActive(nonEvent, new Date("2026-06-15T12:00:00"))).toBe(false);
  });
});

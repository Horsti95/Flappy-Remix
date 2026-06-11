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
  runsOver100: 10000,
  consecutiveUnder100: 10000,
  consecutiveOver50: 10000,
  bestRankedTotal: 100000,
  bestRankedFloor: 100000,
};

describe("unlock-criteria catalog", () => {
  it("has a healthy catalog size", () => {
    // 2026-06-11: everything computable was promoted to real achievements;
    // only plumbing-pending drafts remain in the scratchpad.
    expect(UNLOCK_CRITERIA.length).toBeGreaterThanOrEqual(4);
    expect(UNLOCK_CRITERIA.length).toBeLessThanOrEqual(40);
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

  it("a maxed-out stats object unlocks every non-event, non-pending criterion", () => {
    const results = evaluateCriteria(MAXED);
    for (const r of results) {
      if (r.def.event || r.def.pending) continue;
      expect(r.unlocked, `${r.def.id} should unlock when maxed`).toBe(true);
    }
  });

  it("pending drafts stay locked even when maxed (no plumbing yet)", () => {
    const pending = evaluateCriteria(MAXED).filter((r) => r.def.pending);
    expect(pending.length).toBeGreaterThan(0);
    for (const r of pending) {
      expect(r.unlocked, `${r.def.id} has no tracking yet`).toBe(false);
    }
  });

  it("isEventActive handles plain and wrap-around windows", () => {
    const mk = (from: string, until: string) =>
      ({ id: "x", name: "x", hint: "x", plannedReward: { kind: "badge", label: "x" }, event: { from, until }, check: () => true }) as (typeof UNLOCK_CRITERIA)[number];
    expect(isEventActive(mk("06-01", "06-30"), new Date(2026, 5, 11))).toBe(true);
    expect(isEventActive(mk("06-01", "06-30"), new Date(2026, 6, 1))).toBe(false);
    expect(isEventActive(mk("12-26", "01-02"), new Date(2026, 11, 28))).toBe(true);
    expect(isEventActive(mk("12-26", "01-02"), new Date(2027, 0, 1))).toBe(true);
    expect(isEventActive(mk("12-26", "01-02"), new Date(2026, 5, 11))).toBe(false);
  });

  it("marks the intended secret drafts", () => {
    const secretIds = UNLOCK_CRITERIA.filter((c) => c.secret).map((c) => c.id);
    expect(secretIds).toEqual(["upset_victim"]);
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

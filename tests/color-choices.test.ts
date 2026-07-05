import { describe, it, expect } from "vitest";
import { CHOICE_SETS, CHOICE_PRESETS, pendingChoiceSets } from "../src/game/color-choices";
import type { AchievementStats } from "../src/game/achievements";

const stats = (over: Partial<AchievementStats> = {}): AchievementStats =>
  ({ totalGames: 0, bestScore: 0, streakDays: 0, ...over }) as AchievementStats;

const ids = (sets: { id: string }[]): string[] => sets.map((s) => s.id);

describe("color choices — sets & triggers", () => {
  it("each set offers exactly 3 distinct colours, all unique ids", () => {
    const all = new Set<string>();
    for (const set of CHOICE_SETS) {
      expect(set.options).toHaveLength(3);
      for (const o of set.options) {
        expect(all.has(o.id)).toBe(false);
        all.add(o.id);
      }
    }
    // Every option is exposed as a preset for equip/preview.
    expect(CHOICE_PRESETS).toHaveLength(all.size);
    expect(CHOICE_PRESETS.every((p) => p.choice === true)).toBe(true);
  });

  it("level triggers fire at or above the milestone", () => {
    const none = pendingChoiceSets({ level: 1, stats: stats(), eventFinalDay: () => false });
    expect(ids(none)).not.toContain("lvl5");
    const at5 = pendingChoiceSets({ level: 5, stats: stats(), eventFinalDay: () => false });
    expect(ids(at5)).toContain("lvl5");
    expect(ids(at5)).not.toContain("lvl10");
    const at10 = pendingChoiceSets({ level: 10, stats: stats(), eventFinalDay: () => false });
    expect(ids(at10)).toEqual(expect.arrayContaining(["lvl5", "lvl10"]));
  });

  it("goal trigger fires on the stat threshold", () => {
    const below = pendingChoiceSets({ level: 1, stats: stats({ bestScore: 74 }), eventFinalDay: () => false });
    expect(ids(below)).not.toContain("ace75");
    const at = pendingChoiceSets({ level: 1, stats: stats({ bestScore: 75 }), eventFinalDay: () => false });
    expect(ids(at)).toContain("ace75");
  });

  it("event finale trigger fires only on the event final day", () => {
    const off = pendingChoiceSets({ level: 1, stats: stats(), eventFinalDay: () => false });
    expect(ids(off)).not.toContain("wc-finale");
    const on = pendingChoiceSets({ level: 1, stats: stats(), eventFinalDay: (id) => id === "worldcup-2026" });
    expect(ids(on)).toContain("wc-finale");
  });
});

describe("color choices — procedural wildcards (every 5 levels past 40)", () => {
  const wilds = (level: number): string[] =>
    ids(pendingChoiceSets({ level, stats: stats(), eventFinalDay: () => false })).filter((id) =>
      id.startsWith("rng-lvl-"),
    );

  it("offers no wildcard before level 45 (curated lvl-40 set stays last)", () => {
    expect(wilds(40)).toEqual([]);
    expect(wilds(44)).toEqual([]);
  });

  it("offers the level-45 wildcard at 45, and only on multiples of 5", () => {
    expect(wilds(45)).toEqual(["rng-lvl-45"]);
    // 46–49 add nothing new; the next wildcard is 50, not 46.
    expect(wilds(49)).toEqual(["rng-lvl-45"]);
  });

  it("surfaces one wildcard at a time — the lowest unresolved level", () => {
    // At level 60, 45/50/55/60 are all eligible but only the first is shown.
    expect(wilds(60)).toEqual(["rng-lvl-45"]);
  });
});

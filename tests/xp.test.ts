import { describe, it, expect } from "vitest";
import { xpForRun, xpToClearLevel, levelFromTotalXp } from "../src/game/xp";

describe("pilot xp", () => {
  it("base xp is flat: score + finish bonus", () => {
    const b = xpForRun({ score: 12, mode: "casual", isNewPb: false });
    expect(b.base).toBe(12);
    expect(b.finish).toBe(5);
    expect(b.total).toBe(17);
  });

  it("daily attempts and new PBs pay flat bonuses", () => {
    const b = xpForRun({ score: 20, mode: "daily", isNewPb: true });
    expect(b.daily).toBe(25);
    expect(b.newPb).toBe(50);
    expect(b.total).toBe(20 + 5 + 25 + 50);
  });

  it("in-run gate milestones at 50/100/250 stack", () => {
    expect(xpForRun({ score: 49, mode: "casual", isNewPb: false }).milestones).toBe(0);
    expect(xpForRun({ score: 50, mode: "casual", isNewPb: false }).milestones).toBe(25);
    expect(xpForRun({ score: 100, mode: "casual", isNewPb: false }).milestones).toBe(75);
    expect(xpForRun({ score: 250, mode: "casual", isNewPb: false }).milestones).toBe(175);
  });

  it("curve grows ~12% per level from 100", () => {
    expect(xpToClearLevel(1)).toBe(100);
    expect(xpToClearLevel(2)).toBe(112);
    expect(xpToClearLevel(10)).toBeGreaterThan(xpToClearLevel(9));
  });

  it("per-level cost caps flat so high tiers stay reachable", () => {
    // Ramp reaches the cap by ~level 17 and stays there forever.
    expect(xpToClearLevel(20)).toBe(600);
    expect(xpToClearLevel(40)).toBe(600);
    expect(xpToClearLevel(40)).toBe(xpToClearLevel(80));
    // Each flat level ≈ 20–30 casual games (~25 XP/game).
    expect(xpToClearLevel(40) / 25).toBeGreaterThanOrEqual(20);
    expect(xpToClearLevel(40) / 25).toBeLessThanOrEqual(30);
    // Cumulative XP to level 40 is now a few hundred games, not thousands.
    let total = 0;
    for (let l = 1; l < 40; l++) total += xpToClearLevel(l);
    expect(total).toBeLessThan(20000); // was ~68,000 before the cap
  });

  it("level 2 is reachable inside a first session", () => {
    // Three modest runs (~score 15 each + dailies) clear 100 XP.
    const s = levelFromTotalXp(105);
    expect(s.level).toBe(2);
    expect(s.intoLevel).toBe(5);
  });

  it("level math is consistent and monotonic", () => {
    let prev = levelFromTotalXp(0);
    expect(prev.level).toBe(1);
    for (const xp of [50, 100, 500, 2000, 10000, 100000]) {
      const cur = levelFromTotalXp(xp);
      expect(cur.level).toBeGreaterThanOrEqual(prev.level);
      // Below the soft cap the bar is partial (<), at the cap it reads full (==).
      expect(cur.intoLevel).toBeLessThanOrEqual(cur.toNext);
      prev = cur;
    }
  });

  it("negative / garbage totals clamp to level 1", () => {
    expect(levelFromTotalXp(-5).level).toBe(1);
    expect(levelFromTotalXp(-5).intoLevel).toBe(0);
  });
});

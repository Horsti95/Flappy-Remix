import { describe, it, expect } from "vitest";
import { tierForUnlock } from "../src/game/tiers";

describe("tierForUnlock", () => {
  it("buckets an always-on unlock as bronze", () => {
    expect(tierForUnlock(() => ({ unlocked: true }))).toBe("bronze");
  });

  it("buckets a light condition as bronze", () => {
    expect(tierForUnlock((s: { totalGames: number }) => ({ unlocked: s.totalGames >= 5 }))).toBe("bronze");
  });

  it("buckets a moderate score as silver", () => {
    expect(tierForUnlock((s: { bestScore: number }) => ({ unlocked: s.bestScore >= 30 }))).toBe("silver");
  });

  it("buckets a hard score as gold", () => {
    expect(tierForUnlock((s: { bestScore: number }) => ({ unlocked: s.bestScore >= 65 }))).toBe("gold");
  });

  it("buckets a mastery score as legendary", () => {
    expect(tierForUnlock((s: { bestScore: number }) => ({ unlocked: s.bestScore >= 130 }))).toBe("legendary");
  });

  it("buckets an unreachable condition as legendary", () => {
    expect(tierForUnlock((s: { bestScore: number }) => ({ unlocked: s.bestScore >= 99999 }))).toBe("legendary");
  });
});

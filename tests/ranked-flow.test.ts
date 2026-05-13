import { describe, it, expect } from "vitest";
import {
  applyElo,
  decideResult,
  isBestOfThreeComplete,
  softReset,
  tallyOutcome,
} from "../api/_lib/elo";

/**
 * Simulates the submit-run BO3 settlement path end-to-end at the
 * module level. Database round-tripping is exercised in the live
 * Vercel/Supabase deploy; these checks pin the math + rules.
 */
describe("ranked BO3 settlement", () => {
  function step(
    aScores: (number | null)[],
    bScores: (number | null)[],
    aBefore: number,
    bBefore: number,
  ) {
    const paired = [0, 1, 2].filter((i) => aScores[i] != null && bScores[i] != null);
    const outcome = tallyOutcome(
      paired.map((i) => aScores[i] as number),
      paired.map((i) => bScores[i] as number),
    );
    const done = isBestOfThreeComplete(outcome, paired.length);
    if (!done) return { done: false as const };
    const result = decideResult(outcome);
    const next = applyElo(aBefore, bBefore, result);
    return { done: true as const, result, after: next };
  }

  it("two rounds same scores: BO3 not done yet", () => {
    const r = step([5, 5, null], [5, 5, null], 1200, 1200);
    expect(r.done).toBe(false);
  });

  it("two A wins ends early with A gaining ELO", () => {
    const r = step([10, 12, null], [3, 4, null], 1200, 1200);
    expect(r.done).toBe(true);
    if (r.done) {
      expect(r.result).toBe("a_win");
      expect(r.after.a).toBeGreaterThan(1200);
      expect(r.after.b).toBeLessThan(1200);
    }
  });

  it("three rounds with split + draw: tie keeps ratings stable", () => {
    const r = step([10, 5, 7], [3, 8, 7], 1500, 1500);
    expect(r.done).toBe(true);
    if (r.done) {
      expect(r.result).toBe("draw");
      expect(r.after.a).toBe(1500);
      expect(r.after.b).toBe(1500);
    }
  });

  it("underdog 2-1 upset rewards heavily", () => {
    const r = step([12, 3, 7], [4, 9, 5], 1200, 1700);
    expect(r.done).toBe(true);
    if (r.done) {
      expect(r.result).toBe("a_win");
      expect(r.after.a - 1200).toBeGreaterThan(20);
    }
  });

  it("tallyOutcome iterates the shorter of the two arrays", () => {
    // submit-run pads round arrays as scores arrive; tallyOutcome
    // takes the min length so unplayed rounds don't accidentally tip
    // the outcome.
    expect(tallyOutcome([1, 2], [4, 3, 2, 1])).toEqual({ aWins: 0, bWins: 2, draws: 0 });
  });
});

describe("season soft-reset chain", () => {
  it("a top player approaches 1200 after enough seasons", () => {
    let rating = 1800;
    for (let i = 0; i < 6; i++) rating = softReset(rating);
    expect(Math.abs(rating - 1200)).toBeLessThan(2);
  });

  it("repeated reset of someone already at 1200 is a no-op", () => {
    let rating = 1200;
    for (let i = 0; i < 5; i++) rating = softReset(rating);
    expect(rating).toBe(1200);
  });
});

import { describe, it, expect } from "vitest";
import {
  applyElo,
  decideResult,
  expectedScore,
  isBestOfThreeComplete,
  K_FACTOR,
  ratingWindow,
  softReset,
  tallyOutcome,
} from "../api/_lib/elo";

describe("ELO math", () => {
  it("expectedScore is 0.5 when ratings are equal", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 6);
  });

  it("400-rating gap puts the favorite at ~91%", () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(0.9091, 3);
  });

  it("expectedScore is symmetric across the pair", () => {
    expect(expectedScore(1500, 1300) + expectedScore(1300, 1500)).toBeCloseTo(1, 6);
  });

  it("applyElo: equal ratings, A wins => A gains K/2, B loses K/2", () => {
    const r = applyElo(1200, 1200, "a_win");
    expect(r.a - 1200).toBe(K_FACTOR / 2);
    expect(1200 - r.b).toBe(K_FACTOR / 2);
  });

  it("applyElo: draw between equals does not move ratings", () => {
    expect(applyElo(1200, 1200, "draw")).toEqual({ a: 1200, b: 1200 });
  });

  it("applyElo: heavy favorite winning gains very little", () => {
    const r = applyElo(1800, 1200, "a_win");
    expect(r.a - 1800).toBeLessThan(5);
  });

  it("applyElo: upset is rewarded", () => {
    const r = applyElo(1200, 1800, "a_win");
    expect(r.a - 1200).toBeGreaterThan(K_FACTOR - 5);
  });

  it("applyElo: ratings always change by the same magnitude in opposite directions", () => {
    const r = applyElo(1400, 1500, "a_win");
    expect(r.a - 1400).toBe(1500 - r.b);
  });
});

describe("best-of-three resolution", () => {
  it("2-0 stops at two rounds", () => {
    const o = tallyOutcome([10, 12], [4, 9]);
    expect(isBestOfThreeComplete(o, 2)).toBe(true);
    expect(decideResult(o)).toBe("a_win");
  });

  it("1-1 forces a third round", () => {
    const o = tallyOutcome([10, 4], [4, 9]);
    expect(isBestOfThreeComplete(o, 2)).toBe(false);
  });

  it("0-0 draws across three rounds is a tie", () => {
    const o = tallyOutcome([0, 0, 0], [0, 0, 0]);
    expect(isBestOfThreeComplete(o, 3)).toBe(true);
    expect(decideResult(o)).toBe("draw");
  });

  it("1-1-1 (one tie) -> tie if other two cancel", () => {
    const o = tallyOutcome([5, 6, 7], [4, 6, 9]);
    expect(decideResult(o)).toBe("draw");
  });
});

describe("season soft reset", () => {
  it("pulls 75% back toward 1200", () => {
    expect(softReset(1600)).toBe(1300);
    expect(softReset(1200)).toBe(1200);
    expect(softReset(800)).toBe(1100);
  });
});

describe("matchmaking rating window", () => {
  it("starts narrow", () => {
    expect(ratingWindow(0)).toBe(100);
    expect(ratingWindow(299)).toBe(100);
  });
  it("widens at 5 min", () => {
    expect(ratingWindow(300)).toBe(200);
    expect(ratingWindow(599)).toBe(200);
  });
  it("opens to anyone after 15 min", () => {
    expect(ratingWindow(900)).toBe(Number.POSITIVE_INFINITY);
  });
});

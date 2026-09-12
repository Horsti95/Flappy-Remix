import { describe, it, expect } from "vitest";
import { shouldShowNudge } from "../src/ui/secure-account-nudge";

/**
 * The nudge is the only place the app tells a player their anonymous account
 * exists solely in this browser's storage. It has to fire often enough to
 * matter and rarely enough not to nag.
 */
describe("shouldShowNudge", () => {
  it("stays quiet before there is anything worth losing", () => {
    for (const g of [0, 1, 10, 24]) expect(shouldShowNudge(g, 0)).toBe(false);
  });

  it("fires once there is real progress and it was never dismissed", () => {
    expect(shouldShowNudge(25, 0)).toBe(true);
    expect(shouldShowNudge(500, 0)).toBe(true);
  });

  it("stays quiet right after a dismissal", () => {
    expect(shouldShowNudge(25, 25)).toBe(false);
    expect(shouldShowNudge(40, 25)).toBe(false);
  });

  it("returns when the stakes have roughly doubled", () => {
    expect(shouldShowNudge(50, 25)).toBe(true);
    expect(shouldShowNudge(200, 100)).toBe(true);
  });

  it("escalates rather than repeating — each dismissal raises the bar", () => {
    let dismissed = 0;
    const shown: number[] = [];
    for (let games = 0; games <= 800; games++) {
      if (shouldShowNudge(games, dismissed)) {
        shown.push(games);
        dismissed = games;
      }
    }
    // Roughly log2 growth from 25 to 800 — a handful of prompts over a very
    // long play history, never a per-session interruption.
    expect(shown).toEqual([25, 50, 100, 200, 400, 800]);
    expect(shown.length).toBeLessThan(8);
  });

  it("never fires below the floor no matter the dismissal record", () => {
    expect(shouldShowNudge(24, 1)).toBe(false);
    expect(shouldShowNudge(5, 0)).toBe(false);
  });
});

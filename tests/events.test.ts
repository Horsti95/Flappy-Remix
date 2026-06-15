import { describe, it, expect } from "vitest";
import { getActiveEvent, EVENTS } from "../src/game/events";

describe("events — active window", () => {
  const wc = EVENTS.find((e) => e.id === "worldcup-2026")!;

  it("has a coherent World Cup package", () => {
    expect(wc).toBeTruthy();
    expect(wc.rewards.length).toBeGreaterThanOrEqual(5);
    // Thresholds strictly increasing so the popup reads as a ladder.
    const ts = wc.rewards.map((r) => r.threshold);
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1]);
  });

  it("is active inside the window (inclusive) and dormant outside", () => {
    expect(getActiveEvent(new Date("2026-06-01T12:00:00"))).toBeTruthy();
    expect(getActiveEvent(new Date("2026-06-15T12:00:00"))?.id).toBe("worldcup-2026");
    expect(getActiveEvent(new Date("2026-07-31T23:00:00"))).toBeTruthy();
    expect(getActiveEvent(new Date("2026-05-31T12:00:00"))).toBeNull();
    expect(getActiveEvent(new Date("2026-08-01T12:00:00"))).toBeNull();
  });
});

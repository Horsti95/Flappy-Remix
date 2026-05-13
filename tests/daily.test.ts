import { describe, it, expect } from "vitest";
import { dailyDateString, dailySeed, todayDailySeed, yesterdayUtc } from "../src/game/daily";
import { computeStreak } from "../api/_lib/streak";

describe("daily seed", () => {
  it("returns the same seed for the same date across independent calls", () => {
    expect(dailySeed("2026-05-13")).toBe(dailySeed("2026-05-13"));
  });

  it("returns different seeds for different dates", () => {
    expect(dailySeed("2026-05-13")).not.toBe(dailySeed("2026-05-14"));
  });

  it("rejects malformed date strings", () => {
    expect(() => dailySeed("13/05/2026")).toThrow();
    expect(() => dailySeed("2026-13-01")).not.toThrow(); // shape-only check; calendar validation is the caller's job
  });

  it("dailyDateString uses UTC", () => {
    const d = new Date(Date.UTC(2026, 4, 13, 23, 59, 59));
    expect(dailyDateString(d)).toBe("2026-05-13");
    const next = new Date(Date.UTC(2026, 4, 14, 0, 0, 1));
    expect(dailyDateString(next)).toBe("2026-05-14");
  });

  it("todayDailySeed includes today's date", () => {
    const fixed = new Date(Date.UTC(2026, 0, 1));
    const t = todayDailySeed(fixed);
    expect(t.date).toBe("2026-01-01");
    expect(t.seed).toBe(dailySeed("2026-01-01"));
  });

  it("yesterdayUtc wraps the month boundary", () => {
    expect(yesterdayUtc("2026-03-01")).toBe("2026-02-28");
    expect(yesterdayUtc("2024-03-01")).toBe("2024-02-29"); // leap year
    expect(yesterdayUtc("2026-01-01")).toBe("2025-12-31");
  });
});

describe("streak", () => {
  const now = new Date(Date.UTC(2026, 4, 13, 12));
  const today = "2026-05-13";
  const yesterday = "2026-05-12";
  const lastWeek = "2026-05-06";

  it("first run ever bumps streak to 1 for casual", () => {
    const r = computeStreak({
      prevStreak: 0,
      lastPlayAt: null,
      lastDailyPlayAt: null,
      mode: "casual",
      now,
    });
    expect(r.streakDays).toBe(1);
  });

  it("first run ever bumps streak to 2 for daily", () => {
    const r = computeStreak({
      prevStreak: 0,
      lastPlayAt: null,
      lastDailyPlayAt: null,
      mode: "daily",
      now,
    });
    expect(r.streakDays).toBe(2);
    expect(r.lastDailyPlayAt).toBe(today);
  });

  it("casual run on a consecutive day adds 1", () => {
    const r = computeStreak({
      prevStreak: 4,
      lastPlayAt: yesterday + "T20:00:00Z",
      lastDailyPlayAt: null,
      mode: "casual",
      now,
    });
    expect(r.streakDays).toBe(5);
  });

  it("daily run on a consecutive day adds 2", () => {
    const r = computeStreak({
      prevStreak: 4,
      lastPlayAt: yesterday + "T20:00:00Z",
      lastDailyPlayAt: yesterday,
      mode: "daily",
      now,
    });
    expect(r.streakDays).toBe(6);
    expect(r.lastDailyPlayAt).toBe(today);
  });

  it("missing a day resets the streak", () => {
    const r = computeStreak({
      prevStreak: 9,
      lastPlayAt: lastWeek + "T12:00:00Z",
      lastDailyPlayAt: null,
      mode: "casual",
      now,
    });
    expect(r.streakDays).toBe(1);
  });

  it("a daily run after a casual on the same day adds the daily bonus once", () => {
    const r = computeStreak({
      prevStreak: 3,
      lastPlayAt: today + "T01:00:00Z",
      lastDailyPlayAt: null,
      mode: "daily",
      now,
    });
    expect(r.streakDays).toBe(4);
    expect(r.lastDailyPlayAt).toBe(today);
  });

  it("second daily run of the same day does not add again", () => {
    const r = computeStreak({
      prevStreak: 5,
      lastPlayAt: today + "T01:00:00Z",
      lastDailyPlayAt: today,
      mode: "daily",
      now,
    });
    expect(r.streakDays).toBe(5);
  });

  it("second casual run of the same day does not add again", () => {
    const r = computeStreak({
      prevStreak: 7,
      lastPlayAt: today + "T01:00:00Z",
      lastDailyPlayAt: null,
      mode: "casual",
      now,
    });
    expect(r.streakDays).toBe(7);
  });
});

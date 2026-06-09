import { describe, it, expect } from "vitest";
import {
  BADGES,
  badgeUnlocked,
  earnedBadges,
  lockedVisibleBadges,
  setBadgeLabMode,
} from "../src/game/badges-catalog";
import type { AchievementStats } from "../src/game/achievements";

const EMPTY: AchievementStats = {
  totalGames: 0,
  bestScore: 0,
  totalScore: 0,
  streakDays: 0,
  bestScoreDaily: 0,
  hardDailyBest: 0,
  superHardDailyBest: 0,
  nightGames: 0,
  morningGames: 0,
  challengeWins: 0,
  dailyStreakDays: 0,
  friendCount: 0,
  lateNightGames: 0,
  minimalistDone: false,
  runsOver100: 0,
  consecutiveUnder100: 0,
  consecutiveOver50: 0,
  bestRankedTotal: 0,
  bestRankedFloor: 0,
};

describe("badges catalog", () => {
  it("has unique ids", () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a fresh player has earned nothing", () => {
    expect(earnedBadges(EMPTY)).toEqual([]);
  });

  it("reviewer unlocks on feedback", () => {
    const reviewer = BADGES.find((b) => b.id === "reviewer")!;
    expect(badgeUnlocked(reviewer, EMPTY)).toBe(false);
    expect(badgeUnlocked(reviewer, { ...EMPTY, feedbackGiven: true })).toBe(true);
  });

  it("frequent flyer unlocks at 300 games", () => {
    const ff = BADGES.find((b) => b.id === "frequent_flyer")!;
    expect(badgeUnlocked(ff, { ...EMPTY, totalGames: 299 })).toBe(false);
    expect(badgeUnlocked(ff, { ...EMPTY, totalGames: 300 })).toBe(true);
  });

  it("all-hours needs both morning and night games", () => {
    const ah = BADGES.find((b) => b.id === "round_the_clock")!;
    expect(badgeUnlocked(ah, { ...EMPTY, morningGames: 15 })).toBe(false);
    expect(badgeUnlocked(ah, { ...EMPTY, morningGames: 15, nightGames: 15 })).toBe(true);
  });

  it("prestige badges are secret; supporter is a granted teaser", () => {
    expect(BADGES.find((b) => b.id === "centurion_streak")!.secret).toBe(true);
    expect(BADGES.find((b) => b.id === "social_butterfly")!.secret).toBe(true);
    // Supporter has no in-game criterion — never earned from play alone.
    const supporter = BADGES.find((b) => b.id === "supporter")!;
    expect(supporter.check(EMPTY)).toBe(false);
    // ...and being non-secret, it shows as a locked teaser for a fresh player.
    expect(lockedVisibleBadges(EMPTY).map((b) => b.id)).toContain("supporter");
  });

  it("lab mode unlocks everything", () => {
    setBadgeLabMode(true);
    try {
      expect(earnedBadges(EMPTY).length).toBe(BADGES.length);
    } finally {
      setBadgeLabMode(false);
    }
  });
});

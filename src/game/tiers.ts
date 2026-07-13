/**
 * Cosmetic tiers — Bronze / Silver / Gold / Legendary.
 *
 * Rather than hand-tag ~70 cosmetics (and risk drift), a tier is DERIVED from
 * an item's existing unlock condition: we probe the unlock against escalating
 * player profiles and bucket by how far you have to climb to earn it. This
 * gives a consistent difficulty ladder for free and changes no unlock logic.
 */

import type { AchievementStats } from "./achievements";

export type Tier = "bronze" | "silver" | "gold" | "legendary";

export const TIER_ORDER: Tier[] = ["bronze", "silver", "gold", "legendary"];

export const TIER_LABEL: Record<Tier, string> = {
  bronze: "bronze",
  silver: "silver",
  gold: "gold",
  legendary: "legendary",
};

export const TIER_COLOR: Record<Tier, string> = {
  bronze: "#cd8a52",
  silver: "#cdd3da",
  gold: "#f5c542",
  legendary: "#c084fc",
};

export function tierRank(t: Tier): number {
  return TIER_ORDER.indexOf(t);
}

// Escalating player snapshots (cumulative), each a FULL AchievementStats (a
// zeroed base + the fields that escalate) so any axis's unlock(stats) can be
// probed with one typed object. Ordered easy → hard; the tier is taken from
// the FIRST snapshot that unlocks the item. Fields not listed (totalScore,
// ranked bests, secret latches…) stay at zero/false in every snapshot, so
// items gated on them derive "legendary" — the right bucket for feats the
// ladder can't grade.
const ZERO: AchievementStats = {
  totalGames: 0, bestScore: 0, totalScore: 0, streakDays: 0, bestScoreDaily: 0,
  hardDailyBest: 0, superHardDailyBest: 0, extremeDailyBest: 0, bestGlideTicks: 0,
  pbsToday: 0, nightGames: 0, morningGames: 0, challengeWins: 0,
  dailyStreakDays: 0, friendCount: 0, lateNightGames: 0, minimalistDone: false,
  runsOver100: 0, consecutiveUnder100: 0, consecutiveOver50: 0,
  bestRankedTotal: 0, bestRankedFloor: 0,
};
const PROFILES: AchievementStats[] = [
  // bronze — early game
  { ...ZERO, totalGames: 8, bestScore: 12, streakDays: 1, friendCount: 1,
    bestScoreDaily: 5 },
  // silver — getting into it
  { ...ZERO, totalGames: 30, bestScore: 30, streakDays: 3, challengeWins: 1,
    friendCount: 3, lateNightGames: 1, morningGames: 2, dailyStreakDays: 1,
    nightGames: 2, bestScoreDaily: 15 },
  // gold — committed
  { ...ZERO, totalGames: 120, bestScore: 65, streakDays: 7, challengeWins: 3,
    friendCount: 5, lateNightGames: 5, morningGames: 5, dailyStreakDays: 3,
    nightGames: 8, bestScoreDaily: 25 },
  // legendary — mastery
  { ...ZERO, totalGames: 600, bestScore: 130, streakDays: 20, challengeWins: 8,
    friendCount: 25, lateNightGames: 50, morningGames: 30, dailyStreakDays: 7,
    nightGames: 30, bestScoreDaily: 60 },
];
const PROFILE_TIER: Tier[] = ["bronze", "silver", "gold", "legendary"];

/** Derive a tier from an unlock predicate (the registries' `unlock(stats)`). */
export function tierForUnlock(unlock: (s: AchievementStats) => { unlocked: boolean }): Tier {
  for (let i = 0; i < PROFILES.length; i++) {
    if (unlock(PROFILES[i]).unlocked) return PROFILE_TIER[i];
  }
  return "legendary";
}

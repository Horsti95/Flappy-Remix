/**
 * Cosmetic tiers — Bronze / Silver / Gold / Legendary.
 *
 * Rather than hand-tag ~70 cosmetics (and risk drift), a tier is DERIVED from
 * an item's existing unlock condition: we probe the unlock against escalating
 * player profiles and bucket by how far you have to climb to earn it. This
 * gives a consistent difficulty ladder for free and changes no unlock logic.
 */

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

// Escalating player snapshots (cumulative). Every field every unlock might read
// is present, so any axis's unlock(stats) can be probed with one object. Ordered
// easy → hard; the tier is taken from the FIRST snapshot that unlocks the item.
type Probe = Record<string, number>;
const PROFILES: Probe[] = [
  // bronze — early game
  { totalGames: 8, bestScore: 12, streakDays: 1, challengeWins: 0, friendCount: 1,
    lateNightGames: 0, morningGames: 0, dailyStreakDays: 0, nightGames: 0, bestScoreDaily: 5 },
  // silver — getting into it
  { totalGames: 30, bestScore: 30, streakDays: 3, challengeWins: 1, friendCount: 3,
    lateNightGames: 1, morningGames: 2, dailyStreakDays: 1, nightGames: 2, bestScoreDaily: 15 },
  // gold — committed
  { totalGames: 120, bestScore: 65, streakDays: 7, challengeWins: 3, friendCount: 5,
    lateNightGames: 5, morningGames: 5, dailyStreakDays: 3, nightGames: 8, bestScoreDaily: 25 },
  // legendary — mastery
  { totalGames: 600, bestScore: 130, streakDays: 20, challengeWins: 8, friendCount: 25,
    lateNightGames: 50, morningGames: 30, dailyStreakDays: 7, nightGames: 30, bestScoreDaily: 60 },
];
const PROFILE_TIER: Tier[] = ["bronze", "silver", "gold", "legendary"];

/** Derive a tier from an unlock predicate (the registries' `unlock(stats)`). */
export function tierForUnlock(unlock: (s: never) => { unlocked: boolean }): Tier {
  for (let i = 0; i < PROFILES.length; i++) {
    try {
      if (unlock(PROFILES[i] as never).unlocked) return PROFILE_TIER[i];
    } catch {
      /* unlock read a missing field — treat as not yet unlocked at this tier */
    }
  }
  return "legendary";
}

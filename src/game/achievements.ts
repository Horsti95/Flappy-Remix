import type { SkinColors } from "./skin";

export interface AchievementDef {
  id: string;
  name: string;
  blurb: string;
  category: "score" | "efficiency" | "streak" | "daily" | "social" | "milestone" | "special";
  reward: { type: "color"; body: [number, number, number]; accent: [number, number, number] };
  check(stats: AchievementStats): boolean;
}

export interface AchievementStats {
  totalGames: number;
  bestScore: number;
  streakDays: number;
  // Extended stats tracked in localStorage until we lift to server
  bestScoreDaily: number;
  hardDailyBest: number;
  superHardDailyBest: number;
  nightGames: number;
  morningGames: number;
  challengeWins: number;
  dailyStreakDays: number;
  friendCount: number;
  /** Plays where the local hour was in [23, 0, 1, 2, 3]. */
  lateNightGames: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- Score-based (all on default paper plane) ---
  {
    id: "first_flight",
    name: "first flight",
    blurb: "play your first game",
    category: "score",
    reward: { type: "color", body: [173, 216, 230], accent: [255, 255, 255] },
    check: (s) => s.totalGames >= 1,
  },
  {
    id: "bronze_pilot",
    name: "bronze pilot",
    blurb: "score 50+ in a single run",
    category: "score",
    reward: { type: "color", body: [205, 127, 50], accent: [139, 90, 43] },
    check: (s) => s.bestScore >= 50,
  },
  {
    id: "silver_ace",
    name: "silver ace",
    blurb: "score 75+ in a single run",
    category: "score",
    reward: { type: "color", body: [192, 192, 192], accent: [140, 140, 140] },
    check: (s) => s.bestScore >= 75,
  },
  {
    id: "gold_legend",
    name: "gold legend",
    blurb: "score 100+ in a single run",
    category: "score",
    reward: { type: "color", body: [255, 215, 0], accent: [50, 40, 10] },
    check: (s) => s.bestScore >= 100,
  },
  {
    id: "diamond",
    name: "diamond",
    blurb: "score 200+ in a single run",
    category: "score",
    reward: { type: "color", body: [185, 242, 255], accent: [255, 255, 255] },
    check: (s) => s.bestScore >= 200,
  },
  {
    id: "obsidian",
    name: "obsidian",
    blurb: "score 500+ in a single run",
    category: "score",
    reward: { type: "color", body: [20, 20, 20], accent: [139, 0, 0] },
    check: (s) => s.bestScore >= 500,
  },

  // --- Efficiency-based ---
  {
    id: "minimalist",
    name: "minimalist",
    blurb: "score 25+ with fewer than 80 taps",
    category: "efficiency",
    reward: { type: "color", body: [180, 180, 180], accent: [100, 100, 100] },
    check: () => false, // requires per-run tap count tracking
  },

  // --- Streak-based ---
  {
    id: "weekender",
    name: "weekender",
    blurb: "7-day streak",
    category: "streak",
    reward: { type: "color", body: [255, 140, 0], accent: [200, 80, 0] },
    check: (s) => s.streakDays >= 7,
  },
  {
    id: "dedicated",
    name: "dedicated",
    blurb: "14-day streak",
    category: "streak",
    reward: { type: "color", body: [180, 120, 255], accent: [100, 60, 200] },
    check: (s) => s.streakDays >= 14,
  },
  {
    id: "unstoppable",
    name: "unstoppable",
    blurb: "30-day streak",
    category: "streak",
    reward: { type: "color", body: [255, 100, 100], accent: [100, 200, 255] },
    check: (s) => s.streakDays >= 30,
  },

  // --- Daily-modifier-based ---
  {
    id: "storm_survivor",
    name: "storm survivor",
    blurb: "score 25+ on a hard daily",
    category: "daily",
    reward: { type: "color", body: [30, 60, 120], accent: [255, 230, 0] },
    check: (s) => s.hardDailyBest >= 25,
  },
  {
    id: "iron_will",
    name: "iron will",
    blurb: "score 25+ on a super hard daily",
    category: "daily",
    reward: { type: "color", body: [180, 20, 20], accent: [20, 20, 20] },
    check: (s) => s.superHardDailyBest >= 25,
  },
  {
    id: "night_owl",
    name: "night owl",
    blurb: "play 10 games between 22:00 and 04:00",
    category: "daily",
    reward: { type: "color", body: [15, 25, 60], accent: [255, 255, 230] },
    check: (s) => s.nightGames >= 10,
  },
  {
    id: "early_bird",
    name: "early bird",
    blurb: "play 10 games between 05:00 and 07:00",
    category: "daily",
    reward: { type: "color", body: [255, 180, 200], accent: [255, 215, 0] },
    check: (s) => s.morningGames >= 10,
  },

  // --- Social-based ---
  {
    id: "friend_5",
    name: "small flock",
    blurb: "add 5 friends",
    category: "social",
    reward: { type: "color", body: [120, 220, 200], accent: [40, 90, 110] },
    check: (s) => s.friendCount >= 5,
  },
  {
    id: "friend_25",
    name: "big flock",
    blurb: "add 25 friends — paper plane swarm unlocked",
    category: "social",
    reward: { type: "color", body: [255, 200, 80], accent: [180, 40, 120] },
    check: (s) => s.friendCount >= 25,
  },
  {
    id: "challenger",
    name: "challenger",
    blurb: "win 5 challenges",
    category: "social",
    reward: { type: "color", body: [255, 80, 0], accent: [255, 140, 0] },
    check: (s) => s.challengeWins >= 5,
  },
  {
    id: "rival",
    name: "rival",
    blurb: "win 10 challenges",
    category: "social",
    reward: { type: "color", body: [200, 0, 0], accent: [255, 100, 50] },
    check: (s) => s.challengeWins >= 10,
  },

  // --- Milestone-based ---
  {
    id: "veteran",
    name: "veteran",
    blurb: "play 100 games",
    category: "milestone",
    reward: { type: "color", body: [85, 107, 47], accent: [160, 160, 120] },
    check: (s) => s.totalGames >= 100,
  },
  {
    id: "addict",
    name: "addict",
    blurb: "play 500 games",
    category: "milestone",
    reward: { type: "color", body: [255, 20, 147], accent: [148, 0, 211] },
    check: (s) => s.totalGames >= 500,
  },
  {
    id: "legend",
    name: "legend",
    blurb: "play 1000 games",
    category: "milestone",
    reward: { type: "color", body: [200, 200, 255], accent: [255, 200, 200] },
    check: (s) => s.totalGames >= 1000,
  },

  // --- Special ---
  {
    id: "on_fire",
    name: "on fire",
    blurb: "score 20+ in 5 dailys in a row",
    category: "special",
    reward: { type: "color", body: [255, 107, 53], accent: [196, 30, 58] },
    check: (s) => s.dailyStreakDays >= 5 && s.bestScoreDaily >= 20,
  },
];

const STATS_KEY = "pflug.achievementStats.v1";

export function loadAchievementStats(): AchievementStats {
  const defaults: AchievementStats = {
    totalGames: 0,
    bestScore: 0,
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
  };
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveAchievementStats(stats: AchievementStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* localStorage blocked */
  }
}

export function updateStatsAfterRun(
  stats: AchievementStats,
  run: { score: number; mode: string; tier?: string; inputCount?: number },
): AchievementStats {
  const s = { ...stats };
  s.totalGames++;
  if (run.score > s.bestScore) s.bestScore = run.score;

  if (run.mode === "daily") {
    if (run.score > s.bestScoreDaily) s.bestScoreDaily = run.score;
    if (run.tier === "hard" && run.score > s.hardDailyBest) s.hardDailyBest = run.score;
    if (run.tier === "super_hard" && run.score > s.superHardDailyBest) s.superHardDailyBest = run.score;
    if (run.score >= 20) {
      s.dailyStreakDays++;
    } else {
      s.dailyStreakDays = 0;
    }
  }

  const hour = new Date().getHours();
  if (hour >= 22 || hour < 4) s.nightGames++;
  if (hour === 23 || hour < 4) s.lateNightGames++;
  if (hour >= 5 && hour < 7) s.morningGames++;

  return s;
}

export function getUnlockedAchievements(stats: AchievementStats): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.check(stats));
}

export function getNewlyUnlocked(before: AchievementStats, after: AchievementStats): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !a.check(before) && a.check(after));
}

export function achievementToSkin(a: AchievementDef): SkinColors {
  return { body: a.reward.body, accent: a.reward.accent };
}

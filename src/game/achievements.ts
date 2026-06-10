import { DEFAULT_SKIN, type SkinColors } from "./skin";
import type { FlapFxId } from "./flap-fx";
import type { FlapSoundId } from "./sfx";

type RGB = [number, number, number];

/**
 * What an achievement grants on unlock. Most are a `color` skin, but an
 * achievement can also hand the player a flap FX or a flap sound, which the
 * game auto-equips when the achievement is earned.
 */
export type AchievementReward =
  | { type: "color"; body: RGB; accent: RGB }
  | { type: "fx"; fxId: FlapFxId }
  | { type: "sound"; soundId: FlapSoundId };

export interface AchievementDef {
  id: string;
  name: string;
  blurb: string;
  category: "score" | "efficiency" | "streak" | "daily" | "social" | "milestone" | "special" | "ranked";
  reward: AchievementReward;
  /** Prestige rewards stay a blacked-out mystery while locked (the color is
   *  a surprise). Most rewards preview their real color when locked; only a
   *  few rare/special ones set this. */
  secret?: boolean;
  check(stats: AchievementStats): boolean;
}

export interface AchievementStats {
  totalGames: number;
  bestScore: number;
  /** Lifetime points scored across every run (all modes). Accrues forward
   *  from when this field shipped; old runs aren't retro-counted. */
  totalScore: number;
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
  /** Set once a run scores 25+ using fewer than 80 taps (the "minimalist" goal). */
  minimalistDone: boolean;
  /** Lifetime count of runs that scored over 100 (not necessarily in a row). */
  runsOver100: number;
  /** Current streak of consecutive runs scoring under 100 (resets on a 100+). */
  consecutiveUnder100: number;
  /** Current streak of consecutive runs scoring over 50 (resets on a 50 or under). */
  consecutiveOver50: number;
  /** Best total score (sum of your round scores) in a single ranked match. */
  bestRankedTotal: number;
  /** Highest "floor" (lowest round score) across ranked matches where you
   *  played all three rounds. Drives the "every round above X" unlocks. */
  bestRankedFloor: number;
  /** Latched once the player opens the feedback flow. Honour-system (we can't
   *  verify an external form was sent) — fine for a cosmetic reward. Optional
   *  so existing stored stats / test fixtures stay valid without a migration. */
  feedbackGiven?: boolean;

  // --- Secret-achievement latches. All optional (like `feedbackGiven`) so
  // stored stats and fixtures predating them stay valid. Each latches true
  // inside `updateStatsAfterRun` and is never reset, so once a secret is
  // earned no later run can revoke it.

  /** Score of the most recent completed run — drives the consecutive
   *  exact-score secrets (6-then-7, déjà vu). Undefined until a run lands. */
  prevRunScore?: number;
  /** Scored exactly 6, then exactly 7 in the very next run. */
  sixSevenDone?: boolean;
  /** Scored exactly 67 in a single run. */
  exact67Done?: boolean;
  /** Scored exactly 42 in a single run. */
  exact42Done?: boolean;
  /** Scored exactly 100 in a single run — not 99, not 101. */
  exact100Done?: boolean;
  /** Scored exactly 13 in a single run. */
  exact13Done?: boolean;
  /** Scored exactly 1 in a single run. */
  exact1Done?: boolean;
  /** Scored a 3+ digit palindrome (101, 111, 121, … 1221, …) in a run. */
  palindromeDone?: boolean;
  /** Scored the exact same score (5+) in two consecutive runs. */
  dejaVuDone?: boolean;
  /** Finished a run without a single flap (input data present and zero). */
  zeroFlapDone?: boolean;
}

/** True for scores that read the same backwards, 3+ digits (101, 1221, …). */
function isPalindromeScore(score: number): boolean {
  if (score < 101 || !Number.isInteger(score)) return false;
  const s = String(score);
  return s === [...s].reverse().join("");
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
    id: "back_for_more",
    name: "back for more",
    blurb: "play your 2nd game",
    category: "score",
    reward: { type: "color", body: [255, 209, 102], accent: [90, 60, 10] },
    check: (s) => s.totalGames >= 2,
  },
  {
    id: "hooked",
    name: "hooked",
    blurb: "play your 3rd game — you've got the hang of it!",
    category: "score",
    reward: { type: "color", body: [6, 214, 160], accent: [10, 60, 50] },
    check: (s) => s.totalGames >= 3,
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
    secret: true,
    check: (s) => s.bestScore >= 200,
  },
  {
    id: "obsidian",
    name: "obsidian",
    blurb: "score 500+ in a single run",
    category: "score",
    reward: { type: "color", body: [20, 20, 20], accent: [139, 0, 0] },
    secret: true,
    check: (s) => s.bestScore >= 500,
  },

  // --- Efficiency-based ---
  {
    id: "minimalist",
    name: "minimalist",
    blurb: "score 25+ with fewer than 80 taps",
    category: "efficiency",
    reward: { type: "sound", soundId: "paper_whoosh" },
    check: (s) => s.minimalistDone === true,
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
    secret: true,
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
    blurb: "win 5 challenges — beat a friend's ghost on their seed",
    category: "social",
    reward: { type: "color", body: [255, 80, 0], accent: [255, 140, 0] },
    check: (s) => s.challengeWins >= 5,
  },
  {
    id: "rival",
    name: "rival",
    blurb: "win 10 challenges — outscore a friend's duel ghost",
    category: "social",
    reward: { type: "fx", fxId: "ring_pulse" },
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
    secret: true,
    check: (s) => s.totalGames >= 1000,
  },

  // --- Cumulative score (lifetime points across all runs) ---
  {
    id: "points_500",
    name: "frequent flyer",
    blurb: "score 500 points total — across all your runs",
    category: "milestone",
    reward: { type: "color", body: [120, 200, 255], accent: [40, 90, 160] },
    check: (s) => s.totalScore >= 500,
  },
  {
    id: "points_1000",
    name: "high mileage",
    blurb: "score 1,000 points total",
    category: "milestone",
    reward: { type: "color", body: [255, 190, 90], accent: [150, 90, 20] },
    check: (s) => s.totalScore >= 1000,
  },
  {
    id: "points_2000",
    name: "globetrotter",
    blurb: "score 2,000 points total",
    category: "milestone",
    reward: { type: "color", body: [130, 230, 150], accent: [30, 110, 60] },
    check: (s) => s.totalScore >= 2000,
  },
  {
    id: "points_5000",
    name: "frequent flock",
    blurb: "score 5,000 points total",
    category: "milestone",
    reward: { type: "color", body: [200, 150, 255], accent: [90, 50, 160] },
    check: (s) => s.totalScore >= 5000,
  },
  {
    id: "points_10000",
    name: "ten thousand",
    blurb: "score 10,000 points total",
    category: "milestone",
    reward: { type: "color", body: [255, 215, 0], accent: [120, 80, 0] },
    secret: true,
    check: (s) => s.totalScore >= 10000,
  },
  {
    id: "points_100000",
    name: "cosmic mileage",
    blurb: "score 100,000 points total — a true legend of the skies",
    category: "milestone",
    reward: { type: "color", body: [230, 240, 255], accent: [140, 60, 200] },
    secret: true,
    check: (s) => s.totalScore >= 100000,
  },

  // --- Special ---
  {
    id: "on_fire",
    name: "on fire",
    blurb: "score 20+ in 5 dailys in a row",
    category: "special",
    reward: { type: "color", body: [255, 107, 53], accent: [196, 30, 58] },
    secret: true,
    check: (s) => s.dailyStreakDays >= 5 && s.bestScoreDaily >= 20,
  },
  {
    id: "centurion",
    name: "centurion",
    blurb: "score 100+ in five separate runs",
    category: "score",
    reward: { type: "sound", soundId: "glass_tap" },
    check: (s) => s.runsOver100 >= 5,
  },
  {
    id: "bridesmaid",
    name: "bridesmaid",
    blurb: "score under 100 in 3 runs in a row — so close, so often",
    category: "special",
    reward: { type: "color", body: [170, 170, 175], accent: [120, 90, 60] },
    check: (s) => s.consecutiveUnder100 >= 3,
  },
  {
    id: "metronome",
    name: "metronome",
    blurb: "score over 50 in 20 runs in a row",
    category: "special",
    reward: { type: "fx", fxId: "sparkle" },
    secret: true,
    check: (s) => s.consecutiveOver50 >= 20,
  },
  {
    id: "kinda_game_dev",
    name: "kinda game dev",
    blurb: "send us feedback — you basically work here now",
    category: "special",
    reward: { type: "color", body: [57, 255, 20], accent: [12, 35, 12] },
    secret: true,
    check: (s) => s.feedbackGiven === true,
  },

  // --- Secret numerology & odd behaviors (discover them in play!) ---
  {
    id: "six_seven",
    name: "Six… Seven!",
    blurb: "score exactly 6, then exactly 7 in the very next run",
    category: "special",
    reward: { type: "color", body: [167, 67, 255], accent: [255, 214, 67] },
    secret: true,
    check: (s) => s.sixSevenDone === true,
  },
  {
    id: "exact_67",
    name: "the whole sixty-seven",
    blurb: "land a run on exactly 67 — no more, no less",
    category: "special",
    reward: { type: "color", body: [67, 167, 255], accent: [255, 103, 67] },
    secret: true,
    check: (s) => s.exact67Done === true,
  },
  {
    id: "points_404",
    name: "404: paint not found",
    blurb: "cross 404 lifetime points — this skin could not be loaded",
    category: "milestone",
    reward: { type: "color", body: [45, 45, 50], accent: [190, 190, 200] },
    secret: true,
    check: (s) => s.totalScore >= 404,
  },
  {
    id: "exact_42",
    name: "the answer",
    blurb: "score exactly 42 in a run — to life, the universe, and everything",
    category: "special",
    reward: { type: "color", body: [25, 55, 110], accent: [200, 220, 255] },
    secret: true,
    check: (s) => s.exact42Done === true,
  },
  {
    id: "points_1337",
    name: "elite mileage",
    blurb: "cross 1,337 lifetime points — speak fluent keyboard",
    category: "milestone",
    reward: { type: "color", body: [12, 12, 12], accent: [57, 255, 120] },
    secret: true,
    check: (s) => s.totalScore >= 1337,
  },
  {
    id: "points_3141",
    name: "a slice of pi",
    blurb: "cross 3,141 lifetime points — irrationally delicious",
    category: "milestone",
    reward: { type: "color", body: [230, 175, 110], accent: [200, 60, 60] },
    secret: true,
    check: (s) => s.totalScore >= 3141,
  },
  {
    id: "zero_flap",
    name: "gravity wins",
    blurb: "finish a run without flapping even once",
    category: "special",
    reward: { type: "color", body: [125, 105, 85], accent: [70, 55, 40] },
    secret: true,
    check: (s) => s.zeroFlapDone === true,
  },
  {
    id: "palindrome",
    name: "racecar",
    blurb: "score a palindrome of 101 or more — same forwards and backwards",
    category: "special",
    reward: { type: "color", body: [212, 218, 228], accent: [90, 95, 110] },
    secret: true,
    check: (s) => s.palindromeDone === true,
  },
  {
    id: "exact_100",
    name: "right on the nose",
    blurb: "score exactly 100 — not 99, not 101",
    category: "special",
    reward: { type: "color", body: [255, 250, 245], accent: [220, 30, 30] },
    secret: true,
    check: (s) => s.exact100Done === true,
  },
  {
    id: "exact_1",
    name: "one and done",
    blurb: "score exactly 1 — a single, perfect point",
    category: "special",
    reward: { type: "color", body: [255, 245, 200], accent: [255, 180, 0] },
    secret: true,
    check: (s) => s.exact1Done === true,
  },
  {
    id: "lucky_13",
    name: "black cat",
    blurb: "score exactly 13 — who said it was unlucky?",
    category: "special",
    reward: { type: "color", body: [25, 25, 28], accent: [60, 200, 90] },
    secret: true,
    check: (s) => s.exact13Done === true,
  },
  {
    id: "deja_vu",
    name: "déjà vu",
    blurb: "score the exact same score (5+) twice in a row",
    category: "special",
    reward: { type: "color", body: [150, 110, 200], accent: [150, 110, 200] },
    secret: true,
    check: (s) => s.dejaVuDone === true,
  },

  // --- Cumulative score, elite tier ---
  {
    id: "points_12345",
    name: "ascendant",
    blurb: "score 12,345 points total — the perfect climb",
    category: "milestone",
    reward: { type: "color", body: [120, 220, 255], accent: [180, 60, 220] },
    secret: true,
    check: (s) => s.totalScore >= 12345,
  },

  // --- Ranked: match total (sum of your three rounds) ---
  {
    id: "ranked_total_100",
    name: "contender",
    blurb: "score 100+ total across a ranked match",
    category: "ranked",
    reward: { type: "color", body: [100, 140, 180], accent: [25, 45, 75] },
    check: (s) => s.bestRankedTotal >= 100,
  },
  {
    id: "ranked_total_300",
    name: "challenger",
    blurb: "score 300+ total across a ranked match",
    category: "ranked",
    reward: { type: "color", body: [165, 95, 230], accent: [55, 20, 95] },
    check: (s) => s.bestRankedTotal >= 300,
  },
  {
    id: "ranked_total_500",
    name: "grandmaster",
    blurb: "score 500+ total across a ranked match",
    category: "ranked",
    reward: { type: "color", body: [255, 190, 50], accent: [150, 25, 25] },
    secret: true,
    check: (s) => s.bestRankedTotal >= 500,
  },

  // --- Ranked: floor (every round of a 3-round match above a bar) ---
  {
    id: "ranked_floor_50",
    name: "qualified",
    blurb: "score over 50 in every round of a ranked match",
    category: "ranked",
    reward: { type: "color", body: [80, 200, 160], accent: [15, 70, 55] },
    check: (s) => s.bestRankedFloor >= 50,
  },
  {
    id: "ranked_floor_75",
    name: "seeded",
    blurb: "score over 75 in every round of a ranked match",
    category: "ranked",
    reward: { type: "color", body: [120, 180, 255], accent: [30, 60, 120] },
    check: (s) => s.bestRankedFloor >= 75,
  },
  {
    id: "ranked_floor_100",
    name: "dominant",
    blurb: "score over 100 in every round of a ranked match",
    category: "ranked",
    reward: { type: "color", body: [255, 140, 60], accent: [120, 40, 10] },
    secret: true,
    check: (s) => s.bestRankedFloor >= 100,
  },
  {
    id: "ranked_floor_250",
    name: "untouchable",
    blurb: "score over 250 in every round of a ranked match",
    category: "ranked",
    reward: { type: "color", body: [225, 245, 255], accent: [120, 90, 200] },
    secret: true,
    check: (s) => s.bestRankedFloor >= 250,
  },
];

const STATS_KEY = "pflug.achievementStats.v1";

export function loadAchievementStats(): AchievementStats {
  const defaults: AchievementStats = {
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
  s.totalScore += run.score;
  if (run.score > s.bestScore) s.bestScore = run.score;

  // "minimalist": a clean run of 25+ with fewer than 80 taps. Latches once
  // earned so a later tap-heavy run can't revoke it.
  if (run.score >= 25 && run.inputCount != null && run.inputCount < 80) {
    s.minimalistDone = true;
  }

  // Secret exact-score latches. Each is evaluated per completed run and
  // latches once earned (never reset), mirroring how `minimalistDone` works.
  if (run.score === 67) s.exact67Done = true;
  if (run.score === 42) s.exact42Done = true;
  if (run.score === 100) s.exact100Done = true;
  if (run.score === 13) s.exact13Done = true;
  if (run.score === 1) s.exact1Done = true;
  if (isPalindromeScore(run.score)) s.palindromeDone = true;
  if (run.inputCount != null && run.inputCount === 0) s.zeroFlapDone = true;

  // Consecutive exact-score secrets compare against the *immediately previous*
  // completed run. A run in between with any other score breaks the chain.
  if (stats.prevRunScore === 6 && run.score === 7) s.sixSevenDone = true;
  if (stats.prevRunScore != null && stats.prevRunScore === run.score && run.score >= 5) {
    s.dejaVuDone = true;
  }
  s.prevRunScore = run.score;

  // Score-band streak tracking (used by centurion / bridesmaid / metronome).
  if (run.score > 100) s.runsOver100++;
  s.consecutiveUnder100 = run.score < 100 ? s.consecutiveUnder100 + 1 : 0;
  s.consecutiveOver50 = run.score > 50 ? s.consecutiveOver50 + 1 : 0;

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

/**
 * Fold a completed ranked match into the stats. `roundScores` is the
 * player's own per-round scores (nulls already stripped). The "floor"
 * unlocks only count matches where all three rounds were actually played,
 * so an early 2-0 sweep doesn't satisfy "every round above X".
 */
export function updateRankedMatchStats(
  stats: AchievementStats,
  roundScores: number[],
): AchievementStats {
  if (roundScores.length === 0) return stats;
  const s = { ...stats };
  const total = roundScores.reduce((a, b) => a + b, 0);
  if (total > s.bestRankedTotal) s.bestRankedTotal = total;
  if (roundScores.length >= 3) {
    const floor = Math.min(...roundScores);
    if (floor > s.bestRankedFloor) s.bestRankedFloor = floor;
  }
  return s;
}

export function getUnlockedAchievements(stats: AchievementStats): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.check(stats));
}

/**
 * Latch the "gave feedback" flag and report the reviewer achievement if this
 * call is what *newly* earned it, so the caller can celebrate exactly once.
 * Idempotent — calling again after it's set is a no-op that unlocks nothing.
 */
export function markFeedbackGiven(): { newlyUnlocked: AchievementDef | null } {
  const before = loadAchievementStats();
  if (before.feedbackGiven) return { newlyUnlocked: null };
  const after: AchievementStats = { ...before, feedbackGiven: true };
  saveAchievementStats(after);
  const unlocked = getNewlyUnlocked(before, after);
  return { newlyUnlocked: unlocked.find((a) => a.id === "kinda_game_dev") ?? null };
}

export function getNewlyUnlocked(before: AchievementStats, after: AchievementStats): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !a.check(before) && a.check(after));
}

/** Color skin for a color-reward achievement; DEFAULT_SKIN for fx/sound rewards. */
export function achievementToSkin(a: AchievementDef): SkinColors {
  if (a.reward.type !== "color") return DEFAULT_SKIN;
  return { body: a.reward.body, accent: a.reward.accent };
}

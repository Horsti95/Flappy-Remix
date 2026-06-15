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

  // --- Death-cause goals (gated to level 5+, latched once earned). Each is set
  // in updateStatsAfterRun when a run ends that way at/after level 5.
  /** Crashed into a pillar at level 5+. */
  diedPillarL5?: boolean;
  /** Hit the ceiling (flew off the top) at level 5+. */
  diedTopL5?: boolean;
  /** Hit the floor (sank to the bottom) at level 5+. */
  diedBottomL5?: boolean;

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
  /** Score two runs ago — for three-in-a-row patterns. */
  prevPrevRunScore?: number;
  /** Scored exactly 1, then 2, then 3 in three consecutive runs. */
  staircaseDone?: boolean;
  /** The same score (5+) three runs in a row. */
  tripleScoreDone?: boolean;
  exact21Done?: boolean;
  exact99Done?: boolean;
  exact111Done?: boolean;
  exact123Done?: boolean;
  exact314Done?: boolean;
  /** Scored exactly 50 with exactly 50 flaps. */
  fiftyFiftyDone?: boolean;
  /** Exactly 100 flaps in one run (score 1+). */
  flaps100Done?: boolean;
  /** Played on Feb 29 (local time). */
  leapDayDone?: boolean;
  /** One run lasting 5+ minutes. */
  longHaulDone?: boolean;
  /** Rolling count of consecutive sub-3-second runs (+ its latch). */
  consecutiveQuickDeaths?: number;
  quickFiveDone?: boolean;
  /** New best score in the run right after scoring under 5. */
  comebackDone?: boolean;
  /** Score 30+ with at most 40 flaps. */
  deepBreathDone?: boolean;
  /** Calendar-day run counter (local) + the 25-in-a-day latch. */
  runsToday?: number;
  lastRunDay?: string;
  marathonDone?: boolean;
  /** Played each mode at least once. */
  playedCasual?: boolean;
  playedDaily?: boolean;
  playedChallenge?: boolean;
  playedRanked?: boolean;
  /** Weekend play counters (local day-of-week, like nightGames). */
  satGames?: number;
  sunGames?: number;
  /** Seasonal window participation latches (local dates). */
  newYearDone?: boolean;
  prideDone?: boolean;
  redRibbonDone?: boolean;
  exact88Done?: boolean;
  exact144Done?: boolean;
  exact256Done?: boolean;
  exact360Done?: boolean;
  /** Finished a run with exactly one flap. */
  oneFlapDone?: boolean;
  /** A run that started before local midnight and ended after it. */
  timeTravelerDone?: boolean;
  /** Came back after 7+ days away. */
  returnedDone?: boolean;
  /** Rolling count of consecutive new-best runs (+ its latch at 3). */
  consecutivePbs?: number;
  hotStreakDone?: boolean;
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
    blurb: "play your 3rd game",
    category: "score",
    reward: { type: "color", body: [255, 209, 102], accent: [90, 60, 10] },
    check: (s) => s.totalGames >= 3,
  },
  {
    id: "hooked",
    name: "hooked",
    blurb: "play 6 games — you've got the hang of it!",
    category: "score",
    reward: { type: "color", body: [6, 214, 160], accent: [10, 60, 50] },
    check: (s) => s.totalGames >= 6,
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

  // --- Promoted from the criteria scratchpad: goals with real rewards ---
  {
    id: "frequent_flyer",
    name: "frequent flyer",
    blurb: "log 300 flights — the runway knows your name",
    category: "milestone",
    reward: { type: "color", body: [70, 130, 200], accent: [200, 225, 255] },
    check: (s) => s.totalGames >= 300,
  },
  {
    id: "century_club",
    name: "century club",
    blurb: "post a 150 — triple digits is for tourists",
    category: "score",
    reward: { type: "color", body: [230, 230, 235], accent: [120, 120, 135] },
    check: (s) => s.bestScore >= 150,
  },
  {
    id: "stratospheric",
    name: "stratospheric",
    blurb: "clear 300 in one run and leave the weather behind",
    category: "score",
    reward: { type: "color", body: [40, 45, 120], accent: [160, 200, 255] },
    check: (s) => s.bestScore >= 300,
  },
  {
    id: "fortnight_flame",
    name: "fortnight flame",
    blurb: "keep the streak alive 21 days straight",
    category: "streak",
    reward: { type: "color", body: [220, 90, 30], accent: [255, 200, 80] },
    check: (s) => s.streakDays >= 21,
  },
  {
    id: "weathered",
    name: "weathered",
    blurb: "score 50+ on a hard daily — let the storm come",
    category: "daily",
    reward: { type: "color", body: [85, 95, 115], accent: [180, 200, 220] },
    check: (s) => s.hardDailyBest >= 50,
  },
  {
    id: "tempered_steel",
    name: "tempered steel",
    blurb: "score 40+ on a super-hard daily without flinching",
    category: "daily",
    reward: { type: "color", body: [120, 130, 145], accent: [220, 225, 235] },
    check: (s) => s.superHardDailyBest >= 40,
  },
  {
    id: "dawn_patrol",
    name: "dawn patrol",
    blurb: "30 sunrise games (05:00\u201307:00) \u2014 first into the air",
    category: "special",
    reward: { type: "color", body: [235, 170, 80], accent: [255, 235, 180] },
    check: (s) => s.morningGames >= 30,
  },
  {
    id: "duelist",
    name: "duelist",
    blurb: "win 25 challenges — ghosts tremble at your seed",
    category: "social",
    reward: { type: "color", body: [150, 30, 40], accent: [230, 190, 90] },
    check: (s) => s.challengeWins >= 25,
  },
  {
    id: "round_the_clock",
    name: "round the clock",
    blurb: "fly at dawn and after dark: 15 morning + 15 night games",
    category: "special",
    reward: { type: "color", body: [30, 40, 80], accent: [250, 210, 110] },
    check: (s) => s.morningGames >= 15 && s.nightGames >= 15,
  },

  // --- New criterion types ---
  {
    id: "comeback_kid",
    name: "comeback kid",
    blurb: "set a new best in the run right after scoring under 5",
    category: "special",
    reward: { type: "color", body: [240, 100, 40], accent: [255, 220, 120] },
    check: (s) => s.comebackDone === true,
  },
  {
    id: "marathoner",
    name: "marathoner",
    blurb: "25 runs in a single day — pace yourself, or don't",
    category: "special",
    reward: { type: "color", body: [60, 60, 65], accent: [200, 255, 60] },
    check: (s) => s.marathonDone === true,
  },
  {
    id: "all_rounder",
    name: "all-rounder",
    blurb: "play casual, the daily, a challenge and ranked",
    category: "special",
    reward: { type: "color", body: [90, 200, 180], accent: [240, 140, 200] },
    check: (s) =>
      s.playedCasual === true &&
      s.playedDaily === true &&
      s.playedChallenge === true &&
      s.playedRanked === true,
  },
  {
    id: "deep_breath",
    name: "deep breath",
    blurb: "score 30+ using at most 40 flaps",
    category: "efficiency",
    reward: { type: "color", body: [70, 160, 170], accent: [220, 245, 245] },
    check: (s) => s.deepBreathDone === true,
  },
  {
    id: "weekend_ritual",
    name: "weekend ritual",
    blurb: "make it a habit: 3 Saturday games and 3 Sunday games",
    category: "special",
    reward: { type: "color", body: [200, 60, 70], accent: [250, 245, 230] },
    check: (s) => (s.satGames ?? 0) >= 3 && (s.sunGames ?? 0) >= 3,
  },

  // --- More secrets (discover them in play!) ---
  {
    id: "blackjack",
    name: "blackjack",
    blurb: "score exactly 21 — hit me. no, wait",
    category: "special",
    reward: { type: "color", body: [20, 90, 50], accent: [230, 220, 200] },
    secret: true,
    check: (s) => s.exact21Done === true,
  },
  {
    id: "so_close",
    name: "so close",
    blurb: "score exactly 99 — the worst number in the game",
    category: "special",
    reward: { type: "color", body: [180, 40, 50], accent: [255, 230, 230] },
    secret: true,
    check: (s) => s.exact99Done === true,
  },
  {
    id: "eleventy_one",
    name: "eleventy-one",
    blurb: "score exactly 111 — a most respectable age",
    category: "special",
    reward: { type: "color", body: [120, 80, 160], accent: [255, 215, 130] },
    secret: true,
    check: (s) => s.exact111Done === true,
  },
  {
    id: "easy_as",
    name: "easy as",
    blurb: "score exactly 123",
    category: "special",
    reward: { type: "color", body: [250, 200, 60], accent: [80, 70, 60] },
    secret: true,
    check: (s) => s.exact123Done === true,
  },
  {
    id: "bigger_slice",
    name: "a bigger slice",
    blurb: "score exactly 314 in one run — irrational behaviour",
    category: "special",
    reward: { type: "color", body: [220, 140, 90], accent: [150, 60, 40] },
    secret: true,
    check: (s) => s.exact314Done === true,
  },
  {
    id: "points_777",
    name: "jackpot",
    blurb: "cross 777 lifetime points — triple sevens",
    category: "milestone",
    reward: { type: "color", body: [200, 160, 40], accent: [255, 240, 160] },
    secret: true,
    check: (s) => s.totalScore >= 777,
  },
  {
    id: "points_2048",
    name: "merged",
    blurb: "cross 2,048 lifetime points — swipe up to continue",
    category: "milestone",
    reward: { type: "color", body: [237, 194, 46], accent: [119, 110, 101] },
    secret: true,
    check: (s) => s.totalScore >= 2048,
  },
  {
    id: "points_9001",
    name: "over nine thousand",
    blurb: "cross 9,001 lifetime points — WHAT?!",
    category: "milestone",
    reward: { type: "color", body: [255, 220, 60], accent: [80, 160, 255] },
    secret: true,
    check: (s) => s.totalScore >= 9001,
  },
  {
    id: "staircase",
    name: "stairway",
    blurb: "score 1, then 2, then 3 — one step at a time",
    category: "special",
    reward: { type: "color", body: [100, 110, 130], accent: [210, 220, 240] },
    secret: true,
    check: (s) => s.staircaseDone === true,
  },
  {
    id: "groundhog_day",
    name: "groundhog day",
    blurb: "the exact same score (5+) three runs in a row",
    category: "special",
    reward: { type: "color", body: [130, 100, 70], accent: [220, 200, 170] },
    secret: true,
    check: (s) => s.tripleScoreDone === true,
  },
  {
    id: "fifty_fifty",
    name: "fifty-fifty",
    blurb: "score exactly 50 with exactly 50 flaps",
    category: "efficiency",
    reward: { type: "color", body: [40, 40, 45], accent: [245, 245, 240] },
    secret: true,
    check: (s) => s.fiftyFiftyDone === true,
  },
  {
    id: "century_of_flaps",
    name: "century of flaps",
    blurb: "exactly 100 flaps in a single run",
    category: "efficiency",
    reward: { type: "color", body: [180, 200, 90], accent: [90, 110, 40] },
    secret: true,
    check: (s) => s.flaps100Done === true,
  },
  {
    id: "leap_of_faith",
    name: "leap of faith",
    blurb: "fly on February 29th — see you in four years",
    category: "special",
    reward: { type: "color", body: [80, 180, 120], accent: [200, 255, 220] },
    secret: true,
    check: (s) => s.leapDayDone === true,
  },
  {
    id: "long_haul",
    name: "long haul",
    blurb: "keep a single run alive for five whole minutes",
    category: "special",
    reward: { type: "color", body: [70, 80, 100], accent: [255, 160, 90] },
    secret: true,
    check: (s) => s.longHaulDone === true,
  },
  {
    id: "rapid_unscheduled",
    name: "rapid unscheduled disassembly",
    blurb: "five runs in a row, each over in under three seconds",
    category: "special",
    reward: { type: "color", body: [230, 80, 40], accent: [255, 250, 245] },
    secret: true,
    check: (s) => s.quickFiveDone === true,
  },

  // --- Promoted from the scratchpad, round 2: no more TBA rewards ---
  {
    id: "thousand_takeoffs",
    name: "thousand takeoffs",
    blurb: "300 was a warm-up — clear 750 games",
    category: "milestone",
    reward: { type: "color", body: [150, 110, 60], accent: [235, 200, 130] },
    check: (s) => s.totalGames >= 750,
  },
  {
    id: "perpetual_motion",
    name: "perpetual motion",
    blurb: "2,000 games in. do you ever land?",
    category: "milestone",
    reward: { type: "color", body: [60, 70, 90], accent: [170, 220, 255] },
    secret: true,
    check: (s) => s.totalGames >= 2000,
  },
  {
    id: "ace_of_aces",
    name: "ace of aces",
    blurb: "a 750 run. nobody will believe you.",
    category: "score",
    reward: { type: "color", body: [20, 20, 24], accent: [255, 200, 60] },
    secret: true,
    check: (s) => s.bestScore >= 750,
  },
  {
    id: "seasoned_pilot",
    name: "seasoned pilot",
    blurb: "a 60-day streak — a full season of flight",
    category: "streak",
    reward: { type: "color", body: [40, 90, 60], accent: [170, 230, 190] },
    check: (s) => s.streakDays >= 60,
  },
  {
    id: "calendar_conqueror",
    name: "calendar conqueror",
    blurb: "100 days without missing. the calendar fears you.",
    category: "streak",
    reward: { type: "color", body: [120, 40, 50], accent: [255, 215, 130] },
    secret: true,
    check: (s) => s.streakDays >= 100,
  },
  {
    id: "daily_devotee",
    name: "daily devotee",
    blurb: "score 20+ on the daily 10 times in a row",
    category: "daily",
    reward: { type: "color", body: [235, 150, 60], accent: [120, 60, 130] },
    check: (s) => s.dailyStreakDays >= 10 && s.bestScoreDaily >= 20,
  },
  {
    id: "eye_of_the_storm",
    name: "eye of the storm",
    blurb: "master both extremes: 60+ hard AND 60+ super-hard",
    category: "daily",
    reward: { type: "color", body: [50, 60, 80], accent: [255, 250, 160] },
    secret: true,
    check: (s) => s.hardDailyBest >= 60 && s.superHardDailyBest >= 60,
  },
  {
    id: "moonlit_marathon",
    name: "moonlit marathon",
    blurb: "play 30 games under the night sky (22:00\u201304:00)",
    category: "special",
    reward: { type: "color", body: [25, 30, 60], accent: [220, 225, 255] },
    check: (s) => s.nightGames >= 30,
  },
  {
    id: "witching_hour",
    name: "witching hour",
    blurb: "50 late-night runs. the dark hours suit you.",
    category: "special",
    reward: { type: "color", body: [55, 30, 80], accent: [180, 140, 220] },
    secret: true,
    check: (s) => s.lateNightGames >= 50,
  },
  {
    id: "flock_leader",
    name: "flock leader",
    blurb: "gather 50 friends into the flock",
    category: "social",
    reward: { type: "color", body: [90, 140, 200], accent: [245, 245, 240] },
    check: (s) => s.friendCount >= 50,
  },
  {
    id: "social_butterfly",
    name: "social butterfly",
    blurb: "10 friends AND 10 challenge wins — beloved and feared",
    category: "social",
    reward: { type: "color", body: [200, 120, 180], accent: [120, 200, 220] },
    secret: true,
    check: (s) => s.friendCount >= 10 && s.challengeWins >= 10,
  },
  {
    id: "zen_master",
    name: "zen master",
    blurb: "a minimalist run AND a 100+ score: calm and capable",
    category: "efficiency",
    reward: { type: "color", body: [220, 215, 200], accent: [90, 110, 90] },
    secret: true,
    check: (s) => s.minimalistDone === true && s.bestScore >= 100,
  },

  // --- Seasonal windows (participation latches, local time) ---
  {
    id: "new_year_flight",
    name: "new year flight",
    blurb: "take off as the year turns (Dec 26 \u2013 Jan 2)",
    category: "special",
    reward: { type: "color", body: [20, 24, 40], accent: [255, 215, 110] },
    check: (s) => s.newYearDone === true,
  },
  {
    id: "pride_wings",
    name: "pride wings",
    blurb: "fly with pride any day in June",
    category: "special",
    reward: { type: "color", body: [230, 70, 120], accent: [80, 200, 220] },
    check: (s) => s.prideDone === true,
  },
  {
    id: "red_ribbon",
    name: "red ribbon",
    blurb: "play on World AIDS Day (Dec 1) to wear the ribbon",
    category: "special",
    reward: { type: "color", body: [180, 25, 40], accent: [255, 235, 235] },
    check: (s) => s.redRibbonDone === true,
  },

  // --- Even more secrets ---
  {
    id: "great_scott",
    name: "great scott!",
    blurb: "score exactly 88 — where you're going, you don't need pillars",
    category: "special",
    reward: { type: "color", body: [200, 210, 220], accent: [255, 120, 40] },
    secret: true,
    check: (s) => s.exact88Done === true,
  },
  {
    id: "dozen_dozens",
    name: "a dozen dozens",
    blurb: "score exactly 144 — that's gross",
    category: "special",
    reward: { type: "color", body: [120, 90, 50], accent: [240, 220, 170] },
    secret: true,
    check: (s) => s.exact144Done === true,
  },
  {
    id: "byte_me",
    name: "byte me",
    blurb: "score exactly 256",
    category: "special",
    reward: { type: "color", body: [30, 60, 30], accent: [120, 255, 120] },
    secret: true,
    check: (s) => s.exact256Done === true,
  },
  {
    id: "full_circle",
    name: "full circle",
    blurb: "score exactly 360",
    category: "special",
    reward: { type: "color", body: [70, 70, 75], accent: [255, 255, 255] },
    secret: true,
    check: (s) => s.exact360Done === true,
  },
  {
    id: "mirror_mountain",
    name: "mirror mountain",
    blurb: "cross 12,321 lifetime points — reads the same both ways",
    category: "milestone",
    reward: { type: "color", body: [160, 170, 200], accent: [200, 170, 160] },
    secret: true,
    check: (s) => s.totalScore >= 12321,
  },
  {
    id: "flap_of_faith",
    name: "flap of faith",
    blurb: "finish a run with exactly one flap",
    category: "efficiency",
    reward: { type: "color", body: [240, 235, 220], accent: [150, 140, 120] },
    secret: true,
    check: (s) => s.oneFlapDone === true,
  },
  {
    id: "time_traveler",
    name: "time traveler",
    blurb: "start a run on one day and finish it on the next",
    category: "special",
    reward: { type: "color", body: [40, 30, 60], accent: [110, 230, 200] },
    secret: true,
    check: (s) => s.timeTravelerDone === true,
  },

  {
    id: "phoenix",
    name: "phoenix",
    blurb: "come back after a week away — the sky missed you",
    category: "special",
    reward: { type: "color", body: [235, 90, 40], accent: [255, 230, 150] },
    secret: true,
    check: (s) => s.returnedDone === true,
  },
  {
    id: "hot_streak",
    name: "hot streak",
    blurb: "three new personal bests in a row",
    category: "score",
    reward: { type: "color", body: [255, 80, 60], accent: [255, 210, 80] },
    secret: true,
    check: (s) => s.hotStreakDone === true,
  },
  {
    id: "collector",
    name: "collector",
    blurb: "earn 25 other goals — the shelf is filling up",
    category: "milestone",
    reward: { type: "color", body: [110, 80, 150], accent: [230, 215, 255] },
    check: (s) => ACHIEVEMENTS.filter((a) => a.id !== "collector" && a.check(s)).length >= 25,
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

  // --- Death-cause goals (unlock from level 5 onward) ---
  {
    id: "wall_hugger",
    name: "wall hugger",
    blurb: "from level 5: crash into a pillar",
    category: "special",
    reward: { type: "color", body: [120, 128, 134], accent: [40, 44, 48] },
    check: (s) => s.diedPillarL5 === true,
  },
  {
    id: "icarus",
    name: "icarus",
    blurb: "from level 5: fly off the top",
    category: "special",
    reward: { type: "color", body: [125, 196, 240], accent: [255, 244, 180] },
    check: (s) => s.diedTopL5 === true,
  },
  {
    id: "deep_diver",
    name: "deep diver",
    blurb: "from level 5: sink to the bottom",
    category: "special",
    reward: { type: "color", body: [30, 70, 120], accent: [120, 200, 210] },
    check: (s) => s.diedBottomL5 === true,
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
  run: {
    score: number;
    mode: string;
    tier?: string;
    inputCount?: number;
    ticks?: number;
    deathCause?: "ceiling" | "floor" | "pillar" | null;
    level?: number;
  },
): AchievementStats {
  const s = { ...stats };
  s.totalGames++;

  // Death-cause goals — only count once the pilot has some experience (level 5+).
  if ((run.level ?? 0) >= 5 && run.deathCause) {
    if (run.deathCause === "pillar") s.diedPillarL5 = true;
    else if (run.deathCause === "ceiling") s.diedTopL5 = true;
    else if (run.deathCause === "floor") s.diedBottomL5 = true;
  }
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
  if (run.score === 21) s.exact21Done = true;
  if (run.score === 99) s.exact99Done = true;
  if (run.score === 111) s.exact111Done = true;
  if (run.score === 123) s.exact123Done = true;
  if (run.score === 314) s.exact314Done = true;
  if (run.score === 88) s.exact88Done = true;
  if (run.score === 144) s.exact144Done = true;
  if (run.score === 256) s.exact256Done = true;
  if (run.score === 360) s.exact360Done = true;
  if (run.inputCount === 1) s.oneFlapDone = true;
  if (run.score === 50 && run.inputCount === 50) s.fiftyFiftyDone = true;
  if (run.score >= 1 && run.inputCount === 100) s.flaps100Done = true;
  if (run.score >= 30 && run.inputCount != null && run.inputCount <= 40) s.deepBreathDone = true;
  if (run.ticks != null && run.ticks >= 18000) s.longHaulDone = true;
  s.consecutiveQuickDeaths =
    run.ticks != null && run.ticks < 180 ? (s.consecutiveQuickDeaths ?? 0) + 1 : 0;
  if ((s.consecutiveQuickDeaths ?? 0) >= 5) s.quickFiveDone = true;

  // Calendar trackers (local time, same convention as the night counter).
  const runDate = new Date();
  if (runDate.getMonth() === 1 && runDate.getDate() === 29) s.leapDayDone = true;
  const mon = runDate.getMonth() + 1;
  const day = runDate.getDate();
  if ((mon === 12 && day >= 26) || (mon === 1 && day <= 2)) s.newYearDone = true;
  if (mon === 6) s.prideDone = true;
  if (mon === 12 && day === 1) s.redRibbonDone = true;
  // A run longer than the time since local midnight must have crossed it.
  const secsSinceMidnight =
    runDate.getHours() * 3600 + runDate.getMinutes() * 60 + runDate.getSeconds();
  if (run.ticks != null && run.ticks / 60 > secsSinceMidnight) s.timeTravelerDone = true;
  const dayKey = `${runDate.getFullYear()}-${runDate.getMonth() + 1}-${runDate.getDate()}`;
  // Welcome back: 7+ full days since the last recorded run-day.
  if (stats.lastRunDay && stats.lastRunDay !== dayKey) {
    const [py, pm, pd] = stats.lastRunDay.split("-").map(Number);
    const gapDays = (new Date(runDate.getFullYear(), runDate.getMonth(), runDate.getDate()).getTime() -
      new Date(py, pm - 1, pd).getTime()) / 86400000;
    if (gapDays >= 7) s.returnedDone = true;
  }
  s.runsToday = s.lastRunDay === dayKey ? (s.runsToday ?? 0) + 1 : 1;
  s.lastRunDay = dayKey;
  // Hot streak: three new personal bests back to back. stats.bestScore is
  // the PRE-run best, so a strict beat counts; anything else resets.
  s.consecutivePbs = run.score > stats.bestScore ? (s.consecutivePbs ?? 0) + 1 : 0;
  if ((s.consecutivePbs ?? 0) >= 3) s.hotStreakDone = true;
  if ((s.runsToday ?? 0) >= 25) s.marathonDone = true;
  const dow = runDate.getDay();
  if (dow === 6) s.satGames = (s.satGames ?? 0) + 1;
  if (dow === 0) s.sunGames = (s.sunGames ?? 0) + 1;

  // Mode latches for all_rounder ("challenge-create"/"race" don't count).
  if (run.mode === "casual") s.playedCasual = true;
  if (run.mode === "daily") s.playedDaily = true;
  if (run.mode === "challenge") s.playedChallenge = true;
  if (run.mode === "ranked") s.playedRanked = true;

  // Consecutive exact-score secrets compare against the *immediately previous*
  // completed run. A run in between with any other score breaks the chain.
  if (stats.prevRunScore === 6 && run.score === 7) s.sixSevenDone = true;
  if (stats.prevRunScore != null && stats.prevRunScore === run.score && run.score >= 5) {
    s.dejaVuDone = true;
  }
  // Three-run patterns read both previous scores BEFORE they shift.
  if (stats.prevPrevRunScore === 1 && stats.prevRunScore === 2 && run.score === 3) {
    s.staircaseDone = true;
  }
  if (
    stats.prevPrevRunScore != null &&
    stats.prevPrevRunScore === stats.prevRunScore &&
    stats.prevRunScore === run.score &&
    run.score >= 5
  ) {
    s.tripleScoreDone = true;
  }
  // Comeback: a brand-new best in the run right after scoring under 5.
  // stats.bestScore is the PRE-run best (s.bestScore was already bumped).
  if (stats.prevRunScore != null && stats.prevRunScore < 5 && run.score > stats.bestScore) {
    s.comebackDone = true;
  }
  s.prevPrevRunScore = stats.prevRunScore;
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

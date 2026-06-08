import type { AchievementStats } from "./achievements";

/**
 * Placeholder unlock-criteria catalog.
 *
 * This is a DESIGN SCRATCHPAD, not a live reward system. Each entry pairs an
 * interesting unlock criterion — computed purely from the EXISTING
 * {@link AchievementStats} counters — with a *planned* reward that hasn't been
 * authored yet ("reward TBD"). It lets us draft fun, characterful criteria
 * now and bolt real skins / shapes / sounds onto them later.
 *
 * Intentionally self-contained and additive: nothing here is wired into the
 * `ACHIEVEMENTS` array, the unlock economy, or the gallery. A later branch will
 * surface these once the rewards exist. Because no new tracking is introduced,
 * every `check` only reads counters the game already maintains; ideas that
 * would have needed uncomputable data were approximated or dropped.
 */

export type PlannedRewardKind =
  | "skin"
  | "shape"
  | "background"
  | "pillar"
  | "sound"
  | "fx"
  | "badge";

export interface CriterionDef {
  id: string;
  name: string;
  /** Shown while locked, unless `secret`. */
  hint: string;
  secret?: boolean;
  /** Placeholder reward — `kind` is the slot, `label` reads as a TBA stub. */
  plannedReward: { kind: PlannedRewardKind; label: string };
  /**
   * Optional seasonal window. When present, the unlock is gated by the date
   * (participation = playing during the window) rather than the counter check,
   * which for events is simply `() => true`. MM-DD strings, inclusive, and the
   * range may wrap across the new year (e.g. `from: "12-26", until: "01-02"`).
   */
  event?: { from: string; until: string };
  check(stats: AchievementStats): boolean;
}

export const UNLOCK_CRITERIA: CriterionDef[] = [
  // --- Variety / exploration: volume framed with character ---
  {
    id: "frequent_flyer",
    name: "frequent flyer",
    hint: "log 300 flights — the runway knows your name",
    plannedReward: { kind: "badge", label: "TBA · frequent-flyer badge" },
    check: (s) => s.totalGames >= 300,
  },
  {
    id: "thousand_takeoffs",
    name: "thousand takeoffs",
    hint: "300 was a warm-up — clear 750 games",
    plannedReward: { kind: "skin", label: "TBA · burnished-brass skin" },
    check: (s) => s.totalGames >= 750,
  },
  {
    id: "perpetual_motion",
    name: "perpetual motion",
    hint: "2,000 games in. do you ever land?",
    secret: true,
    plannedReward: { kind: "fx", label: "TBA · motion-blur trail fx" },
    check: (s) => s.totalGames >= 2000,
  },

  // --- Milestone curves: score ladders with fresh framing ---
  {
    id: "century_club",
    name: "century club",
    hint: "post a 150 — triple digits is for tourists",
    plannedReward: { kind: "pillar", label: "TBA · marble pillar" },
    check: (s) => s.bestScore >= 150,
  },
  {
    id: "stratospheric",
    name: "stratospheric",
    hint: "clear 300 in one run and leave the weather behind",
    plannedReward: { kind: "background", label: "TBA · high-altitude background" },
    check: (s) => s.bestScore >= 300,
  },
  {
    id: "ace_of_aces",
    name: "ace of aces",
    hint: "a 750 run. nobody will believe you.",
    secret: true,
    plannedReward: { kind: "shape", label: "TBA · meteor shape" },
    check: (s) => s.bestScore >= 750,
  },

  // --- Streak texture: consistency over distance ---
  {
    id: "fortnight_flame",
    name: "fortnight flame",
    hint: "keep the streak alive 21 days straight",
    plannedReward: { kind: "fx", label: "TBA · ember-streak fx" },
    check: (s) => s.streakDays >= 21,
  },
  {
    id: "seasoned_pilot",
    name: "seasoned pilot",
    hint: "a 60-day streak — a full season of flight",
    plannedReward: { kind: "skin", label: "TBA · evergreen skin" },
    check: (s) => s.streakDays >= 60,
  },
  {
    id: "calendar_conqueror",
    name: "calendar conqueror",
    hint: "100 days without missing. the calendar fears you.",
    secret: true,
    plannedReward: { kind: "badge", label: "TBA · centurion-streak badge" },
    check: (s) => s.streakDays >= 100,
  },
  {
    id: "daily_devotee",
    name: "daily devotee",
    hint: "score 20+ on the daily 10 times in a row",
    plannedReward: { kind: "pillar", label: "TBA · sunrise pillar" },
    check: (s) => s.dailyStreakDays >= 10 && s.bestScoreDaily >= 20,
  },

  // --- Daily-tier mastery: hard / super-hard modifiers ---
  {
    id: "weathered",
    name: "weathered",
    hint: "score 50+ on a hard daily — let the storm come",
    plannedReward: { kind: "background", label: "TBA · thunderhead background" },
    check: (s) => s.hardDailyBest >= 50,
  },
  {
    id: "tempered_steel",
    name: "tempered steel",
    hint: "score 40+ on a super-hard daily without flinching",
    plannedReward: { kind: "skin", label: "TBA · tempered-steel skin" },
    check: (s) => s.superHardDailyBest >= 40,
  },
  {
    id: "eye_of_the_storm",
    name: "eye of the storm",
    hint: "master both extremes: 60+ hard AND 60+ super-hard",
    secret: true,
    plannedReward: { kind: "fx", label: "TBA · lightning-halo fx" },
    check: (s) => s.hardDailyBest >= 60 && s.superHardDailyBest >= 60,
  },

  // --- Time-of-day: night / morning rituals ---
  {
    id: "moonlit_marathon",
    name: "moonlit marathon",
    hint: "play 30 games under the night sky (22:00–04:00)",
    plannedReward: { kind: "background", label: "TBA · moonlit-night background" },
    check: (s) => s.nightGames >= 30,
  },
  {
    id: "witching_hour",
    name: "witching hour",
    hint: "50 late-night runs. the dark hours suit you.",
    secret: true,
    plannedReward: { kind: "skin", label: "TBA · midnight-violet skin" },
    check: (s) => s.lateNightGames >= 50,
  },
  {
    id: "dawn_patrol",
    name: "dawn patrol",
    hint: "30 sunrise games (05:00–07:00) — first into the air",
    plannedReward: { kind: "skin", label: "TBA · dawn-gold skin" },
    check: (s) => s.morningGames >= 30,
  },
  {
    id: "round_the_clock",
    name: "round the clock",
    hint: "fly at dawn and after dark: 15 morning + 15 night games",
    plannedReward: { kind: "badge", label: "TBA · all-hours badge" },
    check: (s) => s.morningGames >= 15 && s.nightGames >= 15,
  },

  // --- Social: challenges & friends ---
  {
    id: "duelist",
    name: "duelist",
    hint: "win 25 challenges — ghosts tremble at your seed",
    plannedReward: { kind: "fx", label: "TBA · victory-confetti fx" },
    check: (s) => s.challengeWins >= 25,
  },
  {
    id: "flock_leader",
    name: "flock leader",
    hint: "gather 50 friends into the flock",
    plannedReward: { kind: "shape", label: "TBA · formation-V shape" },
    check: (s) => s.friendCount >= 50,
  },
  {
    id: "social_butterfly",
    name: "social butterfly",
    hint: "10 friends AND 10 challenge wins — beloved and feared",
    secret: true,
    plannedReward: { kind: "badge", label: "TBA · social-butterfly badge" },
    check: (s) => s.friendCount >= 10 && s.challengeWins >= 10,
  },

  // --- Efficiency: the minimalist line ---
  {
    id: "featherweight",
    name: "featherweight",
    hint: "earn the minimalist run — grace over brute force",
    plannedReward: { kind: "sound", label: "TBA · feather-soft chime" },
    check: (s) => s.minimalistDone === true,
  },
  {
    id: "zen_master",
    name: "zen master",
    hint: "a minimalist run AND a 100+ score: calm and capable",
    secret: true,
    plannedReward: { kind: "shape", label: "TBA · origami-crane shape" },
    check: (s) => s.minimalistDone === true && s.bestScore >= 100,
  },

  // --- Seasonal / event entries (date-window gated, check === true) ---
  {
    id: "new_year_flight",
    name: "new year flight",
    hint: "take off as the year turns",
    event: { from: "12-26", until: "01-02" },
    plannedReward: { kind: "skin", label: "TBA · fireworks skin" },
    check: () => true,
  },
  {
    id: "pride_wings",
    name: "pride wings",
    hint: "fly with pride all June long",
    event: { from: "06-01", until: "06-30" },
    plannedReward: { kind: "skin", label: "TBA · rainbow-pride skin" },
    check: () => true,
  },
  {
    id: "red_ribbon",
    name: "red ribbon",
    hint: "play on World AIDS Day to wear the ribbon",
    event: { from: "12-01", until: "12-01" },
    plannedReward: { kind: "badge", label: "TBA · red-ribbon badge" },
    check: () => true,
  },
];

/** Pad a number to a 2-digit string. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format a Date as an MM-DD string (local time). */
function toMonthDay(d: Date): string {
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Whether an event criterion's date window contains `now` (default: today).
 *
 * Comparison is purely on the MM-DD calendar position, so it repeats every
 * year. Windows are inclusive on both ends and may wrap across the new year:
 * when `from > until` (e.g. `12-26`..`01-02`) the active range is
 * `>= from` OR `<= until`. Non-event criteria are never date-active.
 */
export function isEventActive(def: CriterionDef, now: Date = new Date()): boolean {
  if (!def.event) return false;
  const today = toMonthDay(now);
  const { from, until } = def.event;
  if (from <= until) {
    return today >= from && today <= until;
  }
  // Wrap-around window (e.g. December into January).
  return today >= from || today <= until;
}

/**
 * Evaluate the whole catalog against the given stats (default: all-zero, the
 * shape of a fresh player). Each result mirrors its source `CriterionDef`.
 * Event criteria report their counter `check` here (always `true`); their date
 * gating is a separate {@link isEventActive} concern.
 */
export function evaluateCriteria(
  stats: AchievementStats = ZERO_STATS,
): Array<{ def: CriterionDef; unlocked: boolean }> {
  return UNLOCK_CRITERIA.map((def) => ({ def, unlocked: def.check(stats) }));
}

const ZERO_STATS: AchievementStats = {
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

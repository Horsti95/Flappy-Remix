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
  /**
   * True for drafts whose criterion needs stat plumbing that doesn't exist
   * yet — their `check` is a stub returning false until the counter lands.
   * (Owner decision 2026-06-10: criteria may be drafted before either the
   * reward or the tracking exists.)
   */
  pending?: boolean;
  check(stats: AchievementStats): boolean;
}

export const UNLOCK_CRITERIA: CriterionDef[] = [
  // --- Variety / exploration: volume framed with character ---
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
    id: "ace_of_aces",
    name: "ace of aces",
    hint: "a 750 run. nobody will believe you.",
    secret: true,
    plannedReward: { kind: "shape", label: "TBA · meteor shape" },
    check: (s) => s.bestScore >= 750,
  },

  // --- Streak texture: consistency over distance ---
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

  // --- Social: challenges & friends ---
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

  // --- Drafts that need NEW stat plumbing (2026-06-10 studio review) ---
  // Exception to this file's "existing counters only" rule, by owner
  // decision: criteria may be drafted before either the reward OR the
  // tracking exists. Each `check` below returns false until the noted
  // counter lands in AchievementStats; the comment says what's missing.
  {
    // Needs: per-match Elo delta vs. opponent rating (ranked settle path).
    id: "giant_slayer",
    name: "giant slayer",
    hint: "win a ranked match against someone rated 100+ above you",
    plannedReward: { kind: "fx", label: "TBA · giant-slayer gate effect" },
    pending: true,
    check: () => false,
  },
  {
    // Needs: same plumbing as giant_slayer, losing side. Secret — being
    // upset isn't something we tease on a goals list.
    id: "upset_victim",
    name: "everyone has bad days",
    hint: "lose a ranked match to someone rated 100+ below you",
    secret: true,
    plannedReward: { kind: "skin", label: "TBA · consolation colors" },
    pending: true,
    check: () => false,
  },
  {
    // Needs: per-gate pass offset from gap center recorded in run results
    // (sim exposes gap centers; collision code knows bird y at crossing).
    id: "threading_needles",
    name: "threading needles",
    hint: "pass 10 gates dead-center in a single run",
    plannedReward: { kind: "fx", label: "TBA · ink-stroke trail" },
    pending: true,
    check: () => false,
  },
  {
    // Needs: per-tier daily-clear latches (hard / extreme cleared with a
    // score worth bragging about). The extreme tier (~3.4% of days) has no
    // achievement coverage at all today.
    id: "storm_chaser",
    name: "storm chaser",
    hint: "score 25+ on an EXTREME daily",
    plannedReward: { kind: "badge", label: "TBA · storm-chaser badge" },
    pending: true,
    check: () => false,
  },
  {
    // Needs: rolling 7-day window of distinct daily_date plays (the streak
    // counter resets on a miss, so it can't express "all 7 this week").
    id: "perfect_week",
    name: "perfect week",
    hint: "play every daily for a full week",
    plannedReward: { kind: "background", label: "TBA · seven-skies sunrise" },
    pending: true,
    check: () => false,
  },
  {
    // Needs: PB-ghost race results once the PB ghost (score-30 unlock)
    // ships — "beat the ghost while doubling its score".
    id: "ghost_doubler",
    name: "twice the plane you were",
    hint: "beat your personal-best ghost with double its score",
    plannedReward: { kind: "sound", label: "TBA · echo gate chime" },
    pending: true,
    check: () => false,
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

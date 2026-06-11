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

  // --- Milestone curves: score ladders with fresh framing ---

  // --- Streak texture: consistency over distance ---

  // --- Daily-tier mastery: hard / super-hard modifiers ---

  // --- Time-of-day: night / morning rituals ---

  // --- Social: challenges & friends ---

  // --- Efficiency: the minimalist line ---

  // --- Seasonal / event entries (date-window gated, check === true) ---

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

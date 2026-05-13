import { dailyDateString, yesterdayUtc } from "../../src/game/daily";

export interface StreakInput {
  prevStreak: number;
  lastPlayAt: string | null;        // ISO timestamp, any mode
  lastDailyPlayAt: string | null;   // YYYY-MM-DD date string
  mode: "casual" | "daily" | "challenge" | "ranked";
  now?: Date;
}

export interface StreakOutput {
  streakDays: number;
  lastDailyPlayAt: string | null;
}

/**
 * Streak rule per the brief: "Days played consecutively (any mode
 * counts, daily seed counts double)."
 *
 * Interpretation: each new calendar day with a run bumps the streak
 * by +1. The first daily run of a calendar day bumps it an additional
 * +1 (so a "daily day" is worth 2). Missing a day resets to that
 * day's earned amount.
 */
export function computeStreak(input: StreakInput): StreakOutput {
  const now = input.now ?? new Date();
  const today = dailyDateString(now);
  const prevDate = input.lastPlayAt ? input.lastPlayAt.slice(0, 10) : null;
  const dailyToday = input.lastDailyPlayAt === today;
  const isDaily = input.mode === "daily";

  // First time playing today?
  const firstOfDay = prevDate !== today;
  let streak = input.prevStreak;
  let lastDailyPlayAt = input.lastDailyPlayAt;

  if (firstOfDay) {
    const base = isDaily ? 2 : 1;
    if (prevDate && prevDate === yesterdayUtc(today)) {
      streak = streak + base;
    } else {
      streak = base;
    }
    if (isDaily) lastDailyPlayAt = today;
  } else if (isDaily && !dailyToday) {
    streak = streak + 1;
    lastDailyPlayAt = today;
  }

  return { streakDays: streak, lastDailyPlayAt };
}

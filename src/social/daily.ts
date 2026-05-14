import { dailyDateString, dailySeed } from "../game/daily";
import { pickDaily, type DailyPick } from "../game/daily-twist";

export interface DailyInfo {
  date: string;
  seed: number;
  plays_count: number;
  pick: DailyPick;
}

export async function fetchDaily(): Promise<DailyInfo> {
  const date = dailyDateString();
  const pick = pickDaily(date);
  try {
    const res = await fetch("/api/daily", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { date: string; seed: number; plays_count: number };
      // Reject server responses for a different UTC day than the client
      // believes — clock skew or stale cache.
      if (json.date === date) {
        return { date: json.date, seed: json.seed, plays_count: json.plays_count, pick };
      }
    }
  } catch {
    /* fall through to offline */
  }
  return { date, seed: dailySeed(date), plays_count: 0, pick };
}

export { dailySeed, dailyDateString };

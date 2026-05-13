import { dailyDateString, dailySeed } from "../game/daily";

export interface DailyInfo {
  date: string;
  seed: number;
  plays_count: number;
}

export async function fetchDaily(): Promise<DailyInfo> {
  try {
    const res = await fetch("/api/daily", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as DailyInfo;
      // Reject server responses for a different UTC day than the client
      // believes — clock skew or stale cache.
      if (json.date === dailyDateString()) return json;
    }
  } catch {
    /* fall through to offline */
  }
  const date = dailyDateString();
  return { date, seed: dailySeed(date), plays_count: 0 };
}

export { dailySeed, dailyDateString };

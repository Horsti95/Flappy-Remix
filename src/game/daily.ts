import { hashStringToSeed } from "./rng";

const SALT = "pflug-daily-v1";

export function dailyDateString(now: Date = new Date()): string {
  // YYYY-MM-DD in UTC.
  return now.toISOString().slice(0, 10);
}

export function dailySeed(dateUtc: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateUtc)) {
    throw new Error(`invalid date string: ${dateUtc}`);
  }
  return hashStringToSeed(`${SALT}:${dateUtc}`);
}

export function todayDailySeed(now: Date = new Date()): { date: string; seed: number } {
  const date = dailyDateString(now);
  return { date, seed: dailySeed(date) };
}

export function yesterdayUtc(dateUtc: string): string {
  const d = new Date(dateUtc + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

import { getSupabase } from "../lib/supabase";

// Three independent axes: who (scope) × when (period) × how (mode).
export type LeaderboardScope = "global" | "friends";
export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "total";
export type LeaderboardMode = "all" | "casual" | "ranked" | "daily";

export interface LeaderboardRow {
  run_id: string;
  user_id: string | null;
  username: string | null;
  score: number;
  created_at: string;
  daily_date: string | null;
  shape: string | null;
  body: [number, number, number] | null;
  accent: [number, number, number] | null;
  skin_rarity: string | null;
}

const LB_CACHE_PREFIX = "pflug.lb.cache.v1:";
const lbMemCache = new Map<string, LeaderboardRow[]>();
function lbKey(scope: LeaderboardScope, period: LeaderboardPeriod, mode: LeaderboardMode): string {
  return `${scope}:${period}:${mode}`;
}

/** Last-known leaderboard rows for this filter combo, from memory or
 *  localStorage — for instant render before fetchLeaderboard() revalidates. */
export function getCachedLeaderboard(
  scope: LeaderboardScope,
  period: LeaderboardPeriod,
  mode: LeaderboardMode = "all",
): LeaderboardRow[] | null {
  const k = lbKey(scope, period, mode);
  if (lbMemCache.has(k)) return lbMemCache.get(k)!;
  try {
    const raw = localStorage.getItem(LB_CACHE_PREFIX + k);
    if (!raw) return null;
    const rows = JSON.parse(raw) as LeaderboardRow[];
    lbMemCache.set(k, rows);
    return rows;
  } catch {
    return null;
  }
}

export async function fetchLeaderboard(
  scope: LeaderboardScope,
  period: LeaderboardPeriod,
  mode: LeaderboardMode = "all",
  limit = 100,
): Promise<LeaderboardRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let data: unknown[] | null = null;
  let error: unknown = null;
  if (scope === "friends") {
    const r = await sb.rpc("friends_leaderboard", { p_period: period, p_mode: mode });
    data = r.data as unknown[] | null;
    error = r.error;
  } else {
    const r = await sb.rpc("leaderboard_by", { p_period: period, p_mode: mode }).limit(limit);
    data = r.data as unknown[] | null;
    error = r.error;
  }
  if (error) {
    console.error("[leaderboard]", scope, period, mode, error);
    return [];
  }
  const rows = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      run_id: r.run_id as string,
      user_id: (r.user_id ?? null) as string | null,
      username: (r.username ?? null) as string | null,
      score: r.score as number,
      created_at: r.created_at as string,
      daily_date: (r.daily_date ?? null) as string | null,
      shape: (r.equipped_shape ?? null) as string | null,
      body:
        r.body_r === null || r.body_r === undefined
          ? null
          : ([r.body_r as number, r.body_g as number, r.body_b as number] as [number, number, number]),
      accent:
        r.accent_r === null || r.accent_r === undefined
          ? null
          : ([r.accent_r as number, r.accent_g as number, r.accent_b as number] as [number, number, number]),
      skin_rarity: (r.skin_rarity ?? null) as string | null,
    };
  });
  const ranked = rankRows(rows);
  const k = lbKey(scope, period, mode);
  lbMemCache.set(k, ranked);
  try { localStorage.setItem(LB_CACHE_PREFIX + k, JSON.stringify(ranked)); } catch { /* ignore */ }
  return ranked;
}

/**
 * Normalize leaderboard rows on the client so the board is always correct
 * regardless of the row order/dedup the RPC happens to return:
 *  - one row per user (their best/highest-score run),
 *  - sorted by score descending (earlier run wins ties).
 * Anonymous rows (no user_id) are kept individually, never collapsed.
 */
export function rankRows(rows: LeaderboardRow[]): LeaderboardRow[] {
  const bestByUser = new Map<string, LeaderboardRow>();
  const anon: LeaderboardRow[] = [];
  for (const r of rows) {
    if (!r.user_id) {
      anon.push(r);
      continue;
    }
    const cur = bestByUser.get(r.user_id);
    if (!cur || r.score > cur.score) bestByUser.set(r.user_id, r);
  }
  return [...bestByUser.values(), ...anon].sort(
    (a, b) => b.score - a.score || (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
}

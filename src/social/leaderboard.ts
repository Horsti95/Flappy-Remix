import { getSupabase } from "../lib/supabase";

export type LeaderboardScope = "all_time" | "weekly" | "daily" | "friends";

export interface LeaderboardRow {
  run_id: string;
  user_id: string | null;
  username: string | null;
  score: number;
  created_at: string;
  daily_date: string | null;
  body: [number, number, number] | null;
  accent: [number, number, number] | null;
  skin_rarity: string | null;
}

export async function fetchLeaderboard(scope: LeaderboardScope, limit = 100): Promise<LeaderboardRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let data: unknown[] | null = null;
  let error: unknown = null;
  if (scope === "friends") {
    const r = await sb.rpc("friends_leaderboard");
    data = r.data as unknown[] | null;
    error = r.error;
  } else {
    const view =
      scope === "weekly"
        ? "leaderboard_weekly"
        : scope === "daily"
          ? "leaderboard_daily"
          : "leaderboard_all_time";
    const r = await sb.from(view).select("*").limit(limit);
    data = r.data as unknown[] | null;
    error = r.error;
  }
  if (error) {
    console.error("[leaderboard]", scope, error);
    return [];
  }
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      run_id: r.run_id as string,
      user_id: (r.user_id ?? null) as string | null,
      username: (r.username ?? null) as string | null,
      score: r.score as number,
      created_at: r.created_at as string,
      daily_date: (r.daily_date ?? null) as string | null,
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
}

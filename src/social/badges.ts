import { getSupabase } from "../lib/supabase";
import { authState } from "./auth";

export interface SeasonBadge {
  season_id: number;
  rank: number;
  rating: number;
}

let cache: SeasonBadge[] | null = null;

export async function listMyBadges(): Promise<SeasonBadge[]> {
  if (cache) return cache;
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return [];
  const { data, error } = await sb
    .from("elo_season_snapshots")
    .select("season_id, rank, rating")
    .eq("user_id", s.user.id)
    .lte("rank", 100)
    .order("season_id", { ascending: false });
  if (error) {
    console.error("[badges]", error);
    return [];
  }
  cache = (data ?? []).map((r) => ({
    season_id: r.season_id as number,
    rank: r.rank as number,
    rating: r.rating as number,
  }));
  return cache;
}

export function invalidateBadgeCache(): void {
  cache = null;
}

import { getSupabase } from "../lib/supabase";
import { authState } from "./auth";

export interface SeasonBadge {
  season_id: number;
  rank: number;
  rating: number;
}

let cache: SeasonBadge[] | null = null;
const BADGE_CACHE_KEY = "pflug.badges.cache.v1";

/** Usernames that carry the developer badge — hardcoded, never fetched. */
const DEVELOPER_USERNAMES = new Set(["hossi95"]);

export function isDeveloper(username: string | null | undefined): boolean {
  return username != null && DEVELOPER_USERNAMES.has(username);
}

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
  try { localStorage.setItem(BADGE_CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  return cache;
}

/** Last-known season badges from memory or localStorage — for instant render
 *  before listMyBadges() revalidates. Returns null if nothing cached. */
export function getCachedBadges(): SeasonBadge[] | null {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(BADGE_CACHE_KEY);
    if (!raw) return null;
    cache = JSON.parse(raw) as SeasonBadge[];
    return cache;
  } catch {
    return null;
  }
}

export function invalidateBadgeCache(): void {
  cache = null;
  try { localStorage.removeItem(BADGE_CACHE_KEY); } catch { /* ignore */ }
}

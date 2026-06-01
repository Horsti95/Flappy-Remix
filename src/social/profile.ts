import { getSupabase } from "../lib/supabase";

/** Public, read-only aggregate view of a player — safe to show to anyone.
 *  Backed by the public_profile() RPC (migration 0011). No PII. */
export interface PublicProfile {
  user_id: string;
  username: string | null;
  created_at: string;
  total_games: number;
  streak_days: number;
  best_score: number;
  total_score: number;
  avg_score: number;
  ranked_rating: number | null;
  ranked_wins: number;
  ranked_losses: number;
  ranked_draws: number;
  best_rank: number | null;
  equipped: { body: [number, number, number]; accent: [number, number, number]; rarity: string | null } | null;
}

export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("public_profile", { p_username: username });
  if (error) {
    console.error("[profile]", error);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) return null;
  const hasSkin = row.equipped_body_r != null;
  return {
    user_id: row.user_id as string,
    username: (row.username as string | null) ?? null,
    created_at: row.created_at as string,
    total_games: (row.total_games as number) ?? 0,
    streak_days: (row.streak_days as number) ?? 0,
    best_score: (row.best_score as number) ?? 0,
    total_score: Number(row.total_score ?? 0),
    avg_score: Number(row.avg_score ?? 0),
    ranked_rating: (row.ranked_rating as number | null) ?? null,
    ranked_wins: (row.ranked_wins as number) ?? 0,
    ranked_losses: (row.ranked_losses as number) ?? 0,
    ranked_draws: (row.ranked_draws as number) ?? 0,
    best_rank: (row.best_rank as number | null) ?? null,
    equipped: hasSkin
      ? {
          body: [row.equipped_body_r as number, row.equipped_body_g as number, row.equipped_body_b as number],
          accent: [row.equipped_accent_r as number, row.equipped_accent_g as number, row.equipped_accent_b as number],
          rarity: (row.equipped_rarity as string | null) ?? null,
        }
      : null,
  };
}

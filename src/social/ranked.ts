import { getSupabase } from "../lib/supabase";
import { authState } from "./auth";

export interface QueueState {
  state: "queued" | "matched" | "in_match";
  match_id?: string;
  rating?: number;
  elapsed_sec?: number;
  window?: number;
}

export interface RankedMatch {
  id: string;
  season_id: number;
  you_are: "a" | "b";
  opponent: { user_id: string; username: string | null };
  seeds: number[];
  a_scores: number[];
  b_scores: number[];
  state: "pending" | "in_progress" | "completed" | "expired" | "cancelled";
  winner_id: string | null;
  a_rating_before: number | null;
  b_rating_before: number | null;
  a_rating_after: number | null;
  b_rating_after: number | null;
  expires_at: string;
  started_at: string;
  completed_at: string | null;
}

export async function joinRankedQueue(): Promise<QueueState | null> {
  const s = authState();
  if (!s.session) return null;
  const res = await fetch("/api/ranked-queue", {
    method: "POST",
    headers: { authorization: `Bearer ${s.session.access_token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as QueueState;
}

export async function leaveRankedQueue(): Promise<void> {
  const s = authState();
  if (!s.session) return;
  await fetch("/api/ranked-queue", {
    method: "DELETE",
    headers: { authorization: `Bearer ${s.session.access_token}` },
  });
}

export async function getMatch(id: string): Promise<RankedMatch | null> {
  const s = authState();
  if (!s.session) return null;
  const res = await fetch(`/api/ranked-match?id=${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${s.session.access_token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as RankedMatch;
}

export async function listActiveRankedMatches(): Promise<RankedMatch[]> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return [];
  const { data, error } = await sb
    .from("ranked_matches")
    .select(
      "id, season_id, player_a, player_b, seeds, a_scores, b_scores, state, winner_id, a_rating_before, b_rating_before, a_rating_after, b_rating_after, expires_at, started_at, completed_at, profiles_a:profiles!ranked_matches_player_a_fkey(username), profiles_b:profiles!ranked_matches_player_b_fkey(username)",
    )
    .or(`player_a.eq.${s.user.id},player_b.eq.${s.user.id}`)
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[ranked] list", error);
    return [];
  }
  return (data ?? []).map((m): RankedMatch => {
    const youAreA = (m.player_a as string) === s.user!.id;
    const oppName = youAreA
      ? ((m as { profiles_b?: { username?: string | null } | null }).profiles_b?.username ?? null)
      : ((m as { profiles_a?: { username?: string | null } | null }).profiles_a?.username ?? null);
    const oppId = youAreA ? (m.player_b as string) : (m.player_a as string);
    return {
      id: m.id as string,
      season_id: m.season_id as number,
      you_are: youAreA ? "a" : "b",
      opponent: { user_id: oppId, username: oppName },
      seeds: (m.seeds as number[]) ?? [],
      a_scores: (m.a_scores as number[]) ?? [],
      b_scores: (m.b_scores as number[]) ?? [],
      state: m.state as RankedMatch["state"],
      winner_id: (m.winner_id as string | null) ?? null,
      a_rating_before: (m.a_rating_before as number | null) ?? null,
      b_rating_before: (m.b_rating_before as number | null) ?? null,
      a_rating_after: (m.a_rating_after as number | null) ?? null,
      b_rating_after: (m.b_rating_after as number | null) ?? null,
      expires_at: m.expires_at as string,
      started_at: m.started_at as string,
      completed_at: (m.completed_at as string | null) ?? null,
    };
  });
}

export function myScores(m: RankedMatch): number[] {
  return m.you_are === "a" ? m.a_scores : m.b_scores;
}

export function oppScores(m: RankedMatch): number[] {
  return m.you_are === "a" ? m.b_scores : m.a_scores;
}

export function nextUnplayedRound(m: RankedMatch): number | null {
  const mine = myScores(m);
  for (let i = 0; i < 3; i++) {
    if (mine[i] == null) return i;
  }
  return null;
}

export function ratingDelta(m: RankedMatch): { you: number | null; them: number | null } {
  const a = m.a_rating_after != null && m.a_rating_before != null ? m.a_rating_after - m.a_rating_before : null;
  const b = m.b_rating_after != null && m.b_rating_before != null ? m.b_rating_after - m.b_rating_before : null;
  return m.you_are === "a" ? { you: a, them: b } : { you: b, them: a };
}

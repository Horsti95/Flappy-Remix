import { getAdminClient } from "./_lib/supabaseAdmin";
import { json } from "./_lib/http";
import { bearerJwt, resolveUserId } from "./_lib/auth";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const jwt = bearerJwt(req);
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  const url = new URL(req.url);
  const matchId = url.searchParams.get("id");
  if (!matchId) return json({ error: "missing id" }, 400);

  const admin = getAdminClient();
  const userId = await resolveUserId(admin, jwt);
  if (!userId) return json({ error: "invalid token" }, 401);

  const m = await admin
    .from("ranked_matches")
    .select(
      "id, season_id, player_a, player_b, seeds, a_scores, b_scores, a_rating_before, b_rating_before, a_rating_after, b_rating_after, state, winner_id, expires_at, started_at, completed_at",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (m.error || !m.data) return json({ error: "not_found" }, 404);

  if (m.data.player_a !== userId && m.data.player_b !== userId) {
    return json({ error: "not_participant" }, 403);
  }

  // Decorate with opponent profile.
  const opponentId = m.data.player_a === userId ? m.data.player_b : m.data.player_a;
  const opp = await admin
    .from("profiles")
    .select("username, equipped_skin_id")
    .eq("user_id", opponentId)
    .maybeSingle();

  return json(
    {
      id: m.data.id,
      season_id: m.data.season_id,
      you_are: m.data.player_a === userId ? "a" : "b",
      opponent: { user_id: opponentId, username: opp.data?.username ?? null },
      seeds: m.data.seeds,
      a_scores: m.data.a_scores ?? [],
      b_scores: m.data.b_scores ?? [],
      state: m.data.state,
      winner_id: m.data.winner_id,
      a_rating_before: m.data.a_rating_before,
      b_rating_before: m.data.b_rating_before,
      a_rating_after: m.data.a_rating_after,
      b_rating_after: m.data.b_rating_after,
      expires_at: m.data.expires_at,
      started_at: m.data.started_at,
      completed_at: m.data.completed_at,
    },
    200,
  );
}

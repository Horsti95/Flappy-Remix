import { getAdminClient } from "./_lib/supabaseAdmin";
import { ratingWindow } from "./_lib/elo";

export const config = { runtime: "edge" };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export default async function handler(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);
  const jwt = auth.slice("Bearer ".length);

  const admin = getAdminClient();
  const userRes = await admin.auth.getUser(jwt);
  if (userRes.error || !userRes.data.user) return json({ error: "invalid token" }, 401);
  const userId = userRes.data.user.id;

  if (req.method === "DELETE") {
    await admin.from("matchmaking_queue").delete().eq("user_id", userId);
    return json({ ok: true }, 200);
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const seasonRes = await admin.rpc("current_season");
  if (seasonRes.error || !seasonRes.data) return json({ error: "no_season" }, 500);
  const seasonId = seasonRes.data as number;

  // Are we already in a live match? Block joining.
  // Lazily close anything past its deadline first — an abandoned opponent
  // must never wedge a player out of matchmaking forever.
  await admin
    .from("ranked_matches")
    .update({ state: "expired" })
    .eq("state", "in_progress")
    .lt("expires_at", new Date().toISOString());

  const live = await admin
    .from("ranked_matches")
    .select("id")
    .or(`player_a.eq.${userId},player_b.eq.${userId}`)
    .eq("state", "in_progress")
    .limit(1);
  if (live.data && live.data.length > 0) {
    return json({ state: "in_match", match_id: live.data[0].id as string }, 200);
  }

  // Fetch our rating (lazy-create row at 1200).
  const eloRow = await admin
    .from("elo_ratings")
    .select("rating")
    .eq("user_id", userId)
    .eq("season_id", seasonId)
    .maybeSingle();
  let rating = (eloRow.data?.rating as number | undefined) ?? 1200;
  if (!eloRow.data) {
    await admin
      .from("elo_ratings")
      .insert({ user_id: userId, season_id: seasonId, rating })
      .select("rating")
      .maybeSingle();
  }

  // Are we already queued?
  const existing = await admin
    .from("matchmaking_queue")
    .select("joined_at, rating_at_join")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing.data) {
    const ins = await admin
      .from("matchmaking_queue")
      .insert({ user_id: userId, season_id: seasonId, rating_at_join: rating })
      .select("joined_at")
      .single();
    if (ins.error) return json({ error: ins.error.message }, 500);
  } else {
    rating = (existing.data.rating_at_join as number) ?? rating;
  }

  // Look for a compatible opponent.
  const joinedAt = existing.data?.joined_at as string | undefined;
  const elapsedSec = joinedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(joinedAt).getTime()) / 1000))
    : 0;
  const window = ratingWindow(elapsedSec);

  const candidates = await admin
    .from("matchmaking_queue")
    .select("user_id, rating_at_join, joined_at")
    .neq("user_id", userId)
    .eq("season_id", seasonId)
    .order("joined_at", { ascending: true })
    .limit(50);
  if (candidates.error) return json({ error: candidates.error.message }, 500);

  const me = rating;
  const match = (candidates.data ?? []).find((c) => {
    const r = (c.rating_at_join as number) ?? 1200;
    return Math.abs(r - me) <= window;
  });

  if (!match) {
    return json({ state: "queued", rating: me, elapsed_sec: elapsedSec, window }, 200);
  }

  // Pair found — atomic-ish: delete both queue rows, create match.
  const opponentId = match.user_id as string;
  const seeds = [randomSeed(), randomSeed(), randomSeed()];
  // Per-round 24h cap × 3 rounds. We use a single expires_at — the
  // match completion logic stops the clock at 2 wins.
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  // Pull both rows out of the queue.
  const purge = await admin
    .from("matchmaking_queue")
    .delete()
    .in("user_id", [userId, opponentId])
    .select("user_id");
  if (!purge.data || purge.data.length < 2) {
    // Someone else snagged the opponent first; we're still queued (or
    // re-added below).
    await admin
      .from("matchmaking_queue")
      .upsert({ user_id: userId, season_id: seasonId, rating_at_join: rating })
      .select("user_id");
    return json({ state: "queued", rating: me, elapsed_sec: elapsedSec, window }, 200);
  }

  const opponentElo = await admin
    .from("elo_ratings")
    .select("rating")
    .eq("user_id", opponentId)
    .eq("season_id", seasonId)
    .maybeSingle();
  const opponentRating = (opponentElo.data?.rating as number | undefined) ?? 1200;

  const ins = await admin
    .from("ranked_matches")
    .insert({
      season_id: seasonId,
      player_a: userId,
      player_b: opponentId,
      seeds,
      expires_at: expiresAt,
      a_rating_before: rating,
      b_rating_before: opponentRating,
      state: "in_progress",
    })
    .select("id")
    .single();
  if (ins.error) return json({ error: ins.error.message }, 500);
  return json({ state: "matched", match_id: ins.data.id as string }, 200);
}

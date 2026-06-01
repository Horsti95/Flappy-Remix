import { getAdminClient } from "./_lib/supabaseAdmin";

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

// Pull a player's current-season rating, lazily creating the row at 1200.
async function ratingFor(
  admin: ReturnType<typeof getAdminClient>,
  userId: string,
  seasonId: number,
): Promise<number> {
  const row = await admin
    .from("elo_ratings")
    .select("rating")
    .eq("user_id", userId)
    .eq("season_id", seasonId)
    .maybeSingle();
  const rating = (row.data?.rating as number | undefined) ?? 1200;
  if (!row.data) {
    await admin
      .from("elo_ratings")
      .insert({ user_id: userId, season_id: seasonId, rating })
      .select("rating")
      .maybeSingle();
  }
  return rating;
}

export default async function handler(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);
  const jwt = auth.slice("Bearer ".length);

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = getAdminClient();
  const userRes = await admin.auth.getUser(jwt);
  if (userRes.error || !userRes.data.user) return json({ error: "invalid token" }, 401);
  const userId = userRes.data.user.id;

  const body = (await req.json().catch(() => ({}))) as { friend_username?: string };
  const friendUsername = body.friend_username?.trim();
  if (!friendUsername) return json({ error: "missing friend_username" }, 400);

  // Resolve the friend's user_id.
  const friend = await admin
    .from("profiles")
    .select("user_id")
    .eq("username", friendUsername)
    .maybeSingle();
  if (friend.error) return json({ error: friend.error.message }, 500);
  if (!friend.data) return json({ error: "user_not_found" }, 404);
  const friendId = friend.data.user_id as string;
  if (friendId === userId) return json({ error: "self_target" }, 400);

  const seasonRes = await admin.rpc("current_season");
  if (seasonRes.error || !seasonRes.data) return json({ error: "no_season" }, 500);
  const seasonId = seasonRes.data as number;

  const rating = await ratingFor(admin, userId, seasonId);
  const friendRating = await ratingFor(admin, friendId, seasonId);

  const seeds = [randomSeed(), randomSeed(), randomSeed()];
  // Per-round 24h cap × 3 rounds. We use a single expires_at — the
  // match completion logic stops the clock at 2 wins.
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const ins = await admin
    .from("ranked_matches")
    .insert({
      season_id: seasonId,
      player_a: userId,
      player_b: friendId,
      seeds,
      expires_at: expiresAt,
      a_rating_before: rating,
      b_rating_before: friendRating,
      state: "in_progress",
    })
    .select("id")
    .single();
  if (ins.error) return json({ error: ins.error.message }, 500);
  return json({ ok: true, match_id: ins.data.id as string }, 200);
}

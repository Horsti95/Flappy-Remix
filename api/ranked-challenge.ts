import { getAdminClient } from "./_lib/supabaseAdmin";
import { json } from "./_lib/http";
import { bearerJwt, resolveUserId } from "./_lib/auth";

// Runtime: EDGE — and deliberately back on edge after two failed attempts to
// move it.
//
// The move was worth trying: this handler is database-bound and the database is
// single-region, so at the edge every Supabase round trip crosses a continent
// (~200-300ms each for a distant player) where regional Node pinned to the
// Supabase region would be intra-datacentre.
//
// Attempt 1 kept `export default async function handler(req: Request)`, which
// edge accepts and Node does not — Node takes a default-exported FUNCTION for
// the legacy (req, res) signature and hands it an IncomingMessage, so
// req.headers.get() throws. Attempt 2 used `export default { fetch: handler }`,
// the shape Vercel's changelog documents for Node web handlers. Production kept
// answering 500 through both, and players' runs were piling up unsaved.
//
// So this is back to the configuration that demonstrably served this app for
// months. The latency win is real but it is not worth guessing at in production:
// re-attempt it on a PREVIEW deploy, confirm a run actually saves there, and
// only then ship it.

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

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const jwt = bearerJwt(req);
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = getAdminClient();
  const userId = await resolveUserId(admin, jwt);
  if (!userId) return json({ error: "invalid token" }, 401);

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

  // Consent: a "friend challenge" requires an ACCEPTED friendship in the
  // sender→target direction. Without this, anyone could open unlimited
  // rating-staking matches against any username.
  const friendship = await admin
    .from("friendships")
    .select("status")
    .eq("user_id", userId)
    .eq("friend_id", friendId)
    .maybeSingle();
  if (friendship.data?.status !== "accepted") {
    return json({ error: "not_friends" }, 403);
  }

  // Lazily close anything expired, then refuse a second live match between
  // the same pair — one open in_progress match per pair, ever.
  await admin
    .from("ranked_matches")
    .update({ state: "expired" })
    .eq("state", "in_progress")
    .lt("expires_at", new Date().toISOString());
  const live = await admin
    .from("ranked_matches")
    .select("id")
    .eq("state", "in_progress")
    .or(
      `and(player_a.eq.${userId},player_b.eq.${friendId}),and(player_a.eq.${friendId},player_b.eq.${userId})`,
    )
    .limit(1);
  if (live.data && live.data.length > 0) {
    return json({ error: "match_already_open", match_id: live.data[0].id as string }, 409);
  }

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

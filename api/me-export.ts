import { getAdminClient } from "./_lib/supabaseAdmin";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 });
  }
  const jwt = auth.slice("Bearer ".length);

  const admin = getAdminClient();
  const userRes = await admin.auth.getUser(jwt);
  if (userRes.error || !userRes.data.user) {
    return new Response(JSON.stringify({ error: "invalid token" }), { status: 401 });
  }
  const userId = userRes.data.user.id;

  const [profile, skins, runs, friends, challenges, ranked, badges, elo] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("skins").select("*").eq("user_id", userId),
    admin.from("runs").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("friendships").select("*").eq("user_id", userId),
    admin.from("challenges").select("*").or(`creator_id.eq.${userId},responder_id.eq.${userId}`),
    admin.from("ranked_matches").select("*").or(`player_a.eq.${userId},player_b.eq.${userId}`),
    admin.from("elo_season_snapshots").select("*").eq("user_id", userId),
    admin.from("elo_ratings").select("*").eq("user_id", userId),
  ]);

  return new Response(
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        format: "pflug-export-v1",
        user_id: userId,
        email: userRes.data.user.email ?? null,
        profile: profile.data,
        skins: skins.data ?? [],
        runs: runs.data ?? [],
        friendships: friends.data ?? [],
        challenges: challenges.data ?? [],
        ranked_matches: ranked.data ?? [],
        season_snapshots: badges.data ?? [],
        elo_ratings: elo.data ?? [],
      },
      null,
      2,
    ),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="pflug-export-${userId.slice(0, 8)}.json"`,
      },
    },
  );
}

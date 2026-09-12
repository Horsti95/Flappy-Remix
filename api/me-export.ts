import { getAdminClient } from "./_lib/supabaseAdmin";
import { json } from "./_lib/http";
import { bearerJwt } from "./_lib/auth";

// Runtime: regional Node, NOT edge. This handler is database-bound, and the
// database is single-region. At the edge each Supabase round trip crossed a
// continent, so the sequential calls below cost ~200-300ms EACH for a distant
// player. Pinned to the Supabase region via `regions` in vercel.json, the same
// calls are intra-datacentre. The Web `Request`/`Response` signature below is
// reached through the `default.fetch` export at the bottom of this file, which
// is how Vercel's Node runtime recognises a Web handler.

async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return json({ error: "method not allowed" }, 405);
  }
  const jwt = bearerJwt(req);
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  const admin = getAdminClient();
  // Not resolveUserId(): the export payload includes the account email, so
  // this handler needs the full auth user, not just the id.
  const userRes = await admin.auth.getUser(jwt);
  if (userRes.error || !userRes.data.user) return json({ error: "invalid token" }, 401);
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

  // An export is a GDPR data-access response, so "partially complete but
  // presented as complete" is the one outcome we must not produce. Each query's
  // error used to be dropped on the floor and the missing table just serialised
  // as []. Fail the whole request instead: a user retrying is fine, a user
  // believing they have all their data when they don't is not.
  const sections: ReadonlyArray<readonly [string, { error: { message: string } | null }]> = [
    ["profile", profile],
    ["skins", skins],
    ["runs", runs],
    ["friendships", friends],
    ["challenges", challenges],
    ["ranked_matches", ranked],
    ["season_snapshots", badges],
    ["elo_ratings", elo],
  ];
  const failed = sections.filter(([, r]) => r.error).map(([name, r]) => `${name}: ${r.error!.message}`);
  if (failed.length > 0) {
    console.error("[me-export] incomplete export", failed);
    return json({ error: "export_incomplete", failed }, 500);
  }

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

// Vercel's Node runtime reaches a Web handler through `default.fetch`, NOT
// through a default-exported function. A bare `export default function
// handler(req: Request)` is taken for the LEGACY Node signature and invoked as
// handler(req, res) with an IncomingMessage — so the first line that touches
// req.headers.get() throws, every request 500s, and the returned Response is
// discarded. That is exactly what happened when these routes moved off the
// edge runtime. The edge runtime does accept a bare default function, which is
// why nothing complained before the move.
export default { fetch: handler };

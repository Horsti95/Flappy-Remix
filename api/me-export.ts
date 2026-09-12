import { getAdminClient } from "./_lib/supabaseAdmin";
import { json } from "./_lib/http";
import { bearerJwt } from "./_lib/auth";

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

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
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

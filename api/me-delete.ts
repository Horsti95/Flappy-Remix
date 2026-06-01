import { getAdminClient } from "./_lib/supabaseAdmin";

export const config = { runtime: "edge" };

interface Body {
  confirm: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 });
  }
  const jwt = auth.slice("Bearer ".length);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
  }
  if (body.confirm !== "DELETE") {
    return new Response(
      JSON.stringify({ error: "missing confirmation phrase" }),
      { status: 400 },
    );
  }

  const admin = getAdminClient();
  const userRes = await admin.auth.getUser(jwt);
  if (userRes.error || !userRes.data.user) {
    return new Response(JSON.stringify({ error: "invalid token" }), { status: 401 });
  }
  const userId = userRes.data.user.id;

  // Order matters: queue → snapshots → ratings → matches (cascade
  // would handle a lot of this, but explicit deletes keep behavior
  // boring and visible). The auth.users delete cascades to profiles
  // (ON DELETE CASCADE on the FK), which cascades to runs, skins,
  // friendships, challenges via their own FKs.
  await admin.from("matchmaking_queue").delete().eq("user_id", userId);
  await admin.from("elo_season_snapshots").delete().eq("user_id", userId);
  await admin.from("elo_ratings").delete().eq("user_id", userId);
  // Anonymize matches the user appeared in but that another player
  // also participated in: leave the row but null out our side. Simpler
  // path: leave them; the FK is ON DELETE CASCADE. Picking the simpler
  // one — it's our policy that match history goes with the account.
  const del = await admin.auth.admin.deleteUser(userId);
  if (del.error) {
    return new Response(JSON.stringify({ error: del.error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

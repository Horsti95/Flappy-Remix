import { getAdminClient } from "./_lib/supabaseAdmin";
import { json } from "./_lib/http";
import { bearerJwt, resolveUserId } from "./_lib/auth";

export const config = { runtime: "edge" };

interface Body {
  confirm: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  const jwt = bearerJwt(req);
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (body.confirm !== "delete me forever") {
    return json({ error: "missing confirmation phrase" }, 400);
  }

  const admin = getAdminClient();
  const userId = await resolveUserId(admin, jwt);
  if (!userId) return json({ error: "invalid token" }, 401);

  // Deleting the auth user cascades to `profiles` (ON DELETE CASCADE), which
  // cascades to skins / friendships / ratings / matches. But NOT everything is
  // a cascade: `runs.user_id` and the `challenges` FKs are ON DELETE SET NULL
  // (see 0001/0003), so those rows survive, un-linked, as anonymous history.
  // That keeps leaderboard aggregates intact but would otherwise leave the
  // deleted user's full per-tick input trace behind — which is re-identifiable.
  // So before the cascade we strip the inputs from their runs: the anonymous
  // score row stays, the behavioral trace does not.
  await admin.from("runs").update({ inputs: [] }).eq("user_id", userId);
  // Explicit pre-deletes (the FKs below are already CASCADE, so these are
  // belt-and-braces — kept boring and visible).
  await admin.from("matchmaking_queue").delete().eq("user_id", userId);
  await admin.from("elo_season_snapshots").delete().eq("user_id", userId);
  await admin.from("elo_ratings").delete().eq("user_id", userId);
  // Anonymize matches the user appeared in but that another player
  // also participated in: leave the row but null out our side. Simpler
  // path: leave them; the FK is ON DELETE CASCADE. Picking the simpler
  // one — it's our policy that match history goes with the account.
  const del = await admin.auth.admin.deleteUser(userId);
  if (del.error) {
    return json({ error: del.error.message }, 500);
  }
  return json({ ok: true });
}

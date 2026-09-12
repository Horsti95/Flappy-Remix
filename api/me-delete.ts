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

interface Body {
  confirm: string;
}

export const config = { runtime: "edge" };

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
  // This strip is the WHOLE privacy guarantee for deletion: runs.user_id is ON
  // DELETE SET NULL, so the rows outlive the account and would otherwise keep
  // a per-tick behavioural trace that is re-identifiable. The result used to be
  // ignored — if it failed, the auth user was deleted anyway and the traces
  // survived with no way left to find them. Abort instead: a retryable error
  // beats an unfixable privacy leak.
  const stripped = await admin.from("runs").update({ inputs: [] }).eq("user_id", userId);
  if (stripped.error) {
    console.error("[me-delete] failed to strip run inputs; aborting deletion", stripped.error);
    return json(
      { error: "cleanup_failed", detail: "could not remove run input traces — nothing was deleted" },
      500,
    );
  }

  // Explicit pre-deletes (the FKs below are already CASCADE, so these are
  // belt-and-braces — kept boring and visible). Errors are logged but not
  // fatal: the cascade covers them, so failing here would block a deletion
  // that is about to succeed anyway.
  for (const table of ["matchmaking_queue", "elo_season_snapshots", "elo_ratings"] as const) {
    const res = await admin.from(table).delete().eq("user_id", userId);
    if (res.error) console.error(`[me-delete] pre-delete ${table} failed`, res.error);
  }
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

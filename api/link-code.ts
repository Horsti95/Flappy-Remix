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

// Emailless cross-device link codes. See supabase/migrations/0029_link_codes.sql.
//
//   POST { action: "create", refresh_token }  (Authorization: Bearer <access>)
//     → { ok, code, expires_at }  — generate a single-use code for THIS account.
//   POST { action: "redeem", code }
//     → { ok, refresh_token }     — exchange a code for the originating device's
//                                   refresh token; the client then calls
//                                   supabase.auth.refreshSession({ refresh_token }).

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
const CODE_LEN = 8;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { action?: string; code?: string; refresh_token?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const admin = getAdminClient();

  if (body.action === "create") {
    const jwt = bearerJwt(req);
    if (!jwt) return json({ error: "unauthenticated" }, 401);
    const userId = await resolveUserId(admin, jwt);
    if (!userId) return json({ error: "invalid token" }, 401);

    const refresh = (body.refresh_token ?? "").trim();
    if (!refresh) return json({ error: "missing_refresh" }, 400);

    // Gate on a claimed username: only an established profile can be linked.
    const profile = await admin
      .from("profiles")
      .select("username")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile.data?.username) return json({ error: "no_username" }, 403);

    // Retire any prior unused codes for this account so only the freshest works.
    await admin.from("link_codes").delete().eq("user_id", userId).is("consumed_at", null);

    const code = randomCode();
    const expires = new Date(Date.now() + TTL_MS).toISOString();
    const ins = await admin
      .from("link_codes")
      .insert({ code, user_id: userId, refresh_token: refresh, expires_at: expires })
      .select("code, expires_at")
      .single();
    if (ins.error) return json({ error: ins.error.message }, 500);
    return json({ ok: true, code: ins.data.code, expires_at: ins.data.expires_at });
  }

  if (body.action === "redeem") {
    const raw = (body.code ?? "").trim().toUpperCase();
    if (!raw || raw.length !== CODE_LEN) return json({ error: "invalid_format" }, 400);

    const row = await admin
      .from("link_codes")
      .select("code, refresh_token, expires_at, consumed_at")
      .eq("code", raw)
      .maybeSingle();
    if (row.error || !row.data) return json({ error: "not_found" }, 404);
    if (row.data.consumed_at) return json({ error: "already_used" }, 409);
    if (new Date(row.data.expires_at as string).getTime() < Date.now()) {
      return json({ error: "expired" }, 410);
    }

    // Single use: claim it with a conditional UPDATE and only hand out the
    // token if WE were the one to consume it. One statement, so the
    // double-redeem race is genuinely closed (not merely narrowed).
    const claim = await admin
      .from("link_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("code", raw)
      .is("consumed_at", null)
      .select("refresh_token")
      .maybeSingle();
    if (claim.error || !claim.data) return json({ error: "already_used" }, 409);

    const token = claim.data.refresh_token as string;

    // DELETE the row now that the token is in flight. It holds a raw Supabase
    // refresh token; leaving consumed rows behind (the old behaviour) meant the
    // table accumulated working-then-stale session tokens indefinitely, so a DB
    // backup or a leaked service key exposed historical sessions. Also sweep
    // anything else expired while we're here, so the table stays small even
    // without a cron.
    const del = await admin.from("link_codes").delete().eq("code", raw);
    if (del.error) console.error("[link-code] failed to delete redeemed code", del.error);
    const purge = await admin.rpc("purge_link_codes");
    if (purge.error) console.error("[link-code] purge_link_codes failed", purge.error);

    return json({ ok: true, refresh_token: token });
  }

  return json({ error: "bad_action" }, 400);
}

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

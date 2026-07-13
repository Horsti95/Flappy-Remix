import { getAdminClient } from "./_lib/supabaseAdmin";
import { json } from "./_lib/http";
import { bearerJwt, resolveUserId } from "./_lib/auth";

export const config = { runtime: "edge" };

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

    // Single use: stamp consumed first, and only hand out the token if WE were
    // the one to consume it (guards against a double-redeem race).
    const claim = await admin
      .from("link_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("code", raw)
      .is("consumed_at", null)
      .select("refresh_token")
      .maybeSingle();
    if (claim.error || !claim.data) return json({ error: "already_used" }, 409);

    return json({ ok: true, refresh_token: claim.data.refresh_token });
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


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

/**
 * In-app feedback → GitHub issue.
 *
 * Requires two env vars (unset = endpoint answers 503 and the client falls
 * back to the external FEEDBACK_URL link):
 *  - GITHUB_FEEDBACK_TOKEN  fine-grained PAT with issues:write on the repo
 *  - GITHUB_FEEDBACK_REPO   "owner/repo" the issues land in
 *
 * Rate limit: one submission per user per 10 minutes, enforced in the DB via
 * claim_feedback_slot() (migration 0034).
 *
 * This used to be a module-level `Map` — i.e. per instance. Serverless spreads
 * requests across instances, so retrying until a cold one answered bypassed it
 * entirely. The limit is now a single conditional UPSERT: shared across
 * instances, durable across cold starts, and not raceable.
 */

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ghToken = process.env.GITHUB_FEEDBACK_TOKEN;
  const ghRepo = process.env.GITHUB_FEEDBACK_REPO;
  if (!ghToken || !ghRepo || !/^[\w.-]+\/[\w.-]+$/.test(ghRepo)) {
    return json({ error: "not_configured" }, 503);
  }

  const jwt = bearerJwt(req);
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  const admin = getAdminClient();
  const userId = await resolveUserId(admin, jwt);
  if (!userId) return json({ error: "invalid token" }, 401);

  let body: { message?: string; contact?: string; version?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const message = (body.message ?? "").trim();
  if (message.length < 10 || message.length > 2000) {
    return json({ error: "invalid_length" }, 400);
  }
  const contact = (body.contact ?? "").trim().slice(0, 200);
  const version = (body.version ?? "").trim().slice(0, 32);

  // Claim the slot only once the payload is known-good, so a malformed request
  // can't burn the sender's 10-minute window.
  const slot = await admin.rpc("claim_feedback_slot", { p_user_id: userId });
  if (slot.error) {
    console.error("[feedback] claim_feedback_slot failed", slot.error);
    return json({ error: "rate_limit_unavailable" }, 503);
  }
  if (slot.data !== true) {
    return json({ error: "rate_limited" }, 429);
  }

  const profile = await admin
    .from("profiles")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();
  const username = (profile.data?.username as string | undefined) ?? "(no username)";

  const title = `[feedback] ${message.slice(0, 60)}${message.length > 60 ? "…" : ""}`;
  const issueBody = [
    message,
    "",
    "---",
    `- from: @${username}`,
    contact ? `- contact: ${contact}` : null,
    version ? `- app: v${version}` : null,
  ]
    .filter((l): l is string => l != null)
    .join("\n");

  const create = (labels: boolean) =>
    fetch(`https://api.github.com/repos/${ghRepo}/issues`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ghToken}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "glide-feedback",
      },
      body: JSON.stringify(
        labels ? { title, body: issueBody, labels: ["feedback"] } : { title, body: issueBody },
      ),
    });

  // The "feedback" label may not exist in the repo; retry once without it
  // rather than failing the submission over a cosmetic label.
  let res = await create(true);
  if (!res.ok) res = await create(false);
  if (!res.ok) {
    // The slot was claimed before we called GitHub. Give it back so a GitHub
    // outage doesn't cost the player their 10-minute window for a message
    // that never got filed.
    const rel = await admin.from("feedback_rate_limit").delete().eq("user_id", userId);
    if (rel.error) console.error("[feedback] failed to release rate-limit slot", rel.error);
    return json({ error: "github_error" }, 502);
  }

  return json({ ok: true });
}

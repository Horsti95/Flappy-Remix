import { getAdminClient } from "./_lib/supabaseAdmin";
import { json } from "./_lib/http";
import { bearerJwt, resolveUserId } from "./_lib/auth";

// Runtime: regional Node, NOT edge. This handler is database-bound, and the
// database is single-region. At the edge each Supabase round trip crossed a
// continent, so the sequential calls below cost ~200-300ms EACH for a distant
// player. Pinned to the Supabase region via `regions` in vercel.json, the same
// calls are intra-datacentre. The Web `Request`/`Response` signature below is
// reached through the `default.fetch` export at the bottom of this file, which
// is how Vercel's Node runtime recognises a Web handler.

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

async function handler(req: Request): Promise<Response> {
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

// Vercel's Node runtime reaches a Web handler through `default.fetch`, NOT
// through a default-exported function. A bare `export default function
// handler(req: Request)` is taken for the LEGACY Node signature and invoked as
// handler(req, res) with an IncomingMessage — so the first line that touches
// req.headers.get() throws, every request 500s, and the returned Response is
// discarded. That is exactly what happened when these routes moved off the
// edge runtime. The edge runtime does accept a bare default function, which is
// why nothing complained before the move.
export default { fetch: handler };

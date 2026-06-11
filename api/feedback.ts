import { getAdminClient } from "./_lib/supabaseAdmin";

export const config = { runtime: "edge" };

/**
 * In-app feedback → GitHub issue.
 *
 * Requires two env vars (unset = endpoint answers 503 and the client falls
 * back to the external FEEDBACK_URL link):
 *  - GITHUB_FEEDBACK_TOKEN  fine-grained PAT with issues:write on the repo
 *  - GITHUB_FEEDBACK_REPO   "owner/repo" the issues land in
 *
 * Best-effort rate limit: one submission per user per 10 minutes, tracked
 * per edge instance (good enough to stop accidental double-sends; the client
 * keeps its own cooldown too).
 */
const COOLDOWN_MS = 10 * 60 * 1000;
const lastSentByUser = new Map<string, number>();

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ghToken = process.env.GITHUB_FEEDBACK_TOKEN;
  const ghRepo = process.env.GITHUB_FEEDBACK_REPO;
  if (!ghToken || !ghRepo || !/^[\w.-]+\/[\w.-]+$/.test(ghRepo)) {
    return json({ error: "not_configured" }, 503);
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = auth.slice("Bearer ".length);

  const admin = getAdminClient();
  const userRes = await admin.auth.getUser(token);
  if (userRes.error || !userRes.data.user) return json({ error: "unauthorized" }, 401);
  const userId = userRes.data.user.id;

  const last = lastSentByUser.get(userId);
  if (last != null && Date.now() - last < COOLDOWN_MS) {
    return json({ error: "rate_limited" }, 429);
  }

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
  if (!res.ok) return json({ error: "github_error" }, 502);

  lastSentByUser.set(userId, Date.now());
  return json({ ok: true });
}

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), {
    status,
    headers: { "content-type": "application/json" },
  });
}

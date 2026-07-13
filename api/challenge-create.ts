import { getAdminClient } from "./_lib/supabaseAdmin";
import { json } from "./_lib/http";
import { bearerJwt, resolveUserId } from "./_lib/auth";

export const config = { runtime: "edge" };

interface Body {
  source_run_id: string;
  parent_short_id?: string | null;
  /** Optional: address this challenge to a friend by username. When
   *  set, the challenge lands in their inbox as 'pending'. */
  target_username?: string | null;
  /** Creator's equipped cosmetics, so the responder sees the real
   *  sender's world (shape + theme). Cosmetic only. */
  creator_shape?: string | null;
  creator_theme?: string | null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const jwt = bearerJwt(req);
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (typeof body.source_run_id !== "string") return json({ error: "missing source_run_id" }, 400);

  const admin = getAdminClient();
  const userId = await resolveUserId(admin, jwt);
  if (!userId) return json({ error: "invalid token" }, 401);

  const run = await admin
    .from("runs")
    .select("id, user_id, seed, score, inputs, mode, daily_date")
    .eq("id", body.source_run_id)
    .maybeSingle();
  if (run.error || !run.data) return json({ error: "run not found" }, 404);
  if (run.data.user_id !== userId) return json({ error: "not your run" }, 403);

  let parentId: string | null = null;
  let depth = 1;
  if (body.parent_short_id) {
    const parent = await admin
      .from("challenges")
      .select("id, depth")
      .eq("short_id", body.parent_short_id)
      .maybeSingle();
    if (parent.data) {
      parentId = parent.data.id as string;
      depth = (parent.data.depth as number) + 1;
      if (depth > 2) {
        return json({ error: "challenge_chain_capped" }, 409);
      }
    }
  }

  // Resolve an optional target friend by username. A targeted
  // challenge lands in their inbox as 'pending'; an untargeted one
  // stays 'open' (shareable link, legacy behaviour).
  let targetUserId: string | null = null;
  let status = "open";
  if (typeof body.target_username === "string" && body.target_username.trim()) {
    const target = await admin
      .from("profiles")
      .select("user_id")
      .eq("username", body.target_username.trim().toLowerCase())
      .maybeSingle();
    if (!target.data) return json({ error: "target_not_found" }, 404);
    if (target.data.user_id === userId) return json({ error: "cannot_target_self" }, 400);
    targetUserId = target.data.user_id as string;
    status = "pending";
  }

  const idRes = await admin.rpc("gen_challenge_short_id");
  if (idRes.error) return json({ error: idRes.error.message }, 500);
  const shortId = idRes.data as string;

  const ins = await admin
    .from("challenges")
    .insert({
      short_id: shortId,
      creator_id: userId,
      source_run_id: run.data.id,
      seed: run.data.seed,
      inputs: run.data.inputs,
      creator_score: run.data.score,
      parent_id: parentId,
      depth,
      target_user_id: targetUserId,
      status,
      creator_shape: typeof body.creator_shape === "string" ? body.creator_shape : null,
      creator_theme: typeof body.creator_theme === "string" ? body.creator_theme : null,
      // Derived from the source run, never from the client: daily runs carry
      // their date so every replay of this challenge uses that day's twist
      // physics (ghost, responder, and the server validator alike).
      daily_date: run.data.mode === "daily" ? ((run.data.daily_date as string | null) ?? null) : null,
    })
    .select("id, short_id")
    .single();
  if (ins.error) return json({ error: ins.error.message }, 500);

  return json({ ok: true, short_id: ins.data.short_id, depth, targeted: targetUserId !== null }, 200);
}

import { getAdminClient } from "./_lib/supabaseAdmin";

export const config = { runtime: "edge" };

interface Body {
  source_run_id: string;
  parent_short_id?: string | null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);
  const jwt = auth.slice("Bearer ".length);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (typeof body.source_run_id !== "string") return json({ error: "missing source_run_id" }, 400);

  const admin = getAdminClient();
  const userRes = await admin.auth.getUser(jwt);
  if (userRes.error || !userRes.data.user) return json({ error: "invalid token" }, 401);
  const userId = userRes.data.user.id;

  const run = await admin
    .from("runs")
    .select("id, user_id, seed, score, inputs, mode")
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
    })
    .select("id, short_id")
    .single();
  if (ins.error) return json({ error: ins.error.message }, 500);

  return json({ ok: true, short_id: ins.data.short_id, depth }, 200);
}

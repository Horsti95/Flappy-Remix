import { getAdminClient } from "./_lib/supabaseAdmin";
import {
  generateSkinForThreshold,
  thresholdsCrossed,
  type GeneratedSkin,
} from "./_lib/unlock";
import { validatePayloadShape, validateRun } from "./_lib/validate";

export const config = { runtime: "edge" };

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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const shape = validatePayloadShape(raw);
  if ("error" in shape) return json({ error: shape.error }, 400);
  const body = shape;
  const v = validateRun(body);
  if (!v.ok) return json({ accepted: false, reason: v.reason }, 200);

  const admin = getAdminClient();
  const userRes = await admin.auth.getUser(jwt);
  if (userRes.error || !userRes.data.user) return json({ error: "invalid token" }, 401);
  const userId = userRes.data.user.id;

  const profile = await admin
    .from("profiles")
    .select("total_games")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile.error) return json({ error: profile.error.message }, 500);
  const prev = profile.data?.total_games ?? 0;
  const next = prev + 1;

  const run = await admin
    .from("runs")
    .insert({
      user_id: userId,
      seed: body.seed,
      score: body.score,
      ticks: v.ticks,
      inputs: body.inputs,
      inputs_count: body.inputs.length,
      equipped_skin_id: body.equipped_skin_id ?? null,
      mode: body.mode,
      daily_date: body.mode === "daily" ? body.daily_date ?? null : null,
    })
    .select("id")
    .single();
  if (run.error) return json({ error: run.error.message }, 500);

  await admin.from("profiles").update({
    total_games: next,
    last_play_at: new Date().toISOString(),
  }).eq("user_id", userId);

  const crossed = thresholdsCrossed(prev, next);
  const granted: GeneratedSkin[] = [];
  for (const t of crossed) {
    const g = generateSkinForThreshold(userId, t);
    const ins = await admin
      .from("skins")
      .insert({
        user_id: userId,
        body_r: g.skin.body[0],
        body_g: g.skin.body[1],
        body_b: g.skin.body[2],
        accent_r: g.skin.accent[0],
        accent_g: g.skin.accent[1],
        accent_b: g.skin.accent[2],
        encoded_int: g.encoded.toString(),
        rarity: g.rarity,
        unlocked_at_games: t,
      })
      .select("id, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, unlocked_at_games")
      .single();
    if (!ins.error) granted.push(g);
  }

  return json({
    accepted: true,
    run_id: run.data.id,
    total_games: next,
    unlocked: granted.map((g) => ({
      threshold: g.threshold,
      rarity: g.rarity,
      body: g.skin.body,
      accent: g.skin.accent,
    })),
  }, 200);
}

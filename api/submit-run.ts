import { DEFAULT_CONFIG } from "../src/game/config";
import { type InputEvent } from "../src/game/sim";
import { replayRun, validateInputCadence } from "../src/game/replay";
import { getAdminClient } from "./_lib/supabaseAdmin";
import {
  generateSkinForThreshold,
  thresholdsCrossed,
  type GeneratedSkin,
} from "./_lib/unlock";

export const config = { runtime: "edge" };

interface SubmitBody {
  seed: number;
  score: number;
  ticks: number;
  inputs: InputEvent[];
  mode: "casual" | "daily" | "challenge" | "ranked";
  daily_date?: string | null;
  equipped_skin_id?: string | null;
}

const MAX_INPUTS = 10000;
const MAX_TICKS = 60 * 60 * 5;

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

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const v = validatePayload(body);
  if (!v.ok) return json({ error: v.reason }, 400);

  if (!validateInputCadence(body.inputs, DEFAULT_CONFIG.tickHz)) {
    return json({ accepted: false }, 200);
  }

  const replay = replayRun(body.seed, body.inputs, DEFAULT_CONFIG, MAX_TICKS);
  if (replay.alive) return json({ accepted: false, reason: "did_not_die" }, 200);
  if (replay.score !== body.score) return json({ accepted: false }, 200);
  if (Math.abs(replay.ticks - body.ticks) > 2) return json({ accepted: false }, 200);

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
      ticks: replay.ticks,
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

function validatePayload(b: SubmitBody): { ok: true } | { ok: false; reason: string } {
  if (typeof b.seed !== "number" || !Number.isFinite(b.seed)) return { ok: false, reason: "bad seed" };
  if (typeof b.score !== "number" || b.score < 0 || b.score > 1_000_000) return { ok: false, reason: "bad score" };
  if (typeof b.ticks !== "number" || b.ticks < 0 || b.ticks > MAX_TICKS + 60) return { ok: false, reason: "bad ticks" };
  if (!Array.isArray(b.inputs)) return { ok: false, reason: "bad inputs" };
  if (b.inputs.length > MAX_INPUTS) return { ok: false, reason: "too many inputs" };
  for (const ev of b.inputs) {
    if (!ev || typeof ev.tick !== "number" || ev.action !== "flap") return { ok: false, reason: "bad input event" };
    if (ev.tick < 0 || ev.tick > MAX_TICKS + 60) return { ok: false, reason: "input out of range" };
  }
  if (!["casual", "daily", "challenge", "ranked"].includes(b.mode)) return { ok: false, reason: "bad mode" };
  return { ok: true };
}

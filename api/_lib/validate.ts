import { DEFAULT_CONFIG } from "../../src/game/config";
import { replayRun, validateInputCadence } from "../../src/game/replay";
import { type InputEvent } from "../../src/game/sim";

export interface SubmitBody {
  seed: number;
  score: number;
  ticks: number;
  inputs: InputEvent[];
  mode: "casual" | "daily" | "challenge" | "ranked";
  daily_date?: string | null;
  equipped_skin_id?: string | null;
  challenge_short_id?: string | null;
}

export const MAX_INPUTS = 10000;
export const MAX_TICKS = 60 * 60 * 5;

export type ValidateResult =
  | { ok: true; ticks: number }
  | { ok: false; status: 400 | 422; reason: string };

export function validatePayloadShape(b: unknown): SubmitBody | { error: string } {
  if (!b || typeof b !== "object") return { error: "bad json" };
  const o = b as Record<string, unknown>;
  if (typeof o.seed !== "number" || !Number.isFinite(o.seed)) return { error: "bad seed" };
  if (typeof o.score !== "number" || o.score < 0 || o.score > 1_000_000) return { error: "bad score" };
  if (typeof o.ticks !== "number" || o.ticks < 0 || o.ticks > MAX_TICKS + 60) return { error: "bad ticks" };
  if (!Array.isArray(o.inputs)) return { error: "bad inputs" };
  if (o.inputs.length > MAX_INPUTS) return { error: "too many inputs" };
  for (const ev of o.inputs as unknown[]) {
    if (!ev || typeof ev !== "object") return { error: "bad input event" };
    const e = ev as Record<string, unknown>;
    if (typeof e.tick !== "number" || e.action !== "flap") return { error: "bad input event" };
    if (e.tick < 0 || e.tick > MAX_TICKS + 60) return { error: "input out of range" };
  }
  if (!["casual", "daily", "challenge", "ranked"].includes(o.mode as string)) return { error: "bad mode" };
  return o as unknown as SubmitBody;
}

export function validateRun(body: SubmitBody): ValidateResult {
  if (!validateInputCadence(body.inputs, DEFAULT_CONFIG.tickHz)) {
    return { ok: false, status: 422, reason: "cadence" };
  }
  const replay = replayRun(body.seed, body.inputs, DEFAULT_CONFIG, MAX_TICKS);
  if (replay.alive) return { ok: false, status: 422, reason: "did_not_die" };
  if (replay.score !== body.score) return { ok: false, status: 422, reason: "score_mismatch" };
  if (Math.abs(replay.ticks - body.ticks) > 2) return { ok: false, status: 422, reason: "ticks_mismatch" };
  return { ok: true, ticks: replay.ticks };
}

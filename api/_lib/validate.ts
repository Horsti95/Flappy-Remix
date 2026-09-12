import { DEFAULT_CONFIG, type SimConfig } from "../../src/game/config";
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
  ranked_match_id?: string | null;
  ranked_round?: number | null;
  // Cosmetic snapshot (best-effort; ignored if malformed — see submit-run.ts).
  shape?: string | null;
  body?: [number, number, number] | null;
  accent?: [number, number, number] | null;
}

export const MAX_INPUTS = 10000;
export const MAX_TICKS = 60 * 60 * 5;

export type ValidateResult =
  | { ok: true; ticks: number }
  | { ok: false; status: 400 | 422; reason: string };

/**
 * Canonical form of a run's inputs: flap ticks only, ascending, de-duplicated.
 *
 * This is THE identity of a replay and must be the single source of truth for
 * both the simulator and the anti-theft hash. Sim.queueInputs() sorts by tick
 * before stepping, so two payloads that differ only in array order (or in
 * repeated ticks) replay to the identical run. The hash used to be computed
 * over the RECEIVED order, which meant a thief could take a public run,
 * shuffle its input array, and submit it as their own: same replay, same
 * score, different hash, no duplicate detected.
 */
export function canonicalInputTicks(inputs: readonly InputEvent[]): number[] {
  const seen = new Set<number>();
  for (const ev of inputs) {
    if (ev.action === "flap") seen.add(ev.tick);
  }
  return [...seen].sort((a, b) => a - b);
}

export function validatePayloadShape(b: unknown): SubmitBody | { error: string } {
  if (!b || typeof b !== "object") return { error: "bad json" };
  const o = b as Record<string, unknown>;
  // Integer checks, not just isFinite: the sim indexes ticks and the DB columns
  // are integers, so 1.5 / 1e21 / -0.0 style values used to slip through
  // validation and then round or overflow somewhere downstream.
  if (!Number.isInteger(o.seed)) return { error: "bad seed" };
  if ((o.seed as number) < 0 || (o.seed as number) > 0xffffffff) return { error: "bad seed" };
  if (!Number.isInteger(o.score) || (o.score as number) < 0 || (o.score as number) > 1_000_000) {
    return { error: "bad score" };
  }
  if (!Number.isInteger(o.ticks) || (o.ticks as number) < 0 || (o.ticks as number) > MAX_TICKS + 60) {
    return { error: "bad ticks" };
  }
  if (!Array.isArray(o.inputs)) return { error: "bad inputs" };
  if (o.inputs.length > MAX_INPUTS) return { error: "too many inputs" };
  for (const ev of o.inputs as unknown[]) {
    if (!ev || typeof ev !== "object") return { error: "bad input event" };
    const e = ev as Record<string, unknown>;
    if (!Number.isInteger(e.tick) || e.action !== "flap") return { error: "bad input event" };
    if ((e.tick as number) < 0 || (e.tick as number) > MAX_TICKS + 60) {
      return { error: "input out of range" };
    }
  }
  if (!["casual", "daily", "challenge", "ranked"].includes(o.mode as string)) return { error: "bad mode" };
  return o as unknown as SubmitBody;
}

export function validateRun(body: SubmitBody, cfgOverride?: SimConfig): ValidateResult {
  const cfg = cfgOverride ?? DEFAULT_CONFIG;
  if (!validateInputCadence(body.inputs, cfg.tickHz)) {
    return { ok: false, status: 422, reason: "cadence" };
  }
  const replay = replayRun(body.seed, body.inputs, cfg, MAX_TICKS);
  if (replay.alive) return { ok: false, status: 422, reason: "did_not_die" };
  if (replay.score !== body.score) return { ok: false, status: 422, reason: "score_mismatch" };
  if (Math.abs(replay.ticks - body.ticks) > 2) return { ok: false, status: 422, reason: "ticks_mismatch" };
  return { ok: true, ticks: replay.ticks };
}

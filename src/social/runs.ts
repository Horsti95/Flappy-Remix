import { getSupabase } from "../lib/supabase";
import { authState } from "./auth";
import { type InputEvent } from "../game/sim";

export interface SubmitResult {
  accepted: boolean;
  reason?: string;
  run_id?: string;
  total_games?: number;
  streak_days?: number;
  unlocked?: Array<{
    threshold: number;
    rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
    body: [number, number, number];
    accent: [number, number, number];
  }>;
  /** Server-authoritative pilot XP after this run (client syncs to it). */
  xp_total?: number;
  level?: number;
  /**
   * What the run was actually RECORDED as, decided inside submit_run_tx()
   * (migration 0039). Differs from the submitted mode when the daily
   * best-of-3 cap demoted the attempt to casual — the server counts under a
   * row lock, so this is authoritative where a client-side count is not.
   */
  mode?: "casual" | "daily" | "challenge" | "ranked";
  /** Server-decided personal best (settled under the same lock). */
  is_new_pb?: boolean;
  /** XP this single run earned, for the client's XP animation. */
  xp_gain?: number;
  /** Color skins minted for account levels crossed this run (every 5). */
  level_skins?: Array<{
    level: number;
    rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
    body: [number, number, number];
    accent: [number, number, number];
  }>;
  /** Present on ranked submissions; mirrors the match state server-side. */
  ranked?: {
    match_id: string;
    round: number;
    you: "a" | "b";
    state: "pending" | "in_progress" | "completed" | "expired" | "cancelled";
    a_scores: Array<number | null>;
    b_scores: Array<number | null>;
    a_rating_after?: number | null;
    b_rating_after?: number | null;
    winner_id?: string | null;
  };
}

export interface SubmitPayload {
  seed: number;
  score: number;
  ticks: number;
  inputs: InputEvent[];
  mode: "casual" | "daily" | "challenge" | "ranked";
  dailyDate?: string;
  challengeShortId?: string | null;
  rankedMatchId?: string | null;
  rankedRound?: number | null;
  equippedSkinId?: string | null;
  /** Cosmetic snapshot: the shape + skin colors this run was flown with, so
   *  the leaderboard shows what the run actually used (not the current equip). */
  shape?: string | null;
  body?: [number, number, number] | null;
  accent?: [number, number, number] | null;
}

// Bound how long a submit can hang: on a stalled mobile connection the death
// screen waits on this call, so an unbounded fetch means an unbounded freeze.
// A network failure or timeout returns null (retriable) rather than throwing,
// so callers — including the offline queue — get one uniform "try later" signal.
const SUBMIT_TIMEOUT_MS = 12000;

export async function submitRun(payload: SubmitPayload): Promise<SubmitResult | null> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.session) return null;
  let res: Response;
  try {
    res = await fetch("/api/submit-run", {
      method: "POST",
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${s.session.access_token}`,
      },
      body: JSON.stringify({
        seed: payload.seed,
        score: payload.score,
        ticks: payload.ticks,
        inputs: payload.inputs,
        mode: payload.mode,
        daily_date: payload.dailyDate ?? null,
        challenge_short_id: payload.challengeShortId ?? null,
        ranked_match_id: payload.rankedMatchId ?? null,
        ranked_round: payload.rankedRound ?? null,
        equipped_skin_id: payload.equippedSkinId ?? null,
        shape: payload.shape ?? null,
        body: payload.body ?? null,
        accent: payload.accent ?? null,
      }),
    });
  } catch (err) {
    // Timeout (AbortError) or network failure — treat as retriable, not fatal.
    console.warn("[submit-run] request failed", err);
    return null;
  }
  if (!res.ok) {
    const txt = await res.text();
    console.warn("[submit-run] non-200", res.status, txt);
    return { accepted: false, reason: `http_${res.status}` };
  }
  return (await res.json()) as SubmitResult;
}

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
}

export interface SubmitPayload {
  seed: number;
  score: number;
  ticks: number;
  inputs: InputEvent[];
  mode: "casual" | "daily" | "challenge" | "ranked";
  dailyDate?: string;
  challengeShortId?: string | null;
  equippedSkinId?: string | null;
}

export async function submitRun(payload: SubmitPayload): Promise<SubmitResult | null> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.session) return null;
  const res = await fetch("/api/submit-run", {
    method: "POST",
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
      equipped_skin_id: payload.equippedSkinId ?? null,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.warn("[submit-run] non-200", res.status, txt);
    return { accepted: false, reason: `http_${res.status}` };
  }
  return (await res.json()) as SubmitResult;
}

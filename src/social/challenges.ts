import { getSupabase } from "../lib/supabase";
import { authState } from "./auth";
import { type InputEvent } from "../game/sim";
import { type SkinColors } from "../game/skin";

export interface FetchedChallenge {
  short_id: string;
  seed: number;
  inputs: InputEvent[];
  creator_score: number;
  creator_username: string | null;
  creator_friend_code: string | null;
  creator_skin: { body: [number, number, number]; accent: [number, number, number]; rarity: string | null } | null;
  depth: number;
  can_respond_again: boolean;
}

export async function fetchChallenge(shortId: string): Promise<FetchedChallenge | null> {
  try {
    const res = await fetch(`/api/challenge?id=${encodeURIComponent(shortId)}`);
    if (!res.ok) return null;
    return (await res.json()) as FetchedChallenge;
  } catch {
    return null;
  }
}

export interface CreateChallengeResult {
  ok: boolean;
  short_id?: string;
  depth?: number;
  error?: string;
}

export async function createChallenge(runId: string, parentShortId: string | null): Promise<CreateChallengeResult> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.session) return { ok: false, error: "offline" };
  try {
    const res = await fetch("/api/challenge-create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${s.session.access_token}`,
      },
      body: JSON.stringify({ source_run_id: runId, parent_short_id: parentShortId }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    const json = (await res.json()) as CreateChallengeResult;
    return { ok: true, short_id: json.short_id, depth: json.depth };
  } catch (err) {
    console.error("[challenge] create", err);
    return { ok: false, error: "network" };
  }
}

export function ghostSkinFromChallenge(c: FetchedChallenge | null): SkinColors | undefined {
  if (!c?.creator_skin) return undefined;
  return { body: c.creator_skin.body, accent: c.creator_skin.accent };
}

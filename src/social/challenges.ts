import { getSupabase } from "../lib/supabase";
import { authState } from "./auth";
import { type InputEvent } from "../game/sim";
import { type SkinColors } from "../game/skin";
import { type ShapeId } from "../game/shapes";
import { type ThemeId } from "../game/themes";

export interface FetchedChallenge {
  short_id: string;
  seed: number;
  inputs: InputEvent[];
  creator_score: number;
  creator_username: string | null;
  creator_friend_code: string | null;
  creator_skin: { body: [number, number, number]; accent: [number, number, number]; rarity: string | null } | null;
  /** Creator's equipped cosmetics so the responder sees the sender's
   *  world. Null on legacy challenges — render falls back to defaults. */
  creator_shape: ShapeId | null;
  creator_theme: ThemeId | null;
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

export async function createChallenge(
  runId: string,
  parentShortId: string | null,
  targetUsername?: string | null,
  cosmetics?: { shape?: ShapeId; theme?: ThemeId },
): Promise<CreateChallengeResult> {
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
      body: JSON.stringify({
        source_run_id: runId,
        parent_short_id: parentShortId,
        target_username: targetUsername ?? null,
        creator_shape: cosmetics?.shape ?? null,
        creator_theme: cosmetics?.theme ?? null,
      }),
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

export interface IncomingChallenge {
  short_id: string;
  creator_username: string | null;
  creator_score: number;
  created_at: string;
  seen_at: string | null;
}

export interface OutgoingChallenge {
  short_id: string;
  target_username: string | null;
  status: string;
  creator_score: number;
  responder_score: number | null;
  created_at: string;
}

export async function fetchIncomingChallenges(): Promise<IncomingChallenge[]> {
  const sb = getSupabase();
  if (!sb || !authState().session) return [];
  const { data, error } = await sb.rpc("inbox_incoming");
  if (error) {
    console.error("[inbox] incoming", error);
    return [];
  }
  return (data ?? []) as IncomingChallenge[];
}

export async function fetchOutgoingChallenges(): Promise<OutgoingChallenge[]> {
  const sb = getSupabase();
  if (!sb || !authState().session) return [];
  const { data, error } = await sb.rpc("inbox_outgoing");
  if (error) {
    console.error("[inbox] outgoing", error);
    return [];
  }
  return (data ?? []) as OutgoingChallenge[];
}

export async function fetchUnseenChallengeCount(): Promise<number> {
  const sb = getSupabase();
  if (!sb || !authState().session) return 0;
  const { data, error } = await sb.rpc("inbox_unseen_count");
  if (error) return 0;
  return (data as number) ?? 0;
}

export async function markInboxSeen(): Promise<void> {
  const sb = getSupabase();
  if (!sb || !authState().session) return;
  await sb.rpc("inbox_mark_seen");
}

export async function declineChallenge(shortId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb || !authState().session) return;
  await sb.rpc("decline_challenge", { p_short_id: shortId });
}

export function ghostSkinFromChallenge(c: FetchedChallenge | null): SkinColors | undefined {
  if (!c?.creator_skin) return undefined;
  return { body: c.creator_skin.body, accent: c.creator_skin.accent };
}

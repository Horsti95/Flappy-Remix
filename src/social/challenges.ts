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
  creator_skin: { body: [number, number, number]; accent: [number, number, number]; rarity: string | null } | null;
  /** Creator's equipped cosmetics so the responder sees the sender's
   *  world. Null on legacy challenges — render falls back to defaults. */
  creator_shape: ShapeId | null;
  creator_theme: ThemeId | null;
  /** Set when the source run was a daily: replays of this challenge must
   *  use that day's twist physics, not DEFAULT_CONFIG. Null on legacy rows
   *  and non-daily runs. */
  daily_date: string | null;
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

/**
 * Build a challenge-shaped object from a player's best stored run, so it can
 * be raced through the normal challenge flow (ghost + creator cosmetics).
 * Reads public tables directly (runs/profiles/skins are world-readable) — no
 * dedicated endpoint or migration needed. Returns null if the player has no
 * scoring run yet.
 */
/**
 * Retry a Supabase query a couple of times on transient failure. Many
 * "challenge didn't load" reports are a single dropped request, not missing
 * data — so we distinguish an *error* (worth retrying) from an empty result
 * (genuinely no data; return as-is).
 */
async function withRetry<T>(
  label: string,
  run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  let lastErr: { message: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await run();
    if (!error) return data;
    lastErr = error;
    if (attempt < 2) await new Promise((res) => setTimeout(res, 250 * 2 ** attempt));
  }
  console.warn(`[challenge] ${label} failed after retries:`, lastErr?.message);
  return null;
}

export async function fetchBestRunChallenge(username: string): Promise<FetchedChallenge | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // Usernames are stored lowercased; match case-insensitively so a display-case
  // name (e.g. from a profile card) still resolves.
  const uname = username.toLowerCase();
  const prof = await withRetry("profile lookup", () =>
    sb.from("profiles").select("user_id, equipped_shape").eq("username", uname).maybeSingle(),
  );
  if (!prof) return null;
  const p = prof as { user_id: string; equipped_shape: string | null };
  const run = await withRetry("best run lookup", () =>
    sb
      .from("runs")
      .select("seed, score, inputs, equipped_skin_id, mode, daily_date")
      .eq("user_id", p.user_id)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (!run) return null;
  const r = run as { seed: number; score: number; inputs: InputEvent[]; equipped_skin_id: string | null; mode: string | null; daily_date: string | null };
  if (!r.score || r.score <= 0) return null;

  let creator_skin: FetchedChallenge["creator_skin"] = null;
  if (r.equipped_skin_id) {
    const { data: sk } = await sb
      .from("skins")
      .select("body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity")
      .eq("id", r.equipped_skin_id)
      .maybeSingle();
    if (sk) {
      const s = sk as Record<string, number | string>;
      creator_skin = {
        body: [s.body_r as number, s.body_g as number, s.body_b as number],
        accent: [s.accent_r as number, s.accent_g as number, s.accent_b as number],
        rarity: (s.rarity as string | null) ?? null,
      };
    }
  }

  return {
    short_id: `best:${username}`,
    seed: Number(r.seed) >>> 0,
    inputs: (r.inputs ?? []) as InputEvent[],
    creator_score: r.score,
    creator_username: username,
    creator_skin,
    creator_shape: (p.equipped_shape ?? null) as ShapeId | null,
    creator_theme: null,
    daily_date: r.mode === "daily" ? (r.daily_date ?? null) : null,
    depth: 0,
    can_respond_again: true,
  };
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

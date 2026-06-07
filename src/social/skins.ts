import { getSupabase } from "../lib/supabase";
import { authState, refreshProfile } from "./auth";
import { DEFAULT_SKIN, type SkinColors } from "../game/skin";
import { type Rarity } from "../game/rarity";

export interface SkinRow {
  id: string;
  body: [number, number, number];
  accent: [number, number, number];
  rarity: Rarity;
  unlocked_at_games: number;
}

const EQUIPPED_KEY = "pflug.equipped.v1";
const EQUIPPED_SHAPE_KEY = "pflug.shape.v1";
const OWNED_CACHE_KEY = "pflug.ownedSkins.cache.v1";

let ownedCache: SkinRow[] | null = null;

export function getEquippedShapeLocal(): string | null {
  try {
    return JSON.parse(localStorage.getItem(EQUIPPED_SHAPE_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function setEquippedShapeLocal(shapeId: string | null): void {
  try {
    localStorage.setItem(EQUIPPED_SHAPE_KEY, JSON.stringify(shapeId));
  } catch {
    /* ignore — localStorage may be blocked */
  }
}

/** Persist the equipped shape on the profile so other players (leaderboard,
 *  profile card) can render it. Best-effort; local equip still works offline. */
export async function syncEquippedShape(shapeId: string): Promise<void> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return;
  await sb.from("profiles").update({ equipped_shape: shapeId }).eq("user_id", s.user.id);
}

export async function listOwnedSkins(): Promise<SkinRow[]> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return [];
  const { data, error } = await sb
    .from("skins")
    .select("id, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, unlocked_at_games")
    .eq("user_id", s.user.id)
    .order("unlocked_at_games", { ascending: true });
  if (error) {
    console.error("[skins] list", error);
    return [];
  }
  const mapped = (data ?? []).map((r) => ({
    id: r.id as string,
    body: [r.body_r, r.body_g, r.body_b] as [number, number, number],
    accent: [r.accent_r, r.accent_g, r.accent_b] as [number, number, number],
    rarity: r.rarity as Rarity,
    unlocked_at_games: r.unlocked_at_games as number,
  }));
  ownedCache = mapped;
  try { localStorage.setItem(OWNED_CACHE_KEY, JSON.stringify(mapped)); } catch { /* ignore */ }
  return mapped;
}

/** Last-known owned skins from memory or localStorage — for instant render
 *  before listOwnedSkins() revalidates. Returns null if nothing cached. */
export function getCachedOwnedSkins(): SkinRow[] | null {
  if (ownedCache) return ownedCache;
  try {
    const raw = localStorage.getItem(OWNED_CACHE_KEY);
    if (!raw) return null;
    ownedCache = JSON.parse(raw) as SkinRow[];
    return ownedCache;
  } catch {
    return null;
  }
}

export function invalidateOwnedSkinsCache(): void {
  ownedCache = null;
  try { localStorage.removeItem(OWNED_CACHE_KEY); } catch { /* ignore */ }
}

export async function setEquippedSkin(skinId: string | null): Promise<void> {
  const sb = getSupabase();
  const s = authState();
  try {
    localStorage.setItem(EQUIPPED_KEY, JSON.stringify(skinId));
  } catch { /* ignore */ }
  if (!sb || !s.user) return;
  await sb.from("profiles").update({ equipped_skin_id: skinId }).eq("user_id", s.user.id);
  await refreshProfile();
}

export function getEquippedSkinIdLocal(): string | null {
  try {
    return JSON.parse(localStorage.getItem(EQUIPPED_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function rowToColors(row: SkinRow): SkinColors {
  return { body: row.body, accent: row.accent };
}

export { DEFAULT_SKIN };

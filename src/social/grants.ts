import { getSupabase } from "../lib/supabase";
import { authState } from "./auth";
import type { ShapeId } from "../game/shapes";

const LOCAL_KEY = "pflug.grantedShapes.v1";

export function getGrantedShapesLocal(): ShapeId[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ShapeId[]) : [];
  } catch {
    return [];
  }
}

function saveGrantedShapesLocal(ids: ShapeId[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* localStorage blocked */
  }
}

/** Fetch the user's shape grants from supabase and cache them in
 *  localStorage so the gallery can read synchronously. */
export async function refreshGrantedShapes(): Promise<void> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return;
  const { data, error } = await sb
    .from("shape_grants")
    .select("shape_id")
    .eq("user_id", s.user.id);
  if (error) {
    console.error("[grants] fetch", error);
    return;
  }
  const ids = (data ?? []).map((r) => (r as { shape_id: string }).shape_id as ShapeId);
  saveGrantedShapesLocal(ids);
}

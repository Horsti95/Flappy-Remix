import { getSupabase } from "../lib/supabase";
import { authState } from "./auth";
import { validateUsername } from "./profanity";

export interface Friend {
  user_id: string;
  username: string | null;
  best_score: number | null;
}

export async function addFriendByUsername(rawUsername: string): Promise<
  { ok: true; friendId: string } | { ok: false; reason: string }
> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.session) return { ok: false, reason: "offline" };
  const check = validateUsername(rawUsername);
  if (!check.ok) return check;
  const { data, error } = await sb.rpc("add_friend_by_username", { target_username: check.value });
  if (error) {
    console.error("[friends] rpc", error);
    return { ok: false, reason: "server error" };
  }
  const payload = data as { ok?: true; friend_id?: string; error?: string } | null;
  if (!payload) return { ok: false, reason: "unknown" };
  if (payload.error === "not_found") return { ok: false, reason: "no user with that handle" };
  if (payload.error === "self") return { ok: false, reason: "that's you" };
  if (payload.error) return { ok: false, reason: payload.error };
  if (payload.friend_id) return { ok: true, friendId: payload.friend_id };
  return { ok: false, reason: "unknown" };
}

export async function listFriends(): Promise<Friend[]> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return [];
  const { data, error } = await sb
    .from("friendships")
    .select("friend_id, profiles:friend_id(username)")
    .eq("user_id", s.user.id);
  if (error) {
    console.error("[friends] list", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    user_id: r.friend_id as string,
    username: ((r as { profiles?: { username?: string | null } | null }).profiles?.username) ?? null,
    best_score: null,
  }));
}

export async function removeFriend(friendId: string): Promise<void> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return;
  // Only delete our own side; the trigger doesn't auto-mirror.
  // For symmetric removal both users can drop their row individually.
  await sb.from("friendships").delete()
    .eq("user_id", s.user.id)
    .eq("friend_id", friendId);
}

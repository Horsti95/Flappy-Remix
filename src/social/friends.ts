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

export interface VsRecord {
  wins: number;
  losses: number;
  draws: number;
  /** Total played challenges (= wins + losses + draws). */
  total: number;
}

const EMPTY_RECORD: VsRecord = { wins: 0, losses: 0, draws: 0, total: 0 };

export async function getRecordVsFriend(friendId: string): Promise<VsRecord> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return EMPTY_RECORD;
  // Two halves of the record:
  //   (a) I created, friend responded
  //   (b) friend created, I responded
  // A challenge counts once we know both scores (responded_at is not null).
  const me = s.user.id;
  const [iCreated, theyCreated] = await Promise.all([
    sb
      .from("challenges")
      .select("creator_score, responder_score")
      .eq("creator_id", me)
      .eq("responder_id", friendId)
      .not("responded_at", "is", null),
    sb
      .from("challenges")
      .select("creator_score, responder_score")
      .eq("creator_id", friendId)
      .eq("responder_id", me)
      .not("responded_at", "is", null),
  ]);
  if (iCreated.error || theyCreated.error) {
    if (iCreated.error) console.error("[vs] mine", iCreated.error);
    if (theyCreated.error) console.error("[vs] theirs", theyCreated.error);
    return EMPTY_RECORD;
  }
  const tally = { wins: 0, losses: 0, draws: 0, total: 0 };
  for (const row of (iCreated.data ?? []) as Array<{ creator_score: number; responder_score: number | null }>) {
    if (row.responder_score == null) continue;
    if (row.creator_score > row.responder_score) tally.wins++;
    else if (row.creator_score < row.responder_score) tally.losses++;
    else tally.draws++;
    tally.total++;
  }
  for (const row of (theyCreated.data ?? []) as Array<{ creator_score: number; responder_score: number | null }>) {
    if (row.responder_score == null) continue;
    if (row.responder_score > row.creator_score) tally.wins++;
    else if (row.responder_score < row.creator_score) tally.losses++;
    else tally.draws++;
    tally.total++;
  }
  return tally;
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

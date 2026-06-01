import { getSupabase } from "../lib/supabase";
import { authState } from "./auth";
import { validateUsername } from "./profanity";
import { loadAchievementStats, saveAchievementStats } from "../game/achievements";

export interface Friend {
  user_id: string;
  username: string | null;
  best_score: number | null;
}

export async function addFriendByUsername(rawUsername: string): Promise<
  { ok: true; friendId: string; state: "accepted" | "requested" } | { ok: false; reason: string }
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
  const payload = data as { ok?: true; friend_id?: string; state?: "accepted" | "requested"; error?: string } | null;
  if (!payload) return { ok: false, reason: "unknown" };
  if (payload.error === "not_found") return { ok: false, reason: "no user with that handle" };
  if (payload.error === "self") return { ok: false, reason: "that's you" };
  if (payload.error) return { ok: false, reason: payload.error };
  if (payload.friend_id) return { ok: true, friendId: payload.friend_id, state: payload.state ?? "requested" };
  return { ok: false, reason: "unknown" };
}

export interface FriendRequest {
  user_id: string;
  username: string | null;
  created_at: string;
}

export async function listIncomingRequests(): Promise<FriendRequest[]> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return [];
  const { data, error } = await sb.rpc("incoming_friend_requests");
  if (error) {
    console.error("[friends] incoming", error);
    return [];
  }
  return (data ?? []).map((r: { user_id: string; username: string | null; created_at: string }) => ({
    user_id: r.user_id,
    username: r.username ?? null,
    created_at: r.created_at,
  }));
}

export async function acceptFriendRequest(requesterId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !authState().user) return false;
  const { data, error } = await sb.rpc("accept_friend_request", { requester_id: requesterId });
  if (error) {
    console.error("[friends] accept", error);
    return false;
  }
  return (data as { ok?: boolean } | null)?.ok === true;
}

export async function declineFriendRequest(requesterId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb || !authState().user) return;
  await sb.rpc("decline_friend_request", { requester_id: requesterId });
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

export async function getFriendCount(): Promise<number> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return 0;
  const { count, error } = await sb
    .from("friendships")
    .select("friend_id", { count: "exact", head: true })
    .eq("user_id", s.user.id)
    .eq("status", "accepted");
  if (error) {
    console.error("[friends] count", error);
    return 0;
  }
  return count ?? 0;
}

export async function refreshFriendCount(): Promise<void> {
  const count = await getFriendCount();
  const stats = loadAchievementStats();
  if (stats.friendCount === count) return;
  saveAchievementStats({ ...stats, friendCount: count });
}

/**
 * Count resolved challenge wins across every duel the player took part in
 * (both as creator and as responder) and mirror the total into the local
 * achievement stats. A duel only counts once both scores are known
 * (responded_at is not null), matching getRecordVsFriend's semantics.
 */
export async function getChallengeWinCount(): Promise<number> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return 0;
  const me = s.user.id;
  const [iCreated, iResponded] = await Promise.all([
    sb
      .from("challenges")
      .select("creator_score, responder_score")
      .eq("creator_id", me)
      .not("responded_at", "is", null),
    sb
      .from("challenges")
      .select("creator_score, responder_score")
      .eq("responder_id", me)
      .not("responded_at", "is", null),
  ]);
  if (iCreated.error || iResponded.error) {
    if (iCreated.error) console.error("[challenge-wins] mine", iCreated.error);
    if (iResponded.error) console.error("[challenge-wins] theirs", iResponded.error);
    return loadAchievementStats().challengeWins;
  }
  let wins = 0;
  for (const row of (iCreated.data ?? []) as Array<{ creator_score: number; responder_score: number | null }>) {
    if (row.responder_score != null && row.creator_score > row.responder_score) wins++;
  }
  for (const row of (iResponded.data ?? []) as Array<{ creator_score: number; responder_score: number | null }>) {
    if (row.responder_score != null && row.responder_score > row.creator_score) wins++;
  }
  return wins;
}

export async function refreshChallengeWins(): Promise<void> {
  const wins = await getChallengeWinCount();
  const stats = loadAchievementStats();
  if (stats.challengeWins === wins) return;
  saveAchievementStats({ ...stats, challengeWins: wins });
}

export async function listFriends(): Promise<Friend[]> {
  const sb = getSupabase();
  const s = authState();
  if (!sb || !s.user) return [];
  const { data, error } = await sb
    .from("friendships")
    .select("friend_id, profiles:friend_id(username)")
    .eq("user_id", s.user.id)
    .eq("status", "accepted");
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

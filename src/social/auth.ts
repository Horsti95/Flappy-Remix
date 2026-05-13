import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isBackendConfigured } from "../lib/supabase";
import { validateUsername } from "./profanity";

export interface Profile {
  user_id: string;
  username: string | null;
  total_games: number;
  streak_days: number;
  last_play_at: string | null;
  equipped_skin_id: string | null;
  friend_code: string | null;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  ready: boolean;
  offline: boolean;
}

const state: AuthState = {
  user: null,
  session: null,
  profile: null,
  ready: false,
  offline: !isBackendConfigured(),
};

type Listener = (s: AuthState) => void;
const listeners = new Set<Listener>();

export function subscribeAuth(fn: Listener): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

function emit(): void {
  for (const l of listeners) l(state);
}

export async function initAuth(): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    state.ready = true;
    state.offline = true;
    emit();
    return;
  }
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    const { data: signin, error } = await sb.auth.signInAnonymously();
    if (error) {
      console.error("[auth] anonymous sign-in failed", error);
    } else {
      state.session = signin.session ?? null;
      state.user = signin.user ?? null;
    }
  } else {
    state.session = data.session;
    state.user = data.session.user;
  }
  if (state.user) await refreshProfile();
  state.ready = true;
  emit();

  sb.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.user = session?.user ?? null;
    if (state.user) await refreshProfile();
    else state.profile = null;
    emit();
  });
}

export async function refreshProfile(): Promise<Profile | null> {
  const sb = getSupabase();
  if (!sb || !state.user) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("user_id, username, total_games, streak_days, last_play_at, equipped_skin_id, friend_code")
    .eq("user_id", state.user.id)
    .maybeSingle();
  if (error) {
    console.error("[auth] refreshProfile", error);
    return null;
  }
  state.profile = data as Profile | null;
  emit();
  return state.profile;
}

export async function claimUsername(raw: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const sb = getSupabase();
  if (!sb || !state.user) return { ok: false, reason: "not signed in" };
  const check = validateUsername(raw);
  if (!check.ok) return check;
  const { error } = await sb
    .from("profiles")
    .update({ username: check.value })
    .eq("user_id", state.user.id);
  if (error) {
    if (error.code === "23505") return { ok: false, reason: "taken" };
    if (error.code === "23514") return { ok: false, reason: "invalid format" };
    console.error("[auth] claimUsername", error);
    return { ok: false, reason: "server error" };
  }
  await refreshProfile();
  return { ok: true };
}

export async function signInWithGoogle(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  state.user = null;
  state.session = null;
  state.profile = null;
  emit();
  await initAuth();
}

export function authState(): Readonly<AuthState> {
  return state;
}

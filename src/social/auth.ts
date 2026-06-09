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
  created_at: string | null;
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
    .select("user_id, username, total_games, streak_days, last_play_at, equipped_skin_id, created_at")
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

export type OAuthProvider = "google" | "discord";

/**
 * Sign in with an OAuth provider, preserving anonymous progress.
 *
 * If the visitor is still anonymous we `linkIdentity` so their skins / streak /
 * scores carry over onto the new permanent account. That requires **Manual
 * Linking** to be enabled in the Supabase dashboard (Auth → Settings). If
 * linking can't happen — manual linking disabled, or this provider identity
 * already belongs to another account (a returning user on a fresh device) — we
 * fall back to a normal sign-in. The fallback abandons the throwaway anon
 * session; for the rare "lots of anon progress, then sign into a pre-existing
 * account" case, reconcile with scripts/sql/merge-accounts.sql.
 *
 * NOTE: untested until the providers are configured in Supabase + each
 * provider's developer console (see docs/packaging-notes.md).
 */
async function oauthSignIn(provider: OAuthProvider): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const redirectTo = window.location.origin;
  if (state.user?.is_anonymous) {
    const { error } = await sb.auth.linkIdentity({ provider, options: { redirectTo } });
    // On success the browser is already redirecting to the provider.
    if (!error) return;
    console.warn(`[auth] linkIdentity(${provider}) failed; falling back to sign-in`, error);
  }
  await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
}

export function signInWithGoogle(): Promise<void> {
  return oauthSignIn("google");
}

export function signInWithDiscord(): Promise<void> {
  return oauthSignIn("discord");
}

/**
 * Email sign-in / link via a one-time link.
 *
 * Anonymous users are *upgraded* in place with `updateUser({ email })`, which
 * emails a confirmation that converts the anon account to an email account
 * (progress preserved). If that email already belongs to someone, we fall back
 * to an OTP sign-in. Non-anonymous callers always get the OTP path. Returns a
 * result so the UI can prompt "check your email". Untested until email auth is
 * enabled in Supabase.
 */
export async function signInWithEmail(
  rawEmail: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "offline" };
  const email = rawEmail.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, reason: "enter a valid email" };
  }
  const redirect = { emailRedirectTo: window.location.origin };
  if (state.user?.is_anonymous) {
    const { error } = await sb.auth.updateUser({ email });
    if (!error) return { ok: true };
    // Email likely already in use → sign into that account instead.
    const { error: otpErr } = await sb.auth.signInWithOtp({ email, options: redirect });
    return otpErr ? { ok: false, reason: otpErr.message } : { ok: true };
  }
  const { error } = await sb.auth.signInWithOtp({ email, options: redirect });
  return error ? { ok: false, reason: error.message } : { ok: true };
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

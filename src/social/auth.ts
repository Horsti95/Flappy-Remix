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
  /**
   * True when this device provably HAD an account (see the account marker
   * below) but the stored session could not be restored this launch. The app
   * must NOT mint a replacement anonymous account in that state — see
   * {@link initAuth}. The UI surfaces a retry instead.
   */
  sessionLost: boolean;
}

const state: AuthState = {
  user: null,
  session: null,
  profile: null,
  ready: false,
  offline: !isBackendConfigured(),
  sessionLost: false,
};

/**
 * "This device has an account" marker.
 *
 * WHY THIS EXISTS — the account-loss bug.
 *
 * initAuth used to do:
 *
 *     const { data } = await sb.auth.getSession();   // error discarded!
 *     if (!data.session) await sb.auth.signInAnonymously();
 *
 * `getSession()` returns `{ data: { session }, error }` and refreshes an
 * expired access token on the way. The error was thrown away, so ANY transient
 * failure to restore — dead network mid-refresh, a Supabase 5xx, device clock
 * skew, a refresh token already rotated by another device (exactly what
 * redeemLinkCode does to the originating device) — produced `session: null`
 * and fell straight into `signInAnonymously()`.
 *
 * That mints a brand-new user_id AND overwrites the stored Supabase session in
 * localStorage, destroying the only copy of the old refresh token. The old
 * account still exists server-side with all its runs, skins and streak, but
 * the device can never reach it again. Symptom: a player relaunches and is
 * suddenly `guest-xxxx` on the leaderboard with zero progress.
 *
 * A fresh anonymous sign-in is only ever correct on a device that has never
 * had an account. This marker is how we tell those two cases apart: it is
 * written once we hold a real user, and cleared only by an explicit sign-out
 * or an explicit "start fresh". It is deliberately a separate key from
 * Supabase's own session storage so that losing one does not lose the other.
 */
const ACCOUNT_MARKER_KEY = "pflug.account.v1";

interface AccountMarker {
  userId: string;
  username: string | null;
  /** Epoch ms of the last successful session restore. */
  at: number;
}

function readAccountMarker(): AccountMarker | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_MARKER_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as AccountMarker;
    return typeof m?.userId === "string" && m.userId.length > 0 ? m : null;
  } catch {
    return null;
  }
}

function writeAccountMarker(userId: string, username: string | null): void {
  try {
    const prev = readAccountMarker();
    // Never let a marker silently point at a different account than the one it
    // pointed at before: that is the fingerprint of the bug above. Log loudly
    // so it shows up in a bug report instead of being invisible.
    if (prev && prev.userId !== userId) {
      console.warn(
        `[auth] account identity changed on this device: ${prev.userId} -> ${userId}` +
          (prev.username ? ` (was @${prev.username})` : ""),
      );
    }
    localStorage.setItem(
      ACCOUNT_MARKER_KEY,
      JSON.stringify({ userId, username, at: Date.now() } satisfies AccountMarker),
    );
  } catch {
    /* localStorage full or blocked — we simply lose the safety net */
  }
}

function clearAccountMarker(): void {
  try {
    localStorage.removeItem(ACCOUNT_MARKER_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The whole account-loss bug reduced to one decision, kept pure so it can be
 * unit-tested without a Supabase client or a browser.
 *
 *   hasMarker  — this device has previously held a real account
 *   hasSession — getSession() returned a usable session this launch
 *
 * The critical row is (marker, no session) => "report-lost". Returning
 * "fresh-anon" there is exactly what orphaned real accounts.
 */
export type RestoreDecision = "use-session" | "fresh-anon" | "report-lost";

export function decideRestore(hasMarker: boolean, hasSession: boolean): RestoreDecision {
  if (hasSession) return "use-session";
  return hasMarker ? "report-lost" : "fresh-anon";
}

/** The handle this device last knew itself by, for the "session lost" notice. */
export function lastKnownUsername(): string | null {
  return readAccountMarker()?.username ?? null;
}

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

  const marker = readAccountMarker();
  const { data, error } = await sb.auth.getSession();

  const decision = decideRestore(marker !== null, data.session !== null);

  if (decision === "use-session" && data.session) {
    state.session = data.session;
    state.user = data.session.user;
    state.sessionLost = false;
  } else if (decision === "report-lost") {
    // This device HAS an account but we could not restore it. Minting a fresh
    // anonymous account here is what used to orphan real accounts (see
    // ACCOUNT_MARKER_KEY). Stop, tell the UI, and let the player retry or
    // explicitly choose to start over.
    console.error(
      "[auth] stored session did not restore; refusing to replace account",
      marker?.userId,
      error ?? "(no session, no error)",
    );
    state.sessionLost = true;
    state.ready = true;
    emit();
    armRestoreRetry();
    return;
  } else {
    // Genuinely a first visit: nothing to lose, so a new anon account is right.
    if (error) console.warn("[auth] getSession failed on a fresh device", error);
    const { data: signin, error: signinErr } = await sb.auth.signInAnonymously();
    if (signinErr) {
      console.error("[auth] anonymous sign-in failed", signinErr);
    } else {
      state.session = signin.session ?? null;
      state.user = signin.user ?? null;
    }
  }

  if (state.user) {
    await refreshProfile();
    writeAccountMarker(state.user.id, state.profile?.username ?? null);
  }
  state.ready = true;
  emit();

  sb.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      state.session = session;
      state.user = session.user;
      state.sessionLost = false;
      await refreshProfile();
      writeAccountMarker(session.user.id, state.profile?.username ?? null);
      emit();
      return;
    }

    // A null session here is either a real sign-out (we cleared the marker
    // already) or a failed token refresh. In the latter case keep the marker
    // and flag the loss rather than dropping to a silent guest state.
    state.session = null;
    state.user = null;
    state.profile = null;
    if (event !== "SIGNED_OUT" && readAccountMarker()) {
      console.error(`[auth] session dropped (${event}) without a sign-out`);
      state.sessionLost = true;
      armRestoreRetry();
    }
    emit();
  });
}

/**
 * Retry a failed restore when the network comes back, and once on a timer.
 * Deliberately conservative: a restore attempt must never fall through to
 * signInAnonymously(), so it only ever calls getSession() again.
 */
let restoreRetryArmed = false;
function armRestoreRetry(): void {
  if (restoreRetryArmed) return;
  restoreRetryArmed = true;
  const attempt = (): void => void retryRestore();
  window.addEventListener("online", attempt);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") attempt();
  });
}

/**
 * Re-attempt restoring the stored session after a {@link AuthState.sessionLost}.
 * Returns true once the real account is back.
 */
export async function retryRestore(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !state.sessionLost) return false;
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session) return false;
  state.session = data.session;
  state.user = data.session.user;
  state.sessionLost = false;
  await refreshProfile();
  writeAccountMarker(data.session.user.id, state.profile?.username ?? null);
  emit();
  return true;
}

/**
 * Explicitly abandon an unrecoverable account and start over as a new player.
 *
 * This is the ONLY path that may replace a marked account with a fresh
 * anonymous one, and it exists solely so a player whose account really is gone
 * (e.g. an unplayed anon reaped by cleanup_stale_anonymous_users) is not stuck
 * on the retry screen forever. It must stay user-initiated — never automatic.
 */
export async function startFreshAccount(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  clearAccountMarker();
  state.sessionLost = false;
  state.profile = null;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) {
    console.error("[auth] fresh anonymous sign-in failed", error);
    emit();
    return;
  }
  state.session = data.session ?? null;
  state.user = data.user ?? null;
  if (state.user) {
    const profile = await refreshProfile();
    writeAccountMarker(state.user.id, profile?.username ?? null);
  }
  emit();
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
  if (state.user) writeAccountMarker(state.user.id, state.profile?.username ?? null);
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

/**
 * Generate an emailless cross-device link code for the current account.
 * Requires a claimed username (server-enforced). The code is single-use and
 * short-lived; another device redeems it via {@link redeemLinkCode} to adopt
 * this same account. See api/link-code.ts.
 */
export async function createLinkCode(): Promise<
  { ok: true; code: string; expiresAt: string } | { ok: false; reason: string }
> {
  const session = state.session;
  if (!session) return { ok: false, reason: "not signed in" };
  if (!state.profile?.username) return { ok: false, reason: "claim a username first" };
  try {
    const res = await fetch("/api/link-code", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "create", refresh_token: session.refresh_token }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; expires_at?: string; error?: string };
    if (!res.ok || !body.ok || !body.code) {
      return { ok: false, reason: linkErr(body.error ?? `http_${res.status}`) };
    }
    return { ok: true, code: body.code, expiresAt: body.expires_at ?? "" };
  } catch {
    return { ok: false, reason: "network error" };
  }
}

/**
 * Redeem a link code on this device: fetch the originating device's refresh
 * token and swap our session for theirs, so this device becomes the same
 * account (progress/skins/streak follow). The old device may need to re-link.
 */
export async function redeemLinkCode(
  raw: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "offline" };
  const code = raw.trim().toUpperCase();
  if (code.length !== 8) return { ok: false, reason: "codes are 8 characters" };
  try {
    const res = await fetch("/api/link-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "redeem", code }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; refresh_token?: string; error?: string };
    if (!res.ok || !body.ok || !body.refresh_token) {
      return { ok: false, reason: linkErr(body.error ?? `http_${res.status}`) };
    }
    const { data, error } = await sb.auth.refreshSession({ refresh_token: body.refresh_token });
    if (error || !data.session) return { ok: false, reason: "could not link (code may be stale)" };
    state.session = data.session;
    state.user = data.session.user;
    state.sessionLost = false;
    await refreshProfile();
    // This device is now a different account on purpose — re-point the marker
    // so a later restore failure reports the RIGHT account as lost.
    writeAccountMarker(data.session.user.id, state.profile?.username ?? null);
    emit();
    return { ok: true };
  } catch {
    return { ok: false, reason: "network error" };
  }
}

function linkErr(code: string): string {
  switch (code) {
    case "no_username": return "claim a username first";
    case "not_found": return "code not found";
    case "expired": return "this code expired — generate a new one";
    case "already_used": return "this code was already used";
    case "invalid_format": return "codes are 8 characters";
    default: return "couldn't link — try again";
  }
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // Clear the marker FIRST: this is a deliberate sign-out, so the initAuth()
  // below should mint a fresh anonymous account rather than report the session
  // as lost. (With the marker still set it would do the latter.)
  clearAccountMarker();
  await sb.auth.signOut();
  state.user = null;
  state.session = null;
  state.profile = null;
  state.sessionLost = false;
  emit();
  await initAuth();
}

export function authState(): Readonly<AuthState> {
  return state;
}

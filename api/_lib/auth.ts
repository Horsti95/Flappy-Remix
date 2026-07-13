import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared auth plumbing for api/ handlers, replacing ~10 copy-pasted blocks.
 *
 * Deliberately TWO helpers instead of one `requireUser(req)`: several handlers
 * run the cheap Bearer-header check before body parsing/validation and the
 * expensive `getUser` network call after it (submit-run documents why — the
 * replay validator shouldn't burn CPU for unauthenticated callers). A combined
 * helper would silently reorder those responses.
 *
 * Standard 401 labels: missing/malformed header → "unauthenticated",
 * rejected JWT → "invalid token". (Three handlers used to say "unauthorized";
 * the client's redeem-code error map accepts both during the transition.)
 */

/** The raw JWT from an `Authorization: Bearer …` header, or null. */
export function bearerJwt(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length);
}

/** Resolve a JWT to the Supabase user id, or null when the token is bad. */
export async function resolveUserId(
  admin: SupabaseClient,
  jwt: string,
): Promise<string | null> {
  const userRes = await admin.auth.getUser(jwt);
  if (userRes.error || !userRes.data.user) return null;
  return userRes.data.user.id;
}

/**
 * Playtester badge.
 *
 * Anyone whose account was created before the cutoff is a "playtester" — a
 * permanent, cross-device badge (derived from the immutable profile
 * `created_at`, so it needs no DB column, no grant step, and never expires).
 *
 * Set CUTOFF to the public launch date when it's known; everyone who played
 * during the friends-and-family beta keeps the badge forever.
 */
export const PLAYTESTER_CUTOFF = "2026-09-01T00:00:00Z";

export function isPlaytester(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && t < Date.parse(PLAYTESTER_CUTOFF);
}

import type { AchievementStats } from "./achievements";

/**
 * Collectible badges — small emblems the player earns and shows off in the
 * Gallery's badges tab, next to the server-side season / dev / playtester
 * badges (those live in social/badges.ts and are username-driven). These are
 * computed CLIENT-SIDE from the same {@link AchievementStats} counters the rest
 * of the unlock economy reads, so no DB round-trip is needed.
 *
 * A badge is earned when its `check(stats)` passes OR it has been granted out
 * of band (feedback, supporter perks) via the local grant set. Granted-only
 * badges set `check: () => false` and rely on {@link grantBadge}.
 */

export interface BadgeDef {
  id: string;
  name: string;
  /** Single emoji shown on the card. */
  emoji: string;
  /** Accent color (hex) for the card border / label. */
  color: string;
  /** How to earn it — shown while locked, unless `secret`. */
  hint: string;
  /** Prestige badges stay hidden (a mystery card) until earned. */
  secret?: boolean;
  check(stats: AchievementStats): boolean;
}

export const BADGES: BadgeDef[] = [
  // --- Granted out of band -------------------------------------------------
  {
    id: "reviewer",
    name: "reviewer",
    emoji: "🛠️",
    color: "#39ff14",
    hint: "send feedback from the account panel",
    check: (s) => s.feedbackGiven === true,
  },
  {
    id: "supporter",
    name: "supporter",
    emoji: "💛",
    color: "#facc15",
    // No in-game criterion: granted after supporting on Buy Me a Coffee
    // (delivered via a redeem code — see docs/packaging-notes.md).
    hint: "support the game on Buy Me a Coffee",
    check: () => false,
  },

  // --- Earned from play ----------------------------------------------------
  {
    id: "frequent_flyer",
    name: "frequent flyer",
    emoji: "✈️",
    color: "#7dd3fc",
    hint: "log 300 flights",
    check: (s) => s.totalGames >= 300,
  },
  {
    id: "round_the_clock",
    name: "all hours",
    emoji: "🕛",
    color: "#a78bfa",
    hint: "play 15 morning and 15 night games",
    check: (s) => s.morningGames >= 15 && s.nightGames >= 15,
  },
  {
    id: "duelist",
    name: "duelist",
    emoji: "⚔️",
    color: "#fb7185",
    hint: "win 25 challenges",
    check: (s) => s.challengeWins >= 25,
  },
  {
    id: "centurion_streak",
    name: "centurion",
    emoji: "🔥",
    color: "#fb923c",
    hint: "keep a 100-day streak",
    secret: true,
    check: (s) => s.streakDays >= 100,
  },
  {
    id: "social_butterfly",
    name: "social butterfly",
    emoji: "🦋",
    color: "#f472b6",
    hint: "10 friends and 10 challenge wins",
    secret: true,
    check: (s) => s.friendCount >= 10 && s.challengeWins >= 10,
  },
];

const BY_ID = new Map(BADGES.map((b) => [b.id, b]));

// ---- Granted badges (feedback / supporter) ---------------------------------
// A small client-side set of badge ids granted out of band. The server is the
// source of truth for supporter status (redeemed code); this mirrors it
// locally so the gallery can render it offline-first.

const GRANT_KEY = "pflug.badgeGrants.v1";

function loadGrants(): Set<string> {
  try {
    const raw = localStorage.getItem(GRANT_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Mark a badge as granted (idempotent). Unknown ids are ignored. */
export function grantBadge(id: string): void {
  if (!BY_ID.has(id)) return;
  try {
    const set = loadGrants();
    if (set.has(id)) return;
    set.add(id);
    localStorage.setItem(GRANT_KEY, JSON.stringify([...set]));
  } catch {
    /* localStorage blocked — badge just won't persist */
  }
}

export function isBadgeGranted(id: string): boolean {
  return loadGrants().has(id);
}

// Lab mode unlocks every badge for the picker/preview tooling, mirroring the
// other cosmetic catalogs.
let labMode = false;
export function setBadgeLabMode(on: boolean): void {
  labMode = on;
}

/** Whether a badge is earned for the given stats (counter OR grant OR lab). */
export function badgeUnlocked(b: BadgeDef, stats: AchievementStats): boolean {
  return labMode || b.check(stats) || isBadgeGranted(b.id);
}

/** Earned badges only. */
export function earnedBadges(stats: AchievementStats): BadgeDef[] {
  return BADGES.filter((b) => badgeUnlocked(b, stats));
}

/** Not-yet-earned badges that aren't secret — the "what's next" teasers. */
export function lockedVisibleBadges(stats: AchievementStats): BadgeDef[] {
  return BADGES.filter((b) => !badgeUnlocked(b, stats) && !b.secret);
}

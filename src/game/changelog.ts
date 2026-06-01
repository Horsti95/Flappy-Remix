/**
 * "What's new" patch notes.
 *
 * A hand-maintained changelog shown once per update: we store the last
 * version the player saw in localStorage and, on launch, if the newest entry
 * is newer, show the modal then record it. Version-based (not per-login) so
 * each player sees each update exactly once — no nagging, no push, dismissible.
 * Bump APP_VERSION + prepend an entry when shipping notable changes.
 */

export const APP_VERSION = "0.2.0";

export interface ChangeEntry {
  version: string;
  date: string;
  title: string;
  notes: string[];
}

// Newest first.
export const CHANGELOG: ChangeEntry[] = [
  {
    version: "0.2.0",
    date: "2026-06-01",
    title: "Flock update",
    notes: [
      "New origami toucan shape (score 40 to unlock) — a real sprite that tints to your color.",
      "Goals: a big new list of things to chase in the gallery's quests tab.",
      "Friend duels now flex the sender's shape + sky; challenge a friend to ranked too.",
      "Daily best-of-3, visual daily weather (night / sunset / blinding sun / rain).",
      "Public profiles, season badges, a 3-way leaderboard, and a practice mode.",
      "Support the game with a tip — thank you! ☕",
    ],
  },
];

const SEEN_KEY = "pflug.changelogSeen.v1";

/** Compare dotted semver-ish strings ("0.2.0"). Returns a>b ? 1 : a<b ? -1 : 0. */
function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function lastSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markChangelogSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch {
    /* localStorage blocked — show again next time, harmless */
  }
}

/**
 * Entries newer than what the player last saw. Empty when up to date OR on a
 * player's very first run (we don't ambush newcomers with a changelog —
 * mark-seen at first launch instead, handled by the caller).
 */
export function unseenChanges(): ChangeEntry[] {
  const seen = lastSeenVersion();
  if (seen === null) return []; // first run — nothing to "update" about
  return CHANGELOG.filter((e) => cmpVersion(e.version, seen) > 0);
}

export function isFirstRun(): boolean {
  return lastSeenVersion() === null;
}

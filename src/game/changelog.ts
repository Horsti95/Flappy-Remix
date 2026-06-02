/**
 * "What's new" patch notes.
 *
 * A hand-maintained changelog shown once per update: we store the last
 * version the player saw in localStorage and, on launch, if the newest entry
 * is newer, show the modal then record it. Version-based (not per-login) so
 * each player sees each update exactly once — no nagging, no push, dismissible.
 * Bump APP_VERSION + prepend an entry when shipping notable changes.
 */

export const APP_VERSION = "0.9.0";

export interface ChangeEntry {
  version: string;
  date: string;
  title: string;
  notes: string[];
}

// Newest first.
export const CHANGELOG: ChangeEntry[] = [
  {
    version: "0.9.0",
    date: "2026-06-02",
    title: "Lifetime miles",
    notes: [
      "Six new milestones for total points scored across all your runs — 500 all the way to 100,000.",
      "Fixed the disc that appeared behind some legendary planes; the glow now only shows underwater, where it reads as a diver's light.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-06-02",
    title: "Goals, colors & a history book",
    notes: [
      "Quests folded into one place: everything to chase now lives under the Goals tab.",
      "Instant rewards for your 2nd and 3rd games — a warm welcome for newcomers.",
      "Tint your flap effect — pick from 16 colors in the gallery's effects tab.",
      "Patch notes never expire: read the full history any time from Settings → What's new.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-02",
    title: "Rewards that pop",
    notes: [
      "Unlocking anything now shows a little celebration — not just color skins.",
      "New submarine shape (play 60 games).",
      "Fairer pillars: no more brutal top-bottom-top zigzags every gate.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-06-02",
    title: "Living worlds",
    notes: [
      "Interactive backgrounds: in Ocean & Space the scene changes as you climb — every 25 points you descend deeper / soar higher, with a label and the sky shifting. Look for the 'interactive' tag in the gallery.",
      "Butterfly now banks into its flight; ocean light shafts glow warm.",
      "Casual runs feel fresher — gap tightness varies run to run.",
      "Cleaner buttons, grouped Settings, and a tidier Account page.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-01",
    title: "New worlds",
    notes: [
      "Two new themes: dive into the Ocean (with bubbles) or fly through Space (starfield).",
      "Set challenge-ghost transparency in Settings — turn it down or fully off.",
      "Settings tidy-up: menu look + feedback now live in Settings.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-06-01",
    title: "Practice & weather",
    notes: [
      "New origami crane shape (5-day streak) — another tintable sprite.",
      "Practice mode now has infinite lives — fly forever, nothing can end your run but you.",
      "Two new daily challenges: thick fog and blinding sun, the toughest weather yet.",
      "Send feedback right from the menu.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-01",
    title: "Style update",
    notes: [
      "Pick your pillar style — solid, stone, neon, or glass. Glass is see-through (and a harder daily!).",
      "Legendary skins now glow.",
      "Friend requests: add someone and they accept — no more instant friends.",
      "Patch notes (you're reading them) so you never miss what's new.",
    ],
  },
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

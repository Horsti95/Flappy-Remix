import { lockedUnlockables, type UnlockStats } from "./unlockables";

/**
 * "Next unlock" breadcrumb for the death screen — ONE line, nearest goal
 * first (goal-gradient: visible proximity to a reward is the cheapest
 * retention lever there is; devlog/0005).
 *
 * Unlock criteria are opaque check(stats) functions, so distance is found
 * by probing: bump one axis of the stats and see what unlocks. Probed in
 * effort order — games are the cheapest ask, then a score push, then
 * streak days. Secret items never get a breadcrumb.
 */

export interface NextUnlockHint {
  name: string;
  /** e.g. "2 more games", "reach score 60", "3 more streak days" */
  effort: string;
}

const MAX_GAMES_PROBE = 30;
const MAX_SCORE_PROBE = 100;
const MAX_STREAK_PROBE = 30;

export function nextUnlockHint(stats: UnlockStats): NextUnlockHint | null {
  const locked = lockedUnlockables(stats).filter((u) => !u.secret);
  if (locked.length === 0) return null;
  const firstNewlyUnlocked = (probed: UnlockStats): string | null => {
    const stillLocked = new Set(lockedUnlockables(probed).map((u) => u.uid));
    for (const u of locked) if (!stillLocked.has(u.uid)) return u.name;
    return null;
  };

  for (let k = 1; k <= MAX_GAMES_PROBE; k++) {
    const name = firstNewlyUnlocked({ ...stats, totalGames: stats.totalGames + k });
    if (name) return { name, effort: k === 1 ? "1 more game" : `${k} more games` };
  }
  for (let d = 1; d <= MAX_SCORE_PROBE; d++) {
    const name = firstNewlyUnlocked({ ...stats, bestScore: stats.bestScore + d });
    if (name) return { name, effort: `reach score ${stats.bestScore + d}` };
  }
  for (let d = 1; d <= MAX_STREAK_PROBE; d++) {
    const name = firstNewlyUnlocked({ ...stats, streakDays: stats.streakDays + d });
    if (name) return { name, effort: d === 1 ? "1 more streak day" : `${d} more streak days` };
  }
  return null;
}

/**
 * Pilot XP — the per-run progression beat (devlog/0005, ROADMAP Appendix A).
 *
 * Design rules (owner-decided):
 *  - XP is FLAT, not per-gate-escalating: levels measure time + dedication;
 *    raw skill is already paid by the score-gated unlock ladders. Weak
 *    players progress every session; strong players still earn more
 *    (higher score = more base XP) but linearly.
 *  - One-time in-run milestone bonuses at gates 50 / 100 / 250.
 *  - Curve: xp to clear level L = 100 × 1.12^(L−1) — level 2 lands inside
 *    the first session, ~level 60 is a long-haul soft cap.
 *  - Practice runs grant nothing (they're untracked everywhere else too).
 *
 * Client-side (localStorage) like the rest of the unlock economy; server
 * sync can come later with the same totals.
 */

export interface RunXpInput {
  score: number;
  mode: "casual" | "daily" | "challenge" | "challenge-create" | "ranked" | "race";
  /** Strictly better than the previous best single-run score. */
  isNewPb: boolean;
}

export interface XpBreakdown {
  base: number;
  finish: number;
  daily: number;
  newPb: number;
  milestones: number;
  total: number;
}

export interface LevelState {
  level: number;
  /** XP accumulated inside the current level. */
  intoLevel: number;
  /** XP needed to clear the current level. */
  toNext: number;
  totalXp: number;
}

export interface RunXpResult {
  breakdown: XpBreakdown;
  before: LevelState;
  after: LevelState;
  leveledUp: boolean;
}

const STORAGE_KEY = "pflug.xp.v1";
const SOFT_CAP_LEVEL = 99;

export function xpForRun(run: RunXpInput): XpBreakdown {
  const base = Math.max(0, Math.floor(run.score));
  const finish = 5;
  const daily = run.mode === "daily" ? 25 : 0;
  const newPb = run.isNewPb ? 50 : 0;
  const milestones =
    (run.score >= 50 ? 25 : 0) + (run.score >= 100 ? 50 : 0) + (run.score >= 250 ? 100 : 0);
  return { base, finish, daily, newPb, milestones, total: base + finish + daily + newPb + milestones };
}

/** XP required to clear the given level (level 1 → 100, growing 12%/level). */
export function xpToClearLevel(level: number): number {
  return Math.round(100 * Math.pow(1.12, Math.max(0, level - 1)));
}

export function levelFromTotalXp(totalXp: number): LevelState {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (level < SOFT_CAP_LEVEL && remaining >= xpToClearLevel(level)) {
    remaining -= xpToClearLevel(level);
    level++;
  }
  return { level, intoLevel: remaining, toNext: xpToClearLevel(level), totalXp: Math.max(0, Math.floor(totalXp)) };
}

export function loadTotalXp(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(JSON.parse(raw)?.xp);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function saveTotalXp(xp: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ xp }));
  } catch {
    /* localStorage blocked — XP just doesn't persist */
  }
}

/** Apply a finished run's XP and persist. Pure callers can use xpForRun. */
export function addRunXp(run: RunXpInput): RunXpResult {
  const breakdown = xpForRun(run);
  const beforeTotal = loadTotalXp();
  const afterTotal = beforeTotal + breakdown.total;
  saveTotalXp(afterTotal);
  const before = levelFromTotalXp(beforeTotal);
  const after = levelFromTotalXp(afterTotal);
  return { breakdown, before, after, leveledUp: after.level > before.level };
}

/**
 * Pilot XP — the per-run progression beat (devlog/0005, ROADMAP Appendix A).
 *
 * Design rules (owner-decided):
 *  - XP is FLAT, not per-gate-escalating: levels measure time + dedication;
 *    raw skill is already paid by the score-gated unlock ladders. Weak
 *    players progress every session; strong players still earn more
 *    (higher score = more base XP) but linearly.
 *  - One-time in-run milestone bonuses at gates 50 / 100 / 250.
 *  - Curve: xp to clear level L = 100 × 1.12^(L−1), but CAPPED FLAT at
 *    {@link XP_FLAT_PER_LEVEL} once the ramp reaches it (~level 17). Early
 *    levels stay quick and celebratory; from the cap on, every level is a
 *    steady ~20–30 games for a typical player, so the high tiers (and the
 *    procedural colour wildcards past level 40) are actually reachable rather
 *    than a 2,000-run grind.
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
// Per-level XP cost stops growing here and stays flat forever after. ~600 XP is
// roughly 20–30 games for a typical player; the 12% ramp reaches it near level
// 17, so the transition is smooth (no jump). Changing this recomputes every
// player's level from their existing XP total (levels get cheaper → most
// players' displayed level goes UP), which is deliberate.
const XP_FLAT_PER_LEVEL = 600;

export function xpForRun(run: RunXpInput): XpBreakdown {
  const base = Math.max(0, Math.floor(run.score));
  const finish = 5;
  const daily = run.mode === "daily" ? 25 : 0;
  const newPb = run.isNewPb ? 50 : 0;
  const milestones =
    (run.score >= 50 ? 25 : 0) + (run.score >= 100 ? 50 : 0) + (run.score >= 250 ? 100 : 0);
  return { base, finish, daily, newPb, milestones, total: base + finish + daily + newPb + milestones };
}

/** XP required to clear the given level: level 1 → 100, growing 12%/level until
 *  it hits the flat cap (~level 17), then a steady {@link XP_FLAT_PER_LEVEL}. */
export function xpToClearLevel(level: number): number {
  return Math.min(XP_FLAT_PER_LEVEL, Math.round(100 * Math.pow(1.12, Math.max(0, level - 1))));
}

export function levelFromTotalXp(totalXp: number): LevelState {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (level < SOFT_CAP_LEVEL && remaining >= xpToClearLevel(level)) {
    remaining -= xpToClearLevel(level);
    level++;
  }
  const toNext = xpToClearLevel(level);
  // At the soft cap there is no further level, so leftover XP would otherwise
  // overflow past `toNext` (e.g. "46525 / 600 XP"). Clamp it so the bar reads
  // as a clean, full "maxed" state instead.
  const intoLevel = level >= SOFT_CAP_LEVEL ? Math.min(remaining, toNext) : remaining;
  return { level, intoLevel, toNext, totalXp: Math.max(0, Math.floor(totalXp)) };
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

/**
 * Overwrite the locally stored total with the server's (server is the
 * authority once a run is accepted; the local copy stays for offline play).
 */
export function syncTotalXp(serverTotal: number): void {
  const total = Number.isFinite(serverTotal) && serverTotal >= 0 ? Math.floor(serverTotal) : 0;
  if (total !== loadTotalXp()) saveTotalXp(total);
}

/**
 * Account levels that are multiples of 5 crossed when going from
 * `beforeTotal` XP to `afterTotal` XP — the levels that mint a color skin.
 * Returned ascending; empty when no multiple-of-5 boundary was crossed.
 */
export function levelsCrossedEvery5(beforeTotal: number, afterTotal: number): number[] {
  const before = levelFromTotalXp(beforeTotal).level;
  const after = levelFromTotalXp(afterTotal).level;
  const out: number[] = [];
  for (let l = Math.floor(before / 5) * 5 + 5; l <= after; l += 5) out.push(l);
  return out;
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

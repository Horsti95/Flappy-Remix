/**
 * Per-day record of your daily attempts.
 *
 * The app previously kept only two numbers per day — `pflug.dailyBest.<date>`
 * and `pflug.dailyAttempts.<date>` — which is enough to enforce the
 * best-of-three cap but not enough to show what actually happened. The daily
 * results screen (ui/daily-aftermath) needs the individual scores, in order,
 * so it can show the shape of your day rather than just its maximum.
 *
 * Stored as ONE key holding a small map of date → scores, pruned to the last
 * {@link KEEP_DAYS} days. One key rather than one-per-day so the pruning is
 * actually possible; the old scheme leaked a localStorage entry per day
 * forever.
 */

const KEY = "pflug.dailyHistory.v1";
/** Keep a fortnight: enough to look back, small enough to never matter. */
export const KEEP_DAYS = 14;

/** date (YYYY-MM-DD) → attempt scores, in the order they were played. */
export type DailyHistoryMap = Record<string, number[]>;

// ---------------------------------------------------------------------------
// Pure core. Kept separate from storage so the rules are unit-testable without
// a browser, and so a corrupt localStorage value can never throw into the app.
// ---------------------------------------------------------------------------

/** Coerce anything we might read back into a valid history map. */
export function sanitizeHistory(raw: unknown): DailyHistoryMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: DailyHistoryMap = {};
  for (const [date, scores] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!Array.isArray(scores)) continue;
    const clean = scores
      .filter((s): s is number => typeof s === "number" && Number.isFinite(s) && s >= 0)
      .map((s) => Math.floor(s));
    if (clean.length > 0) out[date] = clean;
  }
  return out;
}

/** Drop everything older than the newest {@link KEEP_DAYS} dates present. */
export function pruneHistory(map: DailyHistoryMap, keep = KEEP_DAYS): DailyHistoryMap {
  const dates = Object.keys(map).sort().slice(-keep);
  const out: DailyHistoryMap = {};
  for (const d of dates) out[d] = map[d];
  return out;
}

/**
 * How many attempts a date has used.
 *
 * Takes the MAXIMUM of the new history length and any legacy counter, so
 * upgrading cannot hand a player extra attempts: someone who had already used
 * 2 attempts today under the old scheme has an empty history array, and
 * trusting that alone would reset them to 0.
 */
export function attemptsUsedFrom(historyLength: number, legacyCount: number): number {
  return Math.max(historyLength, Math.max(0, Math.floor(legacyCount) || 0));
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function read(): DailyHistoryMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeHistory(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function write(map: DailyHistoryMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pruneHistory(map)));
  } catch {
    /* localStorage full or blocked — the cap is still enforced server-side */
  }
}

/** Scores for a date, in play order. Empty when nothing is recorded. */
export function dailyAttempts(date: string): number[] {
  return read()[date] ?? [];
}

/** Append a finished daily attempt. */
export function recordDailyAttempt(date: string, score: number): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const map = read();
  const list = map[date] ?? [];
  list.push(Math.max(0, Math.floor(score)));
  map[date] = list;
  write(map);
}

/** Legacy per-day counter, kept only so an upgrade can't loosen the cap. */
function legacyAttemptCount(date: string): number {
  try {
    return Number(localStorage.getItem(`pflug.dailyAttempts.${date}`) ?? "0") || 0;
  } catch {
    return 0;
  }
}

/** Attempts used for a date — the value the cap should be checked against. */
export function dailyAttemptsUsed(date: string): number {
  return attemptsUsedFrom(dailyAttempts(date).length, legacyAttemptCount(date));
}

/** Best score recorded for a date, or 0. */
export function dailyBest(date: string): number {
  const list = dailyAttempts(date);
  if (list.length === 0) {
    // Fall back to the legacy best key for days played before this existed.
    try {
      return Number(localStorage.getItem(`pflug.dailyBest.${date}`) ?? "0") || 0;
    } catch {
      return 0;
    }
  }
  return Math.max(...list);
}

/**
 * Did a submitted run actually count as a daily attempt?
 *
 * Only such runs belong in the history above, because the history is what the
 * results screen shows AND what the player shares. A run the server rejected
 * (wrong_daily_seed, stale_daily_date, replay_theft, duplicate_run) or demoted
 * past the best-of-3 cap did not count, and showing it — or putting it in a
 * block sent to a friend — would be a lie.
 *
 * Takes the fields it needs rather than the whole SubmitResult, so this stays
 * a pure decision with no import cycle back into the social layer.
 */
export interface DailyVerdict {
  /** null when there is no backend configured at all. */
  result: {
    accepted: boolean;
    reason?: string;
    mode?: string;
    daily_over_cap?: boolean;
  } | null;
}

export function countedAsDaily({ result }: DailyVerdict): boolean {
  // No backend: local play is all there is, so local history should reflect
  // what was actually played.
  if (result == null) return true;
  // Queued while offline — it will be submitted when the network returns.
  // Recorded optimistically; the alternative is an offline player never
  // seeing their own results.
  if (result.reason === "queued_offline") return true;
  if (!result.accepted) return false;
  // The server reports what it recorded (added with submit_run_tx). An API
  // deployed before that doesn't send `mode`, so fall back to the over-cap
  // flag, which has been in the response for far longer.
  if (result.mode) return result.mode === "daily";
  return result.daily_over_cap !== true;
}

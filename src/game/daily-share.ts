/**
 * The daily's shareable artifact.
 *
 * Wordle's growth came from a block of emoji you could paste anywhere: it
 * showed the SHAPE of someone's attempt without spoiling the answer, rendered
 * identically in every app, and needed no image pipeline. This is the same
 * idea for a score game — three bars, one per attempt, scaled against your
 * best of the day.
 *
 * Everything here is pure so the exact output is pinned by tests: a share
 * string that renders differently on one platform, or leaks a spoiler, is not
 * something you want to discover from players.
 */
// NOTE: this is the DAILY DIFFICULTY tier from daily-twist ("easy" ..
// "extreme"), not the cosmetic rarity tier in tiers.ts, which is also
// called Tier and also exports TIER_LABEL. Importing the wrong one
// typechecks in isolation and mislabels every shared result.
import { TIER_LABEL, type Tier } from "./daily-twist";

/** Cells per bar. 10 keeps a line comfortably inside a chat bubble. */
export const BAR_CELLS = 10;

const CELL = {
  /** The best attempt of the day. */
  best: "🟩",
  /** Within half of the best — a decent run. */
  good: "🟨",
  /** Well off the pace. */
  weak: "🟥",
  /** Unfilled remainder of a bar. */
  empty: "⬜",
  /** Scored nothing at all. */
  zero: "💀",
} as const;

/** One badge per difficulty band, ramping in severity. */
const TIER_EMOJI: Record<Tier, string> = {
  easy: "🟢",
  medium: "🔵",
  hard: "🟠",
  super_hard: "🔴",
  extreme: "⛈️",
};

export interface DailyShareInput {
  /** YYYY-MM-DD (UTC), the daily's own date. */
  date: string;
  /** Attempt scores in play order. 1-3 entries; fewer is fine. */
  attempts: number[];
  /** The day's difficulty band. */
  tier: Tier;
  /** The day's modifier name(s), e.g. "mirror day". Optional flavour. */
  twist?: string | null;
  /** Current daily streak, shown only when it's worth showing. */
  streakDays?: number;
  /** Absolute URL to append. Omit to leave it off (tests, previews). */
  url?: string;
}

/**
 * One bar for one attempt.
 *
 * Length is the score relative to the day's best, so the bars always span the
 * full width for your best run and shrink from there — the reader sees the
 * spread of your three tries at a glance, without needing to compare numbers.
 */
export function attemptBar(score: number, best: number): string {
  if (score <= 0) return CELL.zero + CELL.empty.repeat(BAR_CELLS - 1);
  const ratio = best > 0 ? score / best : 1;
  // At least one cell for any non-zero score, so a bad run is still visible.
  const filled = Math.max(1, Math.min(BAR_CELLS, Math.round(ratio * BAR_CELLS)));
  const glyph = score >= best ? CELL.best : ratio >= 0.5 ? CELL.good : CELL.weak;
  return glyph.repeat(filled) + CELL.empty.repeat(BAR_CELLS - filled);
}

/** "2026-09-12" → "12 Sep" — short, unambiguous, locale-independent. */
export function shortDate(dateUtc: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateUtc);
  if (!m) return dateUtc;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateUtc;
  return `${Number(m[3])} ${months[monthIdx]}`;
}

/**
 * The full pasteable block.
 *
 * Deliberately plain text + emoji only: no markdown, no image, nothing that
 * degrades when pasted into WhatsApp, Discord, X or a group chat.
 */
export function dailyShareText(input: DailyShareInput): string {
  const attempts = input.attempts.filter((s) => Number.isFinite(s) && s >= 0).slice(0, 3);
  const best = attempts.length > 0 ? Math.max(...attempts) : 0;

  const header = `Glide daily · ${shortDate(input.date)} · ${TIER_EMOJI[input.tier]} ${TIER_LABEL[input.tier]}`;
  const lines: string[] = [header];
  if (input.twist) lines.push(input.twist);
  lines.push("");

  if (attempts.length === 0) {
    lines.push("no attempts yet");
  } else {
    for (const score of attempts) {
      lines.push(`${attemptBar(score, best)} ${score}`);
    }
  }

  const footerBits: string[] = [];
  if (attempts.length > 0) footerBits.push(`best ${best}`);
  // A 1-day streak is just "you played today" — not worth a line.
  if ((input.streakDays ?? 0) > 1) footerBits.push(`🔥 ${input.streakDays}`);
  if (footerBits.length > 0) {
    lines.push("");
    lines.push(footerBits.join(" · "));
  }

  if (input.url) lines.push(input.url);
  return lines.join("\n");
}

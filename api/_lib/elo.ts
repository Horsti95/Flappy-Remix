// Standard ELO with K=32, applied per-match (not per-round).
// Result is 1 (win) / 0.5 (draw) / 0 (loss) from A's perspective.

export const K_FACTOR = 32;
export const SOFT_RESET_PULL_TO = 1200;
export const SOFT_RESET_FACTOR = 0.25;

export interface MatchOutcome {
  aWins: number;
  bWins: number;
  draws: number;
}

export type Result = "a_win" | "b_win" | "draw";

export function tallyOutcome(aScores: readonly number[], bScores: readonly number[]): MatchOutcome {
  const len = Math.min(aScores.length, bScores.length);
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  for (let i = 0; i < len; i++) {
    if (aScores[i] > bScores[i]) aWins++;
    else if (bScores[i] > aScores[i]) bWins++;
    else draws++;
  }
  return { aWins, bWins, draws };
}

export function decideResult(o: MatchOutcome): Result {
  if (o.aWins > o.bWins) return "a_win";
  if (o.bWins > o.aWins) return "b_win";
  return "draw";
}

export function isBestOfThreeComplete(o: MatchOutcome, roundsPlayed: number): boolean {
  // Early stop: any player at 2 wins is decided. Otherwise need 3 rounds.
  if (o.aWins >= 2 || o.bWins >= 2) return true;
  return roundsPlayed >= 3;
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function applyElo(ratingA: number, ratingB: number, result: Result, k = K_FACTOR): { a: number; b: number } {
  const ea = expectedScore(ratingA, ratingB);
  const eb = 1 - ea;
  const sa = result === "a_win" ? 1 : result === "draw" ? 0.5 : 0;
  const sb = 1 - sa;
  return {
    a: Math.round(ratingA + k * (sa - ea)),
    b: Math.round(ratingB + k * (sb - eb)),
  };
}

// Flat winner-only bonus scaled by aggregate score margin across the match.
// Highest matching tier wins. Loser and draws get nothing.
export const MARGIN_BONUS_TIERS: ReadonlyArray<readonly [number, number]> = [
  [50, 3],
  [25, 2],
  [5, 1],
];

export function marginBonus(aTotal: number, bTotal: number, result: Result): { a: number; b: number } {
  if (result === "draw") return { a: 0, b: 0 };
  const margin = Math.abs(aTotal - bTotal);
  let bonus = 0;
  for (const [threshold, value] of MARGIN_BONUS_TIERS) {
    if (margin >= threshold) {
      bonus = value;
      break;
    }
  }
  return result === "a_win" ? { a: bonus, b: 0 } : { a: 0, b: bonus };
}

export function softReset(rating: number): number {
  return Math.round(SOFT_RESET_PULL_TO + (rating - SOFT_RESET_PULL_TO) * SOFT_RESET_FACTOR);
}

export function ratingWindow(elapsedSec: number): number {
  // Initial ±100, widens after 5 minutes per the spec; effectively
  // unbounded by 15.
  if (elapsedSec < 300) return 100;
  if (elapsedSec < 600) return 200;
  if (elapsedSec < 900) return 400;
  return Number.POSITIVE_INFINITY;
}

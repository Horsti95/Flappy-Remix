import { describe, it, expect } from "vitest";
import { rankRows, type LeaderboardRow } from "../src/social/leaderboard";

function row(p: Partial<LeaderboardRow>): LeaderboardRow {
  return {
    run_id: p.run_id ?? Math.random().toString(36).slice(2),
    user_id: p.user_id ?? null,
    username: p.username ?? null,
    score: p.score ?? 0,
    created_at: p.created_at ?? "2026-01-01T00:00:00Z",
    daily_date: p.daily_date ?? null,
    mode: p.mode ?? null,
    shape: p.shape ?? null,
    body: p.body ?? null,
    accent: p.accent ?? null,
    skin_rarity: p.skin_rarity ?? null,
  };
}

describe("rankRows", () => {
  it("sorts by score descending regardless of input order", () => {
    const out = rankRows([
      row({ user_id: "a", score: 11 }),
      row({ user_id: "b", score: 35 }),
      row({ user_id: "c", score: 20 }),
    ]);
    expect(out.map((r) => r.score)).toEqual([35, 20, 11]);
  });

  it("keeps only the best run per user", () => {
    const out = rankRows([
      row({ user_id: "a", score: 10 }),
      row({ user_id: "a", score: 42 }),
      row({ user_id: "a", score: 7 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].score).toBe(42);
  });

  it("breaks score ties by earliest created_at", () => {
    const out = rankRows([
      row({ user_id: "a", score: 50, created_at: "2026-02-02T00:00:00Z" }),
      row({ user_id: "b", score: 50, created_at: "2026-01-01T00:00:00Z" }),
    ]);
    expect(out.map((r) => r.user_id)).toEqual(["b", "a"]);
  });

  it("never collapses anonymous (null user_id) rows together", () => {
    const out = rankRows([
      row({ user_id: null, score: 5 }),
      row({ user_id: null, score: 8 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.score)).toEqual([8, 5]);
  });
});

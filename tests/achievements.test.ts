import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  getNewlyUnlocked,
  getUnlockedAchievements,
  updateStatsAfterRun,
  updateRankedMatchStats,
  type AchievementStats,
} from "../src/game/achievements";
import { FLAP_FX_OPTIONS } from "../src/game/flap-fx";
import { FLAP_SOUND_OPTIONS } from "../src/game/sfx";

const EMPTY: AchievementStats = {
  totalGames: 0,
  bestScore: 0,
  totalScore: 0,
  streakDays: 0,
  bestScoreDaily: 0,
  hardDailyBest: 0,
  superHardDailyBest: 0,
  nightGames: 0,
  morningGames: 0,
  challengeWins: 0,
  dailyStreakDays: 0,
  friendCount: 0,
  lateNightGames: 0,
  minimalistDone: false,
  runsOver100: 0,
  consecutiveUnder100: 0,
  consecutiveOver50: 0,
  bestRankedTotal: 0,
  bestRankedFloor: 0,
};

describe("achievements", () => {
  it("all ids are unique", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fresh player has no unlocks except first_flight after 1 game", () => {
    expect(getUnlockedAchievements(EMPTY)).toEqual([]);
    const after = updateStatsAfterRun(EMPTY, { score: 3, mode: "casual" });
    const unlocked = getUnlockedAchievements(after);
    expect(unlocked.map((a) => a.id)).toContain("first_flight");
  });

  it("bronze_pilot unlocks at score 50", () => {
    const s = { ...EMPTY, totalGames: 10, bestScore: 49 };
    expect(getUnlockedAchievements(s).map((a) => a.id)).not.toContain("bronze_pilot");
    const after = updateStatsAfterRun(s, { score: 50, mode: "casual" });
    expect(getUnlockedAchievements(after).map((a) => a.id)).toContain("bronze_pilot");
  });

  it("gold_legend unlocks at score 100", () => {
    const s = { ...EMPTY, totalGames: 50, bestScore: 99 };
    expect(getUnlockedAchievements(s).map((a) => a.id)).not.toContain("gold_legend");
    const s2 = { ...s, bestScore: 100 };
    expect(getUnlockedAchievements(s2).map((a) => a.id)).toContain("gold_legend");
  });

  it("weekender unlocks at 7-day streak", () => {
    const s = { ...EMPTY, streakDays: 6 };
    expect(getUnlockedAchievements(s).map((a) => a.id)).not.toContain("weekender");
    const s2 = { ...s, streakDays: 7 };
    expect(getUnlockedAchievements(s2).map((a) => a.id)).toContain("weekender");
  });

  it("storm_survivor unlocks at hard daily best 25", () => {
    const s = { ...EMPTY, hardDailyBest: 24 };
    expect(getUnlockedAchievements(s).map((a) => a.id)).not.toContain("storm_survivor");
    const s2 = { ...s, hardDailyBest: 25 };
    expect(getUnlockedAchievements(s2).map((a) => a.id)).toContain("storm_survivor");
  });

  it("kinda_game_dev unlocks only once feedback is given", () => {
    const dev = ACHIEVEMENTS.find((a) => a.id === "kinda_game_dev");
    expect(dev).toBeDefined();
    expect(dev!.check(EMPTY)).toBe(false);
    expect(dev!.check({ ...EMPTY, feedbackGiven: true })).toBe(true);
    // It's a secret reward — hidden until earned.
    expect(dev!.secret).toBe(true);
  });

  it("getNewlyUnlocked detects transitions", () => {
    const before = { ...EMPTY, totalGames: 0 };
    const after = updateStatsAfterRun(before, { score: 5, mode: "casual" });
    const newOnes = getNewlyUnlocked(before, after);
    expect(newOnes.map((a) => a.id)).toContain("first_flight");
    expect(newOnes.length).toBeGreaterThan(0);
  });

  it("updateStatsAfterRun tracks night games", () => {
    const hour = new Date().getHours();
    const after = updateStatsAfterRun(EMPTY, { score: 5, mode: "casual" });
    if (hour >= 22 || hour < 4) {
      expect(after.nightGames).toBe(1);
    } else {
      expect(after.nightGames).toBe(0);
    }
  });

  it("updateStatsAfterRun tracks daily streak for on_fire", () => {
    let s = EMPTY;
    for (let i = 0; i < 5; i++) {
      s = updateStatsAfterRun(s, { score: 25, mode: "daily", tier: "medium" });
    }
    expect(s.dailyStreakDays).toBe(5);
    expect(s.bestScoreDaily).toBe(25);
    expect(getUnlockedAchievements(s).map((a) => a.id)).toContain("on_fire");
  });

  it("minimalist unlocks on a 25+ run with under 80 taps and latches", () => {
    const lean = updateStatsAfterRun(EMPTY, { score: 25, mode: "casual", inputCount: 79 });
    expect(getUnlockedAchievements(lean).map((a) => a.id)).toContain("minimalist");
    // A later tap-heavy run must not revoke it.
    const after = updateStatsAfterRun(lean, { score: 30, mode: "casual", inputCount: 200 });
    expect(getUnlockedAchievements(after).map((a) => a.id)).toContain("minimalist");
  });

  it("minimalist stays locked when taps >= 80 or score < 25", () => {
    const tappy = updateStatsAfterRun(EMPTY, { score: 40, mode: "casual", inputCount: 120 });
    expect(getUnlockedAchievements(tappy).map((a) => a.id)).not.toContain("minimalist");
    const lowScore = updateStatsAfterRun(EMPTY, { score: 10, mode: "casual", inputCount: 5 });
    expect(getUnlockedAchievements(lowScore).map((a) => a.id)).not.toContain("minimalist");
    // No tap data available → can't earn it.
    const noData = updateStatsAfterRun(EMPTY, { score: 99, mode: "casual" });
    expect(getUnlockedAchievements(noData).map((a) => a.id)).not.toContain("minimalist");
  });

  it("tracks lifetime runs over 100 (centurion)", () => {
    let s = EMPTY;
    for (let i = 0; i < 5; i++) {
      s = updateStatsAfterRun(s, { score: 101, mode: "casual" });
    }
    expect(s.runsOver100).toBe(5);
    expect(getUnlockedAchievements(s).map((a) => a.id)).toContain("centurion");
  });

  it("tracks a 3-run sub-100 streak (bridesmaid) and resets on a 100+", () => {
    let s = updateStatsAfterRun(EMPTY, { score: 90, mode: "casual" });
    s = updateStatsAfterRun(s, { score: 99, mode: "casual" });
    expect(getUnlockedAchievements(s).map((a) => a.id)).not.toContain("bridesmaid");
    s = updateStatsAfterRun(s, { score: 10, mode: "casual" });
    expect(getUnlockedAchievements(s).map((a) => a.id)).toContain("bridesmaid");
    // A 100+ run breaks the streak.
    const after = updateStatsAfterRun(s, { score: 150, mode: "casual" });
    expect(after.consecutiveUnder100).toBe(0);
  });

  it("tracks a 20-run over-50 streak (metronome) and resets on a <=50", () => {
    let s = EMPTY;
    for (let i = 0; i < 20; i++) s = updateStatsAfterRun(s, { score: 51, mode: "casual" });
    expect(s.consecutiveOver50).toBe(20);
    expect(getUnlockedAchievements(s).map((a) => a.id)).toContain("metronome");
    const after = updateStatsAfterRun(s, { score: 50, mode: "casual" });
    expect(after.consecutiveOver50).toBe(0);
  });

  it("ascendant unlocks at 12,345 lifetime points", () => {
    const s = { ...EMPTY, totalScore: 12344 };
    expect(getUnlockedAchievements(s).map((a) => a.id)).not.toContain("points_12345");
    const s2 = { ...EMPTY, totalScore: 12345 };
    expect(getUnlockedAchievements(s2).map((a) => a.id)).toContain("points_12345");
  });

  it("ranked match total unlocks (contender/challenger/grandmaster)", () => {
    const s = updateRankedMatchStats(EMPTY, [120, 120, 120]); // total 360
    const ids = getUnlockedAchievements(s).map((a) => a.id);
    expect(ids).toContain("ranked_total_100");
    expect(ids).toContain("ranked_total_300");
    expect(ids).not.toContain("ranked_total_500");
  });

  it("ranked floor needs all three rounds above the bar", () => {
    // Only two rounds played → no floor credit even if both are high.
    const partial = updateRankedMatchStats(EMPTY, [300, 300]);
    expect(partial.bestRankedFloor).toBe(0);
    // Full three rounds; floor is the lowest round.
    const full = updateRankedMatchStats(EMPTY, [260, 300, 280]);
    expect(full.bestRankedFloor).toBe(260);
    const ids = getUnlockedAchievements(full).map((a) => a.id);
    expect(ids).toContain("ranked_floor_250");
    expect(ids).toContain("ranked_floor_50");
  });

  it("ranked stats keep the best across matches", () => {
    let s = updateRankedMatchStats(EMPTY, [60, 60, 60]); // floor 60, total 180
    s = updateRankedMatchStats(s, [40, 200, 40]); // floor 40 (worse), total 280 (better)
    expect(s.bestRankedFloor).toBe(60);
    expect(s.bestRankedTotal).toBe(280);
  });

  it("every color achievement has valid 0-255 rgb", () => {
    for (const a of ACHIEVEMENTS) {
      if (a.reward.type !== "color") continue;
      expect(a.reward.body).toHaveLength(3);
      expect(a.reward.accent).toHaveLength(3);
      for (const c of [...a.reward.body, ...a.reward.accent]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });

  it("every reward is a known discriminated-union variant", () => {
    for (const a of ACHIEVEMENTS) {
      expect(["color", "fx", "sound"]).toContain(a.reward.type);
    }
  });

  it("fx/sound rewards reference valid ids", () => {
    const fxIds = new Set(FLAP_FX_OPTIONS.map((o) => o.id));
    const soundIds = new Set(FLAP_SOUND_OPTIONS.map((o) => o.id));
    const fxRewards = ACHIEVEMENTS.filter((a) => a.reward.type === "fx");
    const soundRewards = ACHIEVEMENTS.filter((a) => a.reward.type === "sound");
    // The feature is actually demonstrated by at least one of each.
    expect(fxRewards.length).toBeGreaterThan(0);
    expect(soundRewards.length).toBeGreaterThan(0);
    for (const a of fxRewards) {
      if (a.reward.type === "fx") expect(fxIds).toContain(a.reward.fxId);
    }
    for (const a of soundRewards) {
      if (a.reward.type === "sound") expect(soundIds).toContain(a.reward.soundId);
    }
  });
});

describe("secret achievements", () => {
  const ids = (s: AchievementStats) => getUnlockedAchievements(s).map((a) => a.id);

  it("six_seven needs exactly 6 then exactly 7 in consecutive runs", () => {
    let s = updateStatsAfterRun(EMPTY, { score: 6, mode: "casual" });
    s = updateStatsAfterRun(s, { score: 7, mode: "casual" });
    expect(ids(s)).toContain("six_seven");
  });

  it("six_seven does not fire when another run breaks the chain", () => {
    let s = updateStatsAfterRun(EMPTY, { score: 6, mode: "casual" });
    s = updateStatsAfterRun(s, { score: 12, mode: "casual" });
    s = updateStatsAfterRun(s, { score: 7, mode: "casual" });
    expect(ids(s)).not.toContain("six_seven");
  });

  it("six_seven latches once earned", () => {
    let s = updateStatsAfterRun(EMPTY, { score: 6, mode: "casual" });
    s = updateStatsAfterRun(s, { score: 7, mode: "casual" });
    s = updateStatsAfterRun(s, { score: 3, mode: "casual" });
    expect(ids(s)).toContain("six_seven");
  });

  it("exact_67 and exact_42 fire only on the exact score", () => {
    const near = updateStatsAfterRun(EMPTY, { score: 68, mode: "casual" });
    expect(ids(near)).not.toContain("exact_67");
    const hit = updateStatsAfterRun(EMPTY, { score: 67, mode: "casual" });
    expect(ids(hit)).toContain("exact_67");
    expect(ids(updateStatsAfterRun(EMPTY, { score: 42, mode: "casual" }))).toContain("exact_42");
  });

  it("points_404 and points_1337 unlock on lifetime crossings", () => {
    let s = updateStatsAfterRun(EMPTY, { score: 400, mode: "casual" });
    expect(ids(s)).not.toContain("points_404");
    s = updateStatsAfterRun(s, { score: 10, mode: "casual" });
    expect(ids(s)).toContain("points_404");
    expect(ids(s)).not.toContain("points_1337");
    s = updateStatsAfterRun(s, { score: 1000, mode: "casual" });
    expect(ids(s)).toContain("points_1337");
  });

  it("deja_vu needs the same score (5+) twice in a row", () => {
    let low = updateStatsAfterRun(EMPTY, { score: 3, mode: "casual" });
    low = updateStatsAfterRun(low, { score: 3, mode: "casual" });
    expect(ids(low)).not.toContain("deja_vu");
    let s = updateStatsAfterRun(EMPTY, { score: 23, mode: "casual" });
    s = updateStatsAfterRun(s, { score: 23, mode: "casual" });
    expect(ids(s)).toContain("deja_vu");
  });

  it("palindrome fires for 101+ palindromes only", () => {
    expect(ids(updateStatsAfterRun(EMPTY, { score: 99, mode: "casual" }))).not.toContain(
      "palindrome",
    );
    expect(ids(updateStatsAfterRun(EMPTY, { score: 121, mode: "casual" }))).toContain(
      "palindrome",
    );
  });

  it("staircase needs exactly 1, 2, 3 back to back", () => {
    let s = updateStatsAfterRun(EMPTY, { score: 1, mode: "casual" });
    s = updateStatsAfterRun(s, { score: 2, mode: "casual" });
    s = updateStatsAfterRun(s, { score: 3, mode: "casual" });
    expect(ids(s)).toContain("staircase");
    let broken = updateStatsAfterRun(EMPTY, { score: 1, mode: "casual" });
    broken = updateStatsAfterRun(broken, { score: 5, mode: "casual" });
    broken = updateStatsAfterRun(broken, { score: 2, mode: "casual" });
    broken = updateStatsAfterRun(broken, { score: 3, mode: "casual" });
    expect(ids(broken)).not.toContain("staircase");
  });

  it("groundhog_day needs the same score (5+) three times running", () => {
    let s = EMPTY as ReturnType<typeof updateStatsAfterRun>;
    for (let i = 0; i < 3; i++) s = updateStatsAfterRun(s, { score: 9, mode: "casual" });
    expect(ids(s)).toContain("groundhog_day");
    let low = EMPTY as ReturnType<typeof updateStatsAfterRun>;
    for (let i = 0; i < 3; i++) low = updateStatsAfterRun(low, { score: 3, mode: "casual" });
    expect(ids(low)).not.toContain("groundhog_day");
  });

  it("comeback_kid: new best right after a sub-5 run", () => {
    let s = { ...EMPTY, bestScore: 30 };
    s = updateStatsAfterRun(s, { score: 2, mode: "casual" });
    expect(ids(s)).not.toContain("comeback_kid");
    s = updateStatsAfterRun(s, { score: 31, mode: "casual" });
    expect(ids(s)).toContain("comeback_kid");
  });

  it("ticks-based secrets: long_haul and rapid_unscheduled", () => {
    const long = updateStatsAfterRun(EMPTY, { score: 40, mode: "casual", ticks: 18000 });
    expect(ids(long)).toContain("long_haul");
    let quick = EMPTY as ReturnType<typeof updateStatsAfterRun>;
    for (let i = 0; i < 5; i++) quick = updateStatsAfterRun(quick, { score: 0, mode: "casual", ticks: 100 });
    expect(ids(quick)).toContain("rapid_unscheduled");
    // a slow run resets the chain
    let mixed = EMPTY as ReturnType<typeof updateStatsAfterRun>;
    for (let i = 0; i < 4; i++) mixed = updateStatsAfterRun(mixed, { score: 0, mode: "casual", ticks: 100 });
    mixed = updateStatsAfterRun(mixed, { score: 10, mode: "casual", ticks: 600 });
    mixed = updateStatsAfterRun(mixed, { score: 0, mode: "casual", ticks: 100 });
    expect(ids(mixed)).not.toContain("rapid_unscheduled");
  });

  it("all_rounder needs all four modes; century_club at 150", () => {
    let s = updateStatsAfterRun(EMPTY, { score: 5, mode: "casual" });
    s = updateStatsAfterRun(s, { score: 5, mode: "daily", tier: "medium" });
    s = updateStatsAfterRun(s, { score: 5, mode: "challenge" });
    expect(ids(s)).not.toContain("all_rounder");
    s = updateStatsAfterRun(s, { score: 5, mode: "ranked" });
    expect(ids(s)).toContain("all_rounder");
    expect(ids({ ...EMPTY, bestScore: 150 })).toContain("century_club");
  });

  it("zero_flap requires input data showing zero flaps", () => {
    expect(ids(updateStatsAfterRun(EMPTY, { score: 0, mode: "casual" }))).not.toContain(
      "zero_flap",
    );
    expect(ids(updateStatsAfterRun(EMPTY, { score: 0, mode: "casual", inputCount: 0 }))).toContain(
      "zero_flap",
    );
  });
});

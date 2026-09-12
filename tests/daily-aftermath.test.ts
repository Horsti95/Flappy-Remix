import { describe, it, expect } from "vitest";
import {
  attemptBar,
  dailyShareText,
  shortDate,
  BAR_CELLS,
} from "../src/game/daily-share";
import {
  sanitizeHistory,
  pruneHistory,
  attemptsUsedFrom,
  KEEP_DAYS,
} from "../src/game/daily-history";

describe("attemptBar", () => {
  it("always spans exactly BAR_CELLS cells", () => {
    for (const [score, best] of [[0, 50], [1, 50], [25, 50], [50, 50], [99, 50]] as const) {
      // Emoji are multi-code-unit, so count by code points, not .length.
      expect([...attemptBar(score, best)].length).toBe(BAR_CELLS);
    }
  });

  it("fills completely for the day's best", () => {
    expect(attemptBar(42, 42)).toBe("🟩".repeat(BAR_CELLS));
  });

  it("marks a zero-score run with a skull and no fill", () => {
    expect(attemptBar(0, 40)).toBe("💀" + "⬜".repeat(BAR_CELLS - 1));
  });

  it("keeps a non-zero score visible even when it is tiny", () => {
    const bar = attemptBar(1, 1000);
    expect(bar.startsWith("🟥")).toBe(true);
    expect([...bar].filter((c) => c !== "⬜").length).toBe(1);
  });

  it("colours by how close the attempt came", () => {
    expect(attemptBar(40, 40).startsWith("🟩")).toBe(true); // best
    expect(attemptBar(30, 40).startsWith("🟨")).toBe(true); // >= 50%
    expect(attemptBar(10, 40).startsWith("🟥")).toBe(true); // < 50%
  });

  it("treats a best of 0 as a full bar rather than dividing by zero", () => {
    expect(attemptBar(5, 0)).toBe("🟩".repeat(BAR_CELLS));
  });
});

describe("shortDate", () => {
  it("formats locale-independently", () => {
    expect(shortDate("2026-09-12")).toBe("12 Sep");
    expect(shortDate("2026-01-01")).toBe("1 Jan");
    expect(shortDate("2026-12-31")).toBe("31 Dec");
  });

  it("passes through anything malformed instead of inventing a date", () => {
    expect(shortDate("nonsense")).toBe("nonsense");
    expect(shortDate("2026-13-01")).toBe("2026-13-01");
  });
});

describe("dailyShareText", () => {
  const base = {
    date: "2026-09-12",
    attempts: [42, 18, 7],
    tier: "hard" as const,
    twist: "mirror day",
    streakDays: 5,
    url: "glide.uno",
  };

  it("produces the exact pasteable block", () => {
    expect(dailyShareText(base)).toBe(
      [
        "Glide daily · 12 Sep · 🟠 hard",
        "mirror day",
        "",
        "🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 42",
        "🟥🟥🟥🟥⬜⬜⬜⬜⬜⬜ 18",
        "🟥🟥⬜⬜⬜⬜⬜⬜⬜⬜ 7",
        "",
        "best 42 · 🔥 5",
        "glide.uno",
      ].join("\n"),
    );
  });

  it("never leaks the seed or the level layout (spoiler-free)", () => {
    const text = dailyShareText(base);
    expect(text).not.toMatch(/seed/i);
    expect(text).not.toMatch(/\b\d{5,}\b/); // no raw seed-sized numbers
  });

  it("is plain text and emoji only — survives any chat app", () => {
    const text = dailyShareText(base);
    expect(text).not.toMatch(/[<>*_`[\]]/); // no markdown or markup
  });

  it("hides a 1-day streak (that is just 'played today')", () => {
    expect(dailyShareText({ ...base, streakDays: 1 })).not.toContain("🔥");
    expect(dailyShareText({ ...base, streakDays: 2 })).toContain("🔥 2");
  });

  it("omits the twist line when the day has none", () => {
    const text = dailyShareText({ ...base, twist: null });
    expect(text.split("\n")[1]).toBe("");
  });

  it("omits the url when not supplied", () => {
    expect(dailyShareText({ ...base, url: undefined })).not.toContain("glide.uno");
  });

  it("handles a partial day (fewer than three attempts)", () => {
    const text = dailyShareText({ ...base, attempts: [12] });
    expect(text).toContain("🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 12");
    expect(text).toContain("best 12");
  });

  it("handles no attempts without producing a broken block", () => {
    const text = dailyShareText({ ...base, attempts: [] });
    expect(text).toContain("no attempts yet");
    expect(text).not.toContain("best");
  });

  it("caps at three attempts even if handed more", () => {
    const text = dailyShareText({ ...base, attempts: [5, 6, 7, 8, 9] });
    const bars = text.split("\n").filter((l) => /^[🟩🟨🟥💀]/.test(l));
    expect(bars).toHaveLength(3);
  });

  it("drops negative or non-finite scores rather than rendering them", () => {
    const text = dailyShareText({ ...base, attempts: [10, -5, NaN, 20] });
    const bars = text.split("\n").filter((l) => /^[🟩🟨🟥💀]/.test(l));
    expect(bars).toHaveLength(2);
    expect(text).toContain("best 20");
  });

  it("renders every tier with its own badge", () => {
    for (const [tier, emoji, label] of [
      ["easy", "🟢", "easy"],
      ["medium", "🔵", "medium"],
      ["hard", "🟠", "hard"],
      ["super_hard", "🔴", "super hard"],
      ["extreme", "⛈️", "extreme"],
    ] as const) {
      expect(dailyShareText({ ...base, tier })).toContain(`${emoji} ${label}`);
    }
  });
});

describe("daily history store", () => {
  it("keeps only well-formed date keys and non-negative integer scores", () => {
    expect(
      sanitizeHistory({
        "2026-09-12": [10, 20],
        "not-a-date": [5],
        "2026-09-13": "nope",
        "2026-09-14": [3, -1, NaN, "x", 7.9],
        "2026-09-15": [],
      }),
    ).toEqual({
      "2026-09-12": [10, 20],
      "2026-09-14": [3, 7],
    });
  });

  it("survives junk without throwing", () => {
    for (const junk of [null, undefined, 42, "string", [], true]) {
      expect(sanitizeHistory(junk)).toEqual({});
    }
  });

  it("prunes to the newest KEEP_DAYS dates", () => {
    const map: Record<string, number[]> = {};
    for (let d = 1; d <= 30; d++) {
      map[`2026-09-${String(d).padStart(2, "0")}`] = [d];
    }
    const pruned = pruneHistory(map);
    expect(Object.keys(pruned)).toHaveLength(KEEP_DAYS);
    expect(pruned["2026-09-30"]).toEqual([30]);
    expect(pruned["2026-09-01"]).toBeUndefined();
  });

  it("THE UPGRADE TRAP: never hands back attempts a legacy counter already used", () => {
    // A player mid-day when this shipped has an empty history array but a
    // legacy counter of 2. Trusting the array alone would reset them to 0 and
    // give 5 daily attempts.
    expect(attemptsUsedFrom(0, 2)).toBe(2);
    expect(attemptsUsedFrom(1, 2)).toBe(2);
    expect(attemptsUsedFrom(3, 2)).toBe(3);
    expect(attemptsUsedFrom(0, 0)).toBe(0);
  });

  it("ignores a corrupt legacy counter instead of trusting it", () => {
    expect(attemptsUsedFrom(2, NaN)).toBe(2);
    expect(attemptsUsedFrom(2, -5)).toBe(2);
  });
});

describe("tier type trap", () => {
  /**
   * `src/game/daily-twist.ts` and `src/game/tiers.ts` BOTH export a type named
   * `Tier` and a `TIER_LABEL` record — but they are different things:
   *
   *   daily-twist: "easy" | "medium" | "hard" | "super_hard" | "extreme"
   *                (the daily's difficulty band)
   *   tiers:       "bronze" | "silver" | "gold" | "legendary"
   *                (cosmetic rarity)
   *
   * Importing the wrong one still typechecks in isolation and silently
   * mislabels every shared result. It happened while writing this feature.
   */
  it("labels the daily by DIFFICULTY, never by cosmetic rarity", () => {
    const rarities = ["bronze", "silver", "gold", "legendary"];
    for (const tier of ["easy", "medium", "hard", "super_hard", "extreme"] as const) {
      const text = dailyShareText({ date: "2026-09-12", attempts: [10], tier });
      for (const r of rarities) expect(text).not.toContain(r);
    }
  });

  it("accepts every difficulty band the daily can actually produce", () => {
    // If daily-twist gains a band, this fails until the badge map covers it,
    // rather than rendering `undefined` into a shared message.
    for (const tier of ["easy", "medium", "hard", "super_hard", "extreme"] as const) {
      const text = dailyShareText({ date: "2026-09-12", attempts: [10], tier });
      expect(text).not.toContain("undefined");
      expect(text.split("\n")[0]).toMatch(/^Glide daily · 12 Sep · \S+ \S/);
    }
  });
});

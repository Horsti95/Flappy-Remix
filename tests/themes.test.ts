import { describe, it, expect } from "vitest";
import { DEFAULT_THEME_ID, THEMES, getTheme } from "../src/game/themes";

describe("theme registry", () => {
  it("has a default theme and resolves it", () => {
    expect(THEMES.find((t) => t.id === DEFAULT_THEME_ID)).toBeDefined();
    expect(getTheme(DEFAULT_THEME_ID).id).toBe(DEFAULT_THEME_ID);
  });

  it("theme ids are unique", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getTheme falls back to default for unknown ids", () => {
    expect(getTheme("not-a-real-theme").id).toBe(DEFAULT_THEME_ID);
    expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
    expect(getTheme(undefined).id).toBe(DEFAULT_THEME_ID);
  });

  it("every theme has both light and high-contrast palettes", () => {
    for (const t of THEMES) {
      expect(t.colors.skyTop).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.colors.skyBottom).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.colors.pipeBody).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.colors.pipeCap).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.colors.highContrast.skyTop).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.colors.highContrast.skyBottom).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("sunny preserves the historical hardcoded palette", () => {
    // Regression: keep these specific colors so existing screenshots /
    // OG images don't drift after the theme refactor.
    const sunny = getTheme("sunny");
    expect(sunny.colors.skyTop.toLowerCase()).toBe("#87ceeb");
    expect(sunny.colors.skyBottom.toLowerCase()).toBe("#b3e5fc");
    expect(sunny.colors.pipeBody.toLowerCase()).toBe("#3d8b58");
    expect(sunny.colors.pipeCap.toLowerCase()).toBe("#2b6f4d");
  });

  it("fog theme carries a positive fogIntensity", () => {
    expect(getTheme("fog").colors.fogIntensity).toBeGreaterThan(0);
  });
});

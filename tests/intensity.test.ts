import { describe, it, expect } from "vitest";
import {
  computeIntensity,
  intensityBand,
  intensityPercentLabel,
  type DailyModifier,
} from "../src/game/daily-twist";

function mod(intensity?: number): DailyModifier {
  return {
    id: "x",
    name: "x",
    kind: "physics",
    difficulty: "neutral",
    configOverride: (c) => c,
    blurb: "x",
    intensity,
  };
}

describe("daily intensity", () => {
  it("multiplies (compounds), not adds", () => {
    // two +20% mods → 1.2 * 1.2 = 1.44
    expect(computeIntensity([mod(1.2), mod(1.2)])).toBeCloseTo(1.44, 5);
  });

  it("treats missing intensity as neutral 1.0", () => {
    expect(computeIntensity([mod(undefined), mod(1.3)])).toBeCloseTo(1.3, 5);
  });

  it("folds in the extra handicap multiplier", () => {
    expect(computeIntensity([mod(1.2)], 1.15)).toBeCloseTo(1.38, 5);
  });

  it("bands map as expected", () => {
    expect(intensityBand(0.85)).toBe("easy");
    expect(intensityBand(1.0)).toBe("normal");
    expect(intensityBand(1.3)).toBe("hard");
    expect(intensityBand(1.6)).toBe("super hard");
    expect(intensityBand(2.0)).toBe("extreme");
  });

  it("percent label reads signed", () => {
    expect(intensityPercentLabel(1.44)).toBe("+44%");
    expect(intensityPercentLabel(0.85)).toBe("-15%");
    expect(intensityPercentLabel(1.0)).toBe("+0%");
  });
});

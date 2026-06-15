import { describe, it, expect } from "vitest";
import { colorName } from "../src/game/color-name";

describe("colorName — deterministic minted-skin names", () => {
  it("maps body hue + accent tone to a readable two-word name", () => {
    expect(colorName([220, 38, 38], [60, 10, 10])).toBe("crimson ink");
    expect(colorName([14, 165, 233], [8, 47, 73])).toBe("cyan shadow");
    expect(colorName([94, 234, 212], [15, 70, 65])).toBe("teal shadow");
  });

  it("uses greyscale words for near-neutral bodies", () => {
    expect(colorName([230, 230, 230], [20, 20, 20])).toBe("chalk ink");
    expect(colorName([40, 44, 48], [20, 20, 20]).split(" ")[0]).toBe("charcoal");
  });

  it("is deterministic — same colours, same name", () => {
    const a = colorName([168, 85, 247], [40, 10, 70]);
    const b = colorName([168, 85, 247], [40, 10, 70]);
    expect(a).toBe(b);
    expect(a.split(" ")).toHaveLength(2);
  });

  it("adds a tone prefix only at lightness extremes", () => {
    expect(colorName([40, 8, 8], [10, 10, 10]).startsWith("deep ")).toBe(true);
    expect(colorName([255, 210, 210], [240, 240, 240]).startsWith("pale ")).toBe(true);
  });
});

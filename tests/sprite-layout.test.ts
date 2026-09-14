import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { DEFAULT_CONFIG } from "../src/game/config";
import { getSpriteFrame, SPRITE_FOOTPRINT } from "../src/game/sprite-layout";
import { getShape } from "../src/game/shapes";
import { DEFAULT_SKIN } from "../src/game/skin";

const TOUCAN_BOX = { x: 12 / 256, y: 53 / 256, w: 232 / 256, h: 149 / 256 };

describe("shared cosmetic sprite footprint", () => {
  it("fits the toucan at 35 x 22.48 world pixels around the existing 14px radius", () => {
    const f = getSpriteFrame(256, 256, TOUCAN_BOX, DEFAULT_CONFIG.birdRadius);
    expect(DEFAULT_CONFIG.birdRadius).toBe(14);
    expect(f.dw).toBe(35);
    expect(f.dh).toBeCloseTo(22.478448);
    expect(f.dx + f.dw / 2).toBe(0);
    expect(f.dy + f.dh / 2).toBe(0);
    expect(f.dw / f.dh).toBeCloseTo(232 / 149);
  });

  it.each([[232, 149], [110, 97], [229, 232], [992, 935]])(
    "gives a %i x %i silhouette the same longest side, irrespective of source resolution",
    (w, h) => {
      const f = getSpriteFrame(1024, 1024, { x: 0, y: 0, w: w / 1024, h: h / 1024 }, 14);
      expect(Math.max(f.dw, f.dh)).toBeCloseTo(35);
    },
  );

  it("scales with the active mode radius without changing it or adding a shape override", () => {
    for (const radius of [10, 14, 18]) {
      const f = getSpriteFrame(256, 256, TOUCAN_BOX, radius);
      expect(f.dw).toBeCloseTo(radius * 2 * SPRITE_FOOTPRINT);
    }
    expect(DEFAULT_CONFIG.birdRadius).toBe(14);
  });

  it("keeps the real toucan layers transparent, aligned and inside their measured crop", async () => {
    const crop = { minX: 256, minY: 256, maxX: -1, maxY: -1 };
    for (const name of ["toucan", "toucan-accent"]) {
      const { data, info } = await sharp(`public/sprites/${name}.png`).raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height, info.channels]).toEqual([256, 256, 4]);
      expect(data[3]).toBe(0);
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          if (data[(y * info.width + x) * 4 + 3] <= 16) continue;
          if (name === "toucan") {
            crop.minX = Math.min(crop.minX, x); crop.maxX = Math.max(crop.maxX, x);
            crop.minY = Math.min(crop.minY, y); crop.maxY = Math.max(crop.maxY, y);
          } else {
            // The renderer crops to the base layer; don't cut off the beak.
            expect(x >= crop.minX && x <= crop.maxX && y >= crop.minY && y <= crop.maxY).toBe(true);
          }
        }
      }
    }
    expect(crop).toEqual({ minX: 12, minY: 53, maxX: 243, maxY: 201 });
  });

  it("centres the toucan fallback and applies the shared visual width, also in high contrast", () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(), scale: vi.fn(), translate: vi.fn(),
      beginPath: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), arc: vi.fn(),
    };
    for (const highContrast of [false, true]) {
      getShape("toucan").draw(ctx as unknown as CanvasRenderingContext2D, 14, DEFAULT_SKIN, highContrast);
      expect(ctx.scale).toHaveBeenLastCalledWith(2.5 / 2.65, 2.5 / 2.65);
      expect(ctx.translate).toHaveBeenLastCalledWith(-0.175 * 14, 0);
    }
    expect(ctx.save).toHaveBeenCalledTimes(2);
    expect(ctx.restore).toHaveBeenCalledTimes(2);
  });
});

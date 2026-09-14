import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("layered sprite crop", () => {
  it("waits for the accent and includes accent-only geometry in the crop", async () => {
    const images: FakeImage[] = [];
    class FakeImage {
      src = "";
      naturalWidth = 4;
      naturalHeight = 4;
      onload: (() => void) | null = null;
      constructor() { images.push(this); }
    }
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    const drawImage = vi.fn((img: FakeImage) => {
      // Accent beak reaches x=3; body alone would end at x=1.
      const x = img.src.endsWith("-accent.png") ? 3 : 1;
      pixels[(1 * 4 + x) * 4 + 3] = 255;
    });
    const context = { drawImage, getImageData: () => ({ data: pixels }) };
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
    const { preloadSprites, getSpriteContentBox } = await import("../src/game/sprites");
    preloadSprites();
    const base = images.find(i => i.src === "/sprites/studio-swift.png")!;
    const accent = images.find(i => i.src === "/sprites/studio-swift-accent.png")!;
    base.onload!();
    expect(getSpriteContentBox("studio-swift")).toBeNull();
    accent.onload!();
    expect(getSpriteContentBox("studio-swift")).toEqual({ x: .25, y: .25, w: .75, h: .25 });
    expect(drawImage.mock.calls.map(([img]) => img.src)).toEqual([accent.src, base.src]);
    getSpriteContentBox("studio-swift");
    expect(drawImage).toHaveBeenCalledTimes(2);
  });
});

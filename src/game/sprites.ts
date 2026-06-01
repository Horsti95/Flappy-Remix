import { type SkinColors } from "./skin";

/**
 * Minimal image-sprite pipeline.
 *
 * The renderer is otherwise all canvas primitives; this adds the ability to
 * draw a bitmap sprite for a shape (e.g. the origami toucan). Sprites are
 * authored as GRAYSCALE PNGs with transparency: we tint them to the equipped
 * skin's body color with a `multiply` pass (which keeps the fold shading and
 * the dark outline), then mask back to the original alpha so the transparent
 * background stays transparent.
 *
 * Tinted results are cached per (sprite id × body color) so we don't
 * re-process every frame. Purely cosmetic — the sim never reads any of this,
 * so determinism/replays are unaffected.
 */

interface SpriteEntry {
  img: HTMLImageElement;
  loaded: boolean;
}

const sources: Record<string, string> = {
  toucan: "/sprites/toucan.png",
  crane: "/sprites/crane.png",
};

const sprites = new Map<string, SpriteEntry>();
const tintCache = new Map<string, HTMLCanvasElement>();

/** Kick off loading (idempotent). Safe to call in the renderer ctor. */
export function preloadSprites(): void {
  if (typeof Image === "undefined") return; // SSR / test guard
  for (const [id, src] of Object.entries(sources)) {
    if (sprites.has(id)) continue;
    const img = new Image();
    const entry: SpriteEntry = { img, loaded: false };
    img.onload = () => {
      entry.loaded = true;
    };
    img.src = src;
    sprites.set(id, entry);
  }
}

export function hasSprite(id: string): boolean {
  return id in sources;
}

/** A tinted offscreen canvas for the sprite, or null if not yet loaded. */
export function getTintedSprite(id: string, skin: SkinColors): HTMLCanvasElement | null {
  const entry = sprites.get(id);
  if (!entry || !entry.loaded) return null;
  const key = `${id}:${skin.body.join(",")}`;
  const cached = tintCache.get(key);
  if (cached) return cached;

  const w = entry.img.naturalWidth || 256;
  const h = entry.img.naturalHeight || 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d");
  if (!cx) return null;
  // 1) the grayscale sprite
  cx.drawImage(entry.img, 0, 0, w, h);
  // 2) multiply the body color over it (keeps shading + dark lines)
  cx.globalCompositeOperation = "multiply";
  cx.fillStyle = `rgb(${skin.body.join(",")})`;
  cx.fillRect(0, 0, w, h);
  // 3) restore the original alpha so the transparent bg stays transparent
  cx.globalCompositeOperation = "destination-in";
  cx.drawImage(entry.img, 0, 0, w, h);
  cx.globalCompositeOperation = "source-over";

  tintCache.set(key, c);
  return c;
}

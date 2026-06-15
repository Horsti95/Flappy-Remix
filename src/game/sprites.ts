import { type SkinColors } from "./skin";

/**
 * Image-sprite pipeline (one- and two-colour).
 *
 * The renderer is otherwise all canvas primitives; this adds the ability to
 * draw a bitmap sprite for a shape. Sprites are authored as GRAYSCALE PNGs
 * with transparency. There are two flavours:
 *
 *  - Single-layer (e.g. the crane): one `<id>.png`. We tint it to the equipped
 *    skin's BODY colour with a `multiply` pass (which keeps fold shading and
 *    the dark outline), then mask back to the original alpha so the transparent
 *    background stays transparent.
 *
 *  - Two-layer origami (e.g. swan, butterfly…): a base `<id>.png` (body + all
 *    outlines, with the accent region punched out as a transparent hole) plus
 *    an `<id>-accent.png` (only the accent region). We composite
 *    multiply(accent, accentColor) BENEATH multiply(base, bodyColor) so the
 *    base's outlines + hole frame the accent cleanly. This gives a true
 *    two-colour sprite (body colour + a distinct accent colour).
 *
 * Tinted results are cached per (sprite id × body colour × accent colour) so we
 * don't re-process every frame. Purely cosmetic — the sim never reads any of
 * this, so determinism/replays are unaffected.
 */

interface SpriteEntry {
  img: HTMLImageElement;
  loaded: boolean;
}

/**
 * Registry of sprite-backed shapes. `accent: true` means a `<id>-accent.png`
 * companion exists and the shape should render as a two-colour sprite.
 */
const SPRITE_DEFS: Record<string, { accent: boolean }> = {
  crane: { accent: false },
  swan: { accent: true },
  swan2: { accent: true },
  envelope: { accent: true },
  rocket: { accent: true },
  butterfly: { accent: true },
  songbird: { accent: true },
  sparrow: { accent: true },
  heart: { accent: true },
  dove: { accent: true },
  eagle: { accent: true },
  dove2: { accent: true },
  submarine: { accent: true },
  leaf: { accent: true },
};

/** Each registered sprite maps to one or two PNG sources (base [+ accent]). */
function sourcesFor(id: string): { base: string; accent?: string } {
  const def = SPRITE_DEFS[id];
  return {
    base: `/sprites/${id}.png`,
    accent: def?.accent ? `/sprites/${id}-accent.png` : undefined,
  };
}

const sprites = new Map<string, SpriteEntry>();
const tintCache = new Map<string, HTMLCanvasElement>();

function loadOne(key: string, src: string): void {
  if (sprites.has(key)) return;
  const img = new Image();
  const entry: SpriteEntry = { img, loaded: false };
  img.onload = () => {
    entry.loaded = true;
  };
  img.src = src;
  sprites.set(key, entry);
}

/** Kick off loading (idempotent). Safe to call in the renderer ctor. */
export function preloadSprites(): void {
  if (typeof Image === "undefined") return; // SSR / test guard
  for (const id of Object.keys(SPRITE_DEFS)) {
    const { base, accent } = sourcesFor(id);
    loadOne(id, base);
    if (accent) loadOne(`${id}:accent`, accent);
  }
}

export function hasSprite(id: string): boolean {
  return id in SPRITE_DEFS;
}

/** Tight content bounding box of a sprite, in [0..1] fractions of its source
 *  box, or null if the sprite isn't loaded yet. Lets the renderer normalise
 *  every sprite to the same on-screen footprint regardless of how much
 *  transparent padding the art carries — so a wide eagle and a compact heart
 *  read the same size and sit ≈ the collision circle. Cached per id (depends
 *  only on the silhouette, not the tint colours). The base layer's outlines
 *  surround any punched accent hole, so its alpha bbox is the full silhouette. */
const contentBoxCache = new Map<string, { x: number; y: number; w: number; h: number } | null>();
export function getSpriteContentBox(
  id: string,
): { x: number; y: number; w: number; h: number } | null {
  const cached = contentBoxCache.get(id);
  if (cached !== undefined) return cached;
  const base = sprites.get(id);
  if (!base || !base.loaded || typeof document === "undefined") return null;
  const w = base.img.naturalWidth || 256;
  const h = base.img.naturalHeight || 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d");
  if (!cx) return null;
  cx.drawImage(base.img, 0, 0, w, h);
  let minX = w, minY = h, maxX = 0, maxY = 0, any = false;
  const { data } = cx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        any = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const box = any
    ? { x: minX / w, y: minY / h, w: (maxX - minX + 1) / w, h: (maxY - minY + 1) / h }
    : null;
  contentBoxCache.set(id, box);
  return box;
}

/** Whether `id` is a two-colour (base + accent) sprite. */
export function hasAccentLayer(id: string): boolean {
  return SPRITE_DEFS[id]?.accent === true;
}

/** multiply a grayscale sprite layer by `color` onto a fresh canvas, masked to
 *  the layer's own alpha so the transparent background stays transparent. */
function tintLayer(
  img: HTMLImageElement,
  color: [number, number, number],
  w: number,
  h: number,
): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d");
  if (!cx) return null;
  // 1) the grayscale layer
  cx.drawImage(img, 0, 0, w, h);
  // 2) multiply the colour over it (keeps shading + dark lines)
  cx.globalCompositeOperation = "multiply";
  cx.fillStyle = `rgb(${color.join(",")})`;
  cx.fillRect(0, 0, w, h);
  // 3) restore the original alpha so transparent stays transparent
  cx.globalCompositeOperation = "destination-in";
  cx.drawImage(img, 0, 0, w, h);
  cx.globalCompositeOperation = "source-over";
  return c;
}

/**
 * A tinted offscreen canvas for the sprite, or null if not yet loaded.
 *
 * For two-layer sprites the accent is multiplied by `skin.accent` and drawn
 * BENEATH the body (multiplied by `skin.body`); the base's outlines + hole
 * frame the accent.
 */
export function getTintedSprite(id: string, skin: SkinColors): HTMLCanvasElement | null {
  const base = sprites.get(id);
  if (!base || !base.loaded) return null;

  const wantAccent = hasAccentLayer(id);
  const accent = wantAccent ? sprites.get(`${id}:accent`) : undefined;
  // For two-layer sprites, wait until the accent layer is loaded too so we
  // never flash a hole-in-the-body frame.
  if (wantAccent && (!accent || !accent.loaded)) return null;

  // Cache key includes BOTH colours so body/accent combos don't collide.
  const key = `${id}:${skin.body.join(",")}:${skin.accent.join(",")}`;
  const cached = tintCache.get(key);
  if (cached) return cached;

  const w = base.img.naturalWidth || 256;
  const h = base.img.naturalHeight || 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d");
  if (!cx) return null;

  // Accent BENEATH, base ON TOP.
  if (accent && accent.loaded) {
    const accentCanvas = tintLayer(accent.img, skin.accent, w, h);
    if (accentCanvas) cx.drawImage(accentCanvas, 0, 0);
  }
  const baseCanvas = tintLayer(base.img, skin.body, w, h);
  if (baseCanvas) cx.drawImage(baseCanvas, 0, 0);

  tintCache.set(key, c);
  return c;
}

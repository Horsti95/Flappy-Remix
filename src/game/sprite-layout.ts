/** Shared visual sizing for every bitmap shape. Never used by the simulation. */
export const SPRITE_FOOTPRINT = 1.25;

export interface SpriteContentBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Trim transparent padding, preserve aspect ratio and centre the visible art.
 * The longest side is the same multiple of the active collision diameter for
 * every sprite. There are deliberately no shape-specific size multipliers.
 */
export function getSpriteFrame(
  sourceWidth: number,
  sourceHeight: number,
  box: SpriteContentBox,
  radius: number,
) {
  const sx = box.x * sourceWidth, sy = box.y * sourceHeight;
  const sw = box.w * sourceWidth, sh = box.h * sourceHeight;
  const scale = (radius * 2 * SPRITE_FOOTPRINT) / Math.max(sw, sh);
  const dw = sw * scale, dh = sh * scale;
  return { sx, sy, sw, sh, dx: -dw / 2, dy: -dh / 2, dw, dh };
}

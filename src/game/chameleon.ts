import type { SkinColors } from "./skin";

/**
 * Chameleon — the legendary "you never know what you'll get" skin.
 *
 * It has no fixed colours. Every run rolls a fresh, vivid pair so the plane
 * looks different each time you fly. The roll is done ONCE at run start (not
 * per frame) and written into renderer.options.skin, so:
 *   - your own plane doesn't strobe, and
 *   - the exact colours you flew are what get recorded into the run's share
 *     card / challenge ghost.
 *
 * Colours come from a random hue in HSL with high saturation, rather than raw
 * RGB, so the result is always bright and visible against the sky (raw random
 * RGB can land on muddy or near-invisible combos). The accent is a darker,
 * slightly hue-shifted shade of the same colour.
 */

export const CHAMELEON_ID = "chameleon";

export function rollChameleonColors(): SkinColors {
  const hue = Math.floor(Math.random() * 360);
  return {
    body: hslToRgb(hue, 0.78, 0.56),
    accent: hslToRgb((hue + 28) % 360, 0.72, 0.24),
  };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

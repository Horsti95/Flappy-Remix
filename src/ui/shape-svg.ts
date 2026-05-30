import type { ShapeId } from "../game/shapes";

/**
 * Standalone SVG inner-content for a shape, painted with the given
 * body + accent RGB colors. Used by the menu mascot and the gallery
 * preview cards. Mirrors the on-canvas drawShape logic for each id,
 * but as static SVG so it can render in HTML.
 *
 * The SVG viewBox is "-20 -20 40 40" so the shape sits centred. The
 * caller wraps it in a <svg> with the size + class it wants.
 */
export function shapeSvgInner(
  shapeId: ShapeId,
  body: [number, number, number],
  accent: [number, number, number],
): string {
  const b = `rgb(${body.join(",")})`;
  const a = `rgb(${accent.join(",")})`;
  switch (shapeId) {
    case "paper-plane":
      return `<polygon points="-14,6 14,-6 1,0 14,-6 -1,11" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="1,0 -14,6 -1,11" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>`;
    case "paper-plane-v2":
      return `<polygon points="-15,5 -3,2 15,-2 12,1 -10,8" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="-15,-1 15,-2 -2,2 15,-2 -15,5" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>`;
    case "pixel-bird":
      return `<g fill="${b}" stroke="#1a1a1a" stroke-width="0.4">
                <rect x="-9" y="-7" width="2" height="2"/><rect x="-7" y="-7" width="2" height="2"/><rect x="-5" y="-7" width="2" height="2"/><rect x="-3" y="-7" width="2" height="2"/>
                <rect x="-11" y="-5" width="14" height="2"/>
                <rect x="-13" y="-3" width="18" height="2"/>
                <rect x="-13" y="-1" width="20" height="2"/>
                <rect x="-13" y="1" width="22" height="2"/>
                <rect x="-13" y="3" width="20" height="2"/>
                <rect x="-11" y="5" width="14" height="2"/>
              </g>
              <g fill="${a}" stroke="#1a1a1a" stroke-width="0.4">
                <rect x="3" y="-3" width="4" height="2"/>
                <rect x="5" y="-1" width="6" height="2"/>
              </g>
              <rect x="3" y="-5" width="2" height="2" fill="#1a1a1a"/>`;
    case "kite":
      return `<polygon points="0,-13 12,0 0,13 -12,0" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="0,-13 0,13 -12,0" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <line x1="-12" y1="0" x2="12" y2="0" stroke="#1a1a1a" stroke-width="0.4" opacity="0.5"/>`;
    case "cyber-plane":
      return `<polygon points="14,0 2,-6 -11,-3 -13,0 -11,3 2,6" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="4,2 -9,9 -12,7 -7,3" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="7,-2 11,-1 10,0 6,-0.5" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>
              <rect x="-13" y="-2" width="2.5" height="1.2" fill="#1a1a1a"/>
              <rect x="-13" y="0.6" width="2.5" height="1.2" fill="#1a1a1a"/>`;
    case "butterfly":
      return `<path d="M -1 -7 Q -4 -11 -5 -14" stroke="#3a3a3a" stroke-width="0.8" fill="none"/>
              <path d="M 1 -7 Q 4 -11 5 -14" stroke="#3a3a3a" stroke-width="0.8" fill="none"/>
              <path d="M 0 -5 C -10 -10 -14 -5 -13 -1 C -10 2 -3 0 0 -2 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <path d="M 0 -5 C 10 -10 14 -5 13 -1 C 10 2 3 0 0 -2 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <path d="M -1 0 C -8 3 -9 8 -6 9 C -3 9 -1 5 -1 3 Z" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <path d="M 1 0 C 8 3 9 8 6 9 C 3 9 1 5 1 3 Z" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <ellipse cx="0" cy="-1" rx="0.8" ry="7" fill="#3a3a3a" stroke="#1a1a1a" stroke-width="0.4"/>`;
  }
}

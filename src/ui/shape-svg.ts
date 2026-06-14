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
      // Generated from the SAME bitmap drawPixelBird() paints on canvas
      // (px=r/8, r=14 ⇒ px=1.75; offX=-7, offY=-4), so the gallery preview
      // matches the in-game skin exactly. Keep in sync with shapes.ts.
      return `<g fill="${b}"><rect x="-7.00" y="-7.00" width="1.80" height="1.80"/><rect x="-5.25" y="-7.00" width="1.80" height="1.80"/><rect x="-3.50" y="-7.00" width="1.80" height="1.80"/><rect x="-1.75" y="-7.00" width="1.80" height="1.80"/><rect x="0.00" y="-7.00" width="1.80" height="1.80"/><rect x="1.75" y="-7.00" width="1.80" height="1.80"/><rect x="-8.75" y="-5.25" width="1.80" height="1.80"/><rect x="-7.00" y="-5.25" width="1.80" height="1.80"/><rect x="-5.25" y="-5.25" width="1.80" height="1.80"/><rect x="-3.50" y="-5.25" width="1.80" height="1.80"/><rect x="-1.75" y="-5.25" width="1.80" height="1.80"/><rect x="0.00" y="-5.25" width="1.80" height="1.80"/><rect x="1.75" y="-5.25" width="1.80" height="1.80"/><rect x="3.50" y="-5.25" width="1.80" height="1.80"/><rect x="5.25" y="-5.25" width="1.80" height="1.80"/><rect x="-10.50" y="-3.50" width="1.80" height="1.80"/><rect x="-8.75" y="-3.50" width="1.80" height="1.80"/><rect x="-7.00" y="-3.50" width="1.80" height="1.80"/><rect x="-5.25" y="-3.50" width="1.80" height="1.80"/><rect x="0.00" y="-3.50" width="1.80" height="1.80"/><rect x="1.75" y="-3.50" width="1.80" height="1.80"/><rect x="3.50" y="-3.50" width="1.80" height="1.80"/><rect x="5.25" y="-3.50" width="1.80" height="1.80"/><rect x="7.00" y="-3.50" width="1.80" height="1.80"/><rect x="-12.25" y="-1.75" width="1.80" height="1.80"/><rect x="-10.50" y="-1.75" width="1.80" height="1.80"/><rect x="-8.75" y="-1.75" width="1.80" height="1.80"/><rect x="-7.00" y="-1.75" width="1.80" height="1.80"/><rect x="-5.25" y="-1.75" width="1.80" height="1.80"/><rect x="0.00" y="-1.75" width="1.80" height="1.80"/><rect x="1.75" y="-1.75" width="1.80" height="1.80"/><rect x="3.50" y="-1.75" width="1.80" height="1.80"/><rect x="5.25" y="-1.75" width="1.80" height="1.80"/><rect x="7.00" y="-1.75" width="1.80" height="1.80"/><rect x="8.75" y="-1.75" width="1.80" height="1.80"/><rect x="-12.25" y="0.00" width="1.80" height="1.80"/><rect x="-10.50" y="0.00" width="1.80" height="1.80"/><rect x="-8.75" y="0.00" width="1.80" height="1.80"/><rect x="-7.00" y="0.00" width="1.80" height="1.80"/><rect x="-5.25" y="0.00" width="1.80" height="1.80"/><rect x="-3.50" y="0.00" width="1.80" height="1.80"/><rect x="-1.75" y="0.00" width="1.80" height="1.80"/><rect x="0.00" y="0.00" width="1.80" height="1.80"/><rect x="1.75" y="0.00" width="1.80" height="1.80"/><rect x="3.50" y="0.00" width="1.80" height="1.80"/><rect x="5.25" y="0.00" width="1.80" height="1.80"/><rect x="-12.25" y="1.75" width="1.80" height="1.80"/><rect x="-10.50" y="1.75" width="1.80" height="1.80"/><rect x="-8.75" y="1.75" width="1.80" height="1.80"/><rect x="-7.00" y="1.75" width="1.80" height="1.80"/><rect x="-5.25" y="1.75" width="1.80" height="1.80"/><rect x="-3.50" y="1.75" width="1.80" height="1.80"/><rect x="-1.75" y="1.75" width="1.80" height="1.80"/><rect x="0.00" y="1.75" width="1.80" height="1.80"/><rect x="1.75" y="1.75" width="1.80" height="1.80"/><rect x="3.50" y="1.75" width="1.80" height="1.80"/><rect x="5.25" y="1.75" width="1.80" height="1.80"/><rect x="7.00" y="1.75" width="1.80" height="1.80"/><rect x="8.75" y="1.75" width="1.80" height="1.80"/><rect x="10.50" y="1.75" width="1.80" height="1.80"/><rect x="-10.50" y="3.50" width="1.80" height="1.80"/><rect x="-8.75" y="3.50" width="1.80" height="1.80"/><rect x="-7.00" y="3.50" width="1.80" height="1.80"/><rect x="-5.25" y="3.50" width="1.80" height="1.80"/><rect x="-3.50" y="3.50" width="1.80" height="1.80"/><rect x="-1.75" y="3.50" width="1.80" height="1.80"/><rect x="0.00" y="3.50" width="1.80" height="1.80"/><rect x="1.75" y="3.50" width="1.80" height="1.80"/><rect x="3.50" y="3.50" width="1.80" height="1.80"/><rect x="5.25" y="3.50" width="1.80" height="1.80"/><rect x="7.00" y="3.50" width="1.80" height="1.80"/><rect x="-8.75" y="5.25" width="1.80" height="1.80"/><rect x="-7.00" y="5.25" width="1.80" height="1.80"/><rect x="-5.25" y="5.25" width="1.80" height="1.80"/><rect x="-3.50" y="5.25" width="1.80" height="1.80"/><rect x="-1.75" y="5.25" width="1.80" height="1.80"/><rect x="0.00" y="5.25" width="1.80" height="1.80"/><rect x="1.75" y="5.25" width="1.80" height="1.80"/><rect x="3.50" y="5.25" width="1.80" height="1.80"/><rect x="5.25" y="5.25" width="1.80" height="1.80"/></g>
              <g fill="${a}"><rect x="-3.50" y="-3.50" width="1.80" height="1.80"/><rect x="-1.75" y="-3.50" width="1.80" height="1.80"/><rect x="-3.50" y="-1.75" width="1.80" height="1.80"/><rect x="-1.75" y="-1.75" width="1.80" height="1.80"/><rect x="7.00" y="0.00" width="1.80" height="1.80"/><rect x="8.75" y="0.00" width="1.80" height="1.80"/><rect x="10.50" y="0.00" width="1.80" height="1.80"/></g>
              <rect x="3.50" y="-1.75" width="1.75" height="1.75" fill="#1a1a1a"/>`;
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
    case "rocket":
      return `<polygon points="14,0 2,-6 -11,-6 -11,6 2,6" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="-7,-6 -13,-11 -7,-2" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="-7,6 -13,11 -7,2" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <circle cx="4" cy="0" r="2.6" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>`;
    case "heart":
      return `<path d="M 11 0 C 2 -11 -13 -6 -2 0.6 C -13 6 2 11 11 0 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <circle cx="-2" cy="0" r="2.6" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>`;
    case "star":
      return `<polygon points="0,-13 3,-4 12,-4 5,2 7,11 0,6 -7,11 -5,2 -12,-4 -3,-4" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <circle cx="0" cy="0" r="4" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>`;
    case "butterfly":
      return `<path d="M -1 -7 Q -4 -11 -5 -14" stroke="#3a3a3a" stroke-width="0.8" fill="none"/>
              <path d="M 1 -7 Q 4 -11 5 -14" stroke="#3a3a3a" stroke-width="0.8" fill="none"/>
              <path d="M 0 -5 C -10 -10 -14 -5 -13 -1 C -10 2 -3 0 0 -2 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <path d="M 0 -5 C 10 -10 14 -5 13 -1 C 10 2 3 0 0 -2 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <path d="M -1 0 C -8 3 -9 8 -6 9 C -3 9 -1 5 -1 3 Z" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <path d="M 1 0 C 8 3 9 8 6 9 C 3 9 1 5 1 3 Z" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <ellipse cx="0" cy="-1" rx="0.8" ry="7" fill="#3a3a3a" stroke="#1a1a1a" stroke-width="0.4"/>`;
    case "flower":
      return `<g fill="${b}" stroke="#1a1a1a" stroke-width="0.6">
                <ellipse cx="0" cy="-9" rx="3.5" ry="6"/>
                <ellipse cx="0" cy="9" rx="3.5" ry="6"/>
                <ellipse cx="-9" cy="0" rx="6" ry="3.5"/>
                <ellipse cx="9" cy="0" rx="6" ry="3.5"/>
                <ellipse cx="-6.4" cy="-6.4" rx="3.5" ry="6" transform="rotate(45 -6.4 -6.4)"/>
                <ellipse cx="6.4" cy="6.4" rx="3.5" ry="6" transform="rotate(45 6.4 6.4)"/>
              </g>
              <circle cx="0" cy="0" r="4" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>`;
    case "vector-bird":
      return `<ellipse cx="-1" cy="0" rx="11" ry="7" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="10,-1 16,0 10,2" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>
              <path d="M -2 -5 C -6 -12 -12 -10 -10 -3 Z" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>
              <circle cx="5" cy="-2" r="1.4" fill="#1a1a1a"/>`;
    case "leaf":
      return `<path d="M -12 0 C -8 -8 8 -8 14 0 C 8 8 -8 8 -12 0 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <line x1="-11" y1="0" x2="14" y2="0" stroke="${a}" stroke-width="1"/>`;
    case "lightning":
      return `<polygon points="6,-13 -7,3 0,3 -4,13 9,-3 2,-3" fill="${b}" stroke="${a}" stroke-width="0.8" stroke-linejoin="round"/>`;
    case "ghost":
      return `<path d="M -10 12 L -10 -2 A 10 10 0 0 1 10 -2 L 10 12 L 6 8 L 2 12 L -2 8 L -6 12 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8" stroke-linejoin="round"/>
              <ellipse cx="-4" cy="-2" rx="1.8" ry="2.4" fill="${a}"/>
              <ellipse cx="4" cy="-2" rx="1.8" ry="2.4" fill="${a}"/>`;
    case "crane":
      return spritePreview("crane", body);
    // Two-colour origami sprites — accent layer beneath, base on top.
    case "swan":
      return spritePreview("swan", body, accent, true);
    case "swan2":
      return spritePreview("swan2", body, accent, true);
    case "envelope":
      return spritePreview("envelope", body); // single-layer (no accent fold)
    case "rocket-origami":
      return spritePreview("rocket", body, accent, true);
    case "butterfly-origami":
      return spritePreview("butterfly", body, accent, true);
    case "songbird":
      return spritePreview("songbird", body, accent, true);
    case "sparrow":
      return spritePreview("sparrow", body, accent, true);
    case "heart-origami":
      return spritePreview("heart", body, accent, true);
    case "dove":
      return spritePreview("dove", body, accent, true);
    case "eagle":
      return spritePreview("eagle", body, accent, true);
    case "dove2":
      return spritePreview("dove2", body, accent, true);
    case "submarine-origami":
      return spritePreview("submarine", body, accent, true);
    case "leaf-origami":
      return spritePreview("leaf", body, accent, true);
    case "submarine":
      return `<ellipse cx="0" cy="0" rx="13" ry="6.5" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="-12,0 -16,-5 -16,5" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="-3,-6 -1,-11 3,-11 4,-6" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <line x1="0.5" y1="-11" x2="0.5" y2="-15" stroke="#1a1a1a" stroke-width="0.8"/><line x1="0.5" y1="-15" x2="4" y2="-15" stroke="#1a1a1a" stroke-width="0.8"/>
              <circle cx="5" cy="0" r="2.2" fill="#1a1a1a"/>`;
    case "soccer-ball":
      return soccerBallSvg();
    case "pretzel":
      return `<g fill="none" stroke="${b}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M -3,-8 C -19,-17 -22,3 -7,8 C -2,10 2,10 7,8 C 22,3 19,-17 3,-8"/>
                <path d="M -3,-8 L 7,8"/>
                <path d="M 3,-8 L -7,8"/>
              </g>
              <g fill="${a}"><circle cx="-9" cy="-2" r="1"/><circle cx="9" cy="-2" r="1"/><circle cx="0" cy="9" r="1"/></g>`;
    case "fable":
      return `<polygon points="-8,-6 -13,-15 -3,-9" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="8,-6 13,-15 3,-9" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="-10,-8 10,-8 12,0 0,12 -12,0" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="0,12 -4,3 4,3" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
              <path d="M-12,0 L0,3 L12,0" fill="none" stroke="#1a1a1a" stroke-width="0.6"/>
              <circle cx="-5" cy="-2" r="1.4" fill="#1a1a1a"/>
              <circle cx="5" cy="-2" r="1.4" fill="#1a1a1a"/>`;
    default:
      // Total-switch guard: any shape without a bespoke vector (e.g. sprite
      // shapes, which paint from their PNG) falls back to the plane silhouette.
      return `<polygon points="-14,6 14,-6 1,0 14,-6 -1,11" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>`;
  }
}

/**
 * Classic 1960s "Telstar" football — white ball with black pentagon panels.
 * Fixed colours (not skin-tinted) so it always reads as the iconic ball.
 * Authored in the shared "-20..20" viewBox; used by both shape SVG renderers.
 */
export function soccerBallSvg(): string {
  const R = 14;
  const white = "#f4f4f4";
  const black = "#161616";
  const cR = R * 0.3;
  const oR = R * 0.23;
  const oRad = R * 0.7;
  const pent = (cx: number, cy: number, rad: number, rot: number): string => {
    const p: string[] = [];
    for (let j = 0; j < 5; j++) {
      const a = rot + (j * 2 * Math.PI) / 5;
      p.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
    }
    return p.join(" ");
  };
  let seams = "";
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + Math.PI / 5 + (k * 2 * Math.PI) / 5;
    seams += `<line x1="${(Math.cos(a) * cR * 0.95).toFixed(2)}" y1="${(Math.sin(a) * cR * 0.95).toFixed(2)}" x2="${(Math.cos(a) * (oRad - oR)).toFixed(2)}" y2="${(Math.sin(a) * (oRad - oR)).toFixed(2)}" stroke="${black}" stroke-width="0.55"/>`;
  }
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    seams += `<line x1="${(Math.cos(a) * oRad).toFixed(2)}" y1="${(Math.sin(a) * oRad).toFixed(2)}" x2="${(Math.cos(a) * R).toFixed(2)}" y2="${(Math.sin(a) * R).toFixed(2)}" stroke="${black}" stroke-width="0.55"/>`;
  }
  let panels = `<polygon points="${pent(0, 0, cR, -Math.PI / 2)}" fill="${black}"/>`;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + Math.PI / 5 + (k * 2 * Math.PI) / 5;
    panels += `<polygon points="${pent(Math.cos(a) * oRad, Math.sin(a) * oRad, oR, a)}" fill="${black}"/>`;
  }
  return `<circle cx="0" cy="0" r="${R}" fill="${white}" stroke="${black}" stroke-width="1.2"/>${seams}${panels}`;
}

/**
 * A MULTIPLY colour-matrix for a grayscale source × colour C: each output
 * channel becomes (C/255)·luminance — i.e. white→C, black→black — which mirrors
 * the in-game `multiply` tint. (The previous single feColorMatrix replaced the
 * whole sprite with a flat fill; this preserves the fold shading + outlines.)
 */
function tintMatrix(c: [number, number, number]): string {
  const r = (c[0] / 255).toFixed(3);
  const g = (c[1] / 255).toFixed(3);
  const b = (c[2] / 255).toFixed(3);
  return `${r} 0 0 0 0  ${g} 0 0 0 0  ${b} 0 0 0 0  0 0 0 1 0`;
}

/**
 * Sprite-backed preview. For two-colour sprites we render TWO <image> layers —
 * the accent PNG (multiplied by `accent`) BENEATH the base PNG (multiplied by
 * `body`) — so both colours show, exactly like the in-game composite. Sprites
 * without an accent layer (e.g. the crane) render just the base.
 */
function spritePreview(
  id: string,
  body: [number, number, number],
  accent?: [number, number, number],
  hasAccent = false,
): string {
  const baseFid = `tint-${id}-b`;
  const accFid = `tint-${id}-a`;
  const X = -19, W = 38;
  let defs = `<filter id="${baseFid}"><feColorMatrix type="matrix" values="${tintMatrix(body)}"/></filter>`;
  let layers = "";
  if (hasAccent && accent) {
    defs += `<filter id="${accFid}"><feColorMatrix type="matrix" values="${tintMatrix(accent)}"/></filter>`;
    layers += `<image href="/sprites/${id}-accent.png" x="${X}" y="${X}" width="${W}" height="${W}" filter="url(#${accFid})"/>`;
  }
  layers += `<image href="/sprites/${id}.png" x="${X}" y="${X}" width="${W}" height="${W}" filter="url(#${baseFid})"/>`;
  return `<defs>${defs}</defs>${layers}`;
}

// Color utilities for skin rarity classification. ΔE2000 is the
// CIE 2000 color difference formula. It's the most perceptually
// uniform of the common color-distance metrics and is the right
// choice for "how different do these look to a human" questions
// like the rarity classifier.

export type RGB = readonly [number, number, number];

export interface LAB {
  L: number;
  a: number;
  b: number;
}

export interface LCH {
  L: number;
  C: number;
  H: number; // degrees
}

function srgbToLinear(c: number): number {
  const cn = c / 255;
  return cn <= 0.04045 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4);
}

export function rgbToXyz([r, g, b]: RGB): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  // D65 sRGB matrix.
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;
  return [x, y, z];
}

const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;

function f(t: number): number {
  const d = 6 / 29;
  return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}

export function rgbToLab(rgb: RGB): LAB {
  const [x, y, z] = rgbToXyz(rgb);
  const fx = f(x / XN);
  const fy = f(y / YN);
  const fz = f(z / ZN);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function rgbToLch(rgb: RGB): LCH {
  const { L, a, b } = rgbToLab(rgb);
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export function deltaE2000(rgb1: RGB, rgb2: RGB): number {
  const lab1 = rgbToLab(rgb1);
  const lab2 = rgbToLab(rgb2);

  const C1 = Math.sqrt(lab1.a ** 2 + lab1.b ** 2);
  const C2 = Math.sqrt(lab2.a ** 2 + lab2.b ** 2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));

  const a1p = (1 + G) * lab1.a;
  const a2p = (1 + G) * lab2.a;
  const C1p = Math.sqrt(a1p ** 2 + lab1.b ** 2);
  const C2p = Math.sqrt(a2p ** 2 + lab2.b ** 2);
  let h1p = (Math.atan2(lab1.b, a1p) * DEG + 360) % 360;
  let h2p = (Math.atan2(lab2.b, a2p) * DEG + 360) % 360;

  const dLp = lab2.L - lab1.L;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * RAD) / 2);

  const Lbar = (lab1.L + lab2.L) / 2;
  const Cbar_p = (C1p + C2p) / 2;
  let Hbar_p = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) {
      Hbar_p = h1p + h2p < 360 ? Hbar_p + 360 : Hbar_p - 360;
    }
    Hbar_p /= 2;
  }

  const T =
    1 -
    0.17 * Math.cos((Hbar_p - 30) * RAD) +
    0.24 * Math.cos(2 * Hbar_p * RAD) +
    0.32 * Math.cos((3 * Hbar_p + 6) * RAD) -
    0.2 * Math.cos((4 * Hbar_p - 63) * RAD);

  const dTheta = 30 * Math.exp(-(((Hbar_p - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbar_p ** 7 / (Cbar_p ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const Sc = 1 + 0.045 * Cbar_p;
  const Sh = 1 + 0.015 * Cbar_p * T;
  const Rt = -Math.sin(2 * dTheta * RAD) * Rc;

  return Math.sqrt(
    (dLp / Sl) ** 2 +
      (dCp / Sc) ** 2 +
      (dHp / Sh) ** 2 +
      Rt * (dCp / Sc) * (dHp / Sh),
  );
}

export function hueDistanceDeg(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

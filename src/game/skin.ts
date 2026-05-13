export interface SkinColors {
  body: [number, number, number];
  accent: [number, number, number];
}

export const DEFAULT_SKIN: SkinColors = {
  body: [244, 234, 213],
  accent: [26, 26, 26],
};

export function encodeSkin(s: SkinColors): bigint {
  const [r1, g1, b1] = s.body;
  const [r2, g2, b2] = s.accent;
  return (
    (BigInt(r1) << 40n) |
    (BigInt(g1) << 32n) |
    (BigInt(b1) << 24n) |
    (BigInt(r2) << 16n) |
    (BigInt(g2) << 8n) |
    BigInt(b2)
  );
}

export function decodeSkin(v: bigint): SkinColors {
  const mask = 0xffn;
  return {
    body: [Number((v >> 40n) & mask), Number((v >> 32n) & mask), Number((v >> 24n) & mask)],
    accent: [Number((v >> 16n) & mask), Number((v >> 8n) & mask), Number(v & mask)],
  };
}

export function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r},${g},${b})`;
}

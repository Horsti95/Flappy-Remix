/**
 * Pillar colour — an optional player-pick that overrides the theme's pipe
 * colours for the equipped pillar style (so e.g. the candy style can be
 * red/white, the bamboo green, etc). "theme" keeps the theme's own colours.
 *
 * Cosmetic only; never touches the sim. High-contrast mode ignores it so the
 * a11y palette stays intact (handled in the renderer).
 */

export interface PillarColor {
  id: string;
  name: string;
  /** Empty when id === "theme" (renderer falls back to the theme palette). */
  body: string;
  cap: string;
}

export const PILLAR_COLORS: PillarColor[] = [
  { id: "theme", name: "theme", body: "", cap: "" },
  { id: "candy", name: "candy", body: "#e23b3b", cap: "#ffffff" },
  { id: "germany", name: "germany", body: "#dd0000", cap: "#ffce00" },
  { id: "forest", name: "forest", body: "#3d8b58", cap: "#1f4f37" },
  { id: "mint", name: "mint", body: "#5eead4", cap: "#0f4c4a" },
  { id: "grape", name: "grape", body: "#a855f7", cap: "#3a0a5e" },
  { id: "gold", name: "gold", body: "#facc15", cap: "#5a4500" },
  { id: "sky", name: "sky", body: "#38bdf8", cap: "#0c4a6e" },
  { id: "mono", name: "mono", body: "#e6e6e6", cap: "#1a1a1a" },
];

const BY_ID = new Map(PILLAR_COLORS.map((c) => [c.id, c]));

/** The chosen colour, or null for "theme" (use the theme's pipe colours). */
export function getPillarColor(id: string | null | undefined): PillarColor | null {
  if (!id || id === "theme") return null;
  return BY_ID.get(id) ?? null;
}

const KEY = "pflug.pillarColor.v1";

export function getEquippedPillarColorLocal(): string {
  try {
    return localStorage.getItem(KEY) ?? "theme";
  } catch {
    return "theme";
  }
}

export function setEquippedPillarColorLocal(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* localStorage blocked */
  }
}

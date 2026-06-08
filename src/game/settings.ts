export interface Settings {
  sound: boolean;
  /** Gate-pass "ding" on every point scored. Gated behind `sound` too. */
  gateSound: boolean;
  /** Death "thud" when the run ends. Gated behind `sound` too. */
  deathSound: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  /** Challenge-ghost opacity 0..100 (%), in 5% steps. 0 = ghost hidden. */
  ghostOpacity: number;
}

const KEY = "pflug.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  sound: false,
  gateSound: true,
  deathSound: true,
  highContrast: false,
  reducedMotion: false,
  ghostOpacity: 25,
};

/** OS-level "reduce motion" preference — used ONLY to seed the first-run
 *  default. Once the player has settings stored, their in-game toggle is the
 *  single source of truth (so they can turn motion back on even if the OS
 *  asks to reduce it). */
function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    // First run: honour the OS reduce-motion preference as the default, but
    // persist it so the toggle stays in control from here on.
    if (!raw) return { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion() };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // localStorage may be blocked; settings just won't persist
  }
}

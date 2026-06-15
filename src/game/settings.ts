export interface Settings {
  sound: boolean;
  /** Gate-pass "ding" on every point scored. Gated behind `sound` too. */
  gateSound: boolean;
  /** Death "thud" when the run ends. Gated behind `sound` too. */
  deathSound: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  /** Haptic feedback (vibration) on flap / score / crash. Independent of
   *  `sound` so silent-with-vibration play works. No-op where the platform
   *  has no vibration API (notably iOS Safari, which ignores navigator.vibrate
   *  — a native Taptic bridge replaces it when the app is wrapped). */
  haptics: boolean;
  /** Gate chime pitch follows the gap's height (high gap = higher note).
   *  Off = uniform pitch (the rhythm anchor). Unlockable at best score 50. */
  gatePitch: boolean;
  /** Challenge-ghost opacity 0..100 (%), in 5% steps. 0 = ghost hidden. */
  ghostOpacity: number;
  /** Debug/accessibility: draw the bird's collision circle so you can see the
   *  true hitbox vs. the rendered sprite. Off by default. */
  showHitbox: boolean;
}

const KEY = "pflug.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  gateSound: true,
  deathSound: true,
  highContrast: false,
  reducedMotion: false,
  haptics: true,
  gatePitch: false,
  ghostOpacity: 25,
  showHitbox: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
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

export interface Settings {
  sound: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

const KEY = "pflug.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  sound: false,
  highContrast: false,
  reducedMotion: false,
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

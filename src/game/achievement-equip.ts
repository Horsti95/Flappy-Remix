const KEY = "pflug.achColor.v1";

export function getEquippedAchievementColorLocal(): string | null {
  try {
    return localStorage.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export function setEquippedAchievementColorLocal(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

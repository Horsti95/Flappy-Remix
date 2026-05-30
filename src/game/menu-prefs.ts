/**
 * Menu-only display preferences. Separate from gameplay Settings
 * because these don't affect the sim — just the title-screen vibe.
 */

const SHOW_EQUIPPED_KEY = "pflug.showEquippedInMenu.v1";

export function getShowEquippedInMenu(): boolean {
  try {
    const v = localStorage.getItem(SHOW_EQUIPPED_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function setShowEquippedInMenu(on: boolean): void {
  try {
    localStorage.setItem(SHOW_EQUIPPED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

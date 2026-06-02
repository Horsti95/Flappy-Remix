import { type PickupKind } from "./sim";

/**
 * First-time pickup hints. The very first time a player grabs each kind of
 * pickup (coins included), Arcade shows a one-line explanation so the chaos is
 * learnable. "Seen" state is persisted in localStorage and is purely cosmetic /
 * client-side — it never touches the scored game or any server data.
 */
export interface PickupHint {
  title: string;
  text: string;
}

export const PICKUP_HINTS: Record<PickupKind, PickupHint> = {
  coin: { title: "🪙 Gold", text: "Collect coins for gold — your Arcade score. Perfect passes add bonus gold." },
  shield: { title: "🛡 Shield", text: "Absorbs one otherwise-fatal hit. Saved!" },
  "second-life": { title: "❤ 1-Up", text: "Revives you once on death, with a moment of invulnerability." },
  "slow-time": { title: "⏱ Slow-Mo", text: "Bullet-time: the whole world slows so you get more reaction time." },
  magnet: { title: "🧲 Magnet", text: "Pulls nearby coins toward you for a few seconds." },
  mini: { title: "▾ Mini", text: "Shrinks you — a smaller hitbox squeezes through tight gaps." },
  giant: { title: "▴ Giant", text: "Grows you: bigger target, but you SMASH saws for bonus gold." },
  "gravity-flip": { title: "⇅ Gravity Flip", text: "Gravity inverts — tap still pushes you away from the floor." },
  rocket: { title: "🚀 Rocket", text: "A burst of automatic climb. Ride it up and over." },
  ghost: { title: "👻 Ghost", text: "Phase straight through pipes and saws briefly." },
  frenzy: { title: "2× Frenzy", text: "Doubles all gold you earn for a few seconds." },
};

const KEY = "glide.arcade.seenPickups";

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function hasSeenPickup(kind: PickupKind): boolean {
  return load().has(kind);
}

export function markPickupSeen(kind: PickupKind): void {
  try {
    const seen = load();
    if (seen.has(kind)) return;
    seen.add(kind);
    localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    // Storage unavailable (private mode / quota) — hints just show every run.
  }
}

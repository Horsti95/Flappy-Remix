/**
 * Limited-time events ("packages").
 *
 * An event bundles EXISTING cosmetics behind a simple, free-to-earn path:
 * just play during the event window. Each play completed while the window is
 * open increments a date-latched counter; once it crosses an item's threshold
 * the item is unlocked — and STAYS unlocked afterwards (the counter never
 * resets and the catalog entry is permanent), so players keep what they earned
 * even after the window closes.
 *
 * Nothing here authors new art: every reward references a cosmetic id that
 * already exists (a shape, preset palette, pillar colour, flap fx, gate sound).
 * The pickers OR-in {@link isEventGranted} so an event simply opens an earlier,
 * free path to those cosmetics during the window.
 */

export type EventRewardKind = "shape" | "preset" | "pillar" | "fx" | "gate";

export interface EventReward {
  kind: EventRewardKind;
  /** Cosmetic id in its own catalog (e.g. "soccer-ball", "preset-gold"). */
  id: string;
  /** Display name for the popup. */
  label: string;
  /** Games to play during the window before this unlocks. Ignored when
   *  {@link onFinalDay} is set. */
  threshold: number;
  /** Finale reward: unlocks by playing a game on the event's FINAL day,
   *  regardless of how many games were played overall. */
  onFinalDay?: boolean;
}

export interface GameEvent {
  id: string;
  name: string;
  blurb: string;
  /** Inclusive ISO date window (yyyy-mm-dd), compared on local calendar days. */
  from: string;
  until: string;
  rewards: EventReward[];
}

// ---- Catalog --------------------------------------------------------------

export const EVENTS: GameEvent[] = [
  {
    id: "worldcup-2026",
    name: "World Cup",
    blurb: "Fly the tournament. Every game you play this window earns kit — free, just keep flying.",
    from: "2026-06-01",
    until: "2026-07-31",
    rewards: [
      { kind: "shape", id: "soccer-ball", label: "match ball", threshold: 1 },
      { kind: "pillar", id: "candy", label: "red-card posts", threshold: 2 },
      { kind: "preset", id: "preset-crimson", label: "home kit", threshold: 5 },
      { kind: "gate", id: "pop_choir", label: "crowd chant chime", threshold: 8 },
      { kind: "preset", id: "preset-ocean", label: "away kit", threshold: 11 },
      { kind: "fx", id: "sparkle", label: "confetti flap", threshold: 14 },
      { kind: "pillar", id: "gold", label: "trophy posts", threshold: 18 },
      // Finale: the golden boot is awarded for showing up on the final day.
      { kind: "preset", id: "preset-gold", label: "golden boot", threshold: 0, onFinalDay: true },
    ],
  },
];

// ---- Window + participation counter ---------------------------------------

function isoToday(now: Date): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return `${y}-${m < 10 ? "0" : ""}${m}-${d < 10 ? "0" : ""}${d}`;
}

/** The event whose window contains `now`, or null. */
export function getActiveEvent(now: Date = new Date()): GameEvent | null {
  const today = isoToday(now);
  return EVENTS.find((e) => today >= e.from && today <= e.until) ?? null;
}

function playsKey(eventId: string): string {
  return `pflug.event.${eventId}.plays`;
}

function finalDayKey(eventId: string): string {
  return `pflug.event.${eventId}.finalday`;
}

/** Whether the player played a game on this event's FINAL day (latched). */
export function finalDayPlayed(eventId: string): boolean {
  try {
    return localStorage.getItem(finalDayKey(eventId)) === "1";
  } catch {
    return false;
  }
}

/** How many games the player has completed during this event's window. */
export function eventPlays(eventId: string): number {
  try {
    return Number(localStorage.getItem(playsKey(eventId)) ?? "0") || 0;
  } catch {
    return 0;
  }
}

/**
 * Record one completed game. If an event window is open, bump its counter.
 * Returns the list of rewards that JUST crossed their threshold (for an
 * "unlocked!" toast, if the caller wants one).
 */
export function recordEventPlay(now: Date = new Date()): EventReward[] {
  const ev = getActiveEvent(now);
  if (!ev) return [];
  const before = eventPlays(ev.id);
  const after = before + 1;
  const onFinalDay = isoToday(now) === ev.until;
  const finalFirst = onFinalDay && !finalDayPlayed(ev.id);
  try {
    localStorage.setItem(playsKey(ev.id), String(after));
    if (onFinalDay) localStorage.setItem(finalDayKey(ev.id), "1");
  } catch {
    /* localStorage blocked — event progress just won't persist */
  }
  // Rewards that JUST crossed: threshold rewards that ticked over, plus any
  // final-day reward the moment the player shows up on the last day.
  return ev.rewards.filter((r) =>
    r.onFinalDay ? finalFirst : before < r.threshold && after >= r.threshold,
  );
}

/** Whether `id` of `kind` has been earned through ANY event (window-agnostic:
 *  earned items stay earned). Cheap — pure counter/threshold lookup. */
export function isEventGranted(kind: EventRewardKind, id: string): boolean {
  for (const ev of EVENTS) {
    const plays = eventPlays(ev.id);
    for (const r of ev.rewards) {
      if (r.kind !== kind || r.id !== id) continue;
      if (r.onFinalDay) {
        if (finalDayPlayed(ev.id)) return true;
      } else if (plays > 0 && plays >= r.threshold) {
        return true;
      }
    }
  }
  return false;
}

/** Progress snapshot for the event popup / gallery. */
export function eventProgress(ev: GameEvent): {
  plays: number;
  rewards: Array<EventReward & { unlocked: boolean }>;
} {
  const plays = eventPlays(ev.id);
  const final = finalDayPlayed(ev.id);
  return {
    plays,
    rewards: ev.rewards.map((r) => ({
      ...r,
      unlocked: r.onFinalDay ? final : plays >= r.threshold,
    })),
  };
}

// ---- "Available now" popup, shown once per event --------------------------

function seenKey(eventId: string): string {
  return `pflug.event.${eventId}.seen.v1`;
}

export function eventAnnounced(eventId: string): boolean {
  try {
    return localStorage.getItem(seenKey(eventId)) === "1";
  } catch {
    return false;
  }
}

export function markEventAnnounced(eventId: string): void {
  try {
    localStorage.setItem(seenKey(eventId), "1");
  } catch {
    /* ignore */
  }
}

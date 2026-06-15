import {
  TIER_COLOR,
  TIER_LABEL,
  computeIntensity,
  visualEffectIntensity,
  intensityBand,
  intensityPercentLabel,
  INTENSITY_BAND_COLOR,
  type DailyPick,
} from "../game/daily-twist";

export interface DailyLandingMeta {
  date: string;
  pick: DailyPick;
  playsCount: number;
  bestScore: number | null;
  streakDays: number;
  /** Attempts already used today (best-of-3). */
  attemptsUsed: number;
  /** Max attempts per UTC day. */
  maxAttempts: number;
  /** Player's equipped pillar style is see-through (glass) — a self-imposed
   *  extra difficulty for today's daily. Shown as a heads-up chip. */
  glassHandicap?: boolean;
}

export interface DailyLandingCallbacks {
  onPlay(): void;
  /** Play a casual (non-daily) run instead — offered once attempts run out. */
  onPlayCasual?(): void;
  onClose(): void;
}

export function renderDailyLanding(
  host: HTMLElement,
  meta: DailyLandingMeta,
  cbs: DailyLandingCallbacks,
): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "hangar-surface pointer-events-auto absolute inset-0 z-30 backdrop-blur-sm font-display flex flex-col";

  const tierColor = TIER_COLOR[meta.pick.tier];
  const tierLabel = TIER_LABEL[meta.pick.tier];
  const isSuperHard = meta.pick.tier === "super_hard";
  const modifierList = meta.pick.modifiers.map((m) => m.name).join(" + ");

  // Overall intensity: modifiers compound, plus the glass-pillar handicap if
  // the player equipped it. Shown as a named band + percent.
  const intensity = computeIntensity(
    meta.pick.modifiers,
    (meta.glassHandicap ? 1.15 : 1) * visualEffectIntensity(meta.pick.visualEffect),
  );
  const band = intensityBand(intensity);
  const bandColor = INTENSITY_BAND_COLOR[band];

  // Combined tier + intensity header line: one row carries the tier label, the
  // named intensity band and its percent — no separate tier chip / band chip.
  const tierIntensityRow = `
    <div class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold">
      <span class="rounded-full px-3 py-0.5 uppercase tracking-wider"
            style="background:${tierColor}22; color:${tierColor}">${tierLabel}</span>
      <span class="inline-flex items-center gap-1.5" style="color:${bandColor}">
        <span class="uppercase tracking-wider">${band}</span>
        <span class="opacity-70 font-medium">${intensityPercentLabel(intensity)}</span>
      </span>
    </div>`;

  // Modifiers: each one its own paper chip (e.g. "gap +20px"), so the twist
  // reads as torn notes pinned to the day rather than a grey text run-on.
  const modifierChips = `
    <div class="flex flex-wrap items-center justify-center gap-2">
      ${meta.pick.modifiers
        .map((m) => `<span class="paper-chip">${escapeHtml(m.blurb)}</span>`)
        .join("")}
    </div>`;

  // Glass + visual-effect notes, as the same paper-chip heads-up.
  const noteChips: string[] = [];
  if (meta.pick.visualEffect) noteChips.push(visualChip(meta.pick.visualEffect));
  if (meta.glassHandicap) noteChips.push("🪟 glass pillars — harder to read");
  const notesRow =
    noteChips.length > 0
      ? `<div class="flex flex-wrap items-center justify-center gap-2">
          ${noteChips.map((c) => `<span class="paper-chip">${c}</span>`).join("")}
        </div>`
      : "";

  const remaining = Math.max(0, meta.maxAttempts - meta.attemptsUsed);
  const exhausted = remaining <= 0;

  // The three essentials, side by side: difficulty band, daily best, attempts.
  const bestValue = meta.bestScore != null ? String(meta.bestScore) : "—";
  const attemptsValue = `${remaining}/${meta.maxAttempts}`;
  const streakNote =
    meta.streakDays > 0
      ? `<div class="text-[11px] opacity-60">🔥 ${meta.streakDays}-day streak · ${formatPlays(meta.playsCount)} played today</div>`
      : `<div class="text-[11px] opacity-50">${formatPlays(meta.playsCount)} played today</div>`;

  const statCell = (label: string, value: string, color?: string) => `
    <div class="paper-note px-3 py-2.5 rounded-xl">
      <div class="text-base font-bold leading-none"${color ? ` style="color:${color}"` : ""}>${value}</div>
      <div class="mt-1 text-[9px] uppercase tracking-wider opacity-60">${label}</div>
    </div>`;
  const statsGrid = `
    <div class="mt-2 grid grid-cols-3 gap-2 text-center w-full max-w-[280px]">
      ${statCell("difficulty", band, bandColor)}
      ${statCell("daily best", bestValue)}
      ${statCell("attempts left", attemptsValue)}
    </div>`;

  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <button data-back class="text-sm underline opacity-70">back</button>
      <div class="text-[11px] opacity-60 uppercase tracking-wider">today's daily</div>
      <div style="width: 40px;"></div>
    </div>
    <div class="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
      <div class="text-[10px] uppercase tracking-wider opacity-60">${escapeHtml(meta.date)}</div>
      <div class="font-hand text-[13px] opacity-70">Everyone flies the same wind today.</div>
      ${tierIntensityRow}
      <div class="mt-1 text-2xl font-bold leading-tight font-hand">${escapeHtml(modifierList)}</div>
      ${modifierChips}
      ${notesRow}
      ${statsGrid}
      ${streakNote}
    </div>
    <div class="px-5 pb-6">
      ${
        exhausted
          ? `<div class="w-full rounded-2xl bg-white/10 py-4 text-center text-sm opacity-80">${meta.maxAttempts} attempts used — come back tomorrow</div>
             <button data-casual class="mt-2 w-full text-[12px] underline opacity-60">play a casual run instead</button>`
          : `<button data-play class="w-full rounded-2xl bg-paper text-ink font-bold py-4 text-lg active:scale-95 transition"
                  style="${isSuperHard ? `box-shadow: inset 0 0 0 2px ${tierColor}` : ""}">
            ${isSuperHard ? "play anyway" : "play"} <span class="opacity-60 text-sm">(${remaining} left)</span>
          </button>`
      }
      <div class="mt-2 text-[10px] opacity-50 text-center">same seed for the world today</div>
    </div>
  `;
  host.appendChild(wrap);

  const close = () => {
    wrap.remove();
    cbs.onClose();
  };
  wrap.querySelector("[data-back]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });
  wrap.querySelector("[data-play]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.remove();
    cbs.onPlay();
  });
  wrap.querySelector("[data-casual]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.remove();
    cbs.onPlayCasual?.();
  });

  return () => wrap.remove();
}

function formatPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function visualChip(fx: NonNullable<DailyLandingMeta["pick"]["visualEffect"]>): string {
  const labels: Record<string, string> = {
    night: "🌙 night sky",
    sunset: "🌅 sunset glow",
    blinding_sun: "🔆 blinding sun — glare on the right",
    rain: "🌧️ light rain",
    fog: "🌫️ thick fog — limited visibility",
  };
  return labels[fx] ?? "";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

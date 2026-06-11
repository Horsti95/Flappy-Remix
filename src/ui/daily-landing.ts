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


// Weather-report fiction: each modifier reads as a line of today's forecast
// instead of a mechanical listing. The mechanics stay in parentheses so the
// information is never lost — the story is seasoning, not obfuscation.
const WEATHER_STORY: Record<string, string> = {
  heavy: "🌬 strong downwinds press on your wings (gravity up)",
  floaty: "🎈 warm thermals carry you (gravity down)",
  faster: "💨 a stiff tailwind — everything arrives sooner (speed up)",
  wider_gaps: "🏞 the canyon opens up today (wider gaps)",
  tight_gaps: "⛰ the canyon narrows — thread carefully (tighter gaps)",
  big_flap: "📐 your folds are crisp — extra lift on every flap",
  small_hitbox: "🪶 you feel light as tissue paper (smaller hitbox)",
  big_hitbox: "💧 soggy paper — you fly bigger than you look",
  mirror: "🔄 the wind blows the other way — the world is mirrored",
  flip_gravity: "🙃 the sky turned upside down (inverted gravity)",
};
const WEATHER_VISUAL: Record<string, string> = {
  night: "🌙 you fly by starlight tonight",
  sunset: "🌇 golden hour — all glow, no danger",
  rain: "🌧 rain streaks the page",
  blinding_sun: "☀️ low sun in your eyes — gates hide in the glare",
  fog: "🌫 thick fog — gates appear late",
};

export function renderDailyLanding(
  host: HTMLElement,
  meta: DailyLandingMeta,
  cbs: DailyLandingCallbacks,
): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-30 bg-black/85 backdrop-blur-sm font-display text-paper flex flex-col";

  const tierColor = TIER_COLOR[meta.pick.tier];
  const tierLabel = TIER_LABEL[meta.pick.tier];
  const isSuperHard = meta.pick.tier === "super_hard";
  const modifierList = meta.pick.modifiers.map((m) => m.name).join(" + ");
  const forecastLines = [
    ...meta.pick.modifiers.map((m) => WEATHER_STORY[m.id] ?? `${m.name} — ${m.blurb}`),
    ...(meta.pick.visualEffect ? [WEATHER_VISUAL[meta.pick.visualEffect] ?? ""] : []),
  ].filter(Boolean);

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

  // Glass + visual-effect notes, integrated as small inline heads-up chips.
  const noteChips: string[] = [];
  if (meta.glassHandicap) noteChips.push("🪟 glass pillars — harder to read");
  const notesRow =
    noteChips.length > 0
      ? `<div class="flex flex-wrap items-center justify-center gap-2">
          ${noteChips
            .map(
              (c) =>
                `<span class="rounded-full bg-white/5 px-3 py-1 text-[11px] opacity-80">${c}</span>`,
            )
            .join("")}
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
    <div class="rounded-xl bg-white/5 px-3 py-2.5">
      <div class="text-base font-bold leading-none"${color ? ` style="color:${color}"` : ""}>${value}</div>
      <div class="mt-1 text-[9px] uppercase tracking-wider opacity-50">${label}</div>
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
      <div class="mt-1 text-xl font-bold leading-tight">${escapeHtml(modifierList)}</div>
      <div class="mt-2 w-full max-w-[300px] paper-note bg-paper/95 text-ink text-left px-4 py-3">
        <div class="font-hand text-[13px] font-bold opacity-70">today's weather report</div>
        ${forecastLines
          .map((l) => `<div class="mt-1 text-[12px] leading-snug">${escapeHtml(l)}</div>`)
          .join("")}
      </div>
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


function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

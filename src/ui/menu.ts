import { type Settings } from "../game/settings";
import { RARITY_COLOR, type Rarity } from "../game/rarity";
import { TIER_COLOR, TIER_LABEL, type Tier } from "../game/daily-twist";
import { playUnlockSound, triggerUnlockHaptic } from "../game/sfx";
import { DEFAULT_SHAPE_ID, type ShapeId } from "../game/shapes";
import { DEFAULT_SKIN, type SkinColors } from "../game/skin";
import { getTheme, DEFAULT_THEME_ID, type ThemeId } from "../game/themes";
import { shapeSvgInner } from "./shape-svg";
import { SUPPORT_ENABLED, SUPPORT_URL } from "../game/support";
import { APP_VERSION } from "../game/changelog";
import { getShowEquippedInMenu, setShowEquippedInMenu } from "../game/menu-prefs";
import { levelFromTotalXp, loadTotalXp, type RunXpResult } from "../game/xp";
import { loadAchievementStats } from "../game/achievements";
import { type NextUnlockHint } from "../game/next-unlock";
import { feedbackFormHtml, bindFeedbackForm } from "./feedback-form";

export interface MenuCallbacks {
  onPlay(): void;
  onTraining(): void;
  onPlayDaily(): void;
  onToggleSetting(key: keyof Settings): void;
  onSetGhostOpacity(pct: number): void;
  onShowChangelog(): void;
  onHowToPlay(): void;
  onOpenAccount(): void;
  onOpenSkins(): void;
  onOpenLeaderboard(): void;
  onOpenFriends(): void;
  onOpenRanked(): void;
  onOpenInbox(): void;
  onOpenQuests(): void;
}

export interface MenuMeta {
  accountLabel: string;
  daily: {
    date: string;
    playsCount: number;
    tier: Tier;
    modifierNames: string[];
    modifierBlurbs: string[];
  } | null;
  streakDays: number;
  pendingSubmissions?: number;
  online?: boolean;
  /** Equipped shape — drives the mascot above the title. */
  equippedShape?: ShapeId;
  /** Equipped skin colours — drives mascot paint. Null = default cream/ink. */
  equippedSkin?: SkinColors;
  /** Equipped theme — drives the menu sky gradient. */
  equippedTheme?: ThemeId;
  /** User toggle: when false the menu always shows the default paper plane. */
  showEquippedInMenu?: boolean;
  /** Count of unseen incoming challenges — drives the inbox badge. */
  inboxUnseen?: number;
}

export function renderMenu(host: HTMLElement, settings: Settings, cbs: MenuCallbacks, meta: MenuMeta): void {
  host.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  // Theme-tinted backdrop: pull the equipped theme's sky gradient
  // into a CSS variable so the menu reads as the same world the
  // player is about to fly in.
  const showEquipped = meta.showEquippedInMenu !== false;
  const theme = getTheme(showEquipped ? (meta.equippedTheme ?? DEFAULT_THEME_ID) : DEFAULT_THEME_ID);
  const skyTop = theme.colors.skyTop;
  const skyBottom = theme.colors.skyBottom;
  wrap.className = "pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center text-center font-display menu-bg-paper backdrop-blur-sm text-paper";
  wrap.style.setProperty("--menu-sky-top", skyTop);
  wrap.style.setProperty("--menu-sky-bottom", skyBottom);
  const dailyLine = meta.daily
    ? `${formatPlays(meta.daily.playsCount)} played today`
    : "world plays the same level today";
  const tierChip = meta.daily
    ? `<span class="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider" style="background:${TIER_COLOR[meta.daily.tier]}22;color:${TIER_COLOR[meta.daily.tier]}">${TIER_LABEL[meta.daily.tier]}</span>`
    : "";
  const modifierLine = meta.daily && meta.daily.modifierNames.length > 0
    ? `<div class="mt-1 text-[11px] opacity-70 truncate">${meta.daily.modifierNames.map(escapeHtml).join(" + ")}</div>`
    : "";
  const levelBadge = `<span class="mr-1.5 inline-flex items-center text-[10px] font-bold bg-ink/15 rounded-full px-2 py-0.5">LV ${levelFromTotalXp(loadTotalXp()).level}</span>`;
  const streakBadge = meta.streakDays > 0
    ? `<span class="ml-2 inline-flex items-center gap-1 text-[11px] font-bold bg-orange-500/25 text-orange-700 rounded-full px-2.5 py-0.5">🔥 ${meta.streakDays}</span>`
    : "";
  const offlineBadge = meta.online === false
    ? `<div class="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] rounded-full px-2 py-0.5 bg-orange-400/30 text-paper">offline${meta.pendingSubmissions ? ` · ${meta.pendingSubmissions} queued` : ""}</div>`
    : meta.pendingSubmissions
      ? `<div class="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] rounded-full px-2 py-0.5 bg-paper/15">${meta.pendingSubmissions} queued</div>`
      : "";

  wrap.innerHTML = `
    ${offlineBadge}
    <button data-settings class="absolute top-3 left-3 paper-chip text-[16px] leading-none active:scale-95 transition" aria-label="Settings">⚙</button>
    <button data-account class="absolute top-3 right-3 paper-chip active:scale-95 transition">${levelBadge}${escapeHtml(meta.accountLabel)}${streakBadge}</button>
    <div data-menu-content class="px-6 max-w-sm w-full">
      <div class="relative h-16 mb-2">
        <svg viewBox="-20 -20 40 40" data-menu-mascot class="menu-mascot absolute left-1/2 -translate-x-1/2 w-16 h-16">
          ${shapeSvgInner(
            showEquipped ? (meta.equippedShape ?? DEFAULT_SHAPE_ID) : DEFAULT_SHAPE_ID,
            showEquipped && meta.equippedSkin ? meta.equippedSkin.body : DEFAULT_SKIN.body,
            showEquipped && meta.equippedSkin ? meta.equippedSkin.accent : DEFAULT_SKIN.accent,
          )}
        </svg>
      </div>
      <h1 class="menu-title text-6xl font-bold tracking-tight">Glide</h1>
      <p class="mt-2 text-[11px] italic opacity-60">guide the paper plane through the gaps</p>

      <div class="mt-6 grid grid-cols-2 gap-3">
        <button data-action="play" class="paper-note font-hand font-bold py-5 text-2xl active:scale-95 transition">
          Play
        </button>
        <button data-action="daily" class="paper-note py-3 px-4 text-left active:scale-95 transition">
          <div class="text-[10px] uppercase tracking-wider opacity-65 flex items-center gap-1.5">
            <span class="font-hand text-[12px] font-bold normal-case tracking-normal">Daily</span>${tierChip}
          </div>
          <div class="text-sm leading-tight mt-0.5 font-hand font-bold">${modifierLine ? meta.daily!.modifierBlurbs.map(escapeHtml).join(" + ") : "same seed worldwide"}</div>
          <div class="text-[9px] opacity-55 mt-1">${dailyLine}</div>
        </button>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2">
        <button data-action="ranked" class="paper-note font-hand font-bold py-3 text-base active:scale-95 transition">
          Ranked
        </button>
        <button data-action="inbox" class="relative paper-note font-hand font-bold py-3 text-base active:scale-95 transition">
          Challenges
          ${meta.inboxUnseen && meta.inboxUnseen > 0
            ? `<span class="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">${meta.inboxUnseen > 9 ? "9+" : meta.inboxUnseen}</span>`
            : ""}
        </button>
      </div>

      <div class="mt-3 grid grid-cols-3 gap-1.5">
        <button data-action="friends" class="paper-note font-hand font-bold py-2.5 text-[12px] active:scale-95 transition">
          Friends
        </button>
        <button data-action="leaderboard" class="paper-note font-hand font-bold py-2.5 text-[12px] active:scale-95 transition">
          Board
        </button>
        <button data-action="skins" class="paper-note font-hand font-bold py-2.5 text-[12px] active:scale-95 transition">
          Gallery
        </button>
      </div>
      <button data-action="training" class="block mx-auto mt-3 text-[11px] opacity-60 hover:opacity-90 transition-opacity underline">🪶 practice mode (untracked)</button>
      ${
        SUPPORT_ENABLED
          ? `<a href="${escapeHtml(SUPPORT_URL)}" target="_blank" rel="noopener noreferrer" data-support class="block mt-4 text-center text-[11px] opacity-50 hover:opacity-90 transition-opacity">☕ buy me a coffee</a>`
          : ""
      }
    </div>
    <div data-settings-panel class="hidden absolute inset-0 z-20 flex flex-col justify-end pointer-events-auto">
      <div class="bg-black/40 absolute inset-0" data-settings-backdrop></div>
      <div class="hangar-surface relative rounded-t-3xl px-5 py-6 pb-10 max-h-[85vh] overflow-y-auto border-t-2 border-paper/25">
        <h2 class="font-hand text-2xl font-bold mb-3">Settings</h2>

        <div class="panel-group-label">Audio &amp; feel</div>
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          ${toggle("sound", "All sound", settings.sound)}
          ${toggle("gateSound", "Score sound", settings.gateSound)}
          ${toggle("deathSound", "Crash sound", settings.deathSound)}
          ${toggle("haptics", "Vibration", settings.haptics)}
          ${loadAchievementStats().bestScore >= 50
            ? toggle("gatePitch", "Gate pitch ↗", settings.gatePitch)
            : `<div class="rounded-xl border border-paper/15 py-2 px-1 opacity-50"><div class="opacity-70">Gate pitch ↗</div><div class="mt-1 text-[10px]">🔒 score 50</div></div>`}
        </div>

        <div class="panel-group-label">Display</div>
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          ${toggle("reducedMotion", "Reduced motion", settings.reducedMotion)}
          ${toggle("highContrast", "High contrast", settings.highContrast)}
          ${toggle("showHitbox", "Show hitbox", settings.showHitbox)}
        </div>
        <label class="panel-row mt-2 rounded-2xl bg-white/5 cursor-pointer">
          <span class="opacity-90">Show my plane + sky in the menu</span>
          <input type="checkbox" data-show-equipped ${getShowEquippedInMenu() ? "checked" : ""} class="w-5 h-5 accent-paper" />
        </label>

        <div class="panel-group-label">Gameplay</div>
        <div class="panel-group">
          <div class="panel-row flex-col items-stretch gap-1">
            <div class="flex items-center justify-between">
              <span class="opacity-90">Ghost opacity</span>
              <span data-ghost-val class="opacity-70 tabular-nums">${settings.ghostOpacity}%</span>
            </div>
            <input type="range" min="0" max="100" step="5" value="${settings.ghostOpacity}" data-ghost-opacity class="w-full accent-paper" />
          </div>
        </div>

        <div class="panel-group-label">Feedback</div>
        <div class="rounded-2xl bg-white/5 p-3">
          ${feedbackFormHtml()}
        </div>

        <div class="panel-group-label">About</div>
        <div class="panel-group">
          <button data-howtoplay class="panel-row w-full text-left hover:bg-white/5">
            <span class="opacity-90">🎓 How to play</span>
            <span class="opacity-50">›</span>
          </button>
          <button data-whatsnew class="panel-row w-full text-left hover:bg-white/5">
            <span class="opacity-90">📜 What's new (history)</span>
            <span class="opacity-50">v${APP_VERSION} ›</span>
          </button>
          ${
            SUPPORT_ENABLED
              ? `<a href="${escapeHtml(SUPPORT_URL)}" target="_blank" rel="noopener noreferrer" data-support class="panel-row hover:bg-white/5">
                   <span class="opacity-90">☕ About the creator — buy me a coffee</span>
                   <span class="opacity-50">›</span>
                 </a>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
  host.appendChild(wrap);
  bindFeedbackForm(wrap);
  const flyOutThenPlay = (action: () => void): void => {
    const mascot = wrap.querySelector("[data-menu-mascot]");
    const content = wrap.querySelector("[data-menu-content]");
    if (!mascot || !content || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      action();
      return;
    }
    mascot.classList.remove("menu-mascot");
    mascot.classList.add("menu-mascot-flyout");
    content.classList.add("menu-content-fade");
    window.setTimeout(action, 380);
  };
  wrap.querySelector('[data-action="play"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    flyOutThenPlay(() => cbs.onPlay());
  });
  wrap.querySelector('[data-action="daily"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onPlayDaily();
  });
  wrap.querySelector('[data-action="training"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onTraining();
  });
  wrap.querySelector('[data-action="inbox"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenInbox();
  });
  wrap.querySelector('[data-action="skins"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenSkins();
  });
  wrap.querySelector('[data-action="leaderboard"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenLeaderboard();
  });
  wrap.querySelector('[data-action="friends"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenFriends();
  });
  wrap.querySelector('[data-action="ranked"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenRanked();
  });
  wrap.querySelector("[data-account]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenAccount();
  });
  wrap.querySelector("[data-settings]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.querySelector("[data-settings-panel]")?.classList.remove("hidden");
  });
  wrap.querySelector("[data-settings-backdrop]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.querySelector("[data-settings-panel]")?.classList.add("hidden");
  });
  wrap.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      cbs.onToggleSetting(btn.dataset.toggle as keyof Settings);
    });
  });
  wrap.querySelector("[data-show-equipped]")?.addEventListener("change", (e) => {
    e.stopPropagation();
    setShowEquippedInMenu((e.target as HTMLInputElement).checked);
  });
  const ghostSlider = wrap.querySelector("[data-ghost-opacity]") as HTMLInputElement | null;
  ghostSlider?.addEventListener("input", (e) => {
    e.stopPropagation();
    const pct = Number((e.target as HTMLInputElement).value);
    const val = wrap.querySelector("[data-ghost-val]");
    if (val) val.textContent = `${pct}%`;
    cbs.onSetGhostOpacity(pct);
  });
  wrap.querySelector("[data-whatsnew]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onShowChangelog();
  });
  wrap.querySelector("[data-howtoplay]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onHowToPlay();
  });
}

/**
 * The brighter of the skin's two colours as a CSS color — bright enough to
 * carry text on the dark death card, else the default paper cream.
 */
function pickReadableAccent(skin: SkinColors): string {
  const lum = (c: [number, number, number]) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  const best = lum(skin.accent) >= lum(skin.body) ? skin.accent : skin.body;
  return lum(best) >= 0.45 ? `rgb(${best.join(",")})` : "#f4ead5";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}


function formatPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function toggle(key: keyof Settings, label: string, on: boolean): string {
  return `
    <button data-toggle="${key}" class="rounded-xl border ${on ? "bg-paper/20 border-paper" : "border-paper/30"} py-2 px-1">
      <div class="opacity-70">${label}</div>
      <div class="mt-1 font-bold">${on ? "on" : "off"}</div>
    </button>
  `;
}

export function renderPauseOverlay(host: HTMLElement, onResume: () => void, onQuit: () => void): void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.id = "pause-overlay";
  wrap.className = "pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-sm text-paper font-display";
  wrap.innerHTML = `
    <div class="paper-note px-8 py-7 text-center flex flex-col items-center">
      <div class="text-3xl font-bold font-hand">paused</div>
      <button data-resume class="btn mt-6 py-3 px-10 text-base bg-ink text-paper font-bold">resume</button>
      <button data-quit class="mt-3 text-xs underline opacity-60">quit run</button>
    </div>
  `;
  host.appendChild(wrap);
  wrap.querySelector("[data-resume]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onResume();
  });
  wrap.querySelector("[data-quit]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onQuit();
  });
}

export function removePauseOverlay(host: HTMLElement): void {
  host.querySelector("#pause-overlay")?.remove();
}

export interface GameOverResult {
  result?: {
    accepted?: boolean;
    reason?: string;
    total_games?: number;
    unlocked?: Array<{
      threshold: number;
      rarity: Rarity;
      body: [number, number, number];
      accent: [number, number, number];
    }>;
  } | null;
  ticks?: number;
  onShare?: () => void;
  challengeContext?: {
    creator: string;
    creatorScore: number;
    canChallengeBack: boolean;
  };
  onChallengeBack?: () => void;
  challengeCreate?: {
    friendName: string | null;
    canSubmit: boolean;
    onSubmit: () => void;
  };
  /** Training/practice run — nothing tracked; show a lightweight game-over. */
  trainingMode?: boolean;
  /** Equipped skin colours — the death card's accent strip / highlights
   *  adapt to the player's colour scheme. */
  skin?: SkinColors;
  /** Equipped shape — unlock celebrations preview the new colour on the
   *  player's actual plane (sprite-aware) instead of a generic polygon. */
  shape?: ShapeId;
  /** Per-run progression beat: PB delta, pilot XP tick, next-unlock
   *  breadcrumb. Absent for practice runs. */
  progress?: {
    prevBest: number;
    isNewPb: boolean;
    xp: RunXpResult;
    nextUnlock: NextUnlockHint | null;
  };
  /** Racing a player's best run (ghost). Shows a "vs @them" result but is a
   *  local race — no duel/server entanglement, just Play again / menu. */
  raceContext?: { creator: string; creatorScore: number };
  /** Ranked round just played (0-based) of `total` — drives the
   *  "round submitted, back to match" action instead of a replay. */
  rankedRound?: { round: number; total: number };
  /** Achievements newly earned this run. Shown as full-screen,
   *  click-to-dismiss celebration cards (one per achievement) BEFORE the
   *  game-over panel — so the player actually reads each one instead of a
   *  toast that flashes by. */
  achievements?: Array<{
    name: string;
    blurb: string;
    /** What the achievement grants. Color rewards paint the plane preview;
     *  fx/sound rewards show a generic icon + the unlocked option's label. */
    reward:
      | { type: "color"; body: [number, number, number]; accent: [number, number, number] }
      | { type: "fx"; label: string }
      | { type: "sound"; label: string };
  }>;
}

export function renderGameOver(
  host: HTMLElement,
  score: number,
  onRestart: () => void,
  onMenu: () => void,
  extra?: GameOverResult,
): void {
  // Build one celebration queue: skin unlocks first, then achievements.
  // Each is a full-screen card the player dismisses with "Continue", so
  // multiple unlocks in one run are all seen one after another.
  const skinItems: CelebrationItem[] = (extra?.result?.unlocked ?? []).map((u) => ({
    kind: "skin",
    threshold: u.threshold,
    rarity: u.rarity,
    body: u.body,
    accent: u.accent,
  }));
  const achItems: CelebrationItem[] = (extra?.achievements ?? []).map((a) => ({
    kind: "achievement",
    name: a.name,
    blurb: a.blurb,
    reward: a.reward,
  }));
  const items = [...skinItems, ...achItems];
  if (items.length > 0) {
    renderUnlockCelebration(host, items, extra?.shape ?? DEFAULT_SHAPE_ID, () => {
      renderGameOverInner(host, score, onRestart, onMenu, extra);
    });
    return;
  }
  renderGameOverInner(host, score, onRestart, onMenu, extra);
}

function renderGameOverInner(
  host: HTMLElement,
  score: number,
  onRestart: () => void,
  onMenu: () => void,
  extra?: GameOverResult,
): void {
  const ctx = extra?.challengeContext;
  const race = extra?.raceContext;
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  // The result is a solid CARD, not a transparent wash: it has to read
  // instantly over any equipped background, and the accent strip / score
  // pick up the player's skin colours so the screen feels like THEIRS.
  wrap.className = "pointer-events-auto absolute inset-x-0 bottom-0 z-10 px-4 pb-5 pt-10 bg-gradient-to-t from-black/60 to-transparent text-paper font-display";
  const cardSkin = extra?.skin ?? DEFAULT_SKIN;
  const accentCss = pickReadableAccent(cardSkin);
  const stripCss = `linear-gradient(90deg, rgb(${cardSkin.body.join(",")}), rgb(${cardSkin.accent.join(",")}))`;
  const unlocks = extra?.result?.unlocked ?? [];
  const unlocksHtml = unlocks.length > 0 ? renderUnlocks(unlocks) : "";
  const acceptStatus = extra?.trainingMode
    ? `<div class="text-[10px] opacity-50">practice — not tracked</div>`
    : extra?.result
    ? extra.result.accepted
      ? `<div class="text-[10px] opacity-60">submitted · ${extra.result.total_games ?? "?"} games total</div>`
      : `<div class="text-[10px] opacity-40">offline / not accepted</div>`
    : "";
  const versus = ctx
    ? `<div class="mt-2 rounded-2xl bg-white/10 px-4 py-3 text-left">
         <div class="text-[10px] uppercase tracking-wider opacity-60">vs @${escapeHtml(ctx.creator)}</div>
         <div class="flex items-baseline justify-between mt-1">
           <div><span class="text-2xl font-bold">${score}</span> <span class="opacity-50">you</span></div>
           <div class="opacity-70">${ctx.creatorScore} <span class="opacity-50">them</span></div>
         </div>
         <div class="text-2xl font-bold mt-2 ${score > ctx.creatorScore ? "text-green-300" : score < ctx.creatorScore ? "text-orange-300" : "opacity-70"}">${
           score > ctx.creatorScore ? "YOU WIN 🏆" : score < ctx.creatorScore ? "YOU LOST" : "TIE"
         }</div>
         <button data-brag class="mt-2 text-[11px] underline opacity-60">share result</button>
       </div>`
    : "";
  const raceVersus = race
    ? `<div class="mt-2 rounded-2xl bg-white/10 px-4 py-3 text-left">
         <div class="text-[10px] uppercase tracking-wider opacity-60">racing @${escapeHtml(race.creator)}'s best</div>
         <div class="flex items-baseline justify-between mt-1">
           <div><span class="text-2xl font-bold">${score}</span> <span class="opacity-50">you</span></div>
           <div class="opacity-70">${race.creatorScore} <span class="opacity-50">them</span></div>
         </div>
         <div class="text-2xl font-bold mt-2 ${score > race.creatorScore ? "text-green-300" : score < race.creatorScore ? "text-orange-300" : "opacity-70"}">${
           score > race.creatorScore ? "YOU WIN 🏆" : score < race.creatorScore ? "YOU LOST" : "TIE"
         }</div>
       </div>`
    : "";
  const cbButton = ctx && ctx.canChallengeBack && extra?.onChallengeBack
    ? `<button data-challenge-back class="mt-3 w-full rounded-2xl bg-paper text-ink font-bold py-3">Rematch</button>`
    : ctx
      ? `<div class="mt-3 text-[10px] opacity-50">chain capped at 2 — share to start a new one</div>`
      : "";

  // Three game-over flavours: creating a challenge (cc), answering one
  // (ctx), or a normal run. Labels + hero action adapt to each.
  const cc = extra?.challengeCreate;
  const beatTarget = !!ctx && score > ctx.creatorScore;

  // Primary action button. When creating a challenge it's "Send"; when you've
  // just beaten a duel it's a "Brag" hero; otherwise it's "Play again".
  let heroBtn: string;
  const rr = extra?.rankedRound;
  if (cc?.canSubmit) {
    heroBtn = `<button data-submit-challenge class="mt-4 w-full rounded-2xl bg-emerald-400 text-ink font-bold py-5 text-lg shadow-lg active:scale-95 transition">Send challenge${cc.friendName ? ` to @${escapeHtml(cc.friendName)}` : ""}</button>`;
  } else if (beatTarget) {
    heroBtn = `<button data-brag class="mt-4 w-full rounded-2xl bg-emerald-400 text-ink font-bold py-5 text-lg shadow-lg active:scale-95 transition">Brag — you won 🎉</button>`;
  } else if (rr) {
    // Ranked: the round is already submitted — there's no replay. Go back to
    // the ranked panel, which shows the live match + the next round button.
    const submitted = rr.round + 1;
    heroBtn = `<button data-restart class="mt-4 w-full rounded-2xl bg-paper text-ink font-bold py-5 text-lg shadow-lg active:scale-95 transition">Round ${submitted}/${rr.total} submitted — back to match</button>`;
  } else {
    heroBtn = `<button data-restart class="mt-4 w-full rounded-2xl bg-paper text-ink font-bold py-5 text-lg shadow-lg active:scale-95 transition">Play again</button>`;
  }

  // Secondary retry. After a hero "Send"/"Brag" we still offer a retry; for a
  // challenge it reads "Improve score" (creating) / "Try again" (answering).
  const retryLabel = cc ? "Improve score" : ctx ? "Try again" : "Play again";
  const retryBtn = (cc?.canSubmit || beatTarget)
    ? `<button data-restart class="mt-3 w-full rounded-2xl border border-paper/40 text-paper font-bold py-3">${retryLabel}</button>`
    : "";

  // "Give up" wording when answering a challenge, else "Back to menu".
  const menuLabel = ctx ? "Give up" : "Back to menu";

  // Per-run progression beat. The PB-delta line is the strongest
  // one-more-run trigger this screen has; the XP bar is the "something
  // always accumulates" answer; the breadcrumb is goal-gradient.
  const prog = extra?.progress;
  let progressHtml = "";
  if (prog) {
    const delta = prog.prevBest - score;
    const pbLine = prog.isNewPb
      ? `<div class="mt-1 text-sm font-bold text-emerald-300">🎉 new personal best!</div>`
      : prog.prevBest > 0 && delta > 0 && delta <= 10
        ? `<div class="mt-1 text-sm font-bold text-amber-300">${delta} away from your best (${prog.prevBest})</div>`
        : prog.prevBest > 0
          ? `<div class="mt-1 text-[11px] opacity-60">best: ${prog.prevBest}</div>`
          : "";
    const xp = prog.xp;
    const targetPct = Math.min(100, Math.round((xp.after.intoLevel / xp.after.toNext) * 100));
    // The bar animates from where this run started (or 0 on a level-up,
    // so the fill visibly "wraps") to where it ended.
    const startPct = xp.leveledUp
      ? 0
      : Math.min(100, Math.round((xp.before.intoLevel / xp.before.toNext) * 100));
    const nextLine = prog.nextUnlock
      ? `<div class="mt-1.5 text-[11px] opacity-70">next: <span class="font-bold">${escapeHtml(prog.nextUnlock.name)}</span> — ${escapeHtml(prog.nextUnlock.effort)}</div>`
      : "";
    progressHtml = `
      ${pbLine}
      <div class="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-left">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-bold">LV ${xp.after.level}${xp.leveledUp ? ` <span class="text-amber-300">— LEVEL UP!</span>` : ""}</span>
          <span class="opacity-70">+${xp.breakdown.total} XP</span>
        </div>
        <div class="mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
          <div data-xp-fill class="h-full rounded-full transition-[width] duration-700 ease-out" style="width:${startPct}%;background:${accentCss}" data-xp-target="${targetPct}"></div>
        </div>
        <div class="mt-1 text-[10px] opacity-50">${xp.after.intoLevel} / ${xp.after.toNext} XP</div>
        ${nextLine}
      </div>`;
  }

  wrap.innerHTML = `
    <div class="max-w-sm mx-auto text-center relative overflow-hidden rounded-3xl border border-white/10 bg-[#0e0f13]/95 shadow-2xl px-5 pt-5 pb-5">
      <div class="absolute top-0 left-0 right-0 h-1.5" style="background:${stripCss}"></div>
      <div class="text-xs opacity-70 uppercase tracking-wider">your run</div>
      <div class="text-6xl font-bold mt-1" style="color:${accentCss}">${score}</div>
      ${acceptStatus}
      ${progressHtml}
      ${versus}
      ${raceVersus}
      ${unlocksHtml}
      ${heroBtn}
      ${retryBtn}
      ${!ctx && !cc && !race ? `<button data-share class="mt-3 w-full rounded-2xl border border-paper/40 text-paper font-bold py-3">Share run</button>` : ""}
      ${cbButton}
      <button data-menu class="mt-3 w-full text-xs underline opacity-60 py-1">${menuLabel}</button>
    </div>
  `;
  host.appendChild(wrap);
  // Tick the XP bar to its end state on the next frame so the CSS width
  // transition actually plays.
  const xpFill = wrap.querySelector<HTMLElement>("[data-xp-fill]");
  if (xpFill) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        xpFill.style.width = `${xpFill.dataset.xpTarget}%`;
      });
    });
  }
  wrap.querySelector("[data-restart]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onRestart();
  });
  wrap.querySelector("[data-menu]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onMenu();
  });
  wrap.querySelector("[data-share]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    extra?.onShare?.();
  });
  wrap.querySelectorAll("[data-brag]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      extra?.onShare?.();
    }),
  );
  wrap.querySelector("[data-challenge-back]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    extra?.onChallengeBack?.();
  });
  wrap.querySelector("[data-submit-challenge]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    extra?.challengeCreate?.onSubmit();
  });
}

function renderUnlocks(unlocks: NonNullable<GameOverResult["result"]>["unlocked"]): string {
  if (!unlocks) return "";
  return `
    <div class="mt-3 rounded-2xl bg-white/10 px-3 py-3">
      <div class="text-[11px] uppercase tracking-wider opacity-70">unlocked</div>
      <div class="mt-2 flex justify-center gap-3">
        ${unlocks
          .map(
            (u) => `
          <div class="flex flex-col items-center">
            <svg viewBox="-20 -20 40 40" class="w-12 h-12">
              <polygon points="-14,6 14,-6 1,0 14,-6 -1,11" fill="rgb(${u.body.join(",")})" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="1,0 -14,6 -1,11" fill="rgb(${u.accent.join(",")})" stroke="#1a1a1a" stroke-width="0.8"/>
            </svg>
            <div class="text-[10px] font-bold capitalize" style="color:${RARITY_COLOR[u.rarity]}">${u.rarity}</div>
            <div class="text-[9px] opacity-60">@${u.threshold}</div>
          </div>`,
          )
          .join("")}
      </div>
    </div>
  `;
}

type CelebrationItem =
  | {
      kind: "skin";
      threshold: number;
      rarity: Rarity;
      body: [number, number, number];
      accent: [number, number, number];
    }
  | {
      kind: "achievement";
      name: string;
      blurb: string;
      reward:
        | { type: "color"; body: [number, number, number]; accent: [number, number, number] }
        | { type: "fx"; label: string }
        | { type: "sound"; label: string };
    };

function renderUnlockCelebration(host: HTMLElement, items: CelebrationItem[], shape: ShapeId, onDone: () => void): void {
  let index = 0;

  const showOne = (): void => {
    const item = items[index];
    if (!item) {
      onDone();
      return;
    }
    // Skins glow by rarity; achievements use a warm gold so they read as a
    // reward of their own without implying a rarity tier.
    const glow = item.kind === "skin" ? RARITY_COLOR[item.rarity] : "#facc15";
    const headline = item.kind === "skin" ? "new skin" : "achievement";
    const title = item.kind === "skin" ? item.rarity : item.name;
    const subtitle =
      item.kind === "skin" ? `unlocked at ${item.threshold} games` : item.blurb;
    // Preview: skins and color achievements paint the plane; fx/sound
    // achievements show a generic icon + the unlocked option's label.
    let preview = "";
    const colorReward =
      item.kind === "skin"
        ? { body: item.body, accent: item.accent }
        : item.reward.type === "color"
          ? { body: item.reward.body, accent: item.reward.accent }
          : null;
    if (colorReward) {
      const { body, accent } = colorReward;
      // Preview the new colour on the player's ACTUAL equipped plane
      // (sprite-aware via shapeSvgInner) so the reward reads as "your plane,
      // recoloured" rather than a generic dart.
      preview = `
        <svg viewBox="-20 -20 40 40" class="unlock-celebrate-svg w-60 h-60">
          ${shapeSvgInner(shape, body, accent)}
        </svg>`;
    } else if (item.kind === "achievement" && item.reward.type !== "color") {
      const icon = item.reward.type === "fx" ? "🎆" : "🔊";
      const kindLabel = item.reward.type === "fx" ? "effect unlocked" : "sound unlocked";
      preview = `
        <div class="unlock-celebrate-svg w-60 h-60 flex flex-col items-center justify-center gap-2">
          <div class="text-6xl">${icon}</div>
          <div class="text-[11px] uppercase tracking-wider opacity-70">${kindLabel}</div>
          <div class="text-lg font-bold">${escapeHtml(item.reward.label)}</div>
        </div>`;
    }
    const overlay = document.createElement("div");
    overlay.dataset.noFlap = "true";
    overlay.className =
      "unlock-celebrate-backdrop pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm text-paper font-display";
    const remaining = items.length - index - 1;
    const moreLabel = remaining > 0 ? `<div class="mt-3 text-[10px] opacity-60">${remaining} more after this</div>` : "";
    overlay.innerHTML = `
      <div class="max-w-sm w-full px-6 text-center">
        <div class="unlock-celebrate-headline text-[11px] uppercase font-bold opacity-80" style="letter-spacing:0.25em">${headline}</div>
        <div class="mt-6 flex justify-center" style="--unlock-glow:${glow}">
          ${preview}
        </div>
        <div class="mt-6 text-2xl font-bold capitalize tracking-widest" style="color:${glow}">${escapeHtml(title)}</div>
        <div class="mt-1 text-[11px] opacity-70">${escapeHtml(subtitle)}</div>
        ${moreLabel}
        <button data-unlock-continue class="mt-8 w-full rounded-2xl bg-paper text-ink font-bold py-3">Continue</button>
      </div>
    `;
    host.appendChild(overlay);
    // Reuse the skin unlock fanfare. Achievements ring the "rare" chime.
    playUnlockSound(item.kind === "skin" ? item.rarity : "rare");
    triggerUnlockHaptic(item.kind === "skin" ? item.rarity : "rare");

    const advance = (): void => {
      overlay.remove();
      index += 1;
      showOne();
    };
    overlay.querySelector("[data-unlock-continue]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      advance();
    });
  };

  showOne();
}

import "./style.css";
import { setupPWA } from "./pwa";
import { DEFAULT_CONFIG } from "./game/config";
import { GameLoop } from "./game/loop";
import { Renderer } from "./game/render";
import { InputController } from "./game/input";
import { loadSettings, saveSettings, type Settings } from "./game/settings";
import { DEFAULT_SKIN } from "./game/skin";
import {
  renderMenu,
  renderPauseOverlay,
  removePauseOverlay,
  renderGameOver,
} from "./ui/menu";
import { initAuth, authState, subscribeAuth } from "./social/auth";
import { renderAccountPanel } from "./ui/account";
import { renderSkinPicker } from "./ui/skin-picker";
import { renderLeaderboard } from "./ui/leaderboard";
import {
  listOwnedSkins,
  setEquippedSkin,
  getEquippedSkinIdLocal,
  type SkinRow,
  rowToColors,
} from "./social/skins";
import { submitRun, type SubmitResult } from "./social/runs";
import { fetchDaily, type DailyInfo } from "./social/daily";
import { renderShareSheet } from "./ui/share-sheet";
import { type ShareCardData } from "./social/share-card";

setupPWA();
initAuth();

type Mode = "menu" | "playing" | "paused" | "dead";
type RunMode = "casual" | "daily";

const app = document.getElementById("app");
if (!app) throw new Error("missing #app");

const settings: Settings = loadSettings();
let mode: Mode = "menu";
let loop: GameLoop | null = null;
let currentSeed = 0;
let currentRunMode: RunMode = "casual";
let equippedSkin: SkinRow | null = null;
let dailyInfo: DailyInfo | null = null;

app.innerHTML = `
  <div class="relative w-full h-full max-w-md max-h-[90vh] aspect-[9/16] mx-auto bg-sky-day overflow-hidden touch-none select-none" id="stage">
    <canvas id="canvas" class="absolute inset-0 w-full h-full"></canvas>
    <button id="pause-btn" data-no-flap class="hidden absolute top-3 right-3 z-20 bg-black/30 text-paper rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold">II</button>
    <div id="overlays" class="absolute inset-0 pointer-events-none"></div>
  </div>
`;

const stage = document.getElementById("stage") as HTMLDivElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const pauseBtn = document.getElementById("pause-btn") as HTMLButtonElement;
const overlays = document.getElementById("overlays") as HTMLDivElement;

const renderer = new Renderer(canvas, DEFAULT_CONFIG, {
  highContrast: settings.highContrast,
  skin: DEFAULT_SKIN,
});
const observer = new ResizeObserver(() => renderer.resize());
observer.observe(stage);

const input = new InputController(stage, {
  onFlap: () => {
    if (mode === "playing") loop?.flap();
  },
  onTogglePause: () => {
    if (mode === "playing") setPaused(true);
    else if (mode === "paused") setPaused(false);
  },
  onRestart: () => {
    if (mode === "dead") startRun();
  },
});
input.attach();

pauseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (mode === "playing") setPaused(true);
  else if (mode === "paused") setPaused(false);
});

subscribeAuth(async () => {
  await loadEquippedSkin();
  if (mode === "menu") showMenu();
});

void refreshDaily();
setInterval(refreshDaily, 60_000);
loadEquippedSkin().then(() => showMenu());

async function refreshDaily(): Promise<void> {
  dailyInfo = await fetchDaily();
  if (mode === "menu") showMenu();
}

async function loadEquippedSkin(): Promise<void> {
  const s = authState();
  if (!s.ready || s.offline) {
    equippedSkin = null;
    renderer.options.skin = DEFAULT_SKIN;
    return;
  }
  const wantedId = s.profile?.equipped_skin_id ?? getEquippedSkinIdLocal();
  if (!wantedId) {
    equippedSkin = null;
    renderer.options.skin = DEFAULT_SKIN;
    return;
  }
  const rows = await listOwnedSkins();
  const found = rows.find((r) => r.id === wantedId) ?? null;
  equippedSkin = found;
  renderer.options.skin = found ? rowToColors(found) : DEFAULT_SKIN;
}

function menuAccountLabel(): string {
  const s = authState();
  if (s.offline) return "offline";
  if (s.profile?.username) return s.profile.username;
  return "account";
}

function showMenu(): void {
  mode = "menu";
  pauseBtn.classList.add("hidden");
  loop?.stop();
  loop = null;
  overlays.innerHTML = "";
  renderMenu(
    overlays,
    settings,
    {
      onPlay: () => startRun("casual"),
      onPlayDaily: () => startRun("daily"),
      onToggleSetting,
      onOpenAccount: () => renderAccountPanel(overlays, () => showMenu()),
      onOpenSkins: () => {
        renderSkinPicker(
          overlays,
          equippedSkin?.id ?? null,
          async (id) => {
            await setEquippedSkin(id);
            await loadEquippedSkin();
            showMenu();
          },
          () => showMenu(),
        );
      },
      onOpenLeaderboard: () => renderLeaderboard(overlays, () => showMenu()),
    },
    {
      accountLabel: menuAccountLabel(),
      daily: dailyInfo ? { date: dailyInfo.date, playsCount: dailyInfo.plays_count } : null,
      streakDays: authState().profile?.streak_days ?? 0,
    },
  );
}

function onToggleSetting(key: keyof Settings): void {
  settings[key] = !settings[key];
  saveSettings(settings);
  renderer.options.highContrast = settings.highContrast;
  showMenu();
}

function startRun(runMode: RunMode = "casual"): void {
  overlays.innerHTML = "";
  mode = "playing";
  currentRunMode = runMode;
  pauseBtn.classList.remove("hidden");
  if (runMode === "daily" && dailyInfo) {
    currentSeed = dailyInfo.seed >>> 0;
  } else {
    currentSeed = (Math.random() * 0xffffffff) >>> 0;
  }
  loop = new GameLoop(currentSeed, DEFAULT_CONFIG, {
    render: (sim, alpha) => renderer.draw(sim, alpha),
    onDeath: async (sim) => {
      mode = "dead";
      pauseBtn.classList.add("hidden");
      const score = sim.score;
      const ticks = sim.dieTick;
      const result = await trySubmit(sim);
      const share = (): void => openShare(score, result);
      renderGameOver(overlays, score, () => startRun(currentRunMode), showMenu, {
        result,
        ticks,
        onShare: share,
      });
      if (result?.unlocked && result.unlocked.length > 0) {
        await loadEquippedSkin();
      }
      if (runMode === "daily") void refreshDaily();
    },
  });
  loop.start();
}

function openShare(score: number, result: SubmitResult | null): void {
  const s = authState();
  const data: ShareCardData = {
    score,
    username: s.profile?.username ?? null,
    skin: renderer.options.skin,
    rarity: equippedSkin?.rarity,
    streakDays: result?.streak_days ?? s.profile?.streak_days ?? 0,
    friendCode: s.profile?.friend_code ?? null,
    mode: currentRunMode,
    dailyDate: currentRunMode === "daily" ? dailyInfo?.date ?? null : null,
    dailyRank: null,
    totalPlayed: currentRunMode === "daily" ? dailyInfo?.plays_count ?? null : null,
  };
  renderShareSheet(overlays, data, () => {
    overlays.querySelector('[data-no-flap][class*="z-40"]')?.remove();
  });
}

async function trySubmit(sim: { score: number; dieTick: number }): Promise<SubmitResult | null> {
  if (!loop) return null;
  const s = authState();
  if (s.offline || !s.session) return null;
  return submitRun({
    seed: currentSeed,
    score: sim.score,
    ticks: sim.dieTick,
    inputs: loop.getRecordedInputs(),
    mode: currentRunMode,
    dailyDate: currentRunMode === "daily" ? dailyInfo?.date : undefined,
    equippedSkinId: equippedSkin?.id ?? null,
  });
}

function setPaused(p: boolean): void {
  if (!loop) return;
  loop.setPaused(p);
  if (p) {
    mode = "paused";
    renderPauseOverlay(
      overlays,
      () => setPaused(false),
      () => showMenu(),
    );
  } else {
    mode = "playing";
    removePauseOverlay(overlays);
  }
}

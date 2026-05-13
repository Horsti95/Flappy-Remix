import "./style.css";
import { setupPWA } from "./pwa";
import { DEFAULT_CONFIG } from "./game/config";
import { GameLoop } from "./game/loop";
import { Renderer } from "./game/render";
import { InputController } from "./game/input";
import { loadSettings, saveSettings, type Settings } from "./game/settings";
import {
  renderMenu,
  renderPauseOverlay,
  removePauseOverlay,
  renderGameOver,
} from "./ui/menu";
import { initAuth, authState, subscribeAuth } from "./social/auth";
import { renderAccountPanel } from "./ui/account";

setupPWA();
initAuth();

type Mode = "menu" | "playing" | "paused" | "dead";

const app = document.getElementById("app");
if (!app) throw new Error("missing #app");

const settings: Settings = loadSettings();
let mode: Mode = "menu";
let loop: GameLoop | null = null;

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

subscribeAuth(() => {
  if (mode === "menu") showMenu();
});

showMenu();

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
      onPlay: startRun,
      onToggleSetting,
      onOpenAccount: () => {
        renderAccountPanel(overlays, () => showMenu());
      },
    },
    menuAccountLabel(),
  );
}

function onToggleSetting(key: keyof Settings): void {
  settings[key] = !settings[key];
  saveSettings(settings);
  renderer.options.highContrast = settings.highContrast;
  showMenu();
}

function startRun(): void {
  overlays.innerHTML = "";
  mode = "playing";
  pauseBtn.classList.remove("hidden");
  const seed = (Math.random() * 0xffffffff) >>> 0;
  loop = new GameLoop(seed, DEFAULT_CONFIG, {
    render: (sim, alpha) => renderer.draw(sim, alpha),
    onDeath: (sim) => {
      mode = "dead";
      pauseBtn.classList.add("hidden");
      renderGameOver(overlays, sim.score, startRun, showMenu);
    },
  });
  loop.start();
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

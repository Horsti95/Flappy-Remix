import "./style.css";
import { setupPWA } from "./pwa";
import { DEFAULT_CONFIG } from "./game/config";
import { GameLoop } from "./game/loop";
import { Renderer } from "./game/render";
import { InputController } from "./game/input";
import { GhostSim } from "./game/ghost";
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
import { type SubmitResult } from "./social/runs";
import { installFlushHooks, pendingCount, submitOrEnqueue } from "./social/offline-queue";
import { fetchDaily, type DailyInfo } from "./social/daily";
import { renderShareSheet } from "./ui/share-sheet";
import { type ShareCardData } from "./social/share-card";
import { renderFriendsPanel } from "./ui/friends";
import { renderRankedPanel } from "./ui/ranked";
import { type RankedMatch } from "./social/ranked";
import { createChallenge, fetchChallenge, ghostSkinFromChallenge, type FetchedChallenge } from "./social/challenges";
import { listMyBadges } from "./social/badges";

setupPWA();
initAuth();
installFlushHooks();

type Mode = "menu" | "playing" | "paused" | "dead";
type RunMode = "casual" | "daily" | "challenge" | "ranked";

const app = document.getElementById("app");
if (!app) throw new Error("missing #app");

const settings: Settings = loadSettings();
let mode: Mode = "menu";
let loop: GameLoop | null = null;
let currentSeed = 0;
let currentRunMode: RunMode = "casual";
let equippedSkin: SkinRow | null = null;
let dailyInfo: DailyInfo | null = null;
let activeChallenge: FetchedChallenge | null = null;
let activeRanked: { match: RankedMatch; round: number } | null = null;

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
    if (mode === "dead") startRun(currentRunMode);
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

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (mode === "menu") showMenu();
  });
  window.addEventListener("offline", () => {
    if (mode === "menu") showMenu();
  });
}

const deepLink = (() => {
  try {
    const u = new URL(window.location.href);
    return {
      from: u.searchParams.get("from"),
      dailyDate: u.searchParams.get("d"),
      challenge: u.searchParams.get("c"),
    };
  } catch {
    return { from: null, dailyDate: null, challenge: null };
  }
})();

void refreshDaily();
setInterval(refreshDaily, 60_000);
loadEquippedSkin().then(async () => {
  // Deep-link priority: challenge first, then daily, then menu.
  if (deepLink.challenge) {
    const c = await fetchChallenge(deepLink.challenge);
    if (c) {
      activeChallenge = c;
      startRun("challenge");
      return;
    }
  }
  if (deepLink.dailyDate && dailyInfo && deepLink.dailyDate === dailyInfo.date) {
    startRun("daily");
    return;
  }
  showMenu();
});

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
  activeChallenge = null;
  renderer.options.ghostSkin = undefined;
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
      onOpenFriends: () => renderFriendsPanel(overlays, () => showMenu()),
      onOpenRanked: () =>
        renderRankedPanel(overlays, {
          onPlayRound: (match, round) => {
            activeRanked = { match, round };
            startRun("ranked");
          },
          onClose: () => showMenu(),
        }),
    },
    {
      accountLabel: menuAccountLabel(),
      daily: dailyInfo ? { date: dailyInfo.date, playsCount: dailyInfo.plays_count } : null,
      streakDays: authState().profile?.streak_days ?? 0,
      pendingSubmissions: pendingCount(),
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
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
  let ghost: GhostSim | undefined;
  if (runMode === "challenge" && activeChallenge) {
    currentSeed = activeChallenge.seed >>> 0;
    ghost = new GhostSim(currentSeed, activeChallenge.inputs, DEFAULT_CONFIG);
    renderer.options.ghostSkin = ghostSkinFromChallenge(activeChallenge);
  } else if (runMode === "ranked" && activeRanked) {
    currentSeed = activeRanked.match.seeds[activeRanked.round] >>> 0;
    renderer.options.ghostSkin = undefined;
  } else if (runMode === "daily" && dailyInfo) {
    currentSeed = dailyInfo.seed >>> 0;
    renderer.options.ghostSkin = undefined;
  } else {
    currentSeed = (Math.random() * 0xffffffff) >>> 0;
    renderer.options.ghostSkin = undefined;
  }
  loop = new GameLoop(
    currentSeed,
    DEFAULT_CONFIG,
    {
      render: (sim, alpha, g) => renderer.draw(sim, alpha, g),
      onDeath: async (sim) => {
        mode = "dead";
        pauseBtn.classList.add("hidden");
        const score = sim.score;
        const ticks = sim.dieTick;
        const result = await trySubmit(sim);
        const share = (): void => {
          void openShare(score, result);
        };
        renderGameOver(overlays, score, () => startRun(currentRunMode), showMenu, {
          result,
          ticks,
          onShare: share,
          challengeContext: activeChallenge
            ? {
                creator: activeChallenge.creator_username ?? "anon",
                creatorScore: activeChallenge.creator_score,
                canChallengeBack: activeChallenge.can_respond_again,
              }
            : undefined,
          onChallengeBack: result?.run_id
            ? async () => {
                if (!result?.run_id) return;
                const r = await createChallenge(result.run_id, activeChallenge?.short_id ?? null);
                if (r.ok && r.short_id) {
                  shareChallenge(score, r.short_id);
                }
              }
            : undefined,
        });
        if (result?.unlocked && result.unlocked.length > 0) {
          await loadEquippedSkin();
        }
        if (runMode === "daily") void refreshDaily();
      },
    },
    ghost,
  );
  loop.start();
}

async function openShare(score: number, result: SubmitResult | null): Promise<void> {
  const s = authState();
  const badges = await listMyBadges();
  const topRank = badges.length > 0 ? Math.min(...badges.map((b) => b.rank)) : null;
  const data: ShareCardData = {
    score,
    username: s.profile?.username ?? null,
    skin: renderer.options.skin,
    rarity: equippedSkin?.rarity,
    streakDays: result?.streak_days ?? s.profile?.streak_days ?? 0,
    friendCode: s.profile?.friend_code ?? null,
    mode: currentRunMode === "ranked" ? "ranked" : currentRunMode,
    dailyDate: currentRunMode === "daily" ? dailyInfo?.date ?? null : null,
    dailyRank: null,
    totalPlayed: currentRunMode === "daily" ? dailyInfo?.plays_count ?? null : null,
    topRank,
  };
  renderShareSheet(overlays, data, () => {
    overlays.querySelector('[data-no-flap][class*="z-40"]')?.remove();
  });
}

function shareChallenge(score: number, shortId: string): void {
  const s = authState();
  const data: ShareCardData = {
    score,
    username: s.profile?.username ?? null,
    skin: renderer.options.skin,
    rarity: equippedSkin?.rarity,
    streakDays: s.profile?.streak_days ?? 0,
    friendCode: s.profile?.friend_code ?? null,
    mode: "challenge",
    dailyDate: null,
    dailyRank: null,
    totalPlayed: null,
  };
  // Inject the challenge short-id into the share URL so opening the
  // link kicks the recipient into the ghost run.
  const params = new URLSearchParams();
  params.set("c", shortId);
  if (s.profile?.friend_code) params.set("u", s.profile.friend_code);
  const baseUrl = window.location.origin;
  history.replaceState(null, "", `${baseUrl}/?${params}`);
  renderShareSheet(overlays, data, () => {
    overlays.querySelector('[data-no-flap][class*="z-40"]')?.remove();
  });
}

async function trySubmit(sim: { score: number; dieTick: number }): Promise<SubmitResult | null> {
  if (!loop) return null;
  const s = authState();
  if (s.offline) return null;
  return submitOrEnqueue({
    seed: currentSeed,
    score: sim.score,
    ticks: sim.dieTick,
    inputs: loop.getRecordedInputs(),
    mode: currentRunMode,
    dailyDate: currentRunMode === "daily" ? dailyInfo?.date : undefined,
    challengeShortId: currentRunMode === "challenge" ? activeChallenge?.short_id : undefined,
    rankedMatchId: currentRunMode === "ranked" ? activeRanked?.match.id : undefined,
    rankedRound: currentRunMode === "ranked" ? activeRanked?.round : undefined,
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

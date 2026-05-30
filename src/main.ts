import "./style.css";
import { setupPWA } from "./pwa";
import { DEFAULT_CONFIG } from "./game/config";
import { applyModifiers } from "./game/daily-twist";
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
import { renderGallery } from "./ui/gallery";
import { renderLeaderboard } from "./ui/leaderboard";
import {
  listOwnedSkins,
  setEquippedSkin,
  getEquippedSkinIdLocal,
  getEquippedShapeLocal,
  setEquippedShapeLocal,
  type SkinRow,
  rowToColors,
} from "./social/skins";
import { DEFAULT_SHAPE_ID, type ShapeId } from "./game/shapes";
import { getEquippedThemeLocal, setEquippedThemeLocal, type ThemeId } from "./game/themes";
import { type SubmitResult } from "./social/runs";
import { installFlushHooks, pendingCount, submitOrEnqueue } from "./social/offline-queue";
import { fetchDaily, type DailyInfo } from "./social/daily";
import { renderShareSheet } from "./ui/share-sheet";
import { type ShareCardData } from "./social/share-card";
import { renderFriendsPanel } from "./ui/friends";
import { refreshFriendCount } from "./social/friends";
import { loadAchievementStats } from "./game/achievements";
import { renderDailyLanding } from "./ui/daily-landing";
import { renderChallengePickFriend, type ChallengePickResult } from "./ui/challenge-pick-friend";
import { renderRankedPanel } from "./ui/ranked";
import { playFlap, setSoundLabMode } from "./game/sfx";
import { type RankedMatch } from "./social/ranked";
import { createChallenge, fetchChallenge, ghostSkinFromChallenge, type FetchedChallenge } from "./social/challenges";
import { listMyBadges } from "./social/badges";

setupPWA();
initAuth();
installFlushHooks();

let splashHidden = false;
function hideSplash(): void {
  if (splashHidden) return;
  splashHidden = true;
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.classList.add("splash-leaving");
  window.setTimeout(() => splash.remove(), 420);
}

// Intercept browser/system back so it returns to the in-app menu
// instead of leaving the page. We seed a base state on load and push
// a sentinel whenever the player opens a sub-view (game, panel,
// modal). A popstate at any non-menu state collapses straight back
// to the menu and re-pushes the sentinel so a second back press is
// available.
type ViewState = { glide: "menu" | "view" };
if (typeof window !== "undefined" && typeof history !== "undefined") {
  if ((history.state as ViewState | null)?.glide !== "menu") {
    history.replaceState({ glide: "menu" } satisfies ViewState, "");
  }
}

function pushSubView(): void {
  if (typeof history === "undefined") return;
  history.pushState({ glide: "view" } satisfies ViewState, "");
}

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
let equippedShapeId: ShapeId = DEFAULT_SHAPE_ID;
let equippedThemeId: ThemeId = getEquippedThemeLocal();
let bestScoreSeen = 0;
let dailyInfo: DailyInfo | null = null;
let activeChallenge: FetchedChallenge | null = null;
let activeRanked: { match: RankedMatch; round: number } | null = null;
let pendingChallengeTarget: ChallengePickResult | null = null;

app.innerHTML = `
  <section id="stage" role="application" aria-label="Glide play area" class="relative w-full h-full max-w-md max-h-[90vh] aspect-[9/16] mx-auto bg-sky-day overflow-hidden touch-none select-none">
    <canvas id="canvas" class="absolute inset-0 w-full h-full" aria-hidden="true"></canvas>
    <div id="live-region" aria-live="polite" aria-atomic="true" class="sr-only"></div>
    <button id="pause-btn" data-no-flap aria-label="Pause game" type="button" class="hidden absolute top-3 right-3 z-20 bg-black/30 text-paper rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold">II</button>
    <div id="overlays" class="absolute inset-0 pointer-events-none"></div>
  </section>
`;

const stage = document.getElementById("stage") as HTMLElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const pauseBtn = document.getElementById("pause-btn") as HTMLButtonElement;
const overlays = document.getElementById("overlays") as HTMLDivElement;
const liveRegion = document.getElementById("live-region") as HTMLDivElement;

function announce(msg: string): void {
  if (liveRegion) liveRegion.textContent = msg;
}

const initialShape: ShapeId = ((): ShapeId => {
  const stored = getEquippedShapeLocal();
  return (stored as ShapeId | null) ?? DEFAULT_SHAPE_ID;
})();
equippedShapeId = initialShape;
bestScoreSeen = ((): number => {
  try {
    return Number(localStorage.getItem("pflug.bestScore.v1") ?? "0") || 0;
  } catch {
    return 0;
  }
})();

const renderer = new Renderer(canvas, DEFAULT_CONFIG, {
  highContrast: settings.highContrast,
  skin: DEFAULT_SKIN,
  shape: equippedShapeId,
  theme: equippedThemeId,
  reducedMotion: settings.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches,
});
const observer = new ResizeObserver(() => renderer.resize());
observer.observe(stage);

const input = new InputController(stage, {
  onFlap: () => {
    if (mode === "playing") {
      loop?.flap();
      if (settings.sound) playFlap();
    }
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

let panelOpen = false;

subscribeAuth(async () => {
  await loadEquippedSkin();
  void refreshFriendCount();
  // Don't tear down an open panel (account, gallery, leaderboard, …)
  // when supabase fires an auth refresh — that was wiping the gallery
  // mid-browse.
  if (mode === "menu" && !panelOpen) showMenu();
});

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (mode === "menu" && !panelOpen) showMenu();
  });
  window.addEventListener("offline", () => {
    if (mode === "menu" && !panelOpen) showMenu();
  });
  window.addEventListener("popstate", () => {
    if (mode !== "menu" || overlays.children.length > 0) {
      showMenu();
      history.replaceState({ glide: "menu" } satisfies ViewState, "");
    }
  });
}

const deepLink = (() => {
  try {
    const u = new URL(window.location.href);
    return {
      from: u.searchParams.get("from"),
      dailyDate: u.searchParams.get("d"),
      challenge: u.searchParams.get("c"),
      soundsLab: u.searchParams.get("sounds") === "lab",
    };
  } catch {
    return { from: null, dailyDate: null, challenge: null, soundsLab: false };
  }
})();
if (deepLink.soundsLab) setSoundLabMode(true);

void refreshDaily();
setInterval(refreshDaily, 60_000);
loadEquippedSkin().then(async () => {
  // Deep-link priority: challenge first, then daily, then menu.
  if (deepLink.challenge) {
    const c = await fetchChallenge(deepLink.challenge);
    if (c) {
      activeChallenge = c;
      startRun("challenge");
      hideSplash();
      return;
    }
  }
  if (deepLink.dailyDate && dailyInfo && deepLink.dailyDate === dailyInfo.date) {
    startRun("daily");
    hideSplash();
    return;
  }
  showMenu();
  hideSplash();
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
  panelOpen = false;
  pauseBtn.classList.add("hidden");
  loop?.stop();
  loop = null;
  activeChallenge = null;
  pendingChallengeTarget = null;
  renderer.options.ghostSkin = undefined;
  overlays.innerHTML = "";
  renderMenu(
    overlays,
    settings,
    {
      onPlay: () => { pushSubView(); startRun("casual"); },
      onPlayDaily: () => { pushSubView(); openDailyLanding(); },
      onChallengeFriend: () => {
        pushSubView();
        panelOpen = true;
        renderChallengePickFriend(overlays, {
          onPick: (result) => {
            pendingChallengeTarget = result;
            if (result.seedSource === "daily" && dailyInfo) {
              startRun("daily");
            } else {
              startRun("casual");
            }
          },
          onClose: () => showMenu(),
        });
      },
      onToggleSetting,
      onOpenAccount: () => { pushSubView(); panelOpen = true; renderAccountPanel(overlays, () => showMenu()); },
      onOpenSkins: () => {
        pushSubView();
        panelOpen = true;
        renderGallery(
          overlays,
          { skinId: equippedSkin?.id ?? null, shapeId: equippedShapeId, themeId: equippedThemeId },
          {
            totalGames: authState().profile?.total_games ?? 0,
            bestScore: bestScoreSeen,
            streakDays: authState().profile?.streak_days ?? 0,
            lateNightGames: loadAchievementStats().lateNightGames,
            dailyStreakDays: loadAchievementStats().dailyStreakDays,
            challengeWins: loadAchievementStats().challengeWins,
          },
          {
            onEquipSkin: async (id) => {
              await setEquippedSkin(id);
              await loadEquippedSkin();
            },
            onEquipShape: (id) => {
              equippedShapeId = id;
              setEquippedShapeLocal(id);
              renderer.options.shape = id;
            },
            onEquipTheme: (id) => {
              equippedThemeId = id;
              setEquippedThemeLocal(id);
              renderer.options.theme = id;
            },
            onClose: () => showMenu(),
          },
        );
      },
      onOpenLeaderboard: () => { pushSubView(); panelOpen = true; renderLeaderboard(overlays, () => showMenu()); },
      onOpenFriends: () => { pushSubView(); panelOpen = true; renderFriendsPanel(overlays, () => showMenu()); },
      onOpenRanked: () => {
        pushSubView();
        panelOpen = true;
        renderRankedPanel(overlays, {
          onPlayRound: (match, round) => {
            activeRanked = { match, round };
            startRun("ranked");
          },
          onClose: () => showMenu(),
        });
      },
    },
    {
      accountLabel: menuAccountLabel(),
      daily: dailyInfo
        ? {
            date: dailyInfo.date,
            playsCount: dailyInfo.plays_count,
            tier: dailyInfo.pick.tier,
            modifierNames: dailyInfo.pick.modifiers.map((m) => m.name),
            modifierBlurbs: dailyInfo.pick.modifiers.map((m) => m.blurb),
          }
        : null,
      streakDays: authState().profile?.streak_days ?? 0,
      pendingSubmissions: pendingCount(),
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
    },
  );
}

function openDailyLanding(): void {
  if (!dailyInfo) {
    startRun("daily");
    return;
  }
  overlays.innerHTML = "";
  const dateKey = `pflug.dailyBest.${dailyInfo.date}`;
  let bestScore: number | null = null;
  try {
    const raw = localStorage.getItem(dateKey);
    if (raw) bestScore = Number(raw) || 0;
  } catch {
    /* localStorage blocked — silent fall back to no PB */
  }
  renderDailyLanding(
    overlays,
    {
      date: dailyInfo.date,
      pick: dailyInfo.pick,
      playsCount: dailyInfo.plays_count,
      bestScore,
      streakDays: authState().profile?.streak_days ?? 0,
    },
    {
      onPlay: () => startRun("daily"),
      onClose: () => showMenu(),
    },
  );
}

function recordDailyBest(date: string, score: number): void {
  const key = `pflug.dailyBest.${date}`;
  try {
    const prev = Number(localStorage.getItem(key) ?? "0") || 0;
    if (score > prev) localStorage.setItem(key, String(score));
  } catch {
    /* localStorage blocked — silent fall back */
  }
}

function onToggleSetting(key: keyof Settings): void {
  settings[key] = !settings[key];
  saveSettings(settings);
  renderer.options.highContrast = settings.highContrast;
  renderer.options.reducedMotion = settings.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  showMenu();
}

function startRun(runMode: RunMode = "casual"): void {
  overlays.innerHTML = "";
  mode = "playing";
  currentRunMode = runMode;
  pauseBtn.classList.remove("hidden");
  let ghost: GhostSim | undefined;
  // Daily twist: apply the modifier(s) on top of DEFAULT_CONFIG for
  // the run so physics match what the server will replay against.
  const runCfg =
    runMode === "daily" && dailyInfo
      ? applyModifiers(DEFAULT_CONFIG, dailyInfo.pick.modifiers)
      : DEFAULT_CONFIG;
  if (runMode === "challenge" && activeChallenge) {
    currentSeed = activeChallenge.seed >>> 0;
    ghost = new GhostSim(currentSeed, activeChallenge.inputs, runCfg);
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
    runCfg,
    {
      render: (sim, alpha, g) => renderer.draw(sim, alpha, g),
      onDeath: async (sim) => {
        mode = "dead";
        pauseBtn.classList.add("hidden");
        const score = sim.score;
        const ticks = sim.dieTick;
        if (currentRunMode === "daily" && dailyInfo) {
          recordDailyBest(dailyInfo.date, score);
        }
        if (score > bestScoreSeen) {
          bestScoreSeen = score;
          try {
            localStorage.setItem("pflug.bestScore.v1", String(bestScoreSeen));
          } catch {
            /* localStorage blocked — non-fatal */
          }
        }
        announce(`Run ended. Score ${score}. Press R to play again.`);
        const result = await trySubmit(sim);
        // If this run was queued from the 'Challenge a friend' menu
        // entry, auto-spin up a challenge and surface the share sheet.
        if (pendingChallengeTarget && result?.run_id) {
          const target = pendingChallengeTarget;
          pendingChallengeTarget = null;
          const created = await createChallenge(result.run_id, null);
          if (created.ok && created.short_id) {
            shareChallenge(score, created.short_id, target.friend?.username ?? null);
            return;
          }
        }
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
  const dailyPick = currentRunMode === "daily" ? dailyInfo?.pick : null;
  // Every share becomes a challenge link so opening it plays the friend
  // against the recorded ghost. Falls back to a bare landing URL if we
  // can't create one (offline, ranked, etc.).
  let challengeShortId: string | null = null;
  if (result?.run_id && currentRunMode !== "ranked") {
    const created = await createChallenge(result.run_id, activeChallenge?.short_id ?? null);
    if (created.ok && created.short_id) {
      challengeShortId = created.short_id;
      const params = new URLSearchParams();
      params.set("c", challengeShortId);
      if (s.profile?.friend_code) params.set("u", s.profile.friend_code);
      history.replaceState(null, "", `${window.location.origin}/?${params}`);
    }
  }
  const data: ShareCardData = {
    score,
    username: s.profile?.username ?? null,
    skin: renderer.options.skin,
    rarity: equippedSkin?.rarity,
    streakDays: result?.streak_days ?? s.profile?.streak_days ?? 0,
    friendCode: s.profile?.friend_code ?? null,
    mode: challengeShortId ? "challenge" : (currentRunMode === "ranked" ? "ranked" : currentRunMode),
    dailyDate: currentRunMode === "daily" ? dailyInfo?.date ?? null : null,
    dailyRank: null,
    totalPlayed: currentRunMode === "daily" ? dailyInfo?.plays_count ?? null : null,
    dailyTier: dailyPick?.tier ?? null,
    dailyModifierLabel: dailyPick ? dailyPick.modifiers.map((m) => m.blurb).join(" + ") : null,
    topRank,
  };
  renderShareSheet(overlays, data, () => {
    overlays.querySelector('[data-no-flap][class*="z-40"]')?.remove();
  });
}

function shareChallenge(score: number, shortId: string, addressedTo: string | null = null): void {
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
    addressedTo,
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

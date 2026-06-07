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
  syncEquippedShape,
  type SkinRow,
  rowToColors,
} from "./social/skins";
import { DEFAULT_SHAPE_ID, type ShapeId } from "./game/shapes";
import { getEquippedThemeLocal, setEquippedThemeLocal, setThemesLabMode, type ThemeId } from "./game/themes";
import { getEquippedPresetLocal, setEquippedPresetLocal, getPreset, setPresetLabMode } from "./game/preset-skins";
import { getEquippedPillarLocal, getPillarStyle } from "./game/pillars";
import { getEquippedPillarColorLocal } from "./game/pillar-colors";
import { getEquippedAchievementColorLocal, setEquippedAchievementColorLocal } from "./game/achievement-equip";
import { ACHIEVEMENTS } from "./game/achievements";
import { type SubmitResult } from "./social/runs";
import { installFlushHooks, pendingCount, submitOrEnqueue } from "./social/offline-queue";
import { fetchDaily, type DailyInfo } from "./social/daily";
import { renderShareSheet } from "./ui/share-sheet";
import { type ShareCardData } from "./social/share-card";
import { renderFriendsPanel } from "./ui/friends";
import { refreshChallengeWins, refreshFriendCount, type Friend } from "./social/friends";
import { refreshGrantedShapes } from "./social/grants";
import { loadAchievementStats, updateStatsAfterRun, saveAchievementStats, getNewlyUnlocked } from "./game/achievements";
import { getShowEquippedInMenu } from "./game/menu-prefs";
import { renderDailyLanding } from "./ui/daily-landing";
import { renderRankedPanel } from "./ui/ranked";
import { playFlap, playCheer, playGatePass, playDeath, setSoundLabMode } from "./game/sfx";
import { clearParticles, getActiveFlapFx, setFxLabMode, spawnFlapFx } from "./game/flap-fx";
import { type RankedMatch, createRankedChallenge } from "./social/ranked";
import { createChallenge, fetchChallenge, fetchBestRunChallenge, ghostSkinFromChallenge, fetchUnseenChallengeCount, type FetchedChallenge } from "./social/challenges";
import { renderInbox } from "./ui/inbox";
import { renderProfile } from "./ui/profile";
import { renderWhatsNew } from "./ui/whats-new";
import { renderTutorial, tutorialSeen, firstRealRunSeen, markFirstRealRunSeen } from "./ui/tutorial";
import { isFirstRun, markChangelogSeen, unseenChanges, CHANGELOG } from "./game/changelog";
import { renderQuests } from "./ui/quests";
import { evaluateRun, type QuestCompletion } from "./game/quests";
import { getGrantedShapesLocal } from "./social/grants";
import { listMyBadges } from "./social/badges";
import { BANNER } from "./game/support";

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
type RunMode = "casual" | "daily" | "challenge" | "challenge-create" | "ranked" | "training" | "race";

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
let pendingChallengeTarget: { friend: Friend | null } | null = null;
let inboxUnseen = 0;

app.innerHTML = `
  <section id="stage" role="application" aria-label="Glide play area" class="relative w-full h-full max-w-md max-h-[100svh] aspect-[9/16] mx-auto bg-sky-day overflow-hidden touch-none select-none">
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

// Persistent non-tracking banner slot. A single static message (house message
// or one sponsor) you control — no ad network, no SDK. It lives in the app
// shell (a thin fixed bar at the top of the viewport) so it shows on every
// menu/overlay screen but is hidden during an active run. It sits outside the
// canvas play area, so it never resizes the stage or perturbs the
// ResizeObserver-driven canvas sizing.
const appBanner = document.getElementById("app-banner") as HTMLDivElement | null;
let bannerDismissed = false;
if (appBanner) {
  if (BANNER.enabled) {
    const content = BANNER.href
      ? `<a href="${escapeHtmlAttr(BANNER.href)}" target="_blank" rel="noopener noreferrer" class="truncate hover:underline">${escapeHtmlAttr(BANNER.label)}</a>`
      : `<span class="truncate">${escapeHtmlAttr(BANNER.label)}</span>`;
    appBanner.innerHTML = `${content}<button data-banner-dismiss class="absolute right-2 opacity-50 hover:opacity-100 px-1" aria-label="Dismiss banner">✕</button>`;
    appBanner.querySelector("[data-banner-dismiss]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      bannerDismissed = true;
      appBanner.hidden = true;
      applyBannerOffset(false);
    });
  } else {
    appBanner.remove();
  }
}

// Banner height in px (matches the h-9 = 2.25rem bar). When the banner is
// shown we push #app down by this much so it sits ABOVE the menu chips
// instead of overlapping the account/settings buttons; the game area shrinks
// slightly. During gameplay the banner hides and the app returns to full.
const BANNER_H = 36;
function applyBannerOffset(active: boolean): void {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  // Pad the top of the centered flex container so the stage sits fully below
  // the fixed banner (no overlap, no clipped bottom). padding shrinks the
  // box cleanly; `top` left the stage overflowing past 100vh.
  appEl.style.paddingTop = active ? `${BANNER_H}px` : "";
}

function setBannerVisible(visible: boolean): void {
  if (!appBanner || !BANNER.enabled || bannerDismissed) {
    applyBannerOffset(false);
    return;
  }
  appBanner.hidden = !visible;
  applyBannerOffset(visible);
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
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
  ghostOpacity: settings.ghostOpacity,
});
const observer = new ResizeObserver(() => renderer.resize());
observer.observe(stage);

const input = new InputController(stage, {
  onFlap: () => {
    if (mode === "playing") {
      loop?.flap();
      if (settings.sound) playFlap();
      // Flap-FX spawns a particle burst at the plane's last-rendered
      // position. The renderer ticks + paints them in subsequent
      // frames. Visual-only — never feeds back into the sim.
      const fx = getActiveFlapFx();
      if (fx !== "off" && loop) {
        spawnFlapFx(fx, loop.sim.cfg.birdX, loop.sim.birdY);
      }
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
  void refreshChallengeWins();
  void refreshGrantedShapes();
  void refreshInboxBadge();
  // Backfill the equipped shape to the profile so existing players (who set
  // it before it was server-synced) show their real shape on boards/profiles.
  void syncEquippedShape(equippedShapeId);
  // Don't tear down an open panel (account, gallery, leaderboard, …)
  // when supabase fires an auth refresh — that was wiping the gallery
  // mid-browse.
  if (mode === "menu" && !panelOpen) showMenu();
});

async function refreshInboxBadge(): Promise<void> {
  const n = await fetchUnseenChallengeCount();
  if (n === inboxUnseen) return;
  inboxUnseen = n;
  if (mode === "menu" && !panelOpen) showMenu();
}

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
      themesLab: u.searchParams.get("themes") === "lab",
      fxLab: u.searchParams.get("fx") === "lab",
      colorsLab: u.searchParams.get("colors") === "lab",
    };
  } catch {
    return { from: null, dailyDate: null, challenge: null, soundsLab: false, themesLab: false, fxLab: false, colorsLab: false };
  }
})();
if (deepLink.soundsLab) setSoundLabMode(true);
if (deepLink.themesLab) setThemesLabMode(true);
if (deepLink.fxLab) setFxLabMode(true);
if (deepLink.colorsLab) setPresetLabMode(true);

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
  // Brand-new players get the onboarding tutorial first; returning players
  // see the "what's new" modal after an update. Never both at once.
  if (!tutorialSeen()) {
    pushSubView();
    panelOpen = true;
    renderTutorial(overlays, { onClose: () => showMenu(), onPractice: () => startRun("training") });
  } else {
    maybeShowWhatsNew();
  }
});

// Show the "what's new" modal once after an update. First-time players are
// not ambushed — we just record the current version as seen.
function maybeShowWhatsNew(): void {
  if (isFirstRun()) {
    markChangelogSeen();
    return;
  }
  const entries = unseenChanges();
  if (entries.length === 0) return;
  pushSubView();
  panelOpen = true;
  renderWhatsNew(overlays, entries, () => showMenu());
}

async function refreshDaily(): Promise<void> {
  dailyInfo = await fetchDaily();
  // Only re-render the menu when it's actually the visible surface —
  // not while a panel (gallery, friends, account, …) is open on top
  // of it. The 60s daily-refresh interval was calling showMenu() and
  // wiping whatever panel the player was browsing.
  if (mode === "menu" && !panelOpen) showMenu();
}

async function loadEquippedSkin(): Promise<void> {
  // A locally-equipped preset palette wins over DB skins — it's a
  // pure client choice with no server row.
  const presetId = getEquippedPresetLocal();
  if (presetId) {
    const p = getPreset(presetId);
    if (p) {
      equippedSkin = null;
      renderer.options.skin = { body: p.body, accent: p.accent };
      renderer.options.glow = false;
      return;
    }
  }
  // Achievement-color equip — local only, no DB row.
  const achColorId = getEquippedAchievementColorLocal();
  if (achColorId) {
    const a = ACHIEVEMENTS.find((x) => x.id === achColorId);
    if (a) {
      equippedSkin = null;
      renderer.options.skin = { body: a.reward.body, accent: a.reward.accent };
      renderer.options.glow = false;
      return;
    }
  }
  const s = authState();
  if (!s.ready || s.offline) {
    equippedSkin = null;
    renderer.options.skin = DEFAULT_SKIN;
    renderer.options.glow = false;
    return;
  }
  const wantedId = s.profile?.equipped_skin_id ?? getEquippedSkinIdLocal();
  if (!wantedId) {
    equippedSkin = null;
    renderer.options.skin = DEFAULT_SKIN;
    renderer.options.glow = false;
    return;
  }
  const rows = await listOwnedSkins();
  const found = rows.find((r) => r.id === wantedId) ?? null;
  equippedSkin = found;
  renderer.options.skin = found ? rowToColors(found) : DEFAULT_SKIN;
  // Legendary skins glow — makes the top rarity visible in motion.
  renderer.options.glow = found?.rarity === "legendary";
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
  setBannerVisible(true);
  pauseBtn.classList.add("hidden");
  loop?.stop();
  loop = null;
  activeChallenge = null;
  pendingChallengeTarget = null;
  renderer.options.ghostSkin = undefined;
  renderer.options.ghostShape = undefined;
  // Restore the player's own theme after a challenge painted the scene
  // with the sender's world.
  renderer.options.theme = equippedThemeId;
  clearParticles();
  overlays.innerHTML = "";
  renderMenu(
    overlays,
    settings,
    {
      onPlay: () => { pushSubView(); startRun("casual"); },
      onTraining: () => { pushSubView(); startRun("training"); },
      onPlayDaily: () => { pushSubView(); openDailyLanding(); },
      onToggleSetting,
      onSetGhostOpacity: (pct: number) => {
        settings.ghostOpacity = pct;
        saveSettings(settings);
        renderer.options.ghostOpacity = pct;
      },
      onShowChangelog: () => { pushSubView(); panelOpen = true; renderWhatsNew(overlays, CHANGELOG, () => showMenu()); },
      onHowToPlay: () => { pushSubView(); panelOpen = true; renderTutorial(overlays, { onClose: () => showMenu(), onPractice: () => startRun("training") }); },
      onOpenAccount: () => { pushSubView(); panelOpen = true; renderAccountPanel(overlays, () => showMenu(), (username) => openProfile(username)); },
      onOpenSkins: () => {
        pushSubView();
        panelOpen = true;
        renderGallery(
          overlays,
          { skinId: equippedSkin?.id ?? null, shapeId: equippedShapeId, themeId: equippedThemeId, presetId: getEquippedPresetLocal(), achColorId: getEquippedAchievementColorLocal() },
          {
            totalGames: authState().profile?.total_games ?? 0,
            bestScore: bestScoreSeen,
            streakDays: authState().profile?.streak_days ?? 0,
            lateNightGames: loadAchievementStats().lateNightGames,
            morningGames: loadAchievementStats().morningGames,
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
              void syncEquippedShape(id);
              renderer.options.shape = id;
            },
            onEquipTheme: (id) => {
              equippedThemeId = id;
              setEquippedThemeLocal(id);
              renderer.options.theme = id;
            },
            onEquipColorPreset: (id) => {
              setEquippedPresetLocal(id);
              if (id) {
                const p = getPreset(id);
                if (p) renderer.options.skin = { body: p.body, accent: p.accent };
              } else {
                void loadEquippedSkin();
              }
            },
            onEquipAchievementColor: (achId) => {
              setEquippedAchievementColorLocal(achId);
              if (achId) {
                const a = ACHIEVEMENTS.find((x) => x.id === achId);
                if (a) {
                  equippedSkin = null;
                  setEquippedPresetLocal(null);
                  renderer.options.skin = { body: a.reward.body, accent: a.reward.accent };
                  renderer.options.glow = false;
                }
              } else {
                void loadEquippedSkin();
              }
            },
            onClose: () => showMenu(),
          },
        );
      },
      onOpenLeaderboard: () => { pushSubView(); panelOpen = true; renderLeaderboard(overlays, () => showMenu(), (username) => openProfile(username)); },
      onOpenFriends: () => openFriendsPanel(),
      onOpenRanked: () => openRankedPanel(),
      onOpenQuests: () => {
        pushSubView();
        panelOpen = true;
        renderQuests(overlays, { onClose: () => showMenu() });
      },
      onOpenInbox: () => {
        pushSubView();
        panelOpen = true;
        // Opening the inbox clears the unseen badge immediately for
        // snappy feedback; the panel itself marks rows seen server-side.
        inboxUnseen = 0;
        renderInbox(overlays, {
          onAccept: async (shortId) => {
            const c = await fetchChallenge(shortId);
            if (c) {
              activeChallenge = c;
              startRun("challenge");
            } else {
              showMenu();
            }
          },
          onNewChallenge: () => openFriendsPanel(),
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
      equippedShape: equippedShapeId,
      equippedSkin: renderer.options.skin,
      equippedTheme: equippedThemeId,
      showEquippedInMenu: getShowEquippedInMenu(),
      inboxUnseen,
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
      attemptsUsed: dailyAttemptsUsed(dailyInfo.date),
      maxAttempts: DAILY_MAX_ATTEMPTS,
      glassHandicap: getPillarStyle(getEquippedPillarLocal()).hardensDaily,
    },
    {
      onPlay: () => startRun("daily"),
      onPlayCasual: () => startRun("casual"),
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

// Daily best-of-3: 3 attempts per UTC day, best counts. The cap is enforced
// here for UX and re-checked server-side (extra daily runs are downgraded to
// casual so they get no daily-leaderboard credit).
const DAILY_MAX_ATTEMPTS = 3;

function dailyAttemptsUsed(date: string): number {
  try {
    return Number(localStorage.getItem(`pflug.dailyAttempts.${date}`) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function bumpDailyAttempt(date: string): void {
  try {
    const key = `pflug.dailyAttempts.${date}`;
    localStorage.setItem(key, String(dailyAttemptsUsed(date) + 1));
  } catch {
    /* localStorage blocked — server still backstops the cap */
  }
}

function applyQuestReward(c: QuestCompletion): void {
  // Quest rewards write the same local stores the gallery equip-paths
  // use, so the unlock surfaces immediately on next gallery open.
  switch (c.step.reward.kind) {
    case "shape": {
      // Append to the granted-shapes local cache (mirrors what
      // refreshGrantedShapes would write from supabase). The next
      // gallery render reads it.
      const ids = getGrantedShapesLocal();
      if (!ids.includes(c.step.reward.shape)) {
        try {
          localStorage.setItem(
            "pflug.grantedShapes.v1",
            JSON.stringify([...ids, c.step.reward.shape]),
          );
        } catch {
          /* localStorage blocked */
        }
      }
      break;
    }
    case "theme": {
      // Equip the theme so the player sees their reward on next run.
      equippedThemeId = c.step.reward.theme;
      setEquippedThemeLocal(c.step.reward.theme);
      renderer.options.theme = c.step.reward.theme;
      break;
    }
    case "preset": {
      // Equip the preset palette directly.
      setEquippedPresetLocal(c.step.reward.preset);
      const p = getPreset(c.step.reward.preset);
      if (p) renderer.options.skin = { body: p.body, accent: p.accent };
      break;
    }
  }
}

type BoolSetting = "sound" | "highContrast" | "reducedMotion";
function onToggleSetting(key: keyof Settings): void {
  // Only the boolean toggles route here; ghostOpacity uses its own slider.
  if (key !== "sound" && key !== "highContrast" && key !== "reducedMotion") return;
  const k = key as BoolSetting;
  settings[k] = !settings[k];
  saveSettings(settings);
  renderer.options.highContrast = settings.highContrast;
  renderer.options.reducedMotion = settings.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  showMenu();
}

function startRun(runMode: RunMode = "casual"): void {
  overlays.innerHTML = "";
  mode = "playing";
  currentRunMode = runMode;
  renderer.options.pillarStyle = getEquippedPillarLocal();
  renderer.options.pillarColor = getEquippedPillarColorLocal();
  // Banner hidden during active gameplay — cleaner play area; restored on
  // showMenu / game-over. The offset is removed so the stage fills fully.
  setBannerVisible(false);
  pauseBtn.classList.remove("hidden");
  let ghost: GhostSim | undefined;
  // Daily twist: apply the modifier(s) on top of DEFAULT_CONFIG for
  // the run so physics match what the server will replay against.
  const runCfg =
    runMode === "daily" && dailyInfo
      ? applyModifiers(DEFAULT_CONFIG, dailyInfo.pick.modifiers)
      : DEFAULT_CONFIG;
  // Visual overlay applies to the daily only (global, fair worldwide);
  // cleared for every other mode below.
  renderer.options.visualEffect = null;
  if ((runMode === "challenge" || runMode === "race") && activeChallenge) {
    currentSeed = activeChallenge.seed >>> 0;
    ghost = new GhostSim(currentSeed, activeChallenge.inputs, runCfg);
    renderer.options.ghostSkin = ghostSkinFromChallenge(activeChallenge);
    // Flex: the ghost flies as the real sender's shape, and the whole
    // scene (sky + pillars) paints with the sender's theme. The player's
    // own plane keeps their shape/skin. Falls back to defaults on legacy
    // challenges that predate stored cosmetics.
    renderer.options.ghostShape = activeChallenge.creator_shape ?? undefined;
    renderer.options.theme = activeChallenge.creator_theme ?? equippedThemeId;
    renderer.options.mirror = false;
  } else if (runMode === "ranked" && activeRanked) {
    currentSeed = activeRanked.match.seeds[activeRanked.round] >>> 0;
    renderer.options.ghostSkin = undefined;
    renderer.options.ghostShape = undefined;
    renderer.options.theme = equippedThemeId;
    renderer.options.mirror = false;
  } else if (runMode === "daily" && dailyInfo) {
    currentSeed = dailyInfo.seed >>> 0;
    renderer.options.ghostSkin = undefined;
    renderer.options.ghostShape = undefined;
    renderer.options.theme = equippedThemeId;
    renderer.options.mirror = (dailyInfo?.pick.modifiers ?? []).some(m => m.id === "mirror");
    renderer.options.visualEffect = dailyInfo.pick.visualEffect;
  } else {
    currentSeed = (Math.random() * 0xffffffff) >>> 0;
    renderer.options.ghostSkin = undefined;
    renderer.options.ghostShape = undefined;
    renderer.options.theme = equippedThemeId;
    renderer.options.mirror = false;
  }
  loop = new GameLoop(
    currentSeed,
    runCfg,
    {
      render: (sim, alpha, g) => renderer.draw(sim, alpha, g),
      onScore: (sc) => {
        if (settings.sound) playGatePass();
        // Stadium theme: the crowd cheers every 20 points. Audio-only,
        // gated on the sound setting; never affects the deterministic sim.
        if (settings.sound && equippedThemeId === "stadium" && sc > 0 && sc % 20 === 0) {
          playCheer();
        }
      },
      onDeath: async (sim) => {
        if (settings.sound) playDeath();
        mode = "dead";
        pauseBtn.classList.add("hidden");
        const score = sim.score;
        const ticks = sim.dieTick;
        // Training mode: practice only. Nothing is tracked, submitted, or
        // unlocked — just replay. Skip all the recording side-effects.
        if (currentRunMode === "training") {
          announce(`Practice run ended. Score ${score}. Press R to play again.`);
          renderGameOver(overlays, score, () => startRun("training"), showMenu, {
            ticks,
            trainingMode: true,
          });
          return;
        }
        // Racing a player's best run: a local ghost race, nothing submitted.
        // Show the head-to-head result with Play again / menu.
        if (currentRunMode === "race" && activeChallenge) {
          const them = activeChallenge.creator_score;
          const who = activeChallenge.creator_username ?? "them";
          announce(`Race ended. You ${score}, @${who} ${them}. Press R to play again.`);
          renderGameOver(overlays, score, () => startRun("race"), showMenu, {
            ticks,
            raceContext: { creator: who, creatorScore: them },
          });
          return;
        }
        if (currentRunMode === "daily" && dailyInfo) {
          recordDailyBest(dailyInfo.date, score);
          bumpDailyAttempt(dailyInfo.date);
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
        {
          const currentStats = loadAchievementStats();
          const updatedStats = updateStatsAfterRun(currentStats, {
            score,
            mode: currentRunMode,
            inputCount: loop?.getRecordedInputs().length,
          });
          saveAchievementStats(updatedStats);
          // Surface ANY newly-earned achievement reward as a toast (previously
          // only server-minted color skins were celebrated, so achievement
          // unlocks were silent). Training returns earlier, so we're tracked here.
          for (const a of getNewlyUnlocked(currentStats, updatedStats)) {
            showUnlockToast(`🎉 unlocked: ${a.name}`);
          }
        }
        // Responding to a challenge resolves the duel server-side, so the
        // win tally may have changed — re-sync it for the achievement check.
        if (currentRunMode === "challenge") void refreshChallengeWins();
        // Challenge-create run (started from a friend row). Capture the
        // target so the game-over screen can offer Play again / Submit.
        // The challenge is only created + sent on Submit — never auto-sent,
        // so the player can retry for a better score first.
        const challengeTarget =
          currentRunMode === "challenge-create" ? pendingChallengeTarget : null;
        // Evaluate quest chains against this run's context. Any newly
        // completed steps apply their reward immediately (shape grant
        // / theme equip / preset equip) so the next run can use it.
        const questCompletions = evaluateRun({
          score,
          shapeId: equippedShapeId,
          themeId: equippedThemeId,
          totalGames: authState().profile?.total_games ?? 0,
          streakDays: result?.streak_days ?? authState().profile?.streak_days ?? 0,
        });
        for (const c of questCompletions) {
          applyQuestReward(c);
        }
        const share = (): void => {
          void openShare(score, result);
        };
        // "Play again" repeats the same mode — except:
        //  - a spent daily routes back through the landing (3-attempt cap),
        //  - a ranked round must NOT be replayed (the round is already
        //    submitted; the server rejects a re-submit). Route back to the
        //    ranked panel, which shows the correct "play round N of 3".
        const onPlayAgain =
          currentRunMode === "ranked"
            ? () => { activeRanked = null; openRankedPanel(); }
            : currentRunMode === "daily"
              ? () => openDailyLanding()
              : () => startRun(currentRunMode);
        renderGameOver(overlays, score, onPlayAgain, showMenu, {
          rankedRound: currentRunMode === "ranked" && activeRanked
            ? { round: activeRanked.round, total: 3 }
            : undefined,
          result,
          ticks,
          onShare: share,
          challengeCreate: challengeTarget
            ? {
                friendName: challengeTarget.friend?.username ?? null,
                canSubmit: !!result?.run_id,
                onSubmit: async () => {
                  if (!result?.run_id) return;
                  const created = await createChallenge(
                    result.run_id,
                    null,
                    challengeTarget.friend?.username ?? null,
                    { shape: equippedShapeId, theme: equippedThemeId },
                  );
                  if (created.ok && created.short_id) {
                    pendingChallengeTarget = null;
                    const toast = document.createElement("div");
                    toast.className =
                      "pointer-events-none fixed top-6 left-1/2 -translate-x-1/2 rounded-2xl bg-paper text-ink px-5 py-3 font-bold text-sm shadow-xl z-50";
                    toast.textContent = challengeTarget.friend?.username
                      ? `Challenge sent to @${challengeTarget.friend.username}!`
                      : "Challenge sent!";
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 2500);
                    // Optional share — the friend already has the challenge
                    // in their inbox; this just lets the player also post it.
                    shareChallenge(score, created.short_id, challengeTarget.friend?.username ?? null);
                  }
                },
              }
            : undefined,
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
                const r = await createChallenge(result.run_id, activeChallenge?.short_id ?? null, null, { shape: equippedShapeId, theme: equippedThemeId });
                if (r.ok) {
                  const toast = document.createElement("div");
                  toast.className = "pointer-events-none fixed top-6 left-1/2 -translate-x-1/2 rounded-2xl bg-paper text-ink px-5 py-3 font-bold text-sm shadow-xl z-50";
                  toast.textContent = "Rematch sent!";
                  document.body.appendChild(toast);
                  setTimeout(() => toast.remove(), 2500);
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
    runMode === "training",
  );
  loop.start();

  // Practice-mode badge: persistent in-run label so players always know
  // this isn't a real run. Shown over the overlays div (outside canvas).
  if (runMode === "training") {
    const badge = document.createElement("div");
    badge.dataset.noFlap = "true";
    badge.className =
      "pointer-events-none absolute top-3 left-3 z-20 rounded-full bg-black/50 text-paper text-[10px] font-bold uppercase tracking-wider px-3 py-1.5";
    badge.textContent = "practice · can't lose";
    overlays.appendChild(badge);
  }

  // First real run hint: brief fade-in label for players who just finished
  // the tutorial and are about to play their first scored run.
  if (runMode === "casual" && tutorialSeen() && !firstRealRunSeen()) {
    markFirstRealRunSeen();
    const hint = document.createElement("div");
    hint.dataset.noFlap = "true";
    hint.className =
      "pointer-events-none absolute inset-x-0 top-1/3 z-20 text-center text-paper text-sm font-bold px-6 transition-opacity duration-1000";
    hint.style.opacity = "1";
    hint.textContent = "This one counts — good luck! 🍀";
    overlays.appendChild(hint);
    // Fade out after 2.5s, then remove.
    window.setTimeout(() => { hint.style.opacity = "0"; }, 2500);
    window.setTimeout(() => { hint.remove(); }, 3500);
  }
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
    const created = await createChallenge(result.run_id, activeChallenge?.short_id ?? null, null, { shape: equippedShapeId, theme: equippedThemeId });
    if (created.ok && created.short_id) {
      challengeShortId = created.short_id;
      const params = new URLSearchParams();
      params.set("c", challengeShortId);
      history.replaceState(null, "", `${window.location.origin}/?${params}`);
    }
  }
  const data: ShareCardData = {
    score,
    username: s.profile?.username ?? null,
    skin: renderer.options.skin,
    shape: equippedShapeId,
    themeId: equippedThemeId,
    rarity: equippedSkin?.rarity,
    streakDays: result?.streak_days ?? s.profile?.streak_days ?? 0,
    mode: challengeShortId ? "challenge" : currentRunMode === "ranked" ? "ranked" : currentRunMode === "daily" ? "daily" : currentRunMode === "challenge" ? "challenge" : "casual",
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
    shape: equippedShapeId,
    themeId: equippedThemeId,
    rarity: equippedSkin?.rarity,
    streakDays: s.profile?.streak_days ?? 0,
    mode: "challenge",
    dailyDate: null,
    dailyRank: null,
    totalPlayed: null,
    addressedTo,
    challengeShortId: shortId,
  };
  // Inject the challenge short-id into the share URL so opening the
  // link kicks the recipient into the ghost run.
  const params = new URLSearchParams();
  params.set("c", shortId);
  const baseUrl = window.location.origin;
  history.replaceState(null, "", `${baseUrl}/?${params}`);
  renderShareSheet(overlays, data, () => {
    overlays.querySelector('[data-no-flap][class*="z-40"]')?.remove();
  });
}

// Small transient toast for any unlock (achievement colors, etc.). Stacks
// briefly bottom-center; auto-dismisses. Cosmetic feedback only.
let unlockToastCount = 0;
function showUnlockToast(text: string): void {
  const t = document.createElement("div");
  t.className =
    "pointer-events-none fixed left-1/2 -translate-x-1/2 rounded-2xl bg-paper text-ink px-5 py-3 font-bold text-sm shadow-xl z-50";
  t.style.bottom = `${24 + unlockToastCount * 56}px`;
  t.textContent = text;
  document.body.appendChild(t);
  unlockToastCount++;
  window.setTimeout(() => {
    t.remove();
    unlockToastCount = Math.max(0, unlockToastCount - 1);
  }, 2600);
}

function openProfile(username: string): void {
  pushSubView();
  panelOpen = true;
  // The profile card layers above whatever opened it (friends list,
  // leaderboard); closing it returns to that surface, not the menu.
  renderProfile(
    overlays,
    username,
    () => {
      /* card removed itself; nothing else to restore */
    },
    (uname) => {
      // Race their best run: fetch it as a challenge-shaped ghost, then start
      // a local race. Offline / no scoring run → quietly do nothing.
      void (async () => {
        const best = await fetchBestRunChallenge(uname);
        if (!best) return;
        activeChallenge = best;
        overlays.innerHTML = "";
        panelOpen = false;
        startRun("race");
      })();
    },
  );
}

function openRankedPanel(): void {
  pushSubView();
  panelOpen = true;
  renderRankedPanel(overlays, {
    onPlayRound: (match, round) => {
      activeRanked = { match, round };
      startRun("ranked");
    },
    onViewProfile: (_userId, username) => {
      if (username) openProfile(username);
    },
    onClose: () => showMenu(),
  });
}

function showToast(message: string): void {
  const toast = document.createElement("div");
  toast.className = "pointer-events-none fixed top-6 left-1/2 -translate-x-1/2 rounded-2xl bg-paper text-ink px-5 py-3 font-bold text-sm shadow-xl z-50";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function openFriendsPanel(): void {
  pushSubView();
  panelOpen = true;
  renderFriendsPanel(overlays, () => showMenu(), {
    onChallenge: (friend) => {
      panelOpen = false;
      pendingChallengeTarget = { friend };
      startRun("challenge-create");
    },
    onRankedChallenge: async (friend) => {
      if (!friend.username) return;
      const r = await createRankedChallenge(friend.username);
      if (r.ok) {
        showToast(`Ranked match vs @${friend.username} started!`);
        openRankedPanel();
      } else {
        showToast("Couldn't start ranked match.");
      }
    },
    onViewProfile: (friend) => {
      if (friend.username) openProfile(friend.username);
    },
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
    // training/race never reach here (they return before trySubmit), but map
    // them to casual so the submit payload type stays valid.
    mode:
      currentRunMode === "challenge-create" || currentRunMode === "training" || currentRunMode === "race"
        ? "casual"
        : currentRunMode,
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

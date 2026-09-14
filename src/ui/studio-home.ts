import type { MenuMeta } from "./menu";
import { getTheme, DEFAULT_THEME_ID } from "../game/themes";
import { getShape, DEFAULT_SHAPE_ID } from "../game/shapes";
import { getBackgroundSource } from "../game/backgrounds";
import { DEFAULT_SKIN } from "../game/skin";
import { levelFromTotalXp, loadTotalXp } from "../game/xp";
import { shapeSvgInner } from "./shape-svg";
import { studioIcon } from "./studio-icons";

const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);

/** Real menu markup: every action is bound by renderMenu, no simulated stats. */
export function studioHome(meta: MenuMeta): string {
  const equipped = meta.showEquippedInMenu !== false;
  const theme = getTheme(equipped ? meta.equippedTheme : DEFAULT_THEME_ID);
  const shape = getShape(equipped ? meta.equippedShape : DEFAULT_SHAPE_ID);
  const skin = equipped && meta.equippedSkin ? meta.equippedSkin : DEFAULT_SKIN;
  const art = getBackgroundSource(theme.backgroundImage ?? theme.backgroundStages?.[0]?.image ?? "");
  const level = levelFromTotalXp(loadTotalXp());
  const count = Math.max(0, meta.inboxUnseen ?? 0);
  const offline = meta.online === false || meta.accountLabel === "offline";
  const pilotLabel = meta.accountLabel === "offline" ? "Local pilot" : meta.accountLabel;
  const connection = offline ? "Offline · play locally" : meta.pendingSubmissions ? "Sync pending" : "Ready for takeoff";
  const queue = meta.pendingSubmissions ? ` · ${meta.pendingSubmissions} run${meta.pendingSubmissions===1?"":"s"} waiting` : "";
  const dailyText = meta.daily?.modifierBlurbs.length ? meta.daily.modifierBlurbs.map(esc).join(" · ") : "One shared sky. A fresh challenge every day.";
  const nav = (action: string, label: string, icon: Parameters<typeof studioIcon>[0], badge = 0): string =>
    `<button data-action="${action}" class="studio-nav-item">${studioIcon(icon)}<span>${label}</span>${badge ? `<b class="studio-counter">${badge>9?"9+":badge}</b>` : ""}</button>`;
  return `<header class="studio-topbar">
    <a class="studio-wordmark" href="/" aria-label="Glide home">${studioIcon("plane")}<span>glide<span class="studio-beta">BETA</span></span></a>
    <div class="studio-top-actions"><button data-account class="studio-account" aria-label="Open pilot profile"><span class="studio-avatar">${studioIcon("pilot")}</span><span><strong>${esc(pilotLabel)}</strong><small>Level ${level.level}${meta.streakDays ? ` · ${meta.streakDays}-day streak` : ""}</small></span></button>
    <button data-settings class="studio-icon-button" aria-label="Settings">${studioIcon("settings")}</button></div>
  </header>
  <div data-menu-content class="studio-home-content">
    <div class="studio-greeting"><div><span class="studio-eyebrow">THE PAPER SKY</span><h1>A little escape.<br>A little further.</h1></div><span class="studio-edition">01<br><small>STUDIO</small></span></div>
    <section class="studio-flight-card" aria-label="Your current aircraft and world">
      <div class="studio-flight-art" style="background:linear-gradient(${theme.colors.skyTop},${theme.colors.skyBottom})">
        ${art ? `<img src="${art}" alt="" class="studio-world-image">` : ""}
        <span class="studio-flight-label">YOUR NEXT FLIGHT</span>
        <svg viewBox="-20 -20 40 40" data-menu-mascot class="studio-mascot" aria-label="${esc(shape.name)}">${shapeSvgInner(shape.id,skin.body,skin.accent)}</svg>
        <div class="studio-flight-caption"><span>${esc(shape.name)}</span><button data-action="customize" aria-label="Customize your aircraft and world">Customize ${studioIcon("arrow")}</button></div>
      </div>
      <button data-action="play" class="studio-play"><span>${studioIcon("play")}<span>Take flight<small>Classic · chase your best</small></span></span>${studioIcon("arrow")}</button>
    </section>
    <button data-action="daily" class="studio-daily"><span class="studio-daily-mark">${studioIcon("sun")}</span><span class="studio-daily-copy"><span class="studio-eyebrow">TODAY’S DAILY${meta.daily?` · ${esc(meta.daily.tier.replace("_"," "))}`:""}</span><strong>A new fold in the sky</strong><small>${dailyText}</small></span>${studioIcon("arrow")}</button>
    <div class="studio-mode-row"><button data-action="ranked">${studioIcon("trophy")}<span>Ranked<small>Three rounds. One rival.</small></span>${studioIcon("arrow")}</button>
      <button data-action="training">${studioIcon("feather")}<span>Practice<small>Relax. Nothing is tracked.</small></span>${studioIcon("arrow")}</button></div>
    <div class="studio-connection" role="status"><span class="studio-status-dot ${offline?"is-offline":""}"></span>${connection}${queue}</div>
  </div>
  <nav class="studio-bottom-nav" aria-label="Explore Glide">
    ${nav("skins","Collection","collection")}${nav("leaderboard","Leaderboard","board")}${nav("quests","Journey","journey")}${nav("friends","Friends","friends")}${nav("inbox","Challenges","mail",count)}
  </nav>`;
}

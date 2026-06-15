/**
 * "Available now" event popup — announces a live event package once, styled as
 * a paper bulletin (matching the Hangar identity). Shows what's in the package
 * and how to unlock it ("free — just play"), with live progress.
 *
 * Dismissing marks the event announced so it won't reappear.
 */
import { eventProgress, markEventAnnounced, type GameEvent } from "../game/events";
import { shapeSvgInner } from "./shape-svg";
import { PRESET_SKINS } from "../game/preset-skins";
import { getPillarColor } from "../game/pillar-colors";
import type { ShapeId } from "../game/shapes";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** A tiny swatch/icon for a reward, drawn (no emoji art) per kind. */
function rewardIcon(kind: string, id: string): string {
  if (kind === "shape") {
    return `<svg viewBox="-20 -16 40 32" class="w-8 h-8">${shapeSvgInner(
      id as ShapeId,
      [244, 234, 213],
      [26, 26, 26],
    )}</svg>`;
  }
  if (kind === "preset") {
    const p = PRESET_SKINS.find((x) => x.id === id);
    const b = p ? `rgb(${p.body.join(",")})` : "#888";
    const a = p ? `rgb(${p.accent.join(",")})` : "#444";
    return `<span class="inline-block w-7 h-7 rounded-md" style="background:linear-gradient(135deg,${b} 55%,${a} 55%)"></span>`;
  }
  if (kind === "pillar") {
    const c = getPillarColor(id);
    const body = c?.body || "#3d8b58";
    const cap = c?.cap || "#1f4f37";
    return `<span class="inline-flex flex-col w-5 h-7 rounded-sm overflow-hidden border border-black/30"><span style="background:${cap};height:30%"></span><span style="background:${body};height:70%"></span></span>`;
  }
  if (kind === "fx") return `<span class="text-lg">✨</span>`;
  if (kind === "gate") return `<span class="text-lg">🎵</span>`;
  return "";
}

export function renderEventPopup(host: HTMLElement, ev: GameEvent, onClose: () => void): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-40 bg-black/60 backdrop-blur-sm font-display flex items-center justify-center px-4";

  const { plays, rewards } = eventProgress(ev);
  const maxThreshold = Math.max(...ev.rewards.filter((r) => !r.onFinalDay).map((r) => r.threshold));
  const unlockedCount = rewards.filter((r) => r.unlocked).length;
  const pct = Math.min(100, Math.round((plays / maxThreshold) * 100));
  const finalDate = ev.until.slice(5).replace("-", "/"); // mm/dd

  const rows = rewards
    .map((r) => {
      const left = Math.max(0, r.threshold - plays);
      const status = r.unlocked
        ? `<span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700">unlocked</span>`
        : r.onFinalDay
          ? `<span class="text-[10px] opacity-60">play on ${finalDate}</span>`
          : `<span class="text-[10px] opacity-60">play ${left} more</span>`;
      return `
        <div class="flex items-center gap-3 py-1.5 ${r.unlocked ? "" : "opacity-70"}">
          <div class="w-9 h-9 shrink-0 flex items-center justify-center swatch-plate rounded-lg">${rewardIcon(r.kind, r.id)}</div>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-bold font-hand leading-tight">${escapeHtml(r.label)}</div>
            <div class="text-[10px] opacity-55 capitalize">${r.kind}</div>
          </div>
          ${status}
        </div>`;
    })
    .join("");

  wrap.innerHTML = `
    <div class="paper-note w-full max-w-sm p-5 max-h-[85vh] overflow-y-auto">
      <div class="flex items-center gap-2">
        <span class="paper-chip">available now</span>
      </div>
      <h2 class="font-hand text-3xl font-bold mt-3 leading-none">${escapeHtml(ev.name)}</h2>
      <p class="text-[12px] opacity-75 mt-2 leading-snug">${escapeHtml(ev.blurb)}</p>

      <div class="mt-3 mb-1 flex items-baseline justify-between text-[11px]">
        <span class="font-bold">${unlockedCount}/${ev.rewards.length} earned</span>
        <span class="opacity-60">${plays} game${plays === 1 ? "" : "s"} this event</span>
      </div>
      <div class="h-1.5 rounded-full overflow-hidden" style="background:rgba(26,26,26,0.15)">
        <div class="h-full" style="width:${pct}%;background:#1a1a1a"></div>
      </div>

      <div class="mt-3 divide-y divide-black/10">${rows}</div>

      <div class="mt-3 text-center text-[11px] opacity-60">free — just play. earned kit is yours to keep.</div>
      <button data-close class="btn mt-4 w-full py-3 bg-ink text-paper font-bold">let's play</button>
    </div>
  `;
  host.appendChild(wrap);

  const close = (): void => {
    markEventAnnounced(ev.id);
    wrap.remove();
    onClose();
  };
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  return () => wrap.remove();
}

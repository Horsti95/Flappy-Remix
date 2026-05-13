import { listOwnedSkins, type SkinRow } from "../social/skins";
import { RARITY_COLOR, rarityRank } from "../game/rarity";

export function renderSkinPicker(host: HTMLElement, equippedId: string | null, onPick: (id: string | null) => void, onClose: () => void): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-0 z-30 bg-black/70 backdrop-blur-sm font-display text-paper overflow-y-auto";
  wrap.innerHTML = `
    <div class="max-w-md mx-auto px-5 py-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">skins</h2>
        <button data-close class="text-sm underline opacity-70">close</button>
      </div>
      <p class="text-xs opacity-60 mt-1">unlocked by playing games. rarity comes from contrast + hue.</p>
      <div data-grid class="mt-4 grid grid-cols-3 gap-3">
        <div class="opacity-60 text-xs">loading…</div>
      </div>
    </div>
  `;
  host.appendChild(wrap);
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose();
  });

  let cancelled = false;
  listOwnedSkins().then((rows) => {
    if (cancelled) return;
    const grid = wrap.querySelector("[data-grid]") as HTMLDivElement;
    rows.sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.unlocked_at_games - a.unlocked_at_games);
    grid.innerHTML = "";
    if (rows.length === 0) {
      grid.innerHTML = `<div class="col-span-3 text-center opacity-70 text-xs py-8">no skins unlocked yet — play one game to mint your first.</div>`;
      return;
    }
    for (const row of rows) grid.appendChild(card(row, row.id === equippedId, onPick));
  });

  return () => {
    cancelled = true;
    wrap.remove();
  };
}

function card(row: SkinRow, equipped: boolean, onPick: (id: string | null) => void): HTMLElement {
  const el = document.createElement("button");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[10px] gap-2 border-2 ${
    equipped ? "border-paper" : "border-white/10"
  } bg-white/5 active:scale-95 transition`;
  el.style.setProperty("--ring", RARITY_COLOR[row.rarity]);
  el.innerHTML = `
    <svg viewBox="-20 -20 40 40" class="w-12 h-12">
      <polygon points="-14,6 14,-6 1,0 14,-6 -1,11" fill="rgb(${row.body.join(",")})" stroke="#1a1a1a" stroke-width="0.8"/>
      <polygon points="1,0 -14,6 -1,11" fill="rgb(${row.accent.join(",")})" stroke="#1a1a1a" stroke-width="0.8"/>
    </svg>
    <div class="font-bold capitalize" style="color: var(--ring)">${row.rarity}</div>
    <div class="opacity-50">@${row.unlocked_at_games}</div>
    ${equipped ? `<div class="absolute top-1 right-1 text-[9px] bg-paper text-ink rounded-full px-1">equipped</div>` : ""}
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onPick(equipped ? null : row.id);
  });
  return el;
}

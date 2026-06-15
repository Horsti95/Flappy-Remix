/**
 * "Pick 1 of 3" colour choice card. Shows three colours painted on the
 * player's equipped shape; picking one commits it and locks the other two
 * forever (a deliberate, weighty choice). Paper-bulletin styling.
 */
import { resolveChoice, type ChoiceSet } from "../game/color-choices";
import { shapeSvgInner } from "./shape-svg";
import type { ShapeId } from "../game/shapes";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function renderColorChoice(
  host: HTMLElement,
  set: ChoiceSet,
  shapeId: ShapeId,
  onPicked: (colorId: string) => void,
): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-40 bg-black/65 backdrop-blur-sm font-display flex items-center justify-center px-4";

  const swatches = set.options
    .map(
      (o) => `
      <button data-pick="${o.id}" class="paper-note p-2 flex flex-col items-center gap-1.5 active:scale-95 transition" style="--ring:#1a1a1a">
        <div class="w-full aspect-square flex items-center justify-center swatch-plate rounded-lg">
          <svg viewBox="-20 -16 40 32" class="w-4/5 h-4/5">${shapeSvgInner(shapeId, o.body, o.accent)}</svg>
        </div>
        <div class="font-hand text-[12px] font-bold capitalize leading-tight text-center">${escapeHtml(o.name)}</div>
      </button>`,
    )
    .join("");

  wrap.innerHTML = `
    <div class="paper-note w-full max-w-sm p-5">
      <div class="flex items-center gap-2"><span class="paper-chip">choose one</span></div>
      <h2 class="font-hand text-2xl font-bold mt-2 leading-tight">${escapeHtml(set.prompt)}</h2>
      <p class="text-[12px] opacity-70 mt-1">Pick one to keep. The other two lock <b>forever</b>.</p>
      <div class="grid grid-cols-3 gap-2.5 mt-4">${swatches}</div>
      <div data-confirm class="hidden mt-4">
        <button data-go class="btn w-full py-3 bg-ink text-paper font-bold"></button>
        <button data-cancel class="btn w-full py-2 mt-1 bg-black/10 text-[12px] font-bold">pick a different one</button>
      </div>
    </div>
  `;
  host.appendChild(wrap);

  let selected: string | null = null;
  const confirm = wrap.querySelector("[data-confirm]") as HTMLDivElement;
  const goBtn = wrap.querySelector("[data-go]") as HTMLButtonElement;

  const markSelected = (id: string | null): void => {
    wrap.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((b) => {
      b.classList.toggle("is-equipped", b.dataset.pick === id);
    });
  };

  wrap.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      selected = btn.dataset.pick!;
      const opt = set.options.find((o) => o.id === selected)!;
      markSelected(selected);
      goBtn.textContent = `choose ${opt.name} — lose the rest`;
      confirm.classList.remove("hidden");
    });
  });

  wrap.querySelector("[data-cancel]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    selected = null;
    markSelected(null);
    confirm.classList.add("hidden");
  });

  goBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!selected) return;
    resolveChoice(set.id, selected);
    wrap.remove();
    onPicked(selected);
  });

  return () => wrap.remove();
}

import {
  getChainViews,
  type QuestChain,
  type QuestReward,
  type QuestStep,
} from "../game/quests";

export interface QuestsCallbacks {
  onClose(): void;
}

export function renderQuests(host: HTMLElement, cbs: QuestsCallbacks): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-30 bg-black/85 backdrop-blur-sm font-display text-paper flex flex-col";
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold">quests</h2>
        <div class="text-[11px] opacity-70 mt-0.5">multi-step chains that unlock content as you play.</div>
      </div>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div data-body class="mt-2 px-3 flex-1 overflow-y-auto pb-6"></div>
  `;
  host.appendChild(wrap);

  const close = (): void => {
    wrap.remove();
    cbs.onClose();
  };
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  const body = wrap.querySelector("[data-body]") as HTMLDivElement;
  const views = getChainViews();
  body.innerHTML = "";
  for (const v of views) body.appendChild(chainCard(v.chain, v.activeIndex, v.complete));

  return close;
}

function chainCard(chain: QuestChain, activeIndex: number, complete: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = "rounded-2xl bg-white/5 p-4 mb-3";
  const completed = Math.min(activeIndex, chain.steps.length);
  const pct = Math.round((completed / chain.steps.length) * 100);
  const stepRows = chain.steps
    .map((step, i) => {
      const done = i < activeIndex;
      const active = i === activeIndex;
      return stepRow(step, done, active);
    })
    .join("");
  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <div class="text-base font-bold capitalize">${escapeHtml(chain.name)}</div>
        <div class="text-[11px] opacity-70 mt-0.5">${escapeHtml(chain.blurb)}</div>
      </div>
      ${complete
        ? `<span class="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">complete</span>`
        : `<span class="text-[10px] opacity-60">${completed} / ${chain.steps.length}</span>`}
    </div>
    <div class="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div class="h-full bg-paper transition-all" style="width:${pct}%"></div>
    </div>
    <div class="mt-3 space-y-1.5">${stepRows}</div>
  `;
  return el;
}

function stepRow(step: QuestStep, done: boolean, active: boolean): string {
  const icon = done
    ? `<span class="text-emerald-300">✓</span>`
    : active
      ? `<span class="text-paper">●</span>`
      : `<span class="opacity-40">○</span>`;
  const titleCls = done ? "opacity-50 line-through" : active ? "font-bold" : "opacity-60";
  const r = step.reward;
  const kindMeta: Record<QuestReward["kind"], { icon: string; noun: string }> = {
    shape: { icon: "✈", noun: "shape" },
    theme: { icon: "🌅", noun: "theme" },
    preset: { icon: "🎨", noun: "palette" },
  };
  const meta = kindMeta[r.kind];
  const rewardCls = done ? "opacity-40" : "opacity-70";
  return `
    <div class="flex items-start gap-2 text-[12px]">
      <div class="w-4 text-center mt-0.5">${icon}</div>
      <div class="flex-1">
        <div class="${titleCls}">${escapeHtml(step.title)}</div>
        <div class="text-[10px] ${rewardCls} mt-0.5">
          <span aria-hidden="true">${meta.icon}</span>
          reward: ${escapeHtml(r.label)}
          <span class="opacity-60">· ${meta.noun}</span>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

import { markChangelogSeen, type ChangeEntry } from "../game/changelog";

/**
 * "What's new" modal — shown once after an update (see game/changelog.ts).
 * Dismissing marks the current version seen so it won't reappear.
 */
export function renderWhatsNew(host: HTMLElement, entries: ChangeEntry[], onClose: () => void): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-40 bg-black/85 backdrop-blur-sm font-display text-paper flex items-center justify-center px-5";

  const sections = entries
    .map(
      (e) => `
      <div class="mb-4">
        <div class="flex items-baseline gap-2">
          <div class="text-sm font-bold">${escapeHtml(e.title)}</div>
          <div class="text-[10px] opacity-50">v${escapeHtml(e.version)} · ${escapeHtml(e.date)}</div>
        </div>
        <ul class="mt-2 space-y-1.5">
          ${e.notes.map((n) => `<li class="text-[12px] opacity-85 flex gap-2"><span class="opacity-50">·</span><span>${escapeHtml(n)}</span></li>`).join("")}
        </ul>
      </div>`,
    )
    .join("");

  wrap.innerHTML = `
    <div class="w-full max-w-sm rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 max-h-[80vh] overflow-y-auto">
      <div class="text-lg font-bold">✨ what's new</div>
      <div class="mt-4">${sections}</div>
      <button data-close class="mt-2 w-full rounded-2xl bg-paper text-ink font-bold py-3">let's go</button>
    </div>
  `;
  host.appendChild(wrap);

  const close = (): void => {
    markChangelogSeen();
    wrap.remove();
    onClose();
  };
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  return close;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

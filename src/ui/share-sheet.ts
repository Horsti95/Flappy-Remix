import { drawShareCard, type ShareCardData } from "../social/share-card";
import {
  buildShareText,
  nativeShareOrFallback,
  twitterUrl,
  whatsappUrl,
} from "../social/share";

export function renderShareSheet(host: HTMLElement, data: ShareCardData, onClose: () => void): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-0 z-40 bg-black/85 backdrop-blur-sm font-display text-paper flex flex-col";
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <h2 class="text-2xl font-bold font-hand">share your run</h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div class="px-5 flex-1 flex flex-col items-center justify-start gap-4 overflow-y-auto pb-4">
      <div class="relative w-full max-w-xs">
        <canvas data-card class="w-full block rounded-2xl shadow-2xl" style="aspect-ratio: 9/16;"></canvas>
      </div>
      <button data-native class="w-full max-w-xs rounded-2xl bg-paper text-ink font-bold py-3">share…</button>
      <div class="grid grid-cols-3 gap-2 w-full max-w-xs">
        <a data-whatsapp target="_blank" rel="noopener" class="text-center rounded-xl bg-white/10 py-2 text-xs">WhatsApp</a>
        <a data-x target="_blank" rel="noopener" class="text-center rounded-xl bg-white/10 py-2 text-xs">X</a>
        <button data-copy class="rounded-xl bg-white/10 py-2 text-xs">copy link</button>
      </div>
      <button data-download class="text-[11px] underline opacity-70">download image only</button>
      <div data-status class="text-[11px] opacity-60 h-4"></div>
    </div>
  `;
  host.appendChild(wrap);

  const canvas = wrap.querySelector("[data-card]") as HTMLCanvasElement;
  // Hi-res offscreen render for the share blob, downscaled on screen.
  drawShareCard(canvas, data);

  const links = buildShareText(data);
  (wrap.querySelector("[data-whatsapp]") as HTMLAnchorElement).href = whatsappUrl(links);
  (wrap.querySelector("[data-x]") as HTMLAnchorElement).href = twitterUrl(links);

  const status = wrap.querySelector("[data-status]") as HTMLDivElement;

  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose();
  });
  wrap.querySelector("[data-native]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    status.textContent = "preparing…";
    const r = await nativeShareOrFallback(data);
    status.textContent = r.method === "download" ? "image downloaded + text copied" : r.method === "clipboard" ? "text copied to clipboard" : "shared";
  });
  wrap.querySelector("[data-copy]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${links.text} ${links.url}`);
      status.textContent = "link copied";
    } catch {
      status.textContent = "copy blocked by browser";
    }
  });
  wrap.querySelector("[data-download]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pflug-${data.score}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  });

  return () => wrap.remove();
}

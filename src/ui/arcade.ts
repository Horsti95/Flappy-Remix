/**
 * Arcade Mode UI shell — start-of-run is handled by the menu; this renders the
 * Arcade game-over card. Kept separate from `renderGameOver` (scored modes)
 * because Arcade never submits, unlocks, or hits a leaderboard — it's purely
 * "nice run, go again".
 */
export interface ArcadeGameOverStats {
  score: number;
  coins: number;
  bestCombo: number;
}

export interface ArcadeGameOverCallbacks {
  onPlayAgain(): void;
  onExit(): void;
}

export function renderArcadeGameOver(
  host: HTMLElement,
  stats: ArcadeGameOverStats,
  cbs: ArcadeGameOverCallbacks,
): void {
  host.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm px-6";
  wrap.innerHTML = `
    <div class="w-full max-w-xs rounded-3xl bg-ink/90 text-paper p-6 shadow-2xl text-center">
      <div class="text-[11px] uppercase tracking-widest opacity-60">Arcade · beta</div>
      <div class="text-4xl font-black mt-1">${stats.score}</div>
      <div class="text-[12px] opacity-70">score</div>
      <div class="flex justify-center gap-6 mt-4 text-sm">
        <div><div class="font-bold text-[#ffd54f]">🪙 ${stats.coins}</div><div class="text-[10px] opacity-60">coins</div></div>
        <div><div class="font-bold text-[#ffe082]">x combo ${stats.bestCombo}</div><div class="text-[10px] opacity-60">best combo</div></div>
      </div>
      <button data-action="again" class="mt-6 w-full rounded-2xl bg-paper text-ink font-bold py-3 active:scale-95 transition">Play again</button>
      <button data-action="exit" class="mt-3 w-full rounded-2xl border border-paper/40 text-paper font-bold py-2.5 text-sm active:scale-95 transition">Back to menu</button>
    </div>
  `;
  wrap.querySelector('[data-action="again"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onPlayAgain();
  });
  wrap.querySelector('[data-action="exit"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onExit();
  });
  host.appendChild(wrap);
}

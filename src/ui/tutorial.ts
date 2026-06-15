/**
 * Onboarding tutorial — a short, skippable card carousel that teaches the
 * core loop, then drops the newcomer into a can't-die practice run so they
 * can try tapping with zero stakes.
 *
 * Shown automatically on the very first launch (gated by localStorage) and
 * replayable any time from the menu's "How to play" entry.
 */

const SEEN_KEY = "pflug.tutorialSeen.v1";
const FIRST_RUN_KEY = "pflug.firstRealRun.v1";

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* localStorage blocked — harmless, tutorial may show again */
  }
}

/** Returns true if the player has had their first real (non-practice) run. */
export function firstRealRunSeen(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markFirstRealRunSeen(): void {
  try {
    localStorage.setItem(FIRST_RUN_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface Step {
  emoji: string;
  title: string;
  body: string;
}

// Onboarding v2 — show, don't tell. Three tiny icon cards (≤5 words each)
// that set expectations, then straight into the can't-crash practice run
// where the real teaching happens in-context. The old six paragraph-cards
// lost both ends of the audience (kids: too much text; parents: unclear).
const STEPS: Step[] = [
  { emoji: "👆", title: "Tap to fly", body: "tap · tap · tap" },
  { emoji: "🪶", title: "Float through the gaps", body: "don't touch the pillars" },
  { emoji: "✨", title: "You can't crash here", body: "this next run is just practice" },
];

export interface TutorialCallbacks {
  /** User finished or skipped — return to whatever called the tutorial. */
  onClose(): void;
  /** Final CTA: start a can't-die practice run. */
  onPractice(): void;
}

export function renderTutorial(host: HTMLElement, cbs: TutorialCallbacks): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-40 bg-black/60 backdrop-blur-sm font-display flex items-center justify-center px-4";
  // Paper-bulletin card carousel — matches the Hangar's folded-paper identity.
  wrap.innerHTML = `
    <div class="paper-note w-full max-w-xs p-6 flex flex-col items-center text-center">
      <div class="self-end -mt-2 -mr-2">
        <button data-skip class="text-[11px] underline opacity-55">skip</button>
      </div>
      <div data-emoji class="text-6xl mb-4"></div>
      <h3 data-title class="font-hand text-2xl font-bold mb-2"></h3>
      <p data-body class="text-sm leading-relaxed opacity-75 max-w-xs"></p>
      <div data-dots class="flex items-center justify-center gap-2 mt-5 mb-5"></div>
      <div class="w-full flex items-center gap-3">
        <button data-back class="btn px-5 py-3 text-sm font-bold bg-black/10 disabled:opacity-30">back</button>
        <button data-next class="btn flex-1 px-5 py-3 text-sm font-bold bg-ink text-paper"></button>
      </div>
    </div>
  `;
  host.appendChild(wrap);

  let idx = 0;
  const emojiEl = wrap.querySelector("[data-emoji]") as HTMLDivElement;
  const titleEl = wrap.querySelector("[data-title]") as HTMLHeadingElement;
  const bodyEl = wrap.querySelector("[data-body]") as HTMLParagraphElement;
  const dotsEl = wrap.querySelector("[data-dots]") as HTMLDivElement;
  const backBtn = wrap.querySelector("[data-back]") as HTMLButtonElement;
  const nextBtn = wrap.querySelector("[data-next]") as HTMLButtonElement;

  function paint(): void {
    const step = STEPS[idx];
    emojiEl.textContent = step.emoji;
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    backBtn.disabled = idx === 0;
    const last = idx === STEPS.length - 1;
    nextBtn.textContent = last ? "Let's fly →" : "next";
    dotsEl.innerHTML = STEPS.map(
      (_, i) =>
        `<span class="h-1.5 rounded-full transition-all ${
          i === idx ? "w-5 bg-ink" : "w-1.5 bg-black/20"
        }"></span>`,
    ).join("");
  }

  const finish = (practice: boolean): void => {
    markTutorialSeen();
    wrap.remove();
    if (practice) cbs.onPractice();
    else cbs.onClose();
  };

  wrap.querySelector("[data-skip]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    finish(false);
  });
  backBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (idx > 0) {
      idx--;
      paint();
    }
  });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (idx === STEPS.length - 1) {
      finish(true);
    } else {
      idx++;
      paint();
    }
  });

  paint();

  return () => {
    wrap.remove();
  };
}

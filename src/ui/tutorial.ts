/**
 * Onboarding tutorial — a short, skippable card carousel that teaches the
 * core loop, then drops the newcomer into a can't-die practice run so they
 * can try tapping with zero stakes.
 *
 * Shown automatically on the very first launch (gated by localStorage) and
 * replayable any time from the menu's "How to play" entry.
 */

const SEEN_KEY = "pflug.tutorialSeen.v1";

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

interface Step {
  emoji: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    emoji: "🪶",
    title: "tap to fly",
    body: "Each tap (or spacebar) gives your plane a little lift. Let go and gravity pulls it down. Find the rhythm — soft, steady taps fly best.",
  },
  {
    emoji: "🟩",
    title: "mind the gaps",
    body: "Pillars scroll in from the right. Steer through the gap between them. Touch a pillar — or the floor or ceiling — and the run ends.",
  },
  {
    emoji: "🎯",
    title: "score & streaks",
    body: "You score a point for every gap you clear. Come back each day to build a streak — streaks and high scores unlock new looks.",
  },
  {
    emoji: "🌐",
    title: "modes",
    body: "Casual is your endless playground. The Daily is one shared seed for everyone — climb the global board. Ranked pits you head-to-head; Challenge a friend's ghost run.",
  },
  {
    emoji: "🎨",
    title: "make it yours",
    body: "Unlock shapes, colors, worlds, pillar styles and flap effects by playing and hitting goals. Mix them freely in the Gallery.",
  },
  {
    emoji: "🚀",
    title: "ready?",
    body: "Let's try it with no stakes — a practice run where you can't lose. Tap to flap and get a feel for it. You've got this!",
  },
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
    "pointer-events-auto absolute inset-0 z-40 bg-black/85 backdrop-blur-sm font-display text-paper flex flex-col";
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <h2 class="text-xl font-bold">how to play</h2>
      <button data-skip class="text-sm underline opacity-70">skip</button>
    </div>
    <div class="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div data-emoji class="text-6xl mb-5"></div>
      <h3 data-title class="text-2xl font-bold mb-3"></h3>
      <p data-body class="text-sm leading-relaxed opacity-80 max-w-xs"></p>
    </div>
    <div data-dots class="flex items-center justify-center gap-2 mb-5"></div>
    <div class="px-6 pb-8 flex items-center gap-3">
      <button data-back class="rounded-2xl px-5 py-3 bg-white/10 text-sm font-bold disabled:opacity-30">back</button>
      <button data-next class="flex-1 rounded-2xl px-5 py-3 bg-paper text-ink text-sm font-bold"></button>
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
    nextBtn.textContent = last ? "try it (practice)" : "next";
    dotsEl.innerHTML = STEPS.map(
      (_, i) =>
        `<span class="h-1.5 rounded-full transition-all ${
          i === idx ? "w-5 bg-paper" : "w-1.5 bg-white/30"
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

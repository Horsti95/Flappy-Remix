/**
 * Onboarding variant B — a first-launch pointer tour of the menu.
 *
 * Instead of auto-starting a tutorial, brand-new players stay on the menu and
 * get a short guided tour: a spotlight dims everything but the highlighted
 * button while a paper-note callout explains it (Training → Gallery → Account →
 * Play). The last step's CTA starts the game. Skippable; shown once.
 *
 * Targets are resolved inside the host (the menu overlay) by selector, so the
 * tour positions itself against the live menu buttons.
 */

export interface TourStep {
  /** CSS selector for the menu element to spotlight (resolved within host). */
  selector: string;
  title: string;
  body: string;
  /** Label for the advance button (defaults to "next" / "got it" on last). */
  cta?: string;
}

export interface TourCallbacks {
  /** Tour finished or was skipped (always runs; marks onboarding seen). */
  onDone(): void;
  /** Final step's CTA was tapped (e.g. start playing). Runs before onDone. */
  onFinish?(): void;
}

export function renderOnboardingTour(
  host: HTMLElement,
  steps: TourStep[],
  cbs: TourCallbacks,
): () => void {
  const overlay = document.createElement("div");
  overlay.dataset.noFlap = "true";
  overlay.className = "pointer-events-auto absolute inset-0 z-50 font-display";
  overlay.innerHTML = `
    <div data-spot class="absolute rounded-2xl transition-all duration-200"
         style="box-shadow:0 0 0 9999px rgba(0,0,0,0.62); border:2px dashed rgba(244,234,213,0.9); pointer-events:none;"></div>
    <div data-callout class="paper-note absolute p-4 w-[min(78%,260px)] transition-all duration-200">
      <div class="flex items-center justify-between mb-1">
        <span class="paper-chip" data-step></span>
        <button data-skip class="text-[11px] underline opacity-55">skip</button>
      </div>
      <h3 data-title class="font-hand text-xl font-bold leading-tight"></h3>
      <p data-body class="text-[12px] opacity-75 mt-1 leading-snug"></p>
      <button data-next class="btn mt-3 w-full py-2.5 text-sm font-bold bg-ink text-paper"></button>
    </div>
  `;
  host.appendChild(overlay);

  const spot = overlay.querySelector("[data-spot]") as HTMLDivElement;
  const callout = overlay.querySelector("[data-callout]") as HTMLDivElement;
  const stepEl = overlay.querySelector("[data-step]") as HTMLSpanElement;
  const titleEl = overlay.querySelector("[data-title]") as HTMLHeadingElement;
  const bodyEl = overlay.querySelector("[data-body]") as HTMLParagraphElement;
  const nextBtn = overlay.querySelector("[data-next]") as HTMLButtonElement;

  let idx = 0;

  const done = (): void => {
    overlay.remove();
    cbs.onDone();
  };

  function paint(): void {
    // Skip steps whose target isn't present (defensive — menu may vary).
    while (idx < steps.length && !host.querySelector(steps[idx].selector)) idx++;
    if (idx >= steps.length) {
      done();
      return;
    }
    const step = steps[idx];
    const target = host.querySelector(step.selector) as HTMLElement;
    const hRect = host.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const x = tRect.left - hRect.left;
    const y = tRect.top - hRect.top;
    const w = tRect.width;
    const h = tRect.height;

    const pad = 6;
    spot.style.left = `${x - pad}px`;
    spot.style.top = `${y - pad}px`;
    spot.style.width = `${w + pad * 2}px`;
    spot.style.height = `${h + pad * 2}px`;

    const last = idx === steps.length - 1;
    stepEl.textContent = `${idx + 1} / ${steps.length}`;
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    nextBtn.textContent = step.cta ?? (last ? "let's play" : "next");

    // Place the callout below the target if it sits in the top 55% of the
    // menu, else above — so it never covers the thing it points at.
    const below = y + h < hRect.height * 0.55;
    callout.style.left = "50%";
    callout.style.transform = "translateX(-50%)";
    if (below) {
      callout.style.top = `${y + h + 14}px`;
      callout.style.bottom = "";
    } else {
      callout.style.bottom = `${hRect.height - y + 14}px`;
      callout.style.top = "";
    }
  }

  const advance = (): void => {
    const last = idx === steps.length - 1;
    if (last) {
      if (cbs.onFinish) cbs.onFinish();
      done();
      return;
    }
    idx++;
    paint();
  };

  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    advance();
  });
  overlay.querySelector("[data-skip]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    done();
  });
  // Reposition on resize/orientation change while the tour is open.
  const onResize = (): void => paint();
  window.addEventListener("resize", onResize);

  paint();

  return () => {
    window.removeEventListener("resize", onResize);
    overlay.remove();
  };
}

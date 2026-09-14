/** Keyboard access for the topmost visible screen. Close/resume is delegated
 * to the screen's existing handler; no game or backend state is changed here. */
export function installStudioNavigation(host: HTMLElement): () => void {
  const inertByUs = new Set<HTMLElement>();
  const syncPanels = (): void => {
    for (const el of inertByUs) el.inert = false;
    inertByUs.clear();
    const children = Array.from(host.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
    const root = children.at(-1);
    if (!root || root.classList.contains("studio-home")) return;
    const dialog = root.matches(".studio-panel,.studio-results,#pause-overlay")
      ? root : root.querySelector<HTMLElement>(".hangar-surface");
    if (!dialog) return;
    for (const el of children) if (el !== root && !el.inert) { el.inert = true; inertByUs.add(el); }
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", dialog.getAttribute("aria-label") || dialog.querySelector("h1,h2,h3")?.textContent?.trim() || (root.id === "pause-overlay" ? "Flight paused" : "Flight result"));
    dialog.querySelector<HTMLElement>("[data-close],[data-back],[data-resume],button")?.focus();
  };
  const observer = new MutationObserver(syncPanels);
  // Data loads inside a panel must not steal focus from its inputs.
  observer.observe(host, { childList: true });
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Tab" && event.key !== "Escape") return;
    const panels = Array.from(host.querySelectorAll<HTMLElement>(
      '.studio-panel, [data-settings-panel]:not(.hidden), #pause-overlay, .studio-results, .hangar-surface',
    )).filter(el => el.getClientRects().length > 0 && !el.closest("[inert]"));
    const panel = panels.at(-1);
    if (!panel) return;
    if (event.key === "Escape") {
      const close = panel.querySelector<HTMLButtonElement>("[data-settings-close], [data-close], [data-back], [data-resume]");
      if (close) { event.preventDefault(); event.stopPropagation(); close.click(); }
      return;
    }
    const targets = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'))
      .filter(el => el.getClientRects().length > 0 && !el.closest('[hidden],.hidden,[inert]'));
    if (!targets.length) return;
    const first = targets[0], last = targets.at(-1)!;
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  };
  document.addEventListener("keydown", onKey, true);
  return () => {
    observer.disconnect();
    for (const el of inertByUs) el.inert = false;
    document.removeEventListener("keydown", onKey, true);
  };
}

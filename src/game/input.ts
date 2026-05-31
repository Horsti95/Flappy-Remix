export interface InputCallbacks {
  onFlap(): void;
  onTogglePause(): void;
  onRestart(): void;
}

export class InputController {
  private el: HTMLElement;
  private cbs: InputCallbacks;
  private onPointer: (e: PointerEvent) => void;
  private onKey: (e: KeyboardEvent) => void;
  private onContextMenu: (e: Event) => void;

  constructor(el: HTMLElement, cbs: InputCallbacks) {
    this.el = el;
    this.cbs = cbs;
    this.onPointer = (e) => {
      if ((e.target as HTMLElement)?.closest("[data-no-flap]")) return;
      e.preventDefault();
      this.cbs.onFlap();
    };
    this.onKey = (e) => {
      if (e.repeat) return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable)) return;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        this.cbs.onFlap();
      } else if (e.code === "Escape" || e.code === "KeyP") {
        e.preventDefault();
        this.cbs.onTogglePause();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        this.cbs.onRestart();
      }
    };
    this.onContextMenu = (e) => e.preventDefault();
  }

  attach(): void {
    this.el.addEventListener("pointerdown", this.onPointer);
    this.el.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKey);
  }

  detach(): void {
    this.el.removeEventListener("pointerdown", this.onPointer);
    this.el.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("keydown", this.onKey);
  }
}

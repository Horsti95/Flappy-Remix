import { afterEach, describe, expect, it, vi } from "vitest";
import { InputController } from "../src/game/input";

afterEach(() => vi.unstubAllGlobals());

function harness(active: object | null = null) {
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { activeElement: active });
  const callbacks = { onFlap: vi.fn(), onTogglePause: vi.fn(), onRestart: vi.fn() };
  const input = new InputController(new EventTarget() as unknown as HTMLElement, callbacks);
  input.attach();
  const key = (code: string, prevented = false) => {
    const event = Object.assign(new Event("keydown", { cancelable: true }), { code, repeat: false });
    if (prevented) event.preventDefault();
    win.dispatchEvent(event);
    return event;
  };
  return { callbacks, input, key };
}

describe("keyboard ownership between menus and flight", () => {
  it("keeps the flight shortcuts when no control owns focus", () => {
    const { callbacks, input, key } = harness();
    expect(key("Space").defaultPrevented).toBe(true);
    key("Escape"); key("KeyR");
    expect(callbacks.onFlap).toHaveBeenCalledOnce();
    expect(callbacks.onTogglePause).toHaveBeenCalledOnce();
    expect(callbacks.onRestart).toHaveBeenCalledOnce();
    input.detach();
  });

  it("leaves focused controls their native keyboard activation", () => {
    const closest = vi.fn().mockReturnValue({});
    const { callbacks, input, key } = harness({ closest });
    expect(key("Space").defaultPrevented).toBe(false);
    expect(key("ArrowUp").defaultPrevented).toBe(false);
    expect(callbacks.onFlap).not.toHaveBeenCalled();
    expect(closest).toHaveBeenCalledWith(expect.stringContaining("button"));
    input.detach();
  });

  it("does not consume shortcuts from an editable field", () => {
    const { callbacks, input, key } = harness({ closest: () => null, isContentEditable: true });
    key("Space"); key("KeyR");
    expect(callbacks.onFlap).not.toHaveBeenCalled();
    expect(callbacks.onRestart).not.toHaveBeenCalled();
    input.detach();
  });

  it("does not resume or restart a dialog-handled key", () => {
    const { callbacks, input, key } = harness();
    key("Escape", true); key("KeyR", true);
    expect(callbacks.onTogglePause).not.toHaveBeenCalled();
    expect(callbacks.onRestart).not.toHaveBeenCalled();
    input.detach();
  });
});

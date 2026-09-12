import { describe, it, expect, beforeEach } from "vitest";
import {
  recordSubmitFailure,
  clearSubmitFailure,
  lastSubmitFailure,
  failureLabel,
} from "../src/social/submit-diagnostics";

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
});

describe("submit diagnostics", () => {
  it("nothing recorded yet reads as null", () => {
    expect(lastSubmitFailure()).toBeNull();
  });

  it("keeps the reason and the server's message", () => {
    recordSubmitFailure("http_500", "submit_run_tx returned no row");
    const f = lastSubmitFailure()!;
    expect(f.reason).toBe("http_500");
    expect(f.detail).toBe("submit_run_tx returned no row");
    expect(f.ts).toBeGreaterThan(0);
  });

  it("a later failure replaces an earlier one", () => {
    recordSubmitFailure("network", "fetch failed");
    recordSubmitFailure("http_401", "invalid token");
    expect(lastSubmitFailure()!.reason).toBe("http_401");
  });

  it("a successful submit clears it, so the pill stops accusing the server", () => {
    recordSubmitFailure("http_500", "boom");
    clearSubmitFailure();
    expect(lastSubmitFailure()).toBeNull();
  });

  it("trims a huge response body instead of filling storage", () => {
    recordSubmitFailure("http_502", "x".repeat(5000));
    expect(lastSubmitFailure()!.detail!.length).toBe(300);
  });

  it("survives corrupt storage rather than throwing on launch", () => {
    localStorage.setItem("pflug.submitFail.v1", "{not json");
    expect(lastSubmitFailure()).toBeNull();
    localStorage.setItem("pflug.submitFail.v1", JSON.stringify({ reason: 7 }));
    expect(lastSubmitFailure()).toBeNull();
  });

  it("labels an http status as the bare number, other reasons by name", () => {
    expect(failureLabel({ reason: "http_500", ts: 1 })).toBe("500");
    expect(failureLabel({ reason: "network", ts: 1 })).toBe("network");
    expect(failureLabel({ reason: "timeout", ts: 1 })).toBe("timeout");
  });
});

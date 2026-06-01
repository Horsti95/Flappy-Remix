import { describe, it, expect, beforeEach } from "vitest";
import { APP_VERSION, CHANGELOG, unseenChanges, isFirstRun, markChangelogSeen } from "../src/game/changelog";

// The test env is "node" (no DOM), so stub a minimal localStorage.
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

describe("changelog", () => {
  it("newest entry matches APP_VERSION", () => {
    expect(CHANGELOG[0].version).toBe(APP_VERSION);
  });

  it("first run shows nothing and is detectable", () => {
    expect(isFirstRun()).toBe(true);
    expect(unseenChanges()).toEqual([]);
  });

  it("after marking seen, no unseen changes remain", () => {
    markChangelogSeen();
    expect(isFirstRun()).toBe(false);
    expect(unseenChanges()).toEqual([]);
  });

  it("an older seen version surfaces newer entries", () => {
    localStorage.setItem("pflug.changelogSeen.v1", "0.1.0");
    const unseen = unseenChanges();
    expect(unseen.length).toBeGreaterThan(0);
    expect(unseen.every((e) => e.version > "0.1.0")).toBe(true);
  });

  it("a future seen version surfaces nothing", () => {
    localStorage.setItem("pflug.changelogSeen.v1", "99.0.0");
    expect(unseenChanges()).toEqual([]);
  });
});

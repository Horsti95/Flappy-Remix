import { describe, it, expect, beforeEach } from "vitest";
import { isForeignError } from "../src/ui/crash";

const ORIGIN = "https://flappy-remix.vercel.app";

beforeEach(() => {
  // crash.ts reads location.origin to tell our frames from someone else's.
  (globalThis as { location?: { origin: string } }).location = { origin: ORIGIN };
});

describe("crash handler: whose error is it", () => {
  it("ignores the exact report that wrongly blocked the game", () => {
    // Verbatim from a tester's crash report on 0.25.1 — a wallet extension's
    // own onboarding state, on a page that was working.
    expect(
      isForeignError({
        message: "Talisman extension has not been configured yet. Please continue with onboarding.",
        stack: [
          "Error: Talisman extension has not been configured yet. Please continue with onboarding.",
          "    at ne.handleResponse (chrome-extension://fijngjgcjhjmmpcmkeiomlglpeiijkld/page.js:1:4498)",
          "    at chrome-extension://fijngjgcjhjmmpcmkeiomlglpeiijkld/page.js:3:7026",
        ].join("\n"),
      }),
    ).toBe(true);
  });

  it("ignores firefox and safari extensions too", () => {
    for (const scheme of ["moz-extension://abc/x.js", "safari-web-extension://abc/x.js"]) {
      expect(isForeignError({ message: "boom", stack: `Error: boom\n    at ${scheme}:1:1` })).toBe(true);
    }
  });

  it("ignores an extension named as the error's source file", () => {
    expect(
      isForeignError({ message: "boom", source: "chrome-extension://abc/page.js:1" }),
    ).toBe(true);
  });

  it("REPORTS our own code", () => {
    expect(
      isForeignError({
        message: "cannot read property of undefined",
        stack: `TypeError: x\n    at flap (${ORIGIN}/assets/index-abc.js:5:10)`,
      }),
    ).toBe(false);
  });

  it("REPORTS a stack that runs through our code AND an extension", () => {
    // Our code calling into something an extension broke is still our problem.
    expect(
      isForeignError({
        message: "boom",
        stack: [
          "Error: boom",
          "    at chrome-extension://abc/page.js:1:1",
          `    at submitRun (${ORIGIN}/assets/index-abc.js:9:9)`,
        ].join("\n"),
      }),
    ).toBe(false);
  });

  it("REPORTS an error with no stack at all — it cannot be blamed on anyone else", () => {
    expect(isForeignError({ message: "something broke" })).toBe(false);
  });

  it("ignores an opaque cross-origin Script error", () => {
    expect(isForeignError({ message: "Script error." })).toBe(true);
    // ...but not one that came with a real stack from our own code.
    expect(
      isForeignError({ message: "Script error.", stack: `at x (${ORIGIN}/assets/i.js:1:1)` }),
    ).toBe(false);
  });
});

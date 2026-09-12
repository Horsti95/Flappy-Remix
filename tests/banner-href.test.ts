import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The banner slot is destined to carry third-party sponsor/ad URLs. main.ts
 * renders the href through escapeHtmlAttr(), which prevents breaking out of
 * the attribute — but an href is a URL context: `javascript:alert(1)` survives
 * HTML-escaping unchanged and executes on click. safeHref() is the gate.
 */
async function loadBanner(href: string | undefined) {
  vi.resetModules();
  // support.ts reads import.meta.env directly, so stub it before importing.
  vi.stubEnv("VITE_BANNER_HREF", href ?? "");
  const mod = await import("../src/game/support");
  return mod.BANNER;
}

describe("BANNER.href scheme validation", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("accepts https and http", async () => {
    expect((await loadBanner("https://example.com/promo")).href).toBe("https://example.com/promo");
    expect((await loadBanner("http://example.com/")).href).toBe("http://example.com/");
  });

  it("rejects javascript: (the XSS-on-click case)", async () => {
    expect((await loadBanner("javascript:alert(1)")).href).toBeUndefined();
    expect((await loadBanner("JaVaScRiPt:alert(1)")).href).toBeUndefined();
  });

  it("rejects data: and other non-web schemes", async () => {
    for (const bad of [
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      expect((await loadBanner(bad)).href).toBeUndefined();
    }
  });

  it("rejects a non-absolute or malformed value rather than guessing", async () => {
    for (const bad of ["/relative/path", "example.com", "not a url"]) {
      expect((await loadBanner(bad)).href).toBeUndefined();
    }
  });

  it("is undefined when unset, so the banner renders as plain text", async () => {
    expect((await loadBanner(undefined)).href).toBeUndefined();
  });
});

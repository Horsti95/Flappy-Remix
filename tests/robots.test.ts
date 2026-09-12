import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const robots = readFileSync(join(root, "public/robots.txt"), "utf8");

describe("robots.txt", () => {
  it("does not advertise a sitemap that nothing generates", () => {
    // The previous file ended with `Sitemap: /sitemap.xml`, which has never
    // existed — a dangling reference crawlers request and 404 on.
    const declared = /^Sitemap:\s*(\S+)/m.exec(robots);
    if (declared) {
      const path = declared[1].replace(/^https?:\/\/[^/]+/, "");
      expect(existsSync(join(root, "public", path))).toBe(true);
    } else {
      expect(declared).toBeNull();
    }
  });

  it("has a directive for the wildcard agent", () => {
    expect(robots).toMatch(/^User-agent:\s*\*/m);
    expect(robots).toMatch(/^(Allow|Disallow):/m);
  });

  it("keeps the beta out of search results", () => {
    // Flip this when going to public release — and update the test with it,
    // so the change is deliberate rather than drift.
    expect(robots).toMatch(/^Disallow:\s*\/\s*$/m);
  });
});

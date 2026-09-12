#!/usr/bin/env node
/**
 * Browser smoke test.
 *
 * The unit suite never opens a browser and scripts/test-migrations.sh never
 * leaves SQL, so nothing verified the one thing a beta tester notices first:
 * that the app BOOTS. A bundling mistake, a missing asset, a top-level throw —
 * all of it passes typecheck, tests and build, then shows a black screen.
 *
 * Also verifies the crash handler, because a crash screen that doesn't appear
 * is worse than none: you believe you have reporting and you don't.
 *
 *   npm run build && npm run preview &     # or let this script be pointed at any URL
 *   node scripts/smoke-browser.mjs [url]
 *
 * Needs playwright-core and a Chromium. In this environment:
 *   npm i -D --no-save playwright-core     (browsers are at /opt/pw-browsers)
 */
import { existsSync, readdirSync } from "node:fs";

const URL_ = process.argv[2] ?? "http://localhost:4173/";

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = "/opt/pw-browsers";
  if (existsSync(root)) {
    for (const d of readdirSync(root).filter((x) => x.startsWith("chromium-"))) {
      const p = `${root}/${d}/chrome-linux/chrome`;
      if (existsSync(p)) return p;
    }
  }
  return undefined; // let playwright use its own download
}

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.error("playwright-core is not installed — skipping browser smoke test.");
  console.error("  npm i -D --no-save playwright-core");
  process.exit(0); // absence of the tool is not a test failure
}

let fails = 0;
const check = (name, ok, extra = "") => {
  console.log(`    ${ok ? "ok  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fails++;
};

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // a phone, which is the target
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
});
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 200)));

console.log(`==> booting ${URL_}`);
await page.goto(URL_, { waitUntil: "networkidle", timeout: 30_000 });
await page.waitForTimeout(2000);

console.log("==> the app actually starts");
check("no crash screen on a clean boot", (await page.locator("#crash").count()) === 0);
check("the canvas exists", (await page.locator("#canvas").count()) === 1);
check(
  "the splash screen went away",
  (await page.locator("#splash").count()) === 0,
  "a stuck splash means boot threw",
);
check("no uncaught page errors during boot", pageErrors.length === 0, pageErrors[0] ?? "");

// The menu is the first thing a player sees; if it is empty, boot half-failed.
const overlayText = await page.locator("#overlays").innerText().catch(() => "");
check("the menu rendered something", overlayText.trim().length > 0);

console.log("==> the crash handler works");
await page.evaluate(() => {
  setTimeout(() => {
    throw new Error("smoke-test synthetic crash");
  }, 0);
});
await page.waitForTimeout(600);
check("an uncaught throw surfaces a crash screen", (await page.locator("#crash").count()) === 1);

const report = (await page.locator("#crash pre").textContent()) ?? "";
check("the report names the build", /^build\s+\S+/m.test(report), report.split("\n")[1] ?? "");
check("the report names the error", report.includes("smoke-test synthetic crash"));
check("the report names the viewport/display", /display\s+\w+/.test(report));

await page.evaluate(() => {
  for (let i = 0; i < 20; i++) setTimeout(() => { throw new Error(`flood ${i}`); }, 0);
});
await page.waitForTimeout(500);
check("repeated errors do not stack screens", (await page.locator("#crash").count()) === 1);

await page.locator("#crash button", { hasText: "Keep playing" }).click();
await page.waitForTimeout(300);
check("'keep playing' dismisses it", (await page.locator("#crash").count()) === 0);

await page.evaluate(() => { Promise.reject(new Error("smoke-test rejection")); });
await page.waitForTimeout(500);
const rej = (await page.locator("#crash pre").textContent()) ?? "";
check("an unhandled rejection is caught", rej.includes("unhandledrejection"));
await page.locator("#crash button", { hasText: "Keep playing" }).click();

// A missing asset must not be treated as a crash — the game plays fine
// without a background, and a false crash screen destroys trust in the real one.
await page.evaluate(() => {
  const i = document.createElement("img");
  i.src = "/definitely-missing-asset.png";
  document.body.appendChild(i);
});
await page.waitForTimeout(800);
check("a 404 asset is NOT reported as a crash", (await page.locator("#crash").count()) === 0);

await browser.close();

const unexpected = consoleErrors.filter(
  (e) => !/smoke-test|flood|definitely-missing|\[crash:/.test(e),
);
if (unexpected.length > 0) {
  console.log("==> unexpected console errors:");
  for (const e of unexpected.slice(0, 8)) console.log(`    ${e}`);
}

console.log();
if (fails === 0) {
  console.log("PASS — the app boots and crash reporting works");
} else {
  console.log(`FAIL — ${fails} problem(s)`);
  process.exit(1);
}

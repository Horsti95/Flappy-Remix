/* eslint-disable */
// Playwright spec — scaffolded, not yet executed in CI.
//
// To run locally once a browser runner is set up:
//   npm i -D @playwright/test
//   npx playwright install
//   npx playwright test tests/e2e
//
// This file is excluded from vitest by vitest.config.ts (only
// tests/**/*.test.ts is matched). When Playwright is added, point its
// testDir at tests/e2e in a playwright.config.ts.
//
// Flow being verified:
//   1. Player A boots the app, plays a run, dies
//   2. A creates a challenge from the death screen
//   3. The share-card preview renders without errors
//   4. The challenge URL produced by the share sheet is openable
//   5. Player B (a second incognito context) opens that URL
//   6. B sees the ghost overlay translating across the screen
//   7. B's death screen shows the vs-A comparison
//
// import { test, expect } from "@playwright/test";
//
// test("death -> challenge link -> friend plays same seed", async ({ browser }) => {
//   const aCtx = await browser.newContext();
//   const aPage = await aCtx.newPage();
//   await aPage.goto("/");
//   await aPage.getByRole("button", { name: "Play" }).click();
//   await aPage.waitForTimeout(2000); // bird falls
//   await aPage.getByRole("button", { name: /share/i }).click();
//   const link = await aPage.evaluate(() => navigator.clipboard.readText());
//   const shortId = new URL(link).searchParams.get("c");
//   expect(shortId).toBeTruthy();
//
//   const bCtx = await browser.newContext();
//   const bPage = await bCtx.newPage();
//   await bPage.goto(`/?c=${shortId}`);
//   await bPage.waitForSelector("canvas");
//   // ghost overlay paints at 0.45 alpha — best signal is that the
//   // 'vs @anon' panel appears at game over with both scores.
//   await bPage.waitForTimeout(3000);
//   await expect(bPage.getByText(/vs/i)).toBeVisible();
// });
export {};

"use strict";
// Optional browser check: requires Playwright and its Chromium browser.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const executablePath = process.env.SUPEREO_CHROMIUM || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1180 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(process.env.SUPEREO_DEMO_URL || "http://127.0.0.1:8847/demo/", { waitUntil: "networkidle" });
  assert.equal(await page.locator(".preset").count(), 9);
  assert.equal(await page.locator("#patterns button").count(), 4);
  assert.equal(await page.locator("#backend").textContent(), "Preview simulation");
  for (const button of await page.locator(".preset").all()) {
    await button.click();
    const result = JSON.parse(await page.locator("#result").textContent());
    assert.equal(result.accepted, true);
    assert.equal(result.backend, "preview-simulation");
    assert.equal(result.completion, "not-observable");
  }
  for (const button of await page.locator("#patterns button").all()) {
    await button.click();
    assert.equal(JSON.parse(await page.locator("#result").textContent()).accepted, true);
  }
  await page.locator("#stop").click();
  await page.locator("#overlap").selectOption("ignore");
  await page.getByRole("button", { name: "soft pulse", exact: true }).click();
  await page.getByRole("button", { name: "Light impact", exact: false }).click();
  assert.equal(JSON.parse(await page.locator("#result").textContent()).reason, "busy");
  await page.locator("#stop").click();
  assert.equal(JSON.parse(await page.locator("#result").textContent()).reason, "stopped");
  await page.locator("#enabled").uncheck();
  await page.locator(".preset").first().click();
  assert.equal(JSON.parse(await page.locator("#result").textContent()).reason, "disabled-or-zero-strength");
  await page.locator("#enabled").check();
  await page.locator("#strength").fill("0.35");
  assert.equal(await page.locator("#strength-value").textContent(), "35%");
  await page.locator("summary").click();
  await page.locator("#json").fill('{"version":1,"events":[]}');
  await page.locator("#play-json").click();
  assert.equal(JSON.parse(await page.locator("#result").textContent()).code, "INVALID_PATTERN");
  assert.deepEqual(errors, []);
  await page.locator("#overlap").selectOption("replace");
  await page.locator("#strength").fill("1");
  await page.getByRole("button", { name: "soft pulse", exact: true }).click();
  await page.locator("#stop").click();
  const resultsDir = path.resolve(__dirname, "../test-results");
  fs.mkdirSync(resultsDir, { recursive: true });
  await page.screenshot({ path: path.join(resultsDir, "demo-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile layout overflows viewport");
  await page.screenshot({ path: path.join(resultsDir, "demo-mobile.png"), fullPage: true });
  console.log("Browser demo PASS: 9 presets, 4 patterns, strength/enable, cancel, overlap, invalid JSON, responsive layout; simulation only.");
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });

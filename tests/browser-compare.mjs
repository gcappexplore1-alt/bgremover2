// Browser acceptance check. Start the built app on port 3100, then run:
//   node tests/browser-compare.mjs
// Uses the development-only portrait fixture; nothing is seeded in the live app.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const portrait = fileURLToPath(new URL("./fixtures/portrait.jpg", import.meta.url));
const base = process.env.TEST_URL || "http://localhost:3100";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const compareButtons = () => ({
  before: page.getByRole("button", { name: "Before", exact: true }),
  after: page.getByRole("button", { name: "After", exact: true }),
  compare: page.getByRole("button", { name: "Compare", exact: true }),
  slider: page.getByRole("button", { name: /Comparison slider/ }),
});

try {
  await page.goto(`${base}/editor`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('input[aria-label="Choose images to upload"]').setInputFiles(portrait);
  await page.locator('input[aria-label="Project name"]').waitFor({ timeout: 30000 });

  // 1. Comparison is disabled before any removal or edit.
  const btns = compareButtons();
  for (const [name, btn] of Object.entries(btns)) {
    assert.equal(await btn.isDisabled(), true, `${name} should start disabled`);
  }
  console.log("PASS: Before/After/Compare/Comparison-slider all start disabled.");

  // 2. An edit enables comparison (drop shadow on).
  await page.getByRole("button", { name: "Shadow", exact: true }).click();
  await page.getByRole("switch", { name: "Show drop shadow" }).click();
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('[role="toolbar"] button')].find((el) => el.textContent?.trim() === "Compare");
    return b && !b.disabled;
  });
  assert.equal(await btns.compare.isDisabled(), false, "Compare enables after an edit");
  assert.equal(await btns.before.isDisabled(), false, "Before enables after an edit");
  console.log("PASS: comparison enables after an edit.");

  // 3. Reload starts empty and nothing was persisted.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('input[aria-label="Choose images to upload"]').waitFor({ state: "attached", timeout: 30000 });
  assert.equal(await page.locator('input[aria-label="Project name"]').count(), 0, "no project restored after reload");
  const stored = await page.evaluate(async () => {
    const dbs = (await indexedDB.databases?.()) ?? [];
    let projects = -1;
    if (dbs.some((d) => d.name === "cutout-studio")) {
      projects = await new Promise((resolve) => {
        const req = indexedDB.open("cutout-studio");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("projects")) return resolve(-1);
          const tx = db.transaction("projects", "readonly");
          const all = tx.objectStore("projects").getAll();
          all.onsuccess = () => resolve(all.result.length);
          all.onerror = () => resolve(-1);
        };
        req.onerror = () => resolve(-1);
      });
    }
    return { dbs: dbs.map((d) => d.name), projects };
  });
  assert.ok(!stored.dbs.includes("cutout-studio") || stored.projects === 0, `no projects persisted, got ${JSON.stringify(stored)}`);
  console.log("PASS: reload starts empty with nothing persisted.");

  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log("PASS: No browser runtime errors.");
} finally {
  await browser.close();
}

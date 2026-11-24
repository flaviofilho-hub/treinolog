import fs from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = "http://127.0.0.1:5000";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUT = "C:/Users/flavi/AppData/Local/Temp/opencode/treinolog-shots";

await fs.mkdir(OUT, { recursive: true });

async function api(path, options = {}) {
  const response = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(
      `${options.method || "GET"} ${path} -> ${response.status}: ${await response.text()}`
    );
  }
  return response.status === 204 ? null : response.json();
}

const exercises = await api("/api/exercicios");
const supino = exercises.find((exercise) => exercise.nome === "Supino reto");

let browser;
let createdId = null;

try {
  browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  const expectedOffline = /ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError/;
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !expectedOffline.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");

  const homeOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );

  await page.click('.tabbar a[href="#/novo"]');
  await page.waitForSelector("#workout-form");
  await page.fill("#w-name", "Treino offline");
  const first = page.locator("[data-block]").first();
  await first.locator("[data-exercise]").selectOption({ label: "Supino reto" });
  await first.locator("[data-reps]").fill("8");
  await first.locator("[data-load]").fill("72.5");

  await context.setOffline(true);
  await page.click("#save-btn");
  await page.waitForSelector("#pending-section .badge-pending", {
    timeout: 15000,
  });
  const pendingBadge = await page.locator("#pending-indicator").innerText();
  const pendingTitle = await page
    .locator("#pending-section .workout-title")
    .first()
    .innerText();
  await page.screenshot({ path: `${OUT}/offline-historico.png`, fullPage: true });

  await context.setOffline(false);
  await page.waitForFunction(
    () => !document.querySelector("#pending-section .badge-pending"),
    { timeout: 15000 }
  );
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("#history-list .workout-title")].some((item) =>
        item.textContent.includes("Treino offline")
      ),
    { timeout: 15000 }
  );

  const pendingAfter = await page.locator("#pending-indicator").isHidden();
  const historyOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  const toolbarOverflow = await page.evaluate(() => {
    const toolbar = document.querySelector(".toolbar");
    return toolbar ? toolbar.scrollWidth > toolbar.clientWidth + 1 : null;
  });

  const listing = await api("/api/treinos?limit=50");
  const match = listing.items.find((item) => item.nome === "Treino offline");
  createdId = match?.id ?? null;

  await page.screenshot({ path: `${OUT}/offline-sincronizado.png`, fullPage: true });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/#/`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");
  await page.screenshot({ path: `${OUT}/desktop.png`, fullPage: true });
  const desktopOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );

  console.log(
    JSON.stringify(
      {
        pendingBadge,
        pendingTitle,
        pendingCleared: pendingAfter,
        syncedWorkoutId: createdId,
        totalAfterSync: listing.total,
        overflow: {
          home: homeOverflow,
          history: historyOverflow,
          toolbar: toolbarOverflow,
          desktop: desktopOverflow,
        },
        errors,
      },
      null,
      2
    )
  );

  if (errors.length) process.exitCode = 1;
  if (!createdId) process.exitCode = 1;
  if (!pendingAfter) process.exitCode = 1;
} finally {
  await browser?.close();
  if (createdId) {
    await fetch(`${BASE}/api/treinos/${createdId}`, { method: "DELETE" });
  }
  const leftovers = await api("/api/treinos?limit=100").catch(() => null);
  for (const item of leftovers?.items || []) {
    if (item.nome === "Treino offline") {
      await fetch(`${BASE}/api/treinos/${item.id}`, { method: "DELETE" });
    }
  }
}

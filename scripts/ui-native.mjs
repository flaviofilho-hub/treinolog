import fs from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = "http://127.0.0.1:5000";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUT = "C:/Users/flavi/AppData/Local/Temp/opencode/treinolog-shots";

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript(() => {
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
    };
  });

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("#settings-form");
  await page.screenshot({ path: `${OUT}/nativo-primeiro-uso.png`, fullPage: true });

  await page.fill("#api-base", BASE);
  await page.click("#test-connection");
  await page.waitForFunction(
    () => document.querySelector("#settings-status")?.textContent.includes("HTTPS"),
    { timeout: 15000 }
  );
  const status = await page.locator("#settings-status").innerText();

  await page.click('#settings-form button[type="submit"]');
  await page.waitForSelector(".hero", { timeout: 15000 });
  const stored = await page.evaluate(() => ({
    base: localStorage.getItem("treinolog.api_base"),
    key: localStorage.getItem("treinolog.api_key"),
  }));
  const modalGone = (await page.locator("#settings-form").count()) === 0;

  console.log(
    JSON.stringify({ status, stored, modalGone, errors }, null, 2)
  );

  if (errors.length || !modalGone || stored.base !== BASE) process.exitCode = 1;
} finally {
  await browser.close();
}

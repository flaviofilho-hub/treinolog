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
const byName = Object.fromEntries(
  exercises.map((exercise) => [exercise.nome, exercise.id])
);

const created = [];
const plan = [
  { date: "2026-10-27", supino: [65, 70, 70], puxada: 45 },
  { date: "2026-11-10", supino: [70, 75, 75], puxada: 50 },
  { date: "2026-11-17", supino: [75, 75, 80], puxada: 52.5 },
];

for (const [index, day] of plan.entries()) {
  const sets = [];
  day.supino.forEach((load, setIndex) => {
    sets.push({
      exercise_id: byName["Supino reto"],
      serie: setIndex + 1,
      reps: [10, 8, 8][setIndex],
      carga_kg: load,
    });
  });
  sets.push({
    exercise_id: byName["Puxada frente"],
    serie: 1,
    reps: 10,
    carga_kg: day.puxada,
  });

  const workout = await api("/api/treinos", {
    method: "POST",
    body: JSON.stringify({
      client_id: `ui-seed-000${index}`,
      data: day.date,
      nome: `Treino ${["A", "B", "C"][index]} — Superior`,
      duracao_min: 50,
      observacoes: index === 2 ? "Boa evolução de carga." : "",
      sets,
    }),
  });
  created.push(workout.id);
}

let browser;
let uiWorkoutId = null;

try {
  browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");
  await page.screenshot({ path: `${OUT}/home.png`, fullPage: true });

  await page.click('.tabbar a[href="#/novo"]');
  await page.waitForSelector("#workout-form");
  await page.fill("#w-name", "Treino UI");

  const first = page.locator("[data-block]").first();
  await first.locator("[data-exercise]").selectOption({ label: "Supino reto" });
  await first.locator("[data-reps]").fill("8");
  await first.locator("[data-load]").fill("80");

  await first.locator("[data-add-set]").click();
  await first.locator(".set-row").nth(1).locator("[data-reps]").fill("8");
  await first.locator(".set-row").nth(1).locator("[data-load]").fill("80");

  await first.locator("[data-add-set]").click();
  await first.locator(".set-row").nth(2).locator("[data-reps]").fill("6");
  await first.locator(".set-row").nth(2).locator("[data-load]").fill("85");

  await page.click("#add-block");
  const second = page.locator("[data-block]").nth(1);
  await second.locator("[data-exercise]").selectOption({ label: "Puxada frente" });
  await second.locator("[data-reps]").fill("10");
  await second.locator("[data-load]").fill("50");

  await page.screenshot({ path: `${OUT}/novo.png`, fullPage: true });
  await page.click("#save-btn");
  await page.waitForURL(/#\/treino\/\d+/, { timeout: 10000 });
  await page.waitForSelector(".set-table");

  const detailTitle = await page.locator("h1").first().innerText();
  await page.screenshot({ path: `${OUT}/detalhe.png`, fullPage: true });

  uiWorkoutId = Number(page.url().match(/#\/treino\/(\d+)/)[1]);

  await page.click('.tabbar a[href="#/progresso"]');
  await page.waitForSelector("#p-exercise");
  await page.selectOption("#p-exercise", { label: "Supino reto" });
  await page.waitForSelector("#progress-chart", { timeout: 10000 });
  await page.screenshot({ path: `${OUT}/progresso.png`, fullPage: true });
  const summary = await page.locator("#progress-summary").innerText();

  await page.click('.tabbar a[href="#/historico"]');
  await page.waitForSelector(".workout-item");
  await page.screenshot({ path: `${OUT}/historico.png`, fullPage: true });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );

  console.log(
    JSON.stringify(
      { detailTitle, summary, overflow, errors, uiWorkoutId, created },
      null,
      2
    )
  );

  if (errors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  for (const id of [...created, uiWorkoutId].filter(Boolean)) {
    await fetch(`${BASE}/api/treinos/${id}`, { method: "DELETE" });
  }
}

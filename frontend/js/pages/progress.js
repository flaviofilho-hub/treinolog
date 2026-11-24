import { api } from "../api.js";
import {
  emptyState,
  esc,
  fmtDate,
  fmtKg,
  fmtNumber,
  fmtShortDate,
  icons,
  isoDaysAgo,
  loadingList,
  renderError,
} from "../ui.js";

const METRICS = {
  carga_max: { label: "Carga máxima", type: "line" },
  volume: { label: "Volume", type: "bar" },
  e1rm: { label: "1RM estimado", type: "line" },
};

const PERIODS = [
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "12 meses" },
  { days: 0, label: "Tudo" },
];

let chart = null;

export async function renderProgress() {
  const app = document.getElementById("app");
  app.innerHTML = `${pageHead()}${loadingList(1)}`;

  let exercises;
  let stats = null;
  try {
    [exercises, stats] = await Promise.all([
      api.listExercises(),
      api.stats().catch(() => null),
    ]);
  } catch (error) {
    renderError(app, error.message, renderProgress);
    return;
  }

  if (!exercises.length) {
    app.innerHTML = `${pageHead()}${emptyState({
      icon: "chart",
      title: "Nenhum exercício ainda",
      text: "Cadastre exercícios e registre treinos para ver a evolução.",
      actionLabel: "Cadastrar exercício",
      actionHref: "#/exercicios",
    })}`;
    return;
  }

  let selectedId = Number(
    localStorage.getItem("treinolog.progress.exercise") || 0
  );
  if (!exercises.some((exercise) => exercise.id === selectedId)) {
    selectedId = stats?.recordes?.[0]?.exercise_id ?? exercises[0].id;
  }

  let period = Number(localStorage.getItem("treinolog.progress.period") ?? 90);
  if (!PERIODS.some((item) => item.days === period)) period = 90;

  let metric = localStorage.getItem("treinolog.progress.metric") || "carga_max";
  if (!METRICS[metric]) metric = "carga_max";

  let data = null;

  app.innerHTML = `${pageHead()}${shell(exercises, selectedId, period, metric)}`;

  const summaryEl = app.querySelector("#progress-summary");
  const chartEl = app.querySelector("#chart-wrap");
  const noteEl = app.querySelector("#progress-note");
  const exerciseSelect = app.querySelector("#p-exercise");

  function renderSummary() {
    if (!data) {
      summaryEl.innerHTML = "";
      return;
    }
    const summary = data.resumo;
    const variation = summary.variacao_pct;
    const variationClass =
      variation > 0 ? "delta-up" : variation < 0 ? "delta-down" : "delta-flat";
    const variationText =
      variation == null
        ? "—"
        : `${variation > 0 ? "+" : ""}${fmtNumber(variation, 1)}%`;

    summaryEl.innerHTML = `<div class="summary-grid">
        <div class="summary-item">
          <span class="stat-label">PR</span>
          <strong>${summary.pr_carga_kg != null ? fmtKg(summary.pr_carga_kg) : "—"}</strong>
          <div class="muted tiny">${summary.pr_data ? fmtDate(summary.pr_data) : ""}</div>
        </div>
        <div class="summary-item">
          <span class="stat-label">Última carga</span>
          <strong>${summary.ultima_carga_kg != null ? fmtKg(summary.ultima_carga_kg) : "—"}</strong>
          <div class="muted tiny">${
            data.labels.length ? fmtDate(data.labels[data.labels.length - 1]) : ""
          }</div>
        </div>
        <div class="summary-item">
          <span class="stat-label">Variação</span>
          <strong class="${variationClass}">${variationText}</strong>
          <div class="muted tiny">no período</div>
        </div>
        <div class="summary-item">
          <span class="stat-label">Sessões</span>
          <strong>${summary.sessoes}</strong>
          <div class="muted tiny">com este exercício</div>
        </div>
      </div>`;
  }

  function draw() {
    if (chart) {
      chart.destroy();
      chart = null;
    }

    const values = data?.datasets?.[metric] || [];
    if (!values.length) {
      chartEl.innerHTML = emptyState({
        icon: "chart",
        title: "Sem dados no período",
        text: "Registre este exercício ou amplie o período para ver a evolução.",
        actionLabel: "Registrar treino",
        actionHref: "#/novo",
      });
      return;
    }

    if (!window.Chart) {
      chartEl.innerHTML = `<div class="empty"><h3>Gráfico indisponível</h3><p>O Chart.js não foi carregado.</p></div>`;
      return;
    }

    const meta = METRICS[metric];
    const isBar = meta.type === "bar";
    chartEl.innerHTML = `<canvas id="progress-chart" role="img"
      aria-label="Evolução de ${esc(meta.label)}"></canvas>`;

    chart = new window.Chart(document.getElementById("progress-chart"), {
      type: meta.type,
      data: {
        labels: data.labels.map((iso) => fmtShortDate(iso)),
        datasets: [
          {
            label: meta.label,
            data: values,
            borderColor: isBar ? "#6ee7b7" : "#c9f45d",
            backgroundColor: isBar
              ? "rgba(110, 231, 183, 0.38)"
              : "rgba(201, 244, 93, 0.12)",
            borderWidth: 2,
            borderRadius: isBar ? 6 : 0,
            fill: !isBar,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: "#c9f45d",
            pointBorderColor: "#0a0d12",
            pointBorderWidth: 1,
            maxBarThickness: 28,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#171e28",
            borderColor: "#2f3a4b",
            borderWidth: 1,
            titleColor: "#edf2f7",
            bodyColor: "#93a0b4",
            padding: 10,
            displayColors: false,
            callbacks: {
              title: (items) => fmtDate(data.labels[items[0].dataIndex]),
              label: (item) => `${meta.label}: ${fmtKg(item.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: "#232c39" },
            ticks: {
              color: "#93a0b4",
              maxRotation: 0,
              autoSkipPadding: 14,
            },
          },
          y: {
            beginAtZero: isBar,
            grid: { color: "rgba(255, 255, 255, 0.055)" },
            border: { display: false },
            ticks: {
              color: "#93a0b4",
              callback: (value) => `${fmtNumber(value)} kg`,
            },
          },
        },
      },
    });
  }

  async function load() {
    summaryEl.innerHTML = '<div class="skeleton skeleton-card" style="height:112px"></div>';
    chartEl.innerHTML =
      '<div class="skeleton" style="height:100%;min-height:240px;border-radius:12px"></div>';
    noteEl.textContent = "";

    try {
      data = await api.progress(selectedId, {
        de: period ? isoDaysAgo(period) : undefined,
      });
      renderSummary();
      draw();
      noteEl.textContent =
        "O gráfico considera apenas treinos enviados ao servidor. Pendentes entram após a sincronização.";
    } catch (error) {
      data = null;
      summaryEl.innerHTML = "";
      renderError(chartEl, error.message, load);
    }
  }

  exerciseSelect.addEventListener("change", () => {
    selectedId = Number(exerciseSelect.value);
    localStorage.setItem("treinolog.progress.exercise", String(selectedId));
    load();
  });

  app.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => {
      period = Number(button.dataset.period);
      localStorage.setItem("treinolog.progress.period", String(period));
      app.querySelectorAll("[data-period]").forEach((item) => {
        item.classList.toggle(
          "active",
          Number(item.dataset.period) === period
        );
      });
      load();
    });
  });

  app.querySelectorAll("[data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      metric = button.dataset.metric;
      localStorage.setItem("treinolog.progress.metric", metric);
      app.querySelectorAll("[data-metric]").forEach((item) => {
        item.classList.toggle("active", item.dataset.metric === metric);
      });
      if (data) draw();
    });
  });

  await load();
}

function pageHead() {
  return `<div class="page-head">
      <div>
        <p class="eyebrow">Evolução</p>
        <h1>Progresso</h1>
      </div>
    </div>`;
}

function shell(exercises, selectedId, period, metric) {
  return `<div class="toolbar card">
      <label class="field">
        <span>Exercício</span>
        <select class="input" id="p-exercise">
          ${exercises
            .map(
              (exercise) =>
                `<option value="${exercise.id}" ${
                  exercise.id === selectedId ? "selected" : ""
                }>${esc(exercise.nome)}</option>`
            )
            .join("")}
        </select>
      </label>
      <div class="chips">
        ${PERIODS.map(
          (item) =>
            `<button type="button" class="chip ${
              item.days === period ? "active" : ""
            }" data-period="${item.days}">${item.label}</button>`
        ).join("")}
      </div>
      <div class="chips">
        ${Object.entries(METRICS)
          .map(
            ([key, item]) =>
              `<button type="button" class="chip ${
                key === metric ? "active" : ""
              }" data-metric="${key}">${item.label}</button>`
          )
          .join("")}
      </div>
    </div>

    <div id="progress-summary"></div>

    <div class="card chart-card">
      <div class="chart-wrap" id="chart-wrap"></div>
    </div>
    <p class="muted tiny" id="progress-note" style="margin-top:10px"></p>`;
}

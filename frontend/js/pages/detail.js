import { api, NetworkError } from "../api.js";
import { getPending, removePending } from "../pending.js";
import {
  confirmDialog,
  emptyState,
  esc,
  fmtDate,
  fmtKg,
  fmtVolume,
  icons,
  renderError,
  toast,
} from "../ui.js";
import { summaryOf } from "../workouts.js";

export async function renderDetail({ params }) {
  const app = document.getElementById("app");
  const id = params.id;

  if (!/^\d+$/.test(id)) {
    const item = getPending().find((entry) => entry.client_id === id);
    if (!item) {
      app.innerHTML = emptyState({
        icon: "wifiOff",
        title: "Treino não encontrado",
        text: "Ele pode já ter sido enviado ou removido do aparelho.",
        actionLabel: "Ver histórico",
        actionHref: "#/historico",
      });
      return;
    }
    renderPendingDetail(app, item);
    return;
  }

  app.innerHTML = '<div class="skeleton skeleton-card" style="height:180px"></div>';

  try {
    const workout = await api.getWorkout(Number(id));
    renderWorkout(app, workout);
  } catch (error) {
    renderError(app, error.message, () => renderDetail({ params }));
  }
}

function backLink() {
  return `<div class="page-head" style="margin-bottom:8px">
      <a class="btn btn-ghost btn-sm" href="#/historico">${icons.arrowLeft} Histórico</a>
    </div>`;
}

function metaRow(summary, workout) {
  const tipo = workout.tipo || "forca";

  if (tipo === "cardio") {
    return `<div class="meta-row">
        ${
          workout.duracao_min != null
            ? `<span class="meta-pill">${icons.clock} <strong>${workout.duracao_min} min</strong></span>`
            : ""
        }
        <span class="meta-pill"><span class="badge badge-cardio">cardio</span></span>
      </div>`;
  }

  return `<div class="meta-row">
      ${
        workout.duracao_min != null
          ? `<span class="meta-pill">${icons.clock} <strong>${workout.duracao_min} min</strong></span>`
          : ""
      }
      <span class="meta-pill">${icons.layers} <strong>${summary.series}</strong> séries</span>
      <span class="meta-pill">${icons.weight} <strong>${fmtVolume(summary.volume_kg)}</strong></span>
      <span class="meta-pill">${icons.chart} máx. <strong>${fmtKg(summary.carga_max_kg)}</strong></span>
    </div>`;
}

function cardioSection(workout) {
  return `<section class="card exercise-section">
      <div class="exercise-section-head">
        <h3>${esc(workout.nome)}</h3>
        <span class="badge badge-cardio">cardio</span>
      </div>
      <p class="muted" style="margin-top:10px">
        <strong style="font-size:1.35rem;color:var(--text)">${workout.duracao_min || 0} min</strong>
        de atividade aeróbica.
      </p>
    </section>`;
}

function exerciseSection(group) {
  return `<section class="card exercise-section">
      <div class="exercise-section-head">
        <h3>${esc(group.exercicio.nome)}</h3>
        ${
          group.exercicio.grupo_muscular
            ? `<span class="badge badge-group">${esc(group.exercicio.grupo_muscular)}</span>`
            : ""
        }
      </div>
      <div class="set-table">
        <div class="set-table-head">
          <span>Série</span><span>Reps</span><span>Carga</span>
        </div>
        ${group.series
          .map(
            (set) => `<div class="set-table-row">
              <span class="set-num">#${set.serie}</span>
              <span>${set.reps}</span>
              <span>${fmtKg(set.carga_kg)}</span>
            </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderWorkout(app, workout) {
  const summary = summaryOf(workout);

  app.innerHTML = `${backLink()}
    <div class="detail-head">
      <p class="eyebrow">${fmtDate(workout.data)}</p>
      <div class="detail-title"><h1>${esc(workout.nome)}</h1></div>
      ${metaRow(summary, workout)}
    </div>

    <div class="stack">
      ${
        (workout.tipo || "forca") === "cardio"
          ? cardioSection(workout)
          : (workout.exercicios || []).map(exerciseSection).join("")
      }
    </div>

    ${
      workout.observacoes
        ? `<div class="section-head"><h2>Observações</h2></div>
           <div class="notes">${esc(workout.observacoes)}</div>`
        : ""
    }

    <div style="margin-top:26px">
      <button type="button" class="btn btn-danger btn-block" id="delete-workout">
        ${icons.trash} Excluir treino
      </button>
    </div>`;

  app.querySelector("#delete-workout").addEventListener("click", async () => {
    const confirmed = await confirmDialog({
      title: "Excluir treino?",
      message: `"${workout.nome}" e todas as séries serão removidos. Essa ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.deleteWorkout(workout.id);
      toast("Treino excluído.");
      location.hash = "#/historico";
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

function renderPendingDetail(app, item) {
  const labels = item._labels || {};
  const groups = new Map();

  for (const set of item.sets || []) {
    const key = String(set.exercise_id);
    if (!groups.has(key)) {
      groups.set(key, {
        nome: labels[key] || `Exercício #${set.exercise_id}`,
        series: [],
      });
    }
    groups.get(key).series.push(set);
  }

  const summary = summaryOf(item);

  app.innerHTML = `${backLink()}
    <div class="detail-head">
      <p class="eyebrow">${fmtDate(item.data)} · salvo no aparelho</p>
      <div class="detail-title">
        <h1>${esc(item.nome)}</h1>
        <span class="badge badge-pending">pendente</span>
      </div>
      ${metaRow(summary, item)}
    </div>

    ${
      item._error
        ? `<div class="form-error" style="margin-bottom:16px">${esc(item._error)}</div>`
        : ""
    }

    <div class="stack">
      ${item.tipo === "cardio" ? cardioSection(item) : ""}
      ${[...groups.values()]
        .map(
          (group) => `<section class="card exercise-section">
            <div class="exercise-section-head"><h3>${esc(group.nome)}</h3></div>
            <div class="set-table">
              <div class="set-table-head">
                <span>Série</span><span>Reps</span><span>Carga</span>
              </div>
              ${group.series
                .map(
                  (set) => `<div class="set-table-row">
                    <span class="set-num">#${set.serie}</span>
                    <span>${set.reps}</span>
                    <span>${fmtKg(set.carga_kg)}</span>
                  </div>`
                )
                .join("")}
            </div>
          </section>`
        )
        .join("")}
    </div>

    ${
      item.observacoes
        ? `<div class="section-head"><h2>Observações</h2></div>
           <div class="notes">${esc(item.observacoes)}</div>`
        : ""
    }

    <div class="stack-sm" style="margin-top:24px">
      <button type="button" class="btn btn-primary btn-block" id="send-pending">
        ${icons.send} Enviar agora
      </button>
      <button type="button" class="btn btn-ghost btn-block" id="discard-pending">
        Descartar
      </button>
    </div>`;

  app.querySelector("#send-pending").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Enviando…";

    const payload = {};
    Object.entries(item).forEach(([key, value]) => {
      if (!key.startsWith("_")) payload[key] = value;
    });

    try {
      const created = await api.createWorkout(payload);
      removePending(item.client_id);
      toast("Treino enviado!");
      location.hash = `#/treino/${created.id}`;
    } catch (error) {
      button.disabled = false;
      button.innerHTML = `${icons.send} Enviar agora`;
      if (error instanceof NetworkError) {
        toast("Ainda sem conexão. Tente novamente.", "warning");
      } else {
        toast(error.message, "error");
      }
    }
  });

  app.querySelector("#discard-pending").addEventListener("click", async () => {
    const confirmed = await confirmDialog({
      title: "Descartar treino?",
      message: "O treino salvo neste aparelho será apagado e não será enviado.",
      confirmLabel: "Descartar",
      danger: true,
    });
    if (!confirmed) return;
    removePending(item.client_id);
    toast("Treino descartado.");
    location.hash = "#/historico";
  });
}

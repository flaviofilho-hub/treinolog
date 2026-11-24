import { api } from "../api.js";
import { getPending, syncPending } from "../pending.js";
import {
  esc,
  icons,
  loadingList,
  renderError,
  toast,
} from "../ui.js";
import { workoutCard } from "../workouts.js";

export async function renderHistory() {
  const app = document.getElementById("app");
  app.innerHTML = `${pageHead()}${loadingList(3)}`;

  let exercises = [];
  try {
    exercises = await api.listExercises();
  } catch {
    // O filtro é opcional; o histórico ainda pode ser carregado.
  }

  const state = {
    exerciseId: "",
    de: "",
    ate: "",
    items: [],
    total: 0,
    loading: false,
  };

  app.innerHTML = `${pageHead()}${shell(exercises)}`;

  const listEl = app.querySelector("#history-list");
  const pendingEl = app.querySelector("#pending-section");
  const countEl = app.querySelector("#history-count");
  const moreWrap = app.querySelector("#load-more-wrap");
  const filterExercise = app.querySelector("#f-exercise");
  const filterDe = app.querySelector("#f-de");
  const filterAte = app.querySelector("#f-ate");

  function matchesPending(item) {
    if (
      state.exerciseId &&
      !(item.sets || []).some(
        (set) => String(set.exercise_id) === state.exerciseId
      )
    ) {
      return false;
    }
    if (state.de && item.data < state.de) return false;
    if (state.ate && item.data > state.ate) return false;
    return true;
  }

  function renderPending() {
    const pending = getPending().filter(matchesPending);
    if (!pending.length) {
      pendingEl.innerHTML = "";
      return;
    }

    pendingEl.innerHTML = `<div class="section-head">
        <h2>No aparelho</h2>
        <span class="badge badge-pending">${pending.length}</span>
      </div>
      <div class="list">${pending.map(workoutCard).join("")}</div>
      <button type="button" class="btn btn-ghost btn-block" data-sync
        style="margin-top:10px">${icons.send} Enviar pendentes</button>`;

    pendingEl.querySelector("[data-sync]").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Enviando…";
      const result = await syncPending();

      if (result.synced) {
        toast(`${result.synced} treino(s) enviado(s).`);
        await load(true);
      } else if (result.failed) {
        toast("Alguns treinos precisam de atenção.", "error");
      } else {
        toast("Nada foi enviado. Verifique a conexão.", "warning");
        button.disabled = false;
        button.textContent = "Enviar pendentes";
      }
    });
  }

  function renderList() {
    if (!state.items.length) {
      listEl.innerHTML = `<div class="empty">
          <div class="empty-icon">${icons.dumbbell}</div>
          <h3>Nenhum treino encontrado</h3>
          <p>${
            state.exerciseId || state.de || state.ate
              ? "Ajuste os filtros ou registre um novo treino."
              : "Registre seu primeiro treino para começar o histórico."
          }</p>
          <a class="btn btn-primary" href="#/novo">${icons.plus} Registrar treino</a>
        </div>`;
      countEl.textContent = "";
      moreWrap.innerHTML = "";
      return;
    }

    countEl.textContent = `${state.items.length} de ${state.total}`;
    listEl.innerHTML = state.items.map(workoutCard).join("");
    moreWrap.innerHTML =
      state.items.length < state.total
        ? '<button type="button" class="btn btn-ghost btn-block" data-more>Carregar mais</button>'
        : "";
    moreWrap.querySelector("[data-more]")?.addEventListener("click", () => load(false));
  }

  async function load(reset) {
    if (state.loading) return;
    state.loading = true;

    if (reset) {
      state.items = [];
      listEl.innerHTML = loadingList(2);
      moreWrap.innerHTML = "";
    } else {
      const button = moreWrap.querySelector("[data-more]");
      if (button) {
        button.disabled = true;
        button.textContent = "Carregando…";
      }
    }

    renderPending();

    try {
      const data = await api.listWorkouts({
        limit: 30,
        offset: reset ? 0 : state.items.length,
        exercicio_id: state.exerciseId,
        de: state.de,
        ate: state.ate,
      });
      state.items = reset ? data.items : [...state.items, ...data.items];
      state.total = data.total;
      renderList();
    } catch (error) {
      if (reset) {
        listEl.innerHTML = "";
        renderError(listEl, error.message, () => load(true));
      } else {
        toast(error.message, "error");
      }
      moreWrap.innerHTML = "";
    } finally {
      state.loading = false;
    }
  }

  filterExercise.addEventListener("change", () => {
    state.exerciseId = filterExercise.value;
    load(true);
  });
  filterDe.addEventListener("change", () => {
    state.de = filterDe.value;
    load(true);
  });
  filterAte.addEventListener("change", () => {
    state.ate = filterAte.value;
    load(true);
  });
  app.querySelector("#clear-filters").addEventListener("click", () => {
    state.exerciseId = "";
    state.de = "";
    state.ate = "";
    filterExercise.value = "";
    filterDe.value = "";
    filterAte.value = "";
    load(true);
  });

  await load(true);
}

function pageHead() {
  return `<div class="page-head">
      <div>
        <p class="eyebrow">Histórico</p>
        <h1>Seus treinos</h1>
      </div>
      <a class="btn btn-primary btn-sm" href="#/novo">${icons.plus} Novo</a>
    </div>`;
}

function shell(exercises) {
  return `<div class="toolbar card">
      <div class="filters">
        <label class="field">
          <span>Exercício</span>
          <select class="input" id="f-exercise">
            <option value="">Todos os exercícios</option>
            ${exercises
              .map(
                (exercise) =>
                  `<option value="${exercise.id}">${esc(exercise.nome)}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>De</span>
          <input class="input" type="date" id="f-de" />
        </label>
        <label class="field">
          <span>Até</span>
          <input class="input" type="date" id="f-ate" />
        </label>
      </div>
      <div class="chips">
        <button type="button" class="chip" id="clear-filters">Limpar filtros</button>
      </div>
    </div>
    <div id="pending-section"></div>
    <div class="section-head">
      <h2>Treinos</h2>
      <span class="muted tiny" id="history-count"></span>
    </div>
    <div id="history-list"></div>
    <div id="load-more-wrap" style="margin-top:12px"></div>`;
}

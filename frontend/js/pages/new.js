import { api, ApiError, NetworkError } from "../api.js";
import { addPending } from "../pending.js";
import {
  esc,
  fmtVolume,
  icons,
  loadingList,
  renderError,
  toast,
  todayISO,
} from "../ui.js";

let exercises = [];

export async function renderNew() {
  const app = document.getElementById("app");
  app.innerHTML = `${pageHead()}${loadingList(2)}`;

  try {
    exercises = await api.listExercises();
  } catch (error) {
    renderError(app, error.message, renderNew);
    return;
  }

  if (!exercises.length) {
    app.innerHTML = `${pageHead()}
      <div class="empty">
        <div class="empty-icon">${icons.dumbbell}</div>
        <h3>Cadastre um exercício primeiro</h3>
        <p>O treino precisa de pelo menos um exercício no catálogo.</p>
        <a class="btn btn-primary" href="#/exercicios">Cadastrar exercício</a>
      </div>`;
    return;
  }

  app.innerHTML = `${pageHead()}${formView()}`;
  setupForm();
}

function pageHead() {
  return `<div class="page-head">
      <div>
        <p class="eyebrow">Registro</p>
        <h1>Novo treino</h1>
      </div>
      <a class="btn btn-ghost btn-sm" href="#/historico">Cancelar</a>
    </div>`;
}

function formView() {
  return `<form id="workout-form" class="stack" novalidate>
      <div class="card stack-sm">
        <label class="field">
          <span>Nome do treino</span>
          <input id="w-name" class="input" maxlength="80" list="workout-names"
            placeholder="Treino A — Superior" autocomplete="off" required />
          <datalist id="workout-names">
            <option value="Treino A — Superior"></option>
            <option value="Treino B — Inferior"></option>
            <option value="Treino C — Full body"></option>
          </datalist>
        </label>
        <div class="grid-2">
          <label class="field">
            <span>Data</span>
            <input id="w-date" class="input" type="date" value="${todayISO()}" required />
          </label>
          <label class="field">
            <span>Duração (min)</span>
            <input id="w-duration" class="input" type="number" min="0" max="1440"
              inputmode="numeric" placeholder="60" />
          </label>
        </div>
        <label class="field">
          <span>Observações</span>
          <textarea id="w-notes" class="input" rows="2" maxlength="2000"
            placeholder="Como foi o treino?"></textarea>
        </label>
      </div>

      <div id="blocks" class="stack"></div>

      <button type="button" id="add-block" class="btn btn-ghost btn-block">
        ${icons.plus} Adicionar exercício
      </button>

      <div class="submit-bar card">
        <div class="submit-total">
          <span class="muted small">Volume estimado</span>
          <strong id="volume-preview">0 kg</strong>
        </div>
        <button type="submit" class="btn btn-primary" id="save-btn">Salvar treino</button>
      </div>

      <p class="form-error" id="form-error" hidden></p>
    </form>`;
}

function setupForm() {
  const form = document.getElementById("workout-form");
  const blocksEl = document.getElementById("blocks");
  const errorEl = document.getElementById("form-error");
  const saveBtn = document.getElementById("save-btn");
  const volumePreview = document.getElementById("volume-preview");
  const nameInput = document.getElementById("w-name");
  const dateInput = document.getElementById("w-date");

  function addBlock(scroll = true) {
    const used = new Set(
      [...blocksEl.querySelectorAll("[data-exercise]")].map((select) =>
        Number(select.value)
      )
    );
    const next = exercises.find((exercise) => !used.has(exercise.id)) || exercises[0];
    const block = createBlock(next.id);
    blocksEl.appendChild(block);
    addSetRow(block);
    updateTotals();
    if (scroll) {
      block.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function fail(message, element) {
    errorEl.hidden = false;
    errorEl.textContent = message;
    errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus({ preventScroll: true });
    return false;
  }

  function updateTotals() {
    let total = 0;
    blocksEl.querySelectorAll("[data-block]").forEach((block) => {
      let blockTotal = 0;
      block.querySelectorAll(".set-row").forEach((row) => {
        const reps = Number(row.querySelector("[data-reps]").value) || 0;
        const load = Number(row.querySelector("[data-load]").value) || 0;
        blockTotal += reps * load;
      });
      const label = block.querySelector("[data-block-volume]");
      if (label) label.textContent = fmtVolume(blockTotal);
      total += blockTotal;
    });
    volumePreview.textContent = fmtVolume(total);
  }

  document
    .getElementById("add-block")
    .addEventListener("click", () => addBlock(true));

  form.addEventListener("click", (event) => {
    const addSet = event.target.closest("[data-add-set]");
    if (addSet) {
      addSetRow(addSet.closest("[data-block]"));
      updateTotals();
      return;
    }

    const removeSet = event.target.closest("[data-remove-set]");
    if (removeSet) {
      const block = removeSet.closest("[data-block]");
      const rows = block.querySelectorAll(".set-row");
      if (rows.length > 1) {
        removeSet.closest(".set-row").remove();
        renumber(block);
        updateTotals();
      }
      return;
    }

    const removeBlock = event.target.closest("[data-remove-block]");
    if (removeBlock) {
      removeBlock.closest("[data-block]").remove();
      updateTotals();
    }
  });

  form.addEventListener("input", () => {
    errorEl.hidden = true;
    updateTotals();
  });

  form.addEventListener("focusin", (event) => {
    if (event.target.matches('input[type="number"]')) {
      event.target.select();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;

    const name = nameInput.value.trim();
    const date = dateInput.value;
    const durationValue = document.getElementById("w-duration").value;
    const notes = document.getElementById("w-notes").value.trim();
    const blocks = [...blocksEl.querySelectorAll("[data-block]")];

    if (!name) {
      return fail(
        "Dê um nome ao treino (ex.: Treino A — Superior).",
        nameInput
      );
    }
    if (!date) {
      return fail("Informe a data do treino.", dateInput);
    }
    if (!blocks.length) {
      return fail("Adicione pelo menos um exercício.");
    }

    let duration = null;
    if (durationValue !== "") {
      duration = Number(durationValue);
      if (!Number.isInteger(duration) || duration < 0 || duration > 1440) {
        return fail(
          "A duração deve estar entre 0 e 1440 minutos.",
          document.getElementById("w-duration")
        );
      }
    }

    const sets = [];
    const seenExercises = new Set();

    for (const block of blocks) {
      const select = block.querySelector("[data-exercise]");
      const exerciseId = Number(select.value);
      const exerciseName =
        exercises.find((exercise) => exercise.id === exerciseId)?.nome ||
        "exercício";

      if (seenExercises.has(exerciseId)) {
        return fail(
          `"${exerciseName}" aparece mais de uma vez. Junte as séries em um único bloco.`,
          select
        );
      }
      seenExercises.add(exerciseId);

      const rows = [...block.querySelectorAll(".set-row")];
      if (!rows.length) {
        return fail(`Adicione pelo menos uma série em "${exerciseName}".`, select);
      }

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const repsInput = row.querySelector("[data-reps]");
        const loadInput = row.querySelector("[data-load]");
        const reps = Number(repsInput.value);
        const load = loadInput.value === "" ? 0 : Number(loadInput.value);

        if (!Number.isInteger(reps) || reps < 1 || reps > 1000) {
          return fail(
            `Série ${index + 1} de "${exerciseName}": reps deve ser entre 1 e 1000.`,
            repsInput
          );
        }
        if (!Number.isFinite(load) || load < 0 || load > 2000) {
          return fail(
            `Série ${index + 1} de "${exerciseName}": carga deve ser entre 0 e 2000 kg.`,
            loadInput
          );
        }

        sets.push({
          exercise_id: exerciseId,
          serie: index + 1,
          reps,
          carga_kg: load,
        });
      }
    }

    const payload = {
      client_id: uuid(),
      data: date,
      nome: name,
      duracao_min: duration,
      observacoes: notes,
      sets,
    };
    const labels = Object.fromEntries(
      exercises.map((exercise) => [exercise.id, exercise.nome])
    );

    saveBtn.disabled = true;
    saveBtn.textContent = "Salvando…";

    try {
      const created = await api.createWorkout(payload);
      toast("Treino salvo!");
      location.hash = `#/treino/${created.id}`;
    } catch (error) {
      if (error instanceof NetworkError) {
        addPending({ ...payload, _labels: labels });
        toast("Sem conexão. Treino salvo no aparelho.", "warning", 4500);
        location.hash = "#/historico";
        return;
      }

      saveBtn.disabled = false;
      saveBtn.textContent = "Salvar treino";
      fail(
        error instanceof ApiError
          ? error.message
          : "Não foi possível salvar o treino."
      );
    }
  });

  addBlock(false);
}

function createBlock(selectedId) {
  const block = document.createElement("div");
  block.className = "exercise-block card";
  block.dataset.block = "";
  block.innerHTML = `<div class="block-head">
      <select class="input" data-exercise aria-label="Exercício">
        ${optionsFor(selectedId)}
      </select>
      <button type="button" class="icon-btn danger" data-remove-block
        aria-label="Remover exercício">${icons.trash}</button>
    </div>
    <div class="set-head">
      <span>Série</span><span>Reps</span><span>Carga (kg)</span><span></span>
    </div>
    <div class="sets" data-sets></div>
    <div class="block-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-add-set>
        ${icons.plus} Série
      </button>
      <span class="muted tiny" data-block-volume>0 kg</span>
    </div>`;
  return block;
}

function optionsFor(selectedId) {
  const groups = new Map();
  for (const exercise of exercises) {
    const group = exercise.grupo_muscular || "Outros";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(exercise);
  }

  return [...groups.entries()]
    .map(
      ([group, list]) =>
        `<optgroup label="${esc(group)}">${list
          .map(
            (exercise) =>
              `<option value="${exercise.id}" ${
                exercise.id === selectedId ? "selected" : ""
              }>${esc(exercise.nome)}</option>`
          )
          .join("")}</optgroup>`
    )
    .join("");
}

function addSetRow(block) {
  const setsEl = block.querySelector("[data-sets]");
  const rows = setsEl.querySelectorAll(".set-row");
  const last = rows[rows.length - 1];
  const reps = last ? last.querySelector("[data-reps]").value : "10";
  const load = last ? last.querySelector("[data-load]").value : "0";

  const row = document.createElement("div");
  row.className = "set-row";
  row.innerHTML = `<span class="set-index"></span>
    <input class="input" type="number" inputmode="numeric" min="1" max="1000"
      step="1" value="${esc(reps)}" data-reps aria-label="Repetições" />
    <input class="input" type="number" inputmode="decimal" min="0" max="2000"
      step="0.5" value="${esc(load)}" data-load aria-label="Carga em kg" />
    <button type="button" class="icon-btn subtle" data-remove-set
      aria-label="Remover série">${icons.x}</button>`;
  setsEl.appendChild(row);
  renumber(block);
}

function renumber(block) {
  const rows = [...block.querySelectorAll(".set-row")];
  rows.forEach((row, index) => {
    row.querySelector(".set-index").textContent = index + 1;
    const remove = row.querySelector("[data-remove-set]");
    remove.disabled = rows.length === 1;
    remove.style.opacity = rows.length === 1 ? "0.3" : "";
  });
}

function uuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

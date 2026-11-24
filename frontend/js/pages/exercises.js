import { api } from "../api.js";
import {
  emptyState,
  esc,
  icons,
  loadingList,
  renderError,
  toast,
} from "../ui.js";

export async function renderExercises() {
  const app = document.getElementById("app");
  app.innerHTML = `${pageHead()}${loadingList(2)}`;

  let exercises = [];
  try {
    exercises = await api.listExercises();
  } catch (error) {
    renderError(app, error.message, renderExercises);
    return;
  }

  app.innerHTML = `${pageHead()}${formView(exercises)}<div id="exercise-list"></div>`;

  const form = document.getElementById("exercise-form");
  const nameInput = document.getElementById("ex-name");
  const groupInput = document.getElementById("ex-group");
  const errorEl = document.getElementById("ex-error");
  const listEl = document.getElementById("exercise-list");

  function renderList() {
    if (!exercises.length) {
      listEl.innerHTML = emptyState({
        icon: "dumbbell",
        title: "Nenhum exercício cadastrado",
        text: "Adicione o primeiro exercício usando o formulário acima.",
      });
      return;
    }

    const groups = new Map();
    for (const exercise of exercises) {
      const group = exercise.grupo_muscular || "Sem grupo";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(exercise);
    }

    listEl.innerHTML = [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(
        ([group, list]) => `<div class="group-title">${esc(group)}
            <span class="muted tiny">${list.length}</span>
          </div>
          <div class="list">
            ${list
              .map(
                (exercise) => `<div class="exercise-row">
                  <span>${esc(exercise.nome)}</span>
                </div>`
              )
              .join("")}
          </div>`
      )
      .join("");
  }

  function updateGroupSuggestions() {
    const datalist = document.getElementById("group-suggestions");
    if (!datalist) return;
    const groups = [
      ...new Set(
        exercises
          .map((exercise) => exercise.grupo_muscular)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));
    datalist.innerHTML = groups
      .map((group) => `<option value="${esc(group)}"></option>`)
      .join("");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;

    const nome = nameInput.value.trim();
    const grupo = groupInput.value.trim();

    if (!nome) {
      errorEl.hidden = false;
      errorEl.textContent = "Informe o nome do exercício.";
      nameInput.focus();
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      const created = await api.createExercise({
        nome,
        grupo_muscular: grupo || null,
      });
      exercises.push(created);
      exercises.sort(
        (a, b) =>
          (a.grupo_muscular || "").localeCompare(b.grupo_muscular || "", "pt-BR") ||
          a.nome.localeCompare(b.nome, "pt-BR")
      );
      renderList();
      updateGroupSuggestions();
      form.reset();
      toast("Exercício adicionado.");
      nameInput.focus();
    } catch (error) {
      errorEl.hidden = false;
      errorEl.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  renderList();
  updateGroupSuggestions();
}

function pageHead() {
  return `<div class="page-head">
      <div>
        <p class="eyebrow">Catálogo</p>
        <h1>Exercícios</h1>
      </div>
    </div>`;
}

function formView(exercises) {
  const groups = [
    ...new Set(
      exercises.map((exercise) => exercise.grupo_muscular).filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return `<form id="exercise-form" class="card stack-sm">
      <div class="grid-2">
        <label class="field">
          <span>Nome</span>
          <input class="input" id="ex-name" maxlength="80"
            placeholder="Ex.: Supino reto" autocomplete="off" required />
        </label>
        <label class="field">
          <span>Grupo muscular</span>
          <input class="input" id="ex-group" maxlength="40" list="group-suggestions"
            placeholder="Peito" autocomplete="off" />
        </label>
      </div>
      <datalist id="group-suggestions">
        ${groups
          .map((group) => `<option value="${esc(group)}"></option>`)
          .join("")}
      </datalist>
      <button type="submit" class="btn btn-primary btn-block">
        ${icons.plus} Adicionar exercício
      </button>
      <p class="form-error" id="ex-error" hidden></p>
    </form>`;
}

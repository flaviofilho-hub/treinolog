import {
  getApiBase,
  getApiKey,
  saveSettings,
  resetSettings,
} from "./config.js";
import { esc, icons, openModal, toast } from "./ui.js";
import { render } from "./router.js";

function normalize(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function openSettingsModal({ firstRun = false } = {}) {
  const key = getApiKey();

  const modal = openModal(
    `<div class="page-head" style="margin-bottom:14px">
        <div>
          <p class="eyebrow">Conexão</p>
          <h2>Ajustes</h2>
        </div>
      </div>
      <form id="settings-form" class="stack-sm">
        <label class="field">
          <span>Chave de API</span>
          <input class="input" id="api-key" type="password"
            placeholder="X-API-Key" value="${esc(key)}" autocomplete="off" />
        </label>
        <div class="modal-note">
          Informe a chave de API que você usa no seu servidor. Sem a chave, o app bloqueia as requisições.
        </div>
        <div class="settings-status" id="settings-status"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="test-connection">
          ${icons.refresh} Testar conexão
        </button>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="reset-settings">
          Restaurar padrão
        </button>
      </form>`,
    { onClose: () => {} }
  );

  const form = modal.root.querySelector("#settings-form");
  const keyInput = modal.root.querySelector("#api-key");
  const status = modal.root.querySelector("#settings-status");

  function setStatus(message, color) {
    status.textContent = message;
    status.style.color = color;
  }

  async function testConnection() {
    const keyValue = keyInput.value.trim();

    if (!keyValue) {
      setStatus("Informe a chave de API.", "var(--danger)");
      return;
    }

    setStatus("Testando…", "var(--muted)");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const base = window.location.origin; // mesma origem da página
      const response = await fetch(`${base}/api/exercicios`, {
        headers: keyValue ? { "X-API-Key": keyValue } : {},
        signal: controller.signal,
      });
      if (response.status === 401) {
        setStatus("Chave de API recusada (401).", "var(--danger)");
        return;
      }
      if (!response.ok) {
        setStatus(`Servidor respondeu ${response.status}.`, "var(--danger)");
        return;
      }
      const exercises = await response.json();
      setStatus(
        `Conectado. ${exercises.length} exercício(s) encontrados.`,
        "var(--success)"
      );
    } catch (error) {
      const message =
        error.name === "AbortError"
          ? "Tempo esgotado."
          : "Não foi possível conectar. Verifique a internet e o servidor.";
      setStatus(message, "var(--danger)");
    } finally {
      clearTimeout(timeout);
    }
  }

  modal.root
    .querySelector("#test-connection")
    .addEventListener("click", testConnection);

  modal.root.querySelector("#reset-settings").addEventListener("click", () => {
    resetSettings();
    keyInput.value = "";
    setStatus("Configuração restaurada.", "var(--muted)");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettings("", keyInput.value);
    toast("Ajustes salvos.");
    modal.close();
    if (firstRun) {
      window.location.reload();
    } else {
      render();
    }
  });

  keyInput.focus({ preventScroll: true });
}
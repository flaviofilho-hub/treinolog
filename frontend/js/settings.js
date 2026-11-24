import {
  getApiBase,
  getApiKey,
  isNativePlatform,
  resetSettings,
  saveSettings,
} from "./config.js";
import { esc, icons, openModal, toast } from "./ui.js";
import { render } from "./router.js";

function normalize(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function openSettingsModal({ firstRun = false } = {}) {
  const base = getApiBase();
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
         <span>Endereço da API</span>
         <input class="input" id="api-base" type="url" inputmode="url"
           placeholder="https://seu-servidor.com"
           value="${esc(base)}" autocomplete="off" />
       </label>
       <label class="field">
         <span>Chave de API</span>
         <input class="input" id="api-key" type="password"
           placeholder="X-API-Key" value="${esc(key)}" autocomplete="off" />
       </label>
       <div class="modal-note">
         ${
           isNativePlatform()
             ? "No aplicativo, informe a URL pública do servidor Flask. A chave é a mesma definida na variável <strong>API_KEY</strong>."
             : "No navegador, deixe o endereço vazio para usar o mesmo servidor que abriu esta página."
         }
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
  const baseInput = modal.root.querySelector("#api-base");
  const keyInput = modal.root.querySelector("#api-key");
  const status = modal.root.querySelector("#settings-status");

  function setStatus(message, color) {
    status.textContent = message;
    status.style.color = color;
  }

  async function testConnection() {
    const baseValue = normalize(baseInput.value);
    const keyValue = keyInput.value.trim();

    if (isNativePlatform() && !baseValue) {
      setStatus("Informe o endereço da API.", "var(--danger)");
      return;
    }

    if (isNativePlatform() && /^http:\/\//i.test(baseValue)) {
      setStatus(
        "Use uma URL HTTPS. O Android bloqueia conexões HTTP no aplicativo.",
        "var(--warning)"
      );
      return;
    }

    setStatus("Testando…", "var(--muted)");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${baseValue}/api/exercicios`, {
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
          : "Não foi possível conectar. Verifique a URL e a internet.";
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
    baseInput.value = "";
    keyInput.value = "";
    setStatus("Configuração restaurada.", "var(--muted)");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettings(baseInput.value, keyInput.value);
    toast("Ajustes salvos.");
    modal.close();
    if (firstRun) {
      window.location.reload();
    } else {
      render();
    }
  });

  baseInput.focus({ preventScroll: true });
}

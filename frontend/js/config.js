const BASE_KEY = "treinolog.api_base";
const KEY_KEY = "treinolog.api_key";

// Para a versão web, a URL do servidor é a mesma origem da página.
// O usuário só precisa informar a API_KEY na primeira vez.
export const DEFAULT_API_BASE = "";
export const DEFAULT_API_KEY = "";

// Verifica se já temos a chave salva. Se não, mostra o modal de configuração.
export function getApiBase() {
  const stored = localStorage.getItem(BASE_KEY);
  if (stored !== null) return normalizeBase(stored);
  return normalizeBase(DEFAULT_API_BASE);
}

export function getApiKey() {
  const stored = localStorage.getItem(KEY_KEY);
  return stored !== null ? stored : DEFAULT_API_KEY;
}

export function normalize(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function saveSettings(base, key) {
  localStorage.setItem(BASE_KEY, normalize(base));
  localStorage.setItem(KEY_KEY, String(key || "").trim());
  window.dispatchEvent(new Event("settings:changed"));
}

export function resetSettings() {
  localStorage.removeItem(BASE_KEY);
  localStorage.removeItem(KEY_KEY);
  window.dispatchEvent(new Event("settings:changed"));
}

// No modo web, sempre precisamos de chave. Retorna true se precisar pedir ao usuário.
export function needsSetup() {
  return !getApiKey();
}
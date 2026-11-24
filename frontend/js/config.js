const BASE_KEY = "treinolog.api_base";
const KEY_KEY = "treinolog.api_key";

// Deixe vazio para usar a mesma origem (versão web servida pelo Flask).
// No APK, configure a URL do servidor em Ajustes ou defina aqui no build.
export const DEFAULT_API_BASE = "";
export const DEFAULT_API_KEY = "";

export function isNativePlatform() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function normalizeBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function getApiBase() {
  const stored = localStorage.getItem(BASE_KEY);
  if (stored !== null) return normalizeBase(stored);
  return normalizeBase(DEFAULT_API_BASE);
}

export function getApiKey() {
  const stored = localStorage.getItem(KEY_KEY);
  return stored !== null ? stored : DEFAULT_API_KEY;
}

export function saveSettings(base, key) {
  localStorage.setItem(BASE_KEY, normalizeBase(base));
  localStorage.setItem(KEY_KEY, String(key || "").trim());
  window.dispatchEvent(new Event("settings:changed"));
}

export function resetSettings() {
  localStorage.removeItem(BASE_KEY);
  localStorage.removeItem(KEY_KEY);
  window.dispatchEvent(new Event("settings:changed"));
}

export function needsSetup() {
  return isNativePlatform() && !getApiBase();
}

import { api, ApiError, NetworkError } from "./api.js";

const STORAGE_KEY = "treinolog.pending.v1";
let syncing = false;

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("pending:changed"));
}

export function getPending() {
  return read();
}

export function pendingCount() {
  return read().length;
}

export function addPending(payload) {
  const list = read();
  const entry = { ...payload, _queued_at: new Date().toISOString() };
  const index = list.findIndex((item) => item.client_id === payload.client_id);
  if (index >= 0) {
    list[index] = entry;
  } else {
    list.push(entry);
  }
  write(list);
}

export function removePending(clientId) {
  write(read().filter((item) => item.client_id !== clientId));
}

export function markPendingError(clientId, message) {
  write(
    read().map((item) =>
      item.client_id === clientId ? { ...item, _error: message } : item
    )
  );
}

export function clearPendingError(clientId) {
  write(
    read().map((item) => {
      if (item.client_id !== clientId) return item;
      const { _error, ...rest } = item;
      return rest;
    })
  );
}

export async function syncPending() {
  if (syncing) return { synced: 0, failed: 0, skipped: true };
  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    for (const item of read()) {
      if (item._error) continue;
      const payload = {};
      Object.entries(item).forEach(([key, value]) => {
        if (!key.startsWith("_")) payload[key] = value;
      });

      try {
        await api.createWorkout(payload);
        removePending(item.client_id);
        synced += 1;
      } catch (error) {
        if (error instanceof NetworkError) break;
        if (error instanceof ApiError && error.status === 0) break;
        markPendingError(item.client_id, error.message);
        failed += 1;
      }
    }
  } finally {
    syncing = false;
  }

  return { synced, failed };
}

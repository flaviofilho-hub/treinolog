import { getApiBase, getApiKey, isNativePlatform } from "./config.js";

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = "NetworkError";
  }
}

const EXERCISE_CACHE_KEY = "treinolog.cache.exercises.v1";

function readExerciseCache() {
  try {
    const raw = localStorage.getItem(EXERCISE_CACHE_KEY);
    const list = raw ? JSON.parse(raw) : null;
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

function writeExerciseCache(list) {
  try {
    localStorage.setItem(EXERCISE_CACHE_KEY, JSON.stringify(list));
  } catch {
    // Armazenamento indisponível (modo privado): segue sem cache.
  }
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function request(path, { method = "GET", body } = {}) {
  const base = getApiBase();
  if (isNativePlatform() && !base) {
    throw new ApiError("Configure o endereço do servidor em Ajustes.", 0);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const key = getApiKey();
  if (key) headers["X-API-Key"] = key;

  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: "include",
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const message =
        data?.error || `Falha na requisição (${response.status}).`;
      throw new ApiError(message, response.status, data?.details || null);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === "AbortError") {
      throw new NetworkError("O servidor demorou demais para responder.");
    }
    throw new NetworkError(
      "Sem conexão com o servidor. Verifique a internet e o endereço da API."
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  listExercises: async () => {
    try {
      const data = await request("/api/exercicios");
      writeExerciseCache(data);
      return data;
    } catch (error) {
      if (error instanceof NetworkError) {
        const cached = readExerciseCache();
        if (cached) return cached;
      }
      throw error;
    }
  },
  createExercise: async (payload) => {
    const created = await request("/api/exercicios", {
      method: "POST",
      body: payload,
    });
    const cached = readExerciseCache();
    if (cached) {
      writeExerciseCache([
        ...cached.filter((exercise) => exercise.id !== created.id),
        created,
      ]);
    }
    return created;
  },
  listWorkouts: (params) => request(`/api/treinos${buildQuery(params)}`),
  getWorkout: (id) => request(`/api/treinos/${id}`),
  createWorkout: (payload) =>
    request("/api/treinos", { method: "POST", body: payload }),
  deleteWorkout: (id) => request(`/api/treinos/${id}`, { method: "DELETE" }),
  stats: () => request("/api/estatisticas"),
  statsByMuscleGroup: () => request("/api/estatisticas/por-grupo-muscular"),
  progress: (exerciseId, params) =>
    request(`/api/progresso/${exerciseId}${buildQuery(params)}`),
};

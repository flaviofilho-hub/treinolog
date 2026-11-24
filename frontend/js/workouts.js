import {
  esc,
  fmtDay,
  fmtKg,
  fmtMonth,
  fmtVolume,
  plural,
} from "./ui.js";

export function summaryOf(workout) {
  if (workout.resumo) return workout.resumo;
  const sets = workout.sets || [];
  return {
    series: sets.length,
    reps: sets.reduce((total, item) => total + Number(item.reps || 0), 0),
    volume_kg: sets.reduce(
      (total, item) =>
        total + Number(item.reps || 0) * Number(item.carga_kg || 0),
      0
    ),
    carga_max_kg: sets.reduce(
      (maximum, item) => Math.max(maximum, Number(item.carga_kg || 0)),
      0
    ),
  };
}

export function exerciseCountOf(workout) {
  if (Array.isArray(workout.exercicios)) return workout.exercicios.length;
  return new Set((workout.sets || []).map((item) => item.exercise_id)).size;
}

export function workoutCard(workout) {
  const pending = !workout.id;
  const summary = summaryOf(workout);
  const href = pending
    ? `#/treino/${encodeURIComponent(workout.client_id)}`
    : `#/treino/${workout.id}`;

  return `<a class="workout-item" href="${href}">
      <span class="date-badge">
        <strong>${fmtDay(workout.data)}</strong>
        <span>${fmtMonth(workout.data)}</span>
      </span>
      <span class="workout-main">
        <span class="workout-title">
          ${esc(workout.nome)}
          ${pending ? '<span class="badge badge-pending">pendente</span>' : ""}
        </span>
        <span class="workout-sub">
          ${plural(exerciseCountOf(workout), "exercício", "exercícios")} ·
          ${plural(summary.series, "série", "séries")} ·
          ${fmtVolume(summary.volume_kg)}
        </span>
      </span>
      <span class="workout-meta">
        <strong>${fmtKg(summary.carga_max_kg)}</strong>
        <span>carga máx.</span>
      </span>
    </a>`;
}

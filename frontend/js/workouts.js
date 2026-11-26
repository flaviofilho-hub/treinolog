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
  const tipo = workout.tipo || "forca";
  const isCardio = tipo === "cardio";
  const href = pending
    ? `#/treino/${encodeURIComponent(workout.client_id)}`
    : `#/treino/${workout.id}`;

  const tipoBadge =
    isCardio
      ? '<span class="badge badge-cardio">cardio</span>'
      : "";

  const sub = isCardio
    ? `${workout.duracao_min || 0} min de cardio`
    : `${plural(exerciseCountOf(workout), "exercício", "exercícios")} ·
       ${plural(summary.series, "série", "séries")} ·
       ${fmtVolume(summary.volume_kg)}`;

  const meta = isCardio
    ? `<strong>${workout.duracao_min || 0} min</strong><span>duração</span>`
    : `<strong>${fmtKg(summary.carga_max_kg)}</strong><span>carga máx.</span>`;

  return `<a class="workout-item" href="${href}">
      <span class="date-badge">
        <strong>${fmtDay(workout.data)}</strong>
        <span>${fmtMonth(workout.data)}</span>
      </span>
      <span class="workout-main">
        <span class="workout-title">
          ${esc(workout.nome)}
          ${pending ? '<span class="badge badge-pending">pendente</span>' : ""}
          ${tipoBadge}
        </span>
        <span class="workout-sub">${sub}</span>
      </span>
      <span class="workout-meta">${meta}</span>
    </a>`;
}

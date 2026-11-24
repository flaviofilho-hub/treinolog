import { api } from "../api.js";
import { getPending, syncPending } from "../pending.js";
import {
  esc,
  fmtDate,
  fmtKg,
  fmtNumber,
  fmtVolume,
  icons,
  loadingList,
  renderError,
  toast,
} from "../ui.js";
import { workoutCard } from "../workouts.js";

export async function renderHome() {
  const app = document.getElementById("app");
  app.innerHTML = `${hero()}${loadingList(2)}`;

  try {
    const stats = await api.stats();
    app.innerHTML = `${hero()}${view(stats, getPending())}`;
    bind(app);
  } catch (error) {
    const pending = getPending();
    if (pending.length) {
      app.innerHTML = `${hero()}${offlineBanner(error.message)}${pendingSection(
        pending
      )}`;
      bind(app);
      return;
    }
    renderError(app, error.message, renderHome);
  }
}

function hero() {
  return `<section class="hero">
      <p class="eyebrow">Painel de treinos</p>
      <h1>Seu progresso,<br /><span class="accent">sem achismo.</span></h1>
      <p class="muted">Registre cada série e veja a carga subir.</p>
      <a class="btn btn-primary" href="#/novo">${icons.plus} Registrar treino</a>
    </section>`;
}

function view(stats, pending) {
  const pendingBanner = pending.length
    ? `<div class="banner">
         ${icons.warning}
         <div class="banner-text">
           <strong>${pending.length} treino${pending.length === 1 ? "" : "s"} no aparelho.</strong>
           ${pending.length === 1 ? "Ele será enviado" : "Eles serão enviados"} quando a conexão voltar.
         </div>
         <button type="button" class="btn btn-ghost btn-sm" data-sync>Enviar</button>
       </div>`
    : "";

  const recent = stats.ultimos.length
    ? `<div class="section-head">
         <h2>Últimos treinos</h2>
         <a href="#/historico">Ver todos</a>
       </div>
       <div class="list">${stats.ultimos.map(workoutCard).join("")}</div>`
    : `<div class="section-head"><h2>Primeiro treino</h2></div>
       <div class="empty">
         <div class="empty-icon">${icons.dumbbell}</div>
         <h3>Nada registrado ainda</h3>
         <p>Comece com o treino de hoje. Cada série conta.</p>
         <a class="btn btn-primary" href="#/novo">${icons.plus} Registrar treino</a>
       </div>`;

  const records = stats.recordes.length
    ? `<div class="section-head">
         <h2>Recordes</h2>
         <a href="#/progresso">Ver progresso</a>
       </div>
       <div class="records">
         ${stats.recordes
           .map(
             (record) => `<div class="record">
               <div class="record-name">${esc(record.nome)}</div>
               <div class="record-value">${fmtKg(record.carga_kg)}
                 <span>× ${record.reps}</span>
               </div>
               <div class="record-date">${fmtDate(record.data)}</div>
             </div>`
           )
           .join("")}
       </div>`
    : "";

  return `${pendingBanner}
    <div class="stat-grid">
      <div class="stat">
        <span class="stat-label">Treinos</span>
        <div class="stat-value">${fmtNumber(stats.total_treinos)}</div>
      </div>
      <div class="stat">
        <span class="stat-label">Séries</span>
        <div class="stat-value">${fmtNumber(stats.total_series)}</div>
      </div>
      <div class="stat">
        <span class="stat-label">Volume</span>
        <div class="stat-value">${fmtVolume(stats.volume_total_kg)}</div>
      </div>
    </div>
    ${recent}
    ${records}`;
}

function offlineBanner(message) {
  return `<div class="banner">
      ${icons.wifiOff}
      <div class="banner-text">
        <strong>Servidor indisponível.</strong>
        ${esc(message)}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-sync>Enviar</button>
    </div>`;
}

function pendingSection(pending) {
  return `<div class="section-head">
      <h2>Salvos no aparelho</h2>
      <span class="badge badge-pending">${pending.length}</span>
    </div>
    <div class="list">${pending.map(workoutCard).join("")}</div>
    <div style="margin-top:16px">
      <a class="btn btn-ghost btn-block" href="#/historico">Abrir histórico</a>
    </div>`;
}

function bind(app) {
  app.querySelector("[data-sync]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Enviando…";
    const result = await syncPending();

    if (result.synced) {
      toast(`${result.synced} treino(s) enviado(s).`);
      renderHome();
      return;
    }
    if (result.failed) {
      toast("Alguns treinos precisam de atenção.", "error");
      renderHome();
      return;
    }
    toast("Nada foi enviado. Verifique a conexão.", "warning");
    button.disabled = false;
    button.textContent = "Enviar";
  });
}

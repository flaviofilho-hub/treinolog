import { register, render, startRouter } from "./router.js";
import { needsSetup } from "./config.js";
import { pendingCount, syncPending } from "./pending.js";
import { openSettingsModal } from "./settings.js";
import { toast } from "./ui.js";
import { renderHome } from "./pages/home.js";
import { renderNew } from "./pages/new.js";
import { renderHistory } from "./pages/history.js";
import { renderDetail } from "./pages/detail.js";
import { renderProgress } from "./pages/progress.js";
import { renderExercises } from "./pages/exercises.js";

register("/", renderHome);
register("/novo", renderNew);
register("/historico", renderHistory);
register("/treino/:id", renderDetail);
register("/progresso", renderProgress);
register("/exercicios", renderExercises);

const indicator = document.getElementById("pending-indicator");

function updatePendingBadge() {
  const count = pendingCount();
  indicator.hidden = count === 0;
  indicator.textContent = `${count} pendente${count === 1 ? "" : "s"}`;
}

window.addEventListener("pending:changed", updatePendingBadge);
document
  .getElementById("open-settings")
  .addEventListener("click", () => openSettingsModal());

window.addEventListener("online", async () => {
  const result = await syncPending();
  if (result.synced) {
    toast(`${result.synced} treino(s) enviado(s).`);
    updatePendingBadge();
    render();
  }
});

startRouter();
updatePendingBadge();

if (needsSetup()) {
  openSettingsModal({ firstRun: true });
} else {
  syncPending().then((result) => {
    if (result.synced) {
      toast(`${result.synced} treino(s) pendente(s) enviado(s).`);
      updatePendingBadge();
      render();
    }
  });
}

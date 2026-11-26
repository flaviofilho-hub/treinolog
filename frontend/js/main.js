import { register, render, startRouter } from "./router.js";
import { isNativePlatform, needsSetup } from "./config.js";
import { openSettingsModal } from "./settings.js";
import { pendingCount, syncPending } from "./pending.js";
import { toast } from "./ui.js";
import { getCurrentUser, renderAuthGate, updateAuthUI } from "./auth.js";
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
  if (!indicator) return;
  const count = pendingCount();
  indicator.hidden = count === 0;
  indicator.textContent = `${count} pendente${count === 1 ? "" : "s"}`;
}

async function bootstrap() {
  const settingsButton = document.getElementById("open-settings");
  if (settingsButton) {
    if (isNativePlatform()) {
      settingsButton.addEventListener("click", () => openSettingsModal());
    } else {
      // Na web a conexão é a mesma origem e o login é por sessão.
      settingsButton.style.display = "none";
    }
  }

  window.addEventListener("pending:changed", updatePendingBadge);

  const user = await getCurrentUser();
  updateAuthUI(user);

  if (!user) {
    renderAuthGate(document.getElementById("app"));
    return;
  }

  startRouter();
  updatePendingBadge();

  window.addEventListener("online", async () => {
    const result = await syncPending();
    if (result.synced) {
      toast(`${result.synced} treino(s) enviado(s).`);
      updatePendingBadge();
      render();
    }
  });

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
}

bootstrap();

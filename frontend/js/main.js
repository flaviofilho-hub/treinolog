import { register, render, startRouter } from "./router.js";
import { needsSetup, saveSettings } from "./config.js";
import { openSettingsModal } from "./settings.js";
import { pendingCount, syncPending } from "./pending.js";
import { toast } from "./ui.js";
import { renderHome } from "./pages/home.js";
import { renderNew } from "./pages/new.js";
import { renderHistory } from "./pages/history.js";
import { renderDetail } from "./pages/detail.js";
import { renderProgress } from "./pages/progress.js";
import { renderExercises } from "./pages/exercicios.js";

async function showLoginModal() {
  const email = prompt("Digite seu e-mail:");
  const senha = prompt("Digite sua senha:");
  if (!email || !senha) {
    toast("E-mail e senha são obrigatórios.", "error");
    return;
  }
  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });
    const data = await response.json();
    if (response.ok) {
      toast(data.message || "Login bem-sucedido!");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      toast(data.error || "Falha no login.", "error");
    }
  } catch (err) {
    console.error("Erro no login:", err);
    toast("Erro ao tentar fazer login.", "error");
  }
}

async function showRegisterModal() {
  const nome = prompt("Digite seu nome:");
  const email = prompt("Digite seu e-mail:");
  const senha = prompt("Digite uma senha (mínimo 6 caracteres):");
  if (!nome || !email || !senha) {
    toast("Todos os campos são obrigatórios.", "error");
    return;
  }
  if (senha.length < 6) {
    toast("A senha deve ter no mínimo 6 caracteres.", "error");
    return;
  }
  try {
    const response = await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha })
    });
    const data = await response.json();
    if (response.ok) {
      toast(data.message || "Registro bem-sucedido!");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      toast(data.error || "Falha no registro.", "error");
    }
  } catch (err) {
    console.error("Erro no registro:", err);
    toast("Erro ao tentar registrar.", "error");
  }
}

// No modo web, sempre verificar configuração na inicialização
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

// Garantir que o router re-renderize quando o estado mudar (ex: login)
window.addEventListener("storage", (event) => {
  if (event.key === "treinolog_user") {
    render();
  }
});
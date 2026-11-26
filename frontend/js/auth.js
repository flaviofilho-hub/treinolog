import { esc } from "./ui.js";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? { Accept: "application/json" } : JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
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
    const error = new Error(
      data?.error || `Falha na requisição (${response.status}).`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function getCurrentUser() {
  try {
    const data = await request("/auth/me");
    return data?.user || null;
  } catch {
    return null;
  }
}

export function login(email, senha) {
  return request("/auth/login", { method: "POST", body: { email, senha } });
}

export function register(nome, email, senha) {
  return request("/auth/register", {
    method: "POST",
    body: { nome, email, senha },
  });
}

export function logout() {
  return request("/auth/logout", { method: "POST" });
}

export function updateAuthUI(user) {
  const box = document.getElementById("auth-buttons");
  if (!box) return;

  if (!user) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <span class="auth-user" title="${esc(user.email || "")}">${esc(
    user.nome || "Conta"
  )}</span>
    <button type="button" class="auth-btn" id="btn-logout">Sair</button>`;

  box.querySelector("#btn-logout")?.addEventListener("click", async () => {
    try {
      await logout();
    } catch {
      // Mesmo se falhar, recarrega para refazer a checagem de sessão.
    }
    window.location.reload();
  });
}

const COPY = {
  login: {
    title: "Entrar",
    subtitle: "Acesse sua conta para ver apenas os seus treinos.",
    submit: "Entrar",
    loading: "Entrando…",
    passwordAutocomplete: "current-password",
  },
  register: {
    title: "Criar conta",
    subtitle: "Cada conta tem o seu próprio histórico de treinos.",
    submit: "Criar conta",
    loading: "Criando…",
    passwordAutocomplete: "new-password",
  },
};

export function renderAuthGate(container, { mode = "login" } = {}) {
  document.body.classList.add("auth-locked");

  let currentMode = mode === "register" ? "register" : "login";

  container.innerHTML = `
    <section class="auth-gate">
      <div class="auth-gate-card">
        <p class="eyebrow">treinolog</p>
        <h2 id="auth-title">Entrar</h2>
        <p class="muted small" id="auth-subtitle">Acesse sua conta para ver apenas os seus treinos.</p>
        <div class="auth-tabs" role="tablist">
          <button type="button" class="auth-tab" data-mode="login">Entrar</button>
          <button type="button" class="auth-tab" data-mode="register">Criar conta</button>
        </div>
        <form id="auth-form" class="stack-sm" novalidate>
          <label class="field" id="auth-nome-field">
            <span>Nome</span>
            <input class="input" name="nome" autocomplete="name" placeholder="Seu nome" />
          </label>
          <label class="field">
            <span>E-mail</span>
            <input class="input" name="email" type="email" inputmode="email"
              autocomplete="username" placeholder="voce@email.com" required />
          </label>
          <label class="field">
            <span>Senha</span>
            <input class="input" name="senha" type="password"
              autocomplete="current-password" placeholder="Mínimo 8 caracteres" required />
          </label>
          <div class="form-error" id="auth-error" hidden></div>
          <button type="submit" class="btn btn-primary btn-block" id="auth-submit">Entrar</button>
        </form>
      </div>
    </section>`;

  const form = container.querySelector("#auth-form");
  const nomeField = container.querySelector("#auth-nome-field");
  const senhaInput = form.elements.senha;
  const errorBox = container.querySelector("#auth-error");
  const submit = container.querySelector("#auth-submit");
  const title = container.querySelector("#auth-title");
  const subtitle = container.querySelector("#auth-subtitle");
  const tabs = Array.from(container.querySelectorAll(".auth-tab"));

  function applyMode(next) {
    currentMode = next;
    const copy = COPY[currentMode];

    title.textContent = copy.title;
    subtitle.textContent = copy.subtitle;
    submit.textContent = copy.submit;
    senhaInput.setAttribute("autocomplete", copy.passwordAutocomplete);
    nomeField.hidden = currentMode !== "register";

    tabs.forEach((tab) => {
      const active = tab.dataset.mode === currentMode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => applyMode(tab.dataset.mode));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = String(form.elements.nome?.value || "").trim();
    const email = String(form.elements.email.value || "").trim();
    const senha = String(form.elements.senha.value || "");

    if (currentMode === "register" && !nome) {
      showError("Informe o seu nome.");
      return;
    }
    if (!email) {
      showError("Informe o seu e-mail.");
      return;
    }
    if (!senha) {
      showError("Informe a sua senha.");
      return;
    }
    if (currentMode === "register" && senha.length < 8) {
      showError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    const copy = COPY[currentMode];
    submit.disabled = true;
    submit.textContent = copy.loading;
    errorBox.hidden = true;

    try {
      if (currentMode === "register") {
        await register(nome, email, senha);
      } else {
        await login(email, senha);
      }
      window.location.reload();
    } catch (error) {
      showError(error.message || "Não foi possível concluir. Tente novamente.");
      submit.disabled = false;
      submit.textContent = copy.submit;
    }
  });

  applyMode(currentMode);
  form.elements.email?.focus({ preventScroll: true });
}

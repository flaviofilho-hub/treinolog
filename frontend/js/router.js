const routes = new Map();

export function register(pattern, handler) {
  routes.set(pattern, handler);
}

export function navigate(path) {
  if (location.hash === `#${path}`) {
    render();
  } else {
    location.hash = path;
  }
}

export function currentPath() {
  return location.hash.replace(/^#/, "") || "/";
}

function match(path) {
  const clean = path.split("?")[0];
  const parts = clean.split("/").filter(Boolean);

  for (const [pattern, handler] of routes) {
    const patternParts = pattern.split("/").filter(Boolean);
    if (patternParts.length !== parts.length) continue;

    const params = {};
    let matched = true;
    for (let index = 0; index < patternParts.length; index += 1) {
      const segment = patternParts[index];
      if (segment.startsWith(":")) {
        params[segment.slice(1)] = decodeURIComponent(parts[index]);
      } else if (segment !== parts[index]) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler, params };
  }
  return null;
}

function updateNav(path) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const target = link.dataset.nav;
    const active =
      target === "/" ? path === "/" || path === "" : path.startsWith(target);
    link.classList.toggle("active", active);
  });
}

export async function render() {
  const path = currentPath();
  const found = match(path);
  const app = document.getElementById("app");
  updateNav(path);

  if (!found) {
    app.innerHTML = `<div class="empty">
        <h3>Página não encontrada</h3>
        <p>O endereço acessado não existe.</p>
        <a class="btn btn-primary" href="#/">Voltar ao início</a>
      </div>`;
    return;
  }

  app.classList.remove("page-enter");
  void app.offsetWidth;
  app.classList.add("page-enter");
  window.scrollTo({ top: 0, behavior: "instant" });

  const query = new URLSearchParams(path.split("?")[1] || "");
  try {
    await found.handler({ params: found.params, query });
  } catch (error) {
    console.error(error);
    app.innerHTML = `<div class="empty">
        <h3>Algo deu errado</h3>
        <p></p>
        <a class="btn btn-ghost" href="#/">Voltar ao início</a>
      </div>`;
    app.querySelector("p").textContent = error.message || "Erro inesperado.";
  }
}

export function startRouter() {
  window.addEventListener("hashchange", render);
  render();
}

const CACHE_NAME = "treinolog-pwa-v1";
const PRECACHE_URLS = [
  ".",
  "js/main.js",
  "js/router.js",
  "js/config.js",
  "js/api.js",
  "js/pages/home.js",
  "js/pages/new.js",
  "js/pages/detail.js",
  "js/pages/history.js",
  "js/pages/progress.js",
  "js/pages/exercises.js",
  "js/ui.js",
  "js/vendor/chart.umd.js",
  "css/app.css",
  "assets/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("Precache failed:", err);
      });
    })
  );
  // Pular o phase waiting para ativar o SW imediatamente
  self.clients.claim();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  // Tornar o SW ativo imediatamente
  return self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Não cachear requisições de API — sempre ir para a rede
  if (event.request.url.includes("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new JSON.stringify({
          error: "Sem conexão com o servidor.",
        }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        };
      })
    );
    return;
  }

  // Para todas as outras requisições (estáticos, HTML, etc.), use cache-first
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Não cachear respostas não-200
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Clonar a resposta para cache e para a rede
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache).catch((err) => {
            console.warn("Cache put failed:", err);
          });
        });

        return networkResponse;
      }).catch(() => {
        // Se estiver offline e nada em cache, cair para a página offline
        if (event.request.mode === "navigate") {
          return caches.match("/").then((resp) => resp || new Response("Offline", { status: 503 }));
        }
      });
    })
  );
});
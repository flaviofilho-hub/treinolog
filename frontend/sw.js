// Service Worker desativado.
//
// Este arquivo existe apenas para limpar instalações antigas: navegadores que
// já tinham o SW anterior fazem uma checagem de atualização neste caminho e
// recebem esta versão, que apaga os caches, se desregistra e recarrega a aba.
// Nenhuma requisição é interceptada e nada é cacheado.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const hadCaches = keys.length > 0;

      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();

      // Só recarrega se havia cache antigo, para não criar loop de reload.
      if (!hadCaches) return;

      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => {
        client.navigate(client.url).catch(() => {});
      });
    })()
  );
});

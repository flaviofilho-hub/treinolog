// Service worker desativado.
// Versões antigas serviam respostas em cache (inclusive HTML no lugar de JS)
// e quebravam o carregamento dos módulos. Este arquivo se auto-remove.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));

      await self.registration.unregister();

      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => {
        client.navigate(client.url).catch(() => {});
      });
    })()
  );
});

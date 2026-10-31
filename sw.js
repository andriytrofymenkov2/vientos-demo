/* Service worker: la app abre rápido y funciona aunque se corte la señal en el gimnasio.
   Estrategia: primero la red (siempre lo último publicado); si no hay conexión, lo guardado. */
const CACHE = "vientos-v117";
const CORE = ["./", "index.html", "css/app.css", "js/app.js", "manifest.webmanifest", "img/icon-192.png", "img/fachada.jpg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    const updated = ks.some((k) => k !== CACHE);              /* había una versión anterior */
    await Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    /* Versión nueva: las pantallas que quedaron abiertas con la anterior (en iPhone la app
       queda viva días en segundo plano) se recargan solas con lo nuevo. Menos la instalación,
       Recepción y la pantalla de socios: se cortaría la cámara, la pantalla completa y el sonido
       (ahí aparece el botón "Actualizar") */
    const keep = (u) => u.includes("#/instalar") || u.includes("#/panel/recepcion") || u.includes("#/pantalla");
    if (updated) (await self.clients.matchAll({ type: "window" })).filter((c) => !keep(c.url)).forEach((c) => c.navigate(c.url).catch(() => {}));
  })());
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: "no-cache" }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});

/* Al tocar el aviso "Terminó el descanso" se abre (o vuelve) la app */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const c = list.find((x) => "focus" in x);
    return c ? c.focus() : self.clients.openWindow("./");
  }));
});

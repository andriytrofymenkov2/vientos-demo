/* Actualizaciones. La app instalada abre siempre lo último publicado, pero en el celular
   (sobre todo en iPhone) queda viva en segundo plano durante días con la versión que cargó.
   Por eso se fija si hay una versión nueva publicada:
   · al abrir: si mostró una versión guardada (sin señal o con señal lenta), se pone al día sola;
   · al volver a la app: si estuvo 10 min o más sin usarse se recarga sola; si no, avisa con
     un botón "Actualizar" (no corta un entrenamiento ni algo que se esté escribiendo);
   · cada 15 minutos mientras se usa.
   Además el service worker (sw.js) recarga las pantallas que quedaron abiertas con una
   versión vieja cuando baja una nueva. */
let current = "", hiddenAt = 0, shown = false;
export const appVersion = () => current;

async function published() {
  try {
    const html = await (await fetch(new URL("./", location.href), { cache: "no-store" })).text();
    return html.match(/app\.js\?v=([\w.-]+)/)?.[1] || "";
  } catch { return ""; }
}

/* auto: true = recargar sin preguntar; "boot" = recién abierta (una sola vez por versión) */
async function check(auto) {
  if (!current || !navigator.onLine) return;
  /* En la pantalla de instalación no se recarga ni se avisa: se cortaría la instalación */
  if (location.hash.startsWith("#/instalar")) return;
  /* la pantalla de los socios tampoco: la ve la gente (se actualiza la próxima vez que se abre) */
  if (location.hash.startsWith("#/pantalla")) return;
  /* en Recepción con la cámara prendida no se recarga sola: se avisa con el botón "Actualizar" */
  if (location.hash.startsWith("#/panel/recepcion") || location.hash.startsWith("#/pantalla")) auto = false;
  const v = await published();
  if (!v || v === current) return;
  if (auto === "boot") {
    const k = "vientos_upd_" + v;
    let tried = false;
    try { tried = !!sessionStorage.getItem(k); sessionStorage.setItem(k, "1"); } catch { tried = true; }
    if (!tried) return location.reload();
    auto = false;                                     /* ya se intentó: que avise en vez de insistir */
  }
  if (auto) return location.reload();
  if (shown) return;
  shown = true;
  const bar = document.createElement("div");
  bar.className = "upd no-print";
  bar.setAttribute("role", "status");
  bar.innerHTML = `<span>Hay una versión nueva de la app</span><button type="button" class="btn primary sm">Actualizar</button>`;
  bar.querySelector("button").addEventListener("click", () => forceUpdate());
  document.body.append(bar);
}

/* Que el navegador baje ya el service worker nuevo, si lo hay */
const swUpdate = () => navigator.serviceWorker?.getRegistration?.().then((r) => r?.update()).catch(() => {});

/* Volvió a la app (iPhone la restaura de la memoria sin recargarla) */
function back() {
  swUpdate();
  check(hiddenAt > 0 && Date.now() - hiddenAt >= 10 * 60000);
}

/* Actualizar ya: baja todo de nuevo aunque el celular tenga algo guardado.
   Sin señal no hace nada (si no, la app no podría abrir). */
export async function forceUpdate() {
  if (!navigator.onLine) return false;
  await swUpdate();
  try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* sin caché */ }
  location.reload();
  return true;
}

export function watchUpdates(version) {
  current = version || "";
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    back();
  });
  addEventListener("pageshow", (e) => { if (e.persisted) back(); });
  setInterval(() => document.visibilityState === "visible" && check(false), 15 * 60000);
  setTimeout(() => check("boot"), 4000);
}

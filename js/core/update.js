/* Actualizaciones. La app instalada abre siempre lo último publicado, pero si quedó
   abierta en segundo plano sigue con la versión que cargó. Por eso se fija, al volver
   a la app y cada tanto, si hay una versión nueva publicada:
   · si estuvo un rato sin usarse (10 min o más) se recarga sola;
   · si se está usando, avisa con un botón "Actualizar" (no corta lo que se está haciendo). */
let current = "", hiddenAt = 0, shown = false;
export const appVersion = () => current;

async function published() {
  try {
    const html = await (await fetch(new URL("./", location.href), { cache: "no-store" })).text();
    return html.match(/app\.js\?v=([\w.-]+)/)?.[1] || "";
  } catch { return ""; }
}

async function check(auto) {
  if (!current || !navigator.onLine) return;
  const v = await published();
  if (!v || v === current) return;
  if (auto) return location.reload();
  if (shown) return;
  shown = true;
  const bar = document.createElement("div");
  bar.className = "upd no-print";
  bar.setAttribute("role", "status");
  bar.innerHTML = `<span>Hay una versión nueva de la app</span><button type="button" class="btn primary sm">Actualizar</button>`;
  bar.querySelector("button").addEventListener("click", () => location.reload());
  document.body.append(bar);
}

export function watchUpdates(version) {
  current = version || "";
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    check(hiddenAt > 0 && Date.now() - hiddenAt >= 10 * 60000);
  });
  setInterval(() => document.visibilityState === "visible" && check(false), 15 * 60000);
}

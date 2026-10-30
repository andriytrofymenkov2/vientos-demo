/* Enrutador por hash (#/ruta): funciona en cualquier hosting estático */
import * as S from "./store.js";
import { me, isStaff, isAdmin } from "./auth.js";

const routes = [];
let cleanup = null;
let renderShell = null;
let lastPath = "";

export function route(pattern, handler, opts = {}) {
  const keys = [];
  const rx = new RegExp("^" + pattern.replace(/\/:(\w+)/g, (_, k) => (keys.push(k), "/([^/]+)")) + "/?$");
  routes.push({ rx, keys, handler, opts });
}

export function setShell(fn) { renderShell = fn; }

export const current = () => parse(location.hash);

function parse(hash) {
  const raw = (hash || "").replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { path, query: Object.fromEntries(new URLSearchParams(qs || "")) };
}

/* Pantalla de inicio según el rol */
export const homeOf = () => (isStaff() ? "/panel" : "/inicio");

export function go(path, { replace = false } = {}) {
  const h = "#" + path;
  if (replace) history.replaceState(null, "", h); else if (location.hash !== h) { location.hash = h; return; }
  render();
}

export function refresh() { render(true); }

export async function render(isRefresh = false) {
  const { path, query } = parse(location.hash);
  let match = null, params = {};
  for (const r of routes) {
    const m = path.match(r.rx);
    if (m) { match = r; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); break; }
  }
  if (!match) return go(me() ? homeOf() : "/ingresar", { replace: true });
  if (!match.opts.public && !me()) return go("/ingresar", { replace: true });
  if (match.opts.guestOnly && me()) return go(homeOf(), { replace: true });
  if (match.opts.staff && !isStaff()) return go("/inicio", { replace: true });
  if (match.opts.admin && !isAdmin()) return go(homeOf(), { replace: true });
  if (match.opts.member && isStaff()) return go("/panel", { replace: true });
  /* Contraseña inicial (su DNI): antes de usar la app tiene que elegir una propia */
  if (me()?.prefs?.tempPass && !match.opts.public && path !== "/clave") return go("/clave", { replace: true });
  /* Términos y privacidad: el socio los acepta una vez (y de nuevo si cambia el texto) */
  if (!me()?.prefs?.tempPass && S.needsConsent(me()) && !match.opts.public && path !== "/consentimiento") return go("/consentimiento", { replace: true });

  const view = await match.handler(params, query);
  if (!view) return;
  if (typeof cleanup === "function") { try { cleanup(); } catch (e) { console.warn(e); } }
  cleanup = null;

  /* Contenedor nuevo en cada pantalla: así no quedan escuchas de la anterior */
  const prevHost = renderShell(view.layout || "app", view.nav || match.opts.nav || "");
  const host = prevHost.cloneNode(false);
  prevHost.replaceWith(host);
  document.title = (view.title ? view.title + " · " : "") + "Vientos GYM";
  host.innerHTML = view.html;
  if (!isRefresh || path !== lastPath) {
    host.classList.remove("view-in");
    void host.offsetWidth;
    host.classList.add("view-in");
    window.scrollTo(0, 0);
  }
  lastPath = path;
  if (view.mount) cleanup = view.mount(host, params, query) || null;
}

export function start() {
  addEventListener("hashchange", () => render());
  render();
}

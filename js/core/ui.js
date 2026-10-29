/* Componentes de interfaz compartidos */
import { icon, logo } from "./icons.js";
import { esc, initials, hashStr, $, $$ } from "./util.js";
import * as S from "./store.js";
import { me, isAdmin, isStaff } from "./auth.js";

/* ------------------------------------------------------------------ tema */
const TKEY = "vientos_theme";
export function applyTheme(t) {
  const theme = t || me()?.prefs?.theme || localStorage.getItem(TKEY) || "dark";
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f3f2ef" : "#0a0a0b");
  try { localStorage.setItem(TKEY, theme); } catch { /* sin almacenamiento */ }
}

/* ----------------------------------------------------------------- shell */
let shellLayout = null;
const root = () => document.getElementById("app");

const TABS = [
  { id: "inicio", href: "#/inicio", icon: "home", label: "Inicio" },
  { id: "rutina", href: "#/rutina", icon: "dumbbell", label: "Mi rutina" },
  { id: "asistente", href: "#/asistente", icon: "chat", label: "Asistente" },
  { id: "progreso", href: "#/progreso", icon: "trend", label: "Progreso" },
  { id: "perfil", href: "#/perfil", icon: "user", label: "Perfil" },
];
const PANEL = [
  { id: "resumen", href: "#/panel", icon: "chart", label: "Resumen", tab: true },
  { id: "socios", href: "#/panel/socios", icon: "users", label: "Socios", tab: true },
  { id: "plantillas", href: "#/panel/plantillas", icon: "layers", label: "Plantillas", tab: true },
  { id: "ejercicios", href: "#/panel/ejercicios", icon: "dumbbell", label: "Ejercicios", tab: true },
  { id: "cuotas", href: "#/panel/cuotas", icon: "card", label: "Cuotas" },
  { id: "caja", href: "#/panel/caja", icon: "trend", label: "Ingresos y gastos", admin: true },
  { id: "avisos", href: "#/panel/avisos", icon: "bell", label: "Avisos" },
  { id: "gimnasio", href: "#/panel/gimnasio", icon: "settings", label: "Gimnasio", admin: true },
  { id: "qr", href: "#/panel/qr", icon: "qr", label: "QR de la app" },
];

export function avatar(u, size = "") {
  if (!u) return "";
  const tone = hashStr(u.name || "") % 4;
  return `<span class="av ${size} t${tone}" aria-hidden="true">${esc(initials(u.name))}</span>`;
}

/* Logo según el espacio: Vientos (vectorial) o Fitz Club (imagen) */
export const spaceLogo = (sp) => (sp === "fitz" ? `<img class="logo fitz-logo" src="img/fitz-logo.png" alt="Fitz Club" width="194" height="143">` : logo());
const brand = (href, sp = "vientos") => `<a class="brand ${sp === "fitz" ? "is-fitz" : ""}" href="${href}" aria-label="${sp === "fitz" ? "Fitz Club" : "Grupo Amplifia"}, inicio">${spaceLogo(sp)}</a>`;
/* En Fitz Club las plantillas son programas por semanas */
const navLabel = (n) => (n.id === "plantillas" && S.currentSpace() === "fitz" ? "Programas" : n.label);
/* Selector de negocio: solo lo ve el proveedor de la plataforma */
function spaceSwitch(cls = "") {
  if (!S.isProvider()) return "";
  const cur = S.currentSpace();
  return `<div class="space-sw ${cls}" role="group" aria-label="Negocio">${S.SPACES.map((s) => `<button type="button" class="${s.id === cur ? "on" : ""}" data-space-set="${s.id}" aria-pressed="${s.id === cur}">${esc(s.short)}</button>`).join("")}</div>`;
}
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-space-set]");
    if (!b || b.classList.contains("on")) return;
    S.setCurrentSpace(b.dataset.spaceSet);
    if (location.hash !== "#/panel") location.hash = "#/panel";
    else dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

function panelSide() {
  const u = me();
  const items = PANEL.filter((n) => !n.admin || isAdmin());
  const pend = S.pending().filter((m) => S.inSpace(m)).length;
  return `<aside class="side" aria-label="Panel">
    ${brand("#/panel", S.currentSpace())}
    <span class="side-tag">Panel del ${u.role === "admin" ? "gimnasio" : "entrenador"}</span>
    ${spaceSwitch()}
    <nav class="side-nav">${items.map((n) => `<a class="side-link" data-nav="${n.id}" href="${n.href}">${icon(n.icon)}<span>${navLabel(n)}</span>${n.id === "socios" && pend ? `<b class="count">${pend}</b>` : ""}</a>`).join("")}</nav>
    <div class="side-foot">
      <a class="side-me" href="#/panel/cuenta">${avatar(u)}<span><b>${esc(u.name)}</b><small>${u.role === "admin" ? "Administración" : "Entrenador"}</small></span></a>
      ${S.MODE === "demo" ? `<span class="demo-pill">${icon("info", "sm")} Demostración</span>` : ""}
    </div>
  </aside>`;
}

function panelTabs() {
  const pend = S.pending().filter((m) => S.inSpace(m)).length;
  return `<nav class="tabbar" aria-label="Panel">${PANEL.filter((n) => n.tab).map((n) => `<a data-nav="${n.id}" href="${n.href}">${icon(n.icon)}<span>${navLabel(n)}</span>${n.id === "socios" && pend ? `<b class="dot"></b>` : ""}</a>`).join("")}<a data-nav="mas" href="#/panel/mas">${icon("dots")}<span>Más</span></a></nav>`;
}

function memberTabs() {
  const live = S.session(me().id);
  return `<nav class="tabbar" aria-label="Navegación">${TABS.map((t) => `<a data-nav="${t.id}" href="${t.href}">${icon(t.icon)}<span>${t.label}</span>${t.id === "rutina" && live ? `<b class="dot"></b>` : ""}</a>`).join("")}</nav>`;
}

export function shell(layout, nav) {
  const r = root();
  if (layout !== shellLayout || layout === "app" || layout === "panel") {
    shellLayout = layout;
    if (layout === "auth" || layout === "focus" || layout === "print") {
      r.className = "layout-" + layout;
      r.innerHTML = `<main id="view" class="view"></main>`;
    } else if (layout === "panel") {
      r.className = "layout-panel";
      r.innerHTML = `${panelSide()}<div class="panel-main"><header class="ptop">${brand("#/panel", S.currentSpace())}${spaceSwitch("sm")}<a class="ptop-me" href="#/panel/cuenta" aria-label="Mi cuenta">${avatar(me(), "sm")}</a></header><main id="view" class="view"></main></div>${panelTabs()}`;
    } else {
      r.className = "layout-app";
      r.innerHTML = `<main id="view" class="view"></main>${memberTabs()}`;
    }
  }
  $$("[data-nav]", r).forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
  /* Colores del espacio: el panel según el espacio elegido; el socio según el suyo */
  const u = me();
  document.documentElement.dataset.space = u ? S.currentSpace() : "vientos";
  return $("#view", r);
}

/* Encabezado de pantalla con volver */
export function pageHead({ back, title, kicker = "", actions = "" }) {
  return `<header class="phead">
    ${back ? `<a class="icon-btn" href="${back}" aria-label="Volver">${icon("back")}</a>` : ""}
    <div class="phead-t">${kicker ? `<span class="kicker">${esc(kicker)}</span>` : ""}<h1>${esc(title)}</h1></div>
    ${actions ? `<div class="phead-a">${actions}</div>` : ""}
  </header>`;
}

/* ----------------------------------------------------------------- toast */
export function toast(msg, kind = "ok") {
  let host = document.getElementById("toasts");
  if (!host) { host = document.createElement("div"); host.id = "toasts"; host.setAttribute("role", "status"); document.body.appendChild(host); }
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.innerHTML = `${icon(kind === "err" ? "alert" : "checkc")}<span>${esc(msg)}</span>`;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => { t.classList.remove("in"); setTimeout(() => t.remove(), 300); }, 2800);
}

/* ------------------------------------------- hoja inferior / ventana modal */
export function sheet({ title = "", html, wide = false, onMount, onClose } = {}) {
  const prev = document.activeElement;
  const el = document.createElement("div");
  el.className = "sheet-wrap";
  el.innerHTML = `<div class="sheet-bg" data-close></div>
    <section class="sheet ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="sheet-h"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Cerrar">${icon("x")}</button></header>
      <div class="sheet-b">${html}</div>
    </section>`;
  document.body.appendChild(el);
  document.body.classList.add("no-scroll");
  requestAnimationFrame(() => el.classList.add("in"));
  const close = () => {
    el.classList.remove("in");
    document.body.classList.remove("no-scroll");
    removeEventListener("keydown", onKey);
    setTimeout(() => el.remove(), 260);
    onClose?.();
    prev?.focus?.();
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  addEventListener("keydown", onKey);
  el.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  onMount?.(el.querySelector(".sheet-b"), close);
  setTimeout(() => el.querySelector("input:not([type=hidden]),select,textarea,button:not([data-close])")?.focus({ preventScroll: true }), 60);
  return close;
}

export function confirmDialog({ title, text = "", ok = "Confirmar", danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    sheet({
      title,
      html: `${text ? `<p class="muted">${esc(text)}</p>` : ""}<div class="row-btns"><button class="btn ghost" type="button" data-close>Cancelar</button><button class="btn ${danger ? "danger" : "primary"}" type="button" data-ok>${esc(ok)}</button></div>`,
      onMount: (b, close) => b.querySelector("[data-ok]").addEventListener("click", () => { done = true; resolve(true); close(); }),
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

/* ---------------------------------------------------------- formularios */
export function field({ label, name, type = "text", value = "", ph = "", req = false, hint = "", attrs = "", options = null }) {
  const v = esc(value ?? "");
  let input;
  if (options) input = `<select name="${name}" ${req ? "required" : ""} ${attrs}>${options.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(value) ? "selected" : ""}>${esc(lab)}</option>`; }).join("")}</select>`;
  else if (type === "textarea") input = `<textarea name="${name}" placeholder="${esc(ph)}" ${req ? "required" : ""} ${attrs}>${v}</textarea>`;
  else input = `<input name="${name}" type="${type}" value="${v}" placeholder="${esc(ph)}" ${req ? "required" : ""} ${attrs}>`;
  return `<label class="field"><span>${esc(label)}</span>${input}${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
}
/* Fecha para escribir con el teclado numérico: DD / MM / AAAA.
   Al completar cada parte salta a la siguiente. El valor (AAAA-MM-DD) viaja en
   un campo oculto con el mismo nombre, así formData() lo lee igual que antes. */
export function dateField({ label, name, value = "", req = false, hint = "" }) {
  const [y = "", m = "", d = ""] = String(value || "").split("-");
  return `<div class="field datef" data-datef ${req ? "data-req" : ""}><span>${esc(label)}</span>
    <div class="datef-in">
      <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="DD" data-p="d" value="${esc(d)}" autocomplete="off" aria-label="${esc(label)}: día">
      <i aria-hidden="true">/</i>
      <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="MM" data-p="m" value="${esc(m)}" autocomplete="off" aria-label="${esc(label)}: mes">
      <i aria-hidden="true">/</i>
      <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="AAAA" data-p="y" value="${esc(y)}" autocomplete="off" aria-label="${esc(label)}: año">
      <input type="hidden" name="${esc(name)}" value="${esc(value || "")}">
    </div>${hint ? `<small>${esc(hint)}</small>` : ""}</div>`;
}
const pad2 = (n) => String(n).padStart(2, "0");
function syncDate(box) {
  const g = (p) => box.querySelector(`[data-p=${p}]`).value;
  const d = +g("d"), m = +g("m"), y = +g("y");
  const t = new Date(y, m - 1, d);
  const ok = g("y").length === 4 && d >= 1 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100 && t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
  box.querySelector("input[type=hidden]").value = ok ? `${y}-${pad2(m)}-${pad2(d)}` : "";
  box.classList.toggle("bad", !ok && !!(g("d") || g("m") || g("y")) && g("y").length === 4);
}
if (typeof document !== "undefined") {
  document.addEventListener("input", (e) => {
    const inp = e.target.closest?.("[data-datef] [data-p]");
    if (!inp) return;
    const box = inp.closest("[data-datef]");
    const max = inp.dataset.p === "y" ? 4 : 2;
    inp.value = inp.value.replace(/\D/g, "").slice(0, max);
    /* un día o mes que ya no puede crecer (ej. 4 → 04, 2 → 02) salta solo al siguiente */
    const next = { d: "m", m: "y" }[inp.dataset.p];
    const first = +inp.value[0];
    const full = inp.value.length === max || (inp.dataset.p === "d" && first >= 4) || (inp.dataset.p === "m" && first >= 2);
    if (next && inp.value && full && e.inputType !== "deleteContentBackward") {
      if (inp.value.length === 1) inp.value = "0" + inp.value;
      box.querySelector(`[data-p=${next}]`).focus();
    }
    syncDate(box);
  });
  document.addEventListener("keydown", (e) => {
    const inp = e.target.closest?.("[data-datef] [data-p]");
    if (!inp || e.key !== "Backspace" || inp.value) return;
    const prev = { m: "d", y: "m" }[inp.dataset.p];
    if (prev) { e.preventDefault(); const p = inp.closest("[data-datef]").querySelector(`[data-p=${prev}]`); p.focus(); p.value = p.value.slice(0, -1); syncDate(inp.closest("[data-datef]")); }
  });
  document.addEventListener("focusin", (e) => { if (e.target.matches?.("[data-datef] [data-p]")) setTimeout(() => { if (document.activeElement === e.target) e.target.select?.(); }, 0); });
}

/* Listas largas: se muestran de a pocas con "Ver más (N restantes)". Pensado para
   100, 500 o más registros: nunca se apilan todos uno debajo del otro.
   `itemSel` son los elementos de la lista; los que ya están ocultos por un filtro propio ([data-off]) no cuentan. */
export function limitList(container, { size = 30, itemSel = ":scope > *" } = {}) {
  if (!container) return { apply() {} };
  let shown = size;
  let btn = container.parentElement?.querySelector(":scope > [data-limit-more]");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn ghost block"; btn.setAttribute("data-limit-more", "");
    container.after(btn);
    btn.addEventListener("click", () => { shown += size; apply(); });
  }
  function apply(reset = false) {
    if (reset) shown = size;
    const items = [...container.querySelectorAll(itemSel)].filter((el) => !el.hasAttribute("data-off"));
    let n = 0;
    container.querySelectorAll(itemSel).forEach((el) => { if (el.hasAttribute("data-off")) { el.hidden = true; return; } el.hidden = n++ >= shown; });
    btn.hidden = items.length <= shown;
    btn.textContent = `Ver más (${items.length - shown} restantes)`;
  }
  apply();
  return { apply };
}

export const formData = (form) => Object.fromEntries(new FormData(form).entries());

export function empty(ic, title, text = "", action = "") {
  return `<div class="empty">${icon(ic)}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ""}${action}</div>`;
}

export const tag = (t, cls = "") => `<span class="tag ${cls}">${esc(t)}</span>`;

/* Pastilla del estado de la cuota */
export function feePill(u) {
  const f = S.feeStatus(u);
  const cls = { ok: "ok", soon: "warn", late: "bad", none: "" }[f.state];
  return `<span class="pill ${cls}">${esc(f.label)}</span>`;
}

export { isStaff };

/* Utilidades generales de la app */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

export const uid = (p = "id") => p + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* PRNG determinístico (mulberry32) para los datos de demostración */
export function rng(seed) {
  let a = typeof seed === "number" ? seed : hashStr(String(seed));
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const slugify = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const DAY = 86400000;

export function fmtDate(ts, opts = {}) {
  const d = new Date(ts);
  if (opts.short) return `${d.getDate()} ${MON[d.getMonth()]}`;
  if (opts.year) return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}
export const fmtWeekday = (ts) => DAYS[new Date(ts).getDay()];

export function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function fmtRest(sec) {
  sec = Math.round(sec || 0);
  if (!sec) return "sin descanso";
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? `${m}:${String(s).padStart(2, "0")} min` : `${m} min`;
}
export const fmtNum = (n, dec = 0) => Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: dec });
export const fmtKg = (n) => (n || n === 0 ? `${fmtNum(n, 1)} kg` : "—");

export function relDay(ts) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(ts); b.setHours(0, 0, 0, 0);
  const d = Math.round((b - a) / DAY);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d === -1) return "ayer";
  if (d > 1 && d < 7) return `en ${d} días`;
  if (d < -1 && d > -7) return `hace ${-d} días`;
  return fmtDate(ts);
}
export const daysUntil = (ts) => {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(ts); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / DAY);
};

export const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/* Lunes de la semana de ts (00:00) */
export function weekStart(ts = Date.now()) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const wd = (d.getDay() + 6) % 7;
  return d.getTime() - wd * DAY;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 6 ? "Buenas noches" : h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

export const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
export const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function countUp(el, to, { dur = 650, dec = 0, suffix = "" } = {}) {
  if (reducedMotion() || document.visibilityState === "hidden") { el.textContent = fmtNum(to, dec) + suffix; return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtNum(to * e, dec) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* Id de un video de YouTube a partir de cualquier formato de enlace */
export function ytId(url) {
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

/* Número de teléfono argentino a formato internacional para WhatsApp (sin +) */
export function waNumber(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("54")) return d;
  d = d.replace(/^0/, "");
  const m = d.match(/^(\d{2,4}?)15(\d{6,8})$/);
  if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2];
  return "549" + d;
}
export const telHref = (raw) => "tel:+" + waNumber(raw).replace(/^549/, "54");

export function vibrate(p) { try { navigator.vibrate?.(p); } catch { /* sin vibración */ } }

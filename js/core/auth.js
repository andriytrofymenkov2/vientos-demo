/* Sesión.
   · "Recordarme en este dispositivo": la sesión queda guardada (localStorage).
   · Sin recordarme: dura mientras la app esté abierta (sessionStorage). */
import * as S from "./store.js";

const SKEY = "vientos_session";
const LKEY = "vientos_lock";
const MAX_TRIES = 5, LOCK_MS = 60_000;

let current = null;

export function restore() {
  try {
    const raw = sessionStorage.getItem(SKEY) || localStorage.getItem(SKEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const u = S.user(s.uid);
    if (!u || u.status !== "activo") { logout(); return null; }
    current = u;
    return u;
  } catch { return null; }
}

export const me = () => current;
export const isStaff = () => current?.role === "profe" || current?.role === "admin";
export const isAdmin = () => current?.role === "admin";

function lockState() {
  try { return JSON.parse(localStorage.getItem(LKEY) || '{"n":0,"until":0}'); } catch { return { n: 0, until: 0 }; }
}

export async function login(identifier, pass, remember) {
  const l = lockState();
  if (l.until > Date.now()) throw new Error(`Demasiados intentos. Probá de nuevo en ${Math.ceil((l.until - Date.now()) / 1000)} s.`);
  const u = await S.api.login(identifier, pass);
  if (!u) {
    l.n = (l.n || 0) + 1;
    if (l.n >= MAX_TRIES) { l.until = Date.now() + LOCK_MS; l.n = 0; }
    localStorage.setItem(LKEY, JSON.stringify(l));
    /* Mismo mensaje para usuario inexistente o contraseña incorrecta */
    throw new Error("Usuario o contraseña incorrectos.");
  }
  if (u.status === "pendiente") throw new Error("Tu cuenta todavía no fue aprobada. Te avisamos apenas un profe la habilite.");
  localStorage.setItem(LKEY, JSON.stringify({ n: 0, until: 0 }));
  start(u, remember);
  return u;
}

export function start(u, remember = false) {
  current = u;
  const s = JSON.stringify({ uid: u.id, at: Date.now() });
  (remember ? localStorage : sessionStorage).setItem(SKEY, s);
  (remember ? sessionStorage : localStorage).removeItem(SKEY);
}

export function remembered() { return !!localStorage.getItem(SKEY); }
export function setRemember(on) {
  if (!current) return;
  start(current, on);
}

export function logout() {
  current = null;
  sessionStorage.removeItem(SKEY);
  localStorage.removeItem(SKEY);
}

export function passwordIssues(p) {
  const out = [];
  if (p.length < 8) out.push("al menos 8 caracteres");
  if (!/[A-ZÁÉÍÓÚÑ]/.test(p) || !/[a-záéíóúñ]/.test(p)) out.push("mayúsculas y minúsculas");
  if (!/\d/.test(p)) out.push("al menos un número");
  return out;
}

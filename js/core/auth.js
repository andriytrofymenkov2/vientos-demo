/* Sesión.
   · "Recordarme en este dispositivo": la sesión queda guardada (localStorage).
   · Sin recordarme: dura mientras la app esté abierta (sessionStorage).
   · Con servidor (Supabase) la sesión la maneja Supabase Auth: contraseñas
     cifradas en el servidor y tokens que vencen y se renuevan solos. */
import * as S from "./store.js";

const SKEY = "vientos_session";
const LKEY = "vientos_lock";
const MAX_TRIES = 5, LOCK_MS = 60_000;

let current = null;
const server = () => S.MODE === "supabase";

export function restore() {
  if (server()) {
    const u = S.db.me ? S.user(S.db.me) : null;
    current = u && u.status === "activo" ? u : null;
    return current;
  }
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
/* Después de traer datos nuevos del servidor, apunta al usuario actualizado */
export function refreshMe() {
  if (!current) return null;
  const u = S.user(current.id);
  current = u && u.status === "activo" ? u : null;
  return current;
}
export const isStaff = () => current?.role === "profe" || current?.role === "admin";
export const isAdmin = () => current?.role === "admin";

function lockState() {
  try { return JSON.parse(localStorage.getItem(LKEY) || '{"n":0,"until":0}'); } catch { return { n: 0, until: 0 }; }
}

export async function login(identifier, pass, remember) {
  const l = lockState();
  if (l.until > Date.now()) throw new Error(`Demasiados intentos. Probá de nuevo en ${Math.ceil((l.until - Date.now()) / 1000)} s.`);
  if (server()) S.remote().rememberSession(remember);
  const u = await S.api.login(identifier, pass);
  if (!u) {
    l.n = (l.n || 0) + 1;
    if (l.n >= MAX_TRIES) { l.until = Date.now() + LOCK_MS; l.n = 0; }
    localStorage.setItem(LKEY, JSON.stringify(l));
    /* Mismo mensaje para usuario inexistente o contraseña incorrecta */
    throw new Error("Usuario o contraseña incorrectos.");
  }
  if (u.status !== "activo") {
    if (server()) await S.remote().logout();
    throw new Error(u.status === "pendiente" ? "Tu cuenta todavía no fue aprobada. Te avisamos apenas un profe la habilite." : "Tu cuenta está dada de baja. Consultá en el gimnasio.");
  }
  localStorage.setItem(LKEY, JSON.stringify({ n: 0, until: 0 }));
  start(u, remember);
  return u;
}

export function start(u, remember = false) {
  current = u;
  if (server()) { S.remote().rememberSession(remember); return; }
  const s = JSON.stringify({ uid: u.id, at: Date.now() });
  (remember ? localStorage : sessionStorage).setItem(SKEY, s);
  (remember ? sessionStorage : localStorage).removeItem(SKEY);
}

export function remembered() { return server() ? S.remote().remembered() : !!localStorage.getItem(SKEY); }
export function setRemember(on) {
  if (!current) return;
  start(current, on);
}

export function logout() {
  current = null;
  sessionStorage.removeItem(SKEY);
  localStorage.removeItem(SKEY);
  if (server()) return S.remote()?.logout();
}

export function passwordIssues(p) {
  const out = [];
  if (p.length < 8) out.push("al menos 8 caracteres");
  if (!/[A-ZÁÉÍÓÚÑ]/.test(p) || !/[a-záéíóúñ]/.test(p)) out.push("mayúsculas y minúsculas");
  if (!/\d/.test(p)) out.push("al menos un número");
  return out;
}

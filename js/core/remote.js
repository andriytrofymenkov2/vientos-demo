/* =========================================================================
   ADAPTADOR SUPABASE
   Traduce entre las tablas de supabase/01_esquema.sql y el objeto `db` que
   usan las pantallas. Solo se carga cuando la app está en modo "supabase".
   Seguridad: usa la clave "anon" (pública). Lo que cada uno puede ver o tocar
   lo deciden las políticas del servidor, no este archivo.
   ========================================================================= */
import { CONFIG } from "../config.js";
import * as S from "./store.js";

const NOREM = "vientos_norem";          /* "recordarme" apagado → sesión solo mientras la app esté abierta */
let sb = null;
let errorHandler = (msg) => console.error(msg);
let infoHandler = (msg) => console.info(msg);

/* La sesión se guarda en localStorage (recordarme) o sessionStorage (no recordarme) */
const store = () => (localStorage.getItem(NOREM) ? sessionStorage : localStorage);
const authStorage = {
  getItem: (k) => store().getItem(k),
  setItem: (k, v) => store().setItem(k, v),
  removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
};

function loadLib() {
  if (window.supabase?.createClient) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "vendor/supabase.js";
    s.onload = res;
    s.onerror = () => rej(new Error("No se pudo cargar la conexión con el servidor."));
    document.head.appendChild(s);
  });
}

const ms = (t) => (t ? Date.parse(t) : 0);
const iso = (n) => new Date(n || Date.now()).toISOString();
const must = ({ data, error }) => { if (error) throw error; return data; };

/* Mensajes claros en vez de los errores técnicos del servidor */
function friendly(err) {
  const m = String(err?.message || err || "");
  if (/código del gimnasio/i.test(m)) return "El código del gimnasio no es correcto. Pedilo en recepción.";
  if (/already registered|already been registered|duplicate key.*(email|username)/i.test(m)) return "Ya hay una cuenta con ese email.";
  if (/Database error saving new user/i.test(m)) return "No se pudo crear la cuenta. Revisá el código del gimnasio.";
  if (/Demasiados intentos/i.test(m)) return "Demasiados intentos. Esperá 15 minutos.";
  if (/password.*(short|least|weak)/i.test(m)) return "La contraseña es muy débil: usá al menos 8 caracteres con letras y números.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sin conexión. Revisá internet y volvé a intentar.";
  if (/JWT|session|not authenticated/i.test(m)) return "Tu sesión venció. Ingresá de nuevo.";
  if (/permission|policy|row-level/i.test(m)) return "No tenés permiso para hacer eso.";
  return m || "Ocurrió un error con el servidor.";
}

function emptyDb() {
  const d = S.defaults();
  return { v: 4, gym: d.gym, plans: d.plans, exercises: [], templates: [], users: [], routines: [], logs: [], payments: [], notices: [], live: {}, me: null };
}

/* Sin sesión: datos de contacto y horarios del gimnasio (sin código ni precios) */
async function publicDb() {
  const D = emptyDb();
  try {
    const { data } = await sb.rpc("public_gym");
    if (data && typeof data === "object") D.gym = { ...D.gym, ...data, joinCode: "" };
  } catch { /* sin conexión: quedan los datos por defecto */ }
  return D;
}

/* ----------------------------------------------------------------- mapeos */
const toUser = (p) => ({
  id: p.id, role: p.role, status: p.status, name: p.name, user: p.username, email: p.email, phone: p.phone || "",
  birth: p.birth || "", gender: p.gender || "", coachId: p.coach_id, fee: p.fee, prefs: p.prefs || {}, joined: ms(p.joined),
});
const fromUser = (u) => ({
  name: u.name, phone: u.phone || "", birth: u.birth || "", gender: u.gender || "", coach_id: u.coachId || null,
  fee: u.fee || null, prefs: u.prefs || {}, status: u.status, role: u.role,
});
const strip = (o, ...keys) => { const c = { ...o }; keys.forEach((k) => delete c[k]); return c; };
const toRoutine = (r) => ({ ...r.data, id: r.id, userId: r.user_id, active: r.active });
const toLog = (r) => ({ ...r.data, id: r.id, userId: r.user_id, at: ms(r.at) });
const toPay = (r) => ({ ...r.data, id: r.id, userId: r.user_id, at: ms(r.at), amount: Number(r.amount) });

/* ------------------------------------------------------------------ carga */
/* Todos los pagos: el servidor entrega como máximo 1.000 filas por pedido, así que se piden por tandas.
   Es el historial completo: la recaudación de cada mes queda guardada para siempre. */
async function allPayments() {
  const rows = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await sb.from("payments").select("*").order("at", { ascending: false }).order("id").range(from, from + 999);
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return { data: rows, error: null };
}

async function loadAll(uid) {
  const D = emptyDb();
  const prof = must(await sb.from("profiles").select("*").eq("id", uid).maybeSingle());
  if (!prof) return D;
  D.users = [toUser(prof)];
  if (prof.status !== "activo") return D;           /* pendiente o de baja: no ve nada más */
  const staff = prof.role !== "socio";
  const q = (t) => sb.from(t).select("*");
  const since = iso(Date.now() - 150 * 86400000);

  const [gym, exercises, templates, notices, people, routines, logs, live, payments] = await Promise.all([
    q("gym").eq("id", 1).maybeSingle(),
    q("exercises"),
    staff ? q("templates") : Promise.resolve({ data: [] }),
    q("notices").order("at", { ascending: false }).limit(30),
    q("profiles"),
    q("routines"),
    staff ? q("logs").gte("at", since).order("at", { ascending: false }).limit(5000) : q("logs").eq("user_id", uid).order("at", { ascending: false }).limit(1000),
    q("live"),
    staff ? allPayments() : q("payments").eq("user_id", uid),
  ]).then((rs) => rs.map(must));

  /* Primer ingreso de un profe o del dueño: carga ejercicios, plantillas y datos del gimnasio */
  if (staff && (!gym || !exercises.length)) await firstSetup(prof, gym, exercises, templates);
  const fresh = staff && (!gym || !exercises.length);
  const g = fresh ? must(await q("gym").eq("id", 1).maybeSingle()) : gym;
  const ex = fresh ? must(await q("exercises")) : exercises;
  const tp = fresh ? must(await q("templates")) : templates;

  if (g?.data) { const { plans, ...rest } = g.data; D.gym = { ...D.gym, ...rest }; if (plans?.length) D.plans = plans; }
  D.exercises = ex.map((r) => ({ ...r.data, id: r.id })).sort((a, b) => a.n.localeCompare(b.n, "es"));
  D.templates = tp.map((r) => ({ ...r.data, id: r.id, createdBy: r.created_by })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  D.notices = notices.map((r) => ({ ...r.data, id: r.id, at: ms(r.at) }));
  D.users = people.map(toUser);
  D.routines = routines.map(toRoutine);
  D.logs = logs.map(toLog);
  D.live = Object.fromEntries(live.map((r) => [r.user_id, r.data]));
  D.payments = payments.map(toPay);
  D.me = uid;
  return D;
}

async function firstSetup(prof, gym, exercises, templates) {
  const d = S.defaults();
  if (!gym && prof.role === "admin") must(await sb.from("gym").upsert({ id: 1, data: { ...d.gym, plans: d.plans } }));
  if (!exercises.length) must(await sb.from("exercises").upsert(d.exercises.map((e) => ({ id: e.id, data: strip(e, "id") }))));
  if (!templates.length) must(await sb.from("templates").upsert(d.templates.map((t) => ({ id: t.id, data: strip(t, "id", "createdBy"), created_by: null }))));
}

/* ------------------------------------------------------- cola de envíos
   Todo lo que se guarda (series, entrenamientos, pagos, rutinas...) entra
   primero a una cola guardada en el celular y recién se borra de ahí cuando
   el servidor confirma. Si no hay señal, se reintenta solo: al volver la
   conexión, al abrir la app o cada tanto. No se pierde nada. */
const OUTBOX = "vientos_outbox";
const CACHE = "vientos_cache";
const readBox = () => { try { return JSON.parse(localStorage.getItem(OUTBOX) || "[]"); } catch { return []; } };
const writeBox = (b) => { try { localStorage.setItem(OUTBOX, JSON.stringify(b)); } catch (e) { console.warn("No se pudo guardar la cola", e); } };
const pendingFor = (uid) => readBox().filter((x) => x.uid === uid).length;
const LIVE = ["saveLive", "deleteLive"];

/* Error de conexión (se reintenta) o error real (se avisa) */
const isNetwork = (e) => !navigator.onLine || e?.status === 0 || e?.status >= 500
  || /Failed to fetch|NetworkError|Load failed|network|timed? ?out|aborted|JWT expired/i.test(String(e?.message || e || ""));
/* Si el servidor ya lo tenía (se mandó pero no llegó la respuesta), está bien */
const isDuplicate = (e) => e?.code === "23505" || /duplicate key/i.test(String(e?.message || ""));

let flushing = null, retryT = 0, retryN = 0, offline = false, staleLocal = false;

function send(fn, args) {
  const uid = S.db?.me;
  if (!uid) return;
  if (fn === "saveGym" && !args.length) args = [{ ...S.db.gym, plans: S.db.plans }];
  let box = readBox();
  /* del entrenamiento en curso alcanza con mandar el último estado */
  if (LIVE.includes(fn)) box = box.filter((x) => !(LIVE.includes(x.fn) && x.uid === uid && x.args[0] === args[0]));
  box.push({ k: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), uid, fn, args: JSON.parse(JSON.stringify(args)) });
  writeBox(box);
  clearTimeout(retryT);
  retryT = setTimeout(flush, fn === "saveLive" ? 700 : 0);   /* las series se agrupan: no un pedido por toque */
}

function retryLater() {
  clearTimeout(retryT);
  retryN = Math.min(retryN + 1, 5);
  retryT = setTimeout(flush, 2500 * 2 ** retryN);            /* 5 s, 10 s, 20 s... hasta 80 s */
  if (!offline) { offline = true; infoHandler("Sin señal: lo que anotes queda guardado en el celular y se envía solo cuando vuelva la conexión."); }
}

function flush() {
  if (flushing || !sb) return flushing || Promise.resolve();
  flushing = (async () => {
    clearTimeout(retryT);
    let uid = null;
    try { uid = (await sb.auth.getSession()).data.session?.user?.id; } catch { /* sin señal */ }
    if (!uid) { if (pendingFor(S.db?.me)) retryLater(); return; }
    let sent = 0;
    for (;;) {
      const item = readBox().find((x) => x.uid === uid);
      if (!item) break;
      try { await remoteAdapter[item.fn](...item.args); sent++; }
      catch (e) {
        if (!isDuplicate(e)) {
          if (isNetwork(e)) { retryLater(); return; }
          console.warn("No se guardó", item.fn, e);
          errorHandler(friendly(e));                       /* error real (permiso, dato inválido): no se reintenta */
        }
      }
      writeBox(readBox().filter((x) => x.k !== item.k));
    }
    retryN = 0;
    if (offline) { offline = false; if (sent) infoHandler("Listo: ya se envió todo lo que anotaste sin señal."); }
    if (staleLocal) { staleLocal = false; try { await remoteAdapter.reload(); } catch { /* después */ } }
  })().finally(() => { flushing = null; });
  return flushing;
}
addEventListener("online", () => flush());
addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") flush(); });

/* Copia de los datos del socio en el celular: si abre la app sin señal (o
   quedó algo sin enviar) ve igual su rutina y sus kilos. Solo socios. */
let cacheT = 0;
function writeCache() {
  clearTimeout(cacheT);
  cacheT = setTimeout(() => {
    const d = S.db, u = d?.me && d.users.find((x) => x.id === d.me);
    if (!u || u.role !== "socio" || u.status !== "activo") return;
    try { localStorage.setItem(CACHE, JSON.stringify({ uid: d.me, at: Date.now(), db: d })); } catch { /* sin espacio */ }
  }, 400);
}
const readCache = (uid) => { try { const c = JSON.parse(localStorage.getItem(CACHE) || "null"); return c?.uid === uid ? c.db : null; } catch { return null; } };
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

export const remoteAdapter = {
  async boot() {
    await loadLib();
    sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { storage: authStorage, storageKey: "vientos-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    S.onChange(writeCache);
    const { data } = await sb.auth.getSession();
    if (!data.session) return publicDb();
    const uid = data.session.user.id;
    await withTimeout(flush(), 6000);                    /* primero lo que quedó sin enviar */
    const cached = readCache(uid);
    try {
      const D = await loadAll(uid);
      if (pendingFor(uid) && cached) { staleLocal = true; retryLater(); return cached; }   /* lo del celular es más nuevo */
      return D;
    } catch (e) {
      console.warn(e);
      if (cached && isNetwork(e)) { retryLater(); return cached; }
      errorHandler(friendly(e));
      return emptyDb();
    }
  },

  send,
  flush,
  pending: () => pendingFor(S.db?.me),

  /* Vuelve a traer todo del servidor (rutinas nuevas, socios, avisos...).
     El entrenamiento en curso de este celular se conserva: es más nuevo que el del servidor. */
  async reload() {
    const uid = S.db.me;
    if (!uid) return false;
    await flush();
    if (pendingFor(uid)) throw new Error("Sin conexión");  /* no pisar lo que todavía no se envió */
    const mine = S.db.live[uid];
    const D = await loadAll(uid);
    if (mine) D.live[uid] = mine;
    S.setDb(D);
    return true;
  },

  async login(ident, pass) {
    let email = ident.trim().toLowerCase();
    if (!email.includes("@")) {
      const { data, error } = await sb.rpc("login_email", { p_ident: email, p_pass: pass });
      if (error) throw new Error(friendly(error));
      if (!data) return null;
      email = data;
    }
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) { if (/Invalid login|invalid_credentials/i.test(error.message)) return null; throw new Error(friendly(error)); }
    const D = await loadAll(data.user.id);
    S.setDb(D);
    return S.user(data.user.id) || null;
  },

  /* Alta desde la app: queda pendiente hasta que un profe la apruebe */
  async register({ name, email, phone, pass, code }) {
    const { error } = await sb.auth.signUp({ email: email.trim().toLowerCase(), password: pass, options: { data: { name: name.trim(), phone, code } } });
    if (error) throw new Error(friendly(error));
    await sb.auth.signOut();
    S.setDb(await publicDb());
    return { status: "pendiente" };
  },

  /* El profe o el dueño crea una cuenta sin perder su propia sesión */
  async createAccount({ name, email, username, phone, birth = "", gender = "", pass, role, coachId = null, fee = null, prefs = { theme: "dark", sound: true } }) {
    const tmp = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "vientos-tmp" } });
    const { data, error } = await tmp.auth.signUp({ email: email.trim().toLowerCase(), password: pass, options: { data: { name: name.trim(), phone, username, code: S.db.gym.joinCode } } });
    if (error) throw new Error(/duplicate key.*username|profiles_username/i.test(error.message) ? "Ya hay un socio con ese DNI." : friendly(error));
    const id = data.user?.id;
    if (!id) throw new Error("No se pudo crear la cuenta.");
    const row = must(await sb.from("profiles").update({ status: "activo", role, coach_id: coachId, fee, birth, gender, prefs }).eq("id", id).select().single());
    return toUser(row);
  },

  async saveProfile(u) { must(await sb.from("profiles").update(fromUser(u)).eq("id", u.id)); },
  async reject(id) { must(await sb.rpc("staff_reject", { p_user: id })); },

  async changePassword(oldPass, newPass) {
    const me = S.user(S.db.me);
    const { error } = await sb.auth.signInWithPassword({ email: me.email, password: oldPass });
    if (error) throw new Error("La contraseña actual no es correcta.");
    const r = await sb.auth.updateUser({ password: newPass });
    if (r.error) throw new Error(friendly(r.error));
  },
  async resetPassword(id, pass) { const { error } = await sb.rpc("staff_set_password", { p_user: id, p_pass: pass }); if (error) throw new Error(friendly(error)); },
  async deleteAccount() {
    const { error } = await sb.rpc("delete_my_account");
    if (error) throw new Error(friendly(error));
    const uid = S.db.me;
    writeBox(readBox().filter((x) => x.uid !== uid));
    localStorage.removeItem(CACHE);
    await sb.auth.signOut();
  },

  async saveRoutines(list) { must(await sb.from("routines").upsert(list.map((r) => ({ id: r.id, user_id: r.userId, active: !!r.active, data: strip(r, "id", "userId", "active"), updated_at: iso() })))); },
  async saveTemplate(t) { must(await sb.from("templates").upsert({ id: t.id, data: strip(t, "id", "createdBy"), created_by: t.createdBy || null, updated_at: iso() })); },
  async deleteTemplate(id) { must(await sb.from("templates").delete().eq("id", id)); },
  async saveExercise(e) { must(await sb.from("exercises").upsert({ id: e.id, data: strip(e, "id"), updated_at: iso() })); },
  async deleteExercise(id) { must(await sb.from("exercises").delete().eq("id", id)); },

  async saveLive(uid, live) { must(await sb.from("live").upsert({ user_id: uid, data: live, updated_at: iso() })); },
  async deleteLive(uid) { must(await sb.from("live").delete().eq("user_id", uid)); },
  async saveLog(l) { must(await sb.from("logs").insert({ id: l.id, user_id: l.userId, at: iso(l.at), data: strip(l, "id", "userId", "at") })); },
  async savePayment(p) { must(await sb.from("payments").insert({ id: p.id, user_id: p.userId, at: iso(p.at), amount: p.amount || 0, data: strip(p, "id", "userId", "at", "amount") })); },
  async updatePayment(p) { must(await sb.from("payments").update({ at: iso(p.at), amount: p.amount || 0, data: strip(p, "id", "userId", "at", "amount") }).eq("id", p.id)); },
  async deletePayment(id) { must(await sb.from("payments").delete().eq("id", id)); },
  async saveGym(data) { must(await sb.from("gym").upsert({ id: 1, data: data || { ...S.db.gym, plans: S.db.plans }, updated_at: iso() })); },
  async saveNotice(n) { must(await sb.from("notices").insert({ id: n.id, at: iso(n.at), data: strip(n, "id", "at") })); },
  async deleteNotice(id) { must(await sb.from("notices").delete().eq("id", id)); },

  rememberSession(remember) {
    const key = "vientos-auth";
    const v = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (remember) localStorage.removeItem(NOREM); else localStorage.setItem(NOREM, "1");
    if (v) { authStorage.removeItem(key); store().setItem(key, v); }
  },
  remembered: () => !localStorage.getItem(NOREM),

  async logout() {
    try { await sb?.auth.signOut(); } catch { /* sin conexión: igual se borra la sesión local */ }
    authStorage.removeItem("vientos-auth");
    localStorage.removeItem(CACHE);   /* lo pendiente queda en la cola y se envía cuando vuelva a entrar */
    S.setDb(await publicDb());
  },

  onError(err) { errorHandler(friendly(err)); },
  setErrorHandler(fn) { errorHandler = fn; },
  setInfoHandler(fn) { infoHandler = fn; },
};

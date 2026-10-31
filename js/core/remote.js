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
  return { v: 4, gym: d.gym, plans: d.plans, exercises: [], templates: [], users: [], routines: [], logs: [], payments: [], notices: [], movements: [], feedback: [], faces: {}, checkins: [], live: {}, me: null };
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
/* El servidor entrega como máximo 1.000 filas por pedido: si no se piden por tandas, con muchos
   socios se perderían datos en silencio. Todo lo que puede pasar de 1.000 filas se trae completo. */
async function allRows(table, { orderBy = "id", desc = false, tie = null } = {}) {
  const rows = [];
  for (let from = 0; from < 100000; from += 1000) {
    let q = sb.from(table).select("*").order(orderBy, { ascending: !desc });
    if (tie) q = q.order(tie);             /* desempate para que ninguna fila se repita o se saltee entre tandas */
    const { data, error } = await q.range(from, from + 999);
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return { data: rows, error: null };
}
/* todas las filas desde una fecha, de a 1.000 */
async function allRowsSince(table, since) {
  const rows = [];
  for (let from = 0; from < 200000; from += 1000) {
    const { data, error } = await sb.from(table).select("*").gte("at", since).order("at").order("id").range(from, from + 999);
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return { data: rows, error: null };
}
const toFb = (r) => ({ ...r.data, id: r.id, userId: r.user_id, at: ms(r.at), kind: r.kind });
const toMove = (r) => ({ ...r.data, id: r.id, at: ms(r.at), amount: Number(r.amount), kind: r.kind });
const allPayments = () => allRows("payments", { orderBy: "at", desc: true, tie: "id" });

async function loadAll(uid) {
  const D = emptyDb();
  const prof = must(await sb.from("profiles").select("*").eq("id", uid).maybeSingle());
  if (!prof) return D;
  D.users = [toUser(prof)];
  if (prof.status !== "activo") return D;           /* pendiente o de baja: no ve nada más */
  const staff = prof.role !== "socio";
  const q = (t) => sb.from(t).select("*");
  const since = iso(Date.now() - 150 * 86400000);

  const raw = await Promise.all([
    q("gym").eq("id", 1).maybeSingle(),
    q("exercises"),
    staff ? q("templates") : Promise.resolve({ data: [] }),
    q("notices").order("at", { ascending: false }).limit(30),
    allRows("profiles"),
    allRows("routines"),
    staff ? Promise.resolve({ data: [], error: null }) : q("logs").eq("user_id", uid).order("at", { ascending: false }).limit(1000),
    allRows("live", { orderBy: "user_id" }),
    staff ? allPayments() : q("payments").eq("user_id", uid),
    /* si todavía no se creó la tabla de caja, el dueño igual ingresa (sin caja) */
    prof.role === "admin" ? allRows("movements", { orderBy: "at", desc: true, tie: "id" }).then((r) => (r.error ? { data: [], error: null, off: true } : r)) : Promise.resolve({ data: [], error: null }),
    /* opiniones: el dueño ve todas; el socio, las suyas. Si la tabla todavía no existe, se sigue sin ellas */
    (prof.role === "admin" ? allRows("feedback", { orderBy: "at", desc: true, tie: "id" }) : prof.role === "socio" ? q("feedback").eq("user_id", uid) : Promise.resolve({ data: [], error: null })).then((r) => (r.error ? { data: [], error: null, off: true } : r)),
    /* huellas faciales: solo el personal (recepción). Si la tabla no existe, no hay reconocimiento */
    (staff ? allRows("faces", { orderBy: "user_id" }) : Promise.resolve({ data: [], error: null })).then((r) => (r.error ? { data: [], error: null, off: true } : r)),
    /* asistencia de los últimos 13 meses (el personal); si la tabla no existe, no se registra */
    (staff ? allRowsSince("checkins", iso(Date.now() - 400 * 86400000)) : Promise.resolve({ data: [], error: null })).then((r) => (r.error ? { data: [], error: null, off: true } : r)),
  ]);
  /* tablas que se suman después (caja, opiniones): si todavía no se crearon en el servidor, esas secciones no se muestran */
  const off = { caja: !!raw[9].off, opiniones: !!raw[10].off, rostros: !!raw[11].off, asistencia: !!raw[12].off };
  const [gym, exercises, templates, notices, people, routines, logs, live, payments, movements, feedback, faces, checkins] = raw.map(must);

  /* Primer ingreso de un profe o del dueño: carga ejercicios, plantillas y datos del gimnasio */
  if (staff && (!gym || !exercises.length)) await firstSetup(prof, gym, exercises, templates);
  const fresh = staff && (!gym || !exercises.length);
  const g = fresh ? must(await q("gym").eq("id", 1).maybeSingle()) : gym;
  const ex = fresh ? must(await q("exercises")) : exercises;
  const tp = fresh ? must(await q("templates")) : templates;

  /* Base cargada antes de Fitz Club (o de su última actualización): pone al día su catálogo,
     sus programas y su plan (una sola vez por versión) */
  if (prof.role === "admin" && g && !(g.data?.seeded || []).includes("fitz-2")) await seedFitz(g, ex, tp);

  if (g?.data) { const { plans, ...rest } = g.data; D.gym = { ...D.gym, ...rest }; if (plans?.length) D.plans = plans; }
  D.exercises = ex.map((r) => ({ ...r.data, id: r.id })).sort((a, b) => a.n.localeCompare(b.n, "es"));
  D.templates = tp.map((r) => ({ ...r.data, id: r.id, createdBy: r.created_by })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  D.notices = notices.map((r) => ({ ...r.data, id: r.id, at: ms(r.at) }));
  D.users = people.map(toUser);
  D.routines = routines.map(toRoutine);
  D.logs = logs.map(toLog);
  D.live = Object.fromEntries(live.map((r) => [r.user_id, r.data]));
  D.payments = payments.map(toPay);
  D.movements = (movements || []).map(toMove);
  D.feedback = (feedback || []).map(toFb);
  D.faces = Object.fromEntries((faces || []).map((r) => [r.user_id, r.data]));
  D.checkins = (checkins || []).map((r) => ({ ...r.data, id: r.id, userId: r.user_id, at: ms(r.at) }));
  D.off = off;
  D.me = uid;
  return D;
}

async function firstSetup(prof, gym, exercises, templates) {
  const d = S.defaults();
  if (!gym && prof.role === "admin") must(await sb.from("gym").upsert({ id: 1, data: { ...d.gym, plans: d.plans, seeded: ["fitz-1", "fitz-2"] } }));
  if (!exercises.length) must(await sb.from("exercises").upsert(d.exercises.map((e) => ({ id: e.id, data: strip(e, "id") }))));
  if (!templates.length) must(await sb.from("templates").upsert(d.templates.map((t) => ({ id: t.id, data: strip(t, "id", "createdBy"), created_by: null }))));
}

/* Fitz Club en una base que ya estaba en uso: carga (o pone al día) sus ejercicios y sus
   programas de base, y suma su plan si no tiene. No toca nada de Vientos ni los programas
   o ejercicios que haya creado el profe, y anota la versión para no repetirlo. */
async function seedFitz(gym, exercises, templates) {
  const d = S.defaults();
  const fx = d.exercises.filter((e) => e.space === "fitz").map((e) => ({ id: e.id, data: strip(e, "id") }));
  must(await sb.from("exercises").upsert(fx));
  const fxIds = new Set(fx.map((r) => r.id));
  exercises.splice(0, exercises.length, ...exercises.filter((r) => !fxIds.has(r.id)), ...fx);
  const ft = d.templates.filter((t) => t.space === "fitz").map((t) => ({ id: t.id, data: strip(t, "id", "createdBy"), created_by: null }));
  must(await sb.from("templates").upsert(ft));
  const ftIds = new Set(ft.map((r) => r.id));
  templates.splice(0, templates.length, ...templates.filter((r) => !ftIds.has(r.id)), ...ft);
  const plans = gym.data?.plans || d.plans;
  const add = plans.some((p) => p.space === "fitz") ? [] : d.plans.filter((p) => p.space === "fitz");
  gym.data = { ...gym.data, plans: [...plans, ...add], seeded: [...new Set([...(gym.data?.seeded || []), "fitz-1", "fitz-2"])] };
  must(await sb.from("gym").upsert({ id: 1, data: gym.data, updated_at: iso() }));
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
  /* trae del servidor el perfil y la huella facial de un socio (lo usa Recepción: el socio pudo haber
     aceptado el reconocimiento facial desde su celular después de que se abrió esta pantalla) */
  async profileByUsername(username) {
    const p = must(await sb.from("profiles").select("*").eq("username", username).maybeSingle());
    return p ? toUser(p) : null;
  },
  /* rostros que cambiaron desde la última vez (liviano: primero solo quién y cuándo); devuelve si hubo cambios */
  async syncFaces() {
    const { data, error } = await sb.from("faces").select("user_id, updated_at");
    if (error) return false;
    S.db.faces ||= {}; this._facesAt ||= {};
    const now = new Set(data.map((r) => r.user_id));
    let changed = false;
    for (const id of Object.keys(S.db.faces)) if (!now.has(id)) { delete S.db.faces[id]; delete this._facesAt[id]; changed = true; }
    const stale = data.filter((r) => !S.db.faces[r.user_id] || this._facesAt[r.user_id] !== r.updated_at).map((r) => r.user_id);
    for (let i = 0; i < stale.length; i += 100) {
      const rows = must(await sb.from("faces").select("*").in("user_id", stale.slice(i, i + 100)));
      rows.forEach((r) => { S.db.faces[r.user_id] = r.data; this._facesAt[r.user_id] = r.updated_at; });
      changed = true;
    }
    return changed;
  },
  /* todas las huellas faciales (las pudo registrar otro equipo) */
  async reloadFaces() {
    const res = await allRows("faces", { orderBy: "user_id" });
    if (!res.error) { S.db.faces = Object.fromEntries(res.data.map((x) => [x.user_id, x.data])); this._facesAt = Object.fromEntries(res.data.map((x) => [x.user_id, x.updated_at])); }
  },
  async refreshMember(id) {
    const p = must(await sb.from("profiles").select("*").eq("id", id).maybeSingle());
    if (p) { const u = S.db.users.find((x) => x.id === id); if (u) Object.assign(u, toUser(p)); else S.db.users.push(toUser(p)); }
    const f = await sb.from("faces").select("*").eq("user_id", id).maybeSingle();
    if (!f.error) { S.db.faces ||= {}; if (f.data) S.db.faces[id] = f.data.data; else delete S.db.faces[id]; }
    /* su entrada de hoy, si la registró otra computadora */
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const c = await sb.from("checkins").select("*").eq("user_id", id).gte("at", iso(d0.getTime()));
    if (!c.error) c.data.forEach((r) => { if (!S.db.checkins.some((x) => x.id === r.id)) S.db.checkins.push({ ...r.data, id: r.id, userId: r.user_id, at: ms(r.at) }); });
    return S.user(id);
  },
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

  /* El profe/dueño no descarga los entrenamientos de todos (con 500 socios serían decenas de miles):
     al abrir la ficha de un socio se piden SUS entrenamientos del último año. */
  async loadUserLogs(userId) {
    if (!S.db?.me || S.db.users.find((x) => x.id === S.db.me)?.role === "socio") return;
    const since = iso(Date.now() - 400 * 86400000);
    const rows = must(await sb.from("logs").select("*").eq("user_id", userId).gte("at", since).order("at", { ascending: false }).limit(1500));
    S.db.logs = S.db.logs.filter((l) => l.userId !== userId).concat(rows.map(toLog));
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
  async deleteRoutine(id) { must(await sb.from("routines").delete().eq("id", id)); },
  async saveExercise(e) { must(await sb.from("exercises").upsert({ id: e.id, data: strip(e, "id"), updated_at: iso() })); },
  async deleteExercise(id) { must(await sb.from("exercises").delete().eq("id", id)); },

  async saveLive(uid, live) { must(await sb.from("live").upsert({ user_id: uid, data: live, updated_at: iso() })); },
  async deleteLive(uid) { must(await sb.from("live").delete().eq("user_id", uid)); },
  async saveLog(l) { must(await sb.from("logs").insert({ id: l.id, user_id: l.userId, at: iso(l.at), data: strip(l, "id", "userId", "at") })); },
  async savePayment(p) { must(await sb.from("payments").insert({ id: p.id, user_id: p.userId, at: iso(p.at), amount: p.amount || 0, data: strip(p, "id", "userId", "at", "amount") })); },
  async updatePayment(p) { must(await sb.from("payments").update({ at: iso(p.at), amount: p.amount || 0, data: strip(p, "id", "userId", "at", "amount") }).eq("id", p.id)); },
  async deletePayment(id) { must(await sb.from("payments").delete().eq("id", id)); },
  async saveGym(data) { must(await sb.from("gym").upsert({ id: 1, data: data || { ...S.db.gym, plans: S.db.plans }, updated_at: iso() })); },
  async saveMovement(m) { must(await sb.from("movements").upsert({ id: m.id, at: iso(m.at), amount: m.amount || 0, kind: m.kind, data: strip(m, "id", "at", "amount", "kind") })); },
  async saveFeedback(f) { must(await sb.from("feedback").upsert({ id: f.id, user_id: f.userId, at: iso(f.at), kind: f.kind, data: strip(f, "id", "userId", "at", "kind") })); },
  async saveCheckin(c) {
    const r = await sb.from("checkins").insert({ id: c.id, user_id: c.userId, at: iso(c.at), data: strip(c, "id", "userId", "at") });
    /* base sin actualizar (11_varias_entradas_por_dia.sql): todavía admite una entrada por día; no es un error */
    if (r.error && r.error.code === "23505") return;
    must(r);
  },
  async saveFace(uid, f) { must(await sb.from("faces").upsert({ user_id: uid, data: f, updated_at: iso() })); },
  async deleteFace(uid) { must(await sb.from("faces").delete().eq("user_id", uid)); },
  async deleteMovement(id) { must(await sb.from("movements").delete().eq("id", id)); },
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

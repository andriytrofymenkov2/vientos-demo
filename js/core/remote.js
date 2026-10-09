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
    staff ? q("payments").gte("at", since) : q("payments").eq("user_id", uid),
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

/* Guardado del entrenamiento en curso: se agrupa para no mandar un pedido por cada toque */
const liveTimers = {};

export const remoteAdapter = {
  async boot() {
    await loadLib();
    sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { storage: authStorage, storageKey: "vientos-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    const { data } = await sb.auth.getSession();
    if (!data.session) return emptyDb();
    try { return await loadAll(data.session.user.id); }
    catch (e) { console.warn(e); errorHandler(friendly(e)); return emptyDb(); }
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
    S.setDb(emptyDb());
    return { status: "pendiente" };
  },

  /* El profe o el dueño crea una cuenta sin perder su propia sesión */
  async createAccount({ name, email, phone, pass, role, coachId = null, fee = null }) {
    const tmp = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "vientos-tmp" } });
    const { data, error } = await tmp.auth.signUp({ email: email.trim().toLowerCase(), password: pass, options: { data: { name: name.trim(), phone, code: S.db.gym.joinCode } } });
    if (error) throw new Error(friendly(error));
    const id = data.user?.id;
    if (!id) throw new Error("No se pudo crear la cuenta.");
    const row = must(await sb.from("profiles").update({ status: "activo", role, coach_id: coachId, fee }).eq("id", id).select().single());
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
  async deleteAccount() { const { error } = await sb.rpc("delete_my_account"); if (error) throw new Error(friendly(error)); await sb.auth.signOut(); },

  async saveRoutines(list) { must(await sb.from("routines").upsert(list.map((r) => ({ id: r.id, user_id: r.userId, active: !!r.active, data: strip(r, "id", "userId", "active"), updated_at: iso() })))); },
  async saveTemplate(t) { must(await sb.from("templates").upsert({ id: t.id, data: strip(t, "id", "createdBy"), created_by: t.createdBy || null, updated_at: iso() })); },
  async deleteTemplate(id) { must(await sb.from("templates").delete().eq("id", id)); },
  async saveExercise(e) { must(await sb.from("exercises").upsert({ id: e.id, data: strip(e, "id"), updated_at: iso() })); },
  async deleteExercise(id) { must(await sb.from("exercises").delete().eq("id", id)); },

  saveLive(uid, live) {
    clearTimeout(liveTimers[uid]);
    liveTimers[uid] = setTimeout(async () => {
      try { must(await sb.from("live").upsert({ user_id: uid, data: live, updated_at: iso() })); }
      catch (e) { remoteAdapter.onError(e); }
    }, 700);
  },
  async deleteLive(uid) { clearTimeout(liveTimers[uid]); must(await sb.from("live").delete().eq("user_id", uid)); },
  async saveLog(l) { must(await sb.from("logs").insert({ id: l.id, user_id: l.userId, at: iso(l.at), data: strip(l, "id", "userId", "at") })); },
  async savePayment(p) { must(await sb.from("payments").insert({ id: p.id, user_id: p.userId, at: iso(p.at), amount: p.amount || 0, data: strip(p, "id", "userId", "at", "amount") })); },
  async saveGym() { must(await sb.from("gym").upsert({ id: 1, data: { ...S.db.gym, plans: S.db.plans }, updated_at: iso() })); },
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
    S.setDb(emptyDb());
  },

  onError(err) { errorHandler(friendly(err)); },
  setErrorHandler(fn) { errorHandler = fn; },
};

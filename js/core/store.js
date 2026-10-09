/* =========================================================================
   STORE — capa de datos de la app
   · Modo DEMO: todo vive en el localStorage de este navegador, con datos de
     ejemplo. Sirve para mostrar el producto; no apto para socios reales.
   · Modo SUPABASE (próxima etapa): mismo objeto `db` y mismas funciones, con
     los datos en el servidor.
   ========================================================================= */
import { EXERCISES } from "../data/exercises.js";
import { TEMPLATES } from "../data/templates.js";
import { buildDemo } from "../data/demo.js";
import { uid, sha256, DAY, weekStart, dayKey, fold } from "./util.js";
import { CONFIG } from "../config.js";

const KEY = "vientos_db_v3";
export const MODE = "demo";
void CONFIG;

export let db = null;
const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

let saveT = 0;
export function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn("No se pudo guardar", e); }
  }, 60);
  listeners.forEach((fn) => fn());
}

export async function init() {
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { db = null; }
  if (!db || db.v !== 3) { db = await seed(); localStorage.setItem(KEY, JSON.stringify(db)); }
  return db;
}

export async function resetDemo() {
  localStorage.removeItem(KEY);
  db = await seed();
  localStorage.setItem(KEY, JSON.stringify(db));
}

/* ------------------------------------------------------------ normalizar */
export function normDays(days, prefix = "d") {
  return days.map((d, di) => ({
    id: d.id || uid(prefix),
    name: d.name || `Día ${di + 1}`,
    focus: d.focus || "",
    blocks: (d.blocks || []).map((b) => ({
      id: b.id || uid("b"),
      type: b.type || "single",
      rest: b.rest ?? 0,
      items: b.items.map((i) => ({ id: i.id || uid("i"), ex: i.ex, sets: +i.sets || 1, reps: String(i.reps ?? ""), kg: i.kg ?? null, rest: i.rest ?? 60, note: i.note || "" })),
    })),
  }));
}

export async function hashPass(pass, salt) { return sha256(salt + ":" + pass); }

async function seed() {
  const templates = TEMPLATES.map((t, i) => ({
    id: "t-" + t.key, key: t.key, name: t.name, level: t.level, audience: t.audience, goal: t.goal, weeks: t.weeks, desc: t.desc,
    days: normDays(t.days), order: i, createdBy: null, updated: Date.now(),
  }));
  const base = {
    v: 3, seededAt: Date.now(),
    gym: {
      name: "Vientos GYM",
      address: "Pellegrini 545",
      city: "Río Gallegos, Santa Cruz",
      whatsapp: "2966218045",
      phone: "2966218045",
      instagram: "vientosgym",
      /* Horario por día de la semana (0 = domingo). Vacío = cerrado */
      open: ["", "06:00-23:00", "06:00-23:00", "06:00-23:00", "06:00-23:00", "06:00-23:00", "10:00-20:00"],
      services: ["Musculación", "Ciclo indoor", "Stretching", "Masajes deportivos", "Zona de relax", "Vientos Food"],
      joinCode: "VIENTOS",
      reminderDays: 5,
    },
    exercises: EXERCISES.map((e) => ({ ...e })),
    templates,
    plans: [
      { id: "p-libre", name: "Musculación · pase libre", price: 42000 },
      { id: "p-3x", name: "Musculación · 3 veces por semana", price: 36000 },
      { id: "p-ciclo", name: "Ciclo indoor", price: 30000 },
      { id: "p-combo", name: "Combo musculación + ciclo", price: 55000 },
    ],
    users: [], routines: [], logs: [], payments: [], notices: [], live: {},
  };
  return buildDemo(base, { hashPass, uid, normDays });
}

/* ------------------------------------------------------------- lecturas */
export const user = (id) => db.users.find((u) => u.id === id);
export const members = () => db.users.filter((u) => u.role === "socio" && u.status !== "baja");
export const activeMembers = () => members().filter((u) => u.status === "activo");
export const pending = () => db.users.filter((u) => u.role === "socio" && u.status === "pendiente");
export const coaches = () => db.users.filter((u) => (u.role === "profe" || u.role === "admin") && u.status === "activo");
export const exercise = (id) => db.exercises.find((e) => e.id === id);
export const template = (id) => db.templates.find((t) => t.id === id);
export const routine = (id) => db.routines.find((r) => r.id === id);
export const plan = (id) => db.plans.find((p) => p.id === id);
export const routinesOf = (userId) => db.routines.filter((r) => r.userId === userId).sort((a, b) => b.number - a.number);
export const activeRoutine = (userId) => db.routines.find((r) => r.userId === userId && r.active);
export const logsOf = (userId) => db.logs.filter((l) => l.userId === userId).sort((a, b) => b.at - a.at);
export const membersOf = (coachId) => activeMembers().filter((u) => u.coachId === coachId);
export const session = (userId) => db.live[userId] || null;

export function findLogin(identifier) {
  const k = fold(identifier).trim();
  return db.users.find((u) => fold(u.user) === k || fold(u.email) === k);
}

/* Nombre que ve el socio: "Lucía Fernández · Rutina 1" o el de la plantilla */
export function routineTitle(r) {
  if (!r) return "";
  return r.personal ? `${r.ownerName || user(r.userId)?.name || ""} · Rutina ${r.number}` : r.name;
}

export function dayStats(d) {
  let ex = 0, sets = 0, sec = 0;
  for (const b of d.blocks) {
    for (const i of b.items) {
      ex++;
      sets += i.sets;
      const timed = /min/.test(i.reps) ? parseFloat(i.reps) * 60 : /s$/.test(i.reps) ? parseFloat(i.reps) : 40;
      sec += i.sets * (timed || 40) + (b.type === "single" ? i.sets * i.rest : 0);
    }
    if (b.type !== "single") sec += (b.items[0]?.sets || 1) * (b.rest || 0) + b.items.length * 15;
  }
  return { ex, sets, min: Math.max(10, Math.round(sec / 60 / 5) * 5) };
}

/* Últimos pesos usados por el socio en un ejercicio (por serie) */
export function lastSets(userId, exId) {
  for (const l of logsOf(userId)) {
    const s = l.sets.filter((x) => x.ex === exId);
    if (s.length) return { at: l.at, sets: s };
  }
  return null;
}

export function bestOf(userId, exId) {
  let best = null;
  for (const l of db.logs) {
    if (l.userId !== userId) continue;
    for (const s of l.sets) if (s.ex === exId && s.kg && (!best || s.kg > best.kg)) best = { kg: s.kg, reps: s.reps, at: l.at };
  }
  return best;
}

/* Serie histórica de peso máximo por sesión para un ejercicio */
export function historyOf(userId, exId) {
  return logsOf(userId).slice().reverse()
    .map((l) => ({ at: l.at, kg: Math.max(0, ...l.sets.filter((s) => s.ex === exId).map((s) => s.kg || 0)) }))
    .filter((p) => p.kg > 0);
}

/* Ejercicios con registros (para elegir en el gráfico de progreso) */
export function trackedExercises(userId) {
  const n = {};
  for (const l of db.logs) if (l.userId === userId) for (const s of l.sets) if (s.kg) n[s.ex] = (n[s.ex] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/* Racha: semanas seguidas (hasta la actual) con al menos un entrenamiento */
export function streakWeeks(userId) {
  const weeks = new Set(logsOf(userId).map((l) => weekStart(l.at)));
  let w = weekStart(), n = 0;
  if (!weeks.has(w)) w -= 7 * DAY;
  while (weeks.has(w)) { n++; w -= 7 * DAY; }
  return n;
}
export const trainedDays = (userId) => new Set(logsOf(userId).map((l) => dayKey(l.at)));

/* Próximo día sugerido: el siguiente al último que entrenó */
export function nextDay(userId) {
  const r = activeRoutine(userId);
  if (!r || !r.days.length) return null;
  const last = logsOf(userId).find((l) => l.routineId === r.id);
  if (!last) return r.days[0];
  const i = r.days.findIndex((d) => d.id === last.dayId);
  return r.days[(i + 1) % r.days.length];
}

/* Horario agrupado para mostrar: [{d: "Lunes a viernes", h: "06:00 a 23:00"}] */
const WD = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export function hoursList(open = db.gym.open) {
  const order = [1, 2, 3, 4, 5, 6, 0], out = [];
  for (const d of order) {
    const h = open[d] || "";
    const last = out[out.length - 1];
    if (last && last.h === h) last.to = d; else out.push({ from: d, to: d, h });
  }
  return out.map((g) => ({
    d: g.from === g.to ? WD[g.from] : `${WD[g.from]} a ${WD[g.to].toLowerCase()}`,
    h: g.h ? g.h.replace("-", " a ") : "Cerrado",
    days: order.slice(order.indexOf(g.from), order.indexOf(g.to) + 1),
  }));
}
export function openNow(open = db.gym.open) {
  const n = new Date(), h = open[n.getDay()];
  if (!h) return { open: false, label: "Hoy cerrado" };
  const [a, b] = h.split("-"), cur = n.getHours() * 60 + n.getMinutes();
  const toMin = (t) => { const [x, y] = t.split(":").map(Number); return x * 60 + y; };
  if (cur < toMin(a)) return { open: false, label: `Abre hoy a las ${a}` };
  if (cur >= toMin(b)) return { open: false, label: "Cerrado por hoy" };
  return { open: true, label: `Abierto hasta las ${b}` };
}

/* Estado de la cuota */
export function feeStatus(u) {
  if (!u?.fee?.dueAt) return { state: "none", label: "Sin cuota cargada" };
  const days = Math.round((new Date(u.fee.dueAt).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY);
  if (days < 0) return { state: "late", days, label: `Vencida hace ${-days} ${-days === 1 ? "día" : "días"}` };
  if (days === 0) return { state: "soon", days, label: "Vence hoy" };
  if (days <= (db.gym.reminderDays || 5)) return { state: "soon", days, label: `Vence en ${days} ${days === 1 ? "día" : "días"}` };
  return { state: "ok", days, label: "Al día" };
}

/* ------------------------------------------------------------ escrituras */
export const api = {
  async login(identifier, pass) {
    const u = findLogin(identifier);
    if (!u || u.status === "baja") return null;
    if ((await hashPass(pass, u.salt)) !== u.hash) return null;
    return u;
  },

  async register({ name, email, phone, pass, code }) {
    if (fold(code).trim() !== fold(db.gym.joinCode)) throw new Error("El código del gimnasio no es correcto. Pedilo en recepción.");
    if (findLogin(email)) throw new Error("Ya hay una cuenta con ese email.");
    const salt = uid("s");
    const u = {
      id: uid("u"), role: "socio", status: "pendiente", name: name.trim(), user: email.trim().toLowerCase(), email: email.trim().toLowerCase(),
      phone, birth: "", gender: "", salt, hash: await hashPass(pass, salt), coachId: null, joined: Date.now(), fee: null, prefs: { theme: "dark", sound: true },
    };
    db.users.push(u);
    save();
    return u;
  },

  async createMember({ name, email, phone, pass, coachId, planId }) {
    if (findLogin(email)) throw new Error("Ya hay una cuenta con ese email o usuario.");
    const salt = uid("s");
    const u = {
      id: uid("u"), role: "socio", status: "activo", name: name.trim(), user: email.trim().toLowerCase(), email: email.trim().toLowerCase(),
      phone, birth: "", gender: "", salt, hash: await hashPass(pass, salt), coachId: coachId || null, joined: Date.now(),
      fee: planId ? { planId, dueAt: Date.now() + 30 * DAY } : null, prefs: { theme: "dark", sound: true },
    };
    db.users.push(u);
    save();
    return u;
  },

  async createCoach({ name, email, phone, pass, role }) {
    if (findLogin(email)) throw new Error("Ya hay una cuenta con ese email o usuario.");
    const salt = uid("s");
    const u = {
      id: uid("u"), role: role === "admin" ? "admin" : "profe", status: "activo", name: name.trim(), user: email.trim().toLowerCase(), email: email.trim().toLowerCase(),
      phone, salt, hash: await hashPass(pass, salt), joined: Date.now(), prefs: { theme: "dark", sound: true },
    };
    db.users.push(u);
    save();
    return u;
  },

  approve(userId, coachId, planId) {
    const u = user(userId);
    u.status = "activo";
    u.coachId = coachId || u.coachId;
    if (planId) u.fee = { planId, dueAt: Date.now() + 30 * DAY };
    save();
  },
  reject(userId) { db.users = db.users.filter((u) => u.id !== userId); save(); },

  updateUser(userId, patch) { Object.assign(user(userId), patch); save(); },

  async changePassword(userId, oldPass, newPass) {
    const u = user(userId);
    if ((await hashPass(oldPass, u.salt)) !== u.hash) throw new Error("La contraseña actual no es correcta.");
    u.salt = uid("s");
    u.hash = await hashPass(newPass, u.salt);
    save();
  },
  async resetPassword(userId, newPass) {
    const u = user(userId);
    u.salt = uid("s");
    u.hash = await hashPass(newPass, u.salt);
    save();
  },

  /* Baja de la cuenta: se borran datos personales y registros */
  deleteAccount(userId) {
    db.users = db.users.filter((u) => u.id !== userId);
    db.routines = db.routines.filter((r) => r.userId !== userId);
    db.logs = db.logs.filter((l) => l.userId !== userId);
    db.payments = db.payments.filter((p) => p.userId !== userId);
    delete db.live[userId];
    save();
  },

  /* Asignar: copia la plantilla al socio (editarla después no toca a los demás) */
  assign(userId, { templateId, coachId, personal = false, name = "", note = "" }) {
    const t = templateId ? template(templateId) : null;
    const prev = routinesOf(userId);
    prev.forEach((r) => { if (r.active) { r.active = false; r.endedAt = Date.now(); } });
    const r = {
      id: uid("r"), userId, number: (prev[0]?.number || 0) + 1, personal: !!personal,
      name: name || t?.name || "Rutina personalizada", level: t?.level || "Intermedio", goal: t?.goal || "", audience: t?.audience || "Mixto",
      fromTemplate: t?.id || null, coachId, note, active: true, startedAt: Date.now(), endedAt: null,
      days: t ? normDays(JSON.parse(JSON.stringify(t.days)).map(stripIds)) : normDays([{ name: "Día 1", focus: "", blocks: [] }]),
    };
    db.routines.push(r);
    save();
    return r;
  },

  saveRoutine(r) { r.updated = Date.now(); save(); },
  activateRoutine(id) {
    const r = routine(id);
    routinesOf(r.userId).forEach((x) => { if (x.active && x.id !== id) { x.active = false; x.endedAt = Date.now(); } });
    r.active = true; r.endedAt = null;
    save();
  },

  newTemplate(coachId) {
    const t = { id: uid("t"), key: "", name: "Nueva plantilla", level: "Intermedio", audience: "Mixto", goal: "Hipertrofia", weeks: 6, desc: "", days: normDays([{ name: "Día 1", focus: "", blocks: [] }]), order: db.templates.length, createdBy: coachId, updated: Date.now() };
    db.templates.push(t);
    save();
    return t;
  },
  duplicateTemplate(id, coachId) {
    const s = template(id);
    const t = { ...JSON.parse(JSON.stringify(s)), id: uid("t"), key: "", name: s.name + " (copia)", createdBy: coachId, updated: Date.now(), order: db.templates.length };
    t.days = normDays(t.days.map(stripIds));
    db.templates.push(t);
    save();
    return t;
  },
  /* Guarda la rutina de un socio como plantilla nueva */
  templateFromRoutine(routineId, coachId, name) {
    const r = routine(routineId);
    const t = { id: uid("t"), key: "", name, level: r.level, audience: r.audience, goal: r.goal, weeks: 6, desc: "", days: normDays(JSON.parse(JSON.stringify(r.days)).map(stripIds)), order: db.templates.length, createdBy: coachId, updated: Date.now() };
    db.templates.push(t);
    save();
    return t;
  },
  saveTemplate(t) { t.updated = Date.now(); save(); },
  deleteTemplate(id) { db.templates = db.templates.filter((t) => t.id !== id); save(); },

  saveExercise(e) {
    if (!e.id) { e.id = uid("e"); db.exercises.push(e); }
    else Object.assign(exercise(e.id), e);
    save();
    return e;
  },
  deleteExercise(id) { db.exercises = db.exercises.filter((e) => e.id !== id); save(); },
  exerciseInUse(id) {
    const inDays = (days) => days.some((d) => d.blocks.some((b) => b.items.some((i) => i.ex === id)));
    return db.templates.some((t) => inDays(t.days)) || db.routines.some((r) => r.active && inDays(r.days));
  },

  /* Entrenamiento en curso (se guarda para no perderlo si se cierra la app) */
  startSession(userId, routineId, dayId) {
    db.live[userId] = { routineId, dayId, startedAt: Date.now(), sets: {} };
    save();
    return db.live[userId];
  },
  session(userId) { return db.live[userId] || null; },
  logSet(userId, itemId, setIdx, data) {
    const s = db.live[userId];
    if (!s) return;
    (s.sets[itemId] ||= [])[setIdx] = { ...(s.sets[itemId]?.[setIdx] || {}), ...data };
    s.lastAt = Date.now();
    save();
  },
  /* El entrenamiento no hace falta terminarlo: si quedó abierto de otro día o
     pasaron más de 3 horas sin marcar nada, se guarda solo con lo que se hizo. */
  closeStale(userId) {
    const s = db.live[userId];
    if (!s) return null;
    const last = s.lastAt || s.startedAt;
    if (dayKey(last) === dayKey() && Date.now() - last < 3 * 3600000) return null;
    return api.finishSession(userId, last);
  },
  cancelSession(userId) { delete db.live[userId]; save(); },
  finishSession(userId, endAt = Date.now()) {
    const s = db.live[userId];
    if (!s) return null;
    const r = routine(s.routineId);
    const d = r?.days.find((x) => x.id === s.dayId);
    const sets = [];
    for (const b of d?.blocks || []) for (const i of b.items) {
      (s.sets[i.id] || []).forEach((x, n) => { if (x?.done) sets.push({ item: i.id, ex: i.ex, set: n + 1, kg: x.kg ?? null, reps: x.reps ?? null }); });
    }
    const log = {
      id: uid("l"), userId, routineId: s.routineId, dayId: s.dayId, dayName: d?.name || "", focus: d?.focus || "",
      startedAt: s.startedAt, at: endAt, min: Math.max(1, Math.round((endAt - s.startedAt) / 60000)), sets,
      volume: sets.reduce((a, x) => a + (x.kg || 0) * (parseInt(x.reps) || 0), 0),
    };
    delete db.live[userId];
    if (!sets.length) { save(); return null; }
    db.logs.push(log);
    save();
    return log;
  },

  registerPayment(userId, { planId, months = 1, amount, by }) {
    const u = user(userId);
    const p = plan(planId);
    const from = Math.max(Date.now(), u.fee?.dueAt || 0);
    const d = new Date(from); d.setMonth(d.getMonth() + months);
    u.fee = { planId, dueAt: d.getTime() };
    db.payments.push({ id: uid("pay"), userId, planId, months, amount: amount ?? (p?.price || 0) * months, at: Date.now(), by });
    save();
  },
  setDue(userId, dueAt, planId) { const u = user(userId); u.fee = { planId: planId || u.fee?.planId || db.plans[0].id, dueAt }; save(); },

  saveGym(patch) { Object.assign(db.gym, patch); save(); },
  savePlans(plans) { db.plans = plans; save(); },
  addNotice(n) { db.notices.unshift({ id: uid("n"), at: Date.now(), ...n }); save(); },
  deleteNotice(id) { db.notices = db.notices.filter((n) => n.id !== id); save(); },
};

function stripIds(d) {
  delete d.id;
  d.blocks.forEach((b) => { delete b.id; b.items.forEach((i) => delete i.id); });
  return d;
}

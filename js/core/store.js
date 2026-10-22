/* =========================================================================
   STORE — capa de datos de la app
   · Modo DEMO: todo vive en el localStorage de este navegador, con datos de
     ejemplo. Sirve para mostrar el producto; no apto para socios reales.
   · Modo SUPABASE: mismo objeto `db` y mismas funciones; cada cambio se manda
     al servidor con push() (ver js/core/remote.js). Las reglas de quién puede
     ver y tocar qué están en el servidor (supabase/01_esquema.sql).
   · Con "?demo" en la dirección se fuerza la demostración (para mostrarla).
   ========================================================================= */
import { EXERCISES } from "../data/exercises.js";
import { TEMPLATES, PROGRAMS } from "../data/templates.js";
import { buildDemo } from "../data/demo.js";
import { uid, sha256, DAY, weekStart, dayKey, fold, addMonths } from "./util.js";
import { CONFIG } from "../config.js";

const KEY = "vientos_db_v6";
const forceDemo = (() => { try { return new URLSearchParams(location.search).has("demo"); } catch { return false; } })();
export const MODE = CONFIG.mode === "supabase" && CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && !forceDemo ? "supabase" : "demo";

/* Adaptador del servidor (null en demostración) */
let R = null;
export const remote = () => R;
function push(fn, ...args) {
  if (!R || typeof R[fn] !== "function") return;
  R.send(fn, args);   /* pasa por la cola: si no hay señal, se reenvía solo */
}

export let db = null;
const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

let saveT = 0;
export function save() {
  if (MODE === "demo") {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn("No se pudo guardar", e); }
    }, 60);
  }
  listeners.forEach((fn) => fn());
}

/* Reemplaza todos los datos (lo usa el servidor al ingresar o salir) */
export function setDb(next) { db = next; listeners.forEach((fn) => fn()); }

export async function init() {
  if (MODE === "supabase") {
    R = (await import("./remote.js")).remoteAdapter;
    db = await R.boot();
    return db;
  }
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { db = null; }
  if (!db || db.v !== 6) { db = await seed(); localStorage.setItem(KEY, JSON.stringify(db)); }
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
      items: b.items.map((i) => ({
        id: i.id || uid("i"), ex: i.ex, sets: +i.sets || 1, reps: String(i.reps ?? ""), kg: i.kg ?? null, rest: i.rest ?? 60, note: i.note || "",
        ...(i.wk ? { wk: i.wk.map((w) => ({ s: +w.s || 1, r: String(w.r ?? "") })) } : {}),
        ...(i.col ? { col: i.col } : {}),
      })),
    })),
  }));
}

/* Programa vacío: 3 días con sus 4 bloques (movilidad y core, fuerza, accesorios, EMOM) */
export function blankProgram(space = "fitz") {
  const session = (n) => ({ name: `Día ${n}`, focus: "", blocks: [
    { type: "prep", rest: 0, items: [] }, { type: "strength", rest: 150, items: [] },
    { type: "accessory", rest: 90, items: [] }, { type: "emom", rest: 0, items: [] }] });
  return { kind: "program", space, name: "Programa personalizado", level: "Intermedio", audience: "Mixto", goal: "Fuerza y movimiento", weeks: 6,
    meta: { deporte: "", metodo: "Fuerza y movimiento", etapa: "" }, days: normDays([1, 2, 3].map(session)) };
}

/* Plantillas que vienen con la app: las de Vientos y los programas de Fitz Club */
export function baseTemplates() {
  return [...TEMPLATES, ...PROGRAMS].map((t, i) => ({
    id: "t-" + t.key, key: t.key, name: t.name, level: t.level, audience: t.audience, goal: t.goal, weeks: t.weeks, desc: t.desc,
    ...(t.kind ? { kind: t.kind } : {}), ...(t.space ? { space: t.space } : {}), ...(t.meta ? { meta: { ...t.meta } } : {}),
    days: normDays(JSON.parse(JSON.stringify(t.days))), order: i, createdBy: null, updated: Date.now(),
  }));
}
/* Planes del espacio Fitz Club (precio de referencia: lo cambia el dueño en Planes y precios) */
export const FITZ_PLANS = [
  { id: "p-fitz-3x", name: "Fitz Club · 3 veces por semana", price: 45000, space: "fitz" },
];

export async function hashPass(pass, salt) { return sha256(salt + ":" + pass); }

/* Datos iniciales del gimnasio: la demostración y el primer ingreso del dueño al servidor */
export function defaults() {
  const templates = baseTemplates();
  /* Las plantillas no traen peso: lo pone cada socio */
  templates.forEach((t) => t.days.forEach((d) => d.blocks.forEach((b) => b.items.forEach((i) => (i.kg = null)))));
  return {
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
      ...FITZ_PLANS,
    ],
  };
}

async function seed() {
  const d = defaults();
  /* La demo arma sus plantillas desde los datos con peso (para inventar el historial) */
  const templates = baseTemplates();
  const base = { v: 6, seededAt: Date.now(), ...d, templates, users: [], routines: [], logs: [], payments: [], notices: [], live: {} };
  return buildDemo(base, { hashPass, uid, normDays });
}

/* ------------------------------------------------------------- lecturas */
export const user = (id) => db.users.find((u) => u.id === id);

/* ------------------------------------------------------------- espacios
   Un mismo gimnasio puede tener espacios con su propia marca, socios, planes y
   cobros (hoy: Vientos y Fitz Club, que alquila un piso). Lo que no tiene espacio
   cargado es de Vientos, así todo lo anterior sigue igual. */
export const SPACES = [
  { id: "vientos", name: "Vientos GYM", short: "Vientos" },
  { id: "fitz", name: "Fitz Club", short: "Fitz Club", logo: "img/fitz-logo.png", tagline: "Programas por semanas" },
];
export const spaceInfo = (id) => SPACES.find((x) => x.id === id) || SPACES[0];
export const spaceOf = (u) => (u?.prefs?.space === "fitz" ? "fitz" : "vientos");
export const tplSpace = (t) => (t?.space === "fitz" ? "fitz" : "vientos");
export const planSpace = (p) => (p?.space === "fitz" ? "fitz" : "vientos");
/* Quién está usando la app (lo informa auth.js, que importa este módulo) */
let whoId = () => db?.me;
export function bindMe(fn) { whoId = fn; }
/* Son dos unidades de negocio: cada dueño, profe y socio ve solo lo de su espacio.
   El proveedor de la plataforma (prefs.space = "all", se pone desde Supabase) ve los
   dos y elige en cuál trabajar. */
export const exSpace = (e) => (e?.space === "fitz" ? "fitz" : "vientos");
export const exercisesOf = (sp = currentSpace()) => db.exercises.filter((e) => exSpace(e) === sp);
export const isProvider = (u = user(whoId())) => u?.prefs?.space === "all";
const SPACE_KEY = "vientos_space";
export function currentSpace() {
  const u = user(whoId());
  if (!isProvider(u)) return spaceOf(u);
  let v = null;
  try { v = localStorage.getItem(SPACE_KEY); } catch { /* sin almacenamiento */ }
  return v === "fitz" ? "fitz" : "vientos";
}
export function setCurrentSpace(id) { try { localStorage.setItem(SPACE_KEY, id); } catch { /* sin almacenamiento */ } }
export const inSpace = (u, sp = currentSpace()) => spaceOf(u) === sp;
export const plansOf = (sp = currentSpace()) => db.plans.filter((p) => planSpace(p) === sp);
export const paySpace = (p) => (p.space ? (p.space === "fitz" ? "fitz" : "vientos") : spaceOf(user(p.userId)));
export const paymentsOf = (sp = currentSpace()) => db.payments.filter((p) => paySpace(p) === sp);
export const noticesOf = (sp = currentSpace()) => db.notices.filter((n) => (n.space === "fitz" ? "fitz" : "vientos") === sp);
/* Contacto y horario de cada espacio. Fitz Club guarda los suyos aparte; lo que no
   cargó (dirección, ciudad, horario) sale del edificio que comparten */
export function gymOf(sp = currentSpace()) {
  if (sp !== "fitz") return db.gym;
  return { name: "Fitz Club", address: db.gym.address, city: db.gym.city, whatsapp: "", phone: "", instagram: "", open: db.gym.open, reminderDays: 5, ...(db.gym.spaces?.fitz || {}) };
}
export const spaceMembers = (sp = currentSpace()) => activeMembers().filter((u) => inSpace(u, sp));

/* ------------------------------------------------- programas por semanas
   Un programa (kind "program") dura `weeks` semanas desde `startAt` (lunes de inicio).
   Cada ejercicio tiene su prescripción por semana en `wk`. */
export const isProgram = (r) => r?.kind === "program";
export const programStart = (r) => weekStart(r.startAt || r.startedAt || Date.now());
export const programEnd = (r) => programStart(r) + (r.weeks || 6) * 7 * DAY - 1;
export function programWeek(r, ts = Date.now()) {
  if (!isProgram(r)) return 1;
  const w = Math.floor((weekStart(ts) - programStart(r)) / (7 * DAY)) + 1;
  return Math.max(1, Math.min(r.weeks || 6, w));
}
/* El ejercicio con la prescripción de una semana (series y repeticiones de esa semana) */
export function weekItem(i, w) {
  const x = i.wk?.[w - 1] || i.wk?.[i.wk.length - 1];
  return x ? { ...i, sets: x.s, reps: x.r } : i;
}
export const weekDay = (d, w) => ({ ...d, blocks: d.blocks.map((b) => ({ ...b, items: b.items.map((i) => weekItem(i, w)) })) });
/* Cargas anotadas por semana para un ejercicio del programa: [{ w, at, sets: [{kg, reps}] }] (la última sesión de cada semana) */
export function weekLoads(userId, r, itemId) {
  const out = {};
  logsOf(userId).filter((l) => l.routineId === r.id).forEach((l) => {
    const sets = l.sets.filter((x) => x.item === itemId);
    if (!sets.length) return;
    const w = l.week || programWeek(r, l.at);
    if (!out[w] || out[w].at < l.at) out[w] = { w, at: l.at, sets: sets.sort((a, b) => a.set - b.set) };
  });
  return out;
}
export const members = () => db.users.filter((u) => u.role === "socio" && u.status !== "baja");
export const activeMembers = () => members().filter((u) => u.status === "activo");

/* Socios mes a mes, calculado contra los pagos y las altas guardados:
   · activos: tienen una cuota que cubre al menos 15 días de ese mes (según los pagos registrados);
     en el mes en curso cuentan las cuentas activas con la cuota vigente hoy (igual que "al día" del tablero).
   · nuevos: su cuenta se creó ese mes. Cada persona cuenta como nueva UNA sola vez en la vida.
   · siguieron: estaban activos el mes anterior y siguen. · se fueron: estaban y ya no.
   · volvieron: ya habían sido socios, faltaron al menos un mes y regresan.
   Desde que hay pagos en la app: antes de eso no hay datos para saber quién estaba. */
export function membershipByMonth(now = Date.now(), sp = null) {
  const socios = db.users.filter((u) => u.role === "socio" && (!sp || spaceOf(u) === sp));
  const cover = {};
  db.payments.forEach((p) => {
    if (sp && paySpace(p) !== sp) return;
    const from = p.from ?? p.at;
    let to = p.to;
    if (!to) to = addMonths(from, p.months || 1);
    (cover[p.userId] ||= []).push([from, to]);
  });
  const starts = [...socios.map((u) => u.joined), ...db.payments.filter((p) => !sp || paySpace(p) === sp).map((p) => p.at)].filter(Boolean);
  if (!starts.length) return [];
  const first = new Date(Math.min(...starts)), cur = new Date(now);
  const n = (cur.getFullYear() - first.getFullYear()) * 12 + cur.getMonth() - first.getMonth() + 1;
  const out = [];
  const everBefore = new Set();
  let prev = new Set();
  for (let i = 0; i < n; i++) {
    const a = new Date(first.getFullYear(), first.getMonth() + i, 1).getTime();
    const b = new Date(first.getFullYear(), first.getMonth() + i + 1, 1).getTime();
    const isCur = i === n - 1;
    /* activo en el mes = la cuota cubre al menos 15 días de ese mes (o, en el mes en curso, está vigente hoy) */
    const days = (u) => (cover[u.id] || []).reduce((n, [x, y]) => n + Math.max(0, Math.min(y, b) - Math.max(x, a)) / 86400000, 0);
    const vigenteHoy = (u) => u.status === "activo" && (["ok", "soon"].includes(feeStatus(u).state) || (cover[u.id] || []).some(([x, y]) => x <= now && y > now));
    const active = new Set(socios.filter((u) => (isCur ? vigenteHoy(u) || (u.status === "activo" && days(u) >= 15) : days(u) >= 15)).map((u) => u.id));
    const nuevos = socios.filter((u) => u.joined >= a && u.joined < b).length;
    const kept = [...active].filter((id) => prev.has(id)).length;
    const left = [...prev].filter((id) => !active.has(id)).length;
    const back = [...active].filter((id) => !prev.has(id) && everBefore.has(id)).length;
    out.push({ start: a, active: active.size, nuevos, kept, left, back, cur: isCur });
    active.forEach((id) => everBefore.add(id));
    prev = active;
  }
  return out;
}
export const pending = () => db.users.filter((u) => u.role === "socio" && u.status === "pendiente");
export const coaches = (sp = currentSpace()) => db.users.filter((u) => (u.role === "profe" || u.role === "admin") && u.status === "activo" && spaceOf(u) === sp);
export const exercise = (id) => db.exercises.find((e) => e.id === id);
export const template = (id) => db.templates.find((t) => t.id === id);
export const routine = (id) => db.routines.find((r) => r.id === id);
export const plan = (id) => db.plans.find((p) => p.id === id);

/* Convenios con empresas: descuento en porcentaje o monto fijo por mes */
/* Los que publicó Vientos en Facebook (marzo y abril). Donde la publicación
   dice el porcentaje, viene cargado; el resto queda "a definir" hasta que el
   dueño cargue el descuento. */
const MUSC = ["p-libre", "p-3x"];
export const DEFAULT_CONVENIOS = [
  { id: "c-centa", name: "CENTA", type: "pct", value: 35, planIds: MUSC, data: "35 % en sala de musculación" },
  { id: "c-imparables", name: "Imparables (padrinos y madrinas)", type: "pct", value: 35, planIds: MUSC, data: "35 % en sala de musculación" },
  { id: "c-smata", name: "SMATA", type: "pct", value: 20, planIds: [], data: "Afiliados al sindicato (consultar requisitos)" },
  { id: "c-apap", name: "APAP Santa Cruz", type: "pct", value: 0, planIds: [], data: "50 % en Funcional / Minitramp / Bodyattack (profe Caro Vega). Cargar cuando estén esos planes." },
  { id: "c-casfpi", name: "CASFPI (Sindicato trabajadores ANSES)", type: "pct", value: 0, planIds: [], data: "" },
  { id: "c-amgyp", name: "AMGyP (Mutual del Gas y Petróleo)", type: "pct", value: 0, planIds: [], data: "" },
  { id: "c-viacargo", name: "Vía Cargo", type: "pct", value: 0, planIds: [], data: "" },
  { id: "c-autofarma", name: "Autofarma", type: "pct", value: 0, planIds: [], data: "" },
  { id: "c-minimarket", name: "Minimarket", type: "pct", value: 0, planIds: [], data: "" },
  { id: "c-bomberos", name: "Policía de Santa Cruz · Bomberos", type: "pct", value: 0, planIds: [], data: "" },
  { id: "c-enerflex", name: "Enerflex", type: "pct", value: 0, planIds: [], data: "" },
];
export const convenios = () => db.gym.convenios || DEFAULT_CONVENIOS;
export const convenio = (id) => (id ? convenios().find((c) => c.id === id) || null : null);
export const convLabel = (c) => (!c ? "" : `${c.name} · ${!+c.value ? "descuento a definir" : c.type === "pct" ? `${c.value} %` : `$ ${Number(c.value).toLocaleString("es-AR")} por mes`}`);
/* Precio de lista, descuento y total a cobrar. `c` es el convenio solo si se aplica
   (tiene descuento cargado y vale para ese plan); `conv` es el elegido. */
export function priceWith(planId, months = 1, convenioId = null) {
  const list = (plan(planId)?.price || 0) * months;
  const conv = convenio(convenioId);
  const c = conv && +conv.value > 0 && (!conv.planIds?.length || conv.planIds.includes(planId)) ? conv : null;
  const disc = !c ? 0 : c.type === "pct" ? Math.round((list * +c.value) / 100) : Math.min(list, +c.value * months);
  return { list, disc, total: list - disc, c, conv };
}
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
    if (b.type === "prep") { sec += b.items.length * 45; continue; }
    if (b.type === "emom") { b.items.forEach((i) => { ex++; sets += i.sets; sec += i.sets * 60; }); continue; }
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

/* Semana que arranca el lunes:
   · Rutinas de 5, 6 o 7 días: semana fija. El Día 1 es del lunes, el Día 2 del martes, y así.
     No depende de la semana anterior: si el viernes (Día 5) no se fue, el lunes toca el Día 1.
   · Rutinas de menos de 5 días: cada persona elige qué días va. Cada lunes vuelve a empezar
     por el Día 1 y la app sugiere el primer día que todavía no hizo esa semana. */
const SLOTS = { 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
export const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const weekdayOf = (ts = Date.now()) => (new Date(ts).getDay() + 6) % 7;
/* Día de la semana (0 = lunes) en que se hace cada día de la rutina */
export const slotsOf = (r) => (r?.days.length ? SLOTS[Math.min(7, r.days.length)] || [] : []);   // [] = sin días fijos
export function dayOn(r, wd) {
  const i = slotsOf(r).indexOf(wd);
  return i < 0 ? null : r.days[i];
}
/* Qué toca hoy: { day, today } · today = false cuando hoy es de descanso y se muestra el próximo */
export function todayPlan(userId, ts = Date.now()) {
  const r = activeRoutine(userId);
  if (!r || !r.days.length) return null;
  const wd = weekdayOf(ts);
  const slots = slotsOf(r);
  if (!slots.length) {
    /* menos de 5 días: el primero que no hizo desde el lunes (si hizo todos, vuelve a empezar) */
    const w0 = weekStart(ts);
    const done = new Set(logsOf(userId).filter((l) => l.routineId === r.id && l.at >= w0 && l.at < w0 + 7 * DAY).map((l) => l.dayId));
    const pending = r.days.find((d) => !done.has(d.id));
    return { day: pending || r.days[0], today: true, wd, weekDone: !pending };
  }
  const now = dayOn(r, wd);
  if (now) return { day: now, today: true, wd };
  for (let k = 1; k <= 7; k++) {
    const w = (wd + k) % 7, d = dayOn(r, w);
    if (d) return { day: d, today: false, wd: w, inDays: k };
  }
  return { day: r.days[0], today: false, wd: slots[0] ?? 0, inDays: 1 };
}
export const nextDay = (userId) => todayPlan(userId)?.day || null;

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
  /* Dado de alta (o aprobado) sin pagar: debe la cuota hasta que se registre el pago */
  if (u.fee.unpaid) return { state: "late", days: Math.min(0, days), label: "Debe la cuota" };
  if (days < 0) return { state: "late", days, label: `Vencida hace ${-days} ${-days === 1 ? "día" : "días"}` };
  if (days === 0) return { state: "soon", days, label: "Vence hoy" };
  if (days <= (gymOf(spaceOf(u)).reminderDays || 5)) return { state: "soon", days, label: `Vence en ${days} ${days === 1 ? "día" : "días"}` };
  return { state: "ok", days, label: "Al día" };
}

/* ------------------------------------------------------------ escrituras */
export const api = {
  async login(identifier, pass) {
    if (R) return R.login(identifier, pass);
    const u = findLogin(identifier);
    if (!u || u.status === "baja") return null;
    if ((await hashPass(pass, u.salt)) !== u.hash) return null;
    return u;
  },

  async register({ name, email, phone, pass, code }) {
    if (R) return R.register({ name, email, phone, pass, code });
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

  /* Alta en recepción: el usuario es el DNI; el email es opcional */
  async createMember({ name, dni, email = "", phone, birth = "", gender = "", pass, coachId, planId, convenioId = null, space = "vientos" }) {
    const username = (dni || email).trim().toLowerCase();
    if (findLogin(username) || (email && findLogin(email))) throw new Error(dni ? "Ya hay un socio con ese DNI." : "Ya hay una cuenta con ese email.");
    const mail = (email || `socio${dni}@sin-email.vientos.app`).trim().toLowerCase();
    /* con plan pero sin pago (el pago se registra aparte): queda debiendo desde hoy */
    const fee = planId ? { planId, dueAt: Date.now(), unpaid: true, ...(convenioId ? { convenioId } : {}) } : null;
    const prefs = { theme: "dark", sound: true, tempPass: true, ...(space === "fitz" ? { space: "fitz" } : {}) };
    if (R) {
      const u = await R.createAccount({ name, email: mail, username, phone, birth, gender, pass, role: "socio", coachId: coachId || null, fee, prefs });
      db.users.push(u); save();
      return u;
    }
    const salt = uid("s");
    const u = {
      id: uid("u"), role: "socio", status: "activo", name: name.trim(), user: username, email: email ? mail : "",
      phone, birth, gender, salt, hash: await hashPass(pass, salt), coachId: coachId || null, joined: Date.now(), fee, prefs,
    };
    db.users.push(u);
    save();
    return u;
  },

  async createCoach({ name, email, phone, pass, role, space = "vientos" }) {
    if (findLogin(email)) throw new Error("Ya hay una cuenta con ese email o usuario.");
    const prefs = { theme: "dark", sound: true, ...(space === "fitz" ? { space: "fitz" } : {}) };
    if (R) {
      const u = await R.createAccount({ name, email, username: email, phone, pass, role: role === "admin" ? "admin" : "profe", prefs });
      db.users.push(u); save();
      return u;
    }
    const salt = uid("s");
    const u = {
      id: uid("u"), role: role === "admin" ? "admin" : "profe", status: "activo", name: name.trim(), user: email.trim().toLowerCase(), email: email.trim().toLowerCase(),
      phone, salt, hash: await hashPass(pass, salt), joined: Date.now(), prefs,
    };
    db.users.push(u);
    save();
    return u;
  },

  approve(userId, coachId, planId) {
    const u = user(userId);
    u.status = "activo";
    u.coachId = coachId || u.coachId;
    if (planId) u.fee = { planId, dueAt: Date.now(), unpaid: true };          /* debe hasta que pague */
    save();
    push("saveProfile", u);
  },
  reject(userId) { db.users = db.users.filter((u) => u.id !== userId); save(); push("reject", userId); },

  updateUser(userId, patch) { Object.assign(user(userId), patch); save(); push("saveProfile", user(userId)); },

  async changePassword(userId, oldPass, newPass) {
    if (R) { await R.changePassword(oldPass, newPass); api.updateUser(userId, { prefs: { ...user(userId).prefs, tempPass: false } }); return; }
    const u = user(userId);
    u.prefs = { ...u.prefs, tempPass: false };
    if ((await hashPass(oldPass, u.salt)) !== u.hash) throw new Error("La contraseña actual no es correcta.");
    u.salt = uid("s");
    u.hash = await hashPass(newPass, u.salt);
    save();
  },
  async resetPassword(userId, newPass) {
    if (R) return R.resetPassword(userId, newPass);
    const u = user(userId);
    u.salt = uid("s");
    u.hash = await hashPass(newPass, u.salt);
    save();
  },

  /* Baja de la cuenta: se borran datos personales y registros */
  async deleteAccount(userId) {
    if (R) await R.deleteAccount();
    db.users = db.users.filter((u) => u.id !== userId);
    db.routines = db.routines.filter((r) => r.userId !== userId);
    db.logs = db.logs.filter((l) => l.userId !== userId);
    db.payments = db.payments.filter((p) => p.userId !== userId);
    delete db.live[userId];
    save();
  },

  /* Asignar: copia la plantilla al socio (editarla después no toca a los demás) */
  assign(userId, { templateId, coachId, personal = false, name = "", note = "", startAt = null, meta = null, program = false }) {
    const t = templateId ? template(templateId) : program ? blankProgram(spaceOf(user(userId))) : null;
    const prev = routinesOf(userId);
    prev.forEach((r) => { if (r.active) { r.active = false; r.endedAt = Date.now(); } });
    const r = {
      id: uid("r"), userId, number: (prev[0]?.number || 0) + 1, personal: !!personal,
      name: name || t?.name || "Rutina personalizada", level: t?.level || "Intermedio", goal: t?.goal || "", audience: t?.audience || "Mixto",
      fromTemplate: templateId ? t?.id || null : null, coachId, note, active: true, startedAt: Date.now(), endedAt: null,
      ...(isProgram(t) ? { kind: "program", weeks: t.weeks || 6, startAt: weekStart(startAt || Date.now()), meta: { ...(t.meta || {}), ...(meta || {}) }, space: tplSpace(t) } : {}),
      days: t ? normDays(JSON.parse(JSON.stringify(t.days)).map(stripIds)) : normDays([{ name: "Día 1", focus: "", blocks: [] }]),
    };
    db.routines.push(r);
    save();
    push("saveRoutines", routinesOf(userId));
    return r;
  },

  saveRoutine(r) {
    if (!db.routines.includes(r)) return;              /* se borró mientras se editaba: no revivirla */
    r.updated = Date.now(); save(); push("saveRoutines", [r]);
  },
  /* Rutina asignada por error: se borra entera. Lo que ya entrenó con ella (historial,
     kilos y récords) queda guardado; si la tenía abierta, se cierra sin guardar. */
  deleteRoutine(id) {
    const r = routine(id);
    if (!r) return;
    if (db.live[r.userId]?.routineId === id) { delete db.live[r.userId]; push("deleteLive", r.userId); }
    db.routines = db.routines.filter((x) => x.id !== id);
    save();
    push("deleteRoutine", id);
  },
  activateRoutine(id) {
    const r = routine(id);
    routinesOf(r.userId).forEach((x) => { if (x.active && x.id !== id) { x.active = false; x.endedAt = Date.now(); } });
    r.active = true; r.endedAt = null;
    save();
    push("saveRoutines", routinesOf(r.userId));
  },

  newTemplate(coachId, { program = false, space = "vientos" } = {}) {
    const session = (n) => ({ name: `Día ${n}`, focus: "", blocks: [
      { type: "prep", rest: 0, items: [] }, { type: "strength", rest: 150, items: [] },
      { type: "accessory", rest: 90, items: [] }, { type: "emom", rest: 0, items: [] }] });
    const t = program
      ? { id: uid("t"), key: "", kind: "program", space, name: "Nuevo programa", level: "Intermedio", audience: "Mixto", goal: "Fuerza y movimiento", weeks: 6, desc: "", meta: { deporte: "", metodo: "Fuerza y movimiento", etapa: "" }, days: normDays([1, 2, 3].map(session)), order: db.templates.length, createdBy: coachId, updated: Date.now() }
      : { id: uid("t"), key: "", name: "Nueva plantilla", level: "Intermedio", audience: "Mixto", goal: "Hipertrofia", weeks: 6, desc: "", space, days: normDays([{ name: "Día 1", focus: "", blocks: [] }]), order: db.templates.length, createdBy: coachId, updated: Date.now() };
    db.templates.push(t);
    save();
    push("saveTemplate", t);
    return t;
  },
  duplicateTemplate(id, coachId) {
    const s = template(id);
    const t = { ...JSON.parse(JSON.stringify(s)), id: uid("t"), key: "", name: s.name + " (copia)", createdBy: coachId, updated: Date.now(), order: db.templates.length };
    t.days = normDays(t.days.map(stripIds));
    db.templates.push(t);
    save();
    push("saveTemplate", t);
    return t;
  },
  /* Guarda la rutina de un socio como plantilla nueva */
  templateFromRoutine(routineId, coachId, name) {
    const r = routine(routineId);
    const t = { id: uid("t"), key: "", name, level: r.level, audience: r.audience, goal: r.goal, weeks: r.weeks || 6, desc: "", days: normDays(JSON.parse(JSON.stringify(r.days)).map(stripIds)), order: db.templates.length, createdBy: coachId, updated: Date.now(),
      ...(isProgram(r) ? { kind: "program", meta: { ...(r.meta || {}) } } : {}), ...(r.space ? { space: r.space } : {}) };
    db.templates.push(t);
    save();
    push("saveTemplate", t);
    return t;
  },
  saveTemplate(t) { t.updated = Date.now(); save(); push("saveTemplate", t); },
  deleteTemplate(id) { db.templates = db.templates.filter((t) => t.id !== id); save(); push("deleteTemplate", id); },

  saveExercise(e) {
    if (!e.id) { e.id = uid("e"); db.exercises.push(e); }
    else Object.assign(exercise(e.id), e);
    save();
    push("saveExercise", exercise(e.id));
    return e;
  },
  deleteExercise(id) { db.exercises = db.exercises.filter((e) => e.id !== id); save(); push("deleteExercise", id); },
  exerciseInUse(id) {
    const inDays = (days) => days.some((d) => d.blocks.some((b) => b.items.some((i) => i.ex === id)));
    return db.templates.some((t) => inDays(t.days)) || db.routines.some((r) => r.active && inDays(r.days));
  },

  /* Entrenamiento en curso (se guarda para no perderlo si se cierra la app) */
  startSession(userId, routineId, dayId) {
    db.live[userId] = { routineId, dayId, startedAt: Date.now(), sets: {} };
    save();
    push("saveLive", userId, db.live[userId]);
    return db.live[userId];
  },
  session(userId) { return db.live[userId] || null; },
  logSet(userId, itemId, setIdx, data) {
    const s = db.live[userId];
    if (!s) return;
    const prev = s.sets[itemId]?.[setIdx] || {};
    /* la hora de cada serie hecha: sirve para medir cuánto se entrenó de verdad */
    (s.sets[itemId] ||= [])[setIdx] = { ...prev, ...data, ...(data.done ? { t: prev.done && prev.t ? prev.t : Date.now() } : {}) };
    s.lastAt = Date.now();
    save();
    push("saveLive", userId, s);
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
  cancelSession(userId) { delete db.live[userId]; save(); push("deleteLive", userId); },
  finishSession(userId, endAt = Date.now()) {
    const s = db.live[userId];
    if (!s) return null;
    const r = routine(s.routineId);
    const d = r?.days.find((x) => x.id === s.dayId);
    const sets = [];
    for (const b of d?.blocks || []) for (const i of b.items) {
      (s.sets[i.id] || []).forEach((x, n) => { if (x?.done) sets.push({ item: i.id, ex: i.ex, set: n + 1, kg: x.kg ?? null, reps: x.reps ?? null }); });
    }
    /* Duración real: de la primera a la última serie hecha (+ unos 2 min de la última serie).
       No cuenta el tiempo antes de empezar ni el que pasa hasta que se toca "Listo por hoy". */
    const times = Object.values(s.sets).flat().filter((x) => x?.done && x.t).map((x) => x.t);
    const last = times.length ? Math.max(...times) : (s.lastAt || endAt);
    const first = times.length ? Math.min(...times) : s.startedAt;
    const end = Math.min(endAt, last + 120000);
    const min = Math.min(240, Math.max(1, Math.round((end - Math.min(first, last)) / 60000)));
    const log = {
      id: uid("l"), userId, routineId: s.routineId, dayId: s.dayId, dayName: d?.name || "", focus: d?.focus || "",
      startedAt: Math.min(first, last), at: Math.min(endAt, last + 120000), min, sets,
      ...(isProgram(r) ? { week: programWeek(r, Math.min(first, last)) } : {}),
      volume: sets.reduce((a, x) => a + (x.kg || 0) * (parseInt(x.reps) || 0), 0),
    };
    delete db.live[userId];
    push("deleteLive", userId);
    if (!sets.length) { save(); return null; }
    db.logs.push(log);
    save();
    push("saveLog", log);
    return log;
  },

  /* Pago de cuota: cubre de `from` a `to` (from + meses). Guarda cómo estaba la
     cuota antes, para poder anularlo si se cargó por error. */
  registerPayment(userId, { planId, months = 1, amount, by, from, convenioId = null }) {
    const u = user(userId);
    const pr = priceWith(planId, months, convenioId);
    const start = from ?? Math.max(Date.now(), u.fee?.dueAt || 0);
    const d = new Date(addMonths(start, months));
    const prev = u.fee ? { ...u.fee } : null;
    u.fee = { planId, dueAt: d.getTime(), ...(pr.conv ? { convenioId: pr.conv.id } : {}) };
    const pay = {
      id: uid("pay"), userId, planId, months, amount: amount ?? pr.total, at: Date.now(), by, from: start, to: d.getTime(), prev, space: spaceOf(u),
      list: pr.list, discount: pr.c ? { id: pr.c.id, name: pr.c.name, type: pr.c.type, value: pr.c.value, amount: pr.disc } : null,
    };
    db.payments.push(pay);
    save();
    push("saveProfile", u);
    push("savePayment", pay);
  },
  /* Anular un pago (solo el último de ese socio): la cuota vuelve a como estaba */
  deletePayment(id) {
    const pay = db.payments.find((x) => x.id === id);
    if (!pay) return;
    const u = user(pay.userId);
    const last = db.payments.filter((x) => x.userId === pay.userId).sort((a, b) => b.at - a.at)[0];
    if (u && last?.id === id) {
      if (pay.prev !== undefined) u.fee = pay.prev;
      else if (u.fee?.dueAt) u.fee = { ...u.fee, dueAt: addMonths(u.fee.dueAt, -(pay.months || 1)) };
      push("saveProfile", u);
    }
    db.payments = db.payments.filter((x) => x.id !== id);
    save();
    push("deletePayment", id);
  },
  /* Corregir un pago (monto, fecha de cobro, nota). Queda anotado quién y cuándo. */
  updatePayment(id, patch, by) {
    const p = db.payments.find((x) => x.id === id);
    if (!p) return;
    Object.assign(p, patch, { edited: { at: Date.now(), by } });
    save();
    push("updatePayment", p);
  },
  setDue(userId, dueAt, planId, unpaid = false) {
    const u = user(userId);
    const { unpaid: _, ...rest } = u.fee || {};
    u.fee = { ...rest, planId: planId || u.fee?.planId || plansOf(spaceOf(u))[0]?.id, dueAt, ...(unpaid ? { unpaid: true } : {}) };
    save(); push("saveProfile", u);
  },
  setConvenio(userId, convenioId) {
    const u = user(userId);
    const { convenioId: _, ...rest } = u.fee || {};
    u.fee = u.fee || convenioId ? { ...rest, ...(convenioId ? { convenioId } : {}) } : null;
    save(); push("saveProfile", u);
  },
  saveConvenios(list) { db.gym.convenios = list; save(); push("saveGym"); },

  saveGym(patch, sp = "vientos") {
    if (sp === "fitz") db.gym.spaces = { ...(db.gym.spaces || {}), fitz: { ...(db.gym.spaces?.fitz || {}), ...patch } };
    else Object.assign(db.gym, patch);
    save(); push("saveGym");
  },
  savePlans(plans) { db.plans = plans; save(); push("saveGym"); },
  addNotice(n) { const x = { id: uid("n"), at: Date.now(), ...n }; db.notices.unshift(x); save(); push("saveNotice", x); },
  deleteNotice(id) { db.notices = db.notices.filter((n) => n.id !== id); save(); push("deleteNotice", id); },
};

function stripIds(d) {
  delete d.id;
  d.blocks.forEach((b) => { delete b.id; b.items.forEach((i) => delete i.id); });
  return d;
}

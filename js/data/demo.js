/* Datos de DEMOSTRACIÓN: socios, profes, rutinas asignadas e historial ficticios.
   Todos los nombres son inventados. Se reemplazan por los reales al conectar Supabase. */
import { rng, DAY } from "../core/util.js";

export const DEMO_PASS = "Vientos2026";
export const DEMO_ACCOUNTS = [
  /* Vientos GYM */
  { user: "ana", label: "Socio nuevo", hint: "Ana · primer día, todo en cero" },
  { user: "martin", label: "Socio con historial", hint: "Martín · ya entrenó 10 semanas" },
  { user: "lucia", label: "Deportista", hint: "Lucía · rutina de contraste" },
  { user: "nico", label: "Profe", hint: "Panel del entrenador" },
  { user: "admin", label: "Dueño", hint: "Panel completo" },
  /* Fitz Club: otra unidad de negocio, con sus socios, profes, cuotas y dueño */
  { user: "ramiro", label: "Socio", hint: "Ramiro · programa de 6 semanas", space: "fitz" },
  { user: "fitz", label: "Profe", hint: "Arma los programas", space: "fitz" },
  { user: "fitzclub", label: "Dueño", hint: "Panel completo de Fitz Club", space: "fitz" },
];

const MEMBERS = [
  "Sofía Benítez", "Tomás Aguirre", "Valentina Ríos", "Joaquín Paredes", "Camila Ojeda", "Facundo Herrera", "Micaela Torres",
  "Gonzalo Vera", "Florencia Medina", "Ezequiel Castro", "Agustina Molina", "Bruno Sánchez", "Rocío Domínguez", "Nahuel Quiroga",
  "Julieta Cabrera", "Matías Ledesma", "Antonella Vargas", "Santiago Peralta", "Carolina Godoy", "Lautaro Méndez",
  "Milagros Sosa", "Federico Acosta", "Daniela Correa", "Ignacio Ponce", "Belén Navarro", "Franco Miranda",
];

export async function buildDemo(D, { hashPass, uid, normDays }) {
  const now = Date.now();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const T0 = today.getTime();
  const R = rng("vientos");
  const tpl = (k) => D.templates.find((t) => t.key === k);
  const salt0 = "demo";
  const hash0 = await hashPass(DEMO_PASS, salt0);

  const mk = (o) => {
    const u = {
      id: o.id || uid("u"), role: o.role || "socio", status: o.status || "activo", name: o.name, user: o.user, email: o.email || `${o.user}@demo.vientos`,
      phone: o.phone || "2966" + String(400000 + Math.floor(R() * 500000)), birth: o.birth || (o.role && o.role !== "socio" ? "" : `${1966 + Math.floor(R() * 40)}-${String(1 + Math.floor(R() * 12)).padStart(2, "0")}-${String(1 + Math.floor(R() * 28)).padStart(2, "0")}`), gender: o.gender || "",
      salt: salt0, hash: hash0, coachId: o.coachId || null, joined: o.joined || now - 200 * DAY, fee: o.fee || null,
      prefs: { theme: "dark", sound: true, ...(o.temp ? { tempPass: true } : {}), ...(o.space ? { space: o.space } : {}) },
    };
    D.users.push(u);
    return u;
  };

  const admin = mk({ id: "u-admin", role: "admin", name: "Administración Vientos", user: "admin", joined: now - 400 * DAY });
  const nico = mk({ id: "u-nico", role: "profe", name: "Nicolás Ruiz", user: "nico", phone: "2966218045", joined: now - 380 * DAY });
  const carla = mk({ id: "u-carla", role: "profe", name: "Carla Díaz", user: "carla", phone: "2966218045", joined: now - 300 * DAY });
  void admin;

  const assign = (u, key, { number, active, start, end, personal = false, coach, name, note = "" }) => {
    const t = tpl(key);
    const r = {
      id: uid("r"), userId: u.id, number, personal, name: name || t.name, level: t.level, goal: t.goal, audience: t.audience,
      fromTemplate: t.id, coachId: coach.id, note, active, startedAt: start, endedAt: end || null,
      days: normDays(JSON.parse(JSON.stringify(t.days)).map((d) => { delete d.id; d.blocks.forEach((b) => { delete b.id; b.items.forEach((i) => delete i.id); }); return d; })),
    };
    D.routines.push(r);
    return r;
  };

  /* Historial: sesiones con progresión de cargas suave */
  const history = (u, r, { from, to, perWeek, full = true, base = 0.86 }) => {
    let di = 0;
    for (let t = from; t < to; t += DAY) {
      const wd = new Date(t).getDay();
      if (wd === 0) continue;
      const weekly = perWeek / 6;
      if (R() > weekly * 1.15) continue;
      const d = r.days[di % r.days.length];
      di++;
      const p = (t - from) / Math.max(DAY, to - from);
      const start = t + (7 + Math.floor(R() * 12)) * 3600000 + Math.floor(R() * 50) * 60000;
      if (start + 90 * 60000 > Date.now()) continue;
      const sets = [];
      if (full) {
        for (const b of d.blocks) for (const i of b.items) {
          if (!i.kg) { for (let n = 1; n <= i.sets; n++) sets.push({ item: i.id, ex: i.ex, set: n, kg: null, reps: parseInt(i.reps) || null }); continue; }
          const k = Math.round((i.kg * (base + (1 - base) * p + (R() - 0.5) * 0.03)) / 2.5) * 2.5;
          for (let n = 1; n <= i.sets; n++) sets.push({ item: i.id, ex: i.ex, set: n, kg: Math.max(2.5, k), reps: parseInt(i.reps) || 10 });
        }
      }
      const min = 45 + Math.floor(R() * 35);
      D.logs.push({ id: uid("l"), userId: u.id, routineId: r.id, dayId: d.id, dayName: d.name, focus: d.focus, startedAt: start, at: start + min * 60000, min, sets, volume: sets.reduce((a, x) => a + (x.kg || 0) * (x.reps || 0), 0) });
    }
  };

  /* Martín: rutina 1 (3 días) terminada, rutina 2 (5 días) activa */
  const martin = mk({ id: "u-martin", name: "Martín Gómez", user: "martin", gender: "Masculino", birth: "1994-05-12", coachId: nico.id, joined: now - 120 * DAY, fee: { planId: "p-libre", dueAt: T0 + 3 * DAY } });
  const m1 = assign(martin, "hombres-3", { number: 1, active: false, start: T0 - 70 * DAY, end: T0 - 22 * DAY, coach: nico });
  const m2 = assign(martin, "hombres-5", { number: 2, active: true, start: T0 - 21 * DAY, coach: nico, note: "Subí 2,5 kg en los básicos cuando completes todas las repeticiones." });
  history(martin, m1, { from: T0 - 70 * DAY, to: T0 - 22 * DAY, perWeek: 3, base: 0.8 });
  history(martin, m2, { from: T0 - 21 * DAY, to: T0 - DAY + 1, perWeek: 4.6, base: 0.9 });

  /* Lucía: deportista con rutina personalizada de contraste */
  const lucia = mk({ id: "u-lucia", name: "Lucía Fernández", user: "lucia", gender: "Femenino", birth: "2001-09-03", coachId: nico.id, joined: now - 60 * DAY, fee: { planId: "p-combo", dueAt: T0 + 19 * DAY } });
  const l1 = assign(lucia, "contraste-3", { number: 1, active: true, personal: true, start: T0 - 16 * DAY, coach: nico, name: "Contraste · vóley", note: "Pretemporada de vóley. Los saltos siempre al 100 %: si bajás la calidad, cortá la serie." });
  l1.days[0].blocks[1].items[0].reps = "6,5,4,4";
  /* Ajustes personales: cargas de Lucía y un bloque propio */
  l1.days[0].blocks[1].items[0].kg = 55;
  l1.days[0].blocks[2].items[0].kg = 70;
  l1.days[1].blocks[0].items[0].kg = 32.5;
  l1.days[1].blocks[1].items[0].kg = 30;
  l1.days[2].blocks[0].items[0].kg = 65;
  history(lucia, l1, { from: T0 - 16 * DAY, to: T0 - DAY + 1, perWeek: 3, base: 0.92 });

  /* Resto de los socios */
  const keys = ["inicial-3", "hombres-5", "hombres-3", "mujeres-3", "mujeres-4", "torso-pierna-4", "quema-3"];
  const plans = ["p-libre", "p-libre", "p-3x", "p-combo", "p-ciclo"];
  MEMBERS.forEach((name, i) => {
    const fem = /a$|ía$|ina$|en$|ela$|ana$/.test(name.split(" ")[0]) || ["Rocío", "Belén", "Milagros"].includes(name.split(" ")[0]);
    const coach = i % 3 === 2 ? carla : nico;
    const due = T0 + Math.round(-12 + R() * 40) * DAY;
    const u = mk({ temp: i % 5 === 3, name, user: name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "." + (i + 1), gender: fem ? "Femenino" : "Masculino", coachId: coach.id, joined: now - (20 + Math.floor(R() * 300)) * DAY, fee: { planId: plans[i % plans.length], dueAt: due } });
    if (i % 9 === 8) return; /* algunos todavía sin rutina */
    let key = keys[i % keys.length];
    if (fem && key.startsWith("hombres")) key = "mujeres-4";
    if (!fem && key.startsWith("mujeres")) key = "hombres-3";
    const r = assign(u, key, { number: 1, active: true, start: T0 - (5 + Math.floor(R() * 30)) * DAY, coach });
    history(u, r, { from: r.startedAt, to: T0 + (R() > 0.6 ? 0.9 * DAY : -DAY), perWeek: 2 + R() * 3, full: false });
  });

  /* Ana: socia recién aprobada, con rutina pero sin ningún entrenamiento (todo en cero) */
  const ana = mk({ id: "u-ana", name: "Ana Torres", user: "ana", gender: "Femenino", birth: "1999-02-20", coachId: carla.id, joined: now - 2 * DAY, fee: { planId: "p-3x", dueAt: T0 + 28 * DAY } });
  assign(ana, "inicial-3", { number: 1, active: true, start: T0 - DAY, coach: carla, note: "¡Bienvenida! Las primeras semanas usá poco peso y enfocate en la técnica. Cualquier duda, preguntame." });

  /* Solicitudes de alta desde la app (esperan aprobación) */
  mk({ name: "Paula Giménez", user: "paula.gimenez", email: "paula.gimenez@demo.vientos", status: "pendiente", gender: "Femenino", joined: now - 5 * 3600000 });
  mk({ name: "Diego Romero", user: "diego.romero", email: "diego.romero@demo.vientos", status: "pendiente", gender: "Masculino", joined: now - 26 * 3600000 });

  /* Pagos recientes */
  D.users.filter((u) => u.fee && !u.prefs.space).slice(0, 14).forEach((u, i) => {
    const p = D.plans.find((x) => x.id === u.fee.planId);
    D.payments.push({ id: uid("pay"), userId: u.id, planId: p.id, months: 1, amount: p.price, at: u.fee.dueAt - 30 * DAY + (i % 3) * 3600000, by: "u-admin" });
  });

  /* ---------------------------------------------------------- Fitz Club
     Espacio dentro de Vientos: su profe, sus socios, su programa de 6 semanas y sus cobros. */
  const fitz = mk({ id: "u-fitz", role: "profe", name: "Profe Fitz Club", user: "fitz", phone: "2966218045", joined: now - 90 * DAY, space: "fitz" });
  mk({ id: "u-fitz-admin", role: "admin", name: "Dueño Fitz Club", user: "fitzclub", phone: "2966218045", joined: now - 120 * DAY, space: "fitz" });
  const monday = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() - ((d.getDay() + 6) % 7) * DAY; };
  const progStart = monday(T0) - 14 * DAY;                 /* empezó hace dos semanas: hoy está en la semana 3 */
  const fitzProgram = (u, number, extra = {}) => {
    const t = tpl("fitz-sm-6");
    const r = {
      id: uid("r"), userId: u.id, number, personal: false, name: t.name, level: t.level, goal: t.goal, audience: t.audience,
      fromTemplate: t.id, coachId: fitz.id, note: "", active: true, startedAt: progStart, endedAt: null,
      kind: "program", weeks: 6, startAt: progStart, space: "fitz", meta: { ...t.meta, ...extra },
      days: normDays(JSON.parse(JSON.stringify(t.days)).map((d) => { delete d.id; d.blocks.forEach((b) => { delete b.id; b.items.forEach((i) => delete i.id); }); return d; })),
    };
    D.routines.push(r);
    return r;
  };
  /* Historial del programa: lunes A, miércoles B, viernes C, con la carga subiendo cada semana */
  const BASE = { sentadilla: 70, "press-vikingo": 25, "peso-muerto-asimetrico": 20, "remo-90": 45, "caminata-granjero": 24, "thruster-db": 10,
    "press-banca": 55, "peso-muerto-rumano": 70, "bulgara-kb": 12, "rack-chin-up": 0, "transporte-valija": 20, "swing-americano": 16,
    "peso-muerto-trapbar": 90, "press-simultaneo-alterno": 12, "split-db": 14, "remo-polea-dividida": 20, "biceps-press": 8 };
  const programHistory = (u, r, skip = []) => {
    for (let t = progStart; t < T0; t += DAY) {
      const wd = (new Date(t).getDay() + 6) % 7;
      const si = { 0: 0, 2: 1, 4: 2 }[wd];
      if (si === undefined || skip.includes(Math.round((t - progStart) / DAY))) continue;
      const w = Math.floor((t - progStart) / (7 * DAY)) + 1;
      const d = r.days[si], sets = [];
      d.blocks.filter((b) => b.type !== "prep").forEach((b) => b.items.forEach((i0) => {
        const x = i0.wk?.[w - 1] || { s: i0.sets, r: i0.reps };
        const base = BASE[i0.ex] ?? 10;
        const reps = String(x.r).split("/").map((v) => parseInt(v) || 10);
        for (let n = 1; n <= x.s; n++) sets.push({ item: i0.id, ex: i0.ex, set: n, kg: base ? base + (w - 1) * 2.5 : null, reps: reps[(n - 1) % reps.length] });
      }));
      const start = t + 18 * 3600000 + Math.floor(R() * 40) * 60000, min = 55 + Math.floor(R() * 15);
      D.logs.push({ id: uid("l"), userId: u.id, routineId: r.id, dayId: d.id, dayName: d.name, focus: d.focus, startedAt: start, at: start + min * 60000, min, sets, week: w, volume: sets.reduce((a, s) => a + (s.kg || 0) * (s.reps || 0), 0) });
    }
  };
  const ramiro = mk({ id: "u-ramiro", name: "Ramiro Funes", user: "ramiro", gender: "Masculino", birth: "1990-03-21", coachId: fitz.id, joined: progStart - 3 * DAY, space: "fitz", fee: { planId: "p-fitz-3x", dueAt: T0 + 13 * DAY } });
  programHistory(ramiro, fitzProgram(ramiro, 1, { deporte: "Pádel", etapa: "Base" }), [9]);
  ["Marcos Villalba", "Lorena Quiroga", "Diego Paz", "Natalia Ríos"].forEach((name, i) => {
    const u = mk({ name, user: "fitz." + (i + 1), gender: i % 2 ? "Femenino" : "Masculino", coachId: fitz.id, joined: progStart - (10 + i * 7) * DAY, space: "fitz", fee: { planId: "p-fitz-3x", dueAt: T0 + (i * 6 - 4) * DAY } });
    programHistory(u, fitzProgram(u, 1), [2 + i, 11 + i]);
  });
  D.users.filter((u) => u.prefs.space === "fitz" && u.fee).forEach((u, i) => {
    const p = D.plans.find((x) => x.id === u.fee.planId);
    D.payments.push({ id: uid("pay"), userId: u.id, planId: p.id, months: 1, amount: p.price, at: u.fee.dueAt - 30 * DAY + i * 3600000, by: "u-fitz", space: "fitz", list: p.price, from: u.fee.dueAt - 30 * DAY, to: u.fee.dueAt });
  });

  D.notices = [
    { id: uid("n"), at: now - 2 * DAY, title: "Nuevos horarios de ciclo indoor", body: "Sumamos una clase a las 7:00 de lunes a viernes. Reservá tu lugar por WhatsApp." },
    { id: uid("n"), at: now - 1 * DAY, space: "fitz", title: "Nuevo bloque de 6 semanas", body: "El lunes arranca un bloque nuevo. Lo ves en la app o pedile a tu profe la hoja impresa." },
    { id: uid("n"), at: now - 9 * DAY, title: "Sábado de puertas abiertas", body: "Traé a un amigo a entrenar gratis este sábado de 10 a 14." },
  ];
  /* Las rutinas no traen peso: cada socio carga el suyo y la app lo recuerda
     (las cargas de arriba solo sirven para inventar el historial de prueba). */
  const clearKg = (days) => days.forEach((d) => d.blocks.forEach((b) => b.items.forEach((i) => (i.kg = null))));
  D.templates.forEach((t) => clearKg(t.days));
  D.routines.forEach((r) => clearKg(r.days));
  return D;
}

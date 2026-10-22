/* =========================================================================
   ASISTENTE DE VIENTOS (bot sin IA, gratis)
   Funciona en el celular con los datos de la app: entiende palabras clave,
   no manda nada a ningún servidor y no tiene costo por consulta.
   Cada respuesta: { text, chips: [texto a preguntar], actions: [{label, href, icon, ext}] }
   ========================================================================= */
import * as S from "./store.js";
import { fold, fmtKg, fmtDate, fmtRest, relDay, firstName, waNumber, telHref, esc } from "./util.js";

/* Nombres con que la gente llama a los ejercicios */
const ALIASES = {
  "press-banca": ["press de banca", "press banca", "banca", "pecho plano", "press plano"],
  "press-inclinado-manc": ["inclinado", "press inclinado"],
  "press-maquina": ["press de pecho en maquina", "maquina de pecho", "press maquina"],
  "aperturas-polea": ["aperturas", "cruce de poleas", "cruces"],
  fondos: ["fondos", "paralelas"],
  flexiones: ["flexiones", "lagartijas"],
  dominadas: ["dominada", "dominadas", "barra fija"],
  "jalon-pecho": ["jalon", "jalon al pecho", "polea al pecho"],
  "remo-polea-baja": ["remo en polea", "remo polea", "remo bajo", "remo sentado"],
  "remo-barra": ["remo con barra", "remo barra"],
  "remo-mancuerna": ["remo con mancuerna", "serrucho", "remo a una mano"],
  "press-militar": ["militar", "press militar"],
  "press-hombro-manc": ["press de hombro", "press hombro", "press de hombros"],
  "vuelos-laterales": ["vuelos", "laterales", "elevaciones laterales"],
  "face-pull": ["face pull", "facepull"],
  pajaro: ["pajaro", "pajaros", "deltoides posterior"],
  "curl-barra": ["curl con barra", "curl barra"],
  "curl-alterno": ["curl alterno", "curl con mancuernas"],
  "curl-martillo": ["martillo"],
  "triceps-polea": ["triceps en polea", "triceps polea", "extension de triceps"],
  "press-frances": ["frances", "press frances"],
  sentadilla: ["sentadilla", "sentadillas", "squat"],
  "sentadilla-goblet": ["goblet"],
  prensa: ["prensa"],
  "sillon-cuadriceps": ["sillon", "camilla de cuadriceps", "extension de cuadriceps"],
  estocadas: ["estocada", "estocadas", "zancadas"],
  bulgara: ["bulgara", "bulgaras"],
  "peso-muerto-rumano": ["rumano", "peso muerto rumano"],
  "peso-muerto": ["peso muerto"],
  "curl-femoral": ["femoral", "isquios", "camilla de femoral"],
  "hip-thrust": ["hip thrust", "hip", "empuje de cadera"],
  "patada-gluteo": ["patada", "patada de gluteo"],
  abductores: ["abductores", "abduccion"],
  "puente-gluteo": ["puente"],
  "gemelos-pie": ["gemelos", "pantorrillas", "talones"],
  plancha: ["plancha"],
  "crunch-polea": ["crunch", "abdominales en polea"],
  "elevacion-piernas": ["elevacion de piernas", "colgado"],
  "rueda-abdominal": ["rueda"],
  "salto-cajon": ["cajon", "salto al cajon"],
  "swing-kettlebell": ["swing", "kettlebell", "pesa rusa"],
  burpees: ["burpee", "burpees"],
};

const STOP = new Set(["de", "del", "la", "el", "los", "las", "en", "con", "a", "al", "y", "un", "una", "que", "me", "mi", "para", "por", "como", "hago", "pongo", "cuanto", "peso", "hoy"]);

const INTENTS = [
  ["dolor", ["duele", "dolor", "lesion", "molest", "lastime", "tirón", "tiron", "contractura"]],
  ["reemplazo", ["ocupad", "no esta libre", "no hay", "reemplaz", "cambiar", "otro ejercicio", "alternativ", "en vez", "sustitu", "no puedo hacer", "no me gusta"]],
  ["peso", ["peso", "kilo", "kg", "carga", "cuanto pongo", "cuanto levant", "subir"]],
  ["record", ["record", "mejor marca", "maximo", "marca personal"]],
  ["como", ["como se hace", "como hago", "como es", "tecnica", "explica", "instruccion", "video", "postura", "ejecucion"]],
  ["descanso", ["descanso", "descansar", "cuanto espero", "pausa"]],
  ["cuota", ["cuota", "pago", "pagar", "vence", "vencimiento", "debo", "abono", "mensualidad"]],
  ["horario", ["horario", "hora", "abre", "cierra", "abierto", "cerrado", "direccion", "ubicacion", "donde queda", "como llego", "llegar"]],
  ["hoy", ["hoy", "toca", "que hago", "que entreno", "rutina", "dia"]],
  ["progreso", ["progreso", "cuantas veces", "racha", "entrene", "vine", "semana", "constancia"]],
  ["profe", ["profe", "entrenador", "hablar con", "whatsapp", "contacto", "llamar"]],
  ["gracias", ["gracias", "genial", "joya", "buenisimo", "perfecto", "dale"]],
  ["saludo", ["hola", "buenas", "buen dia", "que tal", "ayuda", "que podes", "que sabes"]],
];

export const QUICK = ["¿Qué me toca hoy?", "¿Qué peso pongo?", "¿Cómo se hace un ejercicio?", "La máquina está ocupada", "Mis récords", "Mi cuota", "Horarios", "Hablar con mi profe"];

/* Memoria de la charla: el último ejercicio del que se habló */
const ctx = { ex: null, pending: null };
export function resetBot() { ctx.ex = null; ctx.pending = null; }

/* Ejercicios de la rutina del socio (para priorizar y para los botones) */
function routineItems(u) {
  const r = S.activeRoutine(u.id);
  if (!r) return [];
  const out = [];
  r.days.forEach((d) => d.blocks.forEach((b) => b.items.forEach((i) => out.push({ r, d, b, i }))));
  return out;
}
const findItem = (u, exId) => {
  const all = routineItems(u);
  const next = S.nextDay(u.id);
  return all.find((x) => x.i.ex === exId && x.d.id === next?.id) || all.find((x) => x.i.ex === exId) || null;
};

/* Busca qué ejercicio nombró el socio */
export function matchExercise(text, u) {
  const t = " " + fold(text).replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ") + " ";
  let best = null, score = 0;
  const mine = new Set(routineItems(u).map((x) => x.i.ex));
  for (const e of S.exercisesOf()) {
    let s = 0;
    for (const a of ALIASES[e.id] || []) if (t.includes(" " + fold(a) + " ")) s = Math.max(s, 10 + a.length);
    const words = fold(e.n).split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
    const hit = words.filter((w) => t.includes(" " + w + " ") || t.includes(" " + w.replace(/s$/, "") + " ")).length;
    if (hit) s = Math.max(s, hit * 4 + (hit === words.length ? 6 : 0));
    if (s && mine.has(e.id)) s += 3;
    if (s > score) { score = s; best = e; }
  }
  return score >= 4 ? best : null;
}

function intentOf(text) {
  const t = fold(text);
  for (const [name, keys] of INTENTS) if (keys.some((k) => t.includes(fold(k)))) return name;
  return null;
}

const exLink = (u, exId) => {
  const it = findItem(u, exId);
  return it ? `#/rutina/${it.r.id}/dia/${it.d.id}/ej/${it.i.id}` : null;
};
const todayChips = (u, prefix) => {
  const d = S.nextDay(u.id);
  if (!d) return [];
  return d.blocks.flatMap((b) => b.items).slice(0, 6).map((i) => `${prefix} ${S.exercise(i.ex)?.n || ""}`);
};
/* El gimnasio del socio: Vientos o Fitz Club */
const gym = (u) => S.gymOf(S.spaceOf(u));
const gymShort = (u) => (S.spaceOf(u) === "fitz" ? "Fitz Club" : "Vientos");
const profeAction = (u, text = "Escribir a mi profe") => {
  const c = S.user(u.coachId);
  const n = waNumber(c?.phone || gym(u).whatsapp);
  return { label: c ? text : `Escribir a ${gymShort(u)}`, href: `https://wa.me/${n}?text=${encodeURIComponent(`Hola${c ? " " + firstName(c.name) : ""}! Soy ${u.name}.`)}`, icon: "whatsapp", ext: true };
};

/* Límite superior del rango de repeticiones: "8-10" → 10 */
const topReps = (reps) => { const m = String(reps).match(/(\d+)\s*(?:-\s*(\d+))?/); return m ? +(m[2] || m[1]) : null; };

/* ------------------------------------------------------------ respuestas */
const R = {
  saludo(u) {
    return { text: `¡Hola, ${esc(firstName(u.name))}! Soy el asistente de ${gymShort(u)}. Te puedo ayudar con tu rutina, cuánto peso poner, cómo se hace un ejercicio, qué hacer si la máquina está ocupada, tu cuota y los horarios. Tocá una opción o preguntame.`, chips: QUICK.slice(0, 6) };
  },
  gracias() { return { text: "¡De nada! Buen entrenamiento 💪", chips: ["¿Qué me toca hoy?", "¿Qué peso pongo?"] }; },

  hoy(u) {
    const r = S.activeRoutine(u.id), plan = S.todayPlan(u.id), d = plan?.day;
    if (!r || !d) return { text: "Todavía no tenés rutina asignada. Tu profe te la carga en estos días.", actions: [profeAction(u)] };
    const st = S.dayStats(d);
    const list = d.blocks.flatMap((b) => b.items).map((i) => `• ${esc(S.exercise(i.ex)?.n || "")} — ${i.sets} × ${esc(i.reps)}`).join("<br>");
    const cuando = plan.today ? "Hoy te toca" : `Hoy descansás. El ${S.WEEKDAYS[plan.wd]} te toca`;
    return { text: `${cuando} <b>${esc(d.name)}: ${esc(d.focus)}</b>. Son ${st.ex} ejercicios, unos ${st.min} minutos.<br><br>${list}<br><br>Podés hacerlos en el orden que quieras y saltear los que no puedas.`, actions: [{ label: `Ir a ${d.name}`, href: `#/rutina/${r.id}/dia/${d.id}`, icon: "dumbbell" }], chips: ["¿Qué peso pongo?", "La máquina está ocupada"] };
  },

  peso(u, ex) {
    if (!ex) { ctx.pending = "peso"; return { text: "¿En qué ejercicio? Decime el nombre o elegí uno de hoy:", chips: todayChips(u, "Peso en") }; }
    const last = S.lastSets(u.id, ex.id), best = S.bestOf(u.id, ex.id), it = findItem(u, ex.id);
    const target = it ? topReps(it.i.reps) : null;
    let text;
    if (!last || !last.sets.some((s) => s.kg)) {
      text = `En <b>${esc(ex.n)}</b> todavía no tenés pesos guardados. Empezá con uno que te permita hacer ${it ? `las ${esc(it.i.reps)} repeticiones` : "todas las repeticiones"} con buena técnica y que te queden 2 más "en el tanque". Anotalo y la próxima vez te lo recuerdo.`;
    } else {
      const top = Math.max(...last.sets.map((s) => s.kg || 0));
      const repsAtTop = Math.min(...last.sets.filter((s) => s.kg === top).map((s) => s.reps || 0));
      const done = target && repsAtTop >= target;
      text = `En <b>${esc(ex.n)}</b> la última vez (${esc(relDay(last.at))}) hiciste <b>${fmtKg(top)}${repsAtTop ? ` × ${repsAtTop}` : ""}</b>.`;
      text += done
        ? `<br><br>Completaste las repeticiones: <b>probá con ${fmtKg(top + 2.5)}</b>. Si la técnica se rompe, volvé al peso anterior.`
        : `<br><br>Mantené <b>${fmtKg(top)}</b> hasta completar ${target ? `las ${target} repeticiones` : "todas las repeticiones"} en todas las series; después subí 2,5 kg.`;
      if (best) text += `<br>Tu récord es ${fmtKg(best.kg)}${best.reps ? ` × ${best.reps}` : ""}.`;
    }
    const href = exLink(u, ex.id);
    return { text, actions: href ? [{ label: "Ir al ejercicio", href, icon: "dumbbell" }] : [], chips: [`¿Cómo se hace ${ex.n}?`, "La máquina está ocupada"] };
  },

  como(u, ex) {
    if (!ex) { ctx.pending = "como"; return { text: "¿Qué ejercicio? Decime el nombre o elegí uno de hoy:", chips: todayChips(u, "¿Cómo se hace") }; }
    const steps = (ex.steps || []).map((s, n) => `${n + 1}. ${esc(s)}`).join("<br>");
    const href = exLink(u, ex.id);
    return { text: `<b>${esc(ex.n)}</b> (${esc(ex.g)})<br><br>${steps}${ex.tip ? `<br><br>💡 ${esc(ex.tip)}` : ""}`, actions: href ? [{ label: ex.video ? "Ver el video" : "Ir al ejercicio", href, icon: ex.video ? "video" : "dumbbell" }] : [], chips: [`¿Qué peso pongo en ${ex.n}?`, "La máquina está ocupada"] };
  },

  reemplazo(u, ex) {
    if (!ex) { ctx.pending = "reemplazo"; return { text: "¿Qué máquina o ejercicio no podés hacer?", chips: todayChips(u, "Reemplazar") }; }
    const alts = S.exercisesOf().filter((e) => e.g === ex.g && e.id !== ex.id).sort((a, b) => (a.eq === ex.eq) - (b.eq === ex.eq)).slice(0, 3);
    if (!alts.length) return { text: `No tengo otro ejercicio de ${esc(ex.g)} para sugerirte. Consultalo con tu profe.`, actions: [profeAction(u)] };
    return {
      text: `Si no podés hacer <b>${esc(ex.n)}</b>, cambialo por otro de ${esc(ex.g.toLowerCase())} con las mismas series y repeticiones:<br><br>${alts.map((a) => `• <b>${esc(a.n)}</b> (${esc(a.eq.toLowerCase())})`).join("<br>")}<br><br>O hacé otro ejercicio del día y volvé después.`,
      chips: alts.map((a) => `¿Cómo se hace ${a.n}?`),
    };
  },

  record(u, ex) {
    if (ex) {
      const b = S.bestOf(u.id, ex.id);
      return { text: b ? `Tu récord en <b>${esc(ex.n)}</b> es <b>${fmtKg(b.kg)}${b.reps ? ` × ${b.reps}` : ""}</b>, del ${fmtDate(b.at)}. ¡A superarlo!` : `Todavía no tenés registros en ${esc(ex.n)}.`, chips: [`¿Qué peso pongo en ${ex.n}?`] };
    }
    const recs = S.trackedExercises(u.id).map((id) => ({ e: S.exercise(id), b: S.bestOf(u.id, id) })).filter((x) => x.e && x.b).sort((a, b) => b.b.kg - a.b.kg).slice(0, 6);
    if (!recs.length) return { text: "Todavía no tenés récords: cuando registres tus series con peso aparecen acá." };
    return { text: `Tus mejores marcas:<br><br>${recs.map((x) => `🏆 <b>${esc(x.e.n)}</b>: ${fmtKg(x.b.kg)}`).join("<br>")}`, actions: [{ label: "Ver mi progreso", href: "#/progreso", icon: "trend" }] };
  },

  descanso(u, ex) {
    const it = ex ? findItem(u, ex.id) : null;
    if (it) {
      const rest = it.b.type === "single" ? it.i.rest : it.b.rest;
      return { text: `En <b>${esc(ex.n)}</b> descansá <b>${fmtRest(rest)}</b>${it.b.type !== "single" ? " al terminar la vuelta del bloque" : " entre series"}. Al marcar cada serie arranca el temporizador solo.` };
    }
    return { text: "Cada ejercicio tiene su descanso indicado. Cuando marcás una serie como hecha, arranca el temporizador solo y te avisa con vibración. En general: ejercicios pesados 2–3 min, accesorios 1–1,5 min." };
  },

  cuota(u) {
    const f = S.feeStatus(u), p = S.plan(u.fee?.planId);
    if (!u.fee) return { text: "No tenés una cuota cargada en la app. Consultalo en recepción.", actions: [profeAction(u, `Escribir a ${gymShort(u)}`)] };
    const g = gym(u);
    const msg = u.fee.unpaid ? `Tu cuota (${esc(p?.name || "")}) <b>está pendiente de pago</b>. Pasá por recepción para pagarla.`
      : f.state === "late" ? `Tu cuota (${esc(p?.name || "")}) <b>venció el ${fmtDate(u.fee.dueAt)}</b>. Pasá por recepción para regularizarla.`
      : f.state === "soon" ? `Tu cuota (${esc(p?.name || "")}) <b>vence ${f.days === 0 ? "hoy" : `en ${f.days} ${f.days === 1 ? "día" : "días"}`}</b>, el ${fmtDate(u.fee.dueAt)}.`
      : `Tu cuota (${esc(p?.name || "")}) está <b>al día</b>. Vence el ${fmtDate(u.fee.dueAt)}.`;
    return { text: msg, actions: f.state !== "ok" ? [{ label: "Avisar que pagué", href: `https://wa.me/${waNumber(g.whatsapp || S.user(u.coachId)?.phone || "")}?text=${encodeURIComponent(`Hola! Soy ${u.name}, les aviso que pagué la cuota.`)}`, icon: "whatsapp", ext: true }] : [] };
  },

  horario(u) {
    const g = gym(u), o = S.openNow(g.open);
    return {
      text: `<b>${esc(o.label)}.</b><br><br>${S.hoursList(g.open).map((h) => `${esc(h.d)}: ${esc(h.h)}`).join("<br>")}<br><br>📍 ${esc(g.address)}, ${esc(g.city)}`,
      actions: [{ label: "Cómo llegar", href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${g.address}, ${g.city}`)}`, icon: "pin", ext: true }],
    };
  },

  progreso(u) {
    const logs = S.logsOf(u.id);
    const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
    const month = logs.filter((l) => l.at >= m0.getTime()).length, streak = S.streakWeeks(u.id);
    return {
      text: logs.length ? `Este mes entrenaste <b>${month} ${month === 1 ? "vez" : "veces"}</b>${streak >= 2 ? ` y llevás <b>${streak} semanas seguidas</b> 🔥` : ""}. Tu último entrenamiento fue ${esc(relDay(logs[0].at))}.` : "Todavía no registraste entrenamientos. ¡Hoy es un buen día para empezar!",
      actions: [{ label: "Ver mi progreso", href: "#/progreso", icon: "trend" }],
    };
  },

  profe(u) {
    const c = S.user(u.coachId);
    if (!c) return { text: "Todavía no tenés un profe asignado. Escribile al gimnasio:", actions: [profeAction(u, `Escribir a ${gymShort(u)}`)] };
    return { text: `Tu profe es <b>${esc(c.name)}</b>.`, actions: [profeAction(u, `WhatsApp a ${firstName(c.name)}`), { label: "Llamar", href: telHref(c.phone), icon: "phone", ext: true }] };
  },

  dolor(u) {
    return { text: "Si te duele algo, <b>pará el ejercicio</b>. No te puedo dar indicaciones médicas: contale a tu profe qué sentiste para que adapte la rutina, y si el dolor sigue consultá a un médico.", actions: [profeAction(u, "Avisarle a mi profe")] };
  },

  noEntiendo(u) {
    return { text: "Eso no lo sé todavía 🤔 Puedo ayudarte con tu rutina, pesos, ejercicios, cuota y horarios. Para otras consultas, escribile a tu profe.", actions: [profeAction(u)], chips: QUICK.slice(0, 4) };
  },
};

export function answer(text, u) {
  const ex = matchExercise(text, u);
  let intent = intentOf(text);
  /* "Peso en Sentadilla" o solo "sentadilla" después de que pregunté "¿en qué ejercicio?" */
  if (fold(text).startsWith("peso en")) intent = "peso";
  if (fold(text).startsWith("reemplazar")) intent = "reemplazo";
  if (!intent && ex && ctx.pending) intent = ctx.pending;
  if (!intent && ex) intent = "como";
  if (ex) ctx.ex = ex;
  const useEx = ex || (["peso", "como", "reemplazo", "record", "descanso"].includes(intent) && !/\b(un|algun)\b/.test(fold(text)) ? ctx.ex : null);
  if (intent !== "peso" && intent !== "como" && intent !== "reemplazo") ctx.pending = null;
  else if (useEx) ctx.pending = null;
  const fn = R[intent] || R.noEntiendo;
  return fn(u, intent === "record" ? ex : useEx);
}

export const welcome = (u) => R.saludo(u);

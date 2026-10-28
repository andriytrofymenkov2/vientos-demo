/* Piezas que comparten las pantallas del socio y del panel */
import { icon } from "../core/icons.js";
import { esc, fmtRest } from "../core/util.js";
import * as S from "../core/store.js";
import { BLOCK_TYPES } from "../data/templates.js";
import { EX_IMAGES, EX_CREDITS } from "../data/ex-images.js";

/* Foto de referencia del ejercicio (posición inicial/final), si existe */
/* Las copias de Fitz Club ("fz-…") usan la imagen del original (img) */
const imgKey = (ex) => ex?.img || ex?.id;
export const exCredit = (ex) => (ex && EX_CREDITS?.[imgKey(ex)]) || "";
export const exPhoto = (ex, n = 0) => (ex && EX_IMAGES[imgKey(ex)] > n ? `img/ej/${imgKey(ex)}-${n}.jpg` : null);

const ABBR = { "Pecho": "PEC", "Espalda": "ESP", "Hombros": "HOM", "Bíceps": "BÍC", "Tríceps": "TRÍ", "Cuádriceps": "CUÁ", "Isquiotibiales": "ISQ", "Glúteos": "GLÚ", "Pantorrillas": "PAN", "Abdomen": "ABD", "Core": "CORE", "Movilidad": "MOV", "Potencia": "POT", "Cardio": "CAR" };

/* Ficha cuadrada del grupo muscular */
export function exTile(ex, size = "") {
  const g = ex?.g || "";
  const ph = size !== "xl" && exPhoto(ex);
  if (ph) return `<span class="extile photo ${size}" aria-hidden="true"><img src="${ph}" alt="" loading="lazy" decoding="async"></span>`;
  return `<span class="extile ${size}" data-g="${esc(g)}" aria-hidden="true"><b>${esc(ABBR[g] || "EJ")}</b></span>`;
}

/* Repeticiones por serie: "12,10,8" → ["12","10","8"]; "8-10" → ["8-10"] */
export const repsList = (reps) => String(reps || "").split(/[,;/]/).map((x) => x.trim()).filter(Boolean);
export const repsText = (reps) => repsList(reps).join(" · ");

/* "4 × 8-10" o "4 series: 12 · 10 · 8 · 8" (el peso lo pone cada socio) */
export function target(i) {
  const l = repsList(i.reps);
  return l.length > 1 ? `${i.sets} series: ${esc(l.join(" · "))}` : `${i.sets} × ${esc(i.reps)}`;
}

export const letter = (bi, ii) => String.fromCharCode(65 + bi) + (ii + 1);

export function blockHead(b, bi) {
  if (b.type === "single") return "";
  const t = BLOCK_TYPES[b.type];
  const rounds = b.items[0]?.sets || 1;
  const help = {
    super: "Hacé los ejercicios seguidos y descansá al final de la vuelta.",
    contrast: "Primero el pesado, enseguida el explosivo. Descansá al final del par.",
    circuit: "Pasá de un ejercicio al otro y descansá al terminar la vuelta.",
  }[b.type];
  return `<div class="bhead bt-${b.type}"><span class="slash">${esc(t.label)}</span><span>${rounds} ${rounds === 1 ? "vuelta" : "vueltas"} · descanso ${fmtRest(b.rest)}</span><small>${help}</small></div>`;
}

export function restOf(b, i, idx) {
  if (b.type === "single") return i.rest;
  return idx === b.items.length - 1 ? b.rest : i.rest;
}

/* Lista de un día (la usan el socio y el profe) */
export function dayList(d, { hrefOf, doneOf } = {}) {
  return d.blocks.map((b, bi) => {
    const rows = b.items.map((i, ii) => {
      const ex = S.exercise(i.ex);
      const done = doneOf ? doneOf(i) : 0;
      const full = done >= i.sets;
      const inner = `${exTile(ex)}<span class="exrow-t"><b>${b.type !== "single" ? `<em class="lt">${letter(bi, ii)}</em>` : ""}${esc(ex?.n || "Ejercicio")}</b>
        <small>${target(i)}${b.type === "single" && i.rest ? ` · ${icon("timer", "xs")} ${fmtRest(i.rest)}` : ""}</small>
        ${i.note ? `<small class="exrow-n">${esc(i.note)}</small>` : ""}</span>
        ${doneOf ? `<span class="exrow-s ${full ? "full" : done ? "part" : ""}">${full ? icon("check") : `${done}/${i.sets}`}</span>` : icon("right", "sm")}`;
      return hrefOf ? `<a class="exrow" href="${hrefOf(i)}">${inner}</a>` : `<div class="exrow">${inner}</div>`;
    }).join("");
    return `<div class="blk bt-${b.type}">${blockHead(b, bi)}${rows}</div>`;
  }).join("");
}

export function emptyRoutine(gym) {
  return `<div class="empty">${icon("dumbbell")}<h3>Todavía no tenés rutina</h3><p>Tu profe te la asigna en estos días. Si querés, escribile para coordinar.</p>
    <a class="btn ghost" href="https://wa.me/${gym}" target="_blank" rel="noopener">${icon("whatsapp")} Escribir a Grupo Amplifia</a></div>`;
}

/* ------------------------------------------------- programas por semanas
   Letras como en la planilla de Fitz Club: A1/A2 (fuerza), B1/B2/B3 (accesorios), C1 (EMOM).
   La movilidad y el core no llevan letra. */
export function progLetter(d, bi, ii) {
  const n = d.blocks.slice(0, bi).filter((b) => b.type !== "prep" && b.items.length).length;
  return String.fromCharCode(65 + n) + (ii + 1);
}
/* Prescripción de la semana: "4 × 8", "4 × 30 s" o, en EMOM, "5' · 6/8/10/12/14" */
export function progTarget(b, i) {
  if (b.type === "emom") return `${i.sets}' · ${esc(i.reps)} por minuto`;
  return `${i.sets} × ${esc(i.reps)}`;
}
const PB_HELP = {
  prep: "Entrada en calor: 10 repeticiones de cada uno, sin peso.",
  strength: "Alterná los ejercicios y descansá al terminar cada vuelta.",
  accessory: "Hacelos seguidos y descansá al final de la vuelta.",
  emom: "Cada minuto, al empezar el minuto, hacé las repeticiones que tocan. Descansás lo que sobre.",
};
export function progBlockHead(b) {
  const t = BLOCK_TYPES[b.type];
  const extra = b.type === "strength" || b.type === "accessory" ? ` · descanso ${fmtRest(b.rest)}` : "";
  return `<div class="pbh pb-${b.type}"><span class="slash">${esc(t.label)}</span><small>${PB_HELP[b.type] || ""}${extra}</small></div>`;
}
/* Lista de una sesión del programa (ya con la prescripción de la semana) */
export function programList(d, { hrefOf, doneOf } = {}) {
  return d.blocks.filter((b) => b.items.length).map((b) => {
    const bi = d.blocks.indexOf(b);
    if (b.type === "prep") {
      const col = (c) => b.items.filter((i) => (i.col || "mob") === c).map((i) => {
        const ex = S.exercise(i.ex);
        const inner = `${exTile(ex, "sm")}<span><b>${esc(ex?.n || "Ejercicio")}</b><small>× ${esc(i.reps || "10")}</small></span>`;
        return hrefOf ? `<a class="prep-it" href="${hrefOf(i)}">${inner}</a>` : `<div class="prep-it">${inner}</div>`;
      }).join("");
      return `<div class="pblk pb-prep">${progBlockHead(b)}<div class="prep-cols">
        <div><h4>Movilidad</h4>${col("mob") || `<p class="muted tiny">—</p>`}</div>
        <div><h4>Core</h4>${col("core") || `<p class="muted tiny">—</p>`}</div></div></div>`;
    }
    const rows = b.items.map((i, ii) => {
      const ex = S.exercise(i.ex);
      const done = doneOf ? doneOf(i) : 0, full = done >= i.sets;
      const inner = `${exTile(ex)}<span class="exrow-t"><b><em class="lt">${progLetter(d, bi, ii)}</em>${esc(ex?.n || "Ejercicio")}</b>
        <small>${progTarget(b, i)}</small>${i.note ? `<small class="exrow-n">${esc(i.note)}</small>` : ""}</span>
        ${doneOf ? `<span class="exrow-s ${full ? "full" : done ? "part" : ""}">${full ? icon("check") : `${done}/${i.sets}`}</span>` : icon("right", "sm")}`;
      return hrefOf ? `<a class="exrow" href="${hrefOf(i)}">${inner}</a>` : `<div class="exrow">${inner}</div>`;
    }).join("");
    return `<div class="pblk pb-${b.type}">${progBlockHead(b)}${rows}</div>`;
  }).join("");
}

/* Calendario del programa: las semanas de lunes a domingo, con los días entrenados */
export function trackerHtml(r, logs, { compact = false } = {}) {
  const start = S.programStart(r), weeks = r.weeks || 6, DAYMS = 86400000;
  const trained = new Set(logs.filter((l) => l.routineId === r.id).map((l) => new Date(l.at).toDateString()));
  const today = new Date().toDateString(), now = Date.now();
  const L = ["L", "M", "M", "J", "V", "S", "D"];
  const wk = Array.from({ length: weeks }, (_, w) => `<div class="tk-w ${S.programWeek(r) === w + 1 && now >= start && now <= S.programEnd(r) ? "cur" : ""}">
      <span class="tk-wn">Semana ${w + 1}</span>
      <div class="tk-days">${L.map((l, d) => {
        const t = start + (w * 7 + d) * DAYMS, k = new Date(t).toDateString();
        return `<i class="${trained.has(k) ? "on" : ""} ${k === today ? "tk-today" : ""} ${t > now ? "tk-fut" : ""}" title="${new Date(t).toLocaleDateString("es-AR")}">${compact ? "" : `<small>${l}</small>`}<b>${new Date(t).getDate()}</b></i>`;
      }).join("")}</div></div>`).join("");
  return `<div class="tracker">${wk}</div>`;
}

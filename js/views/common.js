/* Piezas que comparten las pantallas del socio y del panel */
import { icon } from "../core/icons.js";
import { esc, fmtRest } from "../core/util.js";
import * as S from "../core/store.js";
import { BLOCK_TYPES } from "../data/templates.js";

const ABBR = { "Pecho": "PEC", "Espalda": "ESP", "Hombros": "HOM", "Bíceps": "BÍC", "Tríceps": "TRÍ", "Cuádriceps": "CUÁ", "Isquiotibiales": "ISQ", "Glúteos": "GLÚ", "Pantorrillas": "PAN", "Abdomen": "ABD", "Potencia": "POT", "Cardio": "CAR" };

/* Ficha cuadrada del grupo muscular */
export function exTile(ex, size = "") {
  const g = ex?.g || "";
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
    <a class="btn ghost" href="https://wa.me/${gym}" target="_blank" rel="noopener">${icon("whatsapp")} Escribir a Vientos</a></div>`;
}

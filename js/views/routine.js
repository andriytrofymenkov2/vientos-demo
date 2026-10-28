/* Mi rutina: días, ejercicios y registro del entrenamiento */
import { icon, logo, WAVES } from "../core/icons.js";
import { esc, fmtDate, fmtWeekday, fmtRest, fmtKg, relDay, ytId, waNumber, plural, weekStart, dayKey, DAY, $, $$, vibrate } from "../core/util.js";
import * as S from "../core/store.js";
import { me, isStaff } from "../core/auth.js";
import { go, refresh } from "../core/router.js";
import { tag, toast, pageHead, spaceLogo } from "../core/ui.js";
import { startRest, stopRest } from "../core/timer.js";
import { dayList, exTile, exPhoto, exCredit, letter, restOf, emptyRoutine, repsList, repsText, progLetter, programList, trackerHtml } from "./common.js";
import { BLOCK_TYPES } from "../data/templates.js";

/* Busca un ejercicio dentro de la rutina con su bloque y posición */
function locate(r, dayId, itemId) {
  const d = r?.days.find((x) => x.id === dayId);
  if (!d) return null;
  const flat = [];
  d.blocks.forEach((b, bi) => b.items.forEach((i, ii) => flat.push({ b, bi, i, ii })));
  const k = flat.findIndex((f) => f.i.id === itemId);
  return k < 0 ? { d, flat } : { d, flat, k, ...flat[k] };
}

const canSee = (r) => r && (r.userId === me().id || (me().role !== "socio" && S.inSpace(S.user(r.userId))));

/* ------------------------------------------------------------- la rutina */
export function routineView(params) {
  const u = me();
  const r = params.rid ? S.routine(params.rid) : S.activeRoutine(u.id);
  if (params.rid && !canSee(r)) return go("/rutina", { replace: true });
  if (!r) {
    return { title: "Mi rutina", nav: "rutina", html: `${pageHead({ title: "Mi rutina" })}${emptyRoutine(waNumber(S.gymOf(S.spaceOf(u)).whatsapp || S.user(u.coachId)?.phone || ""))}` };
  }
  if (S.isProgram(r)) return programView(u, r);
  const coach = S.user(r.coachId);
  const live = S.session(u.id);
  const plan = r.active ? S.todayPlan(u.id) : null, next = plan?.day || null;
  const doneWeek = new Set(S.logsOf(u.id).filter((l) => l.routineId === r.id && l.at >= weekStart()).map((l) => l.dayId));
  const others = S.routinesOf(u.id).filter((x) => x.id !== r.id);

  const days = r.days.map((d) => {
    const st = S.dayStats(d);
    const state = live?.dayId === d.id ? `<span class="pill live">${icon("bolt", "xs")} En curso</span>`
      : doneWeek.has(d.id) ? `<span class="pill ok">${icon("check", "xs")} Hecho</span>`
      : next?.id === d.id ? `<span class="pill red">${plan.today ? "Hoy" : "Próximo"}</span>` : "";
    return `<a class="dayrow" href="#/rutina/${r.id}/dia/${d.id}">
      <span class="dayrow-n">${esc(d.name)}</span>
      <span class="dayrow-t"><b>${esc(d.focus || "Entrenamiento")}</b><small>${r.active && S.slotsOf(r)[r.days.indexOf(d)] !== undefined ? `<span class="dow">${esc(S.WEEKDAYS[S.slotsOf(r)[r.days.indexOf(d)]])}</span> · ` : ""}${st.ex} ejercicios · ${st.sets} series · ${st.min} min</small></span>
      ${state}${icon("right", "sm")}</a>`;
  }).join("");

  return {
    title: "Mi rutina", nav: "rutina",
    html: `${r.active && r.userId === u.id ? weekStrip(u, r) : ""}<section class="rhero">
        <span class="kicker">${r.active ? "Mi rutina" : `Rutina anterior · ${fmtDate(r.startedAt)} al ${fmtDate(r.endedAt || Date.now())}`}</span>
        <h1>${esc(S.routineTitle(r))}</h1>
        ${r.personal ? `<p class="rhero-sub">${esc(r.name)}</p>` : ""}
        ${coach ? `<p class="rhero-by">${icon("user", "xs")} Armada por ${esc(coach.name)} · desde el ${fmtDate(r.startedAt)}</p>` : ""}
        <a class="btn ghost sm rhero-print" href="#/imprimir/${r.id}">${icon("print", "sm")} Imprimir mi rutina</a>
        ${WAVES}
      </section>
      ${r.note ? `<div class="coachnote">${icon("note")}<p><b>Nota del profe</b>${esc(r.note)}</p></div>` : ""}
      <section class="days">${days}</section>
      ${others.length ? `<section class="sec"><h2 class="sec-t">${r.active ? "Rutinas anteriores" : "Otras rutinas"}</h2>
        ${others.map((x) => `<a class="hrow" href="#/rutina/${x.id}"><span><b>${esc(S.routineTitle(x))}</b><small>${x.active ? "Activa" : `${fmtDate(x.startedAt)} al ${fmtDate(x.endedAt || Date.now())}`}</small></span>${icon("right", "sm")}</a>`).join("")}
      </section>` : ""}`,
  };
}

/* --------------------------------------------------------------- un día */
export function dayView(params) {
  const u = me();
  const r = S.routine(params.rid);
  if (!canSee(r)) return go("/rutina", { replace: true });
  const d = r.days.find((x) => x.id === params.did);
  if (!d) return go("/rutina/" + r.id, { replace: true });
  const live = S.session(u.id);
  const here = live && live.routineId === r.id && live.dayId === d.id;
  const prog = S.isProgram(r), wk = prog ? S.programWeek(r) : 1;
  const dw = prog ? S.weekDay(d, wk) : d;
  const st = S.dayStats(dw);
  const doneOf = here ? (i) => (live.sets[i.id] || []).filter((x) => x?.done).length : null;
  const doneSets = here ? Object.values(live.sets).flat().filter((x) => x?.done).length : 0;
  const elsewhere = live && !here;
  const own = r.userId === u.id;

  return {
    layout: "focus", title: d.name,
    html: `${pageHead({ back: isStaff() ? `#/panel/vista/${r.id}` : `#/rutina${r.active ? "" : "/" + r.id}`, kicker: prog ? `${S.routineTitle(r)} · Semana ${wk} de ${r.weeks || 6}` : S.routineTitle(r), title: d.name })}
      <section class="dayhero">
        <h2>${esc(d.focus || "Entrenamiento")}</h2>
        <div class="chips"><span>${icon("dumbbell", "xs")} ${st.ex} ejercicios</span><span>${icon("repeat", "xs")} ${st.sets} series</span><span>${icon("clock", "xs")} ~${st.min} min</span></div>
        ${here ? `<div class="bar"><i style="width:${Math.min(100, (doneSets / st.sets) * 100)}%"></i></div><small class="muted">${doneSets} de ${st.sets} series hechas</small>` : ""}
      </section>
      <section class="daylist">${prog ? programList(dw, { hrefOf: (i) => `#/rutina/${r.id}/dia/${d.id}/ej/${i.id}`, doneOf }) : dayList(d, { hrefOf: (i) => `#/rutina/${r.id}/dia/${d.id}/ej/${i.id}`, doneOf })}</section>
      ${own && r.active ? `<div class="dock">
        ${here ? `<p class="dock-msg">${icon("check", "xs")} Se guarda solo. Hacé los ejercicios que quieras, en el orden que quieras.</p>
            <button class="btn primary block" type="button" data-act="finish">${icon("check")} Listo por hoy</button>`
          : `${elsewhere ? `<p class="dock-msg">${icon("info", "xs")} Ya empezaste ${esc(S.routine(live.routineId)?.days.find((x) => x.id === live.dayId)?.name || "otro día")}. Si empezás este, aquel queda guardado.</p>` : ""}
            <button class="btn primary block lg" type="button" data-act="start">${icon("play")} Empezar entrenamiento</button>`}
      </div>` : ""}`,
    mount(host) {
      host.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-act]")?.dataset.act;
        if (a === "start") {
          const prev = S.session(u.id);
          if (prev) S.api.finishSession(u.id, prev.lastAt || Date.now());
          S.api.startSession(u.id, r.id, d.id);
          toast("¡A entrenar! Elegí el ejercicio con el que arrancás.");
          refresh();
        }
        if (a === "finish") finish(u.id);
      });
    },
  };
}

/* "Listo por hoy" es opcional: guarda lo marcado aunque sean pocos ejercicios.
   Si no lo toca, se guarda solo al día siguiente o a las 3 horas. */
function finish(userId) {
  stopRest();
  const log = S.api.finishSession(userId);
  if (!log) { toast("No marcaste ninguna serie hoy."); go("/rutina"); return; }
  vibrate(60);
  go("/resumen/" + log.id);
}

/* ------------------------------------------------------- un ejercicio */
export function exerciseView(params) {
  const u = me();
  const r = S.routine(params.rid);
  if (!canSee(r)) return go("/rutina", { replace: true });
  const L = locate(r, params.did, params.iid);
  if (!L || L.k === undefined) return go(`/rutina/${params.rid}/dia/${params.did}`, { replace: true });
  const { d, b, bi, ii, flat, k } = L;
  const prog = S.isProgram(r), wk = prog ? S.programWeek(r) : 1;
  const i = prog ? S.weekItem(L.i, wk) : L.i;
  const isPrep = b.type === "prep", isEmom = b.type === "emom";
  const ex = S.exercise(i.ex) || { n: "Ejercicio", g: "", steps: [], tip: "" };
  const own = r.userId === u.id && r.active;
  const live = S.session(u.id);
  const here = live && live.routineId === r.id && live.dayId === d.id;
  const last = S.lastSets(r.userId, i.ex);
  const best = S.bestOf(r.userId, i.ex);
  const logged = here ? live.sets[i.id] || [] : [];
  const prev = flat[k - 1], next = flat[k + 1];
  const yt = ytId(ex.video);
  const partners = b.type !== "single" ? b.items.filter((x) => x.id !== i.id) : [];
  const rest = restOf(b, i, ii);
  const numeric = !/\b(s|min)$/.test(i.reps.trim());
  const lastMax = last ? Math.max(0, ...last.sets.map((s) => s.kg || 0)) : 0;
  const lastTop = lastMax ? last.sets.find((s) => s.kg === lastMax) : null;
  const perSet = repsList(i.reps);

  const setRows = Array.from({ length: i.sets }, (_, n) => {
    const lg = logged[n] || {};
    const lastKg = last?.sets[n]?.kg ?? last?.sets[last.sets.length - 1]?.kg;
    const kg = lg.kg ?? lastKg ?? "";
    const goal = perSet[n] ?? perSet[perSet.length - 1] ?? i.reps;
    const reps = lg.reps ?? (parseInt(goal) || "");
    return `<div class="setrow ${lg.done ? "done" : ""}" data-set="${n}">
      <span class="setrow-n">${isEmom ? `<small>min</small>${n + 1}` : n + 1}</span>
      <label class="num"><input type="number" inputmode="decimal" step="0.5" min="0" name="kg" value="${esc(kg)}" placeholder="0" ${own ? "" : "disabled"} aria-label="Peso de la serie ${n + 1}"><small>kg</small></label>
      <label class="num"><input type="${numeric ? "number" : "text"}" inputmode="numeric" min="0" name="reps" value="${esc(numeric ? reps : i.reps)}" ${own && numeric ? "" : "disabled"} aria-label="Repeticiones de la serie ${n + 1}"><small>${numeric ? (perSet.length > 1 ? `de ${esc(goal)}` : "reps") : ""}</small></label>
      <button class="setck" type="button" data-done aria-pressed="${!!lg.done}" ${own ? "" : "disabled"} aria-label="Serie ${n + 1} hecha">${icon("check")}</button>
    </div>`;
  }).join("");

  return {
    layout: "focus", title: ex.n,
    html: `${pageHead({ back: `#/rutina/${r.id}/dia/${d.id}`, kicker: prog ? `${d.name} · Semana ${wk} de ${r.weeks || 6}` : `${d.name} · ${k + 1} de ${flat.length}`, title: ex.n })}
      <div class="video">${yt
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1&playsinline=1" title="Video: ${esc(ex.n)}" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
        : exPhoto(ex) ? `<button class="ex-photo" type="button" data-zoom aria-label="Ver la imagen en grande">
            <img class="f0" src="${exPhoto(ex)}" alt="${esc(ex.n)}: posición inicial">
            ${exPhoto(ex, 1) ? `<img class="f1" src="${exPhoto(ex, 1)}" alt="${esc(ex.n)}: posición final">` : ""}
            <span class="ph-tag">${icon("video", "xs")} ${exCredit(ex) ? esc(exCredit(ex)) : "Imagen de referencia · video próximamente"}</span>
            <span class="ph-zoom">${icon("search", "xs")} Tocá para agrandar</span></button>`
        : `<div class="video-ph">${exTile(ex, "xl")}<span>${icon("video", "sm")} Video próximamente</span><small>Lo graba el equipo de ${esc(S.gymOf(S.spaceOf(S.user(r.userId))).name)}</small>${WAVES}</div>`}</div>
      <section class="exhead">
        <div class="tags">${tag(ex.g)}${ex.eq ? tag(ex.eq) : ""}${prog ? (isPrep ? tag(i.col === "core" ? "Core" : "Movilidad", "red") : tag(`${BLOCK_TYPES[b.type].label} · ${progLetter(d, bi, ii)}`, "red")) : b.type !== "single" ? tag(`${BLOCK_TYPES[b.type].label} ${letter(bi, ii)}`, "red") : ""}</div>
        ${isPrep ? `<div class="targets"><div><small>Repeticiones</small><b>${esc(i.reps || "10")}</b></div><div><small>Parte de</small><b>Entrada en calor</b></div></div>`
        : isEmom ? `<div class="targets"><div><small>Minutos</small><b>${i.sets}'</b></div><div><small>Reps por minuto</small><b>${esc(repsText(i.reps))}</b></div><div><small>Descanso</small><b>Lo que sobra</b></div></div>`
        : `<div class="targets">
          <div><small>Series</small><b>${i.sets}</b></div>
          <div><small>Repeticiones</small><b>${esc(repsText(i.reps))}</b></div>
          <div><small>Descanso</small><b>${rest ? fmtRest(rest) : "—"}</b></div>
        </div>`}
        ${partners.length ? `<p class="pair">${icon("swap", "xs")} ${b.type === "contrast" ? "Contraste con" : "Se hace junto con"} ${partners.map((x) => `<a href="#/rutina/${r.id}/dia/${d.id}/ej/${x.id}">${esc(S.exercise(x.ex)?.n || "")}</a>`).join(" y ")}</p>` : ""}
        ${i.note ? `<div class="coachnote sm">${icon("note")}<p><b>Indicación del profe</b>${esc(i.note)}</p></div>` : ""}
      </section>
      ${isPrep ? `<p class="muted center prep-note">${icon("info", "xs")} Hacelo antes del bloque de fuerza, sin peso. No hace falta anotar nada.</p>` : `<section class="sets">
        <div class="sets-h"><h2>${isEmom ? "Minutos" : "Series"}</h2>${last ? "" : `<span class="muted">Primera vez: poné el peso que uses vos. Queda guardado para la próxima.</span>`}</div>
        <div class="setlist">${setRows}</div>
        ${best || lastTop ? `<div class="marks">
          ${best ? `<div class="mark-pr"><small>${icon("trophy", "xs")} Tu récord</small><b>${fmtKg(best.kg)}${best.reps ? ` × ${best.reps}` : ""}</b><small>${esc(relDay(best.at))}</small></div>` : ""}
          ${lastTop ? `<div><small>${icon("clock", "xs")} Última vez</small><b>${fmtKg(lastTop.kg)}${lastTop.reps ? ` × ${lastTop.reps}` : ""}</b><small>${esc(relDay(last.at))}</small></div>` : ""}
        </div>` : ""}
      </section>
      ${prog ? weekGrid(r, L.i, b, wk) : ""}`}
      <section class="howto">
        <details ${own ? "" : "open"}><summary>${icon("info", "sm")} Cómo se hace</summary>
          <ol>${(ex.steps || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
          ${ex.tip ? `<p class="tip"><b>Consejo:</b> ${esc(ex.tip)}</p>` : ""}
          ${ex.sec ? `<p class="muted tiny">También trabaja: ${esc(ex.sec)}</p>` : ""}
        </details>
      </section>
      ${prev || next ? `<nav class="exnav ${prev && next ? "" : "one"}">
        ${prev ? `<a class="exnav-b prev" href="#/rutina/${r.id}/dia/${d.id}/ej/${prev.i.id}">${icon("left")}<span><b>Anterior</b><small>${esc(S.exercise(prev.i.ex)?.n || "")}</small></span></a>` : ""}
        ${next ? `<a class="exnav-b next" href="#/rutina/${r.id}/dia/${d.id}/ej/${next.i.id}"><span><b>Siguiente</b><small>${esc(S.exercise(next.i.ex)?.n || "")}</small></span>${icon("right")}</a>` : ""}
      </nav>` : ""}`,
    mount(host) {
      host.querySelector("[data-zoom]")?.addEventListener("click", () => zoomPhotos(ex));
      if (!own) return;
      const ensure = () => {
        const s = S.session(u.id);
        /* Si había otro día abierto, se guarda solo y arranca este */
        if (s && (s.routineId !== r.id || s.dayId !== d.id)) S.api.finishSession(u.id, s.lastAt || Date.now());
        if (!S.session(u.id)) { S.api.startSession(u.id, r.id, d.id); toast("Empezaste el entrenamiento de hoy"); }
        return true;
      };
      const read = (row) => ({ kg: parseFloat(row.querySelector("[name=kg]").value.replace(",", ".")) || null, reps: numeric ? parseInt(row.querySelector("[name=reps]").value) || null : null });
      $$(".setrow input", host).forEach((inp) => inp.addEventListener("change", () => {
        const row = inp.closest(".setrow");
        if (!S.session(u.id) || !row.classList.contains("done")) return;
        S.api.logSet(u.id, i.id, +row.dataset.set, read(row));
      }));
      host.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-done]");
        if (!btn) return;
        if (!ensure()) return;
        const row = btn.closest(".setrow"), n = +row.dataset.set;
        const on = !row.classList.contains("done");
        row.classList.toggle("done", on);
        btn.setAttribute("aria-pressed", on);
        S.api.logSet(u.id, i.id, n, { ...read(row), done: on });
        if (on) {
          vibrate(25);
          /* El peso de esta serie se copia a las siguientes que no se tocaron */
          const kg = read(row).kg;
          $$(".setrow", host).slice(n + 1).forEach((x) => { if (!x.classList.contains("done") && kg) x.querySelector("[name=kg]").value = kg; });
          const lastSet = n === i.sets - 1;
          const nm = next && b.type !== "single" && next.b === b ? S.exercise(next.i.ex)?.n : null;
          if (rest && !(lastSet && b.type === "single" && !next)) startRest(rest, nm ? `Ahora: ${nm}` : "Descanso");
          if (b.type !== "single" && ii < b.items.length - 1 && next) {
            setTimeout(() => go(`/rutina/${r.id}/dia/${d.id}/ej/${next.i.id}`), 450);
          } else if (b.type !== "single" && ii === b.items.length - 1 && n < i.sets - 1) {
            toast("Vuelta completa. Al terminar el descanso volvé al primero del bloque.");
          } else if (lastSet && next && b.type === "single") {
            toast("¡Ejercicio completo!");
          }
        }
      });
    },
  };
}

/* ------------------------------------------------- programa por semanas
   Pantalla "Mi rutina" cuando el profe asignó un programa (Fitz Club): semana actual,
   calendario de las semanas, los días y datos del programa. */
function programView(u, r) {
  const own = r.userId === u.id;
  const N = r.weeks || 6, wk = S.programWeek(r);
  const start = S.programStart(r), end = S.programEnd(r), now = Date.now();
  const logs = S.logsOf(r.userId).filter((l) => l.routineId === r.id);
  const coach = S.user(r.coachId), m = r.meta || {};
  const total = r.days.length * N, pct = Math.min(100, Math.round((logs.length / Math.max(1, total)) * 100));
  const live = S.session(r.userId);
  const plan = r.active && own ? S.todayPlan(u.id) : null, next = plan?.day || null;
  const doneWeek = new Set(logs.filter((l) => l.at >= weekStart()).map((l) => l.dayId));
  const others = S.routinesOf(r.userId).filter((x) => x.id !== r.id);
  const state = now < start ? `Empieza el ${fmtDate(start)}` : now > end ? "Programa terminado" : `Semana ${wk} de ${N}`;
  const sessions = r.days.map((d) => {
    const st = S.dayStats(S.weekDay(d, wk));
    const pill = live?.dayId === d.id ? `<span class="pill live">${icon("bolt", "xs")} En curso</span>`
      : doneWeek.has(d.id) ? `<span class="pill ok">${icon("check", "xs")} Hecha</span>`
      : next?.id === d.id ? `<span class="pill red">Hoy</span>` : "";
    return `<a class="dayrow" href="#/rutina/${r.id}/dia/${d.id}">
      <span class="dayrow-n">${esc(d.name)}</span>
      <span class="dayrow-t"><b>${esc(d.name)}${d.focus ? ` · ${esc(d.focus)}` : ""}</b><small>${st.ex} ejercicios · ~${st.min} min</small></span>
      ${pill}${icon("right", "sm")}</a>`;
  }).join("");
  const metaRow = [["Deporte", m.deporte], ["Método", m.metodo], ["Etapa", m.etapa]].filter(([, v]) => v);
  return {
    title: "Mi programa", nav: "rutina",
    html: `<section class="rhero prog-hero">
        <span class="kicker">${r.active ? `${esc(S.spaceInfo(r.space || "fitz").name)} · Programa de ${N} semanas` : `Programa anterior · ${fmtDate(start)} al ${fmtDate(end)}`}</span>
        <h1>${esc(S.routineTitle(r))}</h1>
        ${metaRow.length ? `<div class="prog-meta">${metaRow.map(([k, v]) => `<span><small>${k}</small><b>${esc(v)}</b></span>`).join("")}</div>` : ""}
        ${coach ? `<p class="rhero-by">${icon("user", "xs")} Armado por ${esc(coach.name)} · del ${fmtDate(start)} al ${fmtDate(end, { year: true })}</p>` : ""}
        <a class="btn ghost sm rhero-print" href="#/imprimir/${r.id}">${icon("print", "sm")} Imprimir mi programa</a>
      </section>
      <section class="card prog-week">
        <div class="card-h"><h2>${esc(state)}</h2><span class="muted">${logs.length} de ${total} entrenamientos</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </section>
      <section class="card"><div class="card-h"><h2>${icon("calendar", "sm")} Calendario del programa</h2><span class="muted">${plural(new Set(logs.map((l) => new Date(l.at).toDateString())).size, "día entrenado", "días entrenados")}</span></div>
        ${trackerHtml(r, logs)}
      </section>
      ${r.note ? `<div class="coachnote">${icon("note")}<p><b>Nota del profe</b>${esc(r.note)}</p></div>` : ""}
      <section class="days">${sessions}</section>
      ${others.length ? `<section class="sec"><h2 class="sec-t">Anteriores</h2>
        ${others.map((x) => `<a class="hrow" href="#/rutina/${x.id}"><span><b>${esc(S.routineTitle(x))}</b><small>${x.active ? "Activa" : `${fmtDate(x.startedAt)} al ${fmtDate(x.endedAt || Date.now())}`}</small></span>${icon("right", "sm")}</a>`).join("")}
      </section>` : ""}`,
  };
}

/* Grilla de cargas por semana de un ejercicio: lo que anotó el socio en cada semana del programa */
function weekGrid(r, item, b, wk) {
  const N = r.weeks || 6, loads = S.weekLoads(r.userId, r, item.id);
  const maxSets = Math.min(6, Math.max(...Array.from({ length: N }, (_, w) => S.weekItem(item, w + 1).sets)));
  const rows = Array.from({ length: N }, (_, w) => {
    const x = S.weekItem(item, w + 1), got = loads[w + 1];
    const cells = Array.from({ length: maxSets }, (_, n) => { const s = got?.sets.find((y) => y.set === n + 1); return `<td>${s?.kg ? fmtKg(s.kg).replace(" kg", "") : s ? "✓" : ""}</td>`; }).join("");
    return `<tr class="${w + 1 === wk ? "cur" : ""}"><th>Sem ${w + 1}</th><td class="gx">${b.type === "emom" ? `${x.sets}' · ${esc(x.reps)}` : `${x.sets} × ${esc(x.reps)}`}</td>${cells}</tr>`;
  }).join("");
  return `<section class="wgrid">
    <div class="sets-h"><h2>Mis cargas por semana</h2><span class="muted">kg de cada ${b.type === "emom" ? "minuto" : "serie"}</span></div>
    <div class="wgrid-sc"><table><thead><tr><th>Semana</th><th>Plan</th>${Array.from({ length: maxSets }, (_, n) => `<th>${b.type === "emom" ? "Min" : "Serie"} ${n + 1}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

/* ------------------------------------------------------- resumen final */
export function summaryView(params) {
  const u = me();
  const log = S.db.logs.find((l) => l.id === params.id && l.userId === u.id);
  if (!log) return go("/inicio", { replace: true });
  const exIds = [...new Set(log.sets.map((s) => s.ex))];
  const prs = exIds.map((id) => {
    const top = Math.max(0, ...log.sets.filter((s) => s.ex === id).map((s) => s.kg || 0));
    const before = Math.max(0, ...S.db.logs.filter((l) => l.userId === u.id && l.id !== log.id && l.at < log.at).flatMap((l) => l.sets.filter((s) => s.ex === id).map((s) => s.kg || 0)));
    return top > 0 && top > before && before > 0 ? { ex: S.exercise(id), top, before } : null;
  }).filter(Boolean);
  const streak = S.streakWeeks(u.id);
  return {
    layout: "focus", title: "¡Entrenamiento terminado!",
    html: `<section class="finish">
        <div class="finish-badge">${icon("checkc")}</div>
        <span class="kicker">${esc(log.dayName)} · ${esc(log.focus)}</span>
        <h1>¡Buen entrenamiento!</h1>
        <div class="stats3 big">
          <div><b>${log.min}</b><small>minutos</small></div>
          <div><b>${log.sets.length}</b><small>series</small></div>
          <div><b>${log.volume ? Math.round(log.volume).toLocaleString("es-AR") : "—"}</b><small>kg movidos</small></div>
        </div>
        ${prs.length ? `<div class="prs"><h2>${icon("trophy", "sm")} ${prs.length === 1 ? "Nuevo récord" : "Nuevos récords"}</h2>${prs.map((p) => `<p><b>${esc(p.ex?.n)}</b><span>${fmtKg(p.before)} → <em>${fmtKg(p.top)}</em></span></p>`).join("")}</div>` : ""}
        ${streak >= 2 ? `<p class="streak">${icon("flame")} ${streak} semanas seguidas entrenando</p>` : ""}
        <a class="btn primary block lg" href="#/inicio">Listo</a>
        <a class="btn ghost block" href="#/progreso">Ver mi progreso</a>
      </section>`,
  };
}

/* Semana de lunes a domingo con la fecha real: hoy marcado y qué día de la
   rutina hizo cada día. Cada lunes arranca de cero (los kilos quedan guardados). */
function weekStrip(u, r) {
  const w0 = weekStart(), today = dayKey();
  const L = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const logs = S.logsOf(u.id).filter((l) => l.at >= w0);
  const nameOf = (l) => (r.days.find((d) => d.id === l.dayId)?.name || l.dayName || "").replace(/^Día\s*/i, "D");
  const cells = L.map((lab, i) => {
    const t = w0 + i * DAY, k = dayKey(t);
    const done = logs.filter((l) => dayKey(l.at) === k);
    const fut = k > today;
    return `<div class="wd ${k === today ? "is-today" : ""} ${done.length ? "on" : ""} ${fut ? "fut" : ""}">
      <small>${lab}</small><b>${new Date(t).getDate()}</b><i>${done.length ? esc(done.map(nameOf).join(" ")) : k === today ? "Hoy" : ""}</i></div>`;
  }).join("");
  return `<section class="weekstrip" aria-label="Esta semana">
      <div class="weekstrip-h"><b>Esta semana</b><span>Hoy es <em>${fmtWeekday(Date.now())} ${new Date().getDate()}</em></span></div>
      <div class="wds">${cells}</div>
    </section>`;
}

/* Imagen de referencia a pantalla completa: posición inicial y final, una debajo de la otra */
function zoomPhotos(ex) {
  const el = document.createElement("div");
  el.className = "zoom";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", ex.n);
  el.innerHTML = `<div class="zoom-in">
      <figure><img src="${exPhoto(ex)}" alt="${esc(ex.n)}: posición inicial"><figcaption>Así empezás</figcaption></figure>
      ${exPhoto(ex, 1) ? `<figure><img src="${exPhoto(ex, 1)}" alt="${esc(ex.n)}: posición final"><figcaption>Así terminás</figcaption></figure>` : ""}
    </div>
    <button class="btn primary block lg zoom-x" type="button">${icon("x")} Cerrar</button>`;
  const close = () => { el.remove(); removeEventListener("hashchange", close); };
  el.querySelector(".zoom-x").addEventListener("click", close);
  addEventListener("hashchange", close);
  document.body.append(el);
}


/* ------------------------------------------------- rutina para imprimir (A4)
   Hoja prolija con el logo de Vientos: datos del socio, un recuadro por día y
   un casillero vacío por serie para anotar los kilos a mano. Se usa "Imprimir" /
   "Guardar como PDF" del navegador o del celular. */
export function printView(params, query = {}) {
  const r = S.routine(params.rid);
  if (!canSee(r)) return go("/rutina", { replace: true });
  if (S.isProgram(r)) return programPrint(r, query);
  const owner = S.user(r.userId), coach = S.user(r.coachId), g = S.db.gym;
  const back = isStaff() ? `#/panel/socios/${r.userId}` : "#/rutina";
  const dayHtml = (d) => {
    const st = S.dayStats(d);
    const rows = d.blocks.map((b, bi) => {
      const head = b.type === "single" ? "" : `<tr class="p-bh"><td colspan="5"><b>${esc(BLOCK_TYPES[b.type].label)}</b> · ${b.items[0]?.sets || 1} ${(b.items[0]?.sets || 1) === 1 ? "vuelta" : "vueltas"} · descanso ${fmtRest(b.rest)}</td></tr>`;
      const items = b.items.map((i, ii) => {
        const ex = S.exercise(i.ex);
        const list = repsList(i.reps);
        return `<tr>
          <td class="p-n">${b.type !== "single" ? `<em>${letter(bi, ii)}</em>` : ""}<b>${esc(ex?.n || "Ejercicio")}</b>${i.note ? `<small>${esc(i.note)}</small>` : ""}</td>
          <td class="p-c">${i.sets}</td>
          <td class="p-c">${esc(list.length > 1 ? list.join(" · ") : i.reps)}</td>
          <td class="p-c">${restOf(b, i, ii) ? fmtRest(restOf(b, i, ii)) : "—"}</td>
          <td class="p-kg">${Array.from({ length: Math.min(i.sets, 6) }, () => "<i></i>").join("")}</td></tr>`;
      }).join("");
      return head + items;
    }).join("");
    return `<section class="p-day">
      <header><span class="p-dn">${esc(d.name)}</span><h2>${esc(d.focus || "Entrenamiento")}</h2><small>${st.ex} ejercicios · ${st.sets} series · ~${st.min} min</small></header>
      <table><thead><tr><th>Ejercicio</th><th>Series</th><th>Repeticiones</th><th>Descanso</th><th>Kilos (anotá cada serie)</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`;
  };
  return {
    layout: "print", title: `Rutina · ${owner?.name || ""}`,
    html: `<div class="p-bar no-print">
        <a class="btn ghost sm" href="${back}">${icon("left", "sm")} Volver</a>
        <span class="muted">Se imprime en hoja A4. En el celular elegí "Guardar como PDF" o "Imprimir".</span>
        <button class="btn primary" type="button" data-print>${icon("print", "sm")} Imprimir / Guardar PDF</button>
      </div>
      <article class="p-sheet">
        <header class="p-head">
          <div class="p-logo">${logo()}</div>
          <div class="p-title"><span>Rutina de entrenamiento</span><h1>${esc(S.routineTitle(r))}</h1></div>
        </header>
        <section class="p-info">
          <div><small>Socio</small><b>${esc(owner?.name || "")}</b></div>
          <div><small>Profe</small><b>${esc(coach?.name || "—")}</b></div>
          <div><small>Desde</small><b>${fmtDate(r.startedAt, { year: true })}</b></div>
          <div><small>Días por semana</small><b>${r.days.length}</b></div>
        </section>
        ${r.note ? `<p class="p-note"><b>Nota del profe:</b> ${esc(r.note)}</p>` : ""}
        ${r.days.map(dayHtml).join("")}
        <footer class="p-foot">
          <span>Vientos GYM · ${esc(g.address || "")}, ${esc(g.city || "")}</span>
          <span>WhatsApp ${esc(g.whatsapp || "")} · @${esc(g.instagram || "vientosgym")}</span>
        </footer>
      </article>`,
    mount(host) { host.querySelector("[data-print]")?.addEventListener("click", () => window.print()); },
  };
}

/* ------------------------------------------------ programa impreso (A4)
   Misma línea que la rutina impresa de Vientos, con la marca del espacio: datos del
   socio, asistencia (un casillero por sesión y semana) y una tabla por sesión con la
   progresión de las semanas y un recuadro para anotar los kilos. Sale en blanco para
   seguir con lápiz y papel, o con las cargas que ya anotó en la app. */
function programPrint(r, query) {
  const owner = S.user(r.userId), coach = S.user(r.coachId), m = r.meta || {}, g = S.gymOf(S.spaceOf(owner));
  const sp = S.spaceInfo(r.space || "fitz");
  const N = r.weeks || 6, filled = query.cargas === "1";
  const back = isStaff() ? `#/panel/socios/${r.userId}` : "#/rutina";
  const logs = S.logsOf(r.userId).filter((l) => l.routineId === r.id);
  const start = S.programStart(r), end = S.programEnd(r);
  const weeks = Array.from({ length: N }, (_, w) => w + 1);
  const short = (t) => new Date(t).toLocaleDateString("es-AR", { day: "numeric", month: "numeric" });
  const kg = (n) => String(n).replace(".", ",");

  /* Asistencia: qué sesiones se hicieron cada semana */
  const done = {};
  logs.forEach((l) => { const w = l.week || S.programWeek(r, l.at); (done[w] ||= new Set()).add(l.dayId); });
  const att = `<table class="pg-att"><thead><tr><th></th>${weeks.map((w) => `<th>Semana ${w}<small>${short(start + (w - 1) * 7 * DAY)} al ${short(start + ((w - 1) * 7 + 6) * DAY)}</small></th>`).join("")}</tr></thead>
    <tbody>${r.days.map((d) => `<tr><th>${esc(d.name)}</th>${weeks.map((w) => `<td><i class="${filled && done[w]?.has(d.id) ? "on" : ""}"></i></td>`).join("")}</tr>`).join("")}</tbody></table>`;

  const rx = (b, x) => (b.type === "emom" ? `${x.sets} min<br>${esc(x.reps).replace(/\//g, "/<wbr>")}` : `${x.sets} × ${esc(x.reps)}`);
  const sessionHtml = (d) => {
    const st = S.dayStats(S.weekDay(d, 1));
    const prep = d.blocks.find((b) => b.type === "prep" && b.items.length);
    const col = (c) => prep.items.filter((i) => (i.col || "mob") === c).map((i) => `<li>${esc(S.exercise(i.ex)?.n || "Ejercicio")}<b>× ${esc(i.reps || "10")}</b></li>`).join("") || "<li>—</li>";
    const rows = d.blocks.map((b, bi) => {
      if (b.type === "prep" || !b.items.length) return "";
      const head = `<tr class="p-bh"><td colspan="${N + 1}"><b>${esc(BLOCK_TYPES[b.type]?.label || b.type)}</b>${b.type === "emom" ? " · minutos × reps por minuto" : ` · series × repeticiones${b.rest ? ` · descanso ${fmtRest(b.rest)}` : ""}`}</td></tr>`;
      return head + b.items.map((it, ii) => {
        const ex = S.exercise(it.ex), loads = S.weekLoads(r.userId, r, it.id);
        return `<tr><td class="p-n"><em>${progLetter(d, bi, ii)}</em><b>${esc(ex?.n || "Ejercicio")}</b>${it.note ? `<small>${esc(it.note)}</small>` : ""}</td>
          ${weeks.map((w) => { const got = filled ? loads[w]?.sets.map((y) => y.kg).filter(Boolean) : null;
            return `<td class="pg-c"><span>${rx(b, S.weekItem(it, w))}</span><i>${got?.length ? `${kg(Math.max(...got))} kg` : ""}</i></td>`; }).join("")}</tr>`;
      }).join("");
    }).join("");
    return `<section class="p-day pg-day">
      <header><span class="p-dn">${esc(d.name)}</span><h2>${esc(d.focus || "Entrenamiento")}</h2><small>${st.ex} ejercicios · ~${st.min} min</small></header>
      ${prep ? `<div class="pg-prep"><div><h4>Movilidad</h4><ul>${col("mob")}</ul></div><div><h4>Core</h4><ul>${col("core")}</ul></div></div>` : ""}
      <table class="pg-t"><thead><tr><th>Ejercicio</th>${weeks.map((w) => `<th>Sem ${w}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
    </section>`;
  };

  return {
    layout: "print", title: `Programa · ${owner?.name || ""}`,
    html: `<div class="p-bar no-print">
        <a class="btn ghost sm" href="${back}">${icon("left", "sm")} Volver</a>
        <div class="seg-mini" role="group" aria-label="Qué imprimir">
          <a class="${filled ? "" : "on"}" href="#/imprimir/${r.id}">En blanco (para anotar a mano)</a>
          <a class="${filled ? "on" : ""}" href="#/imprimir/${r.id}?cargas=1">${isStaff() ? "Con las cargas anotadas" : "Con mis cargas"}</a>
        </div>
        <button class="btn primary" type="button" data-print>${icon("print", "sm")} Imprimir / Guardar PDF</button>
      </div>
      <article class="p-sheet pg-sheet">
        <header class="p-head">
          <div class="p-logo pg-logo">${spaceLogo(r.space || "fitz")}</div>
          <div class="p-title"><span>${esc(sp.name)} · Programa de ${N} semanas</span><h1>${esc(S.routineTitle(r))}</h1></div>
        </header>
        <section class="p-info">
          <div><small>Socio</small><b>${esc(owner?.name || "")}</b></div>
          <div><small>Profe</small><b>${esc(coach?.name || "—")}</b></div>
          <div><small>Deporte · etapa</small><b>${esc([m.deporte, m.etapa].filter(Boolean).join(" · ") || "—")}</b></div>
          <div><small>Programa</small><b>${fmtDate(start)} al ${fmtDate(end, { year: true })}</b></div>
        </section>
        ${r.note ? `<p class="p-note"><b>Nota del profe:</b> ${esc(r.note)}</p>` : ""}
        <section class="pg-box"><h3>Asistencia <small>marcá cada sesión que hiciste</small></h3>${att}</section>
        <p class="pg-how">En cada semana figura lo que toca (series × repeticiones). En el recuadro de abajo anotá los kilos que usaste.</p>
        ${r.days.map(sessionHtml).join("")}
        <footer class="p-foot">
          <span>${esc(sp.name)} · ${esc(g.address || "")}, ${esc(g.city || "")}</span>
          <span>${esc(owner?.name || "")} · ${esc(S.routineTitle(r))}</span>
        </footer>
      </article>`,
    mount(host) { host.querySelector("[data-print]")?.addEventListener("click", () => window.print()); },
  };
}

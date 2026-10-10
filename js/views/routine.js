/* Mi rutina: días, ejercicios y registro del entrenamiento */
import { icon, WAVES } from "../core/icons.js";
import { esc, fmtDate, fmtRest, fmtKg, relDay, ytId, waNumber, plural, weekStart, dayKey, DAY, $, $$, vibrate } from "../core/util.js";
import * as S from "../core/store.js";
import { me, isStaff } from "../core/auth.js";
import { go, refresh } from "../core/router.js";
import { tag, toast, pageHead } from "../core/ui.js";
import { startRest, stopRest } from "../core/timer.js";
import { dayList, exTile, letter, restOf, emptyRoutine, repsList, repsText } from "./common.js";
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

const canSee = (r) => r && (r.userId === me().id || me().role !== "socio");

/* ------------------------------------------------------------- la rutina */
export function routineView(params) {
  const u = me();
  const r = params.rid ? S.routine(params.rid) : S.activeRoutine(u.id);
  if (params.rid && !canSee(r)) return go("/rutina", { replace: true });
  if (!r) {
    return { title: "Mi rutina", nav: "rutina", html: `${pageHead({ title: "Mi rutina" })}${emptyRoutine(waNumber(S.db.gym.whatsapp))}` };
  }
  const coach = S.user(r.coachId);
  const live = S.session(u.id);
  const next = r.active ? S.nextDay(u.id) : null;
  const doneWeek = new Set(S.logsOf(u.id).filter((l) => l.routineId === r.id && l.at >= weekStart()).map((l) => l.dayId));
  const others = S.routinesOf(u.id).filter((x) => x.id !== r.id);

  const days = r.days.map((d) => {
    const st = S.dayStats(d);
    const state = live?.dayId === d.id ? `<span class="pill live">${icon("bolt", "xs")} En curso</span>`
      : doneWeek.has(d.id) ? `<span class="pill ok">${icon("check", "xs")} Hecho</span>`
      : next?.id === d.id ? `<span class="pill red">Próximo</span>` : "";
    return `<a class="dayrow" href="#/rutina/${r.id}/dia/${d.id}">
      <span class="dayrow-n">${esc(d.name)}</span>
      <span class="dayrow-t"><b>${esc(d.focus || "Entrenamiento")}</b><small>${st.ex} ejercicios · ${st.sets} series · ${st.min} min</small></span>
      ${state}${icon("right", "sm")}</a>`;
  }).join("");

  return {
    title: "Mi rutina", nav: "rutina",
    html: `${r.active && r.userId === u.id ? weekStrip(u, r) : ""}<section class="rhero">
        <span class="kicker">${r.active ? "Mi rutina" : `Rutina anterior · ${fmtDate(r.startedAt)} al ${fmtDate(r.endedAt || Date.now())}`}</span>
        <h1>${esc(S.routineTitle(r))}</h1>
        ${r.personal ? `<p class="rhero-sub">${esc(r.name)}</p>` : ""}
        <div class="tags">${tag(r.level)}${r.goal ? tag(r.goal) : ""}${tag(plural(r.days.length, "día", "días"))}${r.personal ? tag("Personalizada", "red") : ""}</div>
        ${coach ? `<p class="rhero-by">${icon("user", "xs")} Armada por ${esc(coach.name)} · desde el ${fmtDate(r.startedAt)}</p>` : ""}
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
  const st = S.dayStats(d);
  const doneOf = here ? (i) => (live.sets[i.id] || []).filter((x) => x?.done).length : null;
  const doneSets = here ? Object.values(live.sets).flat().filter((x) => x?.done).length : 0;
  const elsewhere = live && !here;
  const own = r.userId === u.id;

  return {
    layout: "focus", title: d.name,
    html: `${pageHead({ back: isStaff() ? `#/panel/vista/${r.id}` : `#/rutina${r.active ? "" : "/" + r.id}`, kicker: S.routineTitle(r), title: d.name })}
      <section class="dayhero">
        <h2>${esc(d.focus || "Entrenamiento")}</h2>
        <div class="chips"><span>${icon("dumbbell", "xs")} ${st.ex} ejercicios</span><span>${icon("repeat", "xs")} ${st.sets} series</span><span>${icon("clock", "xs")} ~${st.min} min</span></div>
        ${here ? `<div class="bar"><i style="width:${Math.min(100, (doneSets / st.sets) * 100)}%"></i></div><small class="muted">${doneSets} de ${st.sets} series hechas</small>` : ""}
      </section>
      <section class="daylist">${dayList(d, { hrefOf: (i) => `#/rutina/${r.id}/dia/${d.id}/ej/${i.id}`, doneOf })}</section>
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
  const { d, b, bi, i, ii, flat, k } = L;
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
  const perSet = repsList(i.reps);

  const setRows = Array.from({ length: i.sets }, (_, n) => {
    const lg = logged[n] || {};
    const lastKg = last?.sets[n]?.kg ?? last?.sets[last.sets.length - 1]?.kg;
    const kg = lg.kg ?? lastKg ?? "";
    const goal = perSet[n] ?? perSet[perSet.length - 1] ?? i.reps;
    const reps = lg.reps ?? (parseInt(goal) || "");
    return `<div class="setrow ${lg.done ? "done" : ""}" data-set="${n}">
      <span class="setrow-n">${n + 1}</span>
      <label class="num"><input type="number" inputmode="decimal" step="0.5" min="0" name="kg" value="${esc(kg)}" placeholder="0" ${own ? "" : "disabled"} aria-label="Peso de la serie ${n + 1}"><small>kg</small></label>
      <label class="num"><input type="${numeric ? "number" : "text"}" inputmode="numeric" min="0" name="reps" value="${esc(numeric ? reps : i.reps)}" ${own && numeric ? "" : "disabled"} aria-label="Repeticiones de la serie ${n + 1}"><small>${numeric ? (perSet.length > 1 ? `de ${esc(goal)}` : "reps") : ""}</small></label>
      <button class="setck" type="button" data-done aria-pressed="${!!lg.done}" ${own ? "" : "disabled"} aria-label="Serie ${n + 1} hecha">${icon("check")}</button>
    </div>`;
  }).join("");

  return {
    layout: "focus", title: ex.n,
    html: `${pageHead({ back: `#/rutina/${r.id}/dia/${d.id}`, kicker: `${d.name} · ${k + 1} de ${flat.length}`, title: ex.n })}
      <div class="video">${yt
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1&playsinline=1" title="Video: ${esc(ex.n)}" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
        : `<div class="video-ph">${exTile(ex, "xl")}<span>${icon("video", "sm")} Video próximamente</span><small>Lo graba el equipo de Vientos con las máquinas del gimnasio</small>${WAVES}</div>`}</div>
      <section class="exhead">
        <div class="tags">${tag(ex.g)}${ex.eq ? tag(ex.eq) : ""}${b.type !== "single" ? tag(`${BLOCK_TYPES[b.type].label} ${letter(bi, ii)}`, "red") : ""}</div>
        <div class="targets">
          <div><small>Series</small><b>${i.sets}</b></div>
          <div><small>Repeticiones</small><b>${esc(repsText(i.reps))}</b></div>
          <div><small>${lastMax ? "Última" : "Peso"}</small><b>${lastMax ? fmtKg(lastMax) : "El tuyo"}</b></div>
          <div><small>Descanso</small><b>${rest ? fmtRest(rest) : "—"}</b></div>
        </div>
        ${partners.length ? `<p class="pair">${icon("swap", "xs")} ${b.type === "contrast" ? "Contraste con" : "Se hace junto con"} ${partners.map((x) => `<a href="#/rutina/${r.id}/dia/${d.id}/ej/${x.id}">${esc(S.exercise(x.ex)?.n || "")}</a>`).join(" y ")}</p>` : ""}
        ${i.note ? `<div class="coachnote sm">${icon("note")}<p><b>Indicación del profe</b>${esc(i.note)}</p></div>` : ""}
      </section>
      <section class="sets">
        <div class="sets-h"><h2>Series</h2>${last ? `<span class="muted">Última vez ${esc(relDay(last.at))}: ${last.sets.filter((s) => s.kg).map((s) => fmtKg(s.kg)).slice(0, 4).join(" · ") || "sin peso"}</span>` : `<span class="muted">Primera vez: poné el peso que uses vos. Queda guardado para la próxima.</span>`}</div>
        <div class="setlist">${setRows}</div>
        ${best ? `<p class="pr">${icon("trophy", "xs")} Tu récord: <b>${fmtKg(best.kg)}</b> ${best.reps ? `× ${best.reps}` : ""}</p>` : ""}
      </section>
      <section class="howto">
        <details ${own ? "" : "open"}><summary>${icon("info", "sm")} Cómo se hace</summary>
          <ol>${(ex.steps || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
          ${ex.tip ? `<p class="tip"><b>Consejo:</b> ${esc(ex.tip)}</p>` : ""}
          ${ex.sec ? `<p class="muted tiny">También trabaja: ${esc(ex.sec)}</p>` : ""}
        </details>
      </section>
      <nav class="exnav">
        ${prev ? `<a class="btn ghost" href="#/rutina/${r.id}/dia/${d.id}/ej/${prev.i.id}" aria-label="Ejercicio anterior">${icon("left")}</a>` : `<span></span>`}
        <a class="btn primary exnav-day" href="#/rutina/${r.id}/dia/${d.id}">${icon("list", "sm")} Volver a ${esc(d.name)}</a>
        ${next ? `<a class="btn ghost" href="#/rutina/${r.id}/dia/${d.id}/ej/${next.i.id}" aria-label="Ejercicio siguiente">${icon("right")}</a>` : `<span></span>`}
      </nav>`,
    mount(host) {
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
      <small>${lab}</small><b>${new Date(t).getDate()}</b><i>${done.length ? esc(done.map(nameOf).join(" ")) : ""}</i></div>`;
  }).join("");
  const n = new Set(logs.map((l) => l.dayId)).size;
  return `<section class="weekstrip" aria-label="Esta semana">
      <div class="weekstrip-h"><b>Esta semana</b><span>${n} de ${r.days.length} días hechos</span></div>
      <div class="wds">${cells}</div>
      <p class="tiny muted">${icon("repeat", "xs")} Cada lunes la semana arranca de cero. Tus kilos y récords quedan guardados.</p>
    </section>`;
}

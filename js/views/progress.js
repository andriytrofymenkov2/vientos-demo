/* Progreso del socio: constancia, cargas, récords e historial */
import { icon } from "../core/icons.js";
import { esc, fmtDate, fmtKg, relDay, weekStart, dayKey, DAY, MON, $, $$, countUp } from "../core/util.js";
import * as S from "../core/store.js";
import { me } from "../core/auth.js";
import { pageHead, empty } from "../core/ui.js";
import { exTile } from "./common.js";

/* Calendario de constancia: 16 semanas × 7 días */
export function heatmap(userId, weeks = 16) {
  const trained = S.trainedDays(userId);
  const w0 = weekStart() - (weeks - 1) * 7 * DAY;
  const today = dayKey();
  let cols = "", months = "";
  for (let w = 0; w < weeks; w++) {
    let cells = "";
    const ws = w0 + w * 7 * DAY;
    const m = new Date(ws).getMonth();
    const first = w === 0 || new Date(ws - 7 * DAY).getMonth() !== m;
    months += `<span>${first ? MON[m] : ""}</span>`;
    for (let d = 0; d < 7; d++) {
      const t = ws + d * DAY, k = dayKey(t);
      const fut = t > Date.now();
      cells += `<i class="${trained.has(k) ? "on" : ""} ${k === today ? "is-today" : ""} ${fut ? "fut" : ""}" title="${fmtDate(t)}"></i>`;
    }
    cols += `<div class="hm-col">${cells}</div>`;
  }
  return `<div class="hm"><div class="hm-days"><span>L</span><span></span><span>M</span><span></span><span>V</span><span></span><span>D</span></div><div class="hm-grid">${cols}</div></div><div class="hm-months">${months}</div>`;
}

/* Gráfico de línea simple (SVG) del peso máximo por sesión */
export function lineChart(points) {
  if (points.length < 2) return `<p class="muted chart-empty">Con dos o más entrenamientos vas a ver tu evolución acá.</p>`;
  const W = 320, H = 150, P = { l: 34, r: 12, t: 14, b: 22 };
  const xs = points.map((p) => p.at), ys = points.map((p) => p.kg);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 5; y1 += 5; }
  const pad = (y1 - y0) * 0.15; y0 = Math.max(0, y0 - pad); y1 += pad;
  const X = (t) => P.l + ((t - x0) / Math.max(1, x1 - x0)) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(p.at).toFixed(1)} ${Y(p.kg).toFixed(1)}`).join(" ");
  const area = `${d} L${X(x1).toFixed(1)} ${H - P.b} L${X(x0).toFixed(1)} ${H - P.b} Z`;
  const ticks = [y0, (y0 + y1) / 2, y1].map((v) => `<g><line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${P.l - 6}" y="${Y(v) + 3.5}" text-anchor="end">${Math.round(v)}</text></g>`).join("");
  const lastP = points[points.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso: de ${fmtKg(points[0].kg)} a ${fmtKg(lastP.kg)}">
    <defs><linearGradient id="chg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--red)" stop-opacity=".35"/><stop offset="1" stop-color="var(--red)" stop-opacity="0"/></linearGradient></defs>
    <g class="grid">${ticks}</g>
    <path d="${area}" fill="url(#chg)"/>
    <path class="ln" d="${d}" pathLength="1"/>
    ${points.map((p) => `<circle cx="${X(p.at).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="2.6"/>`).join("")}
    <circle class="last" cx="${X(lastP.at).toFixed(1)}" cy="${Y(lastP.kg).toFixed(1)}" r="5"/>
    <text class="xl" x="${P.l}" y="${H - 5}">${fmtDate(points[0].at, { short: true })}</text>
    <text class="xl" x="${W - P.r}" y="${H - 5}" text-anchor="end">${fmtDate(lastP.at, { short: true })}</text>
  </svg>`;
}

export function progressView(params, query) {
  const u = me();
  const logs = S.logsOf(u.id);
  if (!logs.length) {
    return { title: "Progreso", nav: "progreso", html: `${pageHead({ title: "Mi progreso" })}${empty("trend", "Todavía no hay entrenamientos", "Cuando termines tu primer entrenamiento vas a ver acá tu constancia, tus cargas y tus récords.", `<a class="btn primary" href="#/rutina">Ir a mi rutina</a>`)}` };
  }
  const tracked = S.trackedExercises(u.id);
  const sel = tracked.includes(query.ej) ? query.ej : tracked[0];
  const total = logs.length;
  const mins = logs.reduce((a, l) => a + l.min, 0);
  const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
  const month = logs.filter((l) => l.at >= m0.getTime()).length;
  const streak = S.streakWeeks(u.id);
  const recs = tracked.map((id) => ({ ex: S.exercise(id), best: S.bestOf(u.id, id) })).filter((x) => x.ex && x.best).sort((a, b) => b.best.kg - a.best.kg).slice(0, 6);
  const hist = sel ? S.historyOf(u.id, sel) : [];
  const first = hist[0], lastP = hist[hist.length - 1];
  const diff = first && lastP ? lastP.kg - first.kg : 0;

  return {
    title: "Progreso", nav: "progreso",
    html: `${pageHead({ title: "Mi progreso" })}
      <section class="stats4">
        <div><b data-count="${total}">0</b><small>entrenamientos</small></div>
        <div><b data-count="${month}">0</b><small>este mes</small></div>
        <div><b data-count="${streak}">0</b><small>semanas seguidas</small></div>
        <div><b data-count="${Math.round(mins / 60)}">0</b><small>horas entrenadas</small></div>
      </section>
      <section class="card">
        <div class="card-h"><h2>Constancia</h2><span class="muted">últimas 16 semanas</span></div>
        ${heatmap(u.id)}
      </section>
      ${sel ? `<section class="card">
        <div class="card-h"><h2>Evolución de cargas</h2></div>
        <label class="field compact"><span class="sr">Ejercicio</span><select data-ex>${tracked.map((id) => `<option value="${id}" ${id === sel ? "selected" : ""}>${esc(S.exercise(id)?.n || id)}</option>`).join("")}</select></label>
        <div class="chart-k"><div><small>Inicio</small><b>${fmtKg(first?.kg)}</b></div><div><small>Ahora</small><b>${fmtKg(lastP?.kg)}</b></div><div><small>Diferencia</small><b class="${diff > 0 ? "up" : ""}">${diff > 0 ? "+" : ""}${fmtKg(diff)}</b></div></div>
        ${lineChart(hist)}
      </section>` : ""}
      ${recs.length ? `<section class="sec"><h2 class="sec-t">${icon("trophy", "sm")} Récords personales</h2>
        <div class="recs">${recs.map((x) => `<a class="rec" href="#/progreso?ej=${x.ex.id}">${exTile(x.ex, "sm")}<span><b>${esc(x.ex.n)}</b><small>${fmtDate(x.best.at)}</small></span><em>${fmtKg(x.best.kg)}</em></a>`).join("")}</div></section>` : ""}
      <section class="sec"><h2 class="sec-t">Últimos entrenamientos</h2>
        ${logs.slice(0, 12).map((l) => `<div class="hrow"><span class="hrow-d"><b>${new Date(l.at).getDate()}</b><small>${MON[new Date(l.at).getMonth()]}</small></span><span><b>${esc(l.dayName)} · ${esc(l.focus)}</b><small>${esc(relDay(l.at))} · ${l.min} min${l.sets.length ? ` · ${l.sets.length} series` : ""}</small></span></div>`).join("")}
      </section>
      <a class="btn ghost block" href="#/rutina">${icon("layers", "sm")} Ver mis rutinas</a>`,
    mount(host) {
      $$("[data-count]", host).forEach((el) => countUp(el, +el.dataset.count));
      $("[data-ex]", host)?.addEventListener("change", (e) => { location.hash = "#/progreso?ej=" + e.target.value; });
    },
  };
}

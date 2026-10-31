/* Entradas: el listado de quién entró al gimnasio, día por día (o el historial de un socio).
   Muestra también a los que la cámara no dejó pasar y a los que recepción dejó pasar igual, con el motivo.
   Pensado para 1000 socios: se ve un día a la vez, con buscador, y la lista se muestra de a 30. */
import { icon } from "../core/icons.js";
import { esc, fold, fmtDate, fmtWeekday, plural, debounce, dayKey, DAY, $ } from "../core/util.js";
import * as S from "../core/store.js";
import { pageHead, avatar, limitList, empty } from "../core/ui.js";
import { go, refresh } from "../core/router.js";

const WHY = { cuota: "cuota vencida", semana: "ya usó sus días de la semana", baja: "no es socio activo" };
const hhmm = (ts) => new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
const kindOf = (c) => (c.blocked ? "frenado" : c.via === "manual" ? "pasaron" : "entraron");
const how = (c) => c.blocked ? `No pudo entrar · ${WHY[c.reason] || "no podía pasar"}`
  : c.via === "manual" ? `Pasó igual (lo dejó pasar recepción)${c.override ? ` · ${c.override}` : ""}`
  : c.via === "cara" ? "Reconocimiento facial" : "Búsqueda por DNI";
const dayStart = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
const isoOf = (t) => dayKey(t);

export function entradasView(params, query = {}) {
  if (S.MODE === "supabase" && S.db.off?.asistencia) return go("/panel", { replace: true });
  const who = query.u ? S.user(query.u) : null;              /* historial de un socio (desde su ficha) */
  const today = isoOf(Date.now());
  const d = query.d && /^\d{4}-\d{2}-\d{2}$/.test(query.d) ? query.d : today;
  const f = query.f || "", q = query.q || "";
  const t0 = dayStart(d), t1 = t0 + DAY;
  const all = [...S.checkinsOf(), ...S.attemptsOf()];
  let rows = who ? all.filter((c) => c.userId === who.id) : all.filter((c) => c.at >= t0 && c.at < t1);
  const counts = {
    personas: who ? S.personDays(rows.filter((c) => !c.blocked)) : new Set(rows.filter((c) => !c.blocked).map((c) => c.userId)).size,
    entradas: rows.filter((c) => !c.blocked).length,
    pasaron: rows.filter((c) => kindOf(c) === "pasaron").length,
    frenado: rows.filter((c) => c.blocked).length,
  };
  if (f) rows = rows.filter((c) => kindOf(c) === f);
  if (q) rows = rows.filter((c) => { const u = S.user(c.userId); return fold(`${u?.name || ""} ${u?.user || ""}`).includes(fold(q)); });
  rows.sort((a, b) => b.at - a.at);
  const link = (o) => `#/panel/entradas?${new URLSearchParams({ ...(who ? { u: who.id } : { d }), ...(f ? { f } : {}), ...(q ? { q } : {}), ...o })}`.replace(/[?&]$/, "");
  const shift = (n) => isoOf(t0 + n * DAY + DAY / 2);
  const wd = fmtWeekday(t0 + DAY / 2);
  const dayLabel = d === today ? "Hoy" : d === isoOf(Date.now() - DAY) ? "Ayer" : wd.charAt(0).toUpperCase() + wd.slice(1);
  const CHIPS = [["", "Todo"], ["entraron", "Entraron"], ["pasaron", "Pasaron igual"], ["frenado", "No pudieron entrar"]];
  const row = (c) => { const u = S.user(c.userId);
    return `<a class="mrow ent ${kindOf(c)}" href="#/panel/socios/${c.userId}"><span class="ent-h">${who ? `${fmtDate(c.at)}<br>` : ""}${hhmm(c.at)}</span>${avatar(u, "sm")}<span><b>${esc(u?.name || "Socio eliminado")}</b><small>DNI ${esc(u?.user || "—")} · ${esc(how(c))}</small></span>${icon("right", "sm")}</a>`; };
  return {
    layout: "panel", nav: "entradas", title: "Entradas",
    html: `${pageHead({ title: who ? `Entradas de ${who.name}` : "Entradas", kicker: who ? "Historial del socio" : "Quién entró al gimnasio", back: who ? `#/panel/socios/${who.id}` : "" })}
      ${who ? "" : `<div class="ent-day">
        <a class="icon-btn" href="${link({ d: shift(-1) })}" aria-label="Día anterior">${icon("left", "sm")}</a>
        <label class="ent-date"><input type="date" data-date value="${d}" max="${today}" aria-label="Elegir día"><b>${esc(dayLabel)} · ${esc(fmtDate(t0 + DAY / 2))}</b></label>
        ${d < today ? `<a class="icon-btn" href="${link({ d: shift(1) })}" aria-label="Día siguiente">${icon("right", "sm")}</a><a class="btn ghost sm" href="${link({ d: today })}">Hoy</a>` : ""}
      </div>`}
      <div class="statrow ent-stats">
        <div><b>${counts.personas}</b><small>${who ? "días que vino" : "personas entraron"}</small></div>
        <div><b>${counts.entradas}</b><small>entradas</small></div>
        <div class="${counts.pasaron ? "warn" : ""}"><b>${counts.pasaron}</b><small>pasaron igual</small></div>
        <div class="${counts.frenado ? "bad" : ""}"><b>${counts.frenado}</b><small>no pudieron entrar</small></div>
      </div>
      <section class="card">
        ${who ? "" : `<div class="filters"><label class="search">${icon("search", "sm")}<input type="search" data-q value="${esc(q)}" placeholder="Buscar por nombre o DNI" aria-label="Buscar"></label></div>`}
        <div class="chips-scroll">${CHIPS.map(([k, l]) => `<a class="chip ${k === f ? "on" : ""}" href="${link({ f: k })}">${l}</a>`).join("")}</div>
        <div class="mlist ent-list">${rows.map(row).join("") || empty("calendar", who ? "Todavía no tiene entradas registradas" : "No hay entradas para mostrar", who ? "" : "Probá con otro día o sacá el filtro.")}</div>
      </section>
      <p class="muted tiny">${who ? "Todas sus entradas registradas en Recepción." : "Cada entrada registrada en Recepción, por la cara o por DNI."} El detalle completo de todos los meses está en el Excel, solapa Asistencia.</p>`,
    mount(host) {
      /* con servidor: un día viejo o el historial de un socio se traen recién ahora (al abrir solo están los últimos 45 días) */
      if (S.MODE === "supabase") {
        const R = S.remote(), need = who ? !R._members?.has(who.id) : (S.db.checkinsFrom && t0 < S.db.checkinsFrom && !R._days?.has(t0));
        if (need) {
          const list = $(".ent-list", host); if (list) list.innerHTML = `<p class="muted">Cargando entradas…</p>`;
          (who ? R.checkinsOfMember(who.id) : R.checkinsOfDay(t0)).then(() => refresh()).catch((err) => { console.warn(err); if (list) list.innerHTML = `<p class="muted">No se pudieron traer las entradas. Revisá la conexión.</p>`; });
          return;
        }
      }
      limitList($(".ent-list", host), { size: 30 });
      const inp = $("[data-q]", host);
      if (inp) inp.addEventListener("input", debounce(() => { location.hash = link({ q: inp.value }); }, 300));
      if (q && inp) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
      $("[data-date]", host)?.addEventListener("change", (e) => { if (e.target.value) location.hash = link({ d: e.target.value }); });
    },
  };
}

/* resumen chico para la ficha del socio */
export function memberEntriesCard(m) {
  if (S.MODE === "supabase" && S.db.off?.asistencia) return "";
  const list = S.checkinsOf().filter((c) => c.userId === m.id).sort((a, b) => b.at - a.at);
  const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
  const mes = S.personDays(list.filter((c) => c.at >= m0.getTime()));
  const tried = S.attemptsOf().filter((a) => a.userId === m.id && a.at >= Date.now() - 30 * DAY).length;
  return `<section class="card"><div class="card-h"><h2>${icon("calendar", "sm")} Entradas</h2><span class="muted">${plural(mes, "día", "días")} este mes</span></div>
    ${list.slice(0, 3).map((c) => `<div class="hrow"><span><b>${esc(fmtDate(c.at))} · ${hhmm(c.at)}</b><small>${esc(how(c))}</small></span></div>`).join("") || `<p class="muted">Todavía no tiene entradas registradas.</p>`}
    ${tried ? `<p class="muted tiny">${plural(tried, "vez", "veces")} no pudo entrar en los últimos 30 días.</p>` : ""}
    ${list.length || tried ? `<a class="btn ghost sm block" href="#/panel/entradas?u=${m.id}">${icon("list", "sm")} Ver todas sus entradas</a>` : ""}
  </section>`;
}

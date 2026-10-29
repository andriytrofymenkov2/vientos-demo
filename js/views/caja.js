/* Caja: ingresos y gastos del gimnasio (solo el dueño).
   Ingresos = cuotas cobradas (salen de los pagos) + otros ingresos que carga el dueño (shop, pases sueltos).
   Egresos = gastos que carga el dueño. Todo mes a mes y comparado con el mes anterior. */
import { icon } from "../core/icons.js";
import { esc, plural, dayKey, $, $$ } from "../core/util.js";
import * as S from "../core/store.js";
import { me } from "../core/auth.js";
import { go, refresh } from "../core/router.js";
import { field, dateField, formData, toast, sheet, confirmDialog, pageHead, empty } from "../core/ui.js";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const money = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");
const mkey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const mstart = (k) => { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1).getTime(); };
const mlabel = (k, short = false) => { const [y, m] = k.split("-").map(Number); const n = new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); return short ? MONTHS[m - 1] : n[0].toUpperCase() + n.slice(1); };
const sum = (list) => list.reduce((a, x) => a + (x.amount || 0), 0);

function bars(rows, total) {
  if (!total) return `<p class="muted">Todavía no hay datos.</p>`;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return `<div class="hb">${rows.map((r) => `<div class="hb-row"><span class="hb-l">${esc(r.label)}</span><span class="hb-t"><i style="width:${Math.max(r.n ? 3 : 0, (r.n / max) * 100)}%"></i></span><span class="hb-v"><b>${money(r.n)}</b><em>${Math.round((r.n / total) * 100)} %</em></span></div>`).join("")}</div>`;
}

export function cajaView(params, query = {}) {
  if (me()?.role !== "admin") return go("/panel", { replace: true });
  const now = mkey(Date.now());
  const pays = S.paymentsOf().map((p) => ({ at: p.at, amount: p.amount || 0 }));
  const moves = S.movementsOf();
  const gastos = moves.filter((m) => m.kind === "gasto"), otros = moves.filter((m) => m.kind === "ingreso");
  const firstTs = Math.min(Date.now(), ...pays.map((p) => p.at), ...moves.map((m) => m.at));
  const months = [];
  for (let [y, m] = mkey(firstTs).split("-").map(Number); `${y}-${String(m).padStart(2, "0")}` <= now; m === 12 ? (y++, m = 1) : m++) months.push(`${y}-${String(m).padStart(2, "0")}`);
  const sel = months.includes(query.m) ? query.m : now;
  const i = months.indexOf(sel), prev = months[i - 1], next = months[i + 1];
  const inM = (list, k) => list.filter((x) => mkey(x.at) === k);
  /* mes en curso: se compara contra el mismo tramo de días del mes anterior */
  const partial = sel === now ? Date.now() - mstart(sel) : null;
  const same = (list, k, k0) => (k0 && partial !== null ? list.filter((x) => mkey(x.at) === k0 && x.at < mstart(k0) + partial) : inM(list, k0));
  const cuotas = sum(inM(pays, sel)), extra = sum(inM(otros, sel)), ing = cuotas + extra, egr = sum(inM(gastos, sel)), res = ing - egr;
  const pIng = prev ? sum(same(pays, sel, prev)) + sum(same(otros, sel, prev)) : null, pEgr = prev ? sum(same(gastos, sel, prev)) : null;
  const delta = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  const dIng = delta(ing, pIng), dEgr = delta(egr, pEgr);
  const catRows = S.EXPENSE_CATS.map((c) => ({ label: c, n: sum(inM(gastos, sel).filter((g) => (g.cat || "Otros") === c)) })).filter((r) => r.n).sort((a, b) => b.n - a.n);
  const list = [...inM(gastos, sel), ...inM(otros, sel)].sort((a, b) => b.at - a.at);
  const last6 = months.slice(-6).map((k) => { const g = sum(inM(gastos, k)), c = sum(inM(pays, k)) + sum(inM(otros, k)); return { k, c, g, r: c - g }; });
  const cmp = (d, up) => (d === null ? "" : `<em class="${(d >= 0) === up ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d)} % vs. ${esc(mlabel(prev, true))}${partial !== null ? " (mismos días)" : ""}</em>`);

  return {
    layout: "panel", nav: "caja", title: "Ingresos y gastos",
    html: `${pageHead({ title: "Ingresos y gastos", kicker: "Caja", actions: `<button class="btn ghost sm" type="button" data-new="ingreso">${icon("plus", "sm")} Otro ingreso</button><button class="btn primary sm" type="button" data-new="gasto">${icon("plus", "sm")} Registrar gasto</button>` })}
      <div class="rc-nav">
        <a class="icon-btn ${prev ? "" : "off"}" ${prev ? `href="#/panel/caja?m=${prev}"` : 'aria-disabled="true"'} aria-label="Mes anterior">${icon("left")}</a>
        <label class="rc-sel"><select data-month aria-label="Elegir mes">${months.slice().reverse().map((k) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(mlabel(k))}${k === now ? " (este mes)" : ""}</option>`).join("")}</select></label>
        <a class="icon-btn ${next ? "" : "off"}" ${next ? `href="#/panel/caja?m=${next}"` : 'aria-disabled="true"'} aria-label="Mes siguiente">${icon("right")}</a>
      </div>
      <section class="money rc-money">
        <div><small>Ingresos</small><b>${money(ing)}</b>${cmp(dIng, true)}<em>${money(cuotas)} en cuotas${extra ? ` · ${money(extra)} otros` : ""}</em></div>
        <div><small>Gastos</small><b>${money(egr)}</b>${cmp(dEgr, false)}</div>
        <div><small>Resultado del mes</small><b class="${res < 0 ? "bad" : ""}">${money(res)}</b><em>${res >= 0 ? "ingresos menos gastos" : "se gastó más de lo que entró"}</em></div>
      </section>
      <div class="pgrid">
        <section class="card"><div class="card-h"><h2>${icon("trend", "sm")} Últimos meses</h2></div>
          <div class="cajatab"><div class="ct-h"><span></span><span>Ingresos</span><span>Gastos</span><span>Resultado</span></div>
          ${last6.slice().reverse().map((x) => `<a class="ct-r ${x.k === sel ? "on" : ""}" href="#/panel/caja?m=${x.k}"><span>${esc(mlabel(x.k))}</span><span>${money(x.c)}</span><span>${money(x.g)}</span><b class="${x.r < 0 ? "bad" : ""}">${money(x.r)}</b></a>`).join("")}</div>
        </section>
        <section class="card"><div class="card-h"><h2>${icon("card", "sm")} En qué se gastó</h2><span class="muted">${esc(mlabel(sel))}</span></div>${bars(catRows, egr)}</section>
      </div>
      <section class="card"><div class="card-h"><h2>Gastos y otros ingresos de ${esc(mlabel(sel))}</h2><span class="muted">${plural(list.length, "movimiento", "movimientos")}</span></div>
        <p class="muted tiny">Las cuotas cobradas no hace falta cargarlas: se suman solas desde los pagos de los socios.</p>
        ${list.length ? `<div class="paylist">${list.map((m) => { const d = new Date(m.at); return `<div class="prow">
          <span class="prow-d"><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()]}</small></span>
          <span class="prow-t"><b>${esc(m.cat || (m.kind === "gasto" ? "Gasto" : "Ingreso"))}</b><small>${esc(m.note || "")}</small></span>
          <span class="prow-a ${m.kind === "gasto" ? "bad" : "up"}"><b>${m.kind === "gasto" ? "−" : "+"} ${money(m.amount)}</b></span>
          <button class="icon-btn" type="button" data-del="${esc(m.id)}" aria-label="Borrar">${icon("trash", "sm")}</button></div>`; }).join("")}</div>`
        : empty("card", "Todavía no cargaste gastos ni otros ingresos este mes")}
      </section>`,
    mount(host) {
      $("[data-month]", host)?.addEventListener("change", (e) => { location.hash = `#/panel/caja?m=${e.target.value}`; });
      host.addEventListener("click", async (e) => {
        const n = e.target.closest("[data-new]");
        if (n) return movementSheet(n.dataset.new, sel);
        const d = e.target.closest("[data-del]");
        if (d && await confirmDialog({ title: "¿Borrar este movimiento?", text: "Se saca de la caja del mes.", ok: "Borrar", danger: true })) { S.api.deleteMovement(d.dataset.del); toast("Borrado"); refresh(); }
      });
    },
  };
}

function movementSheet(kind, month) {
  const gasto = kind === "gasto";
  const cats = gasto ? S.EXPENSE_CATS : S.INCOME_CATS;
  /* fecha por defecto: hoy si es el mes en curso; si no, el primer día del mes que se está mirando */
  const start = month === mkey(Date.now()) ? Date.now() : mstart(month);
  sheet({
    title: gasto ? "Registrar un gasto" : "Registrar otro ingreso",
    html: `<form novalidate>
      ${dateField({ label: "Fecha", name: "at", value: dayKey(start), req: true })}
      ${field({ label: "Categoría", name: "cat", value: cats[0], options: cats.map((c) => [c, c]) })}
      ${field({ label: "Monto ($)", name: "amount", type: "number", ph: "Ej: 150000", req: true, attrs: 'inputmode="decimal" min="0" step="any"' })}
      ${field({ label: "Detalle (opcional)", name: "note", ph: gasto ? "Ej: Factura de luz de octubre" : "Ej: Venta de bebidas" })}
      <p class="form-err" role="alert" hidden></p>
      <div class="row-btns"><button class="btn primary block" type="submit">${icon("check", "sm")} Guardar</button></div>
    </form>`,
    onMount(b, close) {
      $("form", b).addEventListener("submit", (e) => {
        e.preventDefault();
        const f = formData(e.target), err = $(".form-err", b);
        const amount = parseFloat(String(f.amount || "").replace(",", "."));
        if (!(amount > 0)) { err.textContent = "Poné un monto mayor a cero."; err.hidden = false; return; }
        const at = f.at ? new Date(f.at + "T12:00").getTime() : Date.now();
        S.api.addMovement({ kind, at, amount, cat: f.cat, note: (f.note || "").trim() });
        close(); toast(gasto ? "Gasto guardado" : "Ingreso guardado"); refresh();
      });
    },
  });
}

/* Caja: ingresos y gastos del gimnasio (solo el dueño).
   Ingresos = cuotas cobradas (salen solas de los pagos de los socios) + otros ingresos que carga el dueño
   (alquiler de espacios, shop, pases sueltos). Gastos = lo que carga el dueño (alquiler, sueldos, servicios…).
   Todo queda guardado mes a mes y se puede ver cualquier mes anterior. Un solo Excel con el mes completo. */
import { icon } from "../core/icons.js";
import { esc, plural, dayKey, $ } from "../core/util.js";
import * as S from "../core/store.js";
import { me } from "../core/auth.js";
import { go, refresh } from "../core/router.js";
import { field, dateField, formData, toast, sheet, confirmDialog, pageHead } from "../core/ui.js";
import { downloadMaster } from "./exportar.js";

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
const byCat = (list, cats) => cats.map((c) => ({ label: c, n: sum(list.filter((x) => (x.cat || cats[cats.length - 1]) === c)) })).filter((r) => r.n).sort((a, b) => b.n - a.n);
const mrowHtml = (m) => { const d = new Date(m.at); return `<button type="button" class="prow" data-edit="${esc(m.id)}">
  <span class="prow-d"><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()]}</small></span>
  <span class="prow-t"><b>${esc(m.cat || "")}</b><small>${esc(m.note || "Sin detalle")}</small></span>
  <span class="prow-a ${m.kind === "gasto" ? "bad" : "up"}">${m.kind === "gasto" ? "−" : "+"} ${money(m.amount)}</span></button>`; };

export function cajaView(params, query = {}) {
  if (me()?.role !== "admin" || S.db.off?.caja) return go("/panel", { replace: true });
  const now = mkey(Date.now());
  const pays = S.paymentsOf();
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
  const same = (list, k0) => (partial !== null ? inM(list, k0).filter((x) => x.at < mstart(k0) + partial) : inM(list, k0));
  const pM = inM(pays, sel), oM = inM(otros, sel).sort((a, b) => b.at - a.at), gM = inM(gastos, sel).sort((a, b) => b.at - a.at);
  const cuotas = sum(pM), extra = sum(oM), ing = cuotas + extra, egr = sum(gM), res = ing - egr;
  const pIng = prev ? sum(same(pays, prev)) + sum(same(otros, prev)) : null, pEgr = prev ? sum(same(gastos, prev)) : null;
  const delta = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  const dIng = delta(ing, pIng), dEgr = delta(egr, pEgr);
  const ingRows = [{ label: "Cuotas de socios", n: cuotas }, ...byCat(oM, S.INCOME_CATS)].filter((r) => r.n);
  const last6 = months.slice(-6).map((k) => { const g = sum(inM(gastos, k)), c = sum(inM(pays, k)) + sum(inM(otros, k)); return { k, c, g, r: c - g }; });
  const cmp = (d, up) => (d === null ? "" : `<em class="${(d >= 0) === up ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d)} % vs. ${esc(mlabel(prev, true))}${partial !== null ? " (mismos días)" : ""}</em>`);
  /* gastos del mes anterior que todavía no se cargaron este mes (mismo concepto y detalle) */
  const ya = new Set(gM.map((g) => `${g.cat}|${g.note || ""}`));
  const prevG = (prev ? inM(gastos, prev) : []).filter((g) => !ya.has(`${g.cat}|${g.note || ""}`));

  return {
    layout: "panel", nav: "caja", title: "Ingresos y gastos",
    html: `${pageHead({ title: "Ingresos y gastos", kicker: "Caja del gimnasio", actions: `<button class="btn ghost sm" type="button" data-xlsx>${icon("download", "sm")} Descargar Excel</button>` })}
      <div class="rc-nav">
        <a class="icon-btn ${prev ? "" : "off"}" ${prev ? `href="#/panel/caja?m=${prev}"` : 'aria-disabled="true"'} aria-label="Mes anterior">${icon("left")}</a>
        <label class="rc-sel"><select data-month aria-label="Elegir mes">${months.slice().reverse().map((k) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(mlabel(k))}${k === now ? " (este mes)" : ""}</option>`).join("")}</select></label>
        <a class="icon-btn ${next ? "" : "off"}" ${next ? `href="#/panel/caja?m=${next}"` : 'aria-disabled="true"'} aria-label="Mes siguiente">${icon("right")}</a>
      </div>
      <section class="money rc-money">
        <div><small>Ingresos</small><b>${money(ing)}</b>${cmp(dIng, true)}<em>${money(cuotas)} de cuotas${extra ? ` · ${money(extra)} otros` : ""}</em></div>
        <div><small>Gastos</small><b>${money(egr)}</b>${cmp(dEgr, false)}<em>${plural(gM.length, "gasto cargado", "gastos cargados")}</em></div>
        <div><small>Resultado del mes</small><b class="${res < 0 ? "bad" : "good"}">${money(res)}</b><em>${res >= 0 ? "ganancia: ingresos menos gastos" : "pérdida: se gastó más de lo que entró"}</em></div>
      </section>
      <div class="caja2">
        <section class="card"><div class="card-h"><h2 class="ok-t">${icon("plus", "sm")} Ingresos</h2><button class="btn primary sm" type="button" data-new="ingreso">${icon("plus", "sm")} Ingreso</button></div>
          <a class="prow cuotas-row" href="#/panel/recaudacion?m=${sel}">
            <span class="prow-d">${icon("card", "sm")}</span>
            <span class="prow-t"><b>Cuotas de socios</b><small>${plural(pM.length, "pago", "pagos")} · se suman solas · tocá para ver el detalle</small></span>
            <span class="prow-a up">+ ${money(cuotas)}</span></a>
          ${oM.map(mrowHtml).join("")}
          ${oM.length ? "" : `<p class="muted tiny">Otros ingresos: alquiler de espacios, shop, pases sueltos. Se cargan con el botón "Ingreso".</p>`}
          <div class="caja-tot"><span>Total ingresos</span><b>${money(ing)}</b></div>
        </section>
        <section class="card"><div class="card-h"><h2 class="bad-t">${icon("minus", "sm")} Gastos</h2><button class="btn primary sm" type="button" data-new="gasto">${icon("plus", "sm")} Gasto</button></div>
          ${gM.map(mrowHtml).join("") || `<p class="muted">Todavía no hay gastos cargados en ${esc(mlabel(sel))}.</p>`}
          ${prevG.length && sel === now ? `<button class="btn ghost sm block" type="button" data-copy>${icon("copy", "sm")} Cargar los gastos fijos de ${esc(mlabel(prev, true))} que faltan (${plural(prevG.length, "gasto", "gastos")})</button>` : ""}
          <div class="caja-tot"><span>Total gastos</span><b>${money(egr)}</b></div>
        </section>
      </div>
      <div class="pgrid">
        <section class="card"><div class="card-h"><h2>${icon("card", "sm")} De dónde vino la plata</h2></div>${bars(ingRows, ing)}</section>
        <section class="card"><div class="card-h"><h2>${icon("card", "sm")} En qué se gastó</h2></div>${bars(byCat(gM, S.EXPENSE_CATS), egr)}</section>
        <section class="card wide"><div class="card-h"><h2>${icon("trend", "sm")} Últimos meses</h2><span class="muted">tocá un mes para verlo</span></div>
          <div class="cajatab"><div class="ct-h"><span>Mes</span><span>Ingresos</span><span>Gastos</span><span>Resultado</span></div>
          ${last6.slice().reverse().map((x) => `<a class="ct-r ${x.k === sel ? "on" : ""}" href="#/panel/caja?m=${x.k}"><span>${esc(mlabel(x.k))}</span><span>${money(x.c)}</span><span>${money(x.g)}</span><b class="${x.r < 0 ? "bad" : ""}">${money(x.r)}</b></a>`).join("")}</div>
          <p class="muted tiny">Todos los meses quedan guardados: con las flechas de arriba podés ver cualquier mes anterior.</p>
        </section>
      </div>`,
    mount(host) {
      $("[data-month]", host)?.addEventListener("change", (e) => { location.hash = `#/panel/caja?m=${e.target.value}`; });
      host.addEventListener("click", async (e) => {
        const n = e.target.closest("[data-new]");
        if (n) return movementSheet({ kind: n.dataset.new }, sel);
        const ed = e.target.closest("[data-edit]");
        if (ed) return movementSheet(moves.find((m) => m.id === ed.dataset.edit), sel);
        if (e.target.closest("[data-xlsx]")) return downloadMaster();
        if (e.target.closest("[data-copy]")) {
          const todo = prevG;
          if (!todo.length) return toast("Esos gastos ya están cargados este mes");
          const ok = await confirmDialog({ title: `¿Repetir ${plural(todo.length, "gasto", "gastos")} de ${mlabel(prev, true)}?`, text: `Se cargan con el mismo monto (${money(sum(todo))} en total) y el mismo día de este mes. Después podés cambiar cualquiera.`, ok: "Repetir" });
          if (!ok) return;
          const [y, mo] = sel.split("-").map(Number), last = new Date(y, mo, 0).getDate();
          todo.forEach((g) => S.api.addMovement({ kind: "gasto", amount: g.amount, cat: g.cat, note: g.note || "", at: new Date(y, mo - 1, Math.min(new Date(g.at).getDate(), last), 12).getTime() }));
          toast(`${plural(todo.length, "gasto cargado", "gastos cargados")}`); refresh();
        }
      });
    },
  };
}

function movementSheet(m, month) {
  const isNew = !m.id, gasto = m.kind === "gasto";
  const cats = gasto ? S.EXPENSE_CATS : S.INCOME_CATS;
  /* fecha por defecto: hoy si es el mes en curso; si no, el primer día del mes que se está mirando */
  const at = m.at || (month === mkey(Date.now()) ? Date.now() : mstart(month));
  sheet({
    title: isNew ? (gasto ? "Cargar un gasto" : "Cargar un ingreso") : (gasto ? "Gasto" : "Ingreso"),
    html: `<form novalidate>
      ${field({ label: "¿Qué es?", name: "cat", value: m.cat || cats[0], options: cats.map((c) => [c, c]) })}
      ${field({ label: "Monto ($)", name: "amount", type: "number", value: m.amount || "", ph: gasto ? "Ej: 450000" : "Ej: 300000", req: true, attrs: 'inputmode="decimal" min="0" step="any"' })}
      ${dateField({ label: "Fecha", name: "at", value: dayKey(at), req: true })}
      ${field({ label: "Detalle (opcional)", name: "note", value: m.note || "", ph: gasto ? "Ej: Sueldo de Ezequiel" : "Ej: Alquiler del piso de arriba" })}
      <p class="form-err" role="alert" hidden></p>
      <div class="row-btns">${isNew ? "" : `<button class="btn ghost danger-t" type="button" data-del>${icon("trash", "sm")} Borrar</button>`}<button class="btn primary" type="submit">${icon("check", "sm")} Guardar</button></div>
    </form>`,
    onMount(b, close) {
      $("form", b).addEventListener("submit", (e) => {
        e.preventDefault();
        const f = formData(e.target), err = $(".form-err", b);
        const amount = parseFloat(String(f.amount || "").replace(",", "."));
        if (!(amount > 0)) { err.textContent = "Poné un monto mayor a cero."; err.hidden = false; return; }
        if (!f.at) { err.textContent = "Elegí la fecha."; err.hidden = false; return; }
        const [y, mo, da] = f.at.split("-").map(Number);
        const data = { kind: m.kind, at: new Date(y, mo - 1, da, 12).getTime(), amount, cat: f.cat, note: (f.note || "").trim() };
        if (isNew) S.api.addMovement(data); else S.api.updateMovement({ ...m, ...data });
        close(); toast(isNew ? (gasto ? "Gasto guardado" : "Ingreso guardado") : "Cambios guardados");
        if (mkey(data.at) !== month) go(`/panel/caja?m=${mkey(data.at)}`); else refresh();
      });
      $("[data-del]", b)?.addEventListener("click", async () => {
        close();
        if (await confirmDialog({ title: `¿Borrar ${gasto ? "este gasto" : "este ingreso"}?`, text: `${m.cat} · ${money(m.amount)}`, ok: "Borrar", danger: true })) { S.api.deleteMovement(m.id); toast("Borrado"); refresh(); }
      });
    },
  });
}

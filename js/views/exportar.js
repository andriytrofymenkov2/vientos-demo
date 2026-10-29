/* Excel maestro: UN solo archivo con todo lo que el dueño ve en la plataforma, en blanco y negro.
   Pestañas:
   · Resumen: cómo está hoy el gimnasio y la tabla mes por mes. Cada mes es un link a su pestaña.
   · Socios: la base completa, una fila por socio (DNI, nombre, plan, estado de la cuota…).
   · Una pestaña por mes (la más nueva primero): resumen del mes, cuotas cobradas, otros ingresos,
     gastos y resultado. Así se navega mes a mes sin filtrar nada.
   · Datos: todos los cobros y todos los movimientos en tablas simples, para importar o hacer copias. */
import * as S from "../core/store.js";
import { toast } from "../core/ui.js";
import { makeXlsx } from "../core/xlsx.js";

/* El Excel sale con la marca del gimnasio (no la de la app) */
const BRAND = "Vientos GYM";
const realEmail = (e) => (/@sin-email\.vientos\.app$/.test(e || "") ? "" : e || "");
const mkey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const mstart = (k) => { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1).getTime(); };
const mname = (k) => { const n = new Date(mstart(k)).toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(" de ", " "); return n[0].toUpperCase() + n.slice(1); };
const sum = (list) => list.reduce((a, x) => a + (x.amount || 0), 0);
const ageOf = (birth) => { if (!birth) return ""; const b = new Date(birth + "T12:00"); if (isNaN(b)) return ""; const t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const STATE = { ok: "Al día", soon: "Por vencer", vencida: "Cuota vencida", baja: "Se fue (más de 30 días sin pagar)", none: "Sin cuota cargada" };
function stateOf(u) {
  if (u.status === "pendiente") return "Registrado en la app, falta aprobar";
  if (u.fee?.unpaid) return "Se anotó y todavía no pagó";
  return STATE[S.standing(u).key] || "";
}

/* celdas de la hoja libre */
const H = (v, span) => ({ v, s: "head", span });
const T = (v, s = "label", span) => ({ v, s, span });
const z = (i) => (i % 2 ? "zebra" : "plain");
const W = 6;                                              /* columnas que usan las pestañas de cada mes */

function monthSheet(k, info, pM, oM, gM) {
  const rows = [];
  const push = (cells, ht) => rows.push({ cells, ht });
  const sec = (v) => push([T(v, "sec", W)], 24);
  push([T(mname(k), "title", 4), { v: "← Volver al resumen", s: "linkr", span: 2, link: "'Resumen'!A1" }], 34);
  push([T(`${BRAND} · Reporte de gestión`, "sub", W)]);
  push([]);
  sec("RESUMEN DEL MES");
  push(["Socios activos", "Altas", "Se fueron", "Total ingresos", "Gastos", "Resultado"].map((v) => H(v)), 28);
  const ing = sum(pM) + sum(oM), res = ing - sum(gM);
  push([{ v: info.act, t: "int", s: "big" }, { v: info.alt, t: "int", s: "big" }, { v: info.fue, t: "int", s: "big" },
    { v: ing, t: "money", s: "bigmoney" }, { v: sum(gM), t: "money", s: "bigmoney" }, { v: res, t: "money", s: "bigmoney" }], 30);
  push([]);
  /* tabla: encabezado, filas alternadas y total con fórmula */
  const table = (title, head, list, cellsOf, totalLabel) => {
    sec(title);
    push(head.map(([v, span]) => H(v, span)), 26);
    const first = rows.length + 1;
    if (!list.length) push([T("No hubo movimientos este mes.", "hint", W)]);
    list.forEach((x, i) => push(cellsOf(x, z(i))));
    const last = rows.length;
    push([T(totalLabel, "text-total", W - 1), { v: list.length ? { f: `SUM(F${first}:F${last})`, v: sum(list) } : 0, t: "money", s: "money-total" }], 24);
    push([]);
  };
  table(`INGRESOS · CUOTAS DE SOCIOS (${pM.length})`, [["Fecha"], ["DNI"], ["Nombre y apellido"], ["Plan"], ["Convenio"], ["Cobrado"]], pM,
    (p, v) => { const u = S.user(p.userId); return [{ v: p.at, t: "date", s: `date-${v}` }, { v: u?.user || "", s: `text-${v}` }, { v: u?.name || "Socio eliminado", s: `text-${v}` },
      { v: S.plan(p.planId)?.name || "", s: `text-${v}` }, { v: p.discount?.name || "", s: `text-${v}` }, { v: p.amount || 0, t: "money", s: `money-${v}` }]; }, "Total cuotas cobradas");
  const mov = (m, v) => [{ v: m.at, t: "date", s: `date-${v}` }, { v: m.cat || "", s: `text-${v}`, span: 2 }, { v: m.note || "", s: `text-${v}`, span: 2 }, { v: m.amount || 0, t: "money", s: `money-${v}` }];
  table("OTROS INGRESOS", [["Fecha"], ["Concepto", 2], ["Detalle", 2], ["Monto"]], oM, mov, "Total otros ingresos");
  table("GASTOS", [["Fecha"], ["Concepto", 2], ["Detalle", 2], ["Monto"]], gM, mov, "Total gastos");
  push([T(res >= 0 ? "GANANCIA DEL MES (ingresos − gastos)" : "PÉRDIDA DEL MES (ingresos − gastos)", "labelb", W - 1), { v: res, t: "money", s: "moneyb" }], 28);
  return { name: mname(k), free: true, widths: [13, 13, 28, 28, 22, 17], rows };
}

export async function downloadMaster() {
  const sp = S.currentSpace();
  const now = Date.now(), cur = mkey(now);
  const socios = [...S.activeMembers(), ...S.pending()].filter((u) => S.inSpace(u, sp)).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const pays = S.paymentsOf(sp).slice().sort((a, b) => a.at - b.at);
  const moves = S.movementsOf(sp).slice().sort((a, b) => a.at - b.at);
  const paysOf = {};
  pays.forEach((p) => (paysOf[p.userId] ||= []).push(p));

  /* ---------- mes por mes */
  const hist = S.membershipByMonth(now, sp);
  const hBy = Object.fromEntries(hist.map((h) => [mkey(h.start), h]));
  const keys = [...new Set([...hist.map((h) => mkey(h.start)), ...pays.map((p) => mkey(p.at)), ...moves.map((m) => mkey(m.at)), cur])].filter((k) => k <= cur).sort().reverse();
  const inM = (list, k) => list.filter((x) => mkey(x.at) === k);
  const months = keys.map((k) => { const pM = inM(pays, k), oM = inM(moves.filter((m) => m.kind === "ingreso"), k), gM = inM(moves.filter((m) => m.kind === "gasto"), k);
    return { k, pM, oM, gM, act: hBy[k]?.active ?? 0, alt: hBy[k]?.nuevos ?? 0, fue: hBy[k]?.left ?? 0, c: sum(pM), o: sum(oM), g: sum(gM) }; });

  /* ---------- hoy */
  const act = S.activeMembers().filter((u) => S.inSpace(u, sp));
  const count = (k) => act.filter((u) => S.standing(u).key === k).length;
  const owed = act.filter((u) => S.standing(u).key === "vencida").reduce((a, u) => a + S.priceWith(u.fee?.planId, 1, u.fee?.convenioId).total, 0);
  const activos = act.filter((u) => !["vencida", "baja"].includes(S.standing(u).key)).length;
  const pend = S.pending().filter((u) => S.inSpace(u, sp)).length;

  const resumen = [
    { ht: 84, cells: [] },
    { ht: 34, cells: [T(`Reporte de gestión · ${BRAND}`, "title", 8)] },
    { cells: [T(`Generado el ${new Date(now).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, "sub", 8)] },
    { cells: [] },
    { ht: 24, cells: [T("CÓMO ESTÁ HOY EL GIMNASIO", "sec", 8)] },
    { ht: 28, cells: [H("Socios activos"), H("Cuotas vencidas"), H("Se fueron"), H("Para aprobar"), H("Por cobrar de cuotas vencidas", 2)] },
    { ht: 30, cells: [{ v: activos, t: "int", s: "big" }, { v: count("vencida"), t: "int", s: "big" }, { v: count("baja"), t: "int", s: "big" }, { v: pend, t: "int", s: "big" }, { v: owed, t: "money", s: "bigmoney", span: 2 }] },
    { ht: 48, cells: [T("Socios activos: tienen la cuota al día. Cuotas vencidas: se les venció hace 30 días o menos (cada socio vence en su propia fecha). Se fueron: más de 30 días sin pagar; no cuentan como activos ni como deuda. Para aprobar: se registraron solos en la app y todavía nadie los aprobó (no tiene que ver con el pago).", "hint", 8)] },
    { cells: [] },
    { ht: 24, cells: [T("MES POR MES · tocá un mes para abrir su pestaña", "sec", 8)] },
    { ht: 28, cells: ["Mes", "Socios activos", "Altas", "Se fueron", "Cuotas cobradas", "Otros ingresos", "Gastos", "Resultado"].map((v) => H(v)) },
    ...months.map((m, i) => ({ cells: [{ v: mname(m.k), s: "link", link: `'${mname(m.k)}'!A1` }, { v: m.act, t: "int", s: `int-${z(i)}` }, { v: m.alt, t: "int", s: `int-${z(i)}` }, { v: m.fue, t: "int", s: `int-${z(i)}` },
      { v: m.c, t: "money", s: `money-${z(i)}` }, { v: m.o, t: "money", s: `money-${z(i)}` }, { v: m.g, t: "money", s: `money-${z(i)}` }, { v: m.c + m.o - m.g, t: "money", s: `money-${z(i)}` }] })),
    { cells: [] },
    { ht: 24, cells: [T("QUÉ HAY EN ESTE ARCHIVO", "sec", 8)] },
    { cells: [T("Socios", "labelb"), T(`La base completa: ${socios.length} personas con DNI, plan, estado de la cuota, último pago, profe y contacto.`, "hint", 7)] },
    { cells: [T("Una pestaña por mes", "labelb"), T("Resumen del mes, cuotas cobradas, otros ingresos, gastos y resultado. Abajo de todo están las más viejas.", "hint", 7)] },
    { cells: [T("Datos", "labelb"), T("Las dos últimas pestañas tienen todos los cobros y todos los gastos e ingresos juntos, para filtrar, importar o guardar una copia.", "hint", 7)] },
  ];

  /* ---------- Socios */
  const sRows = socios.map((u) => {
    const pp = paysOf[u.id] || [], lastP = pp[pp.length - 1], st = S.standing(u);
    return {
      dni: u.user || "", nombre: u.name, estado: stateOf(u), plan: S.plan(u.fee?.planId)?.name || "",
      vence: u.fee?.dueAt || "", dias: st.over || "", ultimo: lastP?.at || "", montoUlt: lastP?.amount ?? "", total: sum(pp),
      convenio: S.convenio(u.fee?.convenioId)?.name || "", profe: S.user(u.coachId)?.name || "",
      tel: u.phone || "", email: realEmail(u.email), genero: u.gender || "",
      nac: u.birth ? new Date(u.birth + "T12:00").getTime() : "", edad: ageOf(u.birth), alta: u.joined || "",
    };
  });
  const cRows = pays.map((p) => { const u = S.user(p.userId); const lista = p.list ?? p.amount ?? 0, monto = p.amount || 0;
    return { at: p.at, mes: mstart(mkey(p.at)), dni: u?.user || "", nombre: u?.name || "Socio eliminado", plan: S.plan(p.planId)?.name || "", meses: p.months || 1,
      lista, conv: p.discount?.name || "", desc: Math.max(0, lista - monto), monto, desde: p.from || "", hasta: p.to || "", cobro: S.user(p.by)?.name || "", nota: p.note || "" }; });
  const mRows = moves.map((m) => ({ at: m.at, mes: mstart(mkey(m.at)), tipo: m.kind === "gasto" ? "Gasto" : "Ingreso", cat: m.cat || "", det: m.note || "", ing: m.kind === "gasto" ? "" : m.amount || 0, gas: m.kind === "gasto" ? m.amount || 0 : "" }));
  const sumCol = (L, n) => `SUM(${L}2:${L}${n + 1})`;

  let logo = null;
  try {
    const [png, svg] = await Promise.all([fetch("img/logo-excel.png"), fetch("img/logo-excel.svg")]);
    if (png.ok) logo = { data: new Uint8Array(await png.arrayBuffer()), svg: svg.ok ? await svg.text() : null, w: 230, h: 80 };
  } catch { /* sin logo: el Excel sale igual */ }

  const blob = makeXlsx([
    { name: "Resumen", free: true, logo: true, widths: [20, 16, 14, 14, 18, 18, 18, 18], rows: resumen },
    {
      name: "Socios",
      columns: [
        { header: "DNI", key: "dni", type: "text", width: 13 }, { header: "Nombre y apellido", key: "nombre", type: "text", width: 28 },
        { header: "Estado de la cuota", key: "estado", type: "text", width: 30 }, { header: "Plan", key: "plan", type: "text", width: 30 },
        { header: "Vence el", key: "vence", type: "date", width: 13 }, { header: "Días vencida", key: "dias", type: "int", width: 11 },
        { header: "Último pago", key: "ultimo", type: "date", width: 13 }, { header: "Monto del último pago", key: "montoUlt", type: "money", width: 15 },
        { header: "Total pagado", key: "total", type: "money", width: 15 }, { header: "Convenio", key: "convenio", type: "text", width: 22 },
        { header: "Profe a cargo", key: "profe", type: "text", width: 20 }, { header: "Teléfono", key: "tel", type: "text", width: 15 },
        { header: "Email", key: "email", type: "text", width: 26 }, { header: "Género", key: "genero", type: "text", width: 12 },
        { header: "Fecha de nacimiento", key: "nac", type: "date", width: 14 }, { header: "Edad", key: "edad", type: "int", width: 8 },
        { header: "Socio desde", key: "alta", type: "date", width: 13 },
      ],
      rows: sRows,
      total: (c, L, n) => c.key === "dni" ? "TOTAL" : c.key === "nombre" ? { f: `COUNTA(B2:B${n + 1})&" socios"`, v: `${n} socios` } : c.key === "total" ? { f: sumCol(L, n), v: sum(pays) } : "",
    },
    ...months.map((m) => monthSheet(m.k, m, m.pM, m.oM, m.gM)),
    {
      name: "Datos · todos los cobros",
      columns: [
        { header: "Fecha de cobro", key: "at", type: "date", width: 14 }, { header: "Mes", key: "mes", type: "month", width: 16 },
        { header: "DNI", key: "dni", type: "text", width: 13 }, { header: "Nombre y apellido", key: "nombre", type: "text", width: 28 },
        { header: "Plan", key: "plan", type: "text", width: 30 }, { header: "Meses", key: "meses", type: "int", width: 8 },
        { header: "Precio de lista", key: "lista", type: "money", width: 15 }, { header: "Convenio", key: "conv", type: "text", width: 22 },
        { header: "Descuento", key: "desc", type: "money", width: 13, formula: (r) => `MAX(0,G${r}-J${r})` },
        { header: "Cobrado", key: "monto", type: "money", width: 15 }, { header: "Cubre desde", key: "desde", type: "date", width: 13 },
        { header: "Cubre hasta", key: "hasta", type: "date", width: 13 }, { header: "Cobró", key: "cobro", type: "text", width: 20 },
        { header: "Nota", key: "nota", type: "text", width: 28 },
      ],
      rows: cRows,
      total: (c, L, n) => c.key === "at" ? "TOTAL" : c.key === "nombre" ? { f: `COUNT(A2:A${n + 1})&" pagos"`, v: `${n} pagos` }
        : ["lista", "desc", "monto"].includes(c.key) ? { f: sumCol(L, n), v: cRows.reduce((a, x) => a + (x[c.key] || 0), 0) } : "",
    },
    {
      name: "Datos · ingresos y gastos",
      columns: [
        { header: "Fecha", key: "at", type: "date", width: 13 }, { header: "Mes", key: "mes", type: "month", width: 16 },
        { header: "Tipo", key: "tipo", type: "text", width: 10 }, { header: "Concepto", key: "cat", type: "text", width: 30 },
        { header: "Detalle", key: "det", type: "text", width: 40 }, { header: "Ingreso", key: "ing", type: "money", width: 15 },
        { header: "Gasto", key: "gas", type: "money", width: 15 },
      ],
      rows: mRows,
      total: (c, L, n) => c.key === "at" ? "TOTAL" : ["ing", "gas"].includes(c.key) ? { f: sumCol(L, n), v: mRows.reduce((a, x) => a + (x[c.key] || 0), 0) } : "",
    },
  ], { logo });
  const d = new Date(now);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${BRAND} - Reporte ${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Excel descargado: resumen, socios, una pestaña por mes y los datos completos");
}

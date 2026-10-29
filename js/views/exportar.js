/* Excel maestro: UN solo archivo, en blanco y negro, con 5 pestañas fijas (no crecen con los meses):
   · Resumen: cómo está hoy el gimnasio y una tabla con cada mes en una fila.
   · Ingresos y gastos: el estado de resultados, con cada concepto en una fila y cada mes en una
     columna (cuotas, alquiler de espacios… sueldos, alquiler…, totales y resultado).
   · Socios: la base completa, una fila por socio (DNI, nombre, plan, estado de la cuota…).
   · Cobros: todos los pagos de cuotas, con la columna "Mes" para filtrar.
   · Movimientos: todos los gastos y otros ingresos cargados, con la columna "Mes" para filtrar.
   Las tres últimas son tablas desde la fila 1: se pueden filtrar, importar o guardar como copia. */
import * as S from "../core/store.js";
import { toast } from "../core/ui.js";
import { makeXlsx } from "../core/xlsx.js";

/* El Excel sale con la marca del gimnasio (no la de la app) */
const BRAND = "Vientos GYM";
const MON = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const realEmail = (e) => (/@sin-email\.vientos\.app$/.test(e || "") ? "" : e || "");
const mkey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const mstart = (k) => { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1).getTime(); };
const mname = (k) => { const n = new Date(mstart(k)).toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(" de ", " "); return n[0].toUpperCase() + n.slice(1); };
const mshort = (k) => { const [y, m] = k.split("-").map(Number); return `${MON[m - 1]} ${y}`; };
const sum = (list) => list.reduce((a, x) => a + (x.amount || 0), 0);
const ageOf = (birth) => { if (!birth) return ""; const b = new Date(birth + "T12:00"); if (isNaN(b)) return ""; const t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const STATE = { ok: "Al día", soon: "Por vencer", vencida: "Cuota vencida", baja: "Se fue (más de 30 días sin pagar)", none: "Sin cuota cargada" };
function stateOf(u) {
  if (u.status === "pendiente") return "Registrado en la app, falta aprobar";
  if (u.fee?.unpaid) return "Se anotó y todavía no pagó";
  return STATE[S.standing(u).key] || "";
}
const colName = (i) => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

/* celdas de las hojas libres */
const T = (v, s = "label", span) => ({ v, s, span });
const z = (i) => (i % 2 ? "zebra" : "plain");

export async function downloadMaster() {
  const sp = S.currentSpace();
  const now = Date.now(), cur = mkey(now);
  const socios = [...S.activeMembers(), ...S.pending()].filter((u) => S.inSpace(u, sp)).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const pays = S.paymentsOf(sp).slice().sort((a, b) => a.at - b.at);
  const moves = S.movementsOf(sp).slice().sort((a, b) => a.at - b.at);
  const ingresos = moves.filter((m) => m.kind === "ingreso"), gastos = moves.filter((m) => m.kind === "gasto");
  const paysOf = {};
  pays.forEach((p) => (paysOf[p.userId] ||= []).push(p));

  /* ---------- meses (del primero con datos al actual) */
  const hist = S.membershipByMonth(now, sp);
  const hBy = Object.fromEntries(hist.map((h) => [mkey(h.start), h]));
  const keys = [...new Set([...hist.map((h) => mkey(h.start)), ...pays.map((p) => mkey(p.at)), ...moves.map((m) => mkey(m.at)), cur])].filter((k) => k <= cur).sort();
  const inM = (list, k) => list.filter((x) => mkey(x.at) === k);
  const months = keys.map((k) => ({ k, act: hBy[k]?.active ?? 0, alt: hBy[k]?.nuevos ?? 0, fue: hBy[k]?.left ?? 0, c: sum(inM(pays, k)), o: sum(inM(ingresos, k)), g: sum(inM(gastos, k)) }));

  /* ---------- hoy */
  const act = S.activeMembers().filter((u) => S.inSpace(u, sp));
  const count = (k) => act.filter((u) => S.standing(u).key === k).length;
  const owed = act.filter((u) => S.standing(u).key === "vencida").reduce((a, u) => a + S.priceWith(u.fee?.planId, 1, u.fee?.convenioId).total, 0);
  const activos = act.filter((u) => !["vencida", "baja"].includes(S.standing(u).key)).length;
  const pend = S.pending().filter((u) => S.inSpace(u, sp)).length;
  const m0 = months[months.length - 1];

  /* ---------- Resumen */
  const KPI = (label, v, t = "int") => ({ label, v, t });
  const kpiRow = (list) => [
    { ht: 22, cells: list.map((x) => T(x.label, "sub")) },
    { ht: 30, cells: list.map((x) => ({ v: x.v, t: x.t, s: x.t === "money" ? "bigmoney" : "big" })) },
  ];
  const resumen = [
    { ht: 84, cells: [] },
    { ht: 32, cells: [T(`Reporte de gestión · ${BRAND}`, "title", 8)] },
    { cells: [T(`Generado el ${new Date(now).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, "sub", 8)] },
    { cells: [] },
    { ht: 24, cells: [T("  LOS SOCIOS HOY", "sec", 8)] },
    ...kpiRow([KPI("Socios activos", activos), KPI("Cuotas vencidas", count("vencida")), KPI("Se fueron", count("baja")), KPI("Para aprobar", pend)]),
    { ht: 44, cells: [T("Activos: cuota al día. Cuotas vencidas: vencieron hace 30 días o menos (cada socio vence en su propia fecha). Se fueron: más de 30 días sin pagar; no cuentan como activos ni como deuda. Para aprobar: se registraron solos en la app y todavía nadie los aprobó.", "hint", 8)] },
    { cells: [] },
    { ht: 24, cells: [T(`  LA PLATA DE ${mname(cur).toUpperCase()}`, "sec", 8)] },
    ...kpiRow([KPI("Cobrado en cuotas", m0.c, "money"), KPI("Otros ingresos", m0.o, "money"), KPI("Gastos", m0.g, "money"), KPI("Resultado", m0.c + m0.o - m0.g, "money"), KPI("Por cobrar (vencidas)", owed, "money")]),
    { cells: [] },
    { ht: 24, cells: [T("  MES POR MES", "sec", 8)] },
    { ht: 30, cells: [{ v: "Mes", s: "headl" }, ...["Socios activos", "Altas", "Se fueron"].map((v) => ({ v, s: "head" })), ...["Cuotas cobradas", "Otros ingresos", "Gastos", "Resultado"].map((v) => ({ v, s: "headr" }))] },
    ...months.slice().reverse().map((m, i) => ({ cells: [{ v: mname(m.k), s: `text-${z(i)}` }, { v: m.act, t: "int", s: `int-${z(i)}` }, { v: m.alt, t: "int", s: `int-${z(i)}` }, { v: m.fue, t: "int", s: `int-${z(i)}` },
      ...[m.c, m.o, m.g, m.c + m.o - m.g].map((v) => ({ v, t: "money", s: i % 2 ? "moneyrz" : "moneyr" }))] })),
    { cells: [] },
    { ht: 24, cells: [T("  QUÉ HAY EN CADA PESTAÑA", "sec", 8)] },
    { cells: [T("Ingresos y gastos", "labelb"), T("Todos los meses uno al lado del otro: de dónde entró la plata, en qué se gastó y el resultado de cada mes.", "hint", 7)] },
    { cells: [T("Socios", "labelb"), T(`La base completa (${socios.length} personas): DNI, plan, estado de la cuota, último pago, profe y contacto.`, "hint", 7)] },
    { cells: [T("Cobros", "labelb"), T(`Cada cuota cobrada (${pays.length}). Para ver un solo mes, filtrá la columna "Mes".`, "hint", 7)] },
    { cells: [T("Movimientos", "labelb"), T(`Cada gasto y cada ingreso que no es cuota (${moves.length}). También se filtra por "Mes".`, "hint", 7)] },
  ];

  /* ---------- Ingresos y gastos: conceptos en filas, meses en columnas */
  const N = keys.length, totCol = colName(N + 1);
  const pl = [];
  const row = (cells, ht) => pl.push({ cells, ht });
  row([T(`Ingresos y gastos · ${BRAND}`, "title", Math.min(N + 2, 8))], 32);
  row([T("Cada mes en una columna. Los totales y el resultado se calculan solos.", "sub", Math.min(N + 2, 8))]);
  row([]);
  row([{ v: "Concepto", s: "headl" }, ...keys.map((k) => ({ v: mshort(k), s: "headr" })), { v: "Total", s: "headr" }], 26);
  const head = pl.length;
  const line = (label, vals, i) => { const r = pl.length + 1; row([{ v: label, s: `text-${z(i)}` }, ...vals.map((v) => ({ v, t: "money", s: i % 2 ? "moneyrz" : "moneyr" })), { v: { f: `SUM(B${r}:${colName(N)}${r})`, v: vals.reduce((a, b) => a + b, 0) }, t: "money", s: i % 2 ? "moneyrz" : "moneyr" }]); };
  const totalLine = (label, from, to, vals, style = "moneyrt") => { const r = pl.length + 1;
    row([{ v: label, s: style === "moneyrb" ? "labelb" : "text-total" }, ...vals.map((v, i) => ({ v: { f: `SUM(${colName(i + 1)}${from}:${colName(i + 1)}${to})`, v }, t: "money", s: style })), { v: { f: `SUM(B${r}:${colName(N)}${r})`, v: vals.reduce((a, b) => a + b, 0) }, t: "money", s: style }], 24); return r; };
  const block = (title, lines) => {
    row([T(`  ${title}`, "sec", N + 2)], 22);
    const from = pl.length + 1;
    lines.forEach(([label, vals], i) => line(label, vals, i));
    return from;
  };
  const byCat = (list, cat) => keys.map((k) => sum(inM(list, k).filter((x) => (x.cat || "Otros") === cat)));
  const incCats = S.INCOME_CATS.filter((c) => ingresos.some((x) => (x.cat || "Otros") === c));
  const expCats = [...S.EXPENSE_CATS.filter((c) => gastos.some((x) => (x.cat || "Otros") === c)), ...[...new Set(gastos.map((x) => x.cat))].filter((c) => c && !S.EXPENSE_CATS.includes(c))];
  const vIng = keys.map((k, i) => months[i].c + months[i].o), vGas = keys.map((k, i) => months[i].g);
  const f1 = block("INGRESOS", [["Cuotas de socios", months.map((m) => m.c)], ...incCats.map((c) => [c, byCat(ingresos, c)])]);
  const rIng = totalLine("Total ingresos", f1, pl.length, vIng);
  row([]);
  const f2 = block("GASTOS", expCats.length ? expCats.map((c) => [c, byCat(gastos, c)]) : [["Sin gastos cargados", keys.map(() => 0)]]);
  const rGas = totalLine("Total gastos", f2, pl.length, vGas);
  row([]);
  { const r = pl.length + 1;
    row([{ v: "RESULTADO (ingresos − gastos)", s: "labelb" }, ...keys.map((k, i) => ({ v: { f: `${colName(i + 1)}${rIng}-${colName(i + 1)}${rGas}`, v: vIng[i] - vGas[i] }, t: "money", s: "moneyrb" })),
      { v: { f: `${totCol}${rIng}-${totCol}${rGas}`, v: vIng.reduce((a, b) => a + b, 0) - vGas.reduce((a, b) => a + b, 0) }, t: "money", s: "moneyrb" }], 26); void r; }

  /* ---------- tablas de datos */
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
  const cRows = pays.slice().reverse().map((p) => { const u = S.user(p.userId); const lista = p.list ?? p.amount ?? 0, monto = p.amount || 0;
    return { mes: mstart(mkey(p.at)), at: p.at, dni: u?.user || "", nombre: u?.name || "Socio eliminado", plan: S.plan(p.planId)?.name || "", meses: p.months || 1,
      lista, conv: p.discount?.name || "", desc: Math.max(0, lista - monto), monto, desde: p.from || "", hasta: p.to || "", cobro: S.user(p.by)?.name || "", nota: p.note || "" }; });
  const mRows = moves.slice().reverse().map((m) => ({ mes: mstart(mkey(m.at)), at: m.at, tipo: m.kind === "gasto" ? "Gasto" : "Ingreso", cat: m.cat || "", det: m.note || "", ing: m.kind === "gasto" ? "" : m.amount || 0, gas: m.kind === "gasto" ? m.amount || 0 : "" }));
  /* SUBTOTAL: los totales cuentan solo las filas visibles, así se ajustan al filtrar (por mes, plan, estado…) */
  const sumCol = (L, n) => `SUBTOTAL(109,${L}2:${L}${n + 1})`;
  const TOT = "TOTAL (lo que se ve)";

  let logo = null;
  try {
    const [png, svg] = await Promise.all([fetch("img/logo-excel.png"), fetch("img/logo-excel.svg")]);
    if (png.ok) logo = { data: new Uint8Array(await png.arrayBuffer()), svg: svg.ok ? await svg.text() : null, w: 230, h: 80 };
  } catch { /* sin logo: el Excel sale igual */ }

  const blob = makeXlsx([
    { name: "Resumen", free: true, logo: true, widths: [22, 16, 16, 16, 18, 18, 18, 18], rows: resumen },
    { name: "Ingresos y gastos", free: true, widths: [32, ...keys.map(() => 15), 17], rows: pl, freeze: { col: 1, row: head } },
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
      total: (c, L, n) => c.key === "dni" ? TOT : c.key === "nombre" ? { f: `SUBTOTAL(103,B2:B${n + 1})&" socios"`, v: `${n} socios` } : c.key === "total" ? { f: sumCol(L, n), v: sum(pays) } : "",
    },
    {
      name: "Cobros",
      columns: [
        { header: "Mes", key: "mes", type: "month", width: 16 }, { header: "Fecha de cobro", key: "at", type: "date", width: 14 },
        { header: "DNI", key: "dni", type: "text", width: 13 }, { header: "Nombre y apellido", key: "nombre", type: "text", width: 28 },
        { header: "Plan", key: "plan", type: "text", width: 30 }, { header: "Meses", key: "meses", type: "int", width: 8 },
        { header: "Precio de lista", key: "lista", type: "money", width: 15 }, { header: "Convenio", key: "conv", type: "text", width: 22 },
        { header: "Descuento", key: "desc", type: "money", width: 13, formula: (r) => `MAX(0,G${r}-J${r})` },
        { header: "Cobrado", key: "monto", type: "money", width: 15 }, { header: "Cubre desde", key: "desde", type: "date", width: 13 },
        { header: "Cubre hasta", key: "hasta", type: "date", width: 13 }, { header: "Cobró", key: "cobro", type: "text", width: 20 },
        { header: "Nota", key: "nota", type: "text", width: 28 },
      ],
      rows: cRows,
      total: (c, L, n) => c.key === "mes" ? TOT : c.key === "nombre" ? { f: `SUBTOTAL(102,B2:B${n + 1})&" pagos"`, v: `${n} pagos` }
        : ["lista", "desc", "monto"].includes(c.key) ? { f: sumCol(L, n), v: cRows.reduce((a, x) => a + (x[c.key] || 0), 0) } : "",
    },
    {
      name: "Movimientos",
      columns: [
        { header: "Mes", key: "mes", type: "month", width: 16 }, { header: "Fecha", key: "at", type: "date", width: 13 },
        { header: "Tipo", key: "tipo", type: "text", width: 10 }, { header: "Concepto", key: "cat", type: "text", width: 30 },
        { header: "Detalle", key: "det", type: "text", width: 40 }, { header: "Ingreso", key: "ing", type: "money", width: 15 },
        { header: "Gasto", key: "gas", type: "money", width: 15 },
      ],
      rows: mRows,
      total: (c, L, n) => c.key === "mes" ? TOT : ["ing", "gas"].includes(c.key) ? { f: sumCol(L, n), v: mRows.reduce((a, x) => a + (x[c.key] || 0), 0) } : "",
    },
  ], { logo });
  const d = new Date(now);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${BRAND} - Reporte ${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Excel descargado");
}

/* Excel maestro: UN solo archivo con todo lo que el dueño ve en la plataforma, para tenerlo a
   mano, mandarlo al contador o guardarlo como copia. Hojas:
   · Resumen: el mes en curso y mes por mes (socios, cobros, gastos y resultado), con el logo.
   · Socios: la base completa, una fila por socio (DNI, nombre, plan, estado de la cuota…).
   · Cobros de cuotas: todos los pagos de todos los meses (columna "Mes" para filtrar).
   · Ingresos y gastos: todo lo que se cargó en la caja (alquiler de espacios, sueldos, alquiler…).
   Las tablas empiezan en la fila 1 con su encabezado: se pueden filtrar o importar a una base de datos. */
import * as S from "../core/store.js";
import { toast } from "../core/ui.js";
import { makeXlsx } from "../core/xlsx.js";

/* El Excel sale con la marca del gimnasio (no la de la app) */
const BRAND = "Vientos GYM";
const realEmail = (e) => (/@sin-email\.vientos\.app$/.test(e || "") ? "" : e || "");
const mkey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const mstart = (k) => { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1).getTime(); };
const mlabel = (k) => { const n = new Date(mstart(k)).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); return n[0].toUpperCase() + n.slice(1); };
const sum = (list) => list.reduce((a, x) => a + (x.amount || 0), 0);
const ageOf = (birth) => { if (!birth) return ""; const b = new Date(birth + "T12:00"); if (isNaN(b)) return ""; const t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const STATE = { ok: "Al día", soon: "Por vencer", vencida: "Cuota vencida", baja: "Se fue (más de 30 días sin pagar)", none: "Sin cuota cargada" };

function stateOf(u) {
  if (u.status === "pendiente") return "Para aprobar";
  if (u.fee?.unpaid) return "Se anotó y no pagó";
  return STATE[S.standing(u).key] || "";
}

export async function downloadMaster() {
  const sp = S.currentSpace();
  const now = Date.now(), cur = mkey(now);
  const socios = [...S.activeMembers(), ...S.pending()].filter((u) => S.inSpace(u, sp)).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const pays = S.paymentsOf(sp).slice().sort((a, b) => a.at - b.at);
  const moves = S.movementsOf(sp).slice().sort((a, b) => a.at - b.at);
  const paysOf = {};
  pays.forEach((p) => (paysOf[p.userId] ||= []).push(p));

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

  /* ---------- Cobros de cuotas */
  const cRows = pays.map((p) => { const u = S.user(p.userId); const lista = p.list ?? p.amount ?? 0, monto = p.amount || 0;
    return { at: p.at, mes: mstart(mkey(p.at)), dni: u?.user || "", nombre: u?.name || "Socio eliminado", plan: S.plan(p.planId)?.name || "", meses: p.months || 1,
      lista, conv: p.discount?.name || "", desc: Math.max(0, lista - monto), monto, desde: p.from || "", hasta: p.to || "", cobro: S.user(p.by)?.name || "", nota: p.note || "" }; });

  /* ---------- Ingresos y gastos */
  const mRows = moves.map((m) => ({ at: m.at, mes: mstart(mkey(m.at)), tipo: m.kind === "gasto" ? "Gasto" : "Ingreso", cat: m.cat || "", det: m.note || "", ing: m.kind === "gasto" ? "" : m.amount || 0, gas: m.kind === "gasto" ? m.amount || 0 : "" }));

  /* ---------- Resumen: mes por mes */
  const hist = S.membershipByMonth(now, sp);
  const hBy = Object.fromEntries(hist.map((h) => [mkey(h.start), h]));
  const keys = [...new Set([...hist.map((h) => mkey(h.start)), ...pays.map((p) => mkey(p.at)), ...moves.map((m) => mkey(m.at))])].filter((k) => k <= cur).sort().reverse();
  const byM = (list, k) => list.filter((x) => mkey(x.at) === k);
  const months = keys.map((k) => { const c = sum(byM(pays, k)), o = sum(byM(moves.filter((m) => m.kind === "ingreso"), k)), g = sum(byM(moves.filter((m) => m.kind === "gasto"), k));
    return { k, act: hBy[k]?.active ?? "", alt: hBy[k]?.nuevos ?? "", fue: hBy[k]?.left ?? "", c, o, g, r: c + o - g }; });
  const m0 = months[0] || { k: cur, c: 0, o: 0, g: 0, r: 0 };
  const act = S.activeMembers().filter((u) => S.inSpace(u, sp));
  const count = (k) => act.filter((u) => S.standing(u).key === k).length;
  const vencidas = act.filter((u) => S.standing(u).key === "vencida");
  const owed = vencidas.reduce((a, u) => a + S.priceWith(u.fee?.planId, 1, u.fee?.convenioId).total, 0);
  const activos = act.filter((u) => !["vencida", "baja"].includes(S.standing(u).key)).length;

  const H = (v) => ({ v, s: "head" });
  const resumen = [
    { ht: 84, cells: [] },
    { ht: 34, cells: [{ v: `Reporte de gestión · ${BRAND}`, s: "title", span: 8 }] },
    { cells: [{ v: `Generado el ${new Date(now).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, s: "sub", span: 8 }] },
    { cells: [] },
    { ht: 26, cells: [{ v: `ESTE MES · ${mlabel(cur).toUpperCase()}`, s: "sec", span: 8 }] },
    { ht: 30, cells: [H("Socios activos"), H("Cuotas vencidas"), H("Se fueron"), H("Altas del mes"), H("Para aprobar")] },
    { ht: 30, cells: [{ v: activos, t: "int", s: "big" }, { v: count("vencida"), t: "int", s: "big" }, { v: count("baja"), t: "int", s: "big" }, { v: hBy[cur]?.nuevos ?? 0, t: "int", s: "big" }, { v: S.pending().filter((u) => S.inSpace(u, sp)).length, t: "int", s: "big" }] },
    { ht: 34, cells: [{ v: "Activos: cuota al día. Cuotas vencidas: vencieron hace 30 días o menos (cada socio vence en su propia fecha). Se fueron: más de 30 días sin pagar; no cuentan como activos ni como deuda.", s: "hint", span: 8 }] },
    { cells: [] },
    { ht: 30, cells: [H("Cobrado en cuotas"), H("Otros ingresos"), H("Total ingresos"), H("Gastos"), H("Resultado del mes"), H("Por cobrar de cuotas vencidas")] },
    { ht: 30, cells: [{ v: m0.c, t: "money", s: "bigmoney" }, { v: m0.o, t: "money", s: "bigmoney" }, { v: m0.c + m0.o, t: "money", s: "bigmoney" }, { v: m0.g, t: "money", s: "bigmoney" }, { v: m0.r, t: "money", s: m0.r < 0 ? "badmoney" : "goodmoney" }, { v: owed, t: "money", s: "bigmoney" }] },
    { cells: [] },
    { ht: 26, cells: [{ v: "MES POR MES", s: "sec", span: 8 }] },
    { ht: 30, cells: ["Mes", "Socios activos", "Altas", "Se fueron", "Cuotas cobradas", "Otros ingresos", "Gastos", "Resultado"].map(H) },
    ...months.map((m, i) => { const z = i % 2 ? "zebra" : "plain";
      return { cells: [{ v: mstart(m.k), t: "month", s: `month-${z}` }, { v: m.act, t: "int", s: `int-${z}` }, { v: m.alt, t: "int", s: `int-${z}` }, { v: m.fue, t: "int", s: `int-${z}` },
        { v: m.c, t: "money", s: `money-${z}` }, { v: m.o, t: "money", s: `money-${z}` }, { v: m.g, t: "money", s: `money-${z}` }, { v: m.r, t: "money", s: `money-${z}` }] }; }),
    { cells: [] },
    { ht: 26, cells: [{ v: "QUÉ HAY EN CADA HOJA", s: "sec", span: 8 }] },
    { cells: [{ v: "Socios", s: "label" }, { v: `La base completa: ${socios.length} personas con DNI, plan, estado de la cuota, último pago, profe y datos de contacto.`, s: "hint", span: 7 }] },
    { cells: [{ v: "Cobros de cuotas", s: "label" }, { v: `Todos los pagos de cuotas (${pays.length}). Filtrá por la columna "Mes" para ver uno solo.`, s: "hint", span: 7 }] },
    { cells: [{ v: "Ingresos y gastos", s: "label" }, { v: `Los otros ingresos (alquiler de espacios, shop…) y todos los gastos cargados (${moves.length}).`, s: "hint", span: 7 }] },
  ];

  const sumCol = (L, n) => `SUM(${L}2:${L}${n + 1})`;
  let logo = null;
  try {
    const [png, svg] = await Promise.all([fetch("img/logo-excel.png"), fetch("img/logo-excel.svg")]);
    if (png.ok) logo = { data: new Uint8Array(await png.arrayBuffer()), svg: svg.ok ? await svg.text() : null, w: 230, h: 80 };
  } catch { /* sin logo: el Excel sale igual */ }
  const blob = makeXlsx([
    { name: "Resumen", free: true, logo: true, widths: [24, 18, 18, 18, 18, 18, 18, 18], rows: resumen },
    {
      name: "Socios",
      columns: [
        { header: "DNI", key: "dni", type: "text", width: 13 }, { header: "Nombre y apellido", key: "nombre", type: "text", width: 28 },
        { header: "Estado de la cuota", key: "estado", type: "text", width: 26 }, { header: "Plan", key: "plan", type: "text", width: 30 },
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
    {
      name: "Cobros de cuotas",
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
      name: "Ingresos y gastos",
      columns: [
        { header: "Fecha", key: "at", type: "date", width: 13 }, { header: "Mes", key: "mes", type: "month", width: 16 },
        { header: "Tipo", key: "tipo", type: "text", width: 10 }, { header: "Categoría", key: "cat", type: "text", width: 30 },
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
  toast("Excel descargado: tiene todo (resumen, socios, cobros, ingresos y gastos)");
}

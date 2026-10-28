/* Panel del entrenador y del gimnasio */
import { icon, logo } from "../core/icons.js";
import { esc, fold, addMonths, fmtDate, relDay, dayKey, plural, debounce, waNumber, firstName, DAY, $, $$, countUp } from "../core/util.js";
import * as S from "../core/store.js";
import { me, isAdmin, logout } from "../core/auth.js";
import { go, refresh } from "../core/router.js";
import { field, dateField, limitList, formData, toast, sheet, confirmDialog, pageHead, empty, avatar, feePill, spaceLogo } from "../core/ui.js";
import { heatmap } from "./progress.js";
import { makeXlsx } from "../core/xlsx.js";
import { routineView } from "./routine.js";
import { qrSvg, installUrl } from "./install.js";

/* Socios sin email: se les crea uno interno que no se muestra */
const realEmail = (e) => (/@sin-email\.vientos\.app$/.test(e || "") ? "" : e || "");
const money = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");
const lastLog = (uid) => S.logsOf(uid)[0];

/* --------------------------------------------------------------- resumen
   Solo datos confiables: socios, cuotas, plata y perfil de los socios.
   NO se usa el registro de entrenamientos como asistencia: no todos los
   socios anotan en la app, así que "quién vino" daría datos falsos. */
const pct = (n, t) => (t ? Math.round((n / t) * 100) : 0);
const ageOf = (birth) => { if (!birth) return null; const b = new Date(birth + "T12:00"); if (isNaN(b)) return null; const t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };

/* Barras horizontales con su número y porcentaje escritos (un solo color) */
function hbars(rows, total, { money: isMoney = false } = {}) {
  if (!total) return `<p class="muted">Todavía no hay datos.</p>`;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return `<div class="hb">${rows.map((r) => `<div class="hb-row" title="${esc(r.label)}: ${isMoney ? money(r.n) : r.n} (${pct(r.n, total)} %)">
      <span class="hb-l">${esc(r.label)}</span>
      <span class="hb-t"><i style="width:${Math.max(r.n ? 3 : 0, (r.n / max) * 100)}%"></i></span>
      <span class="hb-v"><b>${isMoney ? money(r.n) : r.n}</b><em>${pct(r.n, total)} %</em></span></div>`).join("")}</div>`;
}

/* Columnas: socios activos mes a mes. Se toca una columna para ver el detalle de ese mes.
   Con muchos meses (1 año, 2 años…) se desliza hacia los lados y arranca en el mes actual. */
function monthCols(rows) {
  const max = Math.max(...rows.map((r) => r.n), 1);
  const scroll = rows.length > 8;
  return `<div class="cols-wrap ${scroll ? "scroll" : ""}" data-cols><div class="cols" style="--n:${rows.length}">${rows.map((r, i) => `<button type="button" class="col ${r.cur ? "cur" : ""}" data-mi="${i}" aria-label="${esc(r.title)}: ${r.n} socios activos"><b>${r.n}</b><span class="col-t"><i style="height:${Math.max(r.n ? 4 : 0, (r.n / max) * 100)}%"></i></span><small>${esc(r.label)}</small><em>${esc(r.year || "")}</em></button>`).join("")}</div></div>${scroll ? `<p class="muted tiny cols-hint">${icon("left", "xs")} Deslizá para ver los meses anteriores</p>` : ""}`;
}

export function panelHome() {
  const u = me(), admin = u.role === "admin";
  const sp = S.currentSpace(), isFitz = sp === "fitz";
  const act = S.spaceMembers();
  const mine = S.membersOf(u.id);
  const soon = act.filter((m) => S.feeStatus(m).state === "soon");
  const late = act.filter((m) => S.feeStatus(m).state === "late");
  const noRoutine = act.filter((m) => !S.activeRoutine(m.id));
  const neverIn = act.filter((m) => m.prefs?.tempPass);
  const pend = S.pending().filter((m) => S.inSpace(m));
  const kpi = (n, label, href, cls = "", sub = "") => `<a class="kpi ${cls}" href="${href}"><b data-count="${n}">0</b><small>${label}</small>${sub ? `<em class="kpi-sub">${sub}</em>` : ""}</a>`;
  const mrow = (m, extra) => `<a class="mrow" href="#/panel/socios/${m.id}">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${extra}</small></span>${icon("right", "sm")}</a>`;

  /* Plata (solo el dueño) */
  const now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime(), m1 = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const pm0 = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const paid = (a, b) => S.paymentsOf().filter((p) => p.at >= a && p.at < b).reduce((x, p) => x + (p.amount || 0), 0);
  const thisMonth = paid(m0, m1), lastMonth = paid(pm0, m0);
  const priceOf = (m) => S.priceWith(m.fee?.planId, 1, m.fee?.convenioId).total;
  /* Falta cobrar este mes: cuotas que todavía no vencieron (o vencen hoy) y vencen antes de fin de mes.
     Las que ya vencieron van en "Deuda". Usa el mismo criterio de días que el estado de cada socio. */
  const toCollect = act.filter((m) => { const st = S.feeStatus(m); return st.state !== "none" && st.state !== "late" && m.fee.dueAt < m1; });
  const owed = late.reduce((x, m) => x + priceOf(m), 0);
  /* Comparación justa: lo cobrado hasta hoy contra lo cobrado en el MISMO período del mes anterior */
  const lastSame = paid(pm0, Math.min(m0, pm0 + (Date.now() - m0)));
  const diff = lastSame ? Math.round(((thisMonth - lastSame) / lastSame) * 100) : null;
  const alDia = act.length - late.length - act.filter((m) => S.feeStatus(m).state === "none").length;
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  /* Perfil de los socios */
  const gen = { Femenino: 0, Masculino: 0, Otro: 0, "Sin dato": 0 };
  act.forEach((m) => { const g = m.gender === "Femenino" || m.gender === "Masculino" ? m.gender : m.gender ? "Otro" : "Sin dato"; gen[g]++; });
  const genRows = [["Mujeres", gen.Femenino], ["Hombres", gen.Masculino], ["Otro", gen.Otro], ["Sin dato", gen["Sin dato"]]].filter(([, n], i) => n || i < 2).map(([label, n]) => ({ label, n }));
  const AGE = [["Menos de 18", 0, 17], ["18 a 25", 18, 25], ["26 a 35", 26, 35], ["36 a 45", 36, 45], ["46 a 60", 46, 60], ["Más de 60", 61, 200]];
  const ages = act.map((m) => ageOf(m.birth));
  const ageRows = AGE.map(([label, a, b]) => ({ label, n: ages.filter((x) => x !== null && x >= a && x <= b).length }));
  const noAge = ages.filter((x) => x === null).length;
  if (noAge) ageRows.push({ label: "Sin dato", n: noAge });
  const planRows = S.plansOf().map((p) => ({ label: p.name, n: act.filter((m) => m.fee?.planId === p.id).length }));
  const noPlan = act.filter((m) => !m.fee?.planId).length;
  if (noPlan) planRows.push({ label: "Sin plan", n: noPlan });
  /* Socios mes a mes: activos, nuevos, siguieron, se fueron y volvieron (contra altas y pagos guardados) */
  const hist = S.membershipByMonth(Date.now(), sp);
  const mrows = hist.map((h, i) => { const d = new Date(h.start); return { label: MONTHS[d.getMonth()], year: i === 0 || d.getMonth() === 0 ? String(d.getFullYear()) : "", title: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, n: h.active, cur: h.cur }; });
  const detail = (h) => { const d = new Date(h.start); const nm = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    return `<h3 class="sub">${esc(nm[0].toUpperCase() + nm.slice(1))}</h3><div class="mstats">
      <div class="ms-main"><b>${h.active}</b><small>socios activos</small></div>
      <div><b>${h.nuevos}</b><small>nuevos</small></div>
      <div><b>${h.kept}</b><small>siguieron</small></div>
      <div><b>${h.left}</b><small>se fueron</small></div>
      <div><b>${h.back}</b><small>volvieron</small></div></div>`; };
  const avgAge = ages.filter((x) => x !== null);
  const convRows = isFitz ? [] : S.convenios().map((c) => ({ label: c.name, n: act.filter((m) => m.fee?.convenioId === c.id).length }));
  if (convRows.length) convRows.push({ label: "Sin convenio", n: act.filter((m) => !S.convenio(m.fee?.convenioId)).length });

  return {
    layout: "panel", nav: "resumen", title: "Resumen",
    html: `<section class="phello"><span class="kicker">${esc(fmtDate(Date.now()))}${S.isProvider() ? ` · ${esc(S.spaceInfo(sp).name)}` : ""}</span><h1>Hola, ${esc(firstName(u.name))}</h1></section>
      <section class="kpis">
        ${kpi(act.length, "socios activos", "#/panel/socios", "", `${alDia} con cuota al día · ${late.length} vencidas`)}
        ${kpi(soon.length, "cuotas por vencer", "#/panel/cuotas?f=soon", soon.length ? "warn" : "")}
        ${kpi(late.length, "cuotas vencidas", "#/panel/cuotas?f=late", late.length ? "bad" : "")}
        ${kpi(noRoutine.length, "sin rutina asignada", "#/panel/socios?f=sin", noRoutine.length ? "warn" : "")}
      </section>
      ${admin ? `<section class="money">
        <a class="mlink" href="#/panel/recaudacion"><small>Cobrado en ${now.toLocaleDateString("es-AR", { month: "long" })}</small><b>${money(thisMonth)}</b>${diff !== null ? `<em class="${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff)} % vs. ${MONTHS[new Date(pm0).getMonth()]} (mismos días)</em>` : `<em>${MONTHS[new Date(pm0).getMonth()]}: ${money(lastMonth)} en total</em>`}<span class="cta">Ver historial ${icon("right", "xs")}</span></a>
        <div><small>Falta cobrar este mes</small><b>${money(toCollect.reduce((x, m) => x + priceOf(m), 0))}</b><em>${plural(toCollect.length, "cuota vence", "cuotas vencen")} hasta fin de mes</em></div>
        <div><small>Cuotas vencidas sin pagar</small><b class="${owed ? "bad" : ""}">${money(owed)}</b><em>${plural(late.length, "socio", "socios")} · se cuenta 1 cuota por socio</em></div>
      </section>` : ""}
      ${pend.length ? `<section class="card alert-card"><div class="card-h"><h2>${icon("userplus", "sm")} Socios nuevos para aprobar</h2><span class="pill red">${pend.length}</span></div>
        ${pend.slice(0, 5).map((m) => `<div class="mrow">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${esc(m.email)} · ${esc(relDay(m.joined))}</small></span><button class="btn primary sm" type="button" data-approve="${m.id}">Revisar</button></div>`).join("")}
      ${pend.length > 5 ? `<a class="btn ghost sm block" href="#/panel/socios?f=pend">Ver las ${pend.length} solicitudes</a>` : ""}
      </section>` : ""}
      <div class="pgrid">
        <section class="card"><div class="card-h"><h2>${icon("dumbbell", "sm")} Sin rutina asignada</h2><span class="muted">${noRoutine.length}</span></div>
          ${noRoutine.slice(0, 6).map((m) => mrow(m, `Socio desde ${fmtDate(m.joined)}`)).join("") || `<p class="muted">Todos los socios tienen rutina.</p>`}
          ${noRoutine.length > 6 ? `<a class="btn ghost sm" href="#/panel/socios?f=sin">Ver los ${noRoutine.length}</a>` : ""}
        </section>
        <section class="card"><div class="card-h"><h2>${icon("download", "sm")} Uso de la app</h2><span class="muted">${pct(act.length - neverIn.length, act.length)} % ya entró</span></div>
          ${hbars([{ label: "Ya entraron", n: act.length - neverIn.length }, { label: "Nunca entraron", n: neverIn.length }], act.length)}
          ${neverIn.length ? `<a class="btn ghost sm block" href="#/panel/socios?f=app">${icon("users", "sm")} Ver los ${neverIn.length} que nunca entraron</a>` : `<p class="muted tiny">Todos los socios ya entraron a la app.</p>`}
        </section>
        ${admin ? `
        <section class="card"><div class="card-h"><h2>${icon("users", "sm")} Socios por mes</h2><span class="muted">activos · tocá un mes</span></div>${hist.length ? `${monthCols(mrows)}<div data-mdet>${detail(hist[hist.length - 1])}</div>
          <p class="muted tiny">"Activos" son los socios con cuota vigente ese mes, según los pagos registrados. Cada persona cuenta como "nueva" una sola vez (el mes de su alta). Los meses anteriores al uso de la app no tienen datos.</p>` : `<p class="muted">Todavía no hay datos.</p>`}</section>
        <section class="card"><div class="card-h"><h2>${icon("card", "sm")} Socios por plan</h2></div>${hbars(planRows, act.length)}</section>
        ${convRows.length ? `<section class="card"><div class="card-h"><h2>${icon("card", "sm")} Socios por convenio</h2></div>${hbars(convRows, act.length)}</section>` : ""}
        <section class="card"><div class="card-h"><h2>${icon("users", "sm")} Mujeres y hombres</h2></div>${hbars(genRows, act.length)}</section>
        <section class="card"><div class="card-h"><h2>${icon("calendar", "sm")} Edades</h2>${avgAge.length ? `<span class="muted">promedio ${Math.round(avgAge.reduce((a, b) => a + b, 0) / avgAge.length)} años</span>` : ""}</div>${hbars(ageRows, act.length)}</section>`
        : `<section class="card"><div class="card-h"><h2>${icon("users", "sm")} Mis socios</h2><span class="muted">${mine.length}</span></div>
          ${mine.slice(0, 8).map((m) => { const r = S.activeRoutine(m.id); return mrow(m, r ? esc(S.routineTitle(r)) : "Sin rutina"); }).join("") || `<p class="muted">Todavía no tenés socios a cargo.</p>`}
          <a class="btn ghost sm" href="#/panel/socios?f=mios">Ver todos</a></section>`}
      </div>
      ${admin && (genRows.some((r) => r.label === "Sin dato" && r.n) || noAge) ? `<p class="muted tiny">“Sin dato”: socios a los que no se les cargó el género o la fecha de nacimiento. Se completa en la ficha de cada socio › Editar datos personales.</p>` : ""}`,
    mount(host) {
      $$("[data-count]", host).forEach((el) => countUp(el, +el.dataset.count));
      $$("[data-cols].scroll", host).forEach((w) => { w.scrollLeft = w.scrollWidth; });
      host.addEventListener("click", (e) => {
        const c = e.target.closest("[data-mi]"); if (!c) return;
        $$("[data-mi]", host).forEach((x) => x.classList.toggle("cur", x === c));
        $("[data-mdet]", host).innerHTML = detail(hist[+c.dataset.mi]);
      });
      host.addEventListener("click", (e) => { const b = e.target.closest("[data-approve]"); if (b) approveSheet(S.user(b.dataset.approve)); });
    },
  };
}

export function approveSheet(m) {
  sheet({
    title: "Aprobar socio nuevo",
    html: `<div class="mrow plain">${avatar(m)}<span><b>${esc(m.name)}</b><small>${esc(realEmail(m.email) || "Sin email")}${m.phone ? " · " + esc(m.phone) : ""}</small></span></div>
      <form novalidate>
        ${field({ label: "Profe a cargo", name: "coach", value: me().role === "profe" ? me().id : "", options: [["", "Sin asignar"], ...S.coaches().map((c) => [c.id, c.name])] })}
        ${field({ label: "Plan", name: "plan", options: [["", "Cargar después"], ...S.plansOf(S.spaceOf(m)).map((p) => [p.id, p.name])] })}
        <div class="row-btns"><button class="btn ghost danger-t" type="button" data-reject>Rechazar</button><button class="btn primary" type="submit">${icon("check", "sm")} Aprobar</button></div>
      </form>`,
    onMount(b, close) {
      $("form", b).addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(e.target);
        S.api.approve(m.id, d.coach, d.plan);
        close(); toast(`${firstName(m.name)} ya puede ingresar`);
        go("/panel/socios/" + m.id);
      });
      $("[data-reject]", b).addEventListener("click", async () => {
        close();
        if (await confirmDialog({ title: `¿Rechazar a ${m.name}?`, text: "Se borra la solicitud.", ok: "Rechazar", danger: true })) { S.api.reject(m.id); toast("Solicitud rechazada"); refresh(); }
      });
    },
  });
}

/* ---------------------------------------------------------------- socios */
const FILTERS = [["", "Todos"], ["mios", "Mis socios"], ["sin", "Sin rutina"], ["app", "No entraron a la app"], ["soon", "Cuota por vencer"], ["late", "Cuota vencida"], ["pend", "Para aprobar"]];

export function membersView(params, query) {
  const f = query.f || "", q = query.q || "";
  const today = dayKey();
  let list = (f === "pend" ? S.pending() : S.activeMembers()).filter((m) => S.inSpace(m));
  if (f === "mios") list = list.filter((m) => m.coachId === me().id);
  if (f === "app") list = list.filter((m) => m.prefs?.tempPass);
  if (f === "sin") list = list.filter((m) => !S.activeRoutine(m.id));
  if (f === "soon" || f === "late") list = list.filter((m) => S.feeStatus(m).state === f);
  if (q) list = list.filter((m) => fold(m.name + " " + m.email + " " + m.phone).includes(fold(q)));
  list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  const pend = S.pending().filter((m) => S.inSpace(m)).length;

  return {
    layout: "panel", nav: "socios", title: "Socios",
    html: `${pageHead({ title: "Socios", actions: `<button class="btn primary sm" type="button" data-act="new">${icon("userplus", "sm")} Nuevo socio</button>` })}
      <div class="filters"><label class="search">${icon("search", "sm")}<input type="search" data-q value="${esc(q)}" placeholder="Buscar por nombre, email o teléfono" aria-label="Buscar socio"></label></div>
      <div class="chips-scroll">${FILTERS.map(([k, l]) => `<a class="chip ${k === f ? "on" : ""}" href="#/panel/socios${k ? "?f=" + k : ""}">${l}${k === "pend" && pend ? ` <b>${pend}</b>` : ""}</a>`).join("")}</div>
      <p class="muted tiny">${plural(list.length, "socio", "socios")}</p>
      <div class="mlist">${list.map((m) => {
        if (m.status === "pendiente") return `<button type="button" class="mrow" data-approve="${m.id}">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>Se registró ${esc(relDay(m.joined))} · espera aprobación</small></span><span class="pill red">Revisar</span></button>`;
        const r = S.activeRoutine(m.id), l = lastLog(m.id), c = S.user(m.coachId);
        return `<a class="mrow" href="#/panel/socios/${m.id}">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${r ? esc(S.routineTitle(r)) : "Sin rutina"}${c ? " · " + esc(firstName(c.name)) : ""}${m.prefs?.tempPass ? " · nunca entró a la app" : ""}</small></span>${feePill(m)}</a>`;
      }).join("") || empty("users", "No hay socios con ese filtro")}</div>`,
    mount(host) {
      limitList($(".mlist", host), { size: 30 });
      const inp = $("[data-q]", host);
      inp.addEventListener("input", debounce(() => { location.hash = `#/panel/socios?${new URLSearchParams({ ...(f ? { f } : {}), ...(inp.value ? { q: inp.value } : {}) })}`; }, 300));
      if (q) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
      host.addEventListener("click", (e) => {
        if (e.target.closest("[data-act=new]")) newMemberSheet();
        const a = e.target.closest("[data-approve]");
        if (a) approveSheet(S.user(a.dataset.approve));
      });
    },
  };
}

function genPass() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ", a = "abcdefghijkmnpqrstuvwxyz", n = "23456789";
  const pick = (s, k) => Array.from(crypto.getRandomValues(new Uint8Array(k)), (b) => s[b % s.length]).join("");
  return pick(A, 1) + pick(a, 5) + pick(n, 3);
}

/* Muestra las credenciales para pasárselas al socio por WhatsApp */
/* Datos de ingreso: con DNI, usuario y contraseña inicial son el DNI.
   La primera vez la app le pide elegir su propia contraseña. */
const isDni = (x) => /^\d{7,9}$/.test(String(x || ""));
function credentialsSheet(m, pass, title = "Socio listo") {
  const dni = isDni(m.user) && pass === m.user;
  sheet({
    title,
    html: `<div class="creds-ok">${icon("checkc")}<p><b>${esc(m.name)}</b> ya puede entrar a la app.</p></div>
      <dl class="kv creds"><div><dt>Usuario</dt><dd>${esc(m.user)}</dd></div><div><dt>Contraseña inicial</dt><dd><code>${esc(pass)}</code>${dni ? " (su DNI)" : ""}</dd></div></dl>
      <ol class="creds-steps"><li>Escanea el QR de recepción e instala la app.</li><li>Entra con ${dni ? "su DNI como usuario y contraseña" : "estos datos"}.</li><li>La app le pide elegir su propia contraseña.</li></ol>
      <div class="row-btns"><button class="btn primary" type="button" data-close>Listo</button></div>`,
  });
}

/* Alta en recepción: el socio pagó, se cargan sus datos y la app le genera
   usuario (su DNI) y una contraseña provisoria para mandarle por WhatsApp. */
function newMemberSheet() {
  const sp = S.currentSpace();
  const p0 = S.plansOf(sp)[0];
  sheet({
    title: "Nuevo socio",
    html: `<form novalidate>
      <div class="grid2">${field({ label: "Nombre", name: "first", req: true, attrs: 'autocomplete="off"' })}${field({ label: "Apellido", name: "last", req: true, attrs: 'autocomplete="off"' })}</div>
      <div class="grid2">${field({ label: "DNI (será su usuario)", name: "dni", req: true, ph: "Sin puntos", attrs: 'inputmode="numeric" autocomplete="off"' })}${field({ label: "Teléfono (WhatsApp)", name: "phone", type: "tel", req: true, ph: "2966 …" })}</div>
      <div class="grid2">${dateField({ label: "Fecha de nacimiento", name: "birth", req: true })}${field({ label: "Género", name: "gender", req: true, options: [["", "Elegir"], "Femenino", "Masculino", "Otro"] })}</div>
      ${field({ label: "Email (opcional)", name: "email", type: "email", ph: "Para recuperar la contraseña" })}
      ${field({ label: "Profe a cargo", name: "coach", value: me().role === "profe" ? me().id : "", options: [["", "Sin asignar"], ...S.coaches().map((c) => [c.id, c.name])] })}
      <fieldset class="paybox"><legend>Cuota</legend>
        <div class="grid2">${field({ label: "Plan", name: "plan", value: p0?.id, options: S.plansOf(sp).map((p) => [p.id, p.name]) })}${sp === "vientos" ? convField() || `<span></span>` : `<span></span>`}</div>
        ${field({ label: "Monto cobrado", name: "amount", type: "number", value: p0?.price || "", attrs: 'inputmode="numeric" min="0"' })}
        <div class="paypreview" data-preview></div>
        <label class="check"><input type="checkbox" name="paid" checked><span>Ya pagó: registrar el pago y la cuota vence en un mes. Si todavía no pagó, destildalo: queda debiendo la cuota hasta que registres el pago.</span></label>
      </fieldset>
      <p class="muted tiny">Va a entrar con su DNI como usuario y contraseña. La primera vez, la app le pide elegir su propia contraseña.</p>
      <p class="form-err" role="alert" hidden></p>
      <button class="btn primary block" type="submit">${icon("userplus", "sm")} Crear socio</button></form>`,
    onMount(b, close) {
      const f = $("form", b), err = $(".form-err", b), pv = $("[data-preview]", b);
      const sync = () => { const pr = S.priceWith(f.plan.value, 1, f.conv?.value); f.amount.value = pr.total || ""; pv.innerHTML = priceLines(pr, +f.amount.value); };
      f.plan.addEventListener("change", sync); f.conv?.addEventListener("change", sync);
      f.amount.addEventListener("input", () => { pv.innerHTML = priceLines(S.priceWith(f.plan.value, 1, f.conv?.value), +f.amount.value); });
      sync();
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = formData(f);
        const fail = (m) => { err.textContent = m; err.hidden = false; };
        err.hidden = true;
        const dni = d.dni.replace(/\D/g, "");
        if (!d.first.trim() || !d.last.trim()) return fail("Completá nombre y apellido.");
        if (dni.length < 7 || dni.length > 9) return fail("Revisá el DNI (solo números).");
        if (d.phone.replace(/\D/g, "").length < 8) return fail("Revisá el teléfono.");
        const age = d.birth ? (Date.now() - new Date(d.birth + "T12:00").getTime()) / (365.25 * DAY) : null;
        if (age === null) return fail("Completá la fecha de nacimiento.");
        if (age < 8 || age > 100) return fail("Revisá la fecha de nacimiento.");
        if (!d.gender) return fail("Elegí el género.");
        if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) return fail("Revisá el email.");
        const pass = dni;
        const btn = $("button[type=submit]", f);
        btn.disabled = true;
        try {
          const m = await S.api.createMember({ name: `${d.first.trim()} ${d.last.trim()}`, dni, email: d.email.trim(), phone: d.phone, birth: d.birth, gender: d.gender, pass, coachId: d.coach, planId: d.paid ? null : d.plan, convenioId: d.conv || null, space: sp });
          if (d.paid) S.api.registerPayment(m.id, { planId: d.plan, months: 1, amount: +d.amount || 0, by: me().id, convenioId: d.conv || null });
          close(); go("/panel/socios/" + m.id);
          setTimeout(() => credentialsSheet(S.user(m.id) || m, pass), 300);
        } catch (e2) { fail(e2.message); btn.disabled = false; }
      });
    },
  });
}

/* Asignar rutina: desde plantilla o personalizada desde cero */
export function assignSheet({ userId = null, templateId = null } = {}) {
  let step = userId ? "tpl" : "user";
  let chosenUser = userId, chosenT = templateId;
  const draw = (b) => {
    if (step === "user") {
      const t = S.template(chosenT);
      b.innerHTML = `<p class="muted">Plantilla: <b>${esc(t?.name)}</b>. Elegí el socio.</p>
        <label class="search">${icon("search", "sm")}<input type="search" data-uq placeholder="Buscar socio" aria-label="Buscar socio"></label>
        <div class="pick-list" data-ul></div>`;
      const ul = $("[data-ul]", b);
      const fill = (q = "") => { const all = S.spaceMembers(S.tplSpace(t)).filter((m) => !q || fold(m.name).includes(fold(q))).sort((a, c) => a.name.localeCompare(c.name, "es")); ul.innerHTML = all.slice(0, 12).map((m) => { const r = S.activeRoutine(m.id); return `<button type="button" class="mrow" data-u="${m.id}">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${r ? "Tiene: " + esc(S.routineTitle(r)) : "Sin rutina"}</small></span>${icon("right", "sm")}</button>`; }).join("") + (all.length > 12 ? `<p class="muted tiny center">Mostrando 12 de ${all.length}. Escribí el nombre para encontrar al resto.</p>` : ""); };
      fill();
      $("[data-uq]", b).addEventListener("input", (e) => fill(e.target.value));
      return;
    }
    const m = S.user(chosenUser);
    const cur = S.activeRoutine(m.id);
    const n = (S.routinesOf(m.id)[0]?.number || 0) + 1;
    const msp = S.spaceOf(m), fitzM = msp === "fitz";
    const opts = S.db.templates.filter((t) => S.tplSpace(t) === msp).sort((a, c) => a.order - c.order);
    const monday = S.programStart({ startAt: Date.now() });
    /* En Fitz Club se parte de un programa armado: viene marcado el primero y "Desde cero" va al final */
    if (fitzM && !chosenT && opts.length) chosenT = opts[0].id;
    const blankOpt = `<label class="radio"><input type="radio" name="from" value="__blank" ${chosenT ? "" : "checked"}><span><b>Desde cero</b><small>${fitzM ? "Programa de 6 semanas vacío: días 1, 2 y 3 con sus bloques, para armarlo ejercicio por ejercicio." : "Armás la rutina ejercicio por ejercicio."}</small></span></label>`;
    b.innerHTML = `<div class="mrow plain">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${cur ? "Rutina actual: " + esc(S.routineTitle(cur)) + " (pasa al historial)" : "Todavía sin rutina"}</small></span></div>
      <form novalidate>
        <fieldset class="radios"><legend>Punto de partida</legend>
          ${fitzM ? "" : blankOpt}
          ${opts.map((t) => `<label class="radio"><input type="radio" name="from" value="${t.id}" ${t.id === chosenT ? "checked" : ""}><span><b>${esc(t.name)}</b><small>${S.isProgram(t) ? `Programa de ${t.weeks || 6} semanas · ${plural(t.days.length, "día", "días")} por semana` : `${esc(t.level)} · ${plural(t.days.length, "día", "días")} · ${esc(t.goal)}`}</small></span></label>`).join("")}
          ${fitzM ? blankOpt : ""}
        </fieldset>
        ${fitzM ? `<div class="grid2">${dateField({ label: "Inicio del programa (lunes)", name: "start", value: dayKey(monday), req: true })}${field({ label: "Deporte", name: "deporte", ph: "Ej: pádel, fútbol" })}</div>
          ${field({ label: "Etapa", name: "etapa", ph: "Ej: base, pretemporada" })}` : ""}
        <label class="toggle"><span><b>Rutina personalizada</b><small>Se llama “${esc(m.name)} · Rutina ${n}”.</small></span><input type="checkbox" name="personal" role="switch" ${chosenT ? "" : "checked"}><i aria-hidden="true"></i></label>
        ${field({ label: "Nota para el socio (opcional)", name: "note", type: "textarea", ph: "Objetivo, indicaciones generales…" })}
        <button class="btn primary block" type="submit">Asignar y editar</button>
      </form>`;
    /* Desde cero = personalizada; con plantilla queda a elección del profe */
    $("form", b).addEventListener("change", (e) => {
      if (e.target.name === "from") $("[name=personal]", b).checked = e.target.value === "__blank";
    });
    $("form", b).addEventListener("submit", (e) => {
      e.preventDefault();
      const d = formData(e.target);
      const blank = d.from === "__blank";
      const st = d.start ? (() => { const [y, mo, da] = d.start.split("-").map(Number); return new Date(y, mo - 1, da, 12).getTime(); })() : null;
      const r = S.api.assign(m.id, { templateId: blank ? null : d.from, coachId: me().id, personal: !!d.personal || blank, name: blank ? (fitzM ? "Programa personalizado" : "Rutina personalizada") : "", note: d.note,
        program: fitzM && blank, startAt: st, meta: fitzM ? { deporte: (d.deporte || "").trim(), etapa: (d.etapa || "").trim() } : null });
      b.closest(".sheet-wrap").querySelector("[data-close]").click();
      toast(`Rutina ${r.number} asignada a ${firstName(m.name)}`);
      go("/panel/rutina/" + r.id);
    });
  };
  sheet({
    title: "Asignar rutina", wide: true, html: "",
    onMount(b) {
      draw(b);
      b.addEventListener("click", (e) => { const u = e.target.closest("[data-u]"); if (u) { chosenUser = u.dataset.u; step = "tpl"; draw(b); } });
    },
  });
}

export async function memberView(params) {
  const m = S.user(params.id);
  if (!m || m.role !== "socio" || !S.inSpace(m)) return go("/panel/socios", { replace: true });
  try { await S.remote()?.loadUserLogs(m.id); } catch { /* sin conexión: se muestra lo que haya */ }
  if (m.status === "pendiente") { setTimeout(() => approveSheet(m), 50); return go("/panel/socios?f=pend", { replace: true }); }
  const r = S.activeRoutine(m.id);
  const all = S.routinesOf(m.id);
  const logs = S.logsOf(m.id);
  const p = S.plan(m.fee?.planId);
  const allPays = paysOf(m.id), pays = allPays.slice(0, 3);
  const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);

  return {
    layout: "panel", nav: "socios", title: m.name,
    html: `${pageHead({ back: "#/panel/socios", kicker: "Socio", title: m.name })}
      <section class="mhead">${avatar(m, "xl")}
        <div><p class="muted">Usuario: <b>${esc(m.user)}</b>${realEmail(m.email) ? " · " + esc(realEmail(m.email)) : ""}${m.phone ? " · " + esc(m.phone) : ""}</p>
          <p class="muted tiny">Socio desde ${fmtDate(m.joined, { year: true })}${m.birth ? ` · ${new Date().getFullYear() - +m.birth.slice(0, 4)} años` : ""}${m.gender ? " · " + esc(m.gender) : ""}</p>
          <div class="mhead-a">${m.phone ? `<a class="btn ghost sm" href="https://wa.me/${waNumber(m.phone)}" target="_blank" rel="noopener">${icon("whatsapp", "sm")} WhatsApp</a>` : ""}</div>
        </div>
      </section>
      <div class="pgrid">
        <section class="card"><div class="card-h"><h2>${icon("dumbbell", "sm")} Rutina activa</h2></div>
          ${r ? `<a class="rcard" href="#/panel/rutina/${r.id}"><b>${esc(S.routineTitle(r))}</b><small>${r.personal ? esc(r.name) + " · " : ""}${esc(r.level)} · ${plural(r.days.length, "día", "días")} · desde ${fmtDate(r.startedAt)}</small>
              <span class="rcard-days">${r.days.map((d) => `<i>${esc(d.name)}: ${esc(d.focus)}</i>`).join("")}</span><span class="rcard-cta">${icon("edit", "xs")} Editar rutina</span></a>`
            : `<p class="muted">Todavía no tiene rutina.</p>`}
          <button class="btn primary block" type="button" data-act="assign">${icon("plus", "sm")} ${r ? "Nueva rutina" : "Asignar rutina"}</button>
          ${r ? `<button class="btn ghost sm block danger-t" type="button" data-act="del-routine">${icon("trash", "sm")} Borrar esta rutina</button>` : ""}
          ${all.filter((x) => !x.active).length ? `<h3 class="sub">Historial</h3>${all.filter((x) => !x.active).map((x) => `<a class="hrow" href="#/panel/rutina/${x.id}"><span><b>${esc(S.routineTitle(x))}</b><small>${fmtDate(x.startedAt)} al ${fmtDate(x.endedAt || Date.now())}</small></span>${icon("right", "sm")}</a>`).join("")}` : ""}
        </section>
        <section class="card"><div class="card-h"><h2>${icon("trend", "sm")} Constancia</h2><span class="muted">últimos 3 meses</span></div>
          ${heatmap(m.id, 13)}
          <div class="permonth">${[2, 1, 0].map((k) => { const a = new Date(m0.getFullYear(), m0.getMonth() - k, 1), b = new Date(a.getFullYear(), a.getMonth() + 1, 1); const n = logs.filter((l) => l.at >= a.getTime() && l.at < b.getTime()).length; return `<div class="${k ? "" : "now"}"><b>${n}</b><small>${a.toLocaleDateString("es-AR", { month: "long" })}</small></div>`; }).join("")}</div>
          ${logs.slice(0, 5).map((l) => `<div class="hrow"><span><b>${esc(l.dayName)} · ${esc(l.focus)}</b><small>${esc(relDay(l.at))} · ${l.min} min${l.sets.length ? ` · ${l.sets.length} series` : ""}</small></span></div>`).join("") || `<p class="muted">Sin entrenamientos registrados.</p>`}
        </section>
        <section class="card"><div class="card-h"><h2>${icon("card", "sm")} Cuota</h2>${feePill(m)}</div>
          ${m.fee?.dueAt ? `<dl class="kv"><div><dt>Plan</dt><dd>${esc(p?.name || "—")}</dd></div><div><dt>${m.fee.unpaid ? "Debe desde" : "Vence"}</dt><dd>${fmtDate(m.fee.dueAt, { year: true })}</dd></div></dl>` : `<p class="muted">Sin cuota cargada.</p>`}
          ${S.convenios().length ? `<label class="field"><span>Convenio</span><select data-conv>${convOptions(m.fee?.convenioId).map(([v, l]) => `<option value="${esc(v)}" ${v === (m.fee?.convenioId || "") ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>` : ""}
          <div class="row-btns"><button class="btn primary sm" type="button" data-act="pay">${icon("check", "sm")} Registrar pago</button><button class="btn ghost sm" type="button" data-act="due">Cambiar vencimiento</button></div>
          ${pays.length ? `<h3 class="sub">Últimos pagos</h3>${pays.map(payRow).join("")}
            ${allPays.length > pays.length ? `<button class="btn ghost sm block" type="button" data-act="pays">${icon("list", "sm")} Ver todos los pagos (${allPays.length})</button>` : ""}` : ""}
        </section>
        <section class="card"><div class="card-h"><h2>${icon("settings", "sm")} Cuenta</h2></div>
          ${field({ label: "Profe a cargo", name: "coach", value: m.coachId || "", options: [["", "Sin asignar"], ...S.coaches().map((c) => [c.id, c.name])], attrs: "data-coach" })}
          <button class="lrow" type="button" data-act="data">${icon("user", "sm")}<span>Editar datos personales${!m.gender || !m.birth ? ` <em class="pill warn">Faltan datos</em>` : ""}</span>${icon("right", "sm")}</button>
          <button class="lrow" type="button" data-act="reset">${icon("lock", "sm")}<span>${isDni(m.user) ? "Olvidó la contraseña: volver a su DNI" : "Generar contraseña nueva"}</span>${icon("right", "sm")}</button>
          <button class="lrow danger" type="button" data-act="drop">${icon("trash", "sm")}<span>Dar de baja de la app</span>${icon("right", "sm")}</button>
        </section>
      </div>`,
    mount(host) {
      $("[data-coach]", host).addEventListener("change", (e) => { S.api.updateUser(m.id, { coachId: e.target.value || null }); toast("Profe actualizado"); });
      $("[data-conv]", host)?.addEventListener("change", (e) => { S.api.setConvenio(m.id, e.target.value || null); toast(e.target.value ? "Convenio asignado: se aplica en el próximo pago" : "Convenio quitado"); });
      host.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-act]")?.dataset.act;
        if (a === "assign") assignSheet({ userId: m.id });
        if (a === "del-routine") deleteRoutine(r);
        if (a === "pay") paySheet(m);
        const pr = e.target.closest("[data-payid]");
        if (pr) payDetailSheet(S.db.payments.find((x) => x.id === pr.dataset.payid));
        if (a === "pays") paysSheet(m);
        if (a === "due") dueSheet(m);
        if (a === "data") dataSheet(m);
        if (a === "reset" && await confirmDialog({ title: isDni(m.user) ? "¿Volver a la contraseña inicial?" : "¿Generar una contraseña nueva?", text: isDni(m.user) ? `Va a poder entrar con su DNI (${m.user}) y la app le pide elegir una nueva.` : "La anterior deja de funcionar.", ok: "Confirmar" })) {
          const pass = isDni(m.user) ? m.user : genPass();
          await S.api.resetPassword(m.id, pass);
          S.api.updateUser(m.id, { prefs: { ...m.prefs, tempPass: true } });
          credentialsSheet(m, pass, "Contraseña nueva");
        }
        if (a === "drop" && await confirmDialog({ title: `¿Dar de baja a ${m.name}?`, text: "No va a poder ingresar más. Su historial queda guardado.", ok: "Dar de baja", danger: true })) {
          S.api.updateUser(m.id, { status: "baja" }); toast("Socio dado de baja"); go("/panel/socios");
        }
      });
    },
  };
}

/* Registrar pago: muestra antes qué período cubre y la nueva fecha de vencimiento */
export function paySheet(m, onDone) {
  const mplans = S.plansOf(S.spaceOf(m));
  const cur = m.fee?.planId || mplans[0]?.id;
  const st = S.feeStatus(m);
  const day0 = new Date(); day0.setHours(12, 0, 0, 0);
  const canChain = m.fee?.dueAt && st.state !== "late" && st.state !== "none";
  const plusMonths = (t, n) => addMonths(t, n);
  sheet({
    title: `Registrar pago`,
    html: `<form novalidate>
      <div class="mrow plain">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${m.fee ? `Cuota actual: ${esc(st.label)}${m.fee.dueAt ? ` · vence ${fmtDate(m.fee.dueAt)}` : ""}` : "Sin cuota cargada"}</small></span></div>
      ${field({ label: "Plan", name: "plan", value: cur, options: mplans.map((p) => [p.id, `${p.name} · ${money(p.price)}`]) })}
      ${convField(m.fee?.convenioId)}
      <div class="grid2">${field({ label: "Meses que paga", name: "months", value: 1, options: [1, 2, 3, 6, 12].map((n) => [n, plural(n, "mes", "meses")]) })}${field({ label: "Monto cobrado", name: "amount", type: "number", value: S.priceWith(cur, 1, m.fee?.convenioId).total || "", attrs: 'inputmode="numeric" min="0"' })}</div>
      ${canChain ? `<fieldset class="radios"><legend>Desde cuándo cuenta</legend>
        <label class="radio"><input type="radio" name="from" value="due" checked><span><b>Desde que vence la actual (${fmtDate(m.fee.dueAt)})</b><small>Pagó por adelantado: se suma al final.</small></span></label>
        <label class="radio"><input type="radio" name="from" value="today"><span><b>Desde hoy</b><small>Arranca hoy, sin sumarse a lo que ya tenía.</small></span></label>
      </fieldset>` : `<input type="hidden" name="from" value="today">`}
      <div class="paypreview" data-preview></div>
      <button class="btn primary block lg" type="submit">${icon("check", "sm")} Confirmar pago</button></form>`,
    onMount(b, close) {
      const f = $("form", b), pv = $("[data-preview]", b);
      const calc = () => {
        const d = formData(f);
        const from = d.from === "due" && canChain ? m.fee.dueAt : day0.getTime();
        return { d, from, to: plusMonths(from, +d.months) };
      };
      const draw = () => { const { d, from, to } = calc(); pv.innerHTML = `${priceLines(S.priceWith(d.plan, +d.months, d.conv), +d.amount || 0)}<span>Cubre del <b>${fmtDate(from)}</b> al <b>${fmtDate(to, { year: true })}</b></span><span>Nuevo vencimiento: <b>${fmtDate(to, { year: true })}</b></span>`; };
      const sync = () => { const d = formData(f); f.amount.value = S.priceWith(d.plan, +d.months, d.conv).total; draw(); };
      f.plan.addEventListener("change", sync); f.months.addEventListener("change", sync); f.conv?.addEventListener("change", sync);
      f.addEventListener("input", draw); f.addEventListener("change", draw);
      draw();
      let sent = false;
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        if (sent) return;                         /* evita registrar dos veces con un doble toque */
        sent = true; $("button[type=submit]", f).disabled = true;
        const { d, from } = calc();
        S.api.registerPayment(m.id, { planId: d.plan, months: +d.months, amount: +d.amount || 0, by: me().id, from, convenioId: d.conv || null });
        close(); toast(`Pago registrado. Vence el ${fmtDate(S.user(m.id).fee.dueAt)}`);
        onDone ? onDone() : refresh();
      });
    },
  });
}

/* ------------------------------------------------------------------ pagos */
const paysOf = (userId) => S.db.payments.filter((x) => x.userId === userId).sort((a, b) => b.at - a.at);
const monthKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const monthName = (k) => { const [y, mo] = k.split("-").map(Number); const s = new Date(y, mo - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); return s[0].toUpperCase() + s.slice(1); };

function payRow(x) {
  return `<button class="hrow payrow" type="button" data-payid="${esc(x.id)}">
    <span><b>${money(x.amount)} · ${plural(x.months || 1, "mes", "meses")}</b>
      <small>Cobrado el ${fmtDate(x.at, { year: true })}${x.from ? ` · cubre ${fmtDate(x.from)} al ${fmtDate(x.to, { year: true })}` : ""}${x.discount ? ` · ${esc(x.discount.name)}` : ""}${x.edited ? " · editado" : ""}</small></span>
    ${icon("right", "sm")}</button>`;
}

/* Todos los pagos de un socio, con filtro por mes y total */
function paysSheet(m) {
  const all = paysOf(m.id);
  const months = [...new Set(all.map((x) => monthKey(x.at)))];
  sheet({
    title: `Pagos de ${firstName(m.name)}`,
    html: `<label class="field"><span>Mes de cobro</span><select data-month><option value="">Todos (${all.length})</option>${months.map((k) => `<option value="${k}">${esc(monthName(k))}</option>`).join("")}</select></label>
      <div class="paysum" data-sum></div>
      <div data-list></div>`,
    onMount(b, close) {
      const sel = $("[data-month]", b);
      const draw = () => {
        const list = all.filter((x) => !sel.value || monthKey(x.at) === sel.value);
        $("[data-sum]", b).innerHTML = `<span>${plural(list.length, "pago", "pagos")}</span><b>${money(list.reduce((a, x) => a + (x.amount || 0), 0))}</b>`;
        $("[data-list]", b).innerHTML = list.map(payRow).join("") || `<p class="muted">No hay pagos en ese mes.</p>`;
      };
      sel.addEventListener("change", draw); draw();
      b.addEventListener("click", (e) => { const r = e.target.closest("[data-payid]"); if (r) { close(); setTimeout(() => payDetailSheet(all.find((x) => x.id === r.dataset.payid)), 250); } });
    },
  });
}

/* Detalle de un pago: el dueño lo puede editar o anular */
function payDetailSheet(x) {
  if (!x) return;
  const m = S.user(x.userId), by = S.user(x.by), ed = x.edited && S.user(x.edited.by);
  const latest = paysOf(x.userId)[0]?.id === x.id;
  const kv = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : "");
  sheet({
    title: "Pago",
    html: `<div class="paybig"><b>${money(x.amount)}</b><span>${esc(m?.name || "")}</span></div>
      <dl class="kv">
        ${kv("Plan", esc(S.plan(x.planId)?.name || "—"))}
        ${kv("Meses", plural(x.months || 1, "mes", "meses"))}
        ${kv("Cubre", x.from ? `${fmtDate(x.from)} al ${fmtDate(x.to, { year: true })}` : "")}
        ${kv("Precio de lista", x.list ? money(x.list) : "")}
        ${kv("Convenio", x.discount ? `${esc(x.discount.name)} · −${money(x.discount.amount)}` : "")}
        ${kv("Cobrado el", fmtDate(x.at, { year: true }))}
        ${kv("Cobró", by ? esc(by.name) : "")}
        ${kv("Nota", x.note ? esc(x.note) : "")}
        ${kv("Editado", x.edited ? `${fmtDate(x.edited.at, { year: true })}${ed ? " por " + esc(ed.name) : ""}` : "")}
      </dl>
      ${isAdmin() ? `<div class="row-btns"><button class="btn ghost" type="button" data-edit>${icon("edit", "sm")} Editar</button><button class="btn ghost danger-t" type="button" data-del>${icon("trash", "sm")} Anular</button></div>`
        : `<p class="muted tiny">Solo el dueño puede editar o anular un pago.</p>`}`,
    onMount(b, close) {
      $("[data-edit]", b)?.addEventListener("click", () => { close(); setTimeout(() => payEditSheet(x), 250); });
      $("[data-del]", b)?.addEventListener("click", async () => {
        close();
        const due = m?.fee?.dueAt;
        const ok = await confirmDialog({
          title: `¿Anular el pago de ${money(x.amount)}?`,
          text: latest ? "Se borra el pago y la cuota vuelve a como estaba antes de registrarlo." : `Se borra el pago del historial. La cuota no cambia${due ? ` (sigue venciendo el ${fmtDate(due)})` : ""}: si hace falta, cambiá el vencimiento desde la ficha.`,
          ok: "Anular pago", danger: true,
        });
        if (!ok) return;
        S.api.deletePayment(x.id); toast("Pago anulado"); refresh();
      });
    },
  });
}

function payEditSheet(x) {
  sheet({
    title: "Editar pago",
    html: `<form novalidate>
      ${field({ label: "Monto cobrado", name: "amount", type: "number", value: x.amount || 0, req: true, attrs: 'inputmode="numeric" min="0"' })}
      ${dateField({ label: "Fecha de cobro", name: "at", value: dayKey(x.at), req: true })}
      ${field({ label: "Nota (opcional)", name: "note", value: x.note || "", ph: "Ej: pagó con transferencia, se corrigió el monto" })}
      <p class="muted tiny">Para cambiar el período que cubre, usá "Cambiar vencimiento" en la ficha del socio.</p>
      <p class="form-err" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Guardar cambios</button></form>`,
    onMount(b, close) {
      $("form", b).addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(e.target), err = $(".form-err", b);
        const amount = +d.amount;
        if (!(amount >= 0) || d.amount === "") { err.textContent = "Revisá el monto."; err.hidden = false; return; }
        if (!d.at) { err.textContent = "Elegí la fecha de cobro."; err.hidden = false; return; }
        const [y, mo, da] = d.at.split("-").map(Number);
        const old = new Date(x.at);
        const at = new Date(y, mo - 1, da, old.getHours(), old.getMinutes()).getTime();
        S.api.updatePayment(x.id, { amount, at, note: d.note.trim() }, me().id);
        close(); toast("Pago actualizado"); refresh();
      });
    },
  });
}

/* Datos personales del socio (nombre, teléfono, nacimiento, género) */
function dataSheet(m) {
  sheet({
    title: "Datos personales",
    html: `<form novalidate>
      ${field({ label: "Nombre y apellido", name: "name", value: m.name, req: true })}
      ${field({ label: "Teléfono (WhatsApp)", name: "phone", type: "tel", value: m.phone || "" })}
      <div class="grid2">${dateField({ label: "Fecha de nacimiento", name: "birth", value: m.birth || "" })}${field({ label: "Género", name: "gender", value: m.gender || "", options: [["", "Elegir"], "Femenino", "Masculino", "Otro"] })}</div>
      <p class="muted tiny">El género y la edad se usan solo para las estadísticas del resumen.</p>
      <p class="form-err" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Guardar</button></form>`,
    onMount(b, close) {
      $("form", b).addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(e.target), err = $(".form-err", b);
        if (!d.name.trim()) { err.textContent = "Escribí el nombre."; err.hidden = false; return; }
        S.api.updateUser(m.id, { name: d.name.trim(), phone: d.phone.trim(), birth: d.birth, gender: d.gender });
        close(); toast("Datos guardados"); refresh();
      });
    },
  });
}

function dueSheet(m) {
  const v = m.fee?.dueAt ? dayKey(m.fee.dueAt) : dayKey(Date.now() + 30 * DAY);
  sheet({
    title: "Cambiar vencimiento",
    html: `<form novalidate>${dateField({ label: "Vence el", name: "due", value: v, req: true })}${field({ label: "Plan", name: "plan", value: m.fee?.planId, options: S.plansOf(S.spaceOf(m)).map((p) => [p.id, p.name]) })}
      <label class="check"><input type="checkbox" name="unpaid" ${m.fee?.unpaid ? "checked" : ""}><span>Todavía no pagó: queda debiendo la cuota hasta que registres el pago</span></label>
      <button class="btn primary block" type="submit">Guardar</button></form>`,
    onMount(b, close) {
      $("form", b).addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(e.target);
        const [y, mo, da] = d.due.split("-").map(Number);
        S.api.setDue(m.id, new Date(y, mo - 1, da, 12).getTime(), d.plan, !!d.unpaid);
        close(); toast("Vencimiento actualizado"); refresh();
      });
    },
  });
}

/* Vista del socio (para que el profe vea la rutina como la ve el socio) */
export function previewView(params) {
  const v = routineView({ rid: params.id });
  if (!v) return v;
  const r = S.routine(params.id);
  return { ...v, layout: "panel", nav: "socios", html: `${pageHead({ back: `#/panel/rutina/${params.id}`, kicker: "Vista del socio", title: S.user(r.userId)?.name || "" })}<div class="preview-frame">${v.html}</div>` };
}

/* ---------------------------------------------------------------- cuotas */
export function feesView(params, query) {
  const f = query.f || "";
  const act = S.spaceMembers();
  const by = { ok: [], soon: [], late: [], none: [] };
  act.forEach((m) => by[S.feeStatus(m).state].push(m));
  const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
  const m1c = new Date(m0.getFullYear(), m0.getMonth() + 1, 1).getTime();
  const cobrado = S.paymentsOf().filter((p) => p.at >= m0.getTime() && p.at < m1c).reduce((a, p) => a + (p.amount || 0), 0);
  let list = f ? by[f] || [] : act;
  list = list.slice().sort((a, b) => (a.fee?.dueAt || 0) - (b.fee?.dueAt || 0));
  const chips = [["", "Todos", act.length], ["late", "Vencidas", by.late.length], ["soon", "Por vencer", by.soon.length], ["ok", "Al día", by.ok.length], ["none", "Sin cuota", by.none.length]];
  return {
    layout: "panel", nav: "cuotas", title: "Cuotas",
    html: `${pageHead({ title: "Cuotas", actions: isAdmin() ? `<a class="btn ghost sm" href="#/panel/recaudacion">${icon("trend", "sm")} Recaudación</a>${S.currentSpace() === "vientos" ? `<button class="btn ghost sm" type="button" data-act="convs">${icon("card", "sm")} Convenios</button>` : ""}<button class="btn ghost sm" type="button" data-act="plans">${icon("settings", "sm")} Planes y precios</button>` : "" })}
      <section class="kpis">
        <div class="kpi"><b>${by.ok.length}</b><small>al día</small></div>
        <div class="kpi warn"><b>${by.soon.length}</b><small>vencen en ${S.gymOf().reminderDays} días</small></div>
        <div class="kpi bad"><b>${by.late.length}</b><small>vencidas</small></div>
        ${isAdmin() ? `<a class="kpi" href="#/panel/recaudacion"><b>${money(cobrado)}</b><small>cobrado este mes</small><span class="cta">Ver historial ${icon("right", "xs")}</span></a>` : `<div class="kpi"><b>${money(cobrado)}</b><small>cobrado este mes</small></div>`}
      </section>
      <p class="muted lead">El socio ve en la app cuándo vence su cuota y recibe el aviso ${S.gymOf().reminderDays} días antes.</p>
      <div class="chips-scroll">${chips.map(([k, l, n]) => `<a class="chip ${k === f ? "on" : ""}" href="#/panel/cuotas${k ? "?f=" + k : ""}">${l} <b>${n}</b></a>`).join("")}</div>
      <div class="mlist">${list.map((m) => {
        const st = S.feeStatus(m);
        const msg = st.state === "late" ? `Hola ${firstName(m.name)}! Te escribimos de Grupo Amplifia: tu cuota venció el ${fmtDate(m.fee.dueAt)}. ¿Pasás a regularizarla? 💪` : `Hola ${firstName(m.name)}! Te recordamos que tu cuota de Grupo Amplifia vence el ${m.fee ? fmtDate(m.fee.dueAt) : ""}.`;
        return `<div class="mrow"><a class="mrow-link" href="#/panel/socios/${m.id}" aria-label="Ver la ficha de ${esc(m.name)}">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${esc(S.plan(m.fee?.planId)?.name || "Sin plan")}${S.convenio(m.fee?.convenioId) ? " · " + esc(S.convenio(m.fee.convenioId).name) : ""}${m.fee?.dueAt ? " · vence " + fmtDate(m.fee.dueAt) : ""}</small></span></a>
          ${feePill(m)}
          ${(st.state === "late" || st.state === "soon") && m.phone ? `<a class="icon-btn" href="https://wa.me/${waNumber(m.phone)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" aria-label="Recordar por WhatsApp a ${esc(m.name)}">${icon("whatsapp", "sm")}</a>` : ""}
          <button class="btn ghost sm" type="button" data-pay="${m.id}">Cobrar</button></div>`;
      }).join("") || empty("card", "No hay socios en esta lista")}</div>`,
    mount(host) {
      limitList($(".mlist", host), { size: 30 });
      host.addEventListener("click", (e) => {
        const p = e.target.closest("[data-pay]");
        if (p) paySheet(S.user(p.dataset.pay));
        if (e.target.closest("[data-act=plans]")) plansSheet();
        if (e.target.closest("[data-act=convs]")) go("/panel/convenios");
      });
    },
  };
}

function plansSheet() {
  const sp = S.currentSpace();
  const row = (p) => `<div class="planrow" data-id="${esc(p.id)}">
      <label class="field"><span>Nombre del plan</span><input type="text" name="pn" value="${esc(p.name)}" placeholder="Ej: Musculación · pase libre"></label>
      <label class="field"><span>Precio por mes</span><span class="affix"><i>$</i><input type="number" name="pp" value="${p.price || ""}" min="0" step="100" inputmode="numeric" placeholder="0"></span></label>
      <button type="button" class="icon-btn sm" data-del aria-label="Quitar plan">${icon("trash", "sm")}</button></div>`;
  sheet({
    title: "Planes y precios",
    html: `<form novalidate><p class="muted tiny">Lo que paga un socio por mes en cada plan${sp === "vientos" ? ". Los convenios se descuentan sobre este precio" : ` de ${esc(S.spaceInfo(sp).name)}`}.</p><div data-rows>${S.plansOf(sp).map(row).join("")}</div>
      <button type="button" class="btn ghost sm" data-add>${icon("plus", "sm")} Agregar plan</button>
      ${field({ label: "Avisar al socio antes del vencimiento", name: "rd", value: S.gymOf(sp).reminderDays, options: [3, 5, 7, 10].map((n) => [n, plural(n, "día", "días")]) })}
      <button class="btn primary block" type="submit">Guardar</button></form>`,
    onMount(b, close) {
      const rows = $("[data-rows]", b);
      b.addEventListener("click", (e) => {
        if (e.target.closest("[data-add]")) { rows.insertAdjacentHTML("beforeend", row({ id: "p-" + Date.now().toString(36), name: "", price: 0 })); rows.lastElementChild.querySelector("[name=pn]").focus(); }
        const d = e.target.closest("[data-del]");
        if (d) d.closest(".planrow").remove();
      });
      $("form", b).addEventListener("submit", (e) => {
        e.preventDefault();
        const plans = $$(".planrow", b).map((r) => ({ id: r.dataset.id, name: r.querySelector("[name=pn]").value.trim(), price: +r.querySelector("[name=pp]").value || 0, ...(sp !== "vientos" ? { space: sp } : {}) })).filter((p) => p.name);
        if (!plans.length) return toast("Tiene que haber al menos un plan.", "err");
        /* se guardan los de este espacio y se conservan los del otro */
        S.api.savePlans([...S.db.plans.filter((p) => S.planSpace(p) !== sp), ...plans]);
        S.api.saveGym({ reminderDays: +formData(e.target).rd }, sp);
        close(); toast("Planes guardados"); refresh();
      });
    },
  });
}

/* --------------------------------------------------------- recaudación
   Historial de todo lo cobrado, mes por mes. Cada pago queda guardado con su
   fecha: el 1° de cada mes arranca una recaudación nueva y la anterior queda
   guardada en su mes (se puede ver, comparar y descargar). */
const mkey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const mlabel = (k, short = false) => { const [y, mo] = k.split("-").map(Number); const t = new Date(y, mo - 1, 1).toLocaleDateString("es-AR", short ? { month: "short" } : { month: "long", year: "numeric" }); return short ? t.replace(".", "") : t[0].toUpperCase() + t.slice(1); };
const sum = (l) => l.reduce((a, x) => a + (x.amount || 0), 0);

export function recaudacionView(params, query) {
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const now = mkey(Date.now());
  const all = S.paymentsOf().slice().sort((a, b) => b.at - a.at);
  const first = all.length ? mkey(all[all.length - 1].at) : now;
  /* de el primer mes con pagos hasta este mes, sin huecos */
  const months = [];
  for (let [y, m] = first.split("-").map(Number); `${y}-${String(m).padStart(2, "0")}` <= now; m === 12 ? (y++, m = 1) : m++) months.push(`${y}-${String(m).padStart(2, "0")}`);
  const sel = months.includes(query.m) ? query.m : now;
  const i = months.indexOf(sel), prev = months[i - 1], next = months[i + 1];
  const by = (k) => all.filter((p) => mkey(p.at) === k);
  const list = by(sel), total = sum(list);
  /* en el mes en curso se compara contra el mismo período (primeros N días) del mes anterior; en meses cerrados, mes completo */
  const msStart = (k) => { const [y, mo] = k.split("-").map(Number); return new Date(y, mo - 1, 1).getTime(); };
  const partial = sel === now ? Date.now() - msStart(sel) : null;
  const prevTotal = prev ? sum(by(prev).filter((p) => partial === null || p.at < msStart(prev) + partial)) : null;
  const diff = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const disc = list.reduce((a, p) => a + (p.discount?.amount || 0), 0);
  const group = (fn) => { const g = {}; list.forEach((p) => { const k = fn(p); (g[k] ||= { label: k, n: 0, c: 0 }); g[k].n += p.amount || 0; g[k].c++; }); return Object.values(g).sort((a, b) => b.n - a.n); };
  const byPlan = group((p) => S.plan(p.planId)?.name || "Otro plan");
  const byConv = group((p) => p.discount?.name || "Sin convenio");
  const year = sel.slice(0, 4);
  const years = [...new Set(months.map((k) => k.slice(0, 4)))];
  const last12 = Array.from({ length: 12 }, (_, i) => { const k = `${year}-${String(i + 1).padStart(2, "0")}`; return { k, label: mlabel(k, true), n: sum(by(k)), off: !months.includes(k) }; });
  const max = Math.max(...last12.map((x) => x.n), 1);
  const yearTotal = sum(all.filter((p) => mkey(p.at).slice(0, 4) === sel.slice(0, 4)));
  return {
    layout: "panel", nav: "cuotas", title: "Recaudación",
    html: `${pageHead({ back: "#/panel/cuotas", kicker: "Cuotas", title: "Recaudación", actions: `<button class="btn ghost sm" type="button" data-csv="month">${icon("download", "sm")} Excel del mes</button><button class="btn ghost sm" type="button" data-csv="all">${icon("download", "sm")} Excel de todo</button>` })}
      <div class="rc-nav">
        <a class="icon-btn ${prev ? "" : "off"}" ${prev ? `href="#/panel/recaudacion?m=${prev}"` : 'aria-disabled="true"'} aria-label="Mes anterior">${icon("left")}</a>
        <label class="rc-sel"><select data-month aria-label="Elegir mes">${months.slice().reverse().map((k) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(mlabel(k))}${k === now ? " (este mes)" : ""}</option>`).join("")}</select></label>
        <a class="icon-btn ${next ? "" : "off"}" ${next ? `href="#/panel/recaudacion?m=${next}"` : 'aria-disabled="true"'} aria-label="Mes siguiente">${icon("right")}</a>
      </div>
      <section class="money rc-money">
        <div><small>Cobrado en ${esc(mlabel(sel))}</small><b>${money(total)}</b>${diff !== null ? `<em class="${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff)} % vs. ${esc(mlabel(prev))}${partial !== null ? " (mismos días)" : ""}</em>` : `<em>${prev ? "mes anterior sin pagos" : "primer mes con pagos"}</em>`}</div>
        <div><small>Pagos registrados</small><b>${list.length}</b><em>${list.length ? `promedio ${money(total / list.length)}` : "—"}</em></div>
        <div><small>Descuentos por convenio</small><b>${money(disc)}</b><em>no cobrado por convenios</em></div>
      </section>
      <section class="card"><div class="card-h"><h2>${icon("trend", "sm")} Mes por mes</h2><span class="muted">Año ${esc(year)}: ${money(yearTotal)}</span></div>
        ${years.length > 1 ? `<div class="chips-scroll">${years.slice().reverse().map((y) => `<a class="chip ${y === year ? "on" : ""}" href="#/panel/recaudacion?m=${(months.filter((k) => k.startsWith(y)).pop())}">${y}</a>`).join("")}</div>` : ""}
        <div class="rc-cols">${last12.map((x) => `<a class="rc-col ${x.k === sel ? "on" : ""} ${x.off ? "off" : ""}" href="#/panel/recaudacion?m=${x.k}" title="${esc(mlabel(x.k))}: ${money(x.n)}"><b>${x.n ? money(x.n).replace("$ ", "") : "—"}</b><span class="rc-t"><i style="height:${Math.max(x.n ? 4 : 0, (x.n / max) * 100)}%"></i></span><small>${esc(x.label)}</small></a>`).join("")}</div>
        <p class="muted tiny">Tocá un mes para verlo. Todos los meses y años anteriores quedan guardados para siempre.</p>
      </section>
      ${list.length ? `<div class="pgrid">
        <section class="card"><div class="card-h"><h2>Por plan</h2></div>${hbars(byPlan.map((x) => ({ label: x.label, n: x.n })), total, { money: true })}</section>
        <section class="card"><div class="card-h"><h2>Por convenio</h2></div>${hbars(byConv.map((x) => ({ label: x.label, n: x.n })), total, { money: true })}</section>
      </div>` : ""}
      <section class="card"><div class="card-h"><h2>Pagos de ${esc(mlabel(sel))}</h2><span class="muted" data-count-all>${plural(list.length, "pago", "pagos")}</span></div>
        ${list.length ? `
        <div class="filters"><label class="search">${icon("search", "sm")}<input type="search" data-pq placeholder="Buscar por nombre, DNI o monto" aria-label="Buscar pago"></label></div>
        <div class="chips-scroll" data-pf>
          <button class="chip on" type="button" data-f="">Todos <b>${list.length}</b></button>
          ${byPlan.map((x) => `<button class="chip" type="button" data-f="plan:${esc(x.label)}">${esc(x.label)} <b>${x.c}</b></button>`).join("")}
          ${list.some((p) => p.discount) ? `<button class="chip" type="button" data-f="conv">Con convenio <b>${list.filter((p) => p.discount).length}</b></button>` : ""}
          ${list.some((p) => p.edited) ? `<button class="chip" type="button" data-f="edit">Editados <b>${list.filter((p) => p.edited).length}</b></button>` : ""}
        </div>
        <div class="paysum" data-fsum></div>
        <div class="paylist" data-plist>${list.map((p) => { const u = S.user(p.userId); const d = new Date(p.at);
          return `<button class="prow" type="button" data-payid="${esc(p.id)}" data-q="${esc(fold(`${u?.name || ""} ${u?.user || ""} ${p.amount}`))}" data-plan="${esc(S.plan(p.planId)?.name || "Otro plan")}" data-conv="${p.discount ? 1 : 0}" data-edit="${p.edited ? 1 : 0}" data-amt="${p.amount || 0}">
            <span class="prow-d"><b>${d.getDate()}</b><small>${esc(MONTHS[d.getMonth()])}</small></span>
            <span class="prow-t"><b>${esc(u?.name || "Socio eliminado")}</b><small>${esc(S.plan(p.planId)?.name || "")}${(p.months || 1) > 1 ? ` · ${p.months} meses` : ""}${p.discount ? ` · ${esc(p.discount.name)}` : ""}${p.edited ? " · editado" : ""}</small></span>
            <span class="prow-m">${money(p.amount)}</span></button>`; }).join("")}</div>
        <button class="btn ghost block" type="button" data-more hidden>Ver más</button>
        <p class="muted center" data-none hidden>No hay pagos con ese filtro.</p>` : `<p class="muted">No hay pagos en este mes.</p>`}
      </section>`,
    mount(host) {
      host.querySelector("[data-month]")?.addEventListener("change", (e) => go("/panel/recaudacion?m=" + e.target.value));
      /* Lista de pagos: se busca y se filtra al instante, de a 20 por vez */
      const rows = $$(".prow", host), PAGE = 20;
      if (rows.length) {
        const q = $("[data-pq]", host), more = $("[data-more]", host), none = $("[data-none]", host), sumEl = $("[data-fsum]", host);
        let f = "", shown = PAGE;
        const draw = () => {
          const t = fold(q.value.trim());
          const match = rows.filter((r) => (!t || r.dataset.q.includes(t)) && (!f || (f.startsWith("plan:") ? r.dataset.plan === f.slice(5) : f === "conv" ? r.dataset.conv === "1" : r.dataset.edit === "1")));
          rows.forEach((r) => (r.hidden = true));
          match.slice(0, shown).forEach((r) => (r.hidden = false));
          const tot = match.reduce((a, r) => a + +r.dataset.amt, 0);
          sumEl.innerHTML = `<span>${plural(match.length, "pago", "pagos")}${t || f ? " con este filtro" : ""}</span><b>${money(tot)}</b>`;
          more.hidden = match.length <= shown;
          more.textContent = `Ver más (${match.length - shown} restantes)`;
          none.hidden = !!match.length;
        };
        q.addEventListener("input", () => { shown = PAGE; draw(); });
        more.addEventListener("click", () => { shown += PAGE; draw(); });
        $("[data-pf]", host).addEventListener("click", (e) => {
          const c = e.target.closest("[data-f]"); if (!c) return;
          f = c.dataset.f; shown = PAGE;
          $$("[data-pf] .chip", host).forEach((x) => x.classList.toggle("on", x === c));
          draw();
        });
        draw();
      }
      host.addEventListener("click", (e) => {
        const r = e.target.closest("[data-payid]");
        if (r) payDetailSheet(S.db.payments.find((x) => x.id === r.dataset.payid));
        const c = e.target.closest("[data-csv]");
        if (c) downloadPaymentsXlsx(c.dataset.csv === "all" ? all : list, c.dataset.csv === "all" ? "historial" : sel);
      });
    },
  };
}

/* Planilla de Excel (.xlsx): una fila por pago, con fórmulas (el descuento y los totales se
   recalculan solos si la persona cambia un monto). Hoja "Pagos" + hoja "Por mes" que suma desde "Pagos". */
function downloadPaymentsXlsx(rows, name) {
  const sorted = rows.slice().sort((a, b) => a.at - b.at);
  const data = sorted.map((p) => { const u = S.user(p.userId); const lista = p.list ?? p.amount ?? 0, monto = p.amount || 0; return {
    at: p.at, socio: u?.name || "Socio eliminado", dni: u?.user || "", plan: S.plan(p.planId)?.name || "", meses: p.months || 1,
    lista, convenio: p.discount?.name || "", desc: Math.max(0, lista - monto), monto,
    desde: p.from || "", hasta: p.to || "", cobro: S.user(p.by)?.name || "", nota: p.note || "",
  }; });
  const sumOf = (k) => data.reduce((a, x) => a + (x[k] || 0), 0);
  const byMonth = {};
  data.forEach((x) => { const d = new Date(x.at), k = mkey(x.at); (byMonth[k] ||= { mes: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), pagos: 0, total: 0, desc: 0 }); byMonth[k].pagos++; byMonth[k].total += x.monto; byMonth[k].desc += x.desc; });
  const meses = Object.keys(byMonth).sort().map((k) => byMonth[k]);
  const L = (r) => `Pagos!$A:$A,">="&A${r},Pagos!$A:$A,"<"&EDATE(A${r},1)`;
  const blob = makeXlsx([
    {
      name: "Pagos",
      columns: [
        { header: "Fecha de cobro", key: "at", type: "date", width: 16 }, { header: "Socio", key: "socio", type: "text", width: 28 },
        { header: "DNI", key: "dni", type: "text", width: 14 }, { header: "Plan", key: "plan", type: "text", width: 32 },
        { header: "Meses", key: "meses", type: "int", width: 9 }, { header: "Precio de lista", key: "lista", type: "money", width: 17 },
        { header: "Convenio", key: "convenio", type: "text", width: 24 },
        { header: "Descuento", key: "desc", type: "money", width: 15, formula: (r) => `MAX(0,F${r}-I${r})` },
        { header: "Monto cobrado", key: "monto", type: "money", width: 17 }, { header: "Cubre desde", key: "desde", type: "date", width: 15 },
        { header: "Cubre hasta", key: "hasta", type: "date", width: 15 }, { header: "Cobró", key: "cobro", type: "text", width: 24 },
        { header: "Nota", key: "nota", type: "text", width: 34 },
      ],
      rows: data,
      total: (c, L2, n) => c.key === "at" ? "TOTAL"
        : c.key === "socio" ? { f: `COUNT(A2:A${n + 1})&" "&IF(COUNT(A2:A${n + 1})=1,"pago","pagos")`, v: `${n} ${n === 1 ? "pago" : "pagos"}` }
        : c.key === "lista" ? { f: `SUM(F2:F${n + 1})`, v: sumOf("lista") }
        : c.key === "desc" ? { f: `SUM(H2:H${n + 1})`, v: sumOf("desc") }
        : c.key === "monto" ? { f: `SUM(I2:I${n + 1})`, v: sumOf("monto") } : "",
    },
    {
      name: "Por mes",
      columns: [
        { header: "Mes", key: "mes", type: "month", width: 22 },
        { header: "Pagos", key: "pagos", type: "int", width: 12, formula: (r) => `COUNTIFS(${L(r)})` },
        { header: "Total cobrado", key: "total", type: "money", width: 20, formula: (r) => `SUMIFS(Pagos!$I:$I,${L(r)})` },
        { header: "Descuentos por convenio", key: "desc", type: "money", width: 26, formula: (r) => `SUMIFS(Pagos!$H:$H,${L(r)})` },
      ],
      rows: meses,
      total: (c, L2, n) => c.key === "mes" ? "TOTAL"
        : c.key === "pagos" ? { f: `SUM(B2:B${n + 1})`, v: meses.reduce((a, x) => a + x.pagos, 0) }
        : c.key === "total" ? { f: `SUM(C2:C${n + 1})`, v: meses.reduce((a, x) => a + x.total, 0) }
        : { f: `SUM(D2:D${n + 1})`, v: meses.reduce((a, x) => a + x.desc, 0) },
    },
  ]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `Grupo Amplifia - Recaudación ${name}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Excel descargado");
}

/* ------------------------------------------------------------- convenios
   Empresas con descuento (ej. Enerflex): porcentaje o monto fijo por mes.
   Se asigna al socio y se aplica solo al registrar cada pago. */
function convOptions() {
  return [["", "Sin convenio"], ...S.convenios().filter((c) => c.active !== false).map((c) => [c.id, S.convLabel(c)])];
}
function convField(value = "") {
  if (!S.convenios().length) return "";
  return field({ label: "Convenio", name: "conv", value: S.convenio(value) ? value : "", options: convOptions() });
}
/* "Precio de lista $40.000 · Convenio Enerflex −15 % ($6.000) · Total $34.000" */
function priceLines(pr, charged) {
  const why = pr.conv && !pr.c ? `<span class="muted">${esc(pr.conv.name)}: ${+pr.conv.value ? "no aplica a este plan" : "falta cargar el descuento (Cuotas › Convenios)"}</span>` : "";
  if (!pr.c) return why + charged !== pr.total && pr.total ? `<span>Precio de lista <b>${money(pr.list)}</b> · cobrás <b>${money(charged)}</b></span>` : `<span>Total a cobrar <b>${money(charged)}</b></span>`;
  return `<span>Precio de lista <b>${money(pr.list)}</b></span>
    <span class="disc">Convenio ${esc(pr.c.name)} ${pr.c.type === "pct" ? `−${esc(pr.c.value)} %` : "monto fijo"}: <b>−${money(pr.disc)}</b></span>
    <span>Total a cobrar <b>${money(charged)}</b>${charged !== pr.total ? ` <em>(con descuento sería ${money(pr.total)})</em>` : ""}</span>`;
}

const convPlans = (c) => (!c.planIds?.length ? "Todos los planes" : c.planIds.map((id) => S.plan(id)?.name).filter(Boolean).join(", ") || "Ningún plan");
const convValue = (c) => (!+c.value ? "A definir" : c.type === "pct" ? `${c.value} %` : `${money(c.value)} / mes`);
const convMembers = (id) => S.spaceMembers("vientos").filter((m) => m.fee?.convenioId === id);
const convInitials = (n) => String(n).replace(/\(.*\)/, "").trim().split(/[\s·]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* Pantalla de convenios: buscador, filtros y una ficha por empresa */
export function conveniosView() {
  if (S.currentSpace() !== "vientos") return go("/panel/cuotas", { replace: true });
  const list = S.convenios().slice().sort((x, y) => (+!+x.value) - (+!+y.value) || x.name.localeCompare(y.name, "es"));
  const withDisc = list.filter((c) => +c.value).length;
  const people = S.spaceMembers("vientos").filter((m) => S.convenio(m.fee?.convenioId)).length;
  return {
    layout: "panel", nav: "cuotas", title: "Convenios",
    html: `${pageHead({ back: "#/panel/cuotas", kicker: "Cuotas", title: "Convenios", actions: `<button class="btn primary sm" type="button" data-act="new">${icon("plus", "sm")} Nuevo convenio</button>` })}
      <p class="muted lead">Empresas y organizaciones con descuento ("Entrená con descuento"). Al dar de alta o cobrarle a un socio elegís su convenio y la app calcula el total.</p>
      <section class="kpis kpis3">
        <div class="kpi"><b>${list.length}</b><small>convenios</small></div>
        <div class="kpi ${list.length - withDisc ? "warn" : ""}"><b>${list.length - withDisc}</b><small>sin descuento cargado</small></div>
        <div class="kpi"><b>${people}</b><small>socios con convenio</small></div>
      </section>
      <div class="filters"><label class="search">${icon("search", "sm")}<input type="search" data-q placeholder="Buscar empresa u organización" aria-label="Buscar convenio"></label></div>
      <div class="chips-scroll" role="tablist">
        <button class="chip on" type="button" data-f="">Todos <b>${list.length}</b></button>
        <button class="chip" type="button" data-f="ok">Con descuento <b>${withDisc}</b></button>
        <button class="chip" type="button" data-f="todo">A definir <b>${list.length - withDisc}</b></button>
      </div>
      <div class="cvlist">${list.map((c) => {
        const n = convMembers(c.id).length;
        return `<button class="cvrow" type="button" data-cv="${esc(c.id)}" data-state="${+c.value ? "ok" : "todo"}" data-name="${esc(fold(c.name + " " + (c.data || "") + " " + (c.contact || "")))}">
          <span class="cv-ic">${esc(convInitials(c.name))}</span>
          <span class="cv-t"><b>${esc(c.name)}</b><small>${plural(n, "socio", "socios")} · ${esc(convPlans(c))}</small></span>
          <span class="cv-badge ${+c.value ? "" : "todo"}">${esc(convValue(c))}</span>
          ${icon("right", "sm")}</button>`;
      }).join("")}</div>
      <div data-none hidden>${empty("search", "No hay convenios con ese nombre")}</div>`,
    mount(host) {
      const q = $("[data-q]", host), none = $("[data-none]", host);
      let f = "";
      const lim = limitList($(".cvlist", host), { size: 30 });
      const apply = () => {
        const t = fold(q.value.trim());
        let shown = 0;
        $$(".cvrow", host).forEach((r) => { const ok = (!f || r.dataset.state === f) && (!t || r.dataset.name.includes(t)); r.toggleAttribute("data-off", !ok); shown += ok; });
        none.hidden = !!shown;
        lim.apply(true);
      };
      q.addEventListener("input", apply);
      host.addEventListener("click", (e) => {
        const ch = e.target.closest("[data-f]");
        if (ch) { f = ch.dataset.f; $$("[data-f]", host).forEach((x) => x.classList.toggle("on", x === ch)); apply(); }
        const r = e.target.closest("[data-cv]");
        if (r) convenioSheet(S.convenio(r.dataset.cv));
        if (e.target.closest("[data-act=new]")) convenioSheet(null);
      });
    },
  };
}

/* Ficha de un convenio: alta o edición */
function convenioSheet(c) {
  const isNew = !c;
  c = c || { id: "c-" + Date.now().toString(36), name: "", type: "pct", value: 0, planIds: [], contact: "", phone: "", data: "" };
  const members = isNew ? [] : convMembers(c.id);
  const ex = S.plansOf("vientos")[0];
  sheet({
    title: isNew ? "Nuevo convenio" : "Editar convenio",
    html: `<form novalidate class="cvform">
      ${field({ label: "Empresa u organización", name: "name", value: c.name, req: true, ph: "Ej: Enerflex, SMATA, Policía de Santa Cruz" })}
      <fieldset class="cvsec"><legend>Descuento</legend>
        <div class="seg" role="radiogroup" aria-label="Tipo de descuento">
          <label><input type="radio" name="type" value="pct" ${c.type !== "fixed" ? "checked" : ""}><span>Porcentaje</span></label>
          <label><input type="radio" name="type" value="fixed" ${c.type === "fixed" ? "checked" : ""}><span>Monto fijo por mes</span></label>
        </div>
        <label class="field"><span data-vlabel></span><span class="affix"><i data-pre>$</i><input type="number" name="value" value="${+c.value ? esc(c.value) : ""}" min="0" inputmode="numeric" placeholder="A definir"><i data-suf>%</i></span>
          <small>Si todavía no sabés el descuento, dejalo vacío: queda "A definir" y no descuenta nada.</small></label>
        <p class="cvex" data-ex></p>
      </fieldset>
      <fieldset class="cvsec"><legend>Vale para</legend>
        <div class="cvplans">${S.plansOf("vientos").map((p) => `<label class="pchip"><input type="checkbox" name="plan" value="${esc(p.id)}" ${!c.planIds?.length || c.planIds.includes(p.id) ? "checked" : ""}><span>${esc(p.name)}</span></label>`).join("")}</div>
      </fieldset>
      <fieldset class="cvsec"><legend>Datos de la empresa <em>(opcional)</em></legend>
        <div class="grid2">${field({ label: "Persona de contacto", name: "contact", value: c.contact || "" })}${field({ label: "Teléfono", name: "phone", type: "tel", value: c.phone || "" })}</div>
        ${field({ label: "Notas", name: "data", type: "textarea", value: c.data || "", ph: "CUIT, requisitos (carnet, recibo de sueldo), vigencia…" })}
      </fieldset>
      ${members.length ? `<fieldset class="cvsec"><legend>Socios con este convenio (${members.length})</legend>
        <div class="mlist">${members.slice(0, 8).map((m) => `<a class="mrow" href="#/panel/socios/${m.id}">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${esc(S.plan(m.fee?.planId)?.name || "")}</small></span>${icon("right", "sm")}</a>`).join("")}</div>
      </fieldset>` : ""}
      <p class="form-err" role="alert" hidden></p>
      <button class="btn primary block lg" type="submit">${icon("check", "sm")} ${isNew ? "Crear convenio" : "Guardar cambios"}</button>
      ${isNew ? "" : `<button class="btn ghost block danger-t" type="button" data-del>${icon("trash", "sm")} Eliminar convenio</button>`}
    </form>`,
    onMount(b, close) {
      const f = $("form", b), err = $(".form-err", b);
      const draw = () => {
        const fixed = f.type.value === "fixed", v = +f.value.value || 0;
        $("[data-vlabel]", b).textContent = fixed ? "Monto que se descuenta por mes" : "Porcentaje de descuento";
        $("[data-pre]", b).hidden = !fixed; $("[data-suf]", b).hidden = fixed;
        const disc = !v || !ex ? 0 : fixed ? Math.min(ex.price, v) : Math.round((ex.price * v) / 100);
        $("[data-ex]", b).innerHTML = v && ex ? `Ejemplo: ${esc(ex.name)} <s>${money(ex.price)}</s> → <b>${money(ex.price - disc)}</b> por mes` : "";
      };
      f.addEventListener("input", draw); f.addEventListener("change", draw); draw();
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const fail = (m) => { err.textContent = m; err.hidden = false; };
        const name = f.name.value.trim(), type = f.type.value, value = +f.value.value || 0;
        const on = $$("[name=plan]:checked", f).map((x) => x.value);
        if (!name) return fail("Escribí el nombre de la empresa.");
        if (S.convenios().some((x) => x.id !== c.id && fold(x.name) === fold(name))) return fail("Ya hay un convenio con ese nombre.");
        if (value < 0 || (type === "pct" && value > 100)) return fail("El porcentaje tiene que ser entre 1 y 100.");
        if (!on.length) return fail("Marcá al menos un plan.");
        const next = { ...c, name, type, value, planIds: on.length === S.plansOf("vientos").length ? [] : on, contact: f.contact.value.trim(), phone: f.phone.value.trim(), data: f.data.value.trim() };
        const list = S.convenios().filter((x) => x.id !== c.id);
        S.api.saveConvenios(isNew ? [...list, next] : S.convenios().map((x) => (x.id === c.id ? next : x)));
        close(); toast(isNew ? "Convenio creado" : "Convenio guardado"); refresh();
      });
      $("[data-del]", b)?.addEventListener("click", async () => {
        const ok = await confirmDialog({ title: `¿Eliminar ${c.name}?`, text: members.length ? `${plural(members.length, "socio queda", "socios quedan")} sin convenio. Los pagos ya hechos no cambian.` : "Los pagos ya hechos no cambian.", ok: "Eliminar", danger: true });
        if (!ok) return;
        S.api.saveConvenios(S.convenios().filter((x) => x.id !== c.id));
        close(); toast("Convenio eliminado"); refresh();
      });
    },
  });
}

/* ---------------------------------------------------------------- avisos */
export function noticesView() {
  return {
    layout: "panel", nav: "avisos", title: "Avisos",
    html: `${pageHead({ title: "Avisos a los socios" })}
      <p class="muted lead">Aparecen en el inicio de la app de todos los socios. Con la versión final también llegan como notificación al celular.</p>
      <form class="card" novalidate>
        ${field({ label: "Título", name: "title", req: true, ph: "Ej: El lunes feriado abrimos de 9 a 13" })}
        ${field({ label: "Mensaje", name: "body", type: "textarea", ph: "Detalle del aviso" })}
        <button class="btn primary" type="submit">${icon("bell", "sm")} Publicar aviso</button>
      </form>
      <section class="sec" data-notices>${S.noticesOf().map((n) => `<article class="notice"><span class="notice-d">${esc(relDay(n.at))}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><button class="icon-btn sm" type="button" data-del="${n.id}" aria-label="Borrar aviso">${icon("trash", "sm")}</button></article>`).join("") || empty("bell", "No hay avisos publicados")}</section>`,
    mount(host) {
      limitList($("[data-notices]", host), { size: 10 });
      $("form", host).addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(e.target);
        if (!d.title.trim()) return toast("Escribí un título.", "err");
        S.api.addNotice({ title: d.title.trim(), body: d.body.trim(), by: me().id, ...(S.currentSpace() === "fitz" ? { space: "fitz" } : {}) });
        toast("Aviso publicado"); refresh();
      });
      host.addEventListener("click", async (e) => {
        const d = e.target.closest("[data-del]");
        if (d && await confirmDialog({ title: "¿Borrar el aviso?", ok: "Borrar", danger: true })) { S.api.deleteNotice(d.dataset.del); refresh(); }
      });
    },
  };
}

/* -------------------------------------------------------------- gimnasio */
const WDN = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export function gymView() {
  const sp = S.currentSpace(), fz = sp === "fitz", g = S.gymOf(sp);
  const team = S.db.users.filter((u) => u.role !== "socio" && u.status === "activo" && S.inSpace(u));
  return {
    layout: "panel", nav: "gimnasio", title: "Gimnasio",
    html: `${pageHead({ title: fz ? "Datos de Fitz Club" : "Datos del gimnasio" })}
      <div class="pgrid">
        <form class="card" data-gym novalidate>
          <div class="card-h"><h2>${icon("pin", "sm")} Contacto</h2></div>
          ${field({ label: "Nombre", name: "name", value: g.name, req: true })}
          <div class="grid2">${field({ label: "Dirección", name: "address", value: g.address })}${field({ label: "Ciudad", name: "city", value: g.city })}</div>
          <div class="grid2">${field({ label: "WhatsApp", name: "whatsapp", type: "tel", value: g.whatsapp })}${field({ label: "Instagram (usuario)", name: "instagram", value: g.instagram })}</div>
          ${fz ? "" : `<label class="toggle"><span><b>Permitir que se registren solos desde la app</b><small>Apagado (recomendado): los socios los da de alta recepción o el profe al pagar.</small></span><input type="checkbox" name="selfSignup" ${g.selfSignup ? "checked" : ""} role="switch"><i aria-hidden="true"></i></label>
          ${field({ label: "Código para registrarse solos", name: "joinCode", value: g.joinCode, hint: "Solo se usa si el registro desde la app está permitido." })}`}
          <h3 class="sub">Horarios</h3>
          <div class="hours-ed">${[1, 2, 3, 4, 5, 6, 0].map((d) => { const [a, b] = (g.open[d] || "").split("-"); return `<div class="hrow-ed" data-d="${d}"><span>${WDN[d]}</span><label class="check"><input type="checkbox" data-closed ${g.open[d] ? "" : "checked"}><span>Cerrado</span></label><input type="time" data-a value="${a || "06:00"}" ${g.open[d] ? "" : "disabled"} aria-label="${WDN[d]} abre"><input type="time" data-b value="${b || "22:00"}" ${g.open[d] ? "" : "disabled"} aria-label="${WDN[d]} cierra"></div>`; }).join("")}</div>
          <button class="btn primary" type="submit">Guardar</button>
        </form>
        <section class="card">
          <div class="card-h"><h2>${icon("users", "sm")} Equipo</h2></div>
          <div class="row-btns team-add"><button class="btn primary sm" type="button" data-act="admin">${icon("shield", "sm")} Sumar administrador</button><button class="btn ghost sm" type="button" data-act="coach">${icon("userplus", "sm")} Sumar profe</button></div>
          ${team.sort((a, b) => (a.role === "admin" ? 0 : 1) - (b.role === "admin" ? 0 : 1)).map((c) => `<div class="mrow">${avatar(c, "sm")}<span><b>${esc(c.name)}</b><small>${c.role === "admin" ? "Administrador · acceso total" : `Profe · ${plural(S.membersOf(c.id).length, "socio", "socios")}`}</small></span></div>`).join("")}
        </section>
        ${S.MODE === "demo" ? `<section class="card"><div class="card-h"><h2>${icon("info", "sm")} Demostración</h2></div>
          <p class="muted">Vuelve todos los datos de ejemplo a como estaban al principio.</p>
          <button class="btn ghost sm danger-t" type="button" data-act="reset">${icon("repeat", "sm")} Reiniciar la demostración</button></section>` : ""}
      </div>`,
    mount(host) {
      const f = $("[data-gym]", host);
      f.addEventListener("change", (e) => {
        if (e.target.matches("[data-closed]")) { const r = e.target.closest("[data-d]"); r.querySelectorAll("input[type=time]").forEach((x) => (x.disabled = e.target.checked)); }
      });
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(f);
        if (!d.name.trim()) return toast("Escribí el nombre.", "err");
        const open = [...g.open];
        $$("[data-d]", f).forEach((r) => { open[+r.dataset.d] = r.querySelector("[data-closed]").checked ? "" : `${r.querySelector("[data-a]").value}-${r.querySelector("[data-b]").value}`; });
        const base = { name: d.name.trim(), address: d.address, city: d.city, whatsapp: d.whatsapp, instagram: d.instagram.replace(/^@/, ""), open };
        S.api.saveGym(fz ? base : { ...base, joinCode: d.joinCode.trim() || g.joinCode, selfSignup: !!d.selfSignup }, sp);
        toast("Datos guardados");
      });
      host.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-act]")?.dataset.act;
        if (a === "coach") coachSheet("profe");
        if (a === "admin") coachSheet("admin");
        if (a === "reset" && await confirmDialog({ title: "¿Reiniciar la demostración?", text: "Se pierden todos los cambios hechos en este navegador.", ok: "Reiniciar", danger: true })) {
          await S.resetDemo(); logout(); location.hash = "#/ingresar"; location.reload();
        }
      });
    },
  };
}

/* Borrar una rutina asignada por error (desde la ficha del socio o el editor).
   Pide confirmación; lo que ya entrenó con ella queda guardado. */
export async function deleteRoutine(r) {
  const m = S.user(r.userId);
  const n = S.logsOf(r.userId).filter((l) => l.routineId === r.id).length;
  const ok = await confirmDialog({
    title: "¿Borrar esta rutina?",
    text: `${S.routineTitle(r)} de ${m?.name || "este socio"}. ${n ? `Ya entrenó ${plural(n, "vez", "veces")} con ella: esos entrenamientos, sus kilos y sus récords quedan guardados.` : "Todavía no entrenó con ella."}${r.active ? " Queda sin rutina hasta que le asignes otra." : ""}`,
    ok: "Borrar rutina", danger: true,
  });
  if (!ok) return;
  S.api.deleteRoutine(r.id);
  toast("Rutina borrada");
  if (location.hash === `#/panel/socios/${r.userId}`) refresh(); else go(`/panel/socios/${r.userId}`);
}

/* Sumar al equipo: administrador (acceso total) o profe */
function coachSheet(role = "profe") {
  const adm = role === "admin";
  sheet({
    title: adm ? "Sumar administrador" : "Sumar profe",
    html: `<form novalidate>
      <p class="muted">${adm ? "Tiene acceso total: socios, rutinas, cuotas y cobros, datos del gimnasio y el equipo (puede sumar otros administradores y profes)." : "Maneja socios, rutinas, plantillas, ejercicios, cuotas y avisos. No ve los datos del gimnasio ni el equipo."}</p>
      ${field({ label: "Nombre y apellido", name: "fullname", req: true })}
      <div class="grid2">${field({ label: "Email (será su usuario)", name: "email", type: "email", req: true })}${field({ label: "Teléfono", name: "phone", type: "tel" })}</div>
      <p class="form-err" role="alert" hidden></p><button class="btn primary block" type="submit">${adm ? "Crear administrador" : "Crear profe"}</button></form>`,
    onMount(b, close) {
      const f = $("form", b), err = $(".form-err", b);
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = formData(f);
        if (!d.fullname.trim() || !/^\S+@\S+\.\S+$/.test(d.email)) { err.textContent = "Completá nombre y un email válido."; err.hidden = false; return; }
        const pass = genPass();
        try {
          const c = await S.api.createCoach({ name: d.fullname, email: d.email, phone: d.phone, pass, role, space: S.currentSpace() });
          close(); refresh();
          setTimeout(() => credentialsSheet(c, pass, adm ? "Administrador creado" : "Profe creado"), 300);
        } catch (e2) { err.textContent = e2.message; err.hidden = false; }
      });
    },
  });
}

/* ------------------------------------------------------------- QR y "más" */
export function qrView() {
  const g = S.gymOf(), url = installUrl();
  return {
    layout: "panel", nav: "qr", title: "QR de la app",
    html: `${pageHead({ title: "QR de la app", actions: `<button class="btn primary sm" type="button" data-print>${icon("print", "sm")} Imprimir</button>` })}
      <p class="muted lead">Imprimilo y ponelo en recepción. El socio lo escanea <b>una sola vez</b> para instalar la app; después entra desde el ícono.</p>
      <article class="poster" id="poster">
        <div class="poster-logo">${spaceLogo(S.currentSpace())}</div>
        <h2>Tu rutina,<br><b>en tu celular</b></h2>
        <div class="poster-qr" data-qr></div>
        <ol class="poster-steps"><li>Escaneá el código con la cámara</li><li>Instalá la app (es gratis)</li><li>Entrá con tu <b>DNI</b> (usuario y contraseña)</li></ol>
        <p class="poster-url">${esc(url.replace(/^https?:\/\//, "").replace("/#/instalar", ""))}</p>
      </article>`,
    mount(host) {
      qrSvg(url, 8).then((svg) => ($("[data-qr]", host).innerHTML = svg)).catch(() => ($("[data-qr]", host).textContent = url));
      $("[data-print]", host).addEventListener("click", () => window.print());
    },
  };
}

export function moreView() {
  const items = [
    ["#/panel/cuotas", "card", "Cuotas"], ["#/panel/avisos", "bell", "Avisos a los socios"],
    ...(isAdmin() ? [["#/panel/convenios", "card", "Convenios"], ["#/panel/gimnasio", "settings", "Datos del gimnasio y equipo"]] : []),
    ["#/panel/qr", "qr", "QR de la app"], ["#/panel/cuenta", "user", "Mi cuenta"],
  ];
  return {
    layout: "panel", nav: "mas", title: "Más",
    html: `${pageHead({ title: "Más" })}<section class="card">${items.map(([h, i, l]) => `<a class="lrow" href="${h}">${icon(i, "sm")}<span>${l}</span>${icon("right", "sm")}</a>`).join("")}
      <button class="lrow" type="button" data-out>${icon("logout", "sm")}<span>Cerrar sesión</span>${icon("right", "sm")}</button></section>`,
    mount(host) { $("[data-out]", host).addEventListener("click", async () => { await logout(); go("/ingresar", { replace: true }); }); },
  };
}


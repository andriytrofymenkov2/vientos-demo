/* Panel del entrenador y del gimnasio */
import { icon, logo } from "../core/icons.js";
import { esc, fold, fmtDate, relDay, dayKey, plural, debounce, waNumber, firstName, DAY, $, $$, countUp } from "../core/util.js";
import * as S from "../core/store.js";
import { me, isAdmin, logout } from "../core/auth.js";
import { go, refresh } from "../core/router.js";
import { field, formData, toast, sheet, confirmDialog, pageHead, empty, avatar, feePill } from "../core/ui.js";
import { heatmap } from "./progress.js";
import { routineView } from "./routine.js";
import { qrSvg, installUrl } from "./install.js";

/* Socios sin email: se les crea uno interno que no se muestra */
const realEmail = (e) => (/@sin-email\.vientos\.app$/.test(e || "") ? "" : e || "");
const money = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");
const lastLog = (uid) => S.logsOf(uid)[0];

/* --------------------------------------------------------------- resumen */
export function panelHome() {
  const u = me();
  const act = S.activeMembers();
  const mine = S.membersOf(u.id);
  const today = dayKey();
  const todayLogs = S.db.logs.filter((l) => dayKey(l.at) === today).sort((a, b) => b.at - a.at);
  const soon = act.filter((m) => S.feeStatus(m).state === "soon");
  const late = act.filter((m) => S.feeStatus(m).state === "late");
  const noRoutine = act.filter((m) => !S.activeRoutine(m.id));
  const pend = S.pending();
  const inactive = (u.role === "admin" ? act : mine).filter((m) => { const l = lastLog(m.id); return S.activeRoutine(m.id) && (!l || Date.now() - l.at > 10 * DAY); });
  const kpi = (n, label, href, cls = "") => `<a class="kpi ${cls}" href="${href}"><b data-count="${n}">0</b><small>${label}</small></a>`;
  const mrow = (m, extra) => `<a class="mrow" href="#/panel/socios/${m.id}">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${extra}</small></span>${icon("right", "sm")}</a>`;

  return {
    layout: "panel", nav: "resumen", title: "Resumen",
    html: `<section class="phello"><span class="kicker">${esc(fmtDate(Date.now()))}</span><h1>Hola, ${esc(firstName(u.name))}</h1></section>
      <section class="kpis">
        ${kpi(act.length, "socios activos", "#/panel/socios")}
        ${kpi(todayLogs.length, "entrenaron hoy", "#/panel/socios?f=hoy")}
        ${kpi(soon.length, "cuotas por vencer", "#/panel/cuotas?f=soon", soon.length ? "warn" : "")}
        ${kpi(late.length, "cuotas vencidas", "#/panel/cuotas?f=late", late.length ? "bad" : "")}
      </section>
      ${pend.length ? `<section class="card alert-card"><div class="card-h"><h2>${icon("userplus", "sm")} Socios nuevos para aprobar</h2><span class="pill red">${pend.length}</span></div>
        <p class="muted tiny">Se registraron solos desde la app con el código del gimnasio. Revisá que sean socios de Vientos, asignales profe y plan, y aprobalos.</p>
        ${pend.map((m) => `<div class="mrow">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${esc(m.email)} · ${esc(relDay(m.joined))}</small></span><button class="btn primary sm" type="button" data-approve="${m.id}">Revisar</button></div>`).join("")}
      </section>` : ""}
      <div class="pgrid">
        <section class="card"><div class="card-h"><h2>${icon("bolt", "sm")} Entrenaron hoy</h2><span class="muted">${todayLogs.length}</span></div>
          ${todayLogs.slice(0, 8).map((l) => { const m = S.user(l.userId); return m ? mrow(m, `${esc(l.dayName)} · ${esc(l.focus)} · ${l.min} min`) : ""; }).join("") || `<p class="muted">Todavía nadie registró un entrenamiento hoy.</p>`}
        </section>
        <section class="card"><div class="card-h"><h2>${icon("dumbbell", "sm")} Sin rutina asignada</h2><span class="muted">${noRoutine.length}</span></div>
          ${noRoutine.slice(0, 6).map((m) => mrow(m, `Socio desde ${fmtDate(m.joined)}`)).join("") || `<p class="muted">Todos los socios tienen rutina.</p>`}
        </section>
        <section class="card"><div class="card-h"><h2>${icon("alert", "sm")} Hace más de 10 días que no vienen</h2><span class="muted">${inactive.length}</span></div>
          ${inactive.slice(0, 6).map((m) => { const l = lastLog(m.id); return mrow(m, l ? `Último: ${relDay(l.at)}` : "Nunca registró"); }).join("") || `<p class="muted">Nadie: todos vienen seguido.</p>`}
        </section>
        ${u.role !== "admin" ? `<section class="card"><div class="card-h"><h2>${icon("users", "sm")} Mis socios</h2><span class="muted">${mine.length}</span></div>
          ${mine.slice(0, 6).map((m) => { const r = S.activeRoutine(m.id); return mrow(m, r ? esc(S.routineTitle(r)) : "Sin rutina"); }).join("")}
          <a class="btn ghost sm" href="#/panel/socios?f=mios">Ver todos</a></section>` : ""}
      </div>`,
    mount(host) {
      $$("[data-count]", host).forEach((el) => countUp(el, +el.dataset.count));
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
        ${field({ label: "Plan", name: "plan", options: [["", "Cargar después"], ...S.db.plans.map((p) => [p.id, p.name])] })}
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
const FILTERS = [["", "Todos"], ["mios", "Mis socios"], ["hoy", "Entrenaron hoy"], ["sin", "Sin rutina"], ["soon", "Cuota por vencer"], ["late", "Cuota vencida"], ["pend", "Para aprobar"]];

export function membersView(params, query) {
  const f = query.f || "", q = query.q || "";
  const today = dayKey();
  let list = f === "pend" ? S.pending() : S.activeMembers();
  if (f === "mios") list = list.filter((m) => m.coachId === me().id);
  if (f === "hoy") list = list.filter((m) => { const l = lastLog(m.id); return l && dayKey(l.at) === today; });
  if (f === "sin") list = list.filter((m) => !S.activeRoutine(m.id));
  if (f === "soon" || f === "late") list = list.filter((m) => S.feeStatus(m).state === f);
  if (q) list = list.filter((m) => fold(m.name + " " + m.email + " " + m.phone).includes(fold(q)));
  list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  const pend = S.pending().length;

  return {
    layout: "panel", nav: "socios", title: "Socios",
    html: `${pageHead({ title: "Socios", actions: `<button class="btn primary sm" type="button" data-act="new">${icon("userplus", "sm")} Nuevo socio</button>` })}
      <div class="filters"><label class="search">${icon("search", "sm")}<input type="search" data-q value="${esc(q)}" placeholder="Buscar por nombre, email o teléfono" aria-label="Buscar socio"></label></div>
      <div class="chips-scroll">${FILTERS.map(([k, l]) => `<a class="chip ${k === f ? "on" : ""}" href="#/panel/socios${k ? "?f=" + k : ""}">${l}${k === "pend" && pend ? ` <b>${pend}</b>` : ""}</a>`).join("")}</div>
      <p class="muted tiny">${plural(list.length, "socio", "socios")}</p>
      <div class="mlist">${list.map((m) => {
        if (m.status === "pendiente") return `<button type="button" class="mrow" data-approve="${m.id}">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>Se registró ${esc(relDay(m.joined))} · espera aprobación</small></span><span class="pill red">Revisar</span></button>`;
        const r = S.activeRoutine(m.id), l = lastLog(m.id), c = S.user(m.coachId);
        return `<a class="mrow" href="#/panel/socios/${m.id}">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${r ? esc(S.routineTitle(r)) : "Sin rutina"} · ${l ? "vino " + esc(relDay(l.at)) : "sin registros"}${c ? " · " + esc(firstName(c.name)) : ""}</small></span>${feePill(m)}</a>`;
      }).join("") || empty("users", "No hay socios con ese filtro")}</div>`,
    mount(host) {
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
  const p0 = S.db.plans[0];
  sheet({
    title: "Nuevo socio",
    html: `<form novalidate>
      <div class="grid2">${field({ label: "Nombre", name: "first", req: true, attrs: 'autocomplete="off"' })}${field({ label: "Apellido", name: "last", req: true, attrs: 'autocomplete="off"' })}</div>
      <div class="grid2">${field({ label: "DNI (será su usuario)", name: "dni", req: true, ph: "Sin puntos", attrs: 'inputmode="numeric" autocomplete="off"' })}${field({ label: "Teléfono (WhatsApp)", name: "phone", type: "tel", req: true, ph: "2966 …" })}</div>
      <div class="grid2">${field({ label: "Fecha de nacimiento", name: "birth", type: "date" })}${field({ label: "Email (opcional)", name: "email", type: "email", ph: "Para recuperar la contraseña" })}</div>
      ${field({ label: "Profe a cargo", name: "coach", value: me().role === "profe" ? me().id : "", options: [["", "Sin asignar"], ...S.coaches().map((c) => [c.id, c.name])] })}
      <fieldset class="paybox"><legend>Cuota</legend>
        <div class="grid2">${field({ label: "Plan", name: "plan", value: p0?.id, options: S.db.plans.map((p) => [p.id, p.name]) })}${field({ label: "Monto cobrado", name: "amount", type: "number", value: p0?.price || "", attrs: 'inputmode="numeric" min="0"' })}</div>
        <label class="check"><input type="checkbox" name="paid" checked><span>Ya pagó: registrar el pago y la cuota vence en un mes</span></label>
      </fieldset>
      <p class="muted tiny">Va a entrar con su DNI como usuario y contraseña. La primera vez, la app le pide elegir su propia contraseña.</p>
      <p class="form-err" role="alert" hidden></p>
      <button class="btn primary block" type="submit">${icon("userplus", "sm")} Crear socio</button></form>`,
    onMount(b, close) {
      const f = $("form", b), err = $(".form-err", b);
      f.plan.addEventListener("change", () => { f.amount.value = S.plan(f.plan.value)?.price || ""; });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = formData(f);
        const fail = (m) => { err.textContent = m; err.hidden = false; };
        err.hidden = true;
        const dni = d.dni.replace(/\D/g, "");
        if (!d.first.trim() || !d.last.trim()) return fail("Completá nombre y apellido.");
        if (dni.length < 7 || dni.length > 9) return fail("Revisá el DNI (solo números).");
        if (d.phone.replace(/\D/g, "").length < 8) return fail("Revisá el teléfono.");
        if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) return fail("Revisá el email.");
        const pass = dni;
        const btn = $("button[type=submit]", f);
        btn.disabled = true;
        try {
          const m = await S.api.createMember({ name: `${d.first.trim()} ${d.last.trim()}`, dni, email: d.email.trim(), phone: d.phone, birth: d.birth, pass, coachId: d.coach, planId: d.paid ? null : d.plan });
          if (d.paid) S.api.registerPayment(m.id, { planId: d.plan, months: 1, amount: +d.amount || 0, by: me().id });
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
      const fill = (q = "") => { ul.innerHTML = S.activeMembers().filter((m) => !q || fold(m.name).includes(fold(q))).sort((a, c) => a.name.localeCompare(c.name, "es")).slice(0, 40).map((m) => { const r = S.activeRoutine(m.id); return `<button type="button" class="mrow" data-u="${m.id}">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${r ? "Tiene: " + esc(S.routineTitle(r)) : "Sin rutina"}</small></span>${icon("right", "sm")}</button>`; }).join(""); };
      fill();
      $("[data-uq]", b).addEventListener("input", (e) => fill(e.target.value));
      return;
    }
    const m = S.user(chosenUser);
    const cur = S.activeRoutine(m.id);
    const n = (S.routinesOf(m.id)[0]?.number || 0) + 1;
    const opts = S.db.templates.slice().sort((a, c) => a.order - c.order);
    b.innerHTML = `<div class="mrow plain">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${cur ? "Rutina actual: " + esc(S.routineTitle(cur)) + " (pasa al historial)" : "Todavía sin rutina"}</small></span></div>
      <form novalidate>
        <fieldset class="radios"><legend>Punto de partida</legend>
          <label class="radio"><input type="radio" name="from" value="__blank" ${chosenT ? "" : "checked"}><span><b>Desde cero</b><small>Armás la rutina ejercicio por ejercicio.</small></span></label>
          ${opts.map((t) => `<label class="radio"><input type="radio" name="from" value="${t.id}" ${t.id === chosenT ? "checked" : ""}><span><b>${esc(t.name)}</b><small>${esc(t.level)} · ${plural(t.days.length, "día", "días")} · ${esc(t.goal)}</small></span></label>`).join("")}
        </fieldset>
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
      const r = S.api.assign(m.id, { templateId: blank ? null : d.from, coachId: me().id, personal: !!d.personal || blank, name: blank ? "Rutina personalizada" : "", note: d.note });
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

export function memberView(params) {
  const m = S.user(params.id);
  if (!m || m.role !== "socio") return go("/panel/socios", { replace: true });
  if (m.status === "pendiente") { setTimeout(() => approveSheet(m), 50); return go("/panel/socios?f=pend", { replace: true }); }
  const r = S.activeRoutine(m.id);
  const all = S.routinesOf(m.id);
  const logs = S.logsOf(m.id);
  const p = S.plan(m.fee?.planId);
  const pays = S.db.payments.filter((x) => x.userId === m.id).sort((a, b) => b.at - a.at).slice(0, 4);
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
          ${all.filter((x) => !x.active).length ? `<h3 class="sub">Historial</h3>${all.filter((x) => !x.active).map((x) => `<a class="hrow" href="#/panel/rutina/${x.id}"><span><b>${esc(S.routineTitle(x))}</b><small>${fmtDate(x.startedAt)} al ${fmtDate(x.endedAt || Date.now())}</small></span>${icon("right", "sm")}</a>`).join("")}` : ""}
        </section>
        <section class="card"><div class="card-h"><h2>${icon("trend", "sm")} Constancia</h2><span class="muted">${plural(logs.filter((l) => l.at >= m0.getTime()).length, "entrenamiento", "entrenamientos")} este mes</span></div>
          ${heatmap(m.id, 12)}
          ${logs.slice(0, 5).map((l) => `<div class="hrow"><span><b>${esc(l.dayName)} · ${esc(l.focus)}</b><small>${esc(relDay(l.at))} · ${l.min} min${l.sets.length ? ` · ${l.sets.length} series` : ""}</small></span></div>`).join("") || `<p class="muted">Sin entrenamientos registrados.</p>`}
        </section>
        <section class="card"><div class="card-h"><h2>${icon("card", "sm")} Cuota</h2>${feePill(m)}</div>
          ${m.fee ? `<dl class="kv"><div><dt>Plan</dt><dd>${esc(p?.name || "—")}</dd></div><div><dt>Vence</dt><dd>${fmtDate(m.fee.dueAt, { year: true })}</dd></div></dl>` : `<p class="muted">Sin cuota cargada.</p>`}
          <div class="row-btns"><button class="btn primary sm" type="button" data-act="pay">${icon("check", "sm")} Registrar pago</button><button class="btn ghost sm" type="button" data-act="due">Cambiar vencimiento</button></div>
          ${pays.length ? `<h3 class="sub">Pagos</h3>${pays.map((x, i) => `<div class="hrow payrow"><span><b>${money(x.amount)} · ${plural(x.months || 1, "mes", "meses")}</b><small>${x.from ? `Cubre ${fmtDate(x.from)} al ${fmtDate(x.to, { year: true })}` : esc(S.plan(x.planId)?.name || "")} · cobrado el ${fmtDate(x.at)}</small></span>${i === 0 ? `<button class="btn ghost sm danger-t" type="button" data-unpay="${x.id}">Anular</button>` : ""}</div>`).join("")}` : ""}
        </section>
        <section class="card"><div class="card-h"><h2>${icon("settings", "sm")} Cuenta</h2></div>
          ${field({ label: "Profe a cargo", name: "coach", value: m.coachId || "", options: [["", "Sin asignar"], ...S.coaches().map((c) => [c.id, c.name])], attrs: "data-coach" })}
          <button class="lrow" type="button" data-act="reset">${icon("lock", "sm")}<span>${isDni(m.user) ? "Olvidó la contraseña: volver a su DNI" : "Generar contraseña nueva"}</span>${icon("right", "sm")}</button>
          <button class="lrow danger" type="button" data-act="drop">${icon("trash", "sm")}<span>Dar de baja de la app</span>${icon("right", "sm")}</button>
        </section>
      </div>`,
    mount(host) {
      $("[data-coach]", host).addEventListener("change", (e) => { S.api.updateUser(m.id, { coachId: e.target.value || null }); toast("Profe actualizado"); });
      host.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-act]")?.dataset.act;
        if (a === "assign") assignSheet({ userId: m.id });
        if (a === "pay") paySheet(m);
        const un = e.target.closest("[data-unpay]");
        if (un && await confirmDialog({ title: "¿Anular este pago?", text: "Se borra el pago y la cuota vuelve a como estaba antes de registrarlo.", ok: "Anular pago", danger: true })) {
          S.api.deletePayment(un.dataset.unpay); toast("Pago anulado"); refresh();
        }
        if (a === "due") dueSheet(m);
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
  const cur = m.fee?.planId || S.db.plans[0]?.id;
  const st = S.feeStatus(m);
  const day0 = new Date(); day0.setHours(12, 0, 0, 0);
  const canChain = m.fee?.dueAt && st.state !== "late" && st.state !== "none";
  const plusMonths = (t, n) => { const d = new Date(t); d.setMonth(d.getMonth() + n); return d.getTime(); };
  sheet({
    title: `Registrar pago`,
    html: `<form novalidate>
      <div class="mrow plain">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${m.fee ? `Cuota actual: ${esc(st.label)}${m.fee.dueAt ? ` · vence ${fmtDate(m.fee.dueAt)}` : ""}` : "Sin cuota cargada"}</small></span></div>
      ${field({ label: "Plan", name: "plan", value: cur, options: S.db.plans.map((p) => [p.id, `${p.name} · ${money(p.price)}`]) })}
      <div class="grid2">${field({ label: "Meses que paga", name: "months", value: 1, options: [1, 2, 3, 6, 12].map((n) => [n, plural(n, "mes", "meses")]) })}${field({ label: "Monto cobrado", name: "amount", type: "number", value: S.plan(cur)?.price || "", attrs: 'inputmode="numeric" min="0"' })}</div>
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
      const draw = () => { const { d, from, to } = calc(); pv.innerHTML = `<span>Cubre del <b>${fmtDate(from)}</b> al <b>${fmtDate(to, { year: true })}</b></span><span>Nuevo vencimiento: <b>${fmtDate(to, { year: true })}</b> · ${money(+d.amount || 0)}</span>`; };
      const sync = () => { const d = formData(f); f.amount.value = (S.plan(d.plan)?.price || 0) * +d.months; draw(); };
      f.plan.addEventListener("change", sync); f.months.addEventListener("change", sync);
      f.addEventListener("input", draw); f.addEventListener("change", draw);
      draw();
      let sent = false;
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        if (sent) return;                         /* evita registrar dos veces con un doble toque */
        sent = true; $("button[type=submit]", f).disabled = true;
        const { d, from } = calc();
        S.api.registerPayment(m.id, { planId: d.plan, months: +d.months, amount: +d.amount || 0, by: me().id, from });
        close(); toast(`Pago registrado. Vence el ${fmtDate(S.user(m.id).fee.dueAt)}`);
        onDone ? onDone() : refresh();
      });
    },
  });
}

function dueSheet(m) {
  const v = m.fee?.dueAt ? dayKey(m.fee.dueAt) : dayKey(Date.now() + 30 * DAY);
  sheet({
    title: "Cambiar vencimiento",
    html: `<form novalidate>${field({ label: "Vence el", name: "due", type: "date", value: v, req: true })}${field({ label: "Plan", name: "plan", value: m.fee?.planId, options: S.db.plans.map((p) => [p.id, p.name]) })}<button class="btn primary block" type="submit">Guardar</button></form>`,
    onMount(b, close) {
      $("form", b).addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(e.target);
        const [y, mo, da] = d.due.split("-").map(Number);
        S.api.setDue(m.id, new Date(y, mo - 1, da, 12).getTime(), d.plan);
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
  const act = S.activeMembers();
  const by = { ok: [], soon: [], late: [], none: [] };
  act.forEach((m) => by[S.feeStatus(m).state].push(m));
  const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
  const cobrado = S.db.payments.filter((p) => p.at >= m0.getTime()).reduce((a, p) => a + p.amount, 0);
  let list = f ? by[f] || [] : act;
  list = list.slice().sort((a, b) => (a.fee?.dueAt || 0) - (b.fee?.dueAt || 0));
  const chips = [["", "Todos", act.length], ["late", "Vencidas", by.late.length], ["soon", "Por vencer", by.soon.length], ["ok", "Al día", by.ok.length], ["none", "Sin cuota", by.none.length]];
  return {
    layout: "panel", nav: "cuotas", title: "Cuotas",
    html: `${pageHead({ title: "Cuotas", actions: isAdmin() ? `<button class="btn ghost sm" type="button" data-act="plans">${icon("settings", "sm")} Planes y precios</button>` : "" })}
      <section class="kpis">
        <div class="kpi"><b>${by.ok.length}</b><small>al día</small></div>
        <div class="kpi warn"><b>${by.soon.length}</b><small>vencen en ${S.db.gym.reminderDays} días</small></div>
        <div class="kpi bad"><b>${by.late.length}</b><small>vencidas</small></div>
        <div class="kpi"><b>${money(cobrado)}</b><small>cobrado este mes</small></div>
      </section>
      <p class="muted lead">El socio ve en la app cuándo vence su cuota y recibe el aviso ${S.db.gym.reminderDays} días antes.</p>
      <div class="chips-scroll">${chips.map(([k, l, n]) => `<a class="chip ${k === f ? "on" : ""}" href="#/panel/cuotas${k ? "?f=" + k : ""}">${l} <b>${n}</b></a>`).join("")}</div>
      <div class="mlist">${list.map((m) => {
        const st = S.feeStatus(m);
        const msg = st.state === "late" ? `Hola ${firstName(m.name)}! Te escribimos de Vientos: tu cuota venció el ${fmtDate(m.fee.dueAt)}. ¿Pasás a regularizarla? 💪` : `Hola ${firstName(m.name)}! Te recordamos que tu cuota de Vientos vence el ${m.fee ? fmtDate(m.fee.dueAt) : ""}.`;
        return `<div class="mrow">${avatar(m, "sm")}<span><b>${esc(m.name)}</b><small>${esc(S.plan(m.fee?.planId)?.name || "Sin plan")}${m.fee ? " · vence " + fmtDate(m.fee.dueAt) : ""}</small></span>
          ${feePill(m)}
          ${(st.state === "late" || st.state === "soon") && m.phone ? `<a class="icon-btn" href="https://wa.me/${waNumber(m.phone)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" aria-label="Recordar por WhatsApp a ${esc(m.name)}">${icon("whatsapp", "sm")}</a>` : ""}
          <button class="btn ghost sm" type="button" data-pay="${m.id}">Cobrar</button></div>`;
      }).join("") || empty("card", "No hay socios en esta lista")}</div>`,
    mount(host) {
      host.addEventListener("click", (e) => {
        const p = e.target.closest("[data-pay]");
        if (p) paySheet(S.user(p.dataset.pay));
        if (e.target.closest("[data-act=plans]")) plansSheet();
      });
    },
  };
}

function plansSheet() {
  const row = (p) => `<div class="planrow" data-id="${esc(p.id)}"><input type="text" name="pn" value="${esc(p.name)}" aria-label="Nombre del plan"><label class="money"><span>$</span><input type="number" name="pp" value="${p.price}" min="0" inputmode="numeric" aria-label="Precio"></label><button type="button" class="icon-btn sm" data-del aria-label="Quitar plan">${icon("trash", "sm")}</button></div>`;
  sheet({
    title: "Planes y precios",
    html: `<form novalidate><div data-rows>${S.db.plans.map(row).join("")}</div>
      <button type="button" class="btn ghost sm" data-add>${icon("plus", "sm")} Agregar plan</button>
      ${field({ label: "Avisar al socio antes del vencimiento", name: "rd", value: S.db.gym.reminderDays, options: [3, 5, 7, 10].map((n) => [n, plural(n, "día", "días")]) })}
      <button class="btn primary block" type="submit">Guardar</button></form>`,
    onMount(b, close) {
      const rows = $("[data-rows]", b);
      b.addEventListener("click", (e) => {
        if (e.target.closest("[data-add]")) rows.insertAdjacentHTML("beforeend", row({ id: "p-" + Date.now().toString(36), name: "", price: 0 }));
        const d = e.target.closest("[data-del]");
        if (d) d.closest(".planrow").remove();
      });
      $("form", b).addEventListener("submit", (e) => {
        e.preventDefault();
        const plans = $$(".planrow", b).map((r) => ({ id: r.dataset.id, name: r.querySelector("[name=pn]").value.trim(), price: +r.querySelector("[name=pp]").value || 0 })).filter((p) => p.name);
        if (!plans.length) return toast("Tiene que haber al menos un plan.", "err");
        S.api.savePlans(plans);
        S.api.saveGym({ reminderDays: +formData(e.target).rd });
        close(); toast("Planes guardados"); refresh();
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
      <section class="sec">${S.db.notices.map((n) => `<article class="notice"><span class="notice-d">${esc(relDay(n.at))}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><button class="icon-btn sm" type="button" data-del="${n.id}" aria-label="Borrar aviso">${icon("trash", "sm")}</button></article>`).join("") || empty("bell", "No hay avisos publicados")}</section>`,
    mount(host) {
      $("form", host).addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(e.target);
        if (!d.title.trim()) return toast("Escribí un título.", "err");
        S.api.addNotice({ title: d.title.trim(), body: d.body.trim(), by: me().id });
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
  const g = S.db.gym;
  const team = S.db.users.filter((u) => u.role !== "socio" && u.status === "activo");
  return {
    layout: "panel", nav: "gimnasio", title: "Gimnasio",
    html: `${pageHead({ title: "Datos del gimnasio" })}
      <div class="pgrid">
        <form class="card" data-gym novalidate>
          <div class="card-h"><h2>${icon("pin", "sm")} Contacto</h2></div>
          ${field({ label: "Nombre", name: "name", value: g.name, req: true })}
          <div class="grid2">${field({ label: "Dirección", name: "address", value: g.address })}${field({ label: "Ciudad", name: "city", value: g.city })}</div>
          <div class="grid2">${field({ label: "WhatsApp", name: "whatsapp", type: "tel", value: g.whatsapp })}${field({ label: "Instagram (usuario)", name: "instagram", value: g.instagram })}</div>
          <label class="toggle"><span><b>Permitir que se registren solos desde la app</b><small>Apagado (recomendado): los socios los da de alta recepción o el profe al pagar.</small></span><input type="checkbox" name="selfSignup" ${g.selfSignup ? "checked" : ""} role="switch"><i aria-hidden="true"></i></label>
          ${field({ label: "Código para registrarse solos", name: "joinCode", value: g.joinCode, hint: "Solo se usa si el registro desde la app está permitido." })}
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
        S.api.saveGym({ name: d.name.trim(), address: d.address, city: d.city, whatsapp: d.whatsapp, instagram: d.instagram.replace(/^@/, ""), joinCode: d.joinCode.trim() || g.joinCode, selfSignup: !!d.selfSignup, open });
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
          const c = await S.api.createCoach({ name: d.fullname, email: d.email, phone: d.phone, pass, role });
          close(); refresh();
          setTimeout(() => credentialsSheet(c, pass, adm ? "Administrador creado" : "Profe creado"), 300);
        } catch (e2) { err.textContent = e2.message; err.hidden = false; }
      });
    },
  });
}

/* ------------------------------------------------------------- QR y "más" */
export function qrView() {
  const g = S.db.gym, url = installUrl();
  return {
    layout: "panel", nav: "qr", title: "QR de la app",
    html: `${pageHead({ title: "QR de la app", actions: `<button class="btn primary sm" type="button" data-print>${icon("print", "sm")} Imprimir</button>` })}
      <p class="muted lead">Imprimilo y ponelo en recepción. El socio lo escanea <b>una sola vez</b> para instalar la app; después entra desde el ícono.</p>
      <article class="poster" id="poster">
        <div class="poster-logo">${logo()}</div>
        <h2>Tu rutina,<br><b>en tu celular</b></h2>
        <div class="poster-qr" data-qr></div>
        <ol class="poster-steps"><li>Escaneá el código con la cámara</li><li>Instalá la app (es gratis)</li><li>Creá tu cuenta con el código <b>${esc(g.joinCode)}</b></li></ol>
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
    ...(isAdmin() ? [["#/panel/gimnasio", "settings", "Datos del gimnasio y equipo"]] : []),
    ["#/panel/qr", "qr", "QR de la app"], ["#/panel/cuenta", "user", "Mi cuenta"],
  ];
  return {
    layout: "panel", nav: "mas", title: "Más",
    html: `${pageHead({ title: "Más" })}<section class="card">${items.map(([h, i, l]) => `<a class="lrow" href="${h}">${icon(i, "sm")}<span>${l}</span>${icon("right", "sm")}</a>`).join("")}
      <button class="lrow" type="button" data-out>${icon("logout", "sm")}<span>Cerrar sesión</span>${icon("right", "sm")}</button></section>`,
    mount(host) { $("[data-out]", host).addEventListener("click", async () => { await logout(); go("/ingresar", { replace: true }); }); },
  };
}


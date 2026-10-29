/* Opiniones de los socios: calificación del 1 al 10 por rubro (una por mes, se puede corregir)
   y sugerencias o reclamos. Las lee SOLO el dueño, que puede marcarlas como resueltas y responder. */
import { icon } from "../core/icons.js";
import { esc, fmtDate, relDay, plural, $, $$ } from "../core/util.js";
import * as S from "../core/store.js";
import { me } from "../core/auth.js";
import { go, refresh } from "../core/router.js";
import { field, formData, toast, sheet, pageHead, empty, avatar } from "../core/ui.js";

const mkey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}`; };
const STATUS = { nuevo: "Recibido", visto: "Lo leyó el dueño", resuelto: "Resuelto" };
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const fmt1 = (n) => (n === null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/* ------------------------------------------------------------------ socio */
export function opinionView() {
  if (S.db.off?.opiniones) return go("/inicio", { replace: true });
  const u = me();
  const mine = (S.db.feedback || []).filter((f) => f.userId === u.id).sort((a, b) => b.at - a.at);
  const rated = mine.find((f) => f.kind === "puntaje" && mkey(f.at) === mkey(Date.now()));
  const msgs = mine.filter((f) => f.kind !== "puntaje");
  const scale = (key, val) => `<div class="rate" role="radiogroup" data-key="${key}">${Array.from({ length: 10 }, (_, i) => `<button type="button" role="radio" aria-checked="${val === i + 1}" class="${val === i + 1 ? "on" : ""}" data-v="${i + 1}">${i + 1}</button>`).join("")}</div>`;
  return {
    title: "Tu opinión",
    html: `${pageHead({ back: "#/perfil", kicker: S.gymOf(S.spaceOf(u)).name, title: "Tu opinión" })}
      <p class="muted">Lo que escribas acá lo lee solo el dueño del gimnasio. Nos ayuda a mejorar.</p>
      <section class="card">
        <div class="card-h"><h2>${icon("trophy", "sm")} Calificá el gimnasio</h2>${rated ? `<span class="pill">Ya calificaste este mes</span>` : ""}</div>
        <p class="muted tiny">Del 1 (muy mal) al 10 (excelente). Podés calificar una vez por mes y cambiarlo cuando quieras.</p>
        <form data-rate novalidate>
          ${S.RATE_CATS.map(([k, label]) => `<div class="rate-row"><span>${esc(label)}</span>${scale(k, rated?.scores?.[k])}</div>`).join("")}
          ${field({ label: "¿Querés agregar algo? (opcional)", name: "text", type: "textarea", value: rated?.text || "", ph: "Ej: las bicis de ciclo están muy bien" })}
          <p class="form-err" role="alert" hidden></p>
          <button class="btn primary block" type="submit">${icon("check", "sm")} ${rated ? "Guardar los cambios" : "Enviar calificación"}</button>
        </form>
      </section>
      <section class="card">
        <div class="card-h"><h2>${icon("chat", "sm")} Sugerencia o reclamo</h2></div>
        <form data-msg novalidate>
          <div class="seg" role="radiogroup"><label><input type="radio" name="kind" value="sugerencia" checked><span>${icon("bolt", "xs")} Sugerencia</span></label><label><input type="radio" name="kind" value="reclamo"><span>${icon("alert", "xs")} Reclamo</span></label></div>
          ${field({ label: "Contanos", name: "text", type: "textarea", ph: "Ej: estaría bueno tener más horarios de ciclo a la noche", req: true })}
          <p class="form-err" role="alert" hidden></p>
          <button class="btn primary block" type="submit">${icon("send", "sm")} Enviar</button>
        </form>
      </section>
      ${msgs.length ? `<section class="card"><div class="card-h"><h2>Lo que enviaste</h2></div>
        ${msgs.map((f) => `<div class="fb-item"><div class="fb-top"><span class="pill ${f.kind === "reclamo" ? "red" : ""}">${f.kind === "reclamo" ? "Reclamo" : "Sugerencia"}</span><small class="muted">${esc(relDay(f.at))} · ${esc(STATUS[f.status] || STATUS.nuevo)}</small></div>
          <p>${esc(f.text)}</p>${f.reply ? `<div class="fb-reply"><b>Respuesta del gimnasio</b><p>${esc(f.reply)}</p></div>` : ""}</div>`).join("")}</section>` : ""}`,
    mount(host) {
      const scores = { ...(rated?.scores || {}) };
      $$(".rate", host).forEach((g) => g.addEventListener("click", (e) => {
        const b = e.target.closest("[data-v]"); if (!b) return;
        scores[g.dataset.key] = +b.dataset.v;
        $$("button", g).forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
      }));
      $("[data-rate]", host).addEventListener("submit", (e) => {
        e.preventDefault();
        const err = $(".form-err", e.target);
        if (Object.keys(scores).length < S.RATE_CATS.length) { err.textContent = "Calificá todos los rubros (tocá un número en cada uno)."; err.hidden = false; return; }
        const text = formData(e.target).text?.trim() || "";
        S.api.saveFeedback(rated ? { ...rated, scores, text } : { userId: u.id, kind: "puntaje", scores, text });
        toast("¡Gracias! Tu calificación le llegó al dueño"); refresh();
      });
      $("[data-msg]", host).addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(e.target), err = $(".form-err", e.target);
        if (!d.text?.trim()) { err.textContent = "Escribí tu mensaje."; err.hidden = false; return; }
        S.api.saveFeedback({ userId: u.id, kind: d.kind === "reclamo" ? "reclamo" : "sugerencia", text: d.text.trim(), status: "nuevo" });
        toast("Enviado. Lo lee el dueño del gimnasio"); refresh();
      });
    },
  };
}

/* Resumen de puntajes: promedios por rubro de los últimos 3 meses */
export function ratingSummary(list = S.feedbackOf()) {
  const since = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).getTime();
  const r = list.filter((f) => f.kind === "puntaje" && f.at >= since);
  const cats = S.RATE_CATS.map(([k, label]) => ({ k, label, n: avg(r.map((f) => f.scores?.[k]).filter(Boolean)) }));
  const all = avg(cats.map((c) => c.n).filter((x) => x !== null));
  return { count: r.length, cats, all };
}

/* ------------------------------------------------------------------ dueño */
export function opinionesView(params, query = {}) {
  if (me()?.role !== "admin" || S.db.off?.opiniones) return go("/panel", { replace: true });
  const f = query.f || "";
  const list = S.feedbackOf();
  const msgs = list.filter((x) => x.kind !== "puntaje").sort((a, b) => b.at - a.at);
  const open = msgs.filter((x) => x.status !== "resuelto");
  const shown = msgs.filter((x) => (f === "reclamo" || f === "sugerencia" ? x.kind === f : f === "abiertos" ? x.status !== "resuelto" : true));
  const sum = ratingSummary(list);
  const comments = list.filter((x) => x.kind === "puntaje" && x.text).sort((a, b) => b.at - a.at).slice(0, 10);
  const bar = (c) => `<div class="hb-row"><span class="hb-l">${esc(c.label)}</span><span class="hb-t"><i style="width:${c.n ? c.n * 10 : 0}%"></i></span><span class="hb-v"><b>${fmt1(c.n)}</b><em>de 10</em></span></div>`;
  const CHIPS = [["", "Todos", msgs.length], ["abiertos", "Sin resolver", open.length], ["reclamo", "Reclamos", msgs.filter((x) => x.kind === "reclamo").length], ["sugerencia", "Sugerencias", msgs.filter((x) => x.kind === "sugerencia").length]];
  return {
    layout: "panel", nav: "opiniones", title: "Opiniones",
    html: `${pageHead({ title: "Opiniones de los socios", kicker: "Solo lo ve el dueño" })}
      <section class="kpis">
        <div class="kpi"><b>${fmt1(sum.all)}</b><small>nota promedio (de 10)</small><em class="kpi-sub">últimos 3 meses</em></div>
        <div class="kpi"><b>${sum.count}</b><small>calificaciones</small><em class="kpi-sub">últimos 3 meses</em></div>
        <a class="kpi ${open.filter((x) => x.kind === "reclamo").length ? "bad" : ""}" href="#/panel/opiniones?f=abiertos"><b>${open.filter((x) => x.kind === "reclamo").length}</b><small>reclamos sin resolver</small></a>
        <a class="kpi" href="#/panel/opiniones?f=sugerencia"><b>${open.filter((x) => x.kind === "sugerencia").length}</b><small>sugerencias sin resolver</small></a>
      </section>
      <div class="pgrid">
        <section class="card"><div class="card-h"><h2>${icon("trophy", "sm")} Nota por rubro</h2><span class="muted">promedio, últimos 3 meses</span></div>
          ${sum.count ? `<div class="hb">${sum.cats.map(bar).join("")}</div><p class="muted tiny">Cada socio califica del 1 al 10 una vez por mes. Lo más bajo es lo primero para mejorar.</p>` : `<p class="muted">Todavía nadie calificó.</p>`}</section>
        <section class="card"><div class="card-h"><h2>${icon("note", "sm")} Comentarios de las calificaciones</h2></div>
          ${comments.map((x) => { const u = S.user(x.userId); return `<div class="fb-item"><div class="fb-top"><b>${esc(u?.name || "Socio")}</b><small class="muted">${esc(relDay(x.at))}</small></div><p>${esc(x.text)}</p></div>`; }).join("") || `<p class="muted">Sin comentarios todavía.</p>`}</section>
      </div>
      <section class="card"><div class="card-h"><h2>${icon("chat", "sm")} Sugerencias y reclamos</h2></div>
        <div class="chips-scroll">${CHIPS.map(([k, l, n]) => `<a class="chip ${k === f ? "on" : ""}" href="#/panel/opiniones${k ? "?f=" + k : ""}">${l} <b>${n}</b></a>`).join("")}</div>
        ${shown.map((x) => { const u = S.user(x.userId); return `<div class="fb-item ${x.status === "resuelto" ? "done" : ""}">
          <div class="fb-top">${avatar(u, "sm")}<span><b>${esc(u?.name || "Socio")}</b><small class="muted">${esc(fmtDate(x.at))} · ${esc(relDay(x.at))}</small></span>
            <span class="pill ${x.kind === "reclamo" ? "red" : ""}">${x.kind === "reclamo" ? "Reclamo" : "Sugerencia"}</span></div>
          <p>${esc(x.text)}</p>
          ${x.reply ? `<div class="fb-reply"><b>Tu respuesta</b><p>${esc(x.reply)}</p></div>` : ""}
          <div class="row-btns"><button class="btn ghost sm" type="button" data-reply="${esc(x.id)}">${icon("send", "sm")} ${x.reply ? "Cambiar respuesta" : "Responder"}</button>
            ${x.status === "resuelto" ? `<button class="btn ghost sm" type="button" data-st="${esc(x.id)}" data-to="visto">Reabrir</button>` : `<button class="btn primary sm" type="button" data-st="${esc(x.id)}" data-to="resuelto">${icon("check", "sm")} Marcar resuelto</button>`}</div>
        </div>`; }).join("") || empty("chat", "No hay mensajes con este filtro")}
      </section>`,
    mount(host) {
      /* lo que el dueño ya vio deja de figurar como nuevo para el socio */
      msgs.filter((x) => !x.status || x.status === "nuevo").forEach((x) => S.api.saveFeedback({ ...x, status: "visto" }));
      host.addEventListener("click", (e) => {
        const st = e.target.closest("[data-st]");
        if (st) { const x = list.find((y) => y.id === st.dataset.st); S.api.saveFeedback({ ...x, status: st.dataset.to }); toast(st.dataset.to === "resuelto" ? "Marcado como resuelto" : "Reabierto"); refresh(); }
        const rp = e.target.closest("[data-reply]");
        if (rp) { const x = list.find((y) => y.id === rp.dataset.reply); replySheet(x); }
      });
    },
  };
}

function replySheet(x) {
  const u = S.user(x.userId);
  sheet({
    title: `Responder a ${u?.name || "socio"}`,
    html: `<form novalidate><p class="muted">“${esc(x.text)}”</p>
      ${field({ label: "Tu respuesta (la ve el socio en la app)", name: "reply", type: "textarea", value: x.reply || "", req: true })}
      <div class="row-btns"><button class="btn primary block" type="submit">${icon("send", "sm")} Enviar respuesta</button></div></form>`,
    onMount(b, close) {
      $("form", b).addEventListener("submit", (e) => {
        e.preventDefault();
        const reply = formData(e.target).reply?.trim();
        if (!reply) return;
        S.api.saveFeedback({ ...x, reply, status: x.status === "resuelto" ? "resuelto" : "visto" });
        close(); toast("Respuesta enviada"); refresh();
      });
    },
  });
}

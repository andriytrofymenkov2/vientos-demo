/* Inicio del socio */
import { icon, logo, WAVES } from "../core/icons.js";
import { esc, fmtWeekday, greeting, firstName, waNumber, telHref, fmtDate, weekStart, dayKey, DAY, relDay, countUp, $$ } from "../core/util.js";
import * as S from "../core/store.js";
import { me } from "../core/auth.js";
import { avatar, spaceLogo } from "../core/ui.js";
import { platform } from "./install.js";

const WL = ["L", "M", "M", "J", "V", "S", "D"];

export function homeView() {
  const u = me(), sp = S.spaceOf(u), fz = sp === "fitz", g = S.gymOf(sp);
  S.api.closeStale(u.id);
  const r = S.activeRoutine(u.id);
  const live = S.session(u.id);
  const liveDay = live && S.routine(live.routineId)?.days.find((d) => d.id === live.dayId);
  const plan = S.todayPlan(u.id), next = plan?.day || null;
  const coach = S.user(u.coachId);
  const fee = S.feeStatus(u);
  const logs = S.logsOf(u.id);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const month = logs.filter((l) => l.at >= monthStart.getTime()).length;
  const streak = S.streakWeeks(u.id);
  const trained = S.trainedDays(u.id);
  const w0 = weekStart();
  const todayKey = dayKey();
  const week = WL.map((l, i) => {
    const k = dayKey(w0 + i * DAY);
    return `<span class="wk ${trained.has(k) ? "on" : ""} ${k === todayKey ? "is-today" : ""}"><small>${k === todayKey ? "Hoy" : l}</small><i>${trained.has(k) ? "" : new Date(w0 + i * DAY).getDate()}</i></span>`;
  }).join("");
  const thisWeek = WL.filter((_, i) => trained.has(dayKey(w0 + i * DAY))).length;
  const open = S.openNow(g.open);
  const wa = waNumber(g.whatsapp || coach?.phone || "");
  const p = S.plan(u.fee?.planId);

  /* Tarjeta principal: lo que toca hoy */
  let todayCard;
  if (live && liveDay) {
    const st = S.dayStats(liveDay);
    const doneSets = Object.values(live.sets).flat().filter((x) => x?.done).length;
    todayCard = `<a class="today live" href="#/rutina/${live.routineId}/dia/${live.dayId}">
      <span class="kicker">${icon("bolt", "xs")} Entrenamiento en curso</span>
      <h2>${esc(liveDay.focus || liveDay.name)}</h2>
      <div class="bar"><i style="width:${Math.min(100, (doneSets / st.sets) * 100)}%"></i></div>
      <span class="today-cta">Continuar · ${doneSets}/${st.sets} series ${icon("arrow")}</span>${WAVES}</a>`;
  } else if (r && next) {
    const st = S.dayStats(next);
    todayCard = `<a class="today" href="#/rutina/${r.id}/dia/${next.id}">
      <span class="kicker">${plan.today ? "Hoy te toca" : plan.inDays === 1 ? "Hoy descansás · mañana te toca" : `Hoy descansás · el ${S.WEEKDAYS[plan.wd]} te toca`}</span>
      <h2>${esc(next.focus || next.name)}</h2>
      <span class="today-meta">${icon("dumbbell", "xs")} ${st.ex} ejercicios <i></i> ${icon("clock", "xs")} ${st.min} min <i></i> ${st.sets} series</span>
      <span class="today-cta">Ver el día ${icon("arrow")}</span>${WAVES}</a>`;
  } else {
    todayCard = `<div class="today empty-t"><span class="kicker">Mi rutina</span><h2>Tu profe te está armando la rutina</h2><span class="today-meta">Te avisamos apenas esté lista.</span>${WAVES}</div>`;
  }

  const feeCard = fee.state === "soon" || fee.state === "late" ? `<div class="feecard ${fee.state}">
      ${icon(fee.state === "late" ? "alert" : "card")}
      <div><b>${fee.state === "late" ? "Tu cuota está vencida" : `Tu cuota ${fee.days === 0 ? "vence hoy" : `vence en ${fee.days} ${fee.days === 1 ? "día" : "días"}`}`}</b>
      <small>${esc(p?.name || "Cuota mensual")} · ${u.fee.unpaid ? "desde el " : ""}${fmtDate(u.fee.dueAt)}</small></div>
      <a class="btn sm ${fee.state === "late" ? "primary" : "ghost"}" href="https://wa.me/${wa}?text=${encodeURIComponent(`Hola! Soy ${u.name}, les aviso que pagué la cuota.`)}" target="_blank" rel="noopener">Avisar pago</a>
    </div>` : "";

  const notices = S.noticesOf(sp).slice(0, 2).map((n) => `<article class="notice"><span class="notice-d">${relDay(n.at)}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`).join("");

  return {
    title: "Inicio", nav: "inicio",
    html: `<header class="mtop"><a class="mtop-logo ${fz ? "is-fitz" : ""}" href="#/inicio" aria-label="${esc(g.name)}">${spaceLogo(sp)}</a><span class="mtop-a">${S.MODE === "supabase" ? `<button class="icon-btn" type="button" data-sync aria-label="Actualizar">${icon("repeat")}</button>` : ""}<a href="#/perfil" aria-label="Mi perfil">${avatar(u, "sm")}</a></span></header>
    <section class="hello">
      <span class="kicker">${esc(fmtDate(Date.now()))}</span>
      <h1>${greeting()},<br><b>${esc(firstName(u.name))}</b></h1>
    </section>
    ${todayCard}
    ${installBanner()}
    ${feeCard}
    <section class="weekcard">
      <div class="weekcard-h"><h2>Esta semana</h2><span>Hoy es <em>${fmtWeekday(Date.now())} ${new Date().getDate()}</em></span></div>
      <div class="week">${week}</div>
      <div class="stats3">
        <div><b data-count="${month}">0</b><small>en ${new Date().toLocaleDateString("es-AR", { month: "long" })}</small></div>
        <div><span class="st-n">${streak >= 2 ? icon("flame", "sm") : ""}<b data-count="${streak}">0</b></span><small>${streak === 1 ? "semana seguida" : "semanas seguidas"}</small></div>
        <div><b>${logs[0] ? esc(relDay(logs[0].at)) : "—"}</b><small>último</small></div>
      </div>
    </section>
    ${notices ? `<section class="sec"><h2 class="sec-t">Novedades de ${fz ? "Fitz Club" : "Vientos"}</h2>${notices}</section>` : ""}
    ${coach ? `<section class="sec"><h2 class="sec-t">Tu profe</h2>
      <div class="coach">${avatar(coach, "lg")}<div><b>${esc(coach.name)}</b><small>Entrenador · ${esc(g.name)}</small></div>
        <div class="coach-a"><a class="round" href="${telHref(coach.phone)}" aria-label="Llamar a ${esc(coach.name)}">${icon("phone")}</a><a class="round wa" href="https://wa.me/${waNumber(coach.phone)}?text=${encodeURIComponent(`Hola ${firstName(coach.name)}! Soy ${u.name}.`)}" target="_blank" rel="noopener" aria-label="WhatsApp a ${esc(coach.name)}">${icon("whatsapp")}</a></div>
      </div></section>` : ""}
    <section class="sec gymcard">
      <div class="gym-photo ${fz ? "no-photo" : ""}">${fz ? spaceLogo(sp) : `<img src="img/fachada.jpg" alt="Fachada de Vientos GYM" loading="lazy">`}<span class="open-pill ${open.open ? "on" : ""}"><i></i>${esc(open.label)}</span></div>
      <div class="gym-b">
        <h2>${esc(g.name)}</h2>
        <p class="muted">${esc(g.address)} · ${esc(g.city)}</p>
        <div class="gym-a">
          <a class="btn ghost sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${g.address}, ${g.city}`)}" target="_blank" rel="noopener">${icon("pin", "sm")} Cómo llegar</a>
          ${g.whatsapp ? `<a class="btn ghost sm" href="https://wa.me/${wa}" target="_blank" rel="noopener">${icon("whatsapp", "sm")} WhatsApp</a>` : ""}
          ${g.instagram ? `<a class="btn ghost sm" href="https://www.instagram.com/${esc(g.instagram)}/" target="_blank" rel="noopener">${icon("instagram", "sm")} Instagram</a>` : ""}
        </div>
        <dl class="hours">${S.hoursList(g.open).map((h) => `<div class="${h.days.includes(new Date().getDay()) ? "now" : ""}"><dt>${esc(h.d)}</dt><dd>${esc(h.h)}</dd></div>`).join("")}</dl>
      </div>
    </section>
    <p class="foot-note">${fz ? "" : `${icon("wind", "xs")} `}${esc(g.name)} · Río Gallegos</p>`,
    mount(host) {
      $$("[data-count]", host).forEach((el) => countUp(el, +el.dataset.count));
      host.querySelector("[data-sync]")?.addEventListener("click", async (e) => {
        e.currentTarget.classList.add("spin");
        await window.__vientosSync?.(true);
      });
      host.querySelector("[data-insthide]")?.addEventListener("click", (e) => {
        try { localStorage.setItem("vientos_inst_hide", String(Date.now() + 7 * 864e5)); } catch { /* sin almacenamiento */ }
        e.currentTarget.parentElement.remove();
      });
    },
  };
}

/* En el celular, si todavía usa la app desde el navegador, le recuerda instalarla */
function installBanner() {
  const p = platform();
  let hidden = false;
  try { hidden = Date.now() < +(localStorage.getItem("vientos_inst_hide") || 0); } catch { /* sin almacenamiento */ }
  if (!p.mobile || p.standalone || hidden) return "";
  return `<div class="inst-banner">${icon("download")}<div><b>Instalá la app en tu ${p.ios ? "iPhone" : "celular"}</b><small>Entrás más rápido, a pantalla completa.</small></div>
    <a class="btn sm primary" href="#/instalar">Ver cómo</a>
    <button class="icon-btn" type="button" aria-label="Ahora no" data-insthide>${icon("x", "sm")}</button></div>`;
}

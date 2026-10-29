/* Perfil del socio (y cuenta del profe): datos, cuota, preferencias y seguridad */
import { icon } from "../core/icons.js";
import { esc, fmtDate, $ } from "../core/util.js";
import * as S from "../core/store.js";
import { me, logout, remembered, setRemember, passwordIssues, isStaff } from "../core/auth.js";
import { go, refresh } from "../core/router.js";
import { appVersion, forceUpdate } from "../core/update.js";
import { avatar, field, dateField, formData, toast, sheet, applyTheme, feePill, pageHead } from "../core/ui.js";
import { platform } from "./install.js";

const toggle = (name, label, on, hint = "") => `<label class="toggle"><span><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ""}</span><input type="checkbox" name="${name}" ${on ? "checked" : ""} role="switch"><i aria-hidden="true"></i></label>`;

export function profileView(params, query = {}) {
  const u = me(), staff = isStaff();
  const p = S.plan(u.fee?.planId);
  const g = S.gymOf(S.spaceOf(u));
  return {
    title: "Perfil", nav: staff ? "" : "perfil", layout: staff ? "panel" : "app",
    html: `${staff ? pageHead({ back: "#/panel/mas", title: "Mi cuenta" }) : ""}
      <section class="pro-head">${avatar(u, "xl")}<div><h1>${esc(u.name)}</h1><p class="muted">${staff ? (u.role === "admin" ? "Administración" : "Entrenador") : `Socio desde ${fmtDate(u.joined, { year: true })}`}</p></div></section>
      ${!staff ? `<section class="card fee">
        <div class="card-h"><h2>${icon("card", "sm")} Mi cuota</h2>${feePill(u)}</div>
        ${u.fee ? `<dl class="kv"><div><dt>Plan</dt><dd>${esc(p?.name || "—")}</dd></div><div><dt>${u.fee.unpaid ? "Debe desde" : "Vence"}</dt><dd>${fmtDate(u.fee.dueAt, { year: true })}</dd></div></dl>` : `<p class="muted">Todavía no hay una cuota cargada.</p>`}
      </section>` : ""}
      <form class="card" data-form="info" novalidate>
        <div class="card-h"><h2>${icon("user", "sm")} Información personal</h2></div>
        ${staff ? field({ label: "Nombre y apellido", name: "fullname", value: u.name, req: true }) : `<dl class="kv">
          <div><dt>Nombre y apellido</dt><dd>${esc(u.name)}</dd></div>
          ${u.user ? `<div><dt>Usuario (DNI)</dt><dd>${esc(u.user)}</dd></div>` : ""}
          ${u.email && !/@sin-email\.vientos\.app$/.test(u.email) ? `<div><dt>Email</dt><dd>${esc(u.email)}</dd></div>` : ""}
        </dl>
        <p class="muted tiny">El nombre, el DNI y el email los corrige el gimnasio: si algo está mal, avisá en recepción.</p>`}
        ${field({ label: "Teléfono", name: "phone", type: "tel", value: u.phone })}
        <div class="grid2">
          ${dateField({ label: "Fecha de nacimiento", name: "birth", value: u.birth })}
          ${field({ label: "Género", name: "gender", value: u.gender, options: [["", "Prefiero no decir"], "Femenino", "Masculino", "No binario", "Otro"] })}
        </div>
        ${staff ? (S.MODE === "supabase" ? field({ label: "Email", name: "email", type: "email", value: /@sin-email\.vientos\.app$/.test(u.email) ? "" : u.email, attrs: "readonly", hint: "Para cambiar el email, pedilo al dueño." }) : field({ label: "Email", name: "email", type: "email", value: u.email, req: true })) : ""}
        <button class="btn primary" type="submit">Guardar cambios</button>
      </form>
      <section class="card" data-form="prefs">
        <div class="card-h"><h2>${icon("settings", "sm")} Preferencias</h2></div>
        ${toggle("dark", "Modo oscuro", (u.prefs?.theme || "dark") === "dark")}
        ${toggle("sound", "Sonido al terminar el descanso", u.prefs?.sound !== false, "El teléfono también vibra.")}
        ${toggle("remember", "Recordarme en este dispositivo", remembered(), "No te pide la contraseña cada vez que abrís la app.")}
      </section>
      ${!staff && !S.db.off?.opiniones ? `<section class="card"><a class="lrow" href="#/opinion">${icon("chat", "sm")}<span>Sugerencias, reclamos y calificar el gimnasio</span>${icon("right", "sm")}</a></section>` : ""}
      <section class="card">
        <div class="card-h"><h2>${icon("shield", "sm")} Seguridad</h2></div>
        <button class="lrow" type="button" data-act="pass">${icon("lock", "sm")}<span>Cambiar contraseña</span>${icon("right", "sm")}</button>
        ${platform().standalone ? "" : `<a class="lrow" href="#/instalar">${icon("download", "sm")}<span>Instalar la app en el celular</span>${icon("right", "sm")}</a>`}
        <button class="lrow" type="button" data-act="upd">${icon("repeat", "sm")}<span>Buscar actualización <small class="muted">· versión ${esc(appVersion() || "—")}</small></span>${icon("right", "sm")}</button>
        <button class="lrow" type="button" data-act="logout">${icon("logout", "sm")}<span>Cerrar sesión</span>${icon("right", "sm")}</button>
        ${!staff ? `<button class="lrow danger" type="button" data-act="delete">${icon("trash", "sm")}<span>Eliminar mi cuenta</span>${icon("right", "sm")}</button>` : ""}
      </section>
      <p class="foot-note">${esc(g.name)} · App de socios · versión ${esc(appVersion() || "—")}${S.MODE === "demo" ? " · demostración" : ""}</p>`,
    mount(host) {
      if (query.clave) setTimeout(() => changePassword(u), 250);
      $("[data-form=info]", host).addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(e.target);
        /* el socio cambia su teléfono, nacimiento y género; el nombre, el DNI y el email los corrige el gimnasio */
        if (staff && !d.fullname.trim()) return toast("Escribí tu nombre.", "err");
        const patch = { birth: d.birth, gender: d.gender, phone: d.phone, ...(staff ? { name: d.fullname.trim() } : {}) };
        /* Con servidor el email no se cambia desde acá; en la demostración es opcional */
        if (staff && S.MODE !== "supabase" && d.email?.trim()) {
          if (!/^\S+@\S+\.\S+$/.test(d.email)) return toast("Revisá el email.", "err");
          const other = S.findLogin(d.email);
          if (other && other.id !== u.id) return toast("Ese email ya lo usa otra cuenta.", "err");
          patch.email = d.email.trim().toLowerCase();
        }
        S.api.updateUser(u.id, patch);
        toast("Datos guardados");
        refresh();
      });
      $("[data-form=prefs]", host).addEventListener("change", (e) => {
        const n = e.target.name, on = e.target.checked;
        if (n === "dark") { S.api.updateUser(u.id, { prefs: { ...u.prefs, theme: on ? "dark" : "light" } }); applyTheme(on ? "dark" : "light"); }
        if (n === "sound") S.api.updateUser(u.id, { prefs: { ...u.prefs, sound: on } });
        if (n === "remember") { setRemember(on); toast(on ? "Te recordamos en este dispositivo" : "Vas a tener que ingresar cada vez"); }
      });
      host.addEventListener("click", (e) => {
        const a = e.target.closest("[data-act]")?.dataset.act;
        if (a === "logout") Promise.resolve(logout()).then(() => go("/ingresar", { replace: true }));
        if (a === "upd") forceUpdate().then((ok) => { if (!ok) toast("Sin conexión: probá cuando tengas señal.", "err"); });
        if (a === "pass") changePassword(u);
        if (a === "delete") deleteAccount(u);
      });
    },
  };
}

function changePassword(u) {
  sheet({
    title: "Cambiar contraseña",
    html: `<form novalidate>${field({ label: "Contraseña actual", name: "old", type: "password", req: true, attrs: 'autocomplete="current-password"' })}
      ${field({ label: "Contraseña nueva", name: "nw", type: "password", req: true, hint: "Mínimo 8 caracteres, con mayúsculas, minúsculas y números.", attrs: 'autocomplete="new-password"' })}
      <p class="form-err" role="alert" hidden></p><button class="btn primary block" type="submit">Guardar</button></form>`,
    onMount(b, close) {
      const f = $("form", b), err = $(".form-err", b);
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = formData(f);
        const issues = passwordIssues(d.nw);
        if (issues.length) { err.textContent = "La contraseña nueva necesita " + issues.join(", ") + "."; err.hidden = false; return; }
        try { await S.api.changePassword(u.id, d.old, d.nw); close(); toast("Contraseña actualizada"); }
        catch (e2) { err.textContent = e2.message; err.hidden = false; }
      });
    },
  });
}

function deleteAccount(u) {
  sheet({
    title: "Eliminar mi cuenta",
    html: `<p>Se borran tus datos personales, tus rutinas y tu historial de entrenamientos. <b>No se puede deshacer.</b></p>
      <p class="muted">Esto no da de baja tu cuota en el gimnasio: avisá en recepción si querés dejar de ir.</p>
      <form novalidate>${field({ label: 'Escribí "ELIMINAR" para confirmar', name: "ok", req: true, attrs: 'autocapitalize="characters" autocomplete="off"' })}
      <button class="btn danger block" type="submit">Eliminar definitivamente</button></form>`,
    onMount(b, close) {
      $("form", b).addEventListener("submit", async (e) => {
        e.preventDefault();
        if (formData(e.target).ok.trim().toUpperCase() !== "ELIMINAR") return toast('Escribí "ELIMINAR" para confirmar.', "err");
        close();
        try { await S.api.deleteAccount(u.id); } catch (err) { return toast(err.message, "err"); }
        await logout();
        toast("Tu cuenta fue eliminada");
        go("/ingresar", { replace: true });
      });
    },
  });
}

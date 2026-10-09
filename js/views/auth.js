/* Ingreso, alta de socio y recuperación de contraseña */
import { icon, logo } from "../core/icons.js";
import { esc, $, waNumber } from "../core/util.js";
import * as S from "../core/store.js";
import { login, passwordIssues } from "../core/auth.js";
import { go, homeOf } from "../core/router.js";
import { field, formData, applyTheme } from "../core/ui.js";
import { DEMO_ACCOUNTS, DEMO_PASS } from "../data/demo.js";

const hero = (sub) => `<div class="auth-hero"><img src="img/fachada.jpg" alt="" aria-hidden="true"><div class="auth-shade"></div>
  <div class="auth-brand">${logo()}<span class="auth-sub">${sub}</span></div></div>`;

const passField = (name = "pass", label = "Contraseña", auto = "current-password") => `<label class="field"><span>${label}</span>
  <div class="pass"><input name="${name}" type="password" required autocomplete="${auto}"><button class="icon-btn" type="button" data-eye aria-label="Mostrar contraseña">${icon("eye")}</button></div></label>`;

function wireEyes(host) {
  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-eye]");
    if (!b) return;
    const inp = b.previousElementSibling;
    const show = inp.type === "password";
    inp.type = show ? "text" : "password";
    b.innerHTML = icon(show ? "eyeoff" : "eye");
    b.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
  });
}

export function loginView() {
  return {
    layout: "auth", title: "Ingresar",
    html: `<div class="auth">${hero("Tu rutina, en tu bolsillo")}
      <form class="auth-card" novalidate>
        <h1>Ingresar</h1>
        ${field({ label: "Usuario o email", name: "ident", req: true, attrs: 'autocomplete="username" autocapitalize="none" spellcheck="false"' })}
        ${passField()}
        <label class="check"><input type="checkbox" name="remember" checked><span>Recordarme en este dispositivo</span></label>
        <p class="form-err" role="alert" hidden></p>
        <button class="btn primary block lg" type="submit">Ingresar ${icon("arrow")}</button>
        <div class="auth-links"><a href="#/recuperar">¿Olvidaste tu contraseña?</a><a href="#/registro">Soy nuevo · crear cuenta</a></div>
      </form>
      ${S.MODE === "demo" ? `<section class="demo-box" aria-label="Cuentas de demostración">
        <h2>${icon("info", "sm")} Probar la demostración</h2>
        <div class="demo-acc">${DEMO_ACCOUNTS.map((a) => `<button type="button" class="demo-btn" data-demo="${a.user}"><b>${a.label}</b><small>${esc(a.hint)}</small></button>`).join("")}</div>
        <p class="tiny muted">Datos ficticios guardados solo en este navegador. Contraseña de todas: ${DEMO_PASS}</p>
      </section>` : ""}
      <a class="auth-install" href="#/instalar">${icon("download", "sm")} Instalar la app en el celular</a>
    </div>`,
    mount(host) {
      wireEyes(host);
      const form = $("form", host), err = $(".form-err", host);
      const submit = async (ident, pass, remember) => {
        err.hidden = true;
        const btn = $("button[type=submit]", form);
        btn.disabled = true;
        try {
          const u = await login(ident, pass, remember);
          applyTheme(u.prefs?.theme);
          go(homeOf(), { replace: true });
        } catch (e2) {
          err.textContent = e2.message; err.hidden = false;
        } finally { btn.disabled = false; }
      };
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(form);
        if (!d.ident || !d.pass) { err.textContent = "Completá usuario y contraseña."; err.hidden = false; return; }
        submit(d.ident, d.pass, !!d.remember);
      });
      host.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", () => submit(b.dataset.demo, DEMO_PASS, true)));
    },
  };
}

export function registerView() {
  return {
    layout: "auth", title: "Crear cuenta",
    html: `<div class="auth">${hero("Sumate a la app de Vientos")}
      <form class="auth-card" novalidate>
        <a class="back-link" href="#/ingresar">${icon("back", "sm")} Volver</a>
        <h1>Crear cuenta</h1>
        <p class="muted">Completá tus datos. Un profe de Vientos aprueba tu cuenta y te asigna la rutina.</p>
        ${field({ label: "Nombre y apellido", name: "fullname", req: true, attrs: 'autocomplete="name"' })}
        ${field({ label: "Email", name: "email", type: "email", req: true, attrs: 'autocomplete="email" autocapitalize="none"' })}
        ${field({ label: "Teléfono", name: "phone", type: "tel", ph: "2966 …", attrs: 'autocomplete="tel"' })}
        ${passField("pass", "Contraseña", "new-password")}
        ${field({ label: "Código del gimnasio", name: "code", req: true, hint: "Lo encontrás en recepción, junto al QR.", attrs: 'autocapitalize="characters"' })}
        <p class="form-err" role="alert" hidden></p>
        <button class="btn primary block lg" type="submit">Enviar solicitud</button>
      </form>
    </div>`,
    mount(host) {
      wireEyes(host);
      const form = $("form", host), err = $(".form-err", host);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = formData(form);
        const fail = (m) => { err.textContent = m; err.hidden = false; };
        err.hidden = true;
        if (!d.fullname.trim() || d.fullname.trim().split(/\s+/).length < 2) return fail("Escribí tu nombre y apellido.");
        if (!/^\S+@\S+\.\S+$/.test(d.email)) return fail("Revisá el email.");
        const issues = passwordIssues(d.pass);
        if (issues.length) return fail("La contraseña necesita " + issues.join(", ") + ".");
        try {
          await S.api.register({ name: d.fullname, email: d.email, phone: d.phone, pass: d.pass, code: d.code });
          form.innerHTML = `<div class="done-msg">${icon("checkc")}<h1>¡Listo, ${esc(d.fullname.split(" ")[0])}!</h1><p class="muted">Tu solicitud llegó a Vientos. Cuando un profe la apruebe vas a poder ingresar con tu email y tu contraseña.</p><a class="btn primary block" href="#/ingresar">Volver al ingreso</a></div>`;
        } catch (e2) { fail(e2.message); }
      });
    },
  };
}

export function recoverView() {
  const g = S.db.gym;
  return {
    layout: "auth", title: "Recuperar contraseña",
    html: `<div class="auth">${hero("Recuperar el acceso")}
      <div class="auth-card">
        <a class="back-link" href="#/ingresar">${icon("back", "sm")} Volver</a>
        <h1>¿Olvidaste tu contraseña?</h1>
        <p class="muted">Pedile a tu profe o a recepción que te genere una contraseña nueva desde el panel. Después podés cambiarla en tu perfil.</p>
        <a class="btn primary block lg" href="https://wa.me/${waNumber(g.whatsapp)}?text=${encodeURIComponent("Hola! Necesito recuperar mi contraseña de la app de Vientos.")}" target="_blank" rel="noopener">${icon("whatsapp")} Escribir por WhatsApp</a>
        <p class="tiny muted">Con la versión final vas a poder recuperarla también por email.</p>
      </div>
    </div>`,
  };
}

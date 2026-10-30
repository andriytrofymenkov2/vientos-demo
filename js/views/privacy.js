/* Términos, privacidad y consentimiento del reconocimiento facial.
   BORRADOR: el texto lo tiene que revisar un abogado (Ley 25.326 de Protección de Datos Personales).
   Si cambia el texto, se sube S.TERMS_VERSION y todos los socios lo vuelven a aceptar. */
import { icon } from "../core/icons.js";
import { esc, fmtDate, $ } from "../core/util.js";
import * as S from "../core/store.js";
import { me, logout } from "../core/auth.js";
import { go, homeOf } from "../core/router.js";
import { toast } from "../core/ui.js";

const terms = (g) => `
  <p><b>${esc(g.name)}</b> es responsable de los datos que cargás en esta app. Los usa solo para darte el servicio del gimnasio.</p>
  <ul>
    <li><b>Qué datos guarda:</b> nombre y apellido, DNI, teléfono, email, fecha de nacimiento, género, tu plan y tus cuotas, tus pagos, tu rutina y lo que registrás al entrenar.</li>
    <li><b>Para qué:</b> darte acceso a tu rutina, llevar tus cuotas y pagos, avisarte vencimientos y que tu profe siga tu progreso.</li>
    <li><b>Quién los ve:</b> el personal del gimnasio (dueño, recepción y profes). No se venden ni se comparten con nadie más.</li>
    <li><b>Tus derechos:</b> podés pedir ver, corregir o borrar tus datos en recepción (Ley 25.326).</li>
  </ul>`;

const faceText = `
  <p>Si aceptás, el gimnasio puede reconocer tu cara con la cámara de recepción para identificarte al entrar.</p>
  <ul>
    <li>No se guarda tu foto: se guarda una <b>huella numérica</b> de la cara, que no permite reconstruir la imagen.</li>
    <li>Se usa <b>solo</b> para identificarte en la entrada del gimnasio.</li>
    <li>Es <b>opcional</b>: si no aceptás, entrás igual con tu DNI.</li>
    <li>Podés retirarlo cuando quieras desde tu Perfil, y la huella se borra en ese momento. También se borra si dejás el gimnasio.</li>
  </ul>`;

/* Primera vez (o cuando cambian los términos): aceptar los términos; el reconocimiento facial es aparte y opcional */
export function consentView() {
  const u = me();
  if (!S.needsConsent(u)) return go(homeOf(), { replace: true });
  const g = S.gymOf(S.spaceOf(u));
  return {
    layout: "auth", title: "Términos y privacidad",
    html: `<div class="auth"><div class="auth-card consent">
      <h1>Antes de empezar</h1>
      <p class="muted">Leé cómo usamos tus datos. Es una sola vez.</p>
      <section class="cs-block"><h2>${icon("shield", "sm")} Términos y privacidad</h2>${terms(g)}
        <label class="check"><input type="checkbox" name="terms"><span>Leí y acepto los términos y la política de privacidad.</span></label></section>
      <section class="cs-block"><h2>${icon("user", "sm")} Reconocimiento facial <small class="pill">Opcional</small></h2>${faceText}
        <label class="check"><input type="checkbox" name="face"><span>Acepto que el gimnasio use mi rostro para identificarme al entrar.</span></label></section>
      <p class="form-err" role="alert" hidden></p>
      <button class="btn primary block lg" type="button" data-ok>Continuar ${icon("arrow")}</button>
      <div class="auth-links"><a href="#/ingresar" data-out>Salir</a></div>
    </div></div>`,
    mount(host) {
      $("[data-out]", host).addEventListener("click", async (e) => { e.preventDefault(); await logout(); go("/ingresar", { replace: true }); });
      $("[data-ok]", host).addEventListener("click", () => {
        const err = $(".form-err", host);
        if (!$("[name=terms]", host).checked) { err.textContent = "Para usar la app tenés que aceptar los términos."; err.hidden = false; return; }
        S.api.setConsent(u.id, { face: $("[name=face]", host).checked });
        go(homeOf(), { replace: true });
      });
    },
  };
}

/* Tarjeta del Perfil: qué aceptó y cuándo, y activar o retirar el reconocimiento facial */
export function privacyCard(u) {
  const c = u.prefs?.consent || {};
  return `<section class="card" data-privacy>
    <div class="card-h"><h2>${icon("shield", "sm")} Privacidad</h2></div>
    <p class="muted tiny">Aceptaste los términos el ${c.termsAt ? esc(fmtDate(c.termsAt, { year: true })) : "—"}. <button type="button" class="linkbtn" data-terms>Leer los términos</button></p>
    <label class="toggle"><span><b>Reconocimiento facial al entrar</b><small>${c.face ? (S.faceOf(u.id) ? "Activado. Tu huella facial está registrada." : "Activado. Falta registrar tu cara en recepción.") : "Desactivado. Entrás con tu DNI."}</small></span>
      <input type="checkbox" name="face" ${c.face ? "checked" : ""} role="switch"><i aria-hidden="true"></i></label>
  </section>`;
}

export function mountPrivacy(host, u, { sheet, confirmDialog, refresh }) {
  const box = $("[data-privacy]", host);
  if (!box) return;
  $("[data-terms]", box).addEventListener("click", () => sheet({ title: "Términos y privacidad", html: `<div class="consent">${terms(S.gymOf(S.spaceOf(u)))}<h3>Reconocimiento facial</h3>${faceText}</div>` }));
  $("[name=face]", box).addEventListener("change", async (e) => {
    if (e.target.checked) {
      if (!await confirmDialog({ title: "¿Activar el reconocimiento facial?", text: "El gimnasio va a poder reconocer tu cara en la entrada. Después pasá por recepción para registrarla. Lo podés desactivar cuando quieras.", ok: "Activar" })) { e.target.checked = false; return; }
      S.api.setConsent(u.id, { face: true }); toast("Reconocimiento facial activado");
    } else {
      if (!await confirmDialog({ title: "¿Desactivar el reconocimiento facial?", text: "Se borra tu huella facial ahora. Vas a entrar con tu DNI.", ok: "Desactivar", danger: true })) { e.target.checked = true; return; }
      S.api.setConsent(u.id, { face: false }); toast("Desactivado. Se borró tu huella facial");
    }
    refresh();
  });
}

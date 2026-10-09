/* Arranque de la app de Vientos */
import * as S from "./core/store.js";
import { restore, me } from "./core/auth.js";
import { route, start, setShell } from "./core/router.js";
import { shell, applyTheme } from "./core/ui.js";
import { resumeRest } from "./core/timer.js";
import { loginView, registerView, recoverView } from "./views/auth.js";
import { homeView } from "./views/home.js";
import { routineView, dayView, exerciseView, summaryView } from "./views/routine.js";
import { progressView } from "./views/progress.js";
import { profileView } from "./views/profile.js";
import { installView } from "./views/install.js";
import { assistantView } from "./views/assistant.js";
import { panelHome, membersView, memberView, previewView, feesView, noticesView, gymView, qrView, moreView } from "./views/panel.js";
import { routineEditorView, templateEditorView, templatesView, exercisesView } from "./views/editor.js";

/* Android/Chrome avisa cuando la app se puede instalar: se guarda para el botón */
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__bip = e;
  dispatchEvent(new Event("vientos:installable"));
});

async function boot() {
  applyTheme();
  await S.init();
  restore();
  applyTheme();
  setShell(shell);

  const pub = { public: true }, guest = { public: true, guestOnly: true }, staff = { staff: true }, member = { member: true };
  route("/ingresar", loginView, guest);
  route("/registro", registerView, guest);
  route("/recuperar", recoverView, guest);
  route("/instalar", installView, pub);

  route("/inicio", homeView, member);
  route("/rutina", routineView, member);
  route("/rutina/:rid", routineView, member);
  route("/rutina/:rid/dia/:did", dayView);
  route("/rutina/:rid/dia/:did/ej/:iid", exerciseView);
  route("/resumen/:id", summaryView, member);
  route("/progreso", progressView, member);
  route("/asistente", assistantView, member);
  route("/perfil", profileView, member);

  route("/panel", panelHome, staff);
  route("/panel/socios", membersView, staff);
  route("/panel/socios/:id", memberView, staff);
  route("/panel/rutina/:id", routineEditorView, staff);
  route("/panel/vista/:id", previewView, staff);
  route("/panel/plantillas", templatesView, staff);
  route("/panel/plantilla/:id", templateEditorView, staff);
  route("/panel/ejercicios", exercisesView, staff);
  route("/panel/cuotas", feesView, staff);
  route("/panel/avisos", noticesView, staff);
  route("/panel/gimnasio", gymView, { staff: true, admin: true });
  route("/panel/qr", qrView, staff);
  route("/panel/mas", moreView, staff);
  route("/panel/cuenta", profileView, staff);

  /* Un entrenamiento que quedó abierto de otro día se guarda solo */
  const tidy = () => { const u = me(); if (u?.role === "socio") S.api.closeStale(u.id); };
  tidy();
  addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tidy(); });

  start();
  if (me()) resumeRest();
  document.getElementById("boot")?.remove();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => { /* sin modo sin conexión */ });
  }
}

boot().catch((err) => {
  console.error(err);
  document.getElementById("app").innerHTML = `<div class="empty" style="margin:40px auto;max-width:520px"><h3>No pudimos abrir la app</h3><p>Recargá la página. Si el problema sigue, escribinos por WhatsApp.</p></div>`;
  document.getElementById("boot")?.remove();
});

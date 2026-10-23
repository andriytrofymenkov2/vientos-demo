/* Arranque de la app de Vientos */
import * as S from "./core/store.js";
import { restore, me, refreshMe, logout } from "./core/auth.js";
import { route, start, setShell, refresh, go } from "./core/router.js";
import { shell, applyTheme, toast } from "./core/ui.js";
import { resumeRest } from "./core/timer.js";
import { watchUpdates } from "./core/update.js";
import { loginView, registerView, recoverView, firstPasswordView } from "./views/auth.js";
import { homeView } from "./views/home.js";
import { routineView, dayView, exerciseView, summaryView, printView } from "./views/routine.js";
import { progressView } from "./views/progress.js";
import { profileView } from "./views/profile.js";
import { installView, platform } from "./views/install.js";
import { assistantView } from "./views/assistant.js";
import { panelHome, membersView, memberView, previewView, feesView, recaudacionView, conveniosView, noticesView, gymView, qrView, moreView } from "./views/panel.js";
import { routineEditorView, templateEditorView, templatesView, exercisesView } from "./views/editor.js";

/* Android/Chrome avisa cuando la app se puede instalar: se guarda para el botón */
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__bip = e;
  dispatchEvent(new Event("vientos:installable"));
});

/* Que nadie pueda meter la app dentro de otra página para engañar a los clics */
if (window.top !== window.self) { try { window.top.location = window.location.href; } catch { document.documentElement.hidden = true; } }

async function boot() {
  applyTheme();
  await S.init();
  if (S.MODE === "supabase") { S.remote().setErrorHandler((msg) => toast(msg, "err")); S.remote().setInfoHandler((msg) => toast(msg)); }
  restore();
  applyTheme();
  setShell(shell);

  const pub = { public: true }, guest = { public: true, guestOnly: true }, staff = { staff: true }, member = { member: true };
  route("/ingresar", loginView, guest);
  route("/registro", registerView, guest);
  route("/recuperar", recoverView, guest);
  route("/instalar", installView, pub);
  route("/clave", firstPasswordView);

  route("/inicio", homeView, member);
  route("/rutina", routineView, member);
  route("/rutina/:rid", routineView, member);
  route("/rutina/:rid/dia/:did", dayView);
  route("/imprimir/:rid", printView);
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
  route("/panel/convenios", conveniosView, { staff: true, admin: true });
  route("/panel/recaudacion", recaudacionView, { staff: true, admin: true });
  route("/panel/avisos", noticesView, staff);
  route("/panel/gimnasio", gymView, { staff: true, admin: true });
  route("/panel/qr", qrView, staff);
  route("/panel/mas", moreView, staff);
  route("/panel/cuenta", profileView, staff);

  /* Un entrenamiento que quedó abierto de otro día se guarda solo */
  const tidy = () => { const u = me(); if (u?.role === "socio") S.api.closeStale(u.id); };
  tidy();
  addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tidy(); });

  /* Actualizar a pedido: deslizando el dedo hacia abajo o con el botón.
     (Nada automático: los datos se traen al abrir la app y cuando el usuario lo pide.) */
  let syncing = false;
  window.__vientosSync = async () => {
    if (S.MODE !== "supabase" || !me() || syncing) return;
    syncing = true;
    try {
      await S.remote().reload();
      if (!refreshMe()) { await logout(); go("/ingresar", { replace: true }); return; }
      tidy();
      refresh();
      toast("Actualizado");
    } catch (e) { console.warn(e); toast("No se pudo actualizar. Revisá internet.", "err"); }
    finally { syncing = false; }
  };
  pullToRefresh(() => window.__vientosSync());

  /* Celular que todavía no la instaló y no ingresó (llega por el link de WhatsApp en vez del QR):
     lo primero que ve es "Instalar la app de Vientos" (una vez por visita; "Seguir sin instalar" va al ingreso) */
  try {
    const h = location.hash, pl = platform();
    if (!me() && pl.mobile && !pl.standalone && (!h || h === "#/" || h === "#/ingresar") && !sessionStorage.getItem("vientos_inst_vista")) {
      sessionStorage.setItem("vientos_inst_vista", "1");
      location.hash = "#/instalar";
    }
  } catch { /* sin almacenamiento */ }
  start();
  if (me()) resumeRest();
  document.getElementById("boot")?.remove();
  watchUpdates(new URL(import.meta.url).searchParams.get("v"));

  /* Como en la versión que instalaba al instante: el service worker se registra al terminar de cargar */
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => { /* sin modo sin conexión */ });
  }

}

boot().catch((err) => {
  console.error(err);
  document.getElementById("app").innerHTML = `<div class="empty" style="margin:40px auto;max-width:520px"><h3>No pudimos abrir la app</h3><p>Recargá la página. Si el problema sigue, escribinos por WhatsApp.</p></div>`;
  document.getElementById("boot")?.remove();
});

/* Deslizar hacia abajo desde arriba de la pantalla para actualizar */
function pullToRefresh(run) {
  if (S.MODE !== "supabase") return;
  const tip = document.createElement("div");
  tip.className = "ptr";
  tip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4.5v4h-4"/></svg>';
  document.body.appendChild(tip);
  let y0 = null, dy = 0;
  const can = () => me() && window.scrollY <= 0 && !document.querySelector(".sheet-wrap");
  addEventListener("touchstart", (e) => { y0 = can() && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    const d = Math.min(dy, 110);
    tip.style.transform = `translate(-50%, ${d - 50}px) rotate(${d * 3}deg)`;
    tip.style.opacity = Math.min(1, d / 70);
    tip.classList.toggle("ready", dy > 80);
  }, { passive: true });
  addEventListener("touchend", async () => {
    if (y0 === null) return;
    const go = dy > 80;
    y0 = null;
    if (!go) { tip.style.transform = ""; tip.style.opacity = 0; return; }
    tip.classList.add("spin");
    await run();
    tip.classList.remove("spin", "ready");
    tip.style.transform = ""; tip.style.opacity = 0;
  });
}

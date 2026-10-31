/* Pantalla para socios: el monitor que mira la gente en la entrada. Muestra SOLO la cámara, el óvalo guía
   y un saludo grande ("¡Hola Andriy! Bienvenido a Vientos" / "Acercate a recepción"). Nada del panel ni datos
   de nadie: ni la cuota, ni el DNI. El reconocimiento, la voz y las entradas los hace la ventana de Recepción
   (en el monitor de quien atiende), que le avisa a esta pantalla por un canal del navegador.
   Queda siempre prendida: la cámara arranca sola, la pantalla no se apaga y si la cámara se corta, vuelve. */
import { icon } from "../core/icons.js";
import { esc, $ } from "../core/util.js";
import * as S from "../core/store.js";

export const SCREEN_CHANNEL = "vientos-recepcion";

export function pantallaView() {
  const g = S.gymOf();
  return {
    layout: "kiosk", title: "Pantalla para socios",
    html: `<div class="kiosk">
      <div class="k-video"><video data-video playsinline muted autoplay></video><div class="k-oval" data-oval></div></div>
      <div class="k-msg idle" data-msg><b>Mirá a la cámara</b><span>Poné tu cara dentro del óvalo</span></div>
      <button class="k-full" type="button" data-full>${icon("ext", "sm")} Pantalla completa</button>
      <div class="k-brand">${esc(g.name)}</div>
    </div>`,
    mount(host) {
      const video = $("[data-video]", host), msg = $("[data-msg]", host), oval = $("[data-oval]", host);
      let stream = null, wake = null, idleT = 0;
      const IDLE = ["idle", "Mirá a la cámara", "Poné tu cara dentro del óvalo"];
      const setMsg = (cls, big, small = "") => { msg.className = `k-msg ${cls}`; msg.innerHTML = `<b>${esc(big)}</b>${small ? `<span>${esc(small)}</span>` : ""}`; };
      const keepAwake = async () => { try { wake = await navigator.wakeLock?.request("screen"); } catch { wake = null; } };
      async function start() {
        if (stream) return;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
          video.srcObject = stream; await video.play();
          keepAwake();
          stream.getVideoTracks()[0]?.addEventListener("ended", () => { stream = null; setTimeout(start, 2000); });
        } catch { stream = null; setMsg("bad", "La cámara no está disponible", "Avisá en recepción"); setTimeout(start, 5000); }
      }
      start();
      const onVisible = () => { if (document.visibilityState === "visible") { if (!stream) start(); else keepAwake(); } };
      document.addEventListener("visibilitychange", onVisible);
      $("[data-full]", host).addEventListener("click", () => { document.documentElement.requestFullscreen?.().catch(() => {}); });

      /* lo que avisa Recepción */
      const ch = "BroadcastChannel" in window ? new BroadcastChannel(SCREEN_CHANNEL) : null;
      ch?.addEventListener("message", ({ data: d }) => {
        if (!d) return;
        clearTimeout(idleT);
        if (d.t === "oval") oval.classList.toggle("on", !!d.on);
        else if (d.t === "idle") setMsg(...IDLE);
        else if (d.t === "show") {
          const first = String(d.name || "").split(" ")[0];
          if (d.kind === "ok") setMsg("ok", `¡Hola ${first}!`, `Bienvenido a ${d.gym || g.name}`);
          else if (d.kind === "warn") setMsg("ok", `¡Hola ${first}!`, "Cuando puedas, acercate a recepción");
          else if (d.kind === "bad") setMsg("warn", `Hola ${first}`, "Antes de entrar, acercate a recepción");
          else setMsg("none", "No te reconozco", "Acercate a recepción, por favor");
          idleT = setTimeout(() => setMsg(...IDLE), 6000);        /* por si Recepción se cierra */
        } else if (d.t === "enroll") setMsg("enroll", d.big || "Registrando tu rostro", d.small || "Mirá de frente a la cámara");
      });
      return () => { ch?.close(); document.removeEventListener("visibilitychange", onVisible); clearTimeout(idleT); try { wake?.release(); } catch { /* nada */ } stream?.getTracks().forEach((t) => t.stop()); };
    },
  };
}

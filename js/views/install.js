/* Instalar la app: detecta el teléfono y explica el paso que corresponde.
   Es la página a la que lleva el QR del gimnasio. */
import { icon, logo } from "../core/icons.js";
import { $ } from "../core/util.js";
import { me } from "../core/auth.js";
import { homeOf } from "../core/router.js";
import { toast } from "../core/ui.js";
import { CONFIG } from "../config.js";

export function platform() {
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|WhatsApp|Line\/|Twitter|TikTok|musical_ly|Snapchat/i.test(ua);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  return { ios, android, inApp, standalone, mobile: ios || android };
}

/* Carga la librería del QR solo cuando hace falta */
export function loadQR() {
  return window.qrcode ? Promise.resolve(window.qrcode) : new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "vendor/qrcode.js";
    s.onload = () => res(window.qrcode);
    s.onerror = rej;
    document.head.appendChild(s);
  });
}
export async function qrSvg(text, cell = 6) {
  const q = (await loadQR())(0, "M");
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true });
}
export const installUrl = () => (location.protocol.startsWith("http") && !/localhost|127\.0\.0\.1/.test(location.host) ? location.origin + location.pathname : CONFIG.siteUrl + "/") + "#/instalar";

const step = (n, ic, html) => `<li><span class="stp">${n}</span><span class="stp-i">${icon(ic)}</span><p>${html}</p></li>`;

export function installView() {
  const p = platform();
  const url = installUrl();
  let body;
  if (p.standalone) {
    body = `<div class="inst-ok">${icon("checkc")}<h2>Ya tenés la app instalada</h2><p class="muted">Abrila desde el ícono de Vientos en tu pantalla de inicio.</p></div>`;
  } else if (p.inApp) {
    body = `<div class="inst-warn">${icon("alert")}<div><h2>Abrí este link en ${p.ios ? "Safari" : "Chrome"}</h2><p>Desde Instagram o WhatsApp no se puede instalar. Tocá los tres puntos ${icon("dots", "xs")} y elegí <b>“Abrir en ${p.ios ? "Safari" : "el navegador"}”</b>, o copiá el link.</p></div></div>
      ${p.android ? `<a class="btn primary block lg" href="intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;end">${icon("ext")} Abrir en Chrome</a>` : ""}
      <button class="btn ghost block" type="button" data-copy>${icon("copy")} Copiar el link</button>`;
  } else if (p.ios) {
    body = `<ol class="steps">
        ${step(1, "share", `Tocá el botón <b>Compartir</b> abajo en la barra de Safari.`)}
        ${step(2, "addbox", `Bajá y elegí <b>“Agregar a inicio”</b>.`)}
        ${step(3, "check", `Tocá <b>Agregar</b>. Listo: el ícono de Vientos queda en tu pantalla.`)}
      </ol>
      <div class="ios-hint" aria-hidden="true">${icon("down")}</div>`;
  } else if (p.android) {
    body = `<button class="btn primary block lg" type="button" data-install hidden>${icon("download")} Instalar Vientos</button>
      <ol class="steps" data-manual>
        ${step(1, "dots", `Tocá el menú <b>⋮</b> arriba a la derecha de Chrome.`)}
        ${step(2, "download", `Elegí <b>“Instalar app”</b> o <b>“Agregar a la pantalla principal”</b>.`)}
        ${step(3, "check", `Confirmá. El ícono de Vientos queda junto a tus otras apps.`)}
      </ol>`;
  } else {
    body = `<div class="inst-desk"><div class="qr" data-qr></div><div><h2>Escaneá con tu celular</h2><p class="muted">Apuntá la cámara al código y seguí los pasos. La app está pensada para el teléfono.</p>
      <button class="btn ghost sm" type="button" data-install hidden>${icon("download", "sm")} Instalar en esta computadora</button></div></div>`;
  }
  return {
    layout: "auth", title: "Instalar la app",
    html: `<div class="inst">
        <div class="inst-icon"><img src="img/icon-192.png" alt="" width="84" height="84"></div>
        <div class="inst-logo">${logo()}</div>
        <h1>Instalá la app de Vientos</h1>
        <p class="muted">Tu rutina, tus pesos y tu progreso, siempre a mano. Es gratis y no ocupa lugar.</p>
        ${body}
        <a class="btn ${p.standalone ? "primary" : "ghost"} block" href="#${me() ? homeOf() : "/ingresar"}">${me() ? "Ir a la app" : "Ingresar"}</a>
        <p class="tiny muted">Se instala sin App Store ni Play Store.</p>
      </div>`,
    mount(host) {
      $("[data-copy]", host)?.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(url); toast("Link copiado. Pegalo en el navegador."); }
        catch { prompt("Copiá este link:", url); }
      });
      const btn = $("[data-install]", host);
      const ready = () => {
        if (!btn || !window.__bip) return;
        btn.hidden = false;
        $("[data-manual]", host)?.setAttribute("hidden", "");
      };
      ready();
      addEventListener("vientos:installable", ready);
      btn?.addEventListener("click", async () => {
        const e = window.__bip;
        if (!e) return;
        e.prompt();
        const r = await e.userChoice;
        window.__bip = null;
        if (r.outcome === "accepted") toast("¡Listo! Buscá el ícono de Vientos.");
      });
      const q = $("[data-qr]", host);
      if (q) qrSvg(url, 5).then((svg) => (q.innerHTML = svg)).catch(() => (q.textContent = url));
      return () => removeEventListener("vientos:installable", ready);
    },
  };
}

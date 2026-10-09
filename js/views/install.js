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
  const ipad = /iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const ios = /iPhone|iPod/i.test(ua) || ipad;
  const android = /Android/i.test(ua);
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|WhatsApp|Line\/|Twitter|TikTok|musical_ly|Snapchat|GSA\//i.test(ua);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  /* Navegador en iPhone: Safari, Chrome (CriOS), Firefox (FxiOS) o Edge (EdgiOS) */
  const iosBrowser = /CriOS/.test(ua) ? "chrome" : /FxiOS/.test(ua) ? "firefox" : /EdgiOS/.test(ua) ? "edge" : "safari";
  /* Safari 26 (iOS 26) cambió la barra: Compartir quedó dentro del botón "···" */
  const safariVer = +(ua.match(/Version\/(\d+)/) || [])[1] || 0;
  return { ios, ipad, android, inApp, standalone, mobile: ios || android, iosBrowser, newSafari: safariVer >= 26 };
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

/* ---------------------------------------------------------- guía iPhone
   Dibujos simples de lo que el socio va a ver en su pantalla, paso por paso.
   Cambian según la versión de Safari (iOS 26 escondió Compartir en "···"),
   el navegador (Chrome en iPhone tiene Compartir arriba) y si es iPad. */
const IC = {
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" /><path d="M5 11.5v9h14v-9" /></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.6" class="f"/><circle cx="12" cy="12" r="1.6" class="f"/><circle cx="18.5" cy="12" r="1.6" class="f"/></svg>',
  add: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m14.5 5-7 7 7 7"/></svg>',
  fwd: '<svg viewBox="0 0 24 24"><path d="m9.5 5 7 7-7 7"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5.5c3-1 5.5-.8 8 1 2.5-1.8 5-2 8-1V19c-3-1-5.5-.8-8 1-2.5-1.8-5-2-8-1z"/></svg>',
  tabs: '<svg viewBox="0 0 24 24"><rect x="4" y="7" width="12" height="12" rx="2"/><path d="M8 4h10a2 2 0 0 1 2 2v10"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V4.5h-11v11h4"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 19l1-5.4-4-3.8 5.4-.7z"/></svg>',
};
const mockBarOld = () => `<div class="mk-bar"><span>${IC.back}</span><span>${IC.fwd}</span><span class="hl">${IC.share}</span><span>${IC.book}</span><span>${IC.tabs}</span></div>`;
const mockBarNew = () => `<div class="mk-bar new"><span>${IC.back}</span><span class="mk-url">vientos…</span><span class="hl">${IC.dots}</span></div>`;
const mockBarChrome = () => `<div class="mk-bar top"><span class="mk-url">vientos…</span><span class="hl">${IC.share}</span></div>`;
const mockMenu = () => `<div class="mk-sheet"><div class="mk-row">${IC.copy}<span>Copiar</span></div><div class="mk-row hl">${IC.share}<span>Compartir</span></div><div class="mk-row">${IC.star}<span>Agregar a favoritos</span></div></div>`;
const mockShare = () => `<div class="mk-sheet"><div class="mk-row">${IC.copy}<span>Copiar</span></div><div class="mk-row">${IC.book}<span>Agregar a la lista de lectura</span></div><div class="mk-row hl">${IC.add}<span>Agregar a inicio</span></div></div>`;
const mockAdd = (toggle) => `<div class="mk-sheet"><div class="mk-top"><span>Cancelar</span><b>Agregar a inicio</b><span class="hl-t">Agregar</span></div><div class="mk-app"><img src="img/icon-192.png" alt=""><span>Vientos</span></div>${toggle ? `<div class="mk-row"><span>Abrir como app web</span><i class="mk-sw"></i></div>` : ""}</div>`;

function iosGuide(p) {
  let steps;
  if (p.iosBrowser !== "safari" && p.iosBrowser !== "chrome") {
    return `<div class="inst-warn">${icon("alert")}<div><h2>Abrí este link en Safari</h2><p>Para instalar la app en iPhone, copiá el link y pegalo en <b>Safari</b>.</p></div></div>
      <button class="btn primary block lg" type="button" data-copy>${icon("copy")} Copiar el link</button>`;
  }
  if (p.iosBrowser === "chrome") {
    steps = [
      [`Tocá el botón <b>Compartir</b> ${icon("share", "xs")} arriba, al lado de la dirección.`, mockBarChrome()],
      [`Bajá y tocá <b>“Agregar a pantalla de inicio”</b>.`, mockShare()],
      [`Tocá <b>Agregar</b>, arriba a la derecha.`, mockAdd(false)],
    ];
  } else if (p.newSafari) {
    steps = [
      [`Tocá el botón <b>···</b> (tres puntitos) ${p.ipad ? "arriba a la derecha" : "abajo a la derecha"}.`, mockBarNew()],
      [`Tocá <b>Compartir</b>.`, mockMenu()],
      [`Bajá y tocá <b>“Agregar a inicio”</b>.`, mockShare()],
      [`Dejá prendido <b>“Abrir como app web”</b> y tocá <b>Agregar</b>.`, mockAdd(true)],
    ];
  } else {
    steps = [
      [`Tocá el botón <b>Compartir</b> ${icon("share", "xs")} ${p.ipad ? "arriba a la derecha" : "abajo, en el medio"}.`, mockBarOld()],
      [`Bajá y tocá <b>“Agregar a inicio”</b>.`, mockShare()],
      [`Tocá <b>Agregar</b>, arriba a la derecha.`, mockAdd(false)],
    ];
  }
  const where = p.iosBrowser === "chrome" || p.ipad ? "top-right" : p.newSafari ? "bottom-right" : "bottom-center";
  return `<div class="ios-guide" data-guide>
      ${steps.map(([t, mk], i) => `<section class="ig-step ${i ? "" : "on"}" data-step="${i}">
        <span class="ig-n">Paso ${i + 1} de ${steps.length}</span>
        <div class="mk">${mk}</div>
        <p>${t}</p>
      </section>`).join("")}
      <div class="ig-nav">
        <button class="btn ghost" type="button" data-prev disabled>${icon("left")}</button>
        <div class="ig-dots">${steps.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>
        <button class="btn primary" type="button" data-next>Siguiente ${icon("right")}</button>
      </div>
      <p class="tiny muted">Al terminar, buscá el ícono de Vientos en tu pantalla de inicio y abrila desde ahí.</p>
    </div>
    <div class="ios-arrow ${where}" aria-hidden="true">${icon(where === "top-right" ? "up" : "down")}<span>${p.iosBrowser === "chrome" ? "Compartir" : p.newSafari ? "···" : "Compartir"}</span></div>`;
}

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
    body = iosGuide(p);
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
        <a class="btn ${p.standalone ? "primary" : "ghost"} block" href="#${me() ? homeOf() : "/ingresar"}" data-skip>${p.standalone || !p.mobile ? (me() ? "Ir a la app" : "Ingresar") : "Seguir sin instalar"}</a>
        ${p.ios && !p.standalone ? `<p class="tiny muted">Instalala antes de ingresar: en iPhone, la app instalada pide el usuario de nuevo.</p>` : ""}
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
      /* Guía de iPhone: un paso a la vez */
      const g = $("[data-guide]", host);
      if (g) {
        const secs = [...g.querySelectorAll(".ig-step")], dots = [...g.querySelectorAll(".ig-dots i")];
        const prev = $("[data-prev]", g), next = $("[data-next]", g);
        let k = 0;
        const show = (n) => {
          k = Math.max(0, Math.min(secs.length - 1, n));
          secs.forEach((s, i) => s.classList.toggle("on", i === k));
          dots.forEach((d, i) => d.classList.toggle("on", i === k));
          prev.disabled = k === 0;
          next.innerHTML = k === secs.length - 1 ? "Volver a empezar" : `Siguiente ${icon("right")}`;
          $(".ios-arrow", host)?.classList.toggle("off", k > 0);
        };
        prev.addEventListener("click", () => show(k - 1));
        next.addEventListener("click", () => show(k === secs.length - 1 ? 0 : k + 1));
      }
      const q = $("[data-qr]", host);
      if (q) qrSvg(url, 5).then((svg) => (q.innerHTML = svg)).catch(() => (q.textContent = url));
      return () => removeEventListener("vientos:installable", ready);
    },
  };
}

/* Instalar la app: detecta el teléfono y explica el paso que corresponde.
   Es la página a la que lleva el QR del gimnasio. */
import { icon, logo } from "../core/icons.js";
import { $, esc } from "../core/util.js";
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
/* El botón Compartir, gigante: lo único que hay que buscar */
const mockBig = () => `<div class="mk-big"><span class="hl">${IC.share}</span><small>El cuadradito con la flecha para arriba. Si no lo ves: los tres puntitos ··· y ahí “Compartir”.</small></div>`;
const mockBarOld = () => `<div class="mk-bar"><span>${IC.back}</span><span>${IC.fwd}</span><span class="hl">${IC.share}</span><span>${IC.book}</span><span>${IC.tabs}</span></div>`;
const mockBarNew = () => `<div class="mk-bar new"><span>${IC.back}</span><span class="mk-url">vientos…</span><span class="hl">${IC.dots}</span></div>`;
const mockBarChrome = () => `<div class="mk-bar top"><span class="mk-url">vientos…</span><span class="hl">${IC.share}</span></div>`;
const mockMenu = () => `<div class="mk-sheet"><div class="mk-row">${IC.copy}<span>Copiar</span></div><div class="mk-row hl">${IC.share}<span>Compartir</span></div><div class="mk-row">${IC.star}<span>Agregar a favoritos</span></div></div>`;
const mockMore = () => `<div class="mk-sheet"><div class="mk-apps"><i></i><i></i><i></i><i></i></div><div class="mk-row">${IC.copy}<span>Copiar</span></div><div class="mk-row">${IC.book}<span>Agregar a la lista de lectura</span></div><div class="mk-row hl"><span class="mk-more">Ver más</span>${IC.fwd}</div></div>`;
const mockShare = () => `<div class="mk-sheet"><div class="mk-row">${IC.copy}<span>Copiar</span></div><div class="mk-row">${IC.book}<span>Agregar a la lista de lectura</span></div><div class="mk-row hl">${IC.add}<span>Agregar a inicio</span></div></div>`;
const mockAdd = (toggle) => `<div class="mk-sheet"><div class="mk-top"><span>Cancelar</span><b>Agregar a inicio</b><span class="hl-t">Agregar</span></div><div class="mk-app"><img src="img/icon-192.png" alt=""><span>Vientos</span></div>${toggle ? `<div class="mk-row"><span>Abrir como app web</span><i class="mk-sw"></i></div>` : ""}</div>`;

function iosGuide(p) {
  if (p.iosBrowser !== "safari" && p.iosBrowser !== "chrome") {
    return `<div class="inst-warn">${icon("alert")}<div><h2>Abrí este link en Safari</h2><p>Para instalar la app en iPhone, copiá el link y pegalo en <b>Safari</b>.</p></div></div>
      <button class="btn primary block lg" type="button" data-copy>${icon("copy")} Copiar el link</button>`;
  }
  /* Una sola guía para cualquier iPhone: Safari puede mostrar el botón Compartir
     directo o escondido en "···" según la versión y cómo lo configuró cada uno,
     así que cada paso dice qué hacer en los dos casos. */
  const chrome = p.iosBrowser === "chrome";
  const steps = [
    [`Buscá este botón <b>${chrome || p.ipad ? "arriba" : "abajo"}</b> en la pantalla y tocalo. <span class="ig-alt">Si no lo ves, tocá los <b>tres puntitos ···</b> y elegí <b>“Compartir”</b>.</span>`, mockBig()],
    [`Bajá y tocá <b>“Agregar a inicio”</b>. <span class="ig-alt">Si no está, tocá <b>“Ver más”</b>.</span>`, mockShare()],
    [`Tocá <b>“Agregar”</b>.`, mockAdd(false)],
  ];
  const where = chrome || p.ipad ? "top-right" : "bottom-center";
  /* Texto de cada paso para la guía por voz */
  const spoken = steps.map(([t], i) => `Paso ${i + 1}. ` + t.replace(/<[^>]+>/g, "").replace(/[“”]/g, "").replace(/\s*···\s*/g, " ").replace(/\s+/g, " ").replace(/ ([:,.])/g, "$1").trim());
  spoken[0] = `Paso 1. Tocá el botón del cuadradito con la flecha para arriba, ${chrome || p.ipad ? "arriba" : "abajo"} en la pantalla. Si no lo ves, tocá los tres puntitos y elegí Compartir.`;
  return `<div class="ig-help">
      <p class="ig-why">${icon("info", "xs")} Son 3 pasos. Tocá el botón rojo y una voz te los va diciendo.</p>
      <button class="btn primary block lg" type="button" data-voice data-say="${esc(JSON.stringify(spoken))}">${icon("sound")} Guiame con voz</button>
    </div>
    <div class="ios-guide" data-guide>
      ${steps.map(([t, mk], i) => `<section class="ig-step ${i ? "" : "on"}" data-step="${i}">
        <span class="ig-n">Paso ${i + 1} de ${steps.length}</span>
        <div class="mk">${mk}</div>
        <p>${t}</p>
      </section>`).join("")}
      <section class="ig-step" data-step="${steps.length}">${iosPanel()}</section>
      <div class="ig-nav">
        <button class="btn ghost" type="button" data-prev disabled>${icon("left")}</button>
        <div class="ig-dots">${[...steps, 0].map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>
        <button class="btn primary" type="button" data-next>Siguiente ${icon("right")}</button>
      </div>
    </div>
    <div class="ios-arrow ${where}" aria-hidden="true">${icon(where === "top-right" ? "up" : "down")}<span>Compartir</span></div>`;
}

const helpHtml = (android) => `<details class="inst-help"><summary>¿No aparece el ícono?</summary>
      ${android
        ? `<ol><li>Deslizá hacia arriba desde el centro de la pantalla y buscá <b>Vientos</b> en la lista de todas tus apps. Mantenelo apretado y arrastralo a la pantalla de inicio.</li>
           <li>Esperá un ratito: a veces Android tarda en poner el ícono.</li>
           <li>En <b>Samsung</b>: Ajustes → Pantalla de inicio → activá <b>“Agregar apps nuevas a la pantalla de inicio”</b>. En <b>Xiaomi, Oppo o Realme</b>: Ajustes → Apps → Chrome → Permisos → activá <b>“Accesos directos”</b>.</li>
           <li>Si no está en ninguna lista: en Chrome tocá el menú <b>⋮</b> → <b>“Instalar app”</b> (o <b>“Agregar a la pantalla principal”</b>) y repetí.</li></ol>`
        : `<ol><li>Deslizá la pantalla de inicio hacia la <b>izquierda, hasta la última página</b>: ahí queda el ícono.</li>
           <li>O seguí deslizando hasta la <b>Biblioteca de apps</b> y buscá “Vientos” arriba.</li>
           <li>Si no está: abrí el link en <b>Safari</b> (no Chrome, no WhatsApp), tocá Compartir → <b>“Agregar a inicio”</b> → <b>“Agregar”</b>.</li></ol>`}
    </details>`;
/* iPhone: Apple no deja que una web vea si el ícono ya está; por eso no se afirma que quedó instalada */
const iosPanel = () => `<div class="inst-done" data-done>
    <div class="mk-home" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><span class="mk-home-app"><img src="img/icon-192.png" alt=""><b>Vientos</b></span><i></i><i></i></div>
    <h2>Buscá el ícono de Vientos</h2>
    <p>Quedó al <b>final de tu pantalla de inicio</b> (deslizá hacia la izquierda hasta la última página). <b>Abrí Vientos desde ese ícono.</b></p>
    ${helpHtml(false)}
  </div>`;
/* Cartel final, cuando termina la instalación (la barra en Android; el último paso en iPhone) */
const donePanel = (android) => `<div class="inst-done" data-done>
    <div class="mk-home" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><span class="mk-home-app"><img src="img/icon-192.png" alt=""><b>Vientos</b></span><i></i><i></i></div>
    <h2>${icon("checkc")} ¡Listo, ya está instalada!</h2>
    <p>Ahora <b>cerrá ${android ? "Chrome" : "Safari"}</b> y buscá este ícono en la pantalla de tu celular. <b>Abrí Vientos desde ahí.</b></p>
    ${helpHtml(android)}
  </div>`;

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
    body = `<div class="inst-wait" data-prep role="status"><h2>Preparando la instalación…</h2><div class="inst-spin" aria-hidden="true"></div><p>Un segundo.</p></div>
      <button class="btn primary block lg" type="button" data-install hidden>${icon("download")} Instalar Vientos</button>`;
  } else {
    body = `<div class="inst-desk"><div class="qr" data-qr></div><div><h2>Escaneá con tu celular</h2><p class="muted">Apuntá la cámara al código y seguí los pasos. La app está pensada para el teléfono.</p>
      <button class="btn ghost sm" type="button" data-install hidden>${icon("download", "sm")} Instalar en esta computadora</button></div></div>`;
  }
  return {
    layout: "auth", title: "Instalar la app",
    html: `<div class="inst">
        <div class="inst-logo">${logo()}</div>
        <h1>Instalá la app de Vientos</h1>
        <p class="muted">Tu rutina, tus pesos y tu progreso, siempre a mano. Es gratis y no ocupa lugar.</p>
        <div data-installbox>${body}</div>
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
        $("[data-prep]", host)?.setAttribute("hidden", "");
        $("[data-manual]", host)?.setAttribute("hidden", "");
      };
      ready();
      /* En Android NUNCA se muestran pasos a mano: se espera el botón "Instalar Vientos" que ofrece Chrome
         (puede tardar, más la primera vez o si cambió el ícono). Si ya está instalada, se avisa; si tarda
         mucho, se ofrece recargar, pero se sigue esperando el botón. */
      if (!window.__bip && $("[data-prep]", host)) {
        const prep = $("[data-prep]", host);
        const say = (t) => { const p = $("p", prep); if (p && !window.__bip) p.innerHTML = t; };
        const t1 = setTimeout(() => say("La primera vez tarda un poquito más. No cierres esta pantalla."), 6000);
        const t2 = setTimeout(async () => {
          if (window.__bip || !$("[data-prep]", host)) return;
          const ya = navigator.getInstalledRelatedApps ? await navigator.getInstalledRelatedApps().then((l) => l.some((x) => x.platform === "webapp")).catch(() => false) : false;
          if (ya) { $("[data-installbox]", host).innerHTML = `<div class="inst-ok">${icon("checkc")}<h2>Ya tenés la app instalada</h2><p class="muted">Abrila desde el ícono de Vientos en tu pantalla de inicio.</p></div>`; return; }
          say(`Sigue preparándose. Si tarda mucho, <button type="button" class="linkbtn" data-reload>tocá acá para recargar</button>.`);
          $("[data-reload]", prep)?.addEventListener("click", () => location.reload());
        }, 30000);
        addEventListener("vientos:installable", () => { clearTimeout(t1); clearTimeout(t2); }, { once: true });
      }
      addEventListener("vientos:installable", ready);
      btn?.addEventListener("click", async () => {
        const e = window.__bip;
        if (!e) return;
        e.prompt();
        const r = await e.userChoice;
        window.__bip = null;
        if (r.outcome === "accepted") installing();
      });
      /* Android arma la app con Google: puede tardar de 10 s a 1 min. Se avisa y recién
         cuando termina ("appinstalled") se muestra "ya está instalada" */
      let waitT = 0, barT = 0, pollT0 = 0;
      const installing = () => {
        const box = $("[data-installbox]", host);
        if (!box || $("[data-done]", host)) return;
        box.innerHTML = `<div class="inst-wait" role="status"><h2>Instalando Vientos…</h2>
          <div class="inst-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="5"><i style="width:5%"></i></div>
          <p class="inst-pct" data-pct>5 %</p>
          <p>Tarda un ratito, como cualquier otra app. <b>No cierres esta pantalla</b>: cuando llegue al 100 % aparece el ícono de Vientos en tu celular.</p></div>`;
        /* Avanza sola y se va frenando (no se sabe cuánto tarda Android): llega al 100 % recién al terminar */
        const t0 = Date.now();
        clearInterval(barT);
        barT = setInterval(() => {
          const pct = Math.min(94, Math.round(94 * (1 - Math.exp(-(Date.now() - t0) / 22000))));
          const bar = $(".inst-bar", host);
          if (!bar) return clearInterval(barT);
          bar.firstElementChild.style.width = pct + "%";
          bar.setAttribute("aria-valuenow", pct);
          const el = $("[data-pct]", host); if (el) el.textContent = pct + " %";
        }, 400);
        clearTimeout(waitT);
        waitT = setTimeout(() => {
          const b = $("[data-installbox]", host);
          if (b && !$("[data-done]", host)) { clearInterval(barT); b.innerHTML = `<div class="inst-wait"><h2>Ya casi</h2><p>Si ya pasó un buen rato, buscá <b>Vientos</b> deslizando hacia arriba para ver todas tus apps: a veces el ícono queda ahí y no en la pantalla de inicio. Si no está, repetí la instalación desde el menú <b>⋮</b> de Chrome → <b>“Instalar app”</b>.</p></div>`; }
        }, 600000);
      };
      /* Instalada (por el botón o desde el menú de Chrome): se avisa con un cartel grande */
      /* "Listo" SOLO cuando Chrome confirma que la app ya está instalada en el celular
         (getInstalledRelatedApps). Si no se puede confirmar, no se dice que quedó instalada. */
      const isInstalled = async () => {
        if (!navigator.getInstalledRelatedApps) return null;
        try { return (await navigator.getInstalledRelatedApps()).some((x) => x.platform === "webapp"); } catch { return null; }
      };
      const finish = () => {
        clearInterval(barT); clearInterval(pollT);
        const bx = $("[data-installbox]", host);
        if (!bx || $("[data-done]", host)) return;
        bx.innerHTML = donePanel(true);
        const skip = $("[data-skip]", host);
        if (skip) skip.textContent = "Seguir en el navegador";
        try { navigator.vibrate?.([60, 40, 60]); } catch { /* sin vibración */ }
      };
      const unsure = (unsupported) => {
        clearInterval(barT); clearInterval(pollT);
        const bx = $("[data-installbox]", host);
        if (!bx || $("[data-done]", host)) return;
        bx.innerHTML = `<div class="inst-wait"><h2>${unsupported ? "Buscá el ícono de Vientos" : "No pudimos confirmar la instalación"}</h2>
          <p>${unsupported ? "Android terminó de instalarla, pero este navegador no nos deja confirmar que ya esté en tu pantalla." : "Todavía no vemos la app en tu celular."} Buscá <b>Vientos</b> deslizando hacia arriba para ver todas tus apps.</p>
          ${helpHtml(true)}</div>`;
      };
      let pollT = 0;
      const installed = () => {
        if ($("[data-done]", host)) return;
        if (!$(".inst-bar", host)) installing();
        clearTimeout(waitT);
        const h = $(".inst-wait h2", host), pe = $(".inst-wait p:last-child", host);
        if (h) h.textContent = "Casi lista…";
        if (pe) pe.innerHTML = "Android está terminando de instalarla. <b>Tarda un ratito.</b> No cierres esta pantalla: cuando esté lista te lo avisamos.";
        const t0 = Date.now();
        clearInterval(pollT);
        /* Chrome confirma antes de que el ícono llegue a la pantalla: después de la confirmación la barra
           sigue un rato (se queda en 99 %) y recién cierra cuando pasó ese margen */
        let okAt = 0;
        pollT = setInterval(async () => {
          const ok = await isInstalled();
          if (ok === true) {
            okAt ||= Date.now();
            const bar = $(".inst-bar", host), el = $("[data-pct]", host);
            if (Date.now() - okAt < 15000) {
              clearInterval(barT);
              if (bar) { bar.firstElementChild.style.width = "99%"; bar.setAttribute("aria-valuenow", 99); }
              if (el) el.textContent = "99 %";
              return;
            }
            if (bar) { bar.firstElementChild.style.width = "100%"; bar.setAttribute("aria-valuenow", 100); }
            if (el) el.textContent = "100 %";
            clearInterval(pollT); setTimeout(finish, 700);
          }
          else if (ok === null) unsure(true);
          else if (Date.now() - t0 > 150000) unsure(false);
        }, 2500);
      };
      addEventListener("appinstalled", installed);
      /* Guía por voz: lee cada paso con una pausa para hacerlo */
      const vb = $("[data-voice]", host);
      let talking = false, timer = 0;
      const stopVoice = () => { talking = false; clearTimeout(timer); try { speechSynthesis.cancel(); } catch { /* sin voz */ } if (vb) vb.innerHTML = `${icon("sound")} Guiame con voz`; };
      vb?.addEventListener("click", () => {
        if (!("speechSynthesis" in window)) return toast("Este teléfono no tiene voz disponible. Usá la guía flotante.", "err");
        if (talking) return stopVoice();
        const lines = JSON.parse(vb.dataset.say || "[]");
        talking = true;
        vb.innerHTML = `${icon("x")} Parar la voz`;
        const say = (i) => {
          if (!talking) return;
          if (i >= lines.length) {
            $("[data-guide]", host)?.dispatchEvent(new CustomEvent("ig:show", { detail: lines.length }));
            const end = new SpeechSynthesisUtterance("Listo, ya está instalada. Cerrá Safari, buscá el ícono de Vientos en tu pantalla de inicio y abrí la app desde ahí.");
            end.lang = "es-AR"; end.rate = 1.08; end.onend = stopVoice; speechSynthesis.speak(end);
            return;
          }
          $("[data-guide]", host)?.dispatchEvent(new CustomEvent("ig:show", { detail: i }));
          const u = new SpeechSynthesisUtterance(lines[i]);
          u.lang = "es-AR"; u.rate = 1.08;
          const v = speechSynthesis.getVoices().find((x) => /^es/i.test(x.lang));
          if (v) u.voice = v;
          u.onend = () => { timer = setTimeout(() => say(i + 1), 3000); };
          speechSynthesis.speak(u);
        };
        say(0);
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
          next.innerHTML = k === secs.length - 1 ? "Volver a empezar" : k === secs.length - 2 ? `${icon("check")} Ya lo agregué` : `Siguiente ${icon("right")}`;
          $(".ios-arrow", host)?.classList.toggle("off", k > 0);
        };
        g.addEventListener("ig:show", (e) => show(e.detail));
        prev.addEventListener("click", () => show(k - 1));
        next.addEventListener("click", () => show(k === secs.length - 1 ? 0 : k + 1));
      }
      const q = $("[data-qr]", host);
      if (q) qrSvg(url, 5).then((svg) => (q.innerHTML = svg)).catch(() => (q.textContent = url));
      return () => { removeEventListener("vientos:installable", ready); removeEventListener("appinstalled", installed); stopVoice(); };
    },
  };
}

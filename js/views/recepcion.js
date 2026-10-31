/* Recepción: reconoce al socio con la cámara (o se lo busca por DNI) y muestra si puede pasar según su cuota.
   Reconocimiento facial con la librería Human (vendor/human, MIT): corre entero en el navegador, no manda
   imágenes a ningún lado. De cada socio se guarda solo una huella numérica de la cara, y solo si lo aceptó.
   Recepción decide: la pantalla avisa, no abre ningún molinete. Cada entrada queda registrada (asistencia),
   una vez por día: sola al reconocer la cara de alguien que puede pasar, o con el botón al buscar por DNI. */
import { icon } from "../core/icons.js";
import { esc, fold, fmtDate, plural, $, $$ } from "../core/util.js";
import * as S from "../core/store.js";
import { avatar, toast, pageHead, limitList } from "../core/ui.js";
import { me } from "../core/auth.js";
import { SCREEN_CHANNEL } from "./pantalla.js";

/* similitud mínima (coseno de InsightFace) para decir "es tal socio" y cuántas lecturas seguidas iguales hacen falta.
   Valor inicial conservador: se ajusta con las pruebas reales (la misma persona suele dar 0,6–0,85; dos parientes, bastante menos) */
const MATCH = 0.6, STABLE = 3;
/* si el segundo socio más parecido está a menos de esta distancia, no se elige a ninguno (evita confundir) */
const MARGIN = 0.1;
/* registrar: cuántas lecturas, qué tan parecidas entre sí y qué tan distinta a las ya registradas */
const SAMPLES = 5, SAME = 0.6;
/* al registrar, si la cara se parece al 45 % a otro socio ya registrado, no se guarda (más estricto que para entrar) */
const DUP = 0.45;
/* Óvalo guía en el centro de la imagen: solo cuenta una cara que esté adentro y cerca de la cámara
   (así no se activa con alguien que pasa por atrás o al costado). Coordenadas de 0 a 1 de la imagen. */
/* la cara cuenta (y el óvalo se pone verde) solo si está centrada: el centro de la cara a poca distancia del centro
   del óvalo, y ni muy lejos (cara chica) ni pegada a la cámara */
const OVAL = { cx: 0.5, cy: 0.47, rx: 0.11, ry: 0.14, minW: 0.2, maxW: 0.7 };
const inOval = (f) => {
  const [x, y, w, h] = f.boxRaw || [];
  if (w === undefined) return false;
  const dx = (x + w / 2 - OVAL.cx) / OVAL.rx, dy = (y + h / 2 - OVAL.cy) / OVAL.ry;
  return dx * dx + dy * dy <= 1 && w >= OVAL.minW && w <= OVAL.maxW;
};
/* al elegir un socio de la búsqueda (o al terminar un registro), el cartel de recepción se queda este tiempo
   para no tapar lo que se está mirando (la cámara sigue reconociendo); mientras se escribe, solo unos segundos */
const PAUSE = 15000, TYPING = 4000;
let human = null;

/* Sonido y voz al reconocer: un "ding-dong" que sube si puede pasar, un tono neutro si no lo reconoce y dos
   notas que bajan si no puede pasar, seguidos de una frase corta. Por discreción la voz nunca dice el motivo
   (cuota vencida): eso se ve solo en la pantalla. Se puede apagar y queda guardado en este equipo. */
const SOUND_KEY = "vientos_recepcion_sonido";
const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== "0"; } catch { return true; } };
let actx = null;
const audio = () => { try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch { actx = null; } return actx; };
/* El navegador no deja sonar nada hasta que alguien toca la página. Si la cámara se prendió sola (al abrir o
   después de recargarse), se avisa con un cartelito y el primer toque en cualquier parte activa el sonido */
const activated = () => navigator.userActivation ? navigator.userActivation.hasBeenActive : true;
function soundGate() {
  if (activated() || !soundOn() || document.getElementById("rc-sound")) return;
  const b = document.createElement("button");
  b.id = "rc-sound"; b.type = "button"; b.className = "no-print";
  b.innerHTML = `${icon("sound", "sm")} Tocá acá para activar la voz de bienvenida`;
  document.body.appendChild(b);
  const unlock = () => { audio(); try { speechSynthesis.speak(new SpeechSynthesisUtterance(" ")); } catch { /* sin voz */ } b.remove(); removeEventListener("pointerdown", unlock, true); removeEventListener("keydown", unlock, true); };
  addEventListener("pointerdown", unlock, true); addEventListener("keydown", unlock, true);
}
function tones(notes) {
  const a = audio(); if (!a) return;
  let t = a.currentTime + 0.02;
  notes.forEach(([freq, dur]) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
    t += dur * 0.85;
  });
}
/* Voces en español de esta computadora, de la más natural a la más robótica: primero las "naturales"
   (Microsoft Edge trae Elena y Tomás de Argentina), después las de Google (Chrome), y al final las de Windows. */
const VOICE_KEY = "vientos_recepcion_voz";
function spanishVoices() {
  const vs = (window.speechSynthesis?.getVoices() || []).filter((v) => /^es/i.test(v.lang));
  const score = (v) => (/natural|neural/i.test(v.name) ? 0 : /online/i.test(v.name) ? 1 : /google/i.test(v.name) ? 2 : 3) * 10 + (/AR/i.test(v.lang) ? 0 : /419|US|MX/i.test(v.lang) ? 1 : 2);
  return vs.sort((a, b) => score(a) - score(b));
}
function pickVoice() {
  const vs = spanishVoices(); let saved = "";
  try { saved = localStorage.getItem(VOICE_KEY) || ""; } catch { /* sin almacenamiento */ }
  return vs.find((v) => v.name === saved) || vs[0] || null;
}
function speak(text) {
  try {
    const ss = window.speechSynthesis; if (!ss) return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice();
    u.lang = u.voice?.lang || "es-AR"; u.rate = 1; u.pitch = 1;
    ss.speak(u);
  } catch { /* sin voz */ }
}
/* el nombre corto del gimnasio para la voz ("Vientos GYM" → "Vientos") */
const gymName = () => (S.gymOf().name || "Vientos").replace(/\s*gym$/i, "").trim() || "Vientos";
function announce(kind, name) {
  if (!soundOn()) return;
  const first = String(name || "").split(" ")[0];
  if (kind === "ok") { tones([[784, 0.22], [1047, 0.38]]); setTimeout(() => speak(`¡Hola ${first}, bienvenido a ${gymName()}!`), 450); }
  else if (kind === "warn") { tones([[784, 0.22], [1047, 0.38]]); setTimeout(() => speak(`¡Hola ${first}, bienvenido a ${gymName()}! Cuando puedas, acercate a recepción.`), 450); }
  else if (kind === "bad") { tones([[659, 0.25], [494, 0.4]]); setTimeout(() => speak(`Hola ${first}, antes de entrar acercate a recepción, por favor.`), 500); }
  else if (kind === "unknown") { tones([[587, 0.35]]); setTimeout(() => speak("No te reconozco. Por favor, contactate con administración."), 400); }
}

async function loadHuman() {
  if (human) return human;
  const { default: Human } = await import("../../vendor/human/human.esm.js");
  human = new Human({
    modelBasePath: new URL("../../vendor/human/models/", import.meta.url).href,
    backend: "webgl", debug: false, cacheSensitivity: 0, warmup: "none",
    filter: { enabled: true, equalization: false },
    face: { enabled: true, detector: { rotation: true, maxDetected: 2, minConfidence: 0.5 }, mesh: { enabled: true }, iris: { enabled: false },
      /* huella de la cara con InsightFace (ArcFace): distingue mucho mejor a parientes que el modelo de fábrica */
      description: { enabled: false }, insightface: { enabled: true, modelPath: "insightface-mobilenet-swish.json" }, emotion: { enabled: false }, antispoof: { enabled: true }, liveness: { enabled: true } },
    body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false },
  });
  await human.load();
  return human;
}

/* la ventana del monitor de socios no reconoce: solo muestra */
const isScreen = () => location.hash.startsWith("#/pantalla");

/* ¿Puede pasar? Según la cuota y los días de tolerancia del gimnasio (por defecto 7) */
export function accessOf(u) {
  const grace = S.gymOf(S.spaceOf(u)).accessGraceDays ?? 7;
  const st = S.feeStatus(u), p = S.plan(u.fee?.planId);
  if (u.status !== "activo") return { cls: "bad", why: "baja", head: "No es socio activo", sub: "Su cuenta está dada de baja o sin aprobar." };
  if (st.state === "none") return { cls: "warn", head: "Sin cuota cargada", sub: "Pedile que pase por recepción a regularizar." };
  /* plan con días por semana: si ya los usó todos esta semana, recepción decide (hoy ya entró: sigue pudiendo) */
  const perWeek = S.planPerWeek(p), used = S.weekEntries(u);
  if (perWeek && used >= perWeek && !todayIn(u) && (st.state === "ok" || st.state === "soon" || -st.days <= grace))
    return { cls: "bad", why: "semana", head: "Ya usó sus días de esta semana", sub: `Su plan es de ${plural(perWeek, "vez", "veces")} por semana y ya entró ${plural(used, "vez", "veces")} desde el lunes${p ? ` · ${p.name}` : ""}.` };
  if (st.state === "ok") return { cls: "ok", head: "Puede pasar", sub: `Cuota al día · vence el ${fmtDate(u.fee.dueAt)} (en ${plural(st.days, "día", "días")})${p ? ` · ${p.name}` : ""}` };
  if (st.state === "soon") return { cls: "ok", head: "Puede pasar", sub: `Su cuota ${st.days === 0 ? "vence hoy" : `vence en ${plural(st.days, "día", "días")}`}: recordale pagar` };
  const over = Math.max(0, -st.days);
  if (over <= grace) return { cls: "warn", head: "Puede pasar, pero debe la cuota", sub: `${u.fee.unpaid ? "No pagó el alta" : `Venció hace ${plural(over, "día", "días")}`}. Tiene tolerancia hasta ${plural(grace - over, "día más", "días más")}.` };
  return { cls: "bad", why: "cuota", head: "No puede pasar", sub: `${u.fee.unpaid ? "No pagó el alta" : `Cuota vencida hace ${plural(over, "día", "días")}`}. Tiene que pagar para entrar.` };
}

const hhmm = (ts) => new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const todayIn = (u) => (S.db.checkins || []).find((c) => c.userId === u.id && new Date(c.at).toDateString() === new Date().toDateString());
/* botón o aviso de la entrada de hoy (puede venir más de una vez: pasados 30 min se puede registrar otra) */
function entryHtml(u, asistOff) {
  if (asistOff) return "";
  const hoy = (S.db.checkins || []).filter((c) => c.userId === u.id && new Date(c.at).toDateString() === new Date().toDateString()).sort((a, b) => a.at - b.at);
  if (hoy.length) {
    const txt = `<small class="rc-ok">${icon("checkc", "xs")} Entró hoy a las ${hoy.map((c) => hhmm(c.at)).join(" y a las ")}</small>`;
    return Date.now() - hoy[hoy.length - 1].at < S.REENTRY ? txt
      : `${txt}<button class="btn primary sm" type="button" data-in="${u.id}" data-via="dni">${icon("check", "sm")} Registrar otra entrada</button>`;
  }
  const a = accessOf(u), pay = payBtn(u, a);
  return a.cls === "bad"
    ? `<div class="rc-faceacts">${pay}<button class="btn ghost sm" type="button" data-in="${u.id}" data-via="manual">${icon("check", "sm")} Dejar pasar igual</button></div>`
    : `<div class="rc-faceacts"><button class="btn primary sm" type="button" data-in="${u.id}" data-via="dni">${icon("check", "sm")} Registrar entrada</button>${pay}</div>`;
}
/* "Cobrar" ahí mismo cuando el problema es la cuota (vencida, con aviso de deuda o sin cargar) */
function payBtn(u, a = accessOf(u)) {
  const st = S.feeStatus(u);
  return a.why === "cuota" || (a.cls === "warn" && st.state !== "ok") ? `<button class="btn ${a.cls === "bad" ? "primary" : "ghost"} sm" type="button" data-pay="${u.id}">${icon("card", "sm")} Cobrar</button>` : "";
}
const WHY = { cuota: "cuota vencida", semana: "ya usó sus días de la semana", baja: "no es socio activo" };
/* recordatorio para la pantalla de los socios: solo si vence pronto (nunca "vencida": eso lo ve solo recepción) */
function dueNote(u) {
  const st = S.feeStatus(u);
  if (st.state !== "soon" || !u.fee?.dueAt) return "";
  if (st.days === 0) return "Tu cuota vence hoy";
  const d = new Date(u.fee.dueAt);
  return `Tu cuota vence el ${d.toLocaleDateString("es-AR", { weekday: "long" })} ${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}`;
}
/* ¿después del intento entró ese mismo día? (pagó y pasó, o lo dejaron pasar) */
function resolvedAt(a) {
  const day = new Date(a.at).toDateString();
  return (S.db.checkins || []).find((c) => c.userId === a.userId && c.at >= a.at && new Date(c.at).toDateString() === day) || null;
}
/* registro manual: si recepción lo deja pasar sin poder, queda anotado el motivo */
function manualIn(u, via) {
  const a = accessOf(u);
  return S.api.checkIn(u.id, via, me()?.id, via === "manual" ? { override: WHY[a.why] || a.head } : {});
}
/* Aviso discreto en cualquier pantalla del panel cuando la cámara frena a alguien y recepción no está mirando
   la pantalla de Recepción. No se va solo: se resuelve (Cobrar / Dejar pasar) o se cierra. */
function alertBar(u, a) {
  if (location.hash.startsWith("#/panel/recepcion") || isScreen()) return;
  let box = document.getElementById("rc-alerts");
  if (!box) {
    box = document.createElement("div"); box.id = "rc-alerts"; box.setAttribute("role", "status"); document.body.appendChild(box);
    box.addEventListener("click", async (e) => {
      const it = e.target.closest(".rc-alert"); if (!it) return;
      const m = S.user(it.dataset.u);
      if (e.target.closest("[data-x]")) { it.remove(); return; }
      if (e.target.closest("[data-apay]")) { const { paySheet } = await import("./panel.js"); paySheet(m, () => it.remove()); return; }
      if (e.target.closest("[data-apass]")) { manualIn(m, "manual"); toast(`Entrada de ${m.name.split(" ")[0]} registrada`); it.remove(); }
    });
  }
  box.querySelector(`[data-u="${u.id}"]`)?.remove();
  box.insertAdjacentHTML("afterbegin", `<div class="rc-alert" data-u="${u.id}">${avatar(u, "sm")}<span><b>${esc(u.name)}</b><small>Quiso entrar a las ${hhmm(Date.now())} · ${esc(WHY[a.why] || a.head)}</small></span>
    <span class="rc-alert-acts">${a.why === "cuota" ? `<button class="btn primary sm" type="button" data-apay>Cobrar</button>` : ""}<button class="btn ghost sm" type="button" data-apass>Dejar pasar</button><button class="icon-btn sm" type="button" data-x aria-label="Cerrar aviso">${icon("x", "sm")}</button></span></div>`);
  while (box.children.length > 3) box.lastElementChild.remove();
}
const resultCard = (u, extra = "") => { const a = accessOf(u); return `<div class="rc-card ${a.cls}">${avatar(u, "xl")}<div class="rc-info"><span class="rc-name">${esc(u.name)}</span><small>DNI ${esc(u.user || "—")}</small><b class="rc-head">${icon(a.cls === "bad" ? "x" : a.cls === "warn" ? "alert" : "checkc", "sm")} ${esc(a.head)}</b><small>${esc(a.sub)}</small>${extra}</div></div>`; };

/* ---------------------------------------------------------------------------------------------------------
   Motor de reconocimiento: vive fuera de la pantalla Recepción. Una vez prendida la cámara, sigue reconociendo,
   saludando, registrando entradas y avisando a la pantalla de los socios aunque quien atiende se vaya a otra
   parte del panel (cargar un socio, cobrar, ver el resumen). Solo se apaga con "Apagar".
   La pantalla Recepción, cuando está abierta, se "engancha" (ui) para mostrar el video, el resultado y los botones.
   --------------------------------------------------------------------------------------------------------- */
const faceOff = () => S.MODE === "supabase" && !!S.db.off?.rostros;
const asistOff = () => S.MODE === "supabase" && !!S.db.off?.asistencia;
const todayCount = () => new Set(S.checkinsOf().filter((c) => new Date(c.at).toDateString() === new Date().toDateString()).map((c) => c.userId)).size;
const socios = () => S.activeMembers().filter((u) => S.inSpace(u) && u.status === "activo");
/* las caras registradas con el modelo anterior hay que registrarlas de nuevo */
const FACE_MODEL = "arc1";
const faceOk = (u) => S.faceOf(u.id)?.model === FACE_MODEL;
const enrolled = () => socios().filter(faceOk).length;
const known = () => socios().filter((u) => S.faceConsent(u) && faceOk(u));
const IDLE = `<p class="muted">Acá aparece el socio reconocido o el que busques por DNI.</p>`;
/* el cartel se borra 1,5 s después de que la persona sale del óvalo; si entra el siguiente, cambia enseguida */
const HOLD = 1500;
const CAM_KEY = "vientos_recepcion_camara";
const wanted = () => { try { return localStorage.getItem(CAM_KEY) === "1"; } catch { return false; } };
const want = (on) => { try { localStorage.setItem(CAM_KEY, on ? "1" : "0"); } catch { /* sin almacenamiento */ } };

const E = {
  stream: null, video: null, timer: 0, wake: null, sync: 0, starting: false,
  last: null, count: 0, unknown: 0, cam: null, lastUnknownVoice: 0, holdUntil: 0, ovalOn: null,
  enrollFor: null, samples: [], capturing: false, status: "Tocá “Prender cámara” para empezar.",
};
/* lo que la pantalla Recepción muestra cuando está abierta (si no, no hace nada) */
let ui = null;
const say = (html) => { E.status = html; ui?.say(html); };
const showResult = (html) => ui?.result(html);
const screen = "BroadcastChannel" in window ? new BroadcastChannel(SCREEN_CHANNEL) : null;
const send = (m) => { try { screen?.postMessage(m); } catch { /* sin pantalla */ } };
/* lo último que se le mostró a la pantalla de los socios: se repite mientras la persona sigue frente a la cámara
   (si no, a los pocos segundos volvería a "Mirá a la cámara") y se le manda a una pantalla recién abierta */
const toScreen = (m) => { if (m.t !== "oval") { E.scr = m; E.scrAt = Date.now(); } send(m); };
screen?.addEventListener("message", ({ data: d }) => {
  if (d?.t !== "hello" || !E.stream) return;           /* solo responde la compu que tiene la cámara prendida */
  send({ t: "oval", on: !!E.ovalOn }); send(E.scr || { t: "idle" });
});
/* parecido entre dos huellas: coseno (1 = idénticas). Las huellas del modelo anterior no se comparan */
const sim = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
};
/* mientras recepción atiende a alguien, el cartel de recepción no se pisa; la cámara sigue reconociendo,
   registrando entradas y saludando en la pantalla de los socios (no se frena nunca) */
const hold = (ms = PAUSE) => { E.holdUntil = Date.now() + ms; };
const holding = () => Date.now() < E.holdUntil;

/* muestra el cartel y suena una sola vez por persona (no en cada lectura) */
function camShow(id, html, kind, name, note = "") {
  if (E.cam?.id !== id) {
    if (!holding()) showResult(html);
    /* si recepción está atendiendo a alguien que no tiene rostro, no le dice "no te reconozco" */
    announce(holding() && id === "?" ? "silent" : kind, name);
    toScreen({ t: "show", kind, name, gym: gymName(), note });
  }
  E.cam = { id, seen: Date.now() };
}
function camExpire() { if (E.cam && Date.now() - E.cam.seen > HOLD) { if (!holding()) showResult(IDLE); E.cam = null; toScreen({ t: "idle" }); } }

async function loop() {
  if (!E.stream) return;
  try {
    const res = await human.detect(E.video);
    /* si hay más de una cara, la más grande (la que está más cerca de la cámara) */
    const faces = (res.face || []).slice().sort((a, b) => (b.box?.[2] || 0) * (b.box?.[3] || 0) - (a.box?.[2] || 0) * (a.box?.[3] || 0));
    const f = faces.filter(inOval)[0];
    /* verde mientras la cara está centrada; se apaga cuando se va (una lectura fallida suelta no lo hace parpadear) */
    E.ovalMiss = f ? 0 : (E.ovalMiss || 0) + 1;
    const lit = !!f || (E.ovalOn && E.ovalMiss < 3);
    ui?.oval(lit);
    if (E.ovalOn !== lit) { E.ovalOn = lit; toScreen({ t: "oval", on: lit }); }
    /* la persona sigue ahí: se le vuelve a mandar el cartel a la pantalla de los socios */
    if (E.scr && E.scr.t !== "idle" && Date.now() - E.scrAt > 2000) { E.scrAt = Date.now(); send(E.scr); }
    /* terminó de atender: el cartel de recepción vuelve a mostrar la cámara */
    if (E.holdUntil && !holding() && !E.enrollFor) { E.holdUntil = 0; E.cam = null; showResult(IDLE); }
    if (E.enrollFor) { if (f) await enrollStep(f, faces.length); else if (E.capturing) say("Que ponga la cara dentro del óvalo, cerca de la cámara…"); }
    else if (!f) { say(faces.length ? "Poné la cara en el centro del óvalo, cerca de la cámara…" : "Esperando una cara frente a la cámara…"); E.count = 0; E.unknown = 0; camExpire(); }
    else if (f.embedding?.length) {
      /* sin ningún rostro registrado también se le avisa a la persona que no la reconoce */
      const list = known();
      {
        /* parecido con cada rostro registrado: el mejor tiene que superar el mínimo y sacarle ventaja al segundo */
        const order = list.map((x, i) => [sim(f.embedding, S.faceOf(x.id).emb), i]).sort((a, b) => b[0] - a[0]);
        const [best = 0, bi = -1] = order[0] || [], second = order[1]?.[0] || 0;
        const clear = best - second >= MARGIN;
        const u = best >= MATCH && clear ? list[bi] : null;
        const fake = typeof f.real === "number" && f.real < 0.5;
        E.count = u && u.id === E.last ? E.count + 1 : 1; E.last = u?.id || null;
        E.unknown = u ? 0 : E.unknown + 1;
        if (u && E.count >= STABLE) {
          /* entra solo si puede pasar y no parece una foto; si no, recepción decide con el botón */
          const acc = accessOf(u);
          if (E.cam?.id !== u.id && !asistOff() && !fake) {
            if (acc.cls !== "bad") { if (S.api.checkIn(u.id, "cara", me()?.id)) ui?.today(); }
            /* no podía pasar: queda anotado y, si recepción está en otra pantalla, le aparece un aviso */
            else if (S.api.logAttempt(u.id, acc.why, me()?.id)) { ui?.today(); alertBar(u, acc); }
          }
          camShow(u.id, resultCard(u, (fake ? `<small class="rc-warn">${icon("alert", "xs")} Ojo: podría ser una foto o una pantalla.</small>` : "") + entryHtml(u, asistOff())), fake ? "unknown" : acc.cls, u.name, fake ? "" : dueNote(u));
          /* la huella acompaña los cambios de la cara (barba, pelo, anteojos): si lo reconoce con mucha
             seguridad y no es una foto, se ajusta un poco, como mucho una vez por día */
          const fr = S.faceOf(u.id);
          if (!fake && best >= 0.7 && best - second >= 0.25 && fr && fr.upd !== new Date().toDateString()) {
            /* mismo promedio que al registrarla (90 % lo guardado + 10 % la lectura de hoy) */
            S.api.saveFace(u.id, fr.emb.map((v, i) => v * 0.9 + f.embedding[i] * 0.1), { upd: new Date().toDateString(), since: fr.since || fr.at, model: FACE_MODEL });
          }
          say(`Reconocido: <b>${esc(u.name)}</b> (${Math.round(best * 100)} %)`);
        } else if (!u && E.unknown >= STABLE) {
          /* otra persona que no está registrada: el cartel cambia enseguida */
          const dudoso = best >= MATCH && !clear;
          const voice = Date.now() - E.lastUnknownVoice > 20000;
          camShow("?", `<div class="rc-card none">${icon("user", "lg")}<div class="rc-info"><span class="rc-name">${dudoso ? "No estoy seguro" : "No reconocido"}</span><b class="rc-head">Buscalo por DNI</b><small>${dudoso ? "Se parece a más de un socio registrado." : "No está registrado o no lo reconozco bien."}</small></div></div>`, voice ? "unknown" : "silent");
          if (voice) E.lastUnknownVoice = Date.now();
          say(dudoso ? "No estoy seguro de quién es. Buscalo por DNI." : "No lo reconozco. Buscalo por DNI.");
        }
      }
    }
  } catch (e) { console.warn(e); }
  E.timer = setTimeout(loop, 250);
}

/* Registrar el rostro, guiado: se pausa el reconocimiento, la persona se pone SOLA frente a la cámara,
   recepción toca "Empezar", cuenta 3-2-1 y toma 5 lecturas. No guarda si hay dos caras, si las lecturas
   no son de la misma persona o si esa cara ya está registrada como otro socio. */
const enrollPanel = (html) => showResult(`<div class="rc-enroll">${html}</div>`);
function askEnroll(u) {
  E.enrollFor = u; E.samples = []; E.capturing = false; E.cam = null;
  enrollPanel(`<b class="rc-name">Registrar el rostro de ${esc(u.name)}</b>
    <ol><li>Que <b>${esc(u.name.split(" ")[0])}</b> se ponga <b>solo/a</b> frente a la cámara, a medio metro, mirando de frente.</li>
    <li>Que no haya nadie más en la imagen (tampoco quien atiende).</li><li>Buena luz de frente, sin gorra ni anteojos oscuros.</li></ol>
    <div class="row-btns"><button class="btn primary" type="button" data-go>${icon("play", "sm")} Empezar</button><button class="btn ghost" type="button" data-cancel>Cancelar</button></div>`);
  say(`Registro de <b>${esc(u.name)}</b>: que se ponga solo/a frente a la cámara y tocá “Empezar”.`);
  toScreen({ t: "enroll", big: `Hola ${u.name.split(" ")[0]}`, small: "Ponete solo/a frente a la cámara, dentro del óvalo" });
}
function cancelEnroll(msg) {
  toScreen({ t: "idle" }); E.enrollFor = null; E.samples = []; E.capturing = false;
  if (msg) { enrollPanel(msg); hold(); } else E.holdUntil = 0;
  say("Esperando una cara frente a la cámara…");
}
async function countdown() {
  for (const n of [3, 2, 1]) {
    if (!E.enrollFor) return;
    say(`Registrando a <b>${esc(E.enrollFor.name)}</b> en ${n}…`); toScreen({ t: "enroll", big: String(n), small: "Mirá de frente a la cámara, sin moverte" });
    await new Promise((r) => setTimeout(r, 700));
  }
  E.samples = []; E.capturing = true;
}
async function enrollStep(f, n) {
  if (!E.capturing) return;                                   /* esperando que toquen "Empezar" */
  if (n > 1) { say("Hay más de una persona en la imagen: que quede solo/a el socio."); E.samples = []; return; }
  if (!f.embedding?.length || (f.score ?? 1) < 0.7) { say("Mirá de frente a la cámara, con buena luz…"); return; }
  if (E.samples.length && sim(E.samples[0], f.embedding) < SAME) { say("Se movió o cambió la persona: empiezo de nuevo."); E.samples = []; return; }
  E.samples.push(f.embedding);
  say(`Registrando el rostro de <b>${esc(E.enrollFor.name)}</b>… ${E.samples.length} de ${SAMPLES}`);
  if (E.samples.length < SAMPLES) return;
  E.capturing = false;
  const emb = E.samples[0].map((_, i) => E.samples.reduce((a, x) => a + x[i], 0) / E.samples.length);
  /* ¿esa cara ya es de otro socio? (por ejemplo, quedó quien atiende frente a la cámara) */
  const dup = known().filter((x) => x.id !== E.enrollFor.id).map((x) => [sim(emb, S.faceOf(x.id).emb), x]).sort((a, b) => b[0] - a[0])[0];
  if (dup && dup[0] >= DUP) {
    const who = dup[1], first = E.enrollFor.name.split(" ")[0];
    return cancelEnroll(`<div class="rc-card bad"><div class="rc-info"><span class="rc-name">No se registró</span><b class="rc-head">${icon("alert", "sm")} Esa cara ya es de ${esc(who.name)}</b><small>Parece que frente a la cámara estaba ${esc(who.name.split(" ")[0])} y no ${esc(first)}. Probá de nuevo con ${esc(first)} solo/a frente a la cámara.</small></div></div>`);
  }
  const u = E.enrollFor;
  S.api.saveFace(u.id, Array.from(emb), { model: FACE_MODEL });
  E.enrollFor = null; E.samples = [];
  toast(`Rostro de ${u.name.split(" ")[0]} registrado`);
  toScreen({ t: "enroll", big: "¡Listo!", small: "Tu rostro quedó registrado" }); setTimeout(() => toScreen({ t: "idle" }), 2500);
  showResult(resultCard(u, `<small class="rc-ok">${icon("checkc", "xs")} Rostro registrado. Para probar: que se aleje y vuelva a mirar a la cámara.</small>`));
  ui?.list();
  hold();
  say("Rostro registrado. Ya lo reconoce: que se aleje y vuelva a mirar a la cámara.");
}

/* la cámara queda prendida hasta que recepción la apague: se recuerda en este equipo y, si se recarga la página,
   vuelve a prenderse sola (sin importar en qué parte del panel esté). La pantalla no se apaga mientras tanto. */
const keepAwake = async () => { try { E.wake = await navigator.wakeLock?.request("screen"); } catch { E.wake = null; } };
export async function startCamera() {
  if (E.stream || E.starting || faceOff()) return;
  E.starting = true; want(true); ui?.buttons();
  say("Cargando el reconocimiento facial… (la primera vez tarda unos segundos)");
  try {
    await loadHuman();
    if (S.MODE === "supabase") { try { await S.remote().reloadFaces(); ui?.list(); } catch (err) { console.warn(err); } }
    E.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    if (!E.video) { E.video = document.createElement("video"); E.video.muted = true; E.video.playsInline = true; }
    E.video.srcObject = E.stream; await E.video.play();
    ui?.attach();
    say("Esperando una cara frente a la cámara…");
    soundGate();
    /* muchos celulares hacen las cuentas de la placa de video con menos decimales: la huella sale menos precisa */
    let low = false;
    try { low = human.tf.getBackend() === "webgl" && !human.tf.env().getBool("WEBGL_RENDER_FLOAT32_CAPABLE"); } catch { /* sin datos */ }
    if (low) toast("Este equipo reconoce caras con menos precisión. Para la recepción usá una computadora con cámara web.", "err");
    keepAwake();
    /* si la cámara se corta sola (se desenchufó, la tomó otro programa), se intenta prender de nuevo */
    E.stream.getVideoTracks()[0]?.addEventListener("ended", () => { E.stream = null; if (wanted()) setTimeout(startCamera, 2000); });
    /* con servidor: cada minuto revisa qué rostros cambiaron en otro equipo (los cambios hechos acá valen al instante) */
    clearInterval(E.sync);
    if (S.MODE === "supabase") E.sync = setInterval(async () => { try { if (await S.remote().syncFaces()) ui?.list(); } catch (err) { console.warn(err); } }, 60000);
    loop();
  } catch (e) {
    console.warn(e); E.stream = null;
    say(e?.name === "NotAllowedError" ? "No hay permiso para usar la cámara. Permitilo en el navegador (ícono de la cámara, arriba)." : "No se pudo prender la cámara. Revisá que esté conectada.");
  } finally { E.starting = false; ui?.buttons(); }
}
export function stopCamera() {
  want(false);
  clearTimeout(E.timer); clearInterval(E.sync);
  try { E.wake?.release(); } catch { /* nada */ } E.wake = null;
  E.stream?.getTracks().forEach((t) => t.stop()); E.stream = null;
  if (E.video) E.video.srcObject = null;
  E.enrollFor = null; E.capturing = false; E.cam = null;
  toScreen({ t: "idle" }); ui?.attach(); ui?.buttons();
  say("Cámara apagada.");
}
export const cameraOn = () => !!E.stream;
/* al abrir la app (en cualquier pantalla del panel): si la cámara había quedado prendida en este equipo, se prende */
export function resumeCamera() { if (wanted() && !E.stream && !isScreen()) startCamera(); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && wanted() && !isScreen()) { if (!E.stream) startCamera(); else keepAwake(); } });

export function recepcionView() {
  return {
    layout: "panel", nav: "recepcion", title: "Recepción",
    html: `${pageHead({ title: "Recepción", kicker: "Entrada del gimnasio" })}
      <div class="rc-grid">
        <section class="card rc-cam">
          <div class="card-h"><h2>${icon("eye", "sm")} Reconocimiento facial</h2><span class="muted" data-enrolled>${plural(enrolled(), "rostro registrado", "rostros registrados")}</span></div>
          ${faceOff() ? `<p class="muted">El reconocimiento facial todavía no está activado en el servidor. Mientras tanto, buscá al socio por DNI.</p>` : `
          <div class="rc-video"><video data-video playsinline muted></video><div class="rc-oval" data-oval aria-hidden="true"></div><div class="rc-overlay" data-status>${E.status}</div></div>
          <div class="row-btns"><button class="btn primary" type="button" data-start>${icon("play", "sm")} Prender cámara</button><button class="btn ghost" type="button" data-stop hidden>${icon("pause", "sm")} Apagar</button><button class="btn ghost" type="button" data-sound aria-pressed="${soundOn()}">${icon(soundOn() ? "sound" : "mute", "sm")} Sonido: ${soundOn() ? "sí" : "no"}</button></div>
          <p class="muted tiny">Una vez prendida, la cámara sigue reconociendo aunque vayas a otra parte del panel. Se apaga solo con “Apagar”.</p>
          <label class="field rc-voice"><span>Voz</span><div class="rc-voice-row"><select data-voice></select><button class="btn ghost sm" type="button" data-try>${icon("sound", "sm")} Probar</button></div></label>
          <div class="rc-screen"><button class="btn ghost sm" type="button" data-screen>${icon("ext", "sm")} Abrir pantalla para socios</button><small class="muted">Se abre en otra ventana: arrastrala al monitor que mira la gente y tocá “Pantalla completa”. Muestra solo la cámara y el saludo.</small></div>
          <details class="rc-list" data-list><summary data-enrolled-sum>Rostros registrados</summary><div data-faces></div></details>
          <p class="muted tiny">La cámara corre en esta computadora: no se guardan fotos ni videos. Solo reconoce a los socios que aceptaron el reconocimiento facial y tienen su rostro registrado.</p>`}
        </section>
        <section class="card">
          <div class="card-h"><h2>${icon("search", "sm")} Resultado</h2>${asistOff() ? "" : `<a class="pill" data-today href="#/panel/entradas">Hoy entraron ${todayCount()}</a>`}</div>
          <div data-result>${IDLE}</div>
          <label class="search rc-search">${icon("search", "sm")}<input type="search" data-q placeholder="Buscar por DNI o nombre" aria-label="Buscar socio" autocomplete="off"></label>
          <div data-found></div>
          ${asistOff() ? "" : `<details class="rc-tried" data-tried-box hidden><summary data-tried-sum></summary><div data-tried></div></details>`}
        </section>
      </div>`,
    mount(host) {
      const video = $("[data-video]", host), status = $("[data-status]", host), result = $("[data-result]", host);
      const show = (u, extra) => { result.innerHTML = resultCard(u, extra); };
      /* se engancha al motor: desde ahora lo que pase en la cámara se ve en esta pantalla */
      ui = {
        say: (html) => { if (status) status.innerHTML = html; },
        result: (html) => { result.innerHTML = html; },
        oval: (on) => $("[data-oval]", host)?.classList.toggle("on", on),
        today: () => { const t = $("[data-today]", host); if (t) t.textContent = `Hoy entraron ${todayCount()}`; triedList(); },
        attach: () => { if (video) { video.srcObject = E.stream || null; if (E.stream) video.play().catch(() => {}); } },
        buttons: () => { const on = !!E.stream || E.starting; const st = $("[data-start]", host), sp = $("[data-stop]", host); if (st) { st.hidden = on; st.disabled = E.starting; } if (sp) sp.hidden = !on; },
        list: refreshList,
      };
      ui.attach(); ui.buttons();
      /* quisieron entrar hoy sin poder: si después pagó o pasó, figura como resuelto */
      function triedList() {
        const box = $("[data-tried]", host), sum = $("[data-tried-sum]", host), wrap = $("[data-tried-box]", host);
        if (!box) return;
        const today = new Date().toDateString();
        const list = S.attemptsOf().filter((a) => new Date(a.at).toDateString() === today).sort((a, b) => b.at - a.at);
        const pend = list.filter((a) => !resolvedAt(a)).length;
        wrap.hidden = !list.length;
        sum.innerHTML = `Quisieron entrar sin poder hoy: <b>${list.length}</b>${pend ? ` <span class="pill bad">${pend} sin resolver</span>` : ""}`;
        box.innerHTML = list.map((a) => { const u = S.user(a.userId), r = resolvedAt(a);
          return `<button type="button" class="mrow" data-pick="${a.userId}">${avatar(u, "sm")}<span><b>${esc(u?.name || "Socio")}</b><small>${hhmm(a.at)} · ${esc(WHY[a.reason] || "no podía pasar")}${r ? ` · después entró a las ${hhmm(r.at)}${r.via === "manual" ? " (lo dejaron pasar)" : ""}` : ""}</small></span>${r ? icon("checkc", "sm") : icon("right", "sm")}</button>`; }).join("");
        limitList(box, { size: 8 }).apply(true);
      }
      triedList();
      /* lista de rostros registrados: se puede borrar uno que quedó mal (después se vuelve a registrar) */
      function refreshList() {
        const box = $("[data-faces]", host), sum = $("[data-enrolled-sum]", host), n = enrolled();
        const head = $("[data-enrolled]", host); if (head) head.textContent = plural(n, "rostro registrado", "rostros registrados");
        if (sum) sum.textContent = `Ver los rostros registrados (${n})`;
        if (!box) return;
        const list = socios().filter((u) => S.faceOf(u.id)).sort((a, b) => a.name.localeCompare(b.name, "es"));
        box.innerHTML = list.map((u) => `<div class="mrow">${avatar(u, "sm")}<span><b>${esc(u.name)}</b><small>${faceOk(u) ? `Registrado el ${esc(fmtDate(S.faceOf(u.id).since || S.faceOf(u.id).at))}` : "Registro anterior: hay que registrarlo de nuevo"}</small></span><button class="btn ghost sm" type="button" data-unface="${u.id}">${icon("trash", "sm")} Borrar</button></div>`).join("") || `<p class="muted tiny">Todavía no hay rostros registrados.</p>`;
        limitList(box, { size: 20 }).apply(true);
      }
      refreshList();

      $("[data-start]", host)?.addEventListener("click", () => { audio(); startCamera(); });
      $("[data-stop]", host)?.addEventListener("click", () => stopCamera());
      /* lista de voces (el navegador las carga un instante después) */
      const sel = $("[data-voice]", host);
      const fillVoices = () => {
        if (!sel) return;
        const vs = spanishVoices(), cur = pickVoice()?.name;
        sel.innerHTML = vs.length ? vs.map((v) => `<option value="${esc(v.name)}" ${v.name === cur ? "selected" : ""}>${esc(v.name.replace(/^Microsoft |^Google /, ""))} · ${esc(v.lang)}${/natural|neural|online/i.test(v.name) ? " (natural)" : ""}</option>`).join("") : `<option>Esta computadora no tiene voces en español</option>`;
      };
      fillVoices();
      window.speechSynthesis?.addEventListener?.("voiceschanged", fillVoices);
      sel?.addEventListener("change", () => { try { localStorage.setItem(VOICE_KEY, sel.value); } catch { /* sin almacenamiento */ } speak("¡Hola! Bienvenido a Vientos."); });
      $("[data-try]", host)?.addEventListener("click", () => { audio(); tones([[784, 0.22], [1047, 0.38]]); setTimeout(() => speak(`¡Hola Andriy, bienvenido a ${gymName()}!`), 450); });
      $("[data-sound]", host)?.addEventListener("click", (e) => {
        const on = !soundOn(); try { localStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch { /* sin almacenamiento */ }
        e.currentTarget.innerHTML = `${icon(on ? "sound" : "mute", "sm")} Sonido: ${on ? "sí" : "no"}`; e.currentTarget.setAttribute("aria-pressed", on);
        if (on) { audio(); tones([[784, 0.18], [1047, 0.3]]); }
      });
      $("[data-screen]", host)?.addEventListener("click", () => {
        const w = window.open(`${location.pathname}${location.search}#/pantalla`, "vientos-pantalla", "popup,width=1000,height=700");
        if (!w) toast("El navegador bloqueó la ventana: permití las ventanas emergentes para esta página.", "err");
      });
      $("[data-faces]", host)?.addEventListener("click", (e) => {
        const b = e.target.closest("[data-unface]"); if (!b) return;
        const u = S.user(b.dataset.unface);
        if (!confirm(`¿Borrar el rostro registrado de ${u.name}? Después se lo puede volver a registrar.`)) return;
        S.api.deleteFace(u.id); toast("Rostro borrado"); refreshList();
      });
      /* si la había dejado prendida (y se recargó la página), se prende sola */
      resumeCamera();

      /* búsqueda por DNI o nombre: siempre disponible (plan B). Mientras se usa, el reconocimiento queda en pausa */
      const q = $("[data-q]", host), found = $("[data-found]", host);
      q.addEventListener("input", () => {
        hold(TYPING);
        const t = fold(q.value.trim());
        if (t.length < 2) { found.innerHTML = ""; return; }
        const list = socios().filter((u) => fold(`${u.user} ${u.name}`).includes(t)).slice(0, 6);
        found.innerHTML = list.map((u) => `<button type="button" class="mrow" data-pick="${u.id}">${avatar(u, "sm")}<span><b>${esc(u.name)}</b><small>DNI ${esc(u.user || "—")} · ${esc(accessOf(u).head)}</small></span>${icon("right", "sm")}</button>`).join("") || `<p class="muted">No hay socios con ese DNI o nombre.</p>`;
      });
      found.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-pick]"); if (!b) return;
        let u = S.user(b.dataset.pick);
        /* con servidor: datos frescos del socio (consentimiento, cuota, rostro) antes de mostrarlo */
        if (S.MODE === "supabase") { b.disabled = true; try { u = await S.remote().refreshMember(u.id) || u; } catch (err) { console.warn(err); } }
        const extra = faceOff() ? "" : S.faceConsent(u)
          ? `<div class="rc-faceacts"><button class="btn ghost sm" type="button" data-enroll="${u.id}">${icon("user", "sm")} ${S.faceOf(u.id) ? "Volver a registrar su rostro" : "Registrar su rostro"}</button>
             ${S.faceOf(u.id) ? `<button class="btn ghost sm" type="button" data-delface="${u.id}">${icon("trash", "sm")} Borrar su rostro</button>` : ""}</div>
             <button class="linkbtn tiny" type="button" data-revoke="${u.id}">Retirar el reconocimiento facial</button>`
          : `<label class="check rc-consent"><input type="checkbox" data-agree><span>El socio aceptó que se use su rostro para identificarlo al entrar (se lo preguntaste y firmó).</span></label>
             <button class="btn ghost sm" type="button" data-enroll="${u.id}" data-needs-agree>${icon("user", "sm")} Registrar su rostro</button>`;
        hold();
        show(u, entryHtml(u, asistOff()) + extra);
        q.value = ""; found.innerHTML = "";
      });
      result.addEventListener("click", async (e) => {
        const inb = e.target.closest("[data-in]");
        const pb = e.target.closest("[data-pay]");
        if (pb) { const u = S.user(pb.dataset.pay); const { paySheet } = await import("./panel.js"); paySheet(u, () => show(S.user(u.id), entryHtml(S.user(u.id), asistOff()))); return; }
        if (inb) { const u = S.user(inb.dataset.in); manualIn(u, inb.dataset.via); ui?.today(); toast(`Entrada de ${u.name.split(" ")[0]} registrada`); show(u, entryHtml(u, asistOff())); return; }
        if (e.target.closest("[data-go]")) { if (!E.stream) await startCamera(); e.target.closest("[data-go]").disabled = true; countdown(); return; }
        if (e.target.closest("[data-cancel]")) { cancelEnroll(); result.innerHTML = IDLE; return; }
        const df = e.target.closest("[data-delface]");
        if (df) {
          const u = S.user(df.dataset.delface);
          if (!confirm(`¿Borrar el rostro registrado de ${u.name}? Después lo podés volver a registrar.`)) return;
          S.api.deleteFace(u.id); toast("Rostro borrado"); ui?.list();
          show(u, entryHtml(u, asistOff()) + `<button class="btn ghost sm" type="button" data-enroll="${u.id}">${icon("user", "sm")} Registrar su rostro</button>`); return;
        }
        const rv = e.target.closest("[data-revoke]");
        if (rv) {
          const u = S.user(rv.dataset.revoke);
          if (!confirm(`¿Retirar el reconocimiento facial de ${u.name}? Se borra su rostro y entra con su DNI.`)) return;
          S.api.staffFaceConsent(u.id, false, me()?.id); toast("Retirado: se borró su rostro"); ui?.list(); show(u, entryHtml(u, asistOff())); return;
        }
        const b = e.target.closest("[data-enroll]"); if (!b) return;
        if (b.hasAttribute("data-needs-agree")) {
          if (!$("[data-agree]", result)?.checked) { toast("Primero preguntale si acepta y tildá la casilla.", "err"); return; }
          S.api.staffFaceConsent(b.dataset.enroll, true, me()?.id);
        }
        if (!E.stream) await startCamera();
        askEnroll(S.user(b.dataset.enroll));
      });
      /* al irse de esta pantalla la cámara NO se apaga: solo se desengancha lo que se muestra.
         Si había un registro de rostro a medio hacer o una pausa por la búsqueda, se cancela. */
      return () => { ui = null; if (video) video.srcObject = null; if (E.enrollFor) cancelEnroll(); E.holdUntil = 0; };
    },
  };
}

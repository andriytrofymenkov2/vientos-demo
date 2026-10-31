/* Recepción: reconoce al socio con la cámara (o se lo busca por DNI) y muestra si puede pasar según su cuota.
   Reconocimiento facial con la librería Human (vendor/human, MIT): corre entero en el navegador, no manda
   imágenes a ningún lado. De cada socio se guarda solo una huella numérica de la cara, y solo si lo aceptó.
   Recepción decide: la pantalla avisa, no abre ningún molinete. Cada entrada queda registrada (asistencia),
   una vez por día: sola al reconocer la cara de alguien que puede pasar, o con el botón al buscar por DNI. */
import { icon } from "../core/icons.js";
import { esc, fold, fmtDate, plural, $, $$ } from "../core/util.js";
import * as S from "../core/store.js";
import { avatar, toast, pageHead } from "../core/ui.js";
import { me } from "../core/auth.js";
import { SCREEN_CHANNEL } from "./pantalla.js";

/* similitud mínima para decir "es tal socio" y cuántas lecturas seguidas iguales hacen falta */
const MATCH = 0.55, STABLE = 2;
/* si el segundo socio más parecido está a menos de esta distancia, no se elige a ninguno (evita confundir) */
const MARGIN = 0.06;
/* registrar: cuántas lecturas, qué tan parecidas entre sí y qué tan distinta a las ya registradas */
const SAMPLES = 5, SAME = 0.7;
/* Óvalo guía en el centro de la imagen: solo cuenta una cara que esté adentro y cerca de la cámara
   (así no se activa con alguien que pasa por atrás o al costado). Coordenadas de 0 a 1 de la imagen. */
const OVAL = { cx: 0.5, cy: 0.47, rx: 0.2, ry: 0.33, minW: 0.2 };
const inOval = (f) => {
  const [x, y, w, h] = f.boxRaw || [];
  if (w === undefined) return false;
  const dx = (x + w / 2 - OVAL.cx) / OVAL.rx, dy = (y + h / 2 - OVAL.cy) / OVAL.ry;
  return dx * dx + dy * dy <= 1 && w >= OVAL.minW;
};
/* tras usar la búsqueda o registrar, el reconocimiento queda en pausa este tiempo (o hasta "Seguir reconociendo") */
const PAUSE = 30000;
let human = null;

/* Sonido y voz al reconocer: un "ding-dong" que sube si puede pasar, un tono neutro si no lo reconoce y dos
   notas que bajan si no puede pasar, seguidos de una frase corta. Por discreción la voz nunca dice el motivo
   (cuota vencida): eso se ve solo en la pantalla. Se puede apagar y queda guardado en este equipo. */
const SOUND_KEY = "vientos_recepcion_sonido";
const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== "0"; } catch { return true; } };
let actx = null;
const audio = () => { try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch { actx = null; } return actx; };
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
  else if (kind === "unknown") { tones([[587, 0.35]]); setTimeout(() => speak("No te reconozco. Acercate a recepción, por favor."), 400); }
}

async function loadHuman() {
  if (human) return human;
  const { default: Human } = await import("../../vendor/human/human.esm.js");
  human = new Human({
    modelBasePath: new URL("../../vendor/human/models/", import.meta.url).href,
    backend: "webgl", debug: false, cacheSensitivity: 0, warmup: "none",
    filter: { enabled: true, equalization: false },
    face: { enabled: true, detector: { rotation: false, maxDetected: 2, minConfidence: 0.5 }, mesh: { enabled: true }, iris: { enabled: false },
      description: { enabled: true }, emotion: { enabled: false }, antispoof: { enabled: true }, liveness: { enabled: true } },
    body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false },
  });
  await human.load();
  return human;
}

/* ¿Puede pasar? Según la cuota y los días de tolerancia del gimnasio (por defecto 7) */
export function accessOf(u) {
  const grace = S.gymOf(S.spaceOf(u)).accessGraceDays ?? 7;
  const st = S.feeStatus(u), p = S.plan(u.fee?.planId);
  if (u.status !== "activo") return { cls: "bad", head: "No es socio activo", sub: "Su cuenta está dada de baja o sin aprobar." };
  if (st.state === "none") return { cls: "warn", head: "Sin cuota cargada", sub: "Pedile que pase por recepción a regularizar." };
  if (st.state === "ok") return { cls: "ok", head: "Puede pasar", sub: `Cuota al día · vence el ${fmtDate(u.fee.dueAt)} (en ${plural(st.days, "día", "días")})${p ? ` · ${p.name}` : ""}` };
  if (st.state === "soon") return { cls: "ok", head: "Puede pasar", sub: `Su cuota ${st.days === 0 ? "vence hoy" : `vence en ${plural(st.days, "día", "días")}`}: recordale pagar` };
  const over = Math.max(0, -st.days);
  if (over <= grace) return { cls: "warn", head: "Puede pasar, pero debe la cuota", sub: `${u.fee.unpaid ? "No pagó el alta" : `Venció hace ${plural(over, "día", "días")}`}. Tiene tolerancia hasta ${plural(grace - over, "día más", "días más")}.` };
  return { cls: "bad", head: "No puede pasar", sub: `${u.fee.unpaid ? "No pagó el alta" : `Cuota vencida hace ${plural(over, "día", "días")}`}. Tiene que pagar para entrar.` };
}

const hhmm = (ts) => new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const todayIn = (u) => (S.db.checkins || []).find((c) => c.userId === u.id && new Date(c.at).toDateString() === new Date().toDateString());
/* botón o aviso de la entrada de hoy */
function entryHtml(u, asistOff) {
  if (asistOff) return "";
  const c = todayIn(u);
  if (c) return `<small class="rc-ok">${icon("checkc", "xs")} Entró hoy a las ${hhmm(c.at)}</small>`;
  return accessOf(u).cls === "bad"
    ? `<button class="btn ghost sm" type="button" data-in="${u.id}" data-via="manual">${icon("check", "sm")} Dejar pasar igual</button>`
    : `<button class="btn primary sm" type="button" data-in="${u.id}" data-via="dni">${icon("check", "sm")} Registrar entrada</button>`;
}
const resultCard = (u, extra = "") => { const a = accessOf(u); return `<div class="rc-card ${a.cls}">${avatar(u, "xl")}<div class="rc-info"><span class="rc-name">${esc(u.name)}</span><small>DNI ${esc(u.user || "—")}</small><b class="rc-head">${icon(a.cls === "bad" ? "x" : a.cls === "warn" ? "alert" : "checkc", "sm")} ${esc(a.head)}</b><small>${esc(a.sub)}</small>${extra}</div></div>`; };

export function recepcionView() {
  const faceOff = S.MODE === "supabase" && S.db.off?.rostros;
  const asistOff = S.MODE === "supabase" && S.db.off?.asistencia;
  const todayCount = () => S.checkinsOf().filter((c) => new Date(c.at).toDateString() === new Date().toDateString()).length;
  const socios = () => S.activeMembers().filter((u) => S.inSpace(u) && u.status === "activo");
  const enrolled = () => socios().filter((u) => S.faceOf(u.id)).length;
  return {
    layout: "panel", nav: "recepcion", title: "Recepción",
    html: `${pageHead({ title: "Recepción", kicker: "Entrada del gimnasio" })}
      <div class="rc-grid">
        <section class="card rc-cam">
          <div class="card-h"><h2>${icon("eye", "sm")} Reconocimiento facial</h2><span class="muted" data-enrolled>${plural(enrolled(), "rostro registrado", "rostros registrados")}</span></div>
          ${faceOff ? `<p class="muted">El reconocimiento facial todavía no está activado en el servidor. Mientras tanto, buscá al socio por DNI.</p>` : `
          <div class="rc-video"><video data-video playsinline muted></video><div class="rc-oval" data-oval aria-hidden="true"></div><div class="rc-overlay" data-status>Tocá “Prender cámara” para empezar.</div></div>
          <div class="row-btns"><button class="btn primary" type="button" data-start>${icon("play", "sm")} Prender cámara</button><button class="btn ghost" type="button" data-stop hidden>${icon("pause", "sm")} Apagar</button><button class="btn ghost" type="button" data-sound aria-pressed="${soundOn()}">${icon(soundOn() ? "sound" : "mute", "sm")} Sonido: ${soundOn() ? "sí" : "no"}</button></div>
          <label class="field rc-voice"><span>Voz</span><div class="rc-voice-row"><select data-voice></select><button class="btn ghost sm" type="button" data-try>${icon("sound", "sm")} Probar</button></div></label>
          <div class="rc-screen"><button class="btn ghost sm" type="button" data-screen>${icon("ext", "sm")} Abrir pantalla para socios</button><small class="muted">Se abre en otra ventana: arrastrala al monitor que mira la gente y tocá “Pantalla completa”. Muestra solo la cámara y el saludo.</small></div>
          <details class="rc-list" data-list><summary data-enrolled-sum>Rostros registrados</summary><div data-faces></div></details>
          <p class="muted tiny">La cámara corre en esta computadora: no se guardan fotos ni videos. Solo reconoce a los socios que aceptaron el reconocimiento facial y tienen su rostro registrado.</p>`}
        </section>
        <section class="card">
          <div class="card-h"><h2>${icon("search", "sm")} Resultado</h2>${asistOff ? "" : `<span class="pill" data-today>Hoy entraron ${todayCount()}</span>`}</div>
          <div data-result><p class="muted">Acá aparece el socio reconocido o el que busques por DNI.</p></div>
          <label class="search rc-search">${icon("search", "sm")}<input type="search" data-q placeholder="Buscar por DNI o nombre" aria-label="Buscar socio" autocomplete="off"></label>
          <div data-found></div>
        </section>
      </div>`,
    mount(host) {
      const video = $("[data-video]", host), status = $("[data-status]", host), result = $("[data-result]", host);
      let stream = null, timer = 0, last = null, count = 0, enrollFor = null;
      const say = (t) => { if (status) status.innerHTML = t; };
      const known = () => socios().filter((u) => S.faceConsent(u) && S.faceOf(u.id));
      const show = (u, extra) => { result.innerHTML = resultCard(u, extra); };
      /* lo que muestra la cámara se borra solo 1,5 s después de que la persona sale de cuadro; si entra el siguiente
         de la fila, el cartel y la voz cambian enseguida a esa persona */
      const IDLE = `<p class="muted">Acá aparece el socio reconocido o el que busques por DNI.</p>`;
      const HOLD = 1500;
      let cam = null, unknown = 0, lastUnknownVoice = 0, pausedUntil = 0;
      const pause = () => { pausedUntil = Date.now() + PAUSE; cam = null; };                     /* cam = { id, seen } de lo que está mostrando la cámara */
      /* muestra el cartel y suena una sola vez por persona (no en cada lectura) */
      /* canal con la pantalla de los socios (otra ventana en el monitor de la entrada) */
      const screen = "BroadcastChannel" in window ? new BroadcastChannel(SCREEN_CHANNEL) : null;
      const toScreen = (m) => { try { screen?.postMessage(m); } catch { /* sin pantalla */ } };
      let ovalOn = null;
      const camShow = (id, html, kind, name) => { if (cam?.id !== id) { result.innerHTML = html; announce(kind, name); toScreen({ t: "show", kind, name, gym: gymName() }); } cam = { id, seen: Date.now() }; };
      const camExpire = () => { if (cam && Date.now() - cam.seen > HOLD) { result.innerHTML = IDLE; cam = null; toScreen({ t: "idle" }); } };
      /* lista de rostros registrados: se puede borrar uno que quedó mal (después se vuelve a registrar) */
      function refreshList() {
        const box = $("[data-faces]", host), sum = $("[data-enrolled-sum]", host), n = enrolled();
        $("[data-enrolled]", host) && ($("[data-enrolled]", host).textContent = plural(n, "rostro registrado", "rostros registrados"));
        if (sum) sum.textContent = `Ver los rostros registrados (${n})`;
        if (!box) return;
        const list = socios().filter((u) => S.faceOf(u.id)).sort((a, b) => a.name.localeCompare(b.name, "es"));
        box.innerHTML = list.map((u) => `<div class="mrow">${avatar(u, "sm")}<span><b>${esc(u.name)}</b><small>Registrado el ${esc(fmtDate(S.faceOf(u.id).since || S.faceOf(u.id).at))}</small></span><button class="btn ghost sm" type="button" data-unface="${u.id}">${icon("trash", "sm")} Borrar</button></div>`).join("") || `<p class="muted tiny">Todavía no hay rostros registrados.</p>`;
      }
      const updateToday = () => { const t = $("[data-today]", host); if (t) t.textContent = `Hoy entraron ${todayCount()}`; };

      async function loop() {
        if (!stream) return;
        try {
          const res = await human.detect(video);
          /* si hay más de una cara, la más grande (la que está más cerca de la cámara) */
          const faces = (res.face || []).slice().sort((a, b) => (b.box?.[2] || 0) * (b.box?.[3] || 0) - (a.box?.[2] || 0) * (a.box?.[3] || 0));
          const inside = faces.filter(inOval);
          const f = inside[0];
          $("[data-oval]", host)?.classList.toggle("on", !!f);
          if (ovalOn !== !!f) { ovalOn = !!f; toScreen({ t: "oval", on: ovalOn }); }
          if (enrollFor) { if (f) await enrollStep(f, faces.length); else if (capturing) say("Que ponga la cara dentro del óvalo, cerca de la cámara…"); }
          else if (Date.now() < pausedUntil) say(`Reconocimiento en pausa mientras usás la búsqueda. <button type="button" class="linkbtn" data-resume>Seguir reconociendo</button>`);
          else if (!f) { say(faces.length ? "Poné la cara dentro del óvalo, cerca de la cámara…" : "Esperando una cara frente a la cámara…"); count = 0; unknown = 0; camExpire(); }
          else if (f.embedding?.length) {
            const list = known();
            if (!list.length) say("Todavía no hay rostros registrados. Registrá uno buscando al socio por DNI.");
            else {
              /* parecido con cada rostro registrado: el mejor tiene que superar el mínimo y sacarle ventaja al segundo */
              const sims = list.map((x) => human.match.similarity(f.embedding, S.faceOf(x.id).emb));
              const order = sims.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
              const [best = 0, bi = -1] = order[0] || [], second = order[1]?.[0] || 0;
              const m = { similarity: best, index: bi };
              const clear = best - second >= MARGIN;
              const u = best >= MATCH && clear ? list[bi] : null;
              const fake = typeof f.real === "number" && f.real < 0.5;
              count = u && u.id === last ? count + 1 : 1; last = u?.id || null;
              unknown = u ? 0 : unknown + 1;
              if (u && count >= STABLE) {
                /* entra solo si puede pasar y no parece una foto; si no, recepción decide con el botón */
                if (cam?.id !== u.id && !asistOff && !fake && accessOf(u).cls !== "bad" && S.api.checkIn(u.id, "cara", me()?.id)) updateToday();
                const acc = accessOf(u);
                camShow(u.id, resultCard(u, (fake ? `<small class="rc-warn">${icon("alert", "xs")} Ojo: podría ser una foto o una pantalla.</small>` : "") + entryHtml(u, asistOff)), fake ? "unknown" : acc.cls, u.name);
                /* la huella acompaña los cambios de la cara (barba, pelo, anteojos): si lo reconoce con mucha
                   seguridad y no es una foto, se ajusta un poco, como mucho una vez por día */
                const fr = S.faceOf(u.id);
                if (!fake && m.similarity >= 0.75 && best - second >= 0.15 && fr && fr.upd !== new Date().toDateString()) {
                  /* mismo promedio que al registrarla (90 % lo guardado + 10 % la lectura de hoy) */
                  const emb = fr.emb.map((v, i) => v * 0.9 + f.embedding[i] * 0.1);
                  S.api.saveFace(u.id, emb, { upd: new Date().toDateString(), since: fr.since || fr.at });
                }
                say(`Reconocido: <b>${esc(u.name)}</b> (${Math.round(m.similarity * 100)} %)`);
              }
              else if (!u && unknown >= STABLE) {
                /* otra persona que no está registrada: el cartel cambia enseguida */
                const dudoso = best >= MATCH && !clear;
                camShow("?", `<div class="rc-card none">${icon("user", "lg")}<div class="rc-info"><span class="rc-name">${dudoso ? "No estoy seguro" : "No reconocido"}</span><b class="rc-head">Buscalo por DNI</b><small>${dudoso ? "Se parece a más de un socio registrado." : "No está registrado o no lo reconozco bien."}</small></div></div>`, Date.now() - lastUnknownVoice > 20000 ? "unknown" : "silent");
                if (Date.now() - lastUnknownVoice > 20000) lastUnknownVoice = Date.now();
                say(dudoso ? "No estoy seguro de quién es. Buscalo por DNI." : "No lo reconozco. Buscalo por DNI.");
              }
            }
          }
        } catch (e) { console.warn(e); }
        timer = setTimeout(loop, 250);
      }

      /* Registrar el rostro, guiado: se pausa el reconocimiento, la persona se pone SOLA frente a la cámara,
         recepción toca "Empezar", cuenta 3-2-1 y toma 5 lecturas. No guarda si hay dos caras, si las lecturas
         no son de la misma persona o si esa cara ya está registrada como otro socio. */
      let samples = [], capturing = false;
      const sim = (a, b) => human.match.similarity(a, b);
      function enrollPanel(html) { result.innerHTML = `<div class="rc-enroll">${html}</div>`; }
      function askEnroll(u) {
        enrollFor = u; samples = []; capturing = false; cam = null;
        enrollPanel(`<b class="rc-name">Registrar el rostro de ${esc(u.name)}</b>
          <ol><li>Que <b>${esc(u.name.split(" ")[0])}</b> se ponga <b>solo/a</b> frente a la cámara, a medio metro, mirando de frente.</li>
          <li>Que no haya nadie más en la imagen (tampoco quien atiende).</li><li>Buena luz de frente, sin gorra ni anteojos oscuros.</li></ol>
          <div class="row-btns"><button class="btn primary" type="button" data-go>${icon("play", "sm")} Empezar</button><button class="btn ghost" type="button" data-cancel>Cancelar</button></div>`);
        say(`Registro de <b>${esc(u.name)}</b>: que se ponga solo/a frente a la cámara y tocá “Empezar”.`);
        toScreen({ t: "enroll", big: `Hola ${u.name.split(" ")[0]}`, small: "Ponete solo/a frente a la cámara, dentro del óvalo" });
      }
      function cancelEnroll(msg) {
        toScreen({ t: "idle" }); enrollFor = null; samples = []; capturing = false; if (msg) { enrollPanel(msg); pause(); } else pausedUntil = 0; say("Esperando una cara frente a la cámara…"); }
      async function countdown() {
        for (const n of [3, 2, 1]) { say(`Registrando a <b>${esc(enrollFor.name)}</b> en ${n}…`); toScreen({ t: "enroll", big: String(n), small: "Mirá de frente a la cámara, sin moverte" }); await new Promise((r) => setTimeout(r, 700)); if (!enrollFor) return; }
        samples = []; capturing = true;
      }
      async function enrollStep(f, n) {
        if (!capturing) return;                                   /* esperando que toquen "Empezar" */
        if (n > 1) { say("Hay más de una persona en la imagen: que quede solo/a el socio."); samples = []; return; }
        if (!f.embedding?.length || (f.score ?? 1) < 0.7) { say("Mirá de frente a la cámara, con buena luz…"); return; }
        if (samples.length && sim(samples[0], f.embedding) < SAME) { say("Se movió o cambió la persona: empiezo de nuevo."); samples = []; return; }
        samples.push(f.embedding);
        say(`Registrando el rostro de <b>${esc(enrollFor.name)}</b>… ${samples.length} de ${SAMPLES}`);
        if (samples.length < SAMPLES) return;
        capturing = false;
        const emb = samples[0].map((_, i) => samples.reduce((a, x) => a + x[i], 0) / samples.length);
        /* ¿esa cara ya es de otro socio? (por ejemplo, quedó quien atiende frente a la cámara) */
        const otros = known().filter((x) => x.id !== enrollFor.id);
        const dup = otros.map((x) => [sim(emb, S.faceOf(x.id).emb), x]).sort((a, b) => b[0] - a[0])[0];
        if (dup && dup[0] >= MATCH) {
          const who = dup[1];
          return cancelEnroll(`<div class="rc-card bad"><div class="rc-info"><span class="rc-name">No se registró</span><b class="rc-head">${icon("alert", "sm")} Esa cara ya es de ${esc(who.name)}</b><small>Parece que frente a la cámara estaba ${esc(who.name.split(" ")[0])} y no ${esc(enrollFor.name.split(" ")[0])}. Probá de nuevo con ${esc(enrollFor.name.split(" ")[0])} solo/a frente a la cámara.</small></div></div>`);
        }
        const u = enrollFor;
        S.api.saveFace(u.id, Array.from(emb));
        enrollFor = null; samples = [];
        toast(`Rostro de ${u.name.split(" ")[0]} registrado`);
        toScreen({ t: "enroll", big: "¡Listo!", small: "Tu rostro quedó registrado" }); setTimeout(() => toScreen({ t: "idle" }), 2500);
        show(u, `<small class="rc-ok">${icon("checkc", "xs")} Rostro registrado. Para probar: que se aleje y vuelva a mirar a la cámara.</small>`);
        refreshList();
        pause();
        say("Rostro registrado. El reconocimiento sigue en unos segundos (o tocá “Seguir reconociendo”).");
      }

      /* la cámara queda prendida hasta que recepción la apague: se recuerda en este equipo y,
         si se cambia de pantalla o se recarga, vuelve a prenderse sola. La pantalla no se apaga mientras tanto. */
      const KEY = "vientos_recepcion_camara";
      const wanted = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
      const want = (on) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* sin almacenamiento */ } };
      let wake = null;
      const keepAwake = async () => { try { wake = await navigator.wakeLock?.request("screen"); } catch { wake = null; } };
      async function start() {
        if (stream) return;
        want(true);
        $("[data-start]", host).disabled = true;
        say("Cargando el reconocimiento facial… (la primera vez tarda unos segundos)");
        try {
          await loadHuman();
          if (S.MODE === "supabase") { try { await S.remote().reloadFaces(); refreshList(); } catch (err) { console.warn(err); } }
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
          video.srcObject = stream; await video.play();
          $("[data-start]", host).hidden = true; $("[data-stop]", host).hidden = false;
          say("Esperando una cara frente a la cámara…");
          keepAwake();
          /* si la cámara se corta sola (se desenchufó, la tomó otro programa), se intenta prender de nuevo */
          stream.getVideoTracks()[0]?.addEventListener("ended", () => { stream = null; if (wanted()) setTimeout(start, 2000); });
          loop();
        } catch (e) {
          console.warn(e);
          say(e?.name === "NotAllowedError" ? "No hay permiso para usar la cámara. Permitilo en el navegador (ícono de la cámara, arriba)." : "No se pudo prender la cámara. Revisá que esté conectada.");
          $("[data-start]", host).disabled = false;
        }
      }
      function stop(byUser) {
        if (byUser === true) want(false);
        clearTimeout(timer);
        try { wake?.release(); } catch { /* nada */ } wake = null;
        stream?.getTracks().forEach((t) => t.stop()); stream = null;
        if (video) video.srcObject = null;
        $("[data-start]", host).hidden = false; $("[data-start]", host).disabled = false; $("[data-stop]", host).hidden = true;
        say("Cámara apagada.");
      }
      $("[data-start]", host)?.addEventListener("click", () => { audio(); start(); });
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
      /* el navegador no deja sonar hasta el primer toque en la página: cualquier clic lo habilita */
      host.addEventListener("pointerdown", () => audio(), { once: true });
      $("[data-stop]", host)?.addEventListener("click", () => stop(true));
      $("[data-screen]", host)?.addEventListener("click", () => {
        const w = window.open(`${location.pathname}${location.search}#/pantalla`, "vientos-pantalla", "popup,width=1000,height=700");
        if (!w) toast("El navegador bloqueó la ventana: permití las ventanas emergentes para esta página.", "err");
      });
      status?.addEventListener("click", (e) => { if (e.target.closest("[data-resume]")) { pausedUntil = 0; result.innerHTML = IDLE; say("Esperando una cara frente a la cámara…"); } });
      refreshList();
      $("[data-faces]", host)?.addEventListener("click", (e) => {
        const b = e.target.closest("[data-unface]"); if (!b) return;
        const u = S.user(b.dataset.unface);
        if (!confirm(`¿Borrar el rostro registrado de ${u.name}? Después se lo puede volver a registrar.`)) return;
        S.api.deleteFace(u.id); toast("Rostro borrado"); refreshList();
      });
      /* con servidor: cada minuto trae los rostros que registraron otros equipos */
      const syncT = S.MODE === "supabase" && !faceOff ? setInterval(async () => { try { await S.remote().reloadFaces(); refreshList(); } catch (err) { console.warn(err); } }, 60000) : 0;
      /* si la había dejado prendida, se prende sola al volver a esta pantalla */
      if (!faceOff && wanted()) start();
      const onVisible = () => { if (document.visibilityState === "visible" && wanted()) { if (!stream) start(); else keepAwake(); } };
      document.addEventListener("visibilitychange", onVisible);

      /* búsqueda por DNI o nombre: siempre disponible (plan B) */
      const q = $("[data-q]", host), found = $("[data-found]", host);
      q.addEventListener("focus", pause);
      q.addEventListener("input", () => {
        pause();
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
        const canFace = !faceOff && S.faceConsent(u);
        const extra = faceOff ? "" : canFace
          ? `<button class="btn ghost sm" type="button" data-enroll="${u.id}">${icon("user", "sm")} ${S.faceOf(u.id) ? "Volver a registrar su rostro" : "Registrar su rostro"}</button>`
          : `<small class="muted">No aceptó el reconocimiento facial (lo puede activar desde su Perfil, en Privacidad).</small>`;
        pause();
        show(u, entryHtml(u, asistOff) + extra);
        q.value = ""; found.innerHTML = "";
      });
      result.addEventListener("click", async (e) => {
        const inb = e.target.closest("[data-in]");
        if (inb) { const u = S.user(inb.dataset.in); S.api.checkIn(u.id, inb.dataset.via, me()?.id); updateToday(); toast(`Entrada de ${u.name.split(" ")[0]} registrada`); show(u, entryHtml(u, asistOff)); return; }
        if (e.target.closest("[data-go]")) { if (!stream) await start(); e.target.closest("[data-go]").disabled = true; countdown(); return; }
        if (e.target.closest("[data-cancel]")) { cancelEnroll(); result.innerHTML = IDLE; return; }
        const b = e.target.closest("[data-enroll]"); if (!b) return;
        if (!stream) await start();
        askEnroll(S.user(b.dataset.enroll));
      });
      return () => { screen?.close(); clearInterval(syncT); document.removeEventListener("visibilitychange", onVisible); stop(false); };
    },
  };
}

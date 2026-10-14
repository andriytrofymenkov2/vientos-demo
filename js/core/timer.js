/* Temporizador de descanso: flota sobre cualquier pantalla y sigue contando
   aunque el socio cambie de ejercicio. Usa la hora real, así no se atrasa si
   el teléfono bloquea la pantalla. */
import { icon } from "./icons.js";
import { fmtClock, vibrate } from "./util.js";
import { me } from "./auth.js";

const KEY = "vientos_rest";
let state = null, tick = 0, el = null, actx = null;

function load() { try { state = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { state = null; } }
function persist() { try { state ? localStorage.setItem(KEY, JSON.stringify(state)) : localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } }

/* ---------------------------------------------------------------- alarma
   El navegador solo deja sonar audio después de un toque: se prepara al iniciar el
   descanso. La alarma es fuerte y larga (4 ráfagas, unos 4 segundos) y se genera
   como un archivo de audio: suena por el parlante a volumen de medios y, en la
   mayoría de los celulares, sigue funcionando con la pantalla apagada porque
   mientras se descansa corre un audio silencioso que mantiene viva la página. */
const RATE = 22050;
function wav(samples) {
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVEfmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, samples.length * 2, true);
  samples.forEach((x, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x)) * 32767, true));
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
/* Pitido de alarma: dos tonos alternados (1000 y 1500 Hz) con onda casi cuadrada = mucho más fuerte que un seno */
function alarmWav() {
  const out = [];
  const burst = (hz, sec) => { const n = Math.floor(RATE * sec); for (let i = 0; i < n; i++) { const env = Math.min(1, i / 200, (n - i) / 200); out.push(Math.tanh(3 * Math.sin((2 * Math.PI * hz * i) / RATE)) * 0.95 * env); } };
  const gap = (sec) => { for (let i = 0; i < RATE * sec; i++) out.push(0); };
  for (let r = 0; r < 4; r++) { burst(1000, 0.16); gap(0.05); burst(1500, 0.16); gap(0.05); burst(1000, 0.16); gap(0.05); burst(1500, 0.16); gap(0.32); }
  return wav(out);
}
let alarmUrl = null, silentUrl = null, alarmEl = null, silentEl = null;
function unlockAudio() {
  try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch { actx = null; }
  try {
    alarmUrl ||= alarmWav();
    silentUrl ||= wav(new Array(RATE).fill(0));
    if (!alarmEl) { alarmEl = new Audio(alarmUrl); alarmEl.volume = 1; alarmEl.preload = "auto"; }
    if (!silentEl) { silentEl = new Audio(silentUrl); silentEl.loop = true; silentEl.volume = 1; }
    /* el toque que arrancó el descanso "habilita" el audio: se enciende el silencioso y se deja listo el de la alarma */
    silentEl.play().catch(() => {});
    alarmEl.muted = true; alarmEl.play().then(() => { alarmEl.pause(); alarmEl.currentTime = 0; alarmEl.muted = false; }).catch(() => { alarmEl.muted = false; });
  } catch { /* sin audio */ }
}
function stopSilent() { try { silentEl?.pause(); } catch { /* nada */ } }

function beep() {
  if (me()?.prefs?.sound === false) return;
  try { alarmEl.currentTime = 0; alarmEl.volume = 1; alarmEl.play().catch(webBeep); } catch { webBeep(); }
}
/* Plan B si el archivo de audio no pudo sonar: tonos con el audio web, más fuertes que antes */
function webBeep() {
  if (!actx) return;
  try {
    for (let r = 0; r < 3; r++) [0, 0.2, 0.4].forEach((t, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), at = actx.currentTime + r * 0.9 + t;
      o.type = "square"; o.frequency.value = i === 1 ? 1500 : 1000;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.8, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
      o.connect(g).connect(actx.destination);
      o.start(at); o.stop(at + 0.18);
    });
  } catch { /* sin audio */ }
}

/* Aviso del sistema (vibra y suena aunque la pantalla esté apagada): solo si la persona lo permitió */
const askNotify = () => { try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch { /* sin avisos */ } };
async function notifyEnd(label) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted" || document.visibilityState === "visible") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification("¡Terminó el descanso!", { body: `${label} · a la próxima serie`, tag: "vientos-rest", renotify: true, requireInteraction: false, vibrate: [500, 200, 500, 200, 500, 200, 800], icon: "img/icon-192.png", badge: "img/favicon-64.png", silent: false });
  } catch { /* sin avisos */ }
}

export function startRest(sec, label = "Descanso") {
  if (!sec) return;
  unlockAudio();
  askNotify();
  state = { endAt: Date.now() + sec * 1000, total: sec, label };
  persist();
  mountEl();
  loop();
}
export const restRunning = () => !!state;

export function stopRest() {
  state = null; persist(); stopSilent();
  clearInterval(tick); tick = 0;
  if (el) { el.classList.remove("in"); setTimeout(() => { if (!state) { el?.remove(); el = null; } }, 250); }
}

function add(sec) {
  if (!state) return;
  state.endAt += sec * 1000;
  state.total = Math.max(state.total + sec, 5);
  persist();
  draw();
}

function mountEl() {
  if (!el) {
    el = document.createElement("div");
    el.className = "rest";
    el.setAttribute("role", "timer");
    el.innerHTML = `<div class="rest-ring"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="trk" cx="22" cy="22" r="19"/><circle class="val" cx="22" cy="22" r="19" pathLength="100"/></svg>${icon("timer")}</div>
      <div class="rest-t"><span class="rest-l"></span><b class="rest-c" aria-live="off"></b></div>
      <button class="rest-b" type="button" data-r="-15" aria-label="Restar 15 segundos">−15</button>
      <button class="rest-b" type="button" data-r="15" aria-label="Sumar 15 segundos">+15</button>
      <button class="rest-b skip" type="button" data-r="skip">Saltar</button>`;
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-r]");
      if (!b) return;
      if (b.dataset.r === "skip") stopRest(); else add(+b.dataset.r);
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
  }
  draw();
}

function draw() {
  if (!state || !el) return;
  const left = Math.max(0, (state.endAt - Date.now()) / 1000);
  el.querySelector(".rest-l").textContent = left > 0 ? state.label : "¡A la próxima serie!";
  el.querySelector(".rest-c").textContent = fmtClock(Math.ceil(left));
  el.querySelector(".val").style.strokeDasharray = `${(left / state.total) * 100} 100`;
  el.classList.toggle("done", left <= 0);
}

function loop() {
  clearInterval(tick);
  tick = setInterval(() => {
    if (!state) return clearInterval(tick);
    draw();
    if (Date.now() >= state.endAt && !state.rang) {
      state.rang = true; persist();
      vibrate([500, 200, 500, 200, 500, 200, 800]);
      beep();
      notifyEnd(state.label || "Descanso");
      setTimeout(() => { if (state?.rang) stopRest(); }, 4800);
    }
  }, 250);
}

/* Si el celular durmió la página y el descanso terminó, al volver se avisa igual */
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state && !state.rang && Date.now() >= state.endAt) { draw(); }
});

/* Al abrir la app: si había un descanso corriendo, lo retoma */
export function resumeRest() {
  load();
  if (!state) return;
  if (Date.now() > state.endAt + 3000) { state = null; persist(); return; }
  mountEl(); loop();
}

export const restLabel = (name) => `Descanso · ${name}`;

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

/* El navegador solo deja sonar audio después de un toque: se prepara al iniciar */
function unlockAudio() {
  try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch { actx = null; }
}
function beep() {
  if (me()?.prefs?.sound === false || !actx) return;
  try {
    [0, 0.18, 0.36].forEach((t, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = i === 2 ? 1180 : 880;
      g.gain.setValueAtTime(0.0001, actx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t + 0.15);
      o.connect(g).connect(actx.destination);
      o.start(actx.currentTime + t); o.stop(actx.currentTime + t + 0.16);
    });
  } catch { /* sin audio */ }
}

export function startRest(sec, label = "Descanso") {
  if (!sec) return;
  unlockAudio();
  state = { endAt: Date.now() + sec * 1000, total: sec, label };
  persist();
  mountEl();
  loop();
}
export const restRunning = () => !!state;

export function stopRest() {
  state = null; persist();
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
      vibrate([180, 90, 180, 90, 260]);
      beep();
      setTimeout(() => { if (state?.rang) stopRest(); }, 2600);
    }
  }, 250);
}

/* Al abrir la app: si había un descanso corriendo, lo retoma */
export function resumeRest() {
  load();
  if (!state) return;
  if (Date.now() > state.endAt + 3000) { state = null; persist(); return; }
  mountEl(); loop();
}

export const restLabel = (name) => `Descanso · ${name}`;

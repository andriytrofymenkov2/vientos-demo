/* Asistente del socio: chat con botones rápidos, texto y voz (sin costo) */
import { icon } from "../core/icons.js";
import { esc, $ } from "../core/util.js";
import * as S from "../core/store.js";
import { me } from "../core/auth.js";
import { toast } from "../core/ui.js";
import { answer, welcome, QUICK } from "../core/bot.js";

const HKEY = "vientos_chat";
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

/* La charla se guarda mientras la app esté abierta */
function history() { try { return JSON.parse(sessionStorage.getItem(HKEY) || "[]"); } catch { return []; } }
function keep(h) { try { sessionStorage.setItem(HKEY, JSON.stringify(h.slice(-40))); } catch { /* sin almacenamiento */ } }

const bubble = (m) => m.me
  ? `<div class="msg me"><p>${esc(m.text)}</p></div>`
  : `<div class="msg bot"><p>${m.text}</p>
      ${m.actions?.length ? `<div class="msg-a">${m.actions.map((a) => `<a class="btn ${a.icon === "whatsapp" ? "wa" : "ghost"} sm" href="${esc(a.href)}" ${a.ext ? 'target="_blank" rel="noopener"' : ""}>${icon(a.icon || "arrow", "sm")} ${esc(a.label)}</a>`).join("")}</div>` : ""}
    </div>`;

/* Texto plano para leer en voz alta */
const plain = (html) => { const d = document.createElement("div"); d.innerHTML = html.replace(/<br>/g, ". "); return d.textContent.replace(/[•🏆💡🔥🤔💪📍]/gu, "").replace(/\s+/g, " ").trim(); };

function speak(html) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const t = new SpeechSynthesisUtterance(plain(html));
  t.lang = "es-AR";
  const v = speechSynthesis.getVoices().find((x) => /^es[-_](AR|419|US|MX)/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^es/i.test(x.lang));
  if (v) t.voice = v;
  t.rate = 1.03;
  speechSynthesis.speak(t);
}

export function assistantView() {
  const u = me();
  let h = history();
  if (!h.length) { const w = welcome(u); h = [{ text: w.text, actions: w.actions, chips: w.chips }]; keep(h); }
  const voiceOn = !!u.prefs?.voice;
  const lastChips = [...h].reverse().find((m) => !m.me)?.chips || QUICK;

  return {
    title: "Asistente", nav: "asistente",
    html: `<header class="ahead">
        <div class="ahead-t"><span class="ahead-ic">${icon("chat")}</span><div><h1>Asistente</h1><small>Rutina, pesos, ejercicios, cuota y horarios</small></div></div>
        <button class="icon-btn ${voiceOn ? "on" : ""}" type="button" data-voice aria-pressed="${voiceOn}" aria-label="${voiceOn ? "No leer" : "Leer"} las respuestas en voz alta">${icon(voiceOn ? "sound" : "mute")}</button>
      </header>
      <section class="chat" aria-live="polite">${h.map(bubble).join("")}</section>
      <div class="chatbar">
        <div class="chips-scroll qchips">${lastChips.map((c) => `<button type="button" class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join("")}</div>
        <form class="chatin" novalidate>
          ${SR ? `<button class="mic" type="button" data-mic aria-label="Hablar">${icon("mic")}</button>` : ""}
          <input type="text" name="q" placeholder="Escribí tu pregunta…" autocomplete="off" enterkeyhint="send" aria-label="Tu pregunta">
          <button class="send" type="submit" aria-label="Enviar">${icon("send")}</button>
        </form>
      </div>`,
    mount(host) {
      const chat = $(".chat", host), chips = $(".qchips", host), form = $(".chatin", host), inp = form.q;
      const toEnd = (smooth = true) => requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? "smooth" : "auto" }));
      toEnd(false);

      const ask = (q) => {
        q = q.trim();
        if (!q) return;
        const mine = { me: true, text: q };
        chat.insertAdjacentHTML("beforeend", bubble(mine));
        chat.insertAdjacentHTML("beforeend", `<div class="msg bot typing"><p><i></i><i></i><i></i></p></div>`);
        toEnd();
        setTimeout(() => {
          const r = answer(q, me());
          const m = { text: r.text, actions: r.actions || [], chips: r.chips || [] };
          chat.querySelector(".typing")?.remove();
          chat.insertAdjacentHTML("beforeend", bubble(m));
          chips.innerHTML = (m.chips.length ? m.chips : QUICK).map((c) => `<button type="button" class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join("");
          chips.scrollLeft = 0;
          h.push(mine, m); keep(h);
          if (me().prefs?.voice) speak(m.text);
          toEnd();
        }, 420);
      };

      form.addEventListener("submit", (e) => { e.preventDefault(); const q = inp.value; inp.value = ""; ask(q); });
      chips.addEventListener("click", (e) => { const c = e.target.closest("[data-q]"); if (c) ask(c.dataset.q); });

      $("[data-voice]", host).addEventListener("click", (e) => {
        const on = !me().prefs?.voice;
        S.api.updateUser(u.id, { prefs: { ...me().prefs, voice: on } });
        const b = e.currentTarget;
        b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.innerHTML = icon(on ? "sound" : "mute");
        toast(on ? "Las respuestas se leen en voz alta" : "Voz apagada");
        if (!on && "speechSynthesis" in window) speechSynthesis.cancel();
      });

      /* Micrófono: usa el reconocimiento de voz del celular */
      let rec = null;
      const mic = $("[data-mic]", host);
      mic?.addEventListener("click", () => {
        if (rec) { rec.stop(); return; }
        rec = new SR();
        rec.lang = "es-AR";
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        mic.classList.add("rec");
        inp.placeholder = "Te escucho…";
        let finalText = "";
        rec.onresult = (e) => {
          let t = "";
          for (const r of e.results) t += r[0].transcript;
          inp.value = t;
          if (e.results[e.results.length - 1].isFinal) finalText = t;
        };
        rec.onerror = (e) => { if (e.error === "not-allowed") toast("Dale permiso al micrófono para hablarle al asistente.", "err"); };
        rec.onend = () => {
          mic.classList.remove("rec");
          inp.placeholder = "Escribí tu pregunta…";
          rec = null;
          const q = finalText || inp.value;
          if (q.trim()) { inp.value = ""; ask(q); }
        };
        try { rec.start(); } catch { mic.classList.remove("rec"); rec = null; }
      });

      return () => { try { rec?.abort(); } catch { /* ya terminó */ } if ("speechSynthesis" in window) speechSynthesis.cancel(); };
    },
  };
}

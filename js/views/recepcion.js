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

/* similitud mínima para decir "es tal socio" y cuántas lecturas seguidas iguales hacen falta */
const MATCH = 0.55, STABLE = 2;
let human = null;

async function loadHuman() {
  if (human) return human;
  const { default: Human } = await import("../../vendor/human/human.esm.js");
  human = new Human({
    modelBasePath: new URL("../../vendor/human/models/", import.meta.url).href,
    backend: "webgl", debug: false, cacheSensitivity: 0, warmup: "none",
    filter: { enabled: true, equalization: false },
    face: { enabled: true, detector: { rotation: false, maxDetected: 1, minConfidence: 0.5 }, mesh: { enabled: true }, iris: { enabled: false },
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
  const socios = () => S.activeMembers().filter((u) => S.inSpace(u));
  const enrolled = () => socios().filter((u) => S.faceOf(u.id)).length;
  return {
    layout: "panel", nav: "recepcion", title: "Recepción",
    html: `${pageHead({ title: "Recepción", kicker: "Entrada del gimnasio" })}
      <div class="rc-grid">
        <section class="card rc-cam">
          <div class="card-h"><h2>${icon("eye", "sm")} Reconocimiento facial</h2><span class="muted" data-enrolled>${plural(enrolled(), "rostro registrado", "rostros registrados")}</span></div>
          ${faceOff ? `<p class="muted">El reconocimiento facial todavía no está activado en el servidor. Mientras tanto, buscá al socio por DNI.</p>` : `
          <div class="rc-video"><video data-video playsinline muted></video><div class="rc-overlay" data-status>Tocá “Prender cámara” para empezar.</div></div>
          <div class="row-btns"><button class="btn primary" type="button" data-start>${icon("play", "sm")} Prender cámara</button><button class="btn ghost" type="button" data-stop hidden>${icon("pause", "sm")} Apagar</button></div>
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
      /* lo que muestra la cámara se borra solo 5 s después de que la persona sale de cuadro, para el que sigue */
      const IDLE = `<p class="muted">Acá aparece el socio reconocido o el que busques por DNI.</p>`;
      const HOLD = 5000;
      let cam = null, unknown = 0;                     /* cam = { id, seen } de lo que está mostrando la cámara */
      const camShow = (id, html) => { if (cam?.id !== id) result.innerHTML = html; cam = { id, seen: Date.now() }; };
      const camExpire = () => { if (cam && Date.now() - cam.seen > HOLD) { result.innerHTML = IDLE; cam = null; } };
      const updateToday = () => { const t = $("[data-today]", host); if (t) t.textContent = `Hoy entraron ${todayCount()}`; };

      async function loop() {
        if (!stream) return;
        try {
          const res = await human.detect(video);
          const f = res.face?.[0];
          if (!f) { say("Esperando una cara frente a la cámara…"); count = 0; unknown = 0; camExpire(); }
          else if (enrollFor) await enrollStep(f);
          else if (f.embedding?.length) {
            const list = known();
            if (!list.length) say("Todavía no hay rostros registrados. Registrá uno buscando al socio por DNI.");
            else {
              const m = human.match.find(f.embedding, list.map((u) => S.faceOf(u.id).emb));
              const u = m.similarity >= MATCH ? list[m.index] : null;
              const fake = typeof f.real === "number" && f.real < 0.5;
              count = u && u.id === last ? count + 1 : 1; last = u?.id || null;
              unknown = u ? 0 : unknown + 1;
              if (u && count >= STABLE) {
                /* entra solo si puede pasar y no parece una foto; si no, recepción decide con el botón */
                if (cam?.id !== u.id && !asistOff && !fake && accessOf(u).cls !== "bad" && S.api.checkIn(u.id, "cara", me()?.id)) updateToday();
                camShow(u.id, resultCard(u, (fake ? `<small class="rc-warn">${icon("alert", "xs")} Ojo: podría ser una foto o una pantalla.</small>` : "") + entryHtml(u, asistOff)));
                say(`Reconocido: <b>${esc(u.name)}</b> (${Math.round(m.similarity * 100)} %)`);
              }
              else if (!u && unknown >= STABLE) {
                /* otra persona que no está registrada: el cartel cambia enseguida */
                camShow("?", `<div class="rc-card none">${icon("user", "lg")}<div class="rc-info"><span class="rc-name">No reconocido</span><b class="rc-head">Buscalo por DNI</b><small>No está registrado o no lo reconozco bien.</small></div></div>`);
                say("No lo reconozco. Buscalo por DNI.");
              }
            }
          }
        } catch (e) { console.warn(e); }
        timer = setTimeout(loop, 350);
      }

      /* registrar el rostro: junta varias lecturas buenas de la cara y guarda el promedio */
      let samples = [];
      async function enrollStep(f) {
        if (!f.embedding?.length || (f.score ?? 1) < 0.7) { say("Mirá de frente a la cámara, con buena luz…"); return; }
        samples.push(f.embedding);
        say(`Registrando el rostro de <b>${esc(enrollFor.name)}</b>… ${samples.length} de 5`);
        if (samples.length < 5) return;
        const emb = samples[0].map((_, i) => samples.reduce((a, s) => a + s[i], 0) / samples.length);
        S.api.saveFace(enrollFor.id, Array.from(emb));
        toast(`Rostro de ${enrollFor.name.split(" ")[0]} registrado`);
        show(enrollFor, `<small class="rc-ok">${icon("checkc", "xs")} Rostro registrado</small>`);
        $("[data-enrolled]", host).textContent = plural(enrolled(), "rostro registrado", "rostros registrados");
        enrollFor = null; samples = [];
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
      $("[data-start]", host)?.addEventListener("click", start);
      $("[data-stop]", host)?.addEventListener("click", () => stop(true));
      /* si la había dejado prendida, se prende sola al volver a esta pantalla */
      if (!faceOff && wanted()) start();
      const onVisible = () => { if (document.visibilityState === "visible" && wanted()) { if (!stream) start(); else keepAwake(); } };
      document.addEventListener("visibilitychange", onVisible);

      /* búsqueda por DNI o nombre: siempre disponible (plan B) */
      const q = $("[data-q]", host), found = $("[data-found]", host);
      q.addEventListener("input", () => {
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
        cam = null;
        show(u, entryHtml(u, asistOff) + extra);
        q.value = ""; found.innerHTML = "";
      });
      result.addEventListener("click", async (e) => {
        const inb = e.target.closest("[data-in]");
        if (inb) { const u = S.user(inb.dataset.in); S.api.checkIn(u.id, inb.dataset.via, me()?.id); updateToday(); toast(`Entrada de ${u.name.split(" ")[0]} registrada`); show(u, entryHtml(u, asistOff)); return; }
        const b = e.target.closest("[data-enroll]"); if (!b) return;
        enrollFor = S.user(b.dataset.enroll); samples = [];
        if (!stream) await start();
        say(`Que <b>${esc(enrollFor.name)}</b> mire de frente a la cámara…`);
      });
      return () => { document.removeEventListener("visibilitychange", onVisible); stop(false); };
    },
  };
}

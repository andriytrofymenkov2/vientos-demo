/* Panel: editor de rutinas y plantillas, lista de plantillas y biblioteca de ejercicios */
import { icon } from "../core/icons.js";
import { esc, fold, fmtRest, plural, debounce, $, $$ } from "../core/util.js";
import * as S from "../core/store.js";
import { me } from "../core/auth.js";
import { go, refresh } from "../core/router.js";
import { field, formData, toast, sheet, confirmDialog, tag, pageHead, empty, limitList } from "../core/ui.js";
import { GROUPS, EQUIP } from "../data/exercises.js";
import { LEVELS, AUDIENCES, GOALS, BLOCK_TYPES } from "../data/templates.js";
import { exTile, letter } from "./common.js";
import { assignSheet } from "./panel.js";

const RESTS = [0, 15, 30, 45, 60, 75, 90, 120, 150, 180, 240];
const restOpts = (v) => {
  const list = RESTS.includes(+v) ? RESTS : [...RESTS, +v].sort((a, b) => a - b);
  return list.map((s) => `<option value="${s}" ${+v === s ? "selected" : ""}>${s ? fmtRest(s) : "Sin descanso"}</option>`).join("");
};

/* ------------------------------------------------- selector de ejercicio */
export function pickExercise(onPick, title = "Elegir ejercicio") {
  let g = "", q = "";
  const list = () => S.db.exercises
    .filter((e) => (!g || e.g === g) && (!q || fold(e.n).includes(fold(q)) || fold(e.g).includes(fold(q))))
    .sort((a, b) => a.n.localeCompare(b.n, "es"))
    .map((e) => `<button type="button" class="exrow pick" data-pick="${e.id}">${exTile(e, "sm")}<span class="exrow-t"><b>${esc(e.n)}</b><small>${esc(e.g)} · ${esc(e.eq)}</small></span>${icon("plus", "sm")}</button>`).join("") || `<p class="muted">No hay ejercicios con ese nombre.</p>`;
  sheet({
    title, wide: true,
    html: `<div class="picker">
      <label class="search">${icon("search", "sm")}<input type="search" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio"></label>
      <div class="chips-scroll">${["", ...GROUPS].map((x) => `<button type="button" class="chip ${x === g ? "on" : ""}" data-g="${esc(x)}">${x || "Todos"}</button>`).join("")}</div>
      <div class="pick-list">${list()}</div></div>`,
    onMount(b, close) {
      const L = $(".pick-list", b);
      $("input", b).addEventListener("input", debounce((e) => { q = e.target.value; L.innerHTML = list(); }, 120));
      b.addEventListener("click", (e) => {
        const c = e.target.closest("[data-g]");
        if (c) { g = c.dataset.g; $$("[data-g]", b).forEach((x) => x.classList.toggle("on", x === c)); L.innerHTML = list(); return; }
        const p = e.target.closest("[data-pick]");
        if (p) { close(); onPick(p.dataset.pick); }
      });
    },
  });
}

/* ------------------------------------------------------------- editor */
function editor(obj, kind) {
  const isT = kind === "template";
  const owner = isT ? null : S.user(obj.userId);
  let cur = 0;
  const back = isT ? "#/panel/plantillas" : `#/panel/socios/${obj.userId}`;

  const meta = () => isT ? `
      ${field({ label: "Nombre de la plantilla", name: "name", value: obj.name, req: true })}
      <div class="grid3">
        ${field({ label: "Nivel", name: "level", value: obj.level, options: LEVELS })}
        ${field({ label: "Público", name: "audience", value: obj.audience, options: AUDIENCES })}
        ${field({ label: "Objetivo", name: "goal", value: obj.goal, options: GOALS })}
      </div>
      ${field({ label: "Descripción", name: "desc", type: "textarea", value: obj.desc, ph: "Para quién es y cómo se trabaja" })}`
    : `
      <label class="toggle"><span><b>Rutina personalizada</b><small>Se muestra como “${esc(owner?.name || "")} · Rutina ${obj.number}”.</small></span><input type="checkbox" name="personal" ${obj.personal ? "checked" : ""} role="switch"><i aria-hidden="true"></i></label>
      ${field({ label: obj.personal ? "Tipo de rutina (subtítulo)" : "Nombre de la rutina", name: "name", value: obj.name, req: true })}
      <div class="grid3">
        ${field({ label: "Nivel", name: "level", value: obj.level, options: LEVELS })}
        ${field({ label: "Objetivo", name: "goal", value: obj.goal, options: ["", ...GOALS] })}
        ${field({ label: "Público", name: "audience", value: obj.audience, options: AUDIENCES })}
      </div>
      ${field({ label: "Nota para el socio", name: "note", type: "textarea", value: obj.note, ph: "Ej: subí 2,5 kg cuando completes todas las repeticiones" })}`;

  const tabs = () => `<div class="daytabs" role="tablist">${obj.days.map((d, i) => `<button type="button" role="tab" class="daytab ${i === cur ? "on" : ""}" data-day="${i}" aria-selected="${i === cur}"><b>${esc(d.name)}</b><small>${esc(d.focus || "—")}</small></button>`).join("")}
    <button type="button" class="daytab add" data-act="add-day" aria-label="Agregar día">${icon("plus")}</button></div>`;

  /* Los días sin nombre propio (Día 1, Día 2…) siguen su posición: al moverlos,
     agregarlos o borrarlos se renumeran solos. Un nombre escrito a mano no se toca. */
  const renumber = () => obj.days.forEach((d, i) => { if (/^Día\s*\d+$/i.test(d.name.trim())) d.name = `Día ${i + 1}`; });

  const itemRow = (b, bi, i, ii) => {
    const ex = S.exercise(i.ex);
    const multi = b.type !== "single";
    return `<div class="eitem" data-b="${bi}" data-i="${ii}">
      <button type="button" class="eitem-ex" data-act="swap">${exTile(ex, "sm")}<span><b>${multi ? `<em class="lt">${letter(bi, ii)}</em>` : ""}${esc(ex?.n || "Elegí un ejercicio")}</b><small>${esc(ex?.g || "")} · cambiar</small></span></button>
      <div class="eitem-f">
        <label><small>Series${multi ? "/vueltas" : ""}</small><input type="number" min="1" max="20" inputmode="numeric" data-f="sets" value="${i.sets}"></label>
        <label class="wide"><small>Repeticiones</small><input type="text" data-f="reps" value="${esc(i.reps)}" placeholder="10 · 8-10 · 12,10,8"></label>
        ${multi ? "" : `<label><small>Descanso</small><select data-f="rest">${restOpts(i.rest)}</select></label>`}
      </div>
      <input class="eitem-note" type="text" data-f="note" value="${esc(i.note)}" placeholder="Indicación para el socio (opcional)">
      <div class="eitem-a">
        <button type="button" class="icon-btn sm" data-act="up" aria-label="Subir">${icon("up", "sm")}</button>
        <button type="button" class="icon-btn sm" data-act="down" aria-label="Bajar">${icon("down", "sm")}</button>
        <button type="button" class="icon-btn sm" data-act="del-item" aria-label="Quitar ejercicio">${icon("trash", "sm")}</button>
      </div>
    </div>`;
  };

  const dayBody = () => {
    const d = obj.days[cur];
    if (!d) return "";
    const st = S.dayStats(d);
    return `<div class="eday">
      <div class="daymove">
        <button type="button" class="btn ghost sm" data-act="left-day" ${cur === 0 ? "disabled" : ""}>${icon("left", "sm")} Mover antes</button>
        <span class="muted tiny">${cur + 1} de ${obj.days.length}</span>
        <button type="button" class="btn ghost sm" data-act="right-day" ${cur === obj.days.length - 1 ? "disabled" : ""}>Mover después ${icon("right", "sm")}</button>
      </div>
      <div class="grid2">
        ${field({ label: "Nombre del día", name: "dname", value: d.name, attrs: 'data-day-f="name"' })}
        ${field({ label: "Grupos musculares / foco", name: "dfocus", value: d.focus, ph: "Ej: Espalda, bíceps y abdomen", attrs: 'data-day-f="focus"' })}
      </div>
      <p class="muted tiny">${st.ex} ejercicios · ${st.sets} series · ~${st.min} min · El peso lo carga cada socio. Para repeticiones distintas por serie, separalas con coma: 12,10,8.</p>
      ${d.blocks.map((b, bi) => `<div class="eblock bt-${b.type}" data-b="${bi}">
        <div class="eblock-h">
          <select data-bf="type" aria-label="Tipo de bloque">${Object.entries(BLOCK_TYPES).map(([k, v]) => `<option value="${k}" ${k === b.type ? "selected" : ""}>${v.label}</option>`).join("")}</select>
          ${b.type !== "single" ? `<label class="inline"><small>Descanso al final</small><select data-bf="rest">${restOpts(b.rest)}</select></label>` : ""}
          <span class="grow"></span>
          <button type="button" class="icon-btn sm" data-act="bup" aria-label="Subir bloque">${icon("up", "sm")}</button>
          <button type="button" class="icon-btn sm" data-act="bdown" aria-label="Bajar bloque">${icon("down", "sm")}</button>
          <button type="button" class="icon-btn sm" data-act="del-block" aria-label="Quitar bloque">${icon("trash", "sm")}</button>
        </div>
        ${b.items.map((i, ii) => itemRow(b, bi, i, ii)).join("")}
        ${b.type !== "single" ? `<button type="button" class="btn ghost sm" data-act="add-to-block">${icon("plus", "sm")} Sumar ejercicio al ${BLOCK_TYPES[b.type].label.toLowerCase()}</button>` : ""}
      </div>`).join("") || `<p class="muted center">Este día todavía no tiene ejercicios.</p>`}
      <div class="addbar">
        <button type="button" class="btn primary sm" data-add="single">${icon("plus", "sm")} Ejercicio</button>
        <button type="button" class="btn ghost sm" data-add="super">${icon("plus", "sm")} Superserie</button>
        <button type="button" class="btn ghost sm" data-add="contrast">${icon("plus", "sm")} Contraste</button>
        <button type="button" class="btn ghost sm" data-add="circuit">${icon("plus", "sm")} Circuito</button>
      </div>
      <div class="dayops">
        <button type="button" class="btn ghost sm" data-act="dup-day">${icon("copy", "sm")} Duplicar día</button>
        <button type="button" class="btn ghost sm danger-t" data-act="del-day" ${obj.days.length < 2 ? "disabled" : ""}>${icon("trash", "sm")} Borrar día</button>
      </div>
    </div>`;
  };

  const users = isT ? S.db.routines.filter((r) => r.active && r.fromTemplate === obj.id).length : 0;
  const actions = isT
    ? `<button class="btn primary sm" type="button" data-act="assign">${icon("userplus", "sm")} Asignar</button>`
    : `<a class="btn ghost sm" href="#/imprimir/${obj.id}">${icon("print", "sm")} Imprimir</a><a class="btn ghost sm" href="#/panel/vista/${obj.id}">${icon("eye", "sm")} Vista del socio</a>`;

  return {
    layout: "panel", nav: isT ? "plantillas" : "socios", title: obj.name,
    html: `${pageHead({ back, kicker: isT ? "Plantilla" : `Rutina ${obj.number} de ${owner?.name || ""}${obj.active ? " · activa" : ""}`, title: isT ? obj.name : S.routineTitle(obj), actions })}
      <div class="saved" aria-live="polite"><span data-saved>${icon("check", "xs")} Los cambios se guardan solos</span></div>
      <div class="ed">
        <form class="card ed-meta" data-meta novalidate>${meta()}
          ${isT ? `<p class="muted tiny">${users ? `${plural(users, "socio la tiene", "socios la tienen")} asignada. Cambiar la plantilla no modifica sus rutinas (cada socio tiene su copia).` : "Ningún socio la tiene asignada todavía."}</p>` : ""}
        </form>
        <section class="card ed-days">
          <div class="card-h"><h2>Días</h2><span class="muted">${plural(obj.days.length, "día", "días")} por semana</span></div>
          <div data-tabs>${tabs()}</div>
          <div data-body>${dayBody()}</div>
        </section>
        <div class="ed-foot">
          ${isT ? `<button class="btn ghost sm" type="button" data-act="dup-t">${icon("copy", "sm")} Duplicar plantilla</button><button class="btn ghost sm danger-t" type="button" data-act="del-t">${icon("trash", "sm")} Borrar plantilla</button>`
            : `<button class="btn ghost sm" type="button" data-act="as-t">${icon("layers", "sm")} Guardar como plantilla</button>${obj.active ? "" : `<button class="btn ghost sm" type="button" data-act="activate">${icon("bolt", "sm")} Volver a activar</button>`}`}
        </div>
      </div>`,
    mount(host) {
      const tabsEl = $("[data-tabs]", host), body = $("[data-body]", host), savedEl = $("[data-saved]", host);
      const commit = debounce(() => {
        isT ? S.api.saveTemplate(obj) : S.api.saveRoutine(obj);
        savedEl.innerHTML = `${icon("check", "xs")} Guardado`;
        savedEl.parentElement.classList.add("flash");
        setTimeout(() => savedEl.parentElement.classList.remove("flash"), 900);
      }, 300);
      const redraw = (all = true) => { if (all) tabsEl.innerHTML = tabs(); body.innerHTML = dayBody(); commit(); };
      const day = () => obj.days[cur];
      const ref = (el) => {
        const it = el.closest("[data-i]"), bl = el.closest("[data-b]");
        const b = bl ? day().blocks[+bl.dataset.b] : null;
        return { b, bi: bl ? +bl.dataset.b : -1, i: it && b ? b.items[+it.dataset.i] : null, ii: it ? +it.dataset.i : -1 };
      };
      const newItem = (ex, type) => ({ id: crypto.randomUUID?.() || String(Math.random()), ex, sets: type === "circuit" ? 3 : 3, reps: "10", kg: null, rest: type === "single" ? 90 : type === "contrast" ? 15 : 0, note: "" });

      /* Datos generales */
      $("[data-meta]", host).addEventListener("input", (e) => {
        const f = e.target;
        if (f.name === "personal") return;
        obj[f.name] = f.value;
        commit();
      });
      $("[data-meta]", host).addEventListener("change", (e) => {
        if (e.target.name === "personal") { obj.personal = e.target.checked; commit(); refreshSoon(); }
      });
      const refreshSoon = debounce(() => refresh(), 350);

      /* Campos de días, bloques y ejercicios */
      body.addEventListener("input", (e) => {
        const f = e.target;
        if (f.dataset.dayF) { day()[f.dataset.dayF] = f.value; tabsEl.innerHTML = tabs(); commit(); return; }
        const { b, i } = ref(f);
        if (f.dataset.f && i) {
          const k = f.dataset.f;
          i[k] = k === "sets" ? Math.max(1, Math.min(20, parseInt(f.value) || 1)) : k === "kg" ? (f.value === "" ? null : parseFloat(f.value.replace(",", "."))) : k === "rest" ? +f.value : f.value;
          /* En bloques combinados todas las vueltas son iguales */
          if (k === "sets" && b.type !== "single") b.items.forEach((x) => (x.sets = i.sets));
          commit();
        }
      });
      body.addEventListener("change", (e) => {
        const f = e.target;
        const { b } = ref(f);
        if (f.dataset.f === "sets" && b?.type !== "single") return redraw(false);
        if (f.dataset.f === "rest") { commit(); return; }
        if (f.dataset.bf === "rest") { b.rest = +f.value; commit(); return; }
        if (f.dataset.bf === "type") {
          b.type = f.value;
          if (b.type === "single" && b.items.length > 1) {
            /* Se separa en ejercicios sueltos */
            const at = day().blocks.indexOf(b);
            const singles = b.items.map((x) => ({ id: crypto.randomUUID?.() || String(Math.random()), type: "single", rest: 0, items: [{ ...x, rest: x.rest || 90 }] }));
            day().blocks.splice(at, 1, ...singles);
          } else if (b.type !== "single") {
            b.rest = b.rest || (b.type === "contrast" ? 180 : 90);
            b.items.forEach((x, n) => { x.rest = b.type === "contrast" && n === 0 ? 15 : 0; x.sets = b.items[0].sets; });
          } else b.items[0].rest = b.items[0].rest || 90;
          redraw(false);
        }
      });
      body.addEventListener("click", async (e) => {
        const add = e.target.closest("[data-add]")?.dataset.add;
        if (add) {
          pickExercise((ex) => {
            const blk = { id: crypto.randomUUID?.() || String(Math.random()), type: add, rest: add === "contrast" ? 180 : add === "single" ? 0 : 90, items: [newItem(ex, add)] };
            day().blocks.push(blk);
            redraw();
            if (add !== "single") toast(`Ahora sumá el segundo ejercicio del ${BLOCK_TYPES[add].label.toLowerCase()}`);
          }, add === "single" ? "Agregar ejercicio" : `${BLOCK_TYPES[add].label}: primer ejercicio`);
          return;
        }
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (!act) return;
        const { b, bi, i, ii } = ref(e.target);
        const blocks = day().blocks;
        const mv = (arr, a, to) => { if (to < 0 || to >= arr.length) return; arr.splice(to, 0, arr.splice(a, 1)[0]); redraw(false); };
        if (act === "swap") pickExercise((ex) => { i.ex = ex; redraw(false); }, "Cambiar ejercicio");
        if (act === "add-to-block") pickExercise((ex) => { const n = newItem(ex, b.type); n.sets = b.items[0].sets; n.rest = 0; b.items.push(n); redraw(false); });
        if (act === "up") ii > 0 ? mv(b.items, ii, ii - 1) : mv(blocks, bi, bi - 1);
        if (act === "down") ii < b.items.length - 1 ? mv(b.items, ii, ii + 1) : mv(blocks, bi, bi + 1);
        if (act === "bup") mv(blocks, bi, bi - 1);
        if (act === "bdown") mv(blocks, bi, bi + 1);
        if (act === "del-item") { b.items.splice(ii, 1); if (!b.items.length) blocks.splice(bi, 1); redraw(false); }
        if (act === "del-block" && await confirmDialog({ title: "¿Quitar este bloque?", ok: "Quitar", danger: true })) { blocks.splice(bi, 1); redraw(false); }
        if (act === "dup-day") { const c = JSON.parse(JSON.stringify(day())); c.name = `Día ${obj.days.length + 1}`; obj.days.push(S.normDays([strip(c)])[0]); cur = obj.days.length - 1; renumber(); redraw(); }
        if (act === "left-day" || act === "right-day") { const to = cur + (act === "left-day" ? -1 : 1); obj.days.splice(to, 0, obj.days.splice(cur, 1)[0]); cur = to; renumber(); redraw(); }
        if (act === "del-day" && await confirmDialog({ title: `¿Borrar ${day().name}?`, text: "Se quitan todos sus ejercicios.", ok: "Borrar", danger: true })) { obj.days.splice(cur, 1); cur = Math.max(0, cur - 1); renumber(); redraw(); }
      });
      tabsEl.addEventListener("click", (e) => {
        const t = e.target.closest("[data-day]");
        if (t) { cur = +t.dataset.day; tabsEl.innerHTML = tabs(); body.innerHTML = dayBody(); return; }
        if (e.target.closest("[data-act=add-day]")) { obj.days.push(S.normDays([{ name: `Día ${obj.days.length + 1}`, focus: "", blocks: [] }])[0]); cur = obj.days.length - 1; renumber(); redraw(); }
      });
      host.querySelector(".ed-foot").addEventListener("click", async (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act === "dup-t") { const t = S.api.duplicateTemplate(obj.id, me().id); toast("Plantilla duplicada"); go("/panel/plantilla/" + t.id); }
        if (act === "del-t" && await confirmDialog({ title: "¿Borrar la plantilla?", text: "Las rutinas que ya se asignaron con ella no cambian.", ok: "Borrar", danger: true })) { S.api.deleteTemplate(obj.id); toast("Plantilla borrada"); go("/panel/plantillas"); }
        if (act === "as-t") {
          sheet({ title: "Guardar como plantilla", html: `<form novalidate>${field({ label: "Nombre de la plantilla", name: "tname", value: obj.name, req: true })}<button class="btn primary block" type="submit">Guardar</button></form>`, onMount(b, close) {
            $("form", b).addEventListener("submit", (ev) => { ev.preventDefault(); const t = S.api.templateFromRoutine(obj.id, me().id, formData(ev.target).tname || obj.name); close(); toast("Plantilla creada"); go("/panel/plantilla/" + t.id); });
          } });
        }
        if (act === "activate") { S.api.activateRoutine(obj.id); toast("Rutina activada"); refresh(); }
      });
      host.querySelector(".phead-a")?.addEventListener("click", (e) => { if (e.target.closest("[data-act=assign]")) assignSheet({ templateId: obj.id }); });
    },
  };
}

function strip(d) {
  delete d.id;
  d.blocks.forEach((b) => { delete b.id; b.items.forEach((i) => delete i.id); });
  return d;
}

export function routineEditorView(params) {
  const r = S.routine(params.id);
  if (!r) return go("/panel/socios", { replace: true });
  return editor(r, "routine");
}
export function templateEditorView(params) {
  const t = S.template(params.id);
  if (!t) return go("/panel/plantillas", { replace: true });
  return editor(t, "template");
}

/* --------------------------------------------------- lista de plantillas */
export function templatesView(params, query) {
  const f = { q: query.q || "", level: query.nivel || "", aud: query.publico || "", days: query.dias || "" };
  const all = S.db.templates.slice().sort((a, b) => a.order - b.order);
  const list = all.filter((t) => (!f.level || t.level === f.level) && (!f.aud || t.audience === f.aud) && (!f.days || String(t.days.length) === f.days) && (!f.q || fold(t.name + " " + t.goal + " " + t.desc).includes(fold(f.q))));
  const using = (id) => S.db.routines.filter((r) => r.active && r.fromTemplate === id).length;
  const dayCounts = [...new Set(all.map((t) => t.days.length))].sort();
  const sel = (name, label, val, opts) => `<label class="field compact"><span class="sr">${label}</span><select data-filter="${name}"><option value="">${label}</option>${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === val ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select></label>`;
  return {
    layout: "panel", nav: "plantillas", title: "Plantillas",
    html: `${pageHead({ title: "Plantillas de rutina", actions: `<button class="btn primary sm" type="button" data-act="new">${icon("plus", "sm")} Nueva</button>` })}
      <p class="muted lead">Rutinas modelo que se asignan a muchos socios. Al asignar, cada socio recibe su copia y se puede personalizar sin tocar la plantilla.</p>
      <div class="filters">
        <label class="search">${icon("search", "sm")}<input type="search" data-filter="q" value="${esc(f.q)}" placeholder="Buscar" aria-label="Buscar plantilla"></label>
        ${sel("nivel", "Nivel", f.level, LEVELS)}${sel("publico", "Público", f.aud, AUDIENCES)}${sel("dias", "Días", f.days, dayCounts.map((d) => [d, plural(d, "día", "días")]))}
      </div>
      <div class="tgrid">${list.map((t) => {
        const n = using(t.id);
        return `<article class="tcard">
          <a class="tcard-main" href="#/panel/plantilla/${t.id}">
            <div class="tags">${tag(t.level)}${tag(t.audience)}${tag(t.goal, "red")}</div>
            <h2>${esc(t.name)}</h2>
            <p class="muted">${esc(t.desc || "")}</p>
            <ol class="tdays">${t.days.map((d) => `<li><b>${esc(d.name)}</b> ${esc(d.focus)}</li>`).join("")}</ol>
          </a>
          <footer><span class="muted tiny">${n ? `${icon("users", "xs")} ${plural(n, "socio", "socios")}` : "Sin asignar"}</span>
            <button class="btn ghost sm" type="button" data-assign="${t.id}">${icon("userplus", "sm")} Asignar</button></footer>
        </article>`;
      }).join("") || empty("layers", "No hay plantillas con esos filtros")}</div>`,
    mount(host) {
      limitList($(".tgrid", host), { size: 18, itemSel: ":scope > .tcard" });
      const upd = debounce(() => {
        const p = new URLSearchParams();
        $$("[data-filter]", host).forEach((x) => x.value && p.set(x.dataset.filter, x.value));
        location.hash = "#/panel/plantillas" + (p.toString() ? "?" + p : "");
      }, 250);
      host.addEventListener("input", (e) => e.target.dataset.filter === "q" && upd());
      host.addEventListener("change", (e) => e.target.dataset.filter && e.target.dataset.filter !== "q" && upd());
      host.addEventListener("click", (e) => {
        if (e.target.closest("[data-act=new]")) { const t = S.api.newTemplate(me().id); go("/panel/plantilla/" + t.id); }
        const a = e.target.closest("[data-assign]");
        if (a) assignSheet({ templateId: a.dataset.assign });
      });
      const q = $("[data-filter=q]", host);
      if (f.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    },
  };
}

/* --------------------------------------------------- biblioteca de ejercicios */
export function exercisesView(params, query) {
  const g = query.g || "", q = query.q || "";
  const list = S.db.exercises.filter((e) => (!g || e.g === g) && (!q || fold(e.n).includes(fold(q)))).sort((a, b) => a.n.localeCompare(b.n, "es"));
  const noVideo = S.db.exercises.filter((e) => !e.video).length;
  return {
    layout: "panel", nav: "ejercicios", title: "Ejercicios",
    html: `${pageHead({ title: "Biblioteca de ejercicios", actions: `<button class="btn primary sm" type="button" data-act="new">${icon("plus", "sm")} Nuevo</button>` })}
      <p class="muted lead">${plural(S.db.exercises.length, "ejercicio", "ejercicios")} con instrucciones. ${noVideo ? `${noVideo} sin video todavía: se pueden cargar enlaces de YouTube a medida que los graben.` : ""}</p>
      <div class="filters">
        <label class="search">${icon("search", "sm")}<input type="search" data-q value="${esc(q)}" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio"></label>
      </div>
      <div class="chips-scroll">${["", ...GROUPS].map((x) => `<a class="chip ${x === g ? "on" : ""}" href="#/panel/ejercicios${x ? "?g=" + encodeURIComponent(x) : ""}">${x || "Todos"}</a>`).join("")}</div>
      <div class="exlist">${list.map((e) => `<button type="button" class="exrow" data-ex="${e.id}">${exTile(e)}<span class="exrow-t"><b>${esc(e.n)}</b><small>${esc(e.g)} · ${esc(e.eq)}</small></span>${e.video ? `<span class="pill ok">${icon("video", "xs")} Video</span>` : ""}${icon("edit", "sm")}</button>`).join("") || empty("search", "No encontramos ese ejercicio", "", `<button class="btn primary" type="button" data-act="new">Crear “${esc(q)}”</button>`)}</div>`,
    mount(host) {
      limitList($(".exlist", host), { size: 30 });
      const inp = $("[data-q]", host);
      inp.addEventListener("input", debounce(() => { location.hash = `#/panel/ejercicios?${new URLSearchParams({ ...(g ? { g } : {}), ...(inp.value ? { q: inp.value } : {}) })}`; }, 300));
      if (q) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
      host.addEventListener("click", (e) => {
        if (e.target.closest("[data-act=new]")) exerciseSheet({ n: q, g: g || "Pecho", eq: "Máquina", sec: "", steps: [], tip: "", video: "" });
        const b = e.target.closest("[data-ex]");
        if (b) exerciseSheet(S.exercise(b.dataset.ex));
      });
    },
  };
}

function exerciseSheet(ex) {
  const isNew = !ex.id;
  sheet({
    title: isNew ? "Nuevo ejercicio" : "Editar ejercicio", wide: true,
    html: `<form novalidate>
      ${field({ label: "Nombre", name: "n", value: ex.n, req: true })}
      <div class="grid2">${field({ label: "Grupo muscular", name: "g", value: ex.g, options: GROUPS })}${field({ label: "Equipamiento", name: "eq", value: ex.eq, options: EQUIP })}</div>
      ${field({ label: "Músculos secundarios", name: "sec", value: ex.sec, ph: "Ej: tríceps, hombro anterior" })}
      ${field({ label: "Cómo se hace (un paso por renglón)", name: "steps", type: "textarea", value: (ex.steps || []).join("\n"), attrs: 'rows="5"' })}
      ${field({ label: "Consejo del profe", name: "tip", value: ex.tip })}
      ${field({ label: "Video (enlace de YouTube)", name: "video", type: "url", value: ex.video, ph: "https://youtu.be/…", hint: "Pueden ser videos “no listados” del canal de Vientos." })}
      <div class="row-btns">${isNew ? "" : `<button class="btn ghost danger-t" type="button" data-del>${icon("trash", "sm")} Borrar</button>`}<button class="btn primary" type="submit">Guardar</button></div>
    </form>`,
    onMount(b, close) {
      const f = $("form", b);
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const d = formData(f);
        if (!d.n.trim()) return toast("Escribí el nombre del ejercicio.", "err");
        S.api.saveExercise({ ...(isNew ? {} : { id: ex.id }), n: d.n.trim(), g: d.g, eq: d.eq, sec: d.sec, steps: d.steps.split("\n").map((s) => s.trim()).filter(Boolean), tip: d.tip, video: d.video.trim() });
        close(); toast(isNew ? "Ejercicio creado" : "Ejercicio guardado"); refresh();
      });
      $("[data-del]", b)?.addEventListener("click", async () => {
        if (S.api.exerciseInUse(ex.id)) return toast("Está en plantillas o rutinas activas. Quitalo de ahí primero.", "err");
        close();
        if (await confirmDialog({ title: `¿Borrar “${ex.n}”?`, ok: "Borrar", danger: true })) { S.api.deleteExercise(ex.id); toast("Ejercicio borrado"); refresh(); }
      });
    },
  });
}


/* Plantillas iniciales de rutina. Los profes las editan, duplican o crean nuevas.
   Estructura: plantilla → días → bloques → ejercicios.
   Tipos de bloque:
   · single   un ejercicio con sus series y su descanso
   · super    superserie / biserie: ejercicios seguidos y descanso al final de la vuelta
   · contrast contraste: uno pesado + uno explosivo, descanso al final del par
   · circuit  circuito: varios ejercicios en ronda, descanso al final de cada vuelta */

export const LEVELS = ["Básico", "Intermedio", "Avanzado"];
export const AUDIENCES = ["Mixto", "Hombres", "Mujeres"];
export const GOALS = ["Adaptación", "Hipertrofia", "Fuerza", "Glúteos y piernas", "Potencia deportiva", "Quema y acondicionamiento"];
export const BLOCK_TYPES = {
  single: { label: "Ejercicio", short: "" },
  super: { label: "Superserie", short: "Superserie" },
  contrast: { label: "Contraste", short: "Contraste" },
  circuit: { label: "Circuito", short: "Circuito" },
  /* Programas por semanas (Fitz Club) */
  prep: { label: "Movilidad y core", short: "Movilidad y core", program: true },
  strength: { label: "Fuerza", short: "Fuerza", program: true },
  accessory: { label: "Accesorios", short: "Accesorios", program: true },
  emom: { label: "EMOM", short: "EMOM", program: true },
};
export const CLASSIC_BLOCKS = ["single", "super", "contrast", "circuit"];
export const PROGRAM_BLOCKS = ["prep", "strength", "accessory", "emom"];

/* Ayudantes compactos: it(ejercicio, series, reps, kg, descanso s, nota) */
const it = (ex, sets, reps, kg = null, rest = 90, note = "") => ({ ex, sets, reps: String(reps), kg, rest, note });
const one = (ex, sets, reps, kg, rest, note) => ({ type: "single", items: [it(ex, sets, reps, kg, rest, note)] });
const sup = (rest, ...items) => ({ type: "super", rest, items: items.map((i) => ({ ...i, rest: 0 })) });
const con = (rest, heavy, explosive) => ({ type: "contrast", rest, items: [{ ...heavy, rest: 15 }, { ...explosive, rest: 0 }] });
const cir = (rounds, rest, ...items) => ({ type: "circuit", rest, items: items.map((i) => ({ ...i, sets: rounds, rest: 15 })) });
const day = (name, focus, ...blocks) => ({ name, focus, blocks });

export const TEMPLATES = [
  {
    key: "inicial-3", name: "Inicial · Cuerpo completo", level: "Básico", audience: "Mixto", goal: "Adaptación", weeks: 4,
    desc: "Para las primeras semanas en el gimnasio. Máquinas y movimientos básicos para aprender la técnica y crear el hábito.",
    days: [
      day("Día 1", "Cuerpo completo A",
        one("bici", 1, "8 min", null, 0, "Entrada en calor suave"),
        one("press-maquina", 3, "12-15", 20, 75),
        one("jalon-pecho", 3, "12-15", 25, 75),
        one("prensa", 3, "12-15", 60, 90),
        one("vuelos-laterales", 2, "15", 3, 60),
        one("curl-femoral", 2, "12-15", 15, 60),
        one("plancha", 3, "20 s", null, 45)),
      day("Día 2", "Cuerpo completo B",
        one("cinta", 1, "8 min", null, 0, "Caminata rápida"),
        one("sentadilla-goblet", 3, "12", 8, 90),
        one("remo-polea-baja", 3, "12-15", 25, 75),
        one("press-hombro-manc", 3, "12", 5, 75),
        one("puente-gluteo", 3, "15", null, 60),
        one("triceps-polea", 2, "15", 10, 60),
        one("crunch-polea", 2, "15", 10, 45)),
      day("Día 3", "Cuerpo completo C",
        one("bici", 1, "8 min", null, 0),
        one("press-inclinado-manc", 3, "12", 8, 75),
        one("remo-mancuerna", 3, "12", 10, 75),
        one("sillon-cuadriceps", 3, "15", 20, 60),
        one("hiperextensiones", 2, "12", null, 60),
        one("curl-alterno", 2, "12", 6, 60),
        one("elevacion-piernas", 2, "10", null, 45, "Con rodillas flexionadas")),
    ],
  },
  {
    key: "hombres-5", name: "Hombres · 5 días", level: "Avanzado", audience: "Hombres", goal: "Hipertrofia", weeks: 6,
    desc: "Rutina dividida por grupos musculares para quienes ya entrenan hace tiempo. Intermedio–avanzado.",
    days: [
      day("Día 1", "Pecho y tríceps",
        one("press-banca", 4, "8-10", 60, 120),
        one("press-inclinado-manc", 4, "10", 22, 90),
        one("aperturas-polea", 3, "12-15", 12, 60),
        one("fondos", 3, "al fallo", null, 90),
        sup(75, it("triceps-polea", 3, "12", 25), it("triceps-tras-nuca", 3, "12", 16))),
      day("Día 2", "Espalda, bíceps y abdomen",
        one("dominadas", 4, "6-8", null, 120),
        one("remo-polea-baja", 4, "10-12", 55, 60),
        one("remo-mancuerna", 3, "10", 28, 75),
        one("pullover-polea", 3, "12-15", 20, 60),
        one("curl-barra", 3, "10", 30, 75),
        one("curl-martillo", 3, "12", 14, 60),
        sup(60, it("elevacion-piernas", 3, "12"), it("crunch-polea", 3, "15", 30))),
      day("Día 3", "Piernas",
        one("sentadilla", 4, "6-8", 80, 150),
        one("prensa", 4, "10-12", 160, 120),
        one("peso-muerto-rumano", 3, "10", 60, 120),
        one("bulgara", 3, "10 c/p", 14, 90),
        sup(60, it("sillon-cuadriceps", 3, "15", 45), it("curl-femoral", 3, "15", 35)),
        one("gemelos-pie", 4, "15", 60, 45)),
      day("Día 4", "Hombros y abdomen",
        one("press-militar", 4, "8", 40, 120),
        one("vuelos-laterales", 4, "12-15", 10, 60),
        one("face-pull", 3, "15", 20, 60),
        one("pajaro", 3, "15", 8, 60),
        one("rueda-abdominal", 3, "10", null, 60),
        one("plancha", 3, "45 s", null, 45)),
      day("Día 5", "Brazos y torso",
        one("press-maquina", 3, "10", 50, 90),
        one("jalon-pecho", 3, "10", 60, 90),
        sup(75, it("curl-polea", 3, "12", 25), it("triceps-polea", 3, "12", 27.5)),
        sup(75, it("curl-alterno", 3, "10", 14), it("press-frances", 3, "10", 25)),
        one("pallof", 3, "12 c/l", 15, 45)),
    ],
  },
  {
    key: "hombres-3", name: "Hombres · 3 días", level: "Intermedio", audience: "Hombres", goal: "Hipertrofia", weeks: 6,
    desc: "Empuje, tracción y piernas. Para quien entrena tres veces por semana y quiere progresar.",
    days: [
      day("Día 1", "Empuje: pecho, hombros y tríceps",
        one("press-banca", 4, "8-10", 55, 120),
        one("press-hombro-manc", 3, "10", 18, 90),
        one("press-inclinado-manc", 3, "10-12", 20, 90),
        one("vuelos-laterales", 3, "15", 8, 60),
        one("triceps-polea", 3, "12", 22.5, 60)),
      day("Día 2", "Tracción: espalda y bíceps",
        one("jalon-pecho", 4, "10", 55, 90),
        one("remo-barra", 4, "8-10", 50, 120),
        one("remo-polea-baja", 3, "12", 50, 75),
        one("face-pull", 3, "15", 17.5, 60),
        one("curl-barra", 3, "10", 25, 60)),
      day("Día 3", "Piernas y abdomen",
        one("sentadilla", 4, "8", 70, 150),
        one("peso-muerto-rumano", 3, "10", 55, 120),
        one("prensa", 3, "12", 140, 90),
        one("curl-femoral", 3, "12", 30, 60),
        one("gemelos-sentado", 3, "15", 30, 45),
        one("plancha", 3, "40 s", null, 45)),
    ],
  },
  {
    key: "mujeres-3", name: "Mujeres · 3 días", level: "Básico", audience: "Mujeres", goal: "Glúteos y piernas", weeks: 5,
    desc: "Énfasis en glúteos y piernas con un día de tren superior. Ideal para empezar o retomar.",
    days: [
      day("Día 1", "Glúteos y cuádriceps",
        one("bici", 1, "6 min", null, 0),
        one("sentadilla-goblet", 3, "12", 10, 90),
        one("hip-thrust", 3, "12", 30, 90),
        one("prensa", 3, "15", 50, 75),
        one("abductores", 3, "15-20", 30, 45),
        one("plancha", 3, "25 s", null, 45)),
      day("Día 2", "Tren superior y abdomen",
        one("jalon-pecho", 3, "12", 25, 75),
        one("press-maquina", 3, "12", 15, 75),
        one("remo-polea-baja", 3, "12", 25, 60),
        one("vuelos-laterales", 3, "15", 3, 45),
        sup(60, it("curl-alterno", 2, "12", 5), it("triceps-polea", 2, "12", 10)),
        one("crunch-polea", 3, "15", 15, 45)),
      day("Día 3", "Glúteos e isquiotibiales",
        one("peso-muerto-rumano", 3, "12", 25, 90),
        one("estocadas", 3, "10 c/p", 6, 75),
        one("curl-femoral", 3, "12", 20, 60),
        one("patada-gluteo", 3, "15 c/p", 7.5, 45),
        one("puente-gluteo", 2, "20", null, 45),
        one("cinta", 1, "10 min", null, 0, "Caminata con inclinación")),
    ],
  },
  {
    key: "mujeres-4", name: "Mujeres · 4 días", level: "Intermedio", audience: "Mujeres", goal: "Glúteos y piernas", weeks: 6,
    desc: "Torso y pierna alternados, con dos días de glúteos fuertes. Para quien ya tiene base.",
    days: [
      day("Día 1", "Pierna: glúteos",
        one("hip-thrust", 4, "8-10", 60, 120),
        one("bulgara", 3, "10 c/p", 10, 90),
        one("peso-muerto-rumano", 3, "10", 40, 90),
        sup(45, it("abductores", 3, "20", 40), it("puente-gluteo", 3, "15"))),
      day("Día 2", "Torso",
        one("jalon-pecho", 4, "10", 35, 90),
        one("press-inclinado-manc", 3, "10", 8, 75),
        one("remo-mancuerna", 3, "12", 12, 60),
        one("press-hombro-manc", 3, "12", 6, 60),
        one("face-pull", 3, "15", 10, 45)),
      day("Día 3", "Pierna: cuádriceps",
        one("sentadilla", 4, "8-10", 40, 120),
        one("prensa", 3, "12", 90, 90),
        one("estocadas", 3, "12 c/p", 8, 75),
        one("sillon-cuadriceps", 3, "15", 25, 45),
        one("gemelos-pie", 3, "15", 30, 45)),
      day("Día 4", "Glúteos, brazos y core",
        one("patada-gluteo", 3, "15 c/p", 10, 45),
        one("swing-kettlebell", 3, "15", 12, 60),
        sup(60, it("curl-martillo", 3, "12", 6), it("fondos-banco", 3, "12")),
        cir(3, 60, it("plancha", 3, "30 s"), it("pallof", 3, "10 c/l", 7.5), it("elevacion-piernas", 3, "10"))),
    ],
  },
  {
    key: "torso-pierna-4", name: "Torso / Pierna · 4 días", level: "Intermedio", audience: "Mixto", goal: "Fuerza", weeks: 6,
    desc: "Dos días de torso y dos de pierna con básicos pesados. Pocas repeticiones, buenos descansos.",
    days: [
      day("Día 1", "Torso fuerza",
        one("press-banca", 5, "5", 65, 180),
        one("remo-barra", 5, "5", 60, 150),
        one("press-militar", 3, "6", 35, 120),
        one("dominadas", 3, "6", null, 120)),
      day("Día 2", "Pierna fuerza",
        one("sentadilla", 5, "5", 90, 180),
        one("peso-muerto-rumano", 4, "6", 70, 150),
        one("prensa", 3, "8", 170, 120),
        one("gemelos-pie", 3, "12", 70, 60)),
      day("Día 3", "Torso volumen",
        one("press-inclinado-manc", 4, "10", 24, 90),
        one("jalon-pecho", 4, "10", 60, 90),
        sup(60, it("vuelos-laterales", 3, "15", 10), it("face-pull", 3, "15", 20)),
        sup(60, it("curl-barra", 3, "10", 30), it("triceps-polea", 3, "12", 27.5))),
      day("Día 4", "Pierna volumen",
        one("peso-muerto", 3, "5", 110, 180),
        one("bulgara", 3, "8 c/p", 18, 90),
        one("hip-thrust", 3, "10", 90, 90),
        one("curl-femoral", 3, "12", 35, 60),
        one("rueda-abdominal", 3, "10", null, 60)),
    ],
  },
  {
    key: "contraste-3", name: "Contraste · Deportistas", level: "Avanzado", audience: "Mixto", goal: "Potencia deportiva", weeks: 4,
    desc: "Método de contraste: un ejercicio pesado seguido de uno explosivo. Para deportistas que buscan más salto, velocidad y potencia.",
    days: [
      day("Día 1", "Tren inferior · potencia",
        one("bici", 1, "8 min", null, 0, "Entrada en calor + movilidad"),
        con(180, it("sentadilla", 4, "4", 70, 15, "Al 80–85 % de tu máximo"), it("salto-cajon", 4, "5", null, 0, "Explosivo, aterrizaje suave")),
        con(180, it("hip-thrust", 3, "5", 80), it("saltos-horizontales", 3, "4")),
        one("curl-femoral", 3, "8", 30, 75),
        one("pallof", 3, "10 c/l", 15, 45)),
      day("Día 2", "Tren superior · potencia",
        con(180, it("press-banca", 4, "4", 45, 15), it("lanzamiento-balon", 4, "6", 4)),
        con(150, it("remo-barra", 4, "5", 40), it("dominada-explosiva", 4, "6")),
        one("press-hombro-manc", 3, "8", 12, 75),
        one("slam-balon", 3, "8", 6, 60)),
      day("Día 3", "Cuerpo completo · velocidad",
        con(180, it("peso-muerto", 3, "3", 80), it("salto-vertical", 3, "5")),
        con(150, it("bulgara", 3, "5 c/p", 12), it("swing-kettlebell", 3, "10", 16)),
        cir(3, 90, it("burpees", 3, "8"), it("soga", 3, "40 s"), it("plancha", 3, "30 s"))),
    ],
  },
  {
    key: "quema-3", name: "Quema · Circuitos", level: "Intermedio", audience: "Mixto", goal: "Quema y acondicionamiento", weeks: 4,
    desc: "Circuitos de cuerpo completo con poco descanso. Para bajar grasa y mejorar el estado físico.",
    days: [
      day("Día 1", "Circuito A",
        cir(4, 90, it("sentadilla-goblet", 4, "15", 12), it("flexiones", 4, "12"), it("swing-kettlebell", 4, "15", 12), it("remo-polea-baja", 4, "15", 35), it("soga", 4, "45 s")),
        one("bici", 1, "10 min", null, 0, "Intervalos: 30 s fuerte / 30 s suave")),
      day("Día 2", "Circuito B",
        cir(4, 90, it("estocadas", 4, "10 c/p", 6), it("press-hombro-manc", 4, "12", 8), it("burpees", 4, "10"), it("jalon-pecho", 4, "15", 40), it("plancha", 4, "30 s"))),
      day("Día 3", "Circuito C",
        cir(3, 75, it("prensa", 3, "20", 80), it("slam-balon", 3, "12", 6), it("press-maquina", 3, "15", 25), it("puente-gluteo", 3, "20"), it("elevacion-piernas", 3, "12")),
        one("cinta", 1, "12 min", null, 0, "Caminata con inclinación")),
    ],
  },
];

/* ------------------------------------------------ programas por semanas (Fitz Club)
   Un programa dura N semanas (6). Cada ejercicio tiene su prescripción por semana
   en `wk`: [{ s: series (o minutos en EMOM), r: repeticiones }], una por semana.
   El bloque "prep" (movilidad y core) es una lista para tildar, sin pesos: `col` dice
   si va en la columna de movilidad ("mob") o de core ("core"). */
const wks = (...list) => list.map(([s, r]) => ({ s, r: String(r) }));
const same = (s, r, n = 6) => Array.from({ length: n }, () => ({ s, r: String(r) }));
const ACC = () => wks([4, 6], [4, 6], [4, 8], [4, 8], [4, 10], [4, 10]);
const EMOM_UP = () => wks([5, "10/12/14/16/18"], [5, "12/14/16/18/20"], [5, "14/16/18/20/20"], [5, "16/18/20/20/20"], [5, "18/20/20/20/20"], [5, "20/20/20/20/20"]);
const pi = (ex, wk, note = "") => ({ ex, sets: wk[0].s, reps: wk[0].r, kg: null, rest: 0, note, wk });
const prep = (mob, core) => ({ type: "prep", rest: 0, items: [...mob.map((ex) => ({ ex, sets: 1, reps: "10", kg: null, rest: 0, note: "", col: "mob" })), ...core.map((ex) => ({ ex, sets: 1, reps: "10", kg: null, rest: 0, note: "", col: "core" }))] });
const pb = (type, rest, ...items) => ({ type, rest, items });

export const PROGRAMS = [
  {
    key: "fitz-sm-6", kind: "program", space: "fitz", name: "Fuerza y movimiento · 3 días", weeks: 6,
    level: "Intermedio", audience: "Mixto", goal: "Fuerza y movimiento",
    meta: { deporte: "", metodo: "Fuerza y movimiento", etapa: "" },
    desc: "6 semanas, 3 días por semana: movilidad y core, fuerza, accesorios con progresión semanal y EMOM.",
    days: [
      day("Día 1", "Sentadilla · press vikingo",
        prep(["sentadilla-pulso", "dorsiflexion-tobillo", "rock-back", "fz-flexiones"], ["bicho-muerto", "bird-dog", "fz-pallof"]),
        pb("strength", 150, pi("fz-sentadilla", same(4, 5)), pi("press-vikingo", same(4, 6))),
        pb("accessory", 90, pi("peso-muerto-asimetrico", ACC()), pi("remo-90", ACC(), "Última serie AMRAP: todas las repeticiones que puedas con buena técnica"), pi("caminata-granjero", same(4, "30 s"))),
        pb("emom", 0, pi("thruster-db", same(5, "6/8/10/12/14")))),
      day("Día 2", "Press banco · peso muerto rumano",
        prep(["bottom-up-kb", "push-up-barra", "pull-apart", "triceps-banda"], ["bicho-muerto", "bird-dog"]),
        pb("strength", 150, pi("fz-press-banca", same(4, 5)), pi("fz-peso-muerto-rumano", same(4, 6))),
        pb("accessory", 90, pi("bulgara-kb", ACC()), pi("rack-chin-up", ACC()), pi("transporte-valija", same(4, "30 s"))),
        pb("emom", 0, pi("swing-americano", EMOM_UP()))),
      day("Día 3", "Peso muerto trap bar · press",
        prep(["buenos-dias", "hip-90-90", "push-up-plus", "extension-pared"], ["bicho-muerto", "bird-dog"]),
        pb("strength", 150, pi("peso-muerto-trapbar", same(4, 5)), pi("press-simultaneo-alterno", same(4, 6))),
        pb("accessory", 90, pi("split-db", ACC()), pi("remo-polea-dividida", ACC()), pi("caminata-granjero", same(4, "30 s"), "Pesada")),
        pb("emom", 0, pi("biceps-press", EMOM_UP()))),
    ],
  },
  {
    key: "fitz-sm2-6", kind: "program", space: "fitz", name: "Fuerza y movimiento · 2 días", weeks: 6,
    level: "Básico", audience: "Mixto", goal: "Fuerza y movimiento",
    meta: { deporte: "", metodo: "Fuerza y movimiento", etapa: "" },
    desc: "6 semanas, 2 días por semana, cuerpo completo: para quien viene dos veces o recién empieza.",
    days: [
      day("Día 1", "Sentadilla · press · remo",
        prep(["sentadilla-pulso", "dorsiflexion-tobillo", "hip-90-90", "pull-apart"], ["bicho-muerto", "fz-plancha"]),
        pb("strength", 150, pi("fz-sentadilla-goblet", wks([4, 8], [4, 8], [4, 6], [4, 6], [5, 5], [5, 5])), pi("fz-press-hombro-manc", same(4, 8))),
        pb("accessory", 90, pi("fz-remo-mancuerna", ACC()), pi("fz-estocadas", ACC()), pi("caminata-granjero", same(3, "30 s"))),
        pb("emom", 0, pi("swing-americano", same(5, "10/12/14/16/18")))),
      day("Día 2", "Peso muerto · empuje · tracción",
        prep(["buenos-dias", "rock-back", "push-up-plus", "extension-pared"], ["bird-dog", "fz-pallof"]),
        pb("strength", 150, pi("peso-muerto-trapbar", wks([4, 6], [4, 6], [4, 5], [4, 5], [5, 4], [5, 4])), pi("fz-flexiones", same(4, 10))),
        pb("accessory", 90, pi("fz-hip-thrust", ACC()), pi("rack-chin-up", ACC(), "Si cuesta, con banda de asistencia"), pi("transporte-valija", same(3, "30 s"))),
        pb("emom", 0, pi("thruster-db", same(5, "6/8/10/12/14")))),
    ],
  },
];

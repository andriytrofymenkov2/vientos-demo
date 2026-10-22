/* Ejercicios de los programas de Fitz Club (movilidad, core, fuerza,
   accesorios y EMOM). Se suman a la biblioteca general: cualquier profe los puede usar. */

const E = (id, n, g, eq, sec, steps, tip) => ({ id, n, g, eq, sec, steps, tip, video: "" });

export const EXERCISES_FITZ = [
  /* Movilidad y core · movilidad */
  E("sentadilla-pulso", "Sentadilla pulso", "Movilidad", "Peso corporal", "Glúteos, aductores, tobillos", [
    "Pies al ancho de hombros y puntas levemente hacia afuera.",
    "Bajá a una sentadilla profunda con el pecho arriba y los talones apoyados.",
    "Abajo hacé pequeños rebotes de pocos centímetros (pulsos), sin perder la postura.",
  ], "Sirve para ganar profundidad y abrir la cadera antes de la fuerza."),
  E("dorsiflexion-tobillo", "Dorsiflexión de tobillo", "Movilidad", "Peso corporal", "Pantorrillas, tobillo", [
    "Rodilla de atrás apoyada en el piso y el pie de adelante a un palmo de la pared.",
    "Llevá la rodilla de adelante hacia la pared, por encima de los dedos.",
    "El talón no se despega del piso. Volvé y repetí.",
  ], "Si llegás fácil a la pared, alejá un poco el pie."),
  E("rock-back", "Rock back", "Movilidad", "Peso corporal", "Cadera, espalda baja", [
    "En cuatro apoyos: manos debajo de los hombros y rodillas debajo de la cadera.",
    "Con la espalda neutra, llevá la cola hacia los talones lo más atrás que puedas.",
    "Volvé adelante sin redondear la espalda.",
  ], "El movimiento sale de la cadera: la espalda no se dobla."),
  E("bottom-up-kb", "Bottom up con kettlebell", "Movilidad", "Kettlebell", "Hombros, antebrazo, estabilizadores", [
    "Tomá la kettlebell con la base hacia arriba (boca abajo) frente al hombro.",
    "Apretá fuerte el agarre y mantené la muñeca recta.",
    "Empujá hacia arriba controlando que no se caiga y bajá despacio.",
  ], "Si se te cae para un costado, usá una más liviana."),
  E("push-up-barra", "Push up en barra", "Movilidad", "Barra", "Pecho, tríceps, core", [
    "Apoyá las manos en una barra a la altura de la cadera (rack o Smith).",
    "Cuerpo en línea, de la cabeza a los talones.",
    "Bajá el pecho a la barra y empujá hasta extender los brazos.",
  ], "Cuanto más alta la barra, más fácil."),
  E("pull-apart", "Pull apart con banda", "Movilidad", "Banda", "Hombro posterior, espalda alta", [
    "Tomá la banda frente al pecho con los brazos extendidos.",
    "Separá las manos llevando la banda al pecho y juntando las escápulas.",
    "Volvé lento, sin soltar la tensión.",
  ], "Hombros abajo, lejos de las orejas."),
  E("triceps-banda", "Tríceps con banda", "Movilidad", "Banda", "Tríceps", [
    "Banda enganchada arriba y codos pegados al cuerpo.",
    "Extendé los brazos hacia abajo hasta estirarlos.",
    "Volvé despacio sin mover los codos.",
  ], "Como entrada en calor: liviano y controlado."),
  E("buenos-dias", "Buenos días", "Movilidad", "Barra", "Isquiotibiales, glúteos, lumbares", [
    "Barra (o palo) en la espalda alta y rodillas apenas flexionadas.",
    "Llevá la cola hacia atrás inclinando el tronco con la espalda neutra.",
    "Bajá hasta sentir los isquiotibiales y volvé apretando los glúteos.",
  ], "En la preparación va sin carga o muy liviano."),
  E("hip-90-90", "90/90 de cadera", "Movilidad", "Peso corporal", "Rotadores de cadera, glúteos", [
    "Sentado en el piso, una pierna adelante y la otra al costado, las dos a 90°.",
    "Con el tronco erguido, girá las rodillas hacia el otro lado para cambiar de posición.",
    "Si podés, hacelo sin usar las manos.",
  ], "Movimiento lento: buscá rango, no velocidad."),
  E("push-up-plus", "Push up plus", "Movilidad", "Peso corporal", "Serrato, hombros", [
    "Posición de flexión con el cuerpo en línea.",
    "Hacé la flexión y, al subir, empujá un poco más el piso separando las escápulas.",
    "Volvé y repetí.",
  ], "El 'plus' es ese empujón final: ahí trabaja el serrato."),
  E("extension-pared", "Extensión en pared", "Movilidad", "Peso corporal", "Espalda alta, hombros", [
    "Espalda, cabeza y glúteos contra la pared.",
    "Brazos en forma de W, con codos y manos tocando la pared.",
    "Deslizá los brazos hacia arriba sin despegarlos y volvé.",
  ], "Si los brazos se despegan, acortá el recorrido."),

  /* Movilidad y core · core */
  E("bicho-muerto", "Bicho muerto + bracing", "Core", "Peso corporal", "Abdomen profundo", [
    "Boca arriba, brazos hacia el techo y rodillas a 90°.",
    "Bracing: apretá el abdomen como si fueras a recibir un golpe, con la zona lumbar pegada al piso.",
    "Extendé brazo y pierna contrarios sin despegar la espalda. Volvé y cambiá de lado.",
  ], "Exhalá al extender. Si la espalda se despega, acortá el recorrido."),
  E("bird-dog", "Bird dog", "Core", "Peso corporal", "Glúteos, lumbares", [
    "En cuatro apoyos: manos debajo de los hombros y rodillas debajo de la cadera.",
    "Extendé brazo y pierna contrarios hasta que queden en línea con el tronco.",
    "Sostené 1 o 2 segundos sin rotar la cadera. Volvé y cambiá de lado.",
  ], "Imaginá un vaso de agua apoyado en la espalda."),

  /* Fuerza */
  E("press-vikingo", "Press vikingo", "Hombros", "Landmine", "Tríceps, core", [
    "Barra en el landmine con manijas, de pie frente a ella.",
    "Arrancá con las manos a la altura de los hombros.",
    "Empujá hacia arriba y adelante hasta extender los codos y bajá controlado.",
  ], "Abdomen firme: que la zona lumbar no se arquee."),
  E("peso-muerto-trapbar", "Peso muerto con trap bar", "Cuádriceps", "Trap bar", "Glúteos, isquiotibiales, espalda", [
    "Parate en el centro de la barra hexagonal y tomá las manijas.",
    "Cadera atrás, pecho arriba y espalda neutra.",
    "Empujá el piso con las piernas hasta quedar derecho y bajá controlado.",
  ], "La trap bar deja la carga a los costados: es más amigable para la espalda."),
  E("press-simultaneo-alterno", "Press simultáneo + alterno", "Hombros", "Mancuernas", "Tríceps, core", [
    "De pie, mancuernas a la altura de los hombros.",
    "Empujá las dos juntas hacia arriba (simultáneo).",
    "Después alterná: un brazo y el otro, según lo que indique el profe.",
  ], "Glúteos y abdomen firmes para no arquear la espalda."),

  /* Accesorios */
  E("peso-muerto-asimetrico", "Peso muerto asimétrico", "Isquiotibiales", "Kettlebell", "Glúteos, oblicuos, agarre", [
    "Una sola pesa, al costado de un pie.",
    "Bisagra de cadera con la espalda neutra para tomarla.",
    "Subí sin que el tronco se incline hacia el lado de la pesa y bajá controlado.",
  ], "El core trabaja para que no rotes ni te inclines."),
  E("remo-90", "Remo a 90°", "Espalda", "Barra", "Bíceps, hombro posterior", [
    "Tronco inclinado casi paralelo al piso, rodillas semiflexionadas y espalda neutra.",
    "Tirá la barra hacia el abdomen juntando las escápulas.",
    "Bajá controlado sin levantar el tronco.",
  ], "AMRAP en la última serie: todas las repeticiones que puedas con buena técnica."),
  E("caminata-granjero", "Caminata de granjero", "Core", "Mancuernas", "Trapecio, agarre, piernas", [
    "Una pesa pesada en cada mano, de pie y derecho.",
    "Caminá con pasos cortos, hombros atrás y abajo, tronco firme.",
    "Sostené el tiempo indicado sin dejar que las pesas se balanceen.",
  ], "Mirá al frente y respirá: no aguantes el aire."),
  E("bulgara-kb", "Búlgaras con kettlebell", "Cuádriceps", "Kettlebell", "Glúteos", [
    "Pie de atrás apoyado en un banco y kettlebell en la mano (o a la altura del pecho).",
    "Bajá la rodilla de atrás hacia el piso con el tronco firme.",
    "Subí empujando con el pie de adelante. Hacé todas de un lado y cambiá.",
  ], "La rodilla de adelante acompaña la dirección del pie."),
  E("rack-chin-up", "Rack chin up", "Espalda", "Barra", "Bíceps", [
    "Barra baja en el rack: tomala con las palmas hacia vos.",
    "Pies apoyados adelante (en el piso o en un banco) y cuerpo en línea.",
    "Tirá del pecho hacia la barra y bajá controlado.",
  ], "Cuanto más adelante los pies, más difícil."),
  E("transporte-valija", "Transporte de valija", "Core", "Kettlebell", "Oblicuos, agarre", [
    "Una sola pesa, de un lado, como si llevaras una valija.",
    "Caminá derecho sin inclinarte hacia el lado de la pesa.",
    "Hacé el tiempo indicado y cambiá de mano.",
  ], "El trabajo es no inclinarse: el core sostiene."),
  E("split-db", "Split squat con mancuernas", "Cuádriceps", "Mancuernas", "Glúteos", [
    "Posición de estocada fija con una mancuerna en cada mano.",
    "Bajá la rodilla de atrás hacia el piso con el tronco derecho.",
    "Subí empujando con la pierna de adelante, sin mover los pies.",
  ], "Hacé todas las repeticiones de un lado y después cambiá."),
  E("remo-polea-dividida", "Remo en polea a un brazo (posición dividida)", "Espalda", "Polea", "Bíceps, core", [
    "Parate frente a la polea con un pie adelante y otro atrás (posición dividida).",
    "Tomá la manija con una mano, con el brazo estirado.",
    "Tirá el codo hacia atrás sin girar el tronco y volvé lento.",
  ], "El tronco no rota: la cadera queda mirando a la polea."),

  /* EMOM */
  E("thruster-db", "Thruster con mancuernas", "Potencia", "Mancuernas", "Cuádriceps, glúteos, hombros", [
    "Mancuernas a la altura de los hombros.",
    "Bajá a una sentadilla y, al subir, usá el impulso para empujarlas hacia arriba.",
    "Bajalas a los hombros y repetí de forma continua.",
  ], "EMOM: al empezar cada minuto hacés las repeticiones y descansás lo que sobre."),
  E("swing-americano", "Swing americano", "Potencia", "Kettlebell", "Glúteos, isquiotibiales, hombros", [
    "Kettlebell con las dos manos y bisagra de cadera.",
    "Llevala atrás entre las piernas y extendé la cadera de forma explosiva.",
    "La pesa sube hasta quedar arriba de la cabeza, con los brazos estirados.",
  ], "Si los hombros no llegan cómodos arriba, frená a la altura de los ojos (swing ruso)."),
  E("biceps-press", "Bíceps + press", "Bíceps", "Mancuernas", "Hombros", [
    "De pie con una mancuerna en cada mano.",
    "Hacé un curl de bíceps y, arriba, girá las palmas y empujá hacia arriba (press).",
    "Bajá controlado y repetí.",
  ], "Una repetición es el curl más el press."),
];

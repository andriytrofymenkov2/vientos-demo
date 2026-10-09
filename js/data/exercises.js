/* Biblioteca inicial de ejercicios (editable desde el panel).
   Campos: id, n (nombre), g (grupo muscular), eq (equipamiento), sec (músculos secundarios),
   steps (instrucciones), tip (consejo del profe), video (enlace, vacío hasta grabar los de Vientos). */

export const GROUPS = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Cuádriceps", "Isquiotibiales", "Glúteos", "Pantorrillas", "Abdomen", "Potencia", "Cardio"];
export const EQUIP = ["Barra", "Mancuernas", "Polea", "Máquina", "Peso corporal", "Kettlebell", "Banco", "Cajón", "Balón medicinal", "Bicicleta", "Soga"];

const E = (id, n, g, eq, sec, steps, tip) => ({ id, n, g, eq, sec, steps, tip, video: "" });

export const EXERCISES = [
  /* Pecho */
  E("press-banca", "Press de banca con barra", "Pecho", "Barra", "Tríceps, hombro anterior", [
    "Acostate en el banco con los ojos debajo de la barra y los pies firmes en el piso.",
    "Tomá la barra un poco más abierto que el ancho de hombros y juntá las escápulas.",
    "Bajá controlado hasta rozar el pecho a la altura del esternón.",
    "Empujá hacia arriba y atrás hasta extender los brazos sin bloquear los codos.",
  ], "Mantené los glúteos apoyados y los codos a unos 45° del cuerpo para cuidar los hombros."),
  E("press-inclinado-manc", "Press inclinado con mancuernas", "Pecho", "Mancuernas", "Hombro anterior, tríceps", [
    "Regulá el banco a 30–45° y apoyá bien la espalda.",
    "Arrancá con las mancuernas a los costados del pecho, palmas hacia adelante.",
    "Empujá hacia arriba juntándolas levemente arriba.",
    "Bajá lento hasta sentir el estiramiento en el pecho.",
  ], "No hace falta chocar las mancuernas arriba: mantené la tensión en el pecho."),
  E("press-maquina", "Press de pecho en máquina", "Pecho", "Máquina", "Tríceps", [
    "Ajustá el asiento para que las manijas queden a la altura del pecho.",
    "Espalda apoyada, escápulas juntas.",
    "Empujá hasta casi extender los brazos y volvé controlando.",
  ], "Ideal para empezar: el recorrido es guiado y seguro."),
  E("aperturas-polea", "Aperturas en polea (cruce)", "Pecho", "Polea", "Hombro anterior", [
    "Poleas altas, un paso adelante y el torso levemente inclinado.",
    "Con los codos apenas flexionados, llevá las manos hacia adelante y abajo hasta cruzarlas.",
    "Volvé abriendo despacio hasta sentir el estiramiento.",
  ], "Pensá en abrazar un árbol: los codos no cambian de ángulo."),
  E("fondos", "Fondos en paralelas", "Pecho", "Peso corporal", "Tríceps, hombro anterior", [
    "Sostenete con los brazos extendidos y el torso levemente inclinado hacia adelante.",
    "Bajá flexionando los codos hasta que los hombros queden a la altura de los codos.",
    "Subí empujando hasta extender los brazos.",
  ], "Si todavía no salen, usá la máquina asistida o apoyá los pies en un banco."),
  E("flexiones", "Flexiones de brazos", "Pecho", "Peso corporal", "Tríceps, core", [
    "Manos un poco más abiertas que los hombros, cuerpo en línea recta.",
    "Bajá el pecho hasta casi tocar el piso.",
    "Empujá manteniendo el abdomen firme.",
  ], "Para facilitarlas, apoyá las rodillas o las manos en un banco."),

  /* Espalda */
  E("dominadas", "Dominadas", "Espalda", "Peso corporal", "Bíceps, core", [
    "Colgate de la barra con agarre prono, un poco más abierto que los hombros.",
    "Bajá las escápulas y tirá llevando el pecho hacia la barra.",
    "Pasá el mentón por encima y bajá controlado hasta extender los brazos.",
  ], "Si no llegás, usá banda elástica o la máquina asistida."),
  E("jalon-pecho", "Jalón al pecho en polea", "Espalda", "Polea", "Bíceps", [
    "Sentate con los muslos trabados bajo los rodillos.",
    "Tomá la barra abierta y llevala al pecho sacando el pecho hacia afuera.",
    "Volvé estirando los brazos sin soltar la tensión.",
  ], "Tirá con los codos, no con las manos. No balancees el torso."),
  E("remo-polea-baja", "Remo en polea baja", "Espalda", "Polea", "Bíceps, deltoides posterior", [
    "Sentate con las rodillas levemente flexionadas y la espalda recta.",
    "Tirá del agarre hacia el abdomen juntando las escápulas.",
    "Volvé estirando los brazos sin encorvar la espalda.",
  ], "Un ejercicio muy eficiente para el grosor de la espalda. Mantené el pecho alto todo el recorrido."),
  E("remo-barra", "Remo con barra", "Espalda", "Barra", "Bíceps, lumbares", [
    "De pie, inclinate desde la cadera con la espalda neutra y rodillas flexionadas.",
    "Tirá la barra hacia el ombligo llevando los codos atrás.",
    "Bajá controlado sin perder la postura.",
  ], "Si sentís la zona lumbar, bajá el peso y acortá la inclinación."),
  E("remo-mancuerna", "Remo con mancuerna a una mano", "Espalda", "Mancuernas", "Bíceps", [
    "Apoyá rodilla y mano del mismo lado en el banco.",
    "Tirá la mancuerna hacia la cadera, codo pegado al cuerpo.",
    "Bajá estirando bien el dorsal.",
  ], "Imaginá que guardás la mancuerna en el bolsillo de atrás."),
  E("pullover-polea", "Pullover en polea alta", "Espalda", "Polea", "Tríceps largo", [
    "De pie frente a la polea alta, con brazos casi extendidos.",
    "Llevá la barra hacia los muslos en un arco.",
    "Volvé despacio hasta la altura de la cara.",
  ], "Excelente para sentir el dorsal antes de los ejercicios pesados."),
  E("hiperextensiones", "Hiperextensiones lumbares", "Espalda", "Banco", "Glúteos, isquiotibiales", [
    "Apoyá la cadera en el banco a 45° y trabá los talones.",
    "Bajá el torso con la espalda recta.",
    "Subí apretando glúteos hasta quedar en línea con las piernas.",
  ], "No arquees de más arriba: alcanza con quedar alineado."),

  /* Hombros */
  E("press-militar", "Press militar con barra", "Hombros", "Barra", "Tríceps, core", [
    "De pie, barra apoyada arriba del pecho y agarre al ancho de hombros.",
    "Apretá glúteos y abdomen y empujá la barra hacia arriba.",
    "Pasá la cabeza adelante cuando la barra cruza la cara y bajá controlado.",
  ], "No arquees la zona lumbar: el core es el que sostiene."),
  E("press-hombro-manc", "Press de hombros con mancuernas", "Hombros", "Mancuernas", "Tríceps", [
    "Sentado con respaldo vertical, mancuernas a la altura de las orejas.",
    "Empujá hacia arriba sin chocarlas.",
    "Bajá hasta que los codos queden a 90°.",
  ], "Codos un poco adelante del cuerpo, no totalmente abiertos."),
  E("vuelos-laterales", "Elevaciones laterales", "Hombros", "Mancuernas", "Trapecio", [
    "De pie, mancuernas a los costados y codos apenas flexionados.",
    "Elevá los brazos hacia los costados hasta la altura de los hombros.",
    "Bajá lento, sin dejar caer el peso.",
  ], "Liviano y prolijo: si balanceás, el peso es mucho."),
  E("face-pull", "Face pull en polea", "Hombros", "Polea", "Deltoides posterior, manguito rotador", [
    "Polea a la altura de la cara con soga.",
    "Tirá hacia la frente separando las manos y abriendo los codos.",
    "Pausá un segundo y volvé controlado.",
  ], "Clave para la postura y la salud del hombro."),
  E("pajaro", "Pájaros (deltoides posterior)", "Hombros", "Mancuernas", "Romboides", [
    "Inclinate hacia adelante con la espalda recta.",
    "Abrí los brazos hacia los costados con codos semiflexionados.",
    "Bajá lento.",
  ], "Pensá en llevar las manos lejos, no arriba."),

  /* Bíceps */
  E("curl-barra", "Curl de bíceps con barra", "Bíceps", "Barra", "Antebrazo", [
    "De pie, barra con agarre supino al ancho de hombros.",
    "Flexioná los codos sin moverlos de los costados.",
    "Bajá controlado hasta extender.",
  ], "Sin balanceo: la espalda queda quieta."),
  E("curl-alterno", "Curl alterno con mancuernas", "Bíceps", "Mancuernas", "Antebrazo", [
    "De pie o sentado, mancuernas a los costados.",
    "Subí una girando la palma hacia arriba.",
    "Bajá y alterná con el otro brazo.",
  ], "Apretá arriba un segundo."),
  E("curl-martillo", "Curl martillo", "Bíceps", "Mancuernas", "Braquial, antebrazo", [
    "Mancuernas con las palmas mirándose.",
    "Subí sin girar la muñeca.",
    "Bajá controlado.",
  ], "Suma grosor al brazo y fuerza de agarre."),
  E("curl-polea", "Curl en polea baja", "Bíceps", "Polea", "", [
    "Frente a la polea baja con barra recta o EZ.",
    "Flexioná los codos manteniéndolos fijos.",
    "Volvé despacio.",
  ], "La polea mantiene tensión en todo el recorrido."),

  /* Tríceps */
  E("triceps-polea", "Extensión de tríceps en polea", "Tríceps", "Polea", "", [
    "De pie frente a la polea alta con soga o barra.",
    "Codos pegados al cuerpo, extendé los brazos hacia abajo.",
    "Volvé hasta 90° sin despegar los codos.",
  ], "Con soga, separá las manos al final para apretar más."),
  E("press-frances", "Press francés", "Tríceps", "Barra", "", [
    "Acostado, barra EZ sobre el pecho con brazos extendidos.",
    "Flexioná los codos llevando la barra hacia la frente.",
    "Extendé sin abrir los codos.",
  ], "Codos apuntando al techo todo el tiempo."),
  E("triceps-tras-nuca", "Extensión de tríceps tras nuca", "Tríceps", "Mancuernas", "", [
    "Sentado, una mancuerna tomada con ambas manos sobre la cabeza.",
    "Bajala detrás de la cabeza flexionando los codos.",
    "Subí extendiendo por completo.",
  ], "Trabaja la porción larga del tríceps."),
  E("fondos-banco", "Fondos en banco", "Tríceps", "Banco", "Pecho", [
    "Manos en el borde del banco, piernas estiradas adelante.",
    "Bajá flexionando los codos hacia atrás.",
    "Subí extendiendo los brazos.",
  ], "Espalda cerca del banco para cuidar los hombros."),

  /* Cuádriceps */
  E("sentadilla", "Sentadilla con barra", "Cuádriceps", "Barra", "Glúteos, core", [
    "Barra sobre los trapecios, pies al ancho de hombros.",
    "Bajá llevando la cadera atrás y abajo, rodillas en línea con los pies.",
    "Llegá al menos a la paralela y subí empujando el piso.",
  ], "Pecho alto y talones apoyados siempre."),
  E("sentadilla-goblet", "Sentadilla goblet", "Cuádriceps", "Kettlebell", "Glúteos, core", [
    "Sostené una pesa rusa o mancuerna pegada al pecho.",
    "Bajá entre las piernas con el torso erguido.",
    "Subí apretando glúteos.",
  ], "La mejor forma de aprender la sentadilla."),
  E("prensa", "Prensa 45°", "Cuádriceps", "Máquina", "Glúteos", [
    "Espalda y cadera bien apoyadas, pies al ancho de hombros en la plataforma.",
    "Bajá hasta que las rodillas formen 90° o un poco más.",
    "Empujá sin bloquear las rodillas arriba.",
  ], "Si la cadera se despega abajo, acortá el recorrido."),
  E("sillon-cuadriceps", "Sillón de cuádriceps", "Cuádriceps", "Máquina", "", [
    "Rodilla alineada con el eje de la máquina.",
    "Extendé las piernas hasta arriba y apretá un segundo.",
    "Bajá lento.",
  ], "Buen ejercicio de cierre o de entrada en calor."),
  E("estocadas", "Estocadas caminando", "Cuádriceps", "Mancuernas", "Glúteos", [
    "Con mancuernas a los costados, da un paso largo adelante.",
    "Bajá hasta que la rodilla de atrás casi toque el piso.",
    "Empujá y avanzá con la otra pierna.",
  ], "Torso erguido y rodilla de adelante sobre el pie."),
  E("bulgara", "Sentadilla búlgara", "Cuádriceps", "Mancuernas", "Glúteos", [
    "Pie de atrás apoyado en un banco.",
    "Bajá en vertical flexionando la pierna de adelante.",
    "Subí empujando con el talón.",
  ], "Más inclinación del torso = más glúteo."),

  /* Isquiotibiales */
  E("peso-muerto-rumano", "Peso muerto rumano", "Isquiotibiales", "Barra", "Glúteos, lumbares", [
    "De pie con la barra, rodillas apenas flexionadas.",
    "Llevá la cadera atrás bajando la barra pegada a las piernas.",
    "Al sentir el estiramiento, volvé apretando glúteos.",
  ], "La espalda no se curva: el movimiento es de bisagra de cadera."),
  E("peso-muerto", "Peso muerto convencional", "Isquiotibiales", "Barra", "Espalda, glúteos", [
    "Barra sobre el medio del pie, agarre al ancho de hombros.",
    "Espalda neutra, pecho alto, tensá antes de levantar.",
    "Empujá el piso y extendé cadera y rodillas a la vez.",
  ], "Ejercicio técnico: pedile al profe que te mire las primeras series."),
  E("curl-femoral", "Curl femoral acostado", "Isquiotibiales", "Máquina", "Pantorrillas", [
    "Boca abajo con el rodillo sobre los tobillos.",
    "Flexioná las rodillas llevando los talones a los glúteos.",
    "Bajá lento.",
  ], "No levantes la cadera del banco."),

  /* Glúteos */
  E("hip-thrust", "Hip thrust", "Glúteos", "Barra", "Isquiotibiales", [
    "Espalda alta apoyada en el banco, barra sobre la cadera con protector.",
    "Empujá con los talones y elevá la cadera hasta alinear torso y muslos.",
    "Apretá arriba un segundo y bajá.",
  ], "Mentón al pecho y costillas abajo: así no arqueás la espalda."),
  E("patada-gluteo", "Patada de glúteo en polea", "Glúteos", "Polea", "", [
    "Tobillera en la polea baja, apoyate en la máquina.",
    "Llevá la pierna atrás con la rodilla casi extendida.",
    "Volvé sin apoyar.",
  ], "No muevas la espalda: solo trabaja la cadera."),
  E("abductores", "Abducción de cadera en máquina", "Glúteos", "Máquina", "", [
    "Sentado con la espalda apoyada.",
    "Abrí las piernas contra la resistencia.",
    "Volvé lento.",
  ], "Inclinarte un poco adelante enfoca más el glúteo medio."),
  E("puente-gluteo", "Puente de glúteos", "Glúteos", "Peso corporal", "Isquiotibiales", [
    "Acostado boca arriba, rodillas flexionadas.",
    "Elevá la cadera apretando glúteos.",
    "Bajá sin apoyar del todo.",
  ], "Sumá una banda en las rodillas para más intensidad."),

  /* Pantorrillas */
  E("gemelos-pie", "Elevación de talones de pie", "Pantorrillas", "Máquina", "", [
    "Puntas de los pies en el escalón, talones afuera.",
    "Subí lo más alto posible y pausá.",
    "Bajá hasta estirar.",
  ], "Lento y con pausa: rebotar no sirve."),
  E("gemelos-sentado", "Gemelos sentado", "Pantorrillas", "Máquina", "Sóleo", [
    "Rodillas bajo el apoyo, puntas en la plataforma.",
    "Elevá los talones y bajá estirando.",
  ], "Trabaja el sóleo, que da forma a la pantorrilla."),

  /* Abdomen */
  E("plancha", "Plancha", "Abdomen", "Peso corporal", "Hombros, glúteos", [
    "Antebrazos en el piso, codos bajo los hombros.",
    "Cuerpo en línea recta, apretá abdomen y glúteos.",
    "Sostené el tiempo indicado respirando.",
  ], "Si se cae la cadera, cortá la serie: la calidad importa."),
  E("crunch-polea", "Crunch en polea", "Abdomen", "Polea", "", [
    "De rodillas frente a la polea alta con soga.",
    "Enrollá el torso llevando los codos a los muslos.",
    "Volvé despacio.",
  ], "La cadera no se mueve: se dobla la columna."),
  E("elevacion-piernas", "Elevación de piernas colgado", "Abdomen", "Peso corporal", "Flexores de cadera", [
    "Colgate de la barra.",
    "Elevá las piernas hasta 90° sin balanceo.",
    "Bajá controlado.",
  ], "Empezá con rodillas flexionadas si cuesta."),
  E("rueda-abdominal", "Rueda abdominal", "Abdomen", "Peso corporal", "Dorsales", [
    "De rodillas, manos en la rueda.",
    "Rodá hacia adelante manteniendo la espalda recta.",
    "Volvé tirando con el abdomen.",
  ], "Avanzá solo hasta donde puedas sin arquear."),
  E("pallof", "Press Pallof", "Abdomen", "Polea", "Oblicuos", [
    "De costado a la polea, agarre al pecho.",
    "Extendé los brazos al frente sin rotar.",
    "Volvé y repetí.",
  ], "Antirrotación: clave para deportistas."),

  /* Potencia (pliometría y balísticos) */
  E("salto-cajon", "Salto al cajón", "Potencia", "Cajón", "Cuádriceps, glúteos", [
    "Parado frente al cajón, pies al ancho de cadera.",
    "Contramovimiento rápido con brazos y saltá aterrizando suave arriba.",
    "Bajá caminando, no saltando.",
  ], "Cada salto al máximo: calidad sobre cantidad."),
  E("salto-vertical", "Salto vertical (CMJ)", "Potencia", "Peso corporal", "Pantorrillas", [
    "Pies al ancho de cadera.",
    "Bajá rápido y saltá lo más alto posible.",
    "Aterrizá amortiguando con rodillas y cadera.",
  ], "Descansá entre saltos para que cada uno sea explosivo."),
  E("lanzamiento-balon", "Lanzamiento de balón medicinal al pecho", "Potencia", "Balón medicinal", "Pecho, tríceps", [
    "Frente a una pared, balón al pecho.",
    "Lanzá con fuerza extendiendo los brazos.",
    "Recibí y repetí.",
  ], "Ideal en contraste con press de banca."),
  E("slam-balon", "Slam con balón medicinal", "Potencia", "Balón medicinal", "Core, dorsales", [
    "Elevá el balón sobre la cabeza.",
    "Golpealo contra el piso con todo el cuerpo.",
    "Recogelo y repetí.",
  ], "Trabaja potencia y descarga mucha energía."),
  E("swing-kettlebell", "Swing con kettlebell", "Potencia", "Kettlebell", "Glúteos, isquiotibiales", [
    "Pesa entre las piernas, bisagra de cadera.",
    "Proyectá la cadera adelante para llevar la pesa a la altura del pecho.",
    "Dejala caer y volvé a cargar la cadera.",
  ], "La fuerza sale de la cadera, no de los brazos."),
  E("saltos-horizontales", "Salto horizontal a pies juntos", "Potencia", "Peso corporal", "Glúteos", [
    "Pies juntos, brazos atrás.",
    "Saltá lo más lejos posible.",
    "Aterrizá estable y frená.",
  ], "Sostené el aterrizaje 2 segundos."),
  E("dominada-explosiva", "Remo invertido explosivo", "Potencia", "Peso corporal", "Espalda", [
    "Colgado de una barra baja con el cuerpo recto.",
    "Tirá explosivo hacia la barra.",
    "Bajá controlado.",
  ], "Contraste ideal después del remo pesado."),

  /* Cardio */
  E("bici", "Bicicleta fija", "Cardio", "Bicicleta", "", [
    "Regulá el asiento a la altura de la cadera.",
    "Pedaleá al ritmo indicado.",
  ], "Para entrada en calor o vuelta a la calma."),
  E("cinta", "Cinta (caminata o trote)", "Cardio", "Máquina", "", [
    "Empezá caminando 2 minutos.",
    "Subí la velocidad o la inclinación según la indicación.",
  ], "Caminar con inclinación también suma mucho."),
  E("soga", "Salto con soga", "Cardio", "Soga", "Pantorrillas", [
    "Saltos cortos sobre la punta de los pies.",
    "Giro de muñeca, codos cerca del cuerpo.",
  ], "Excelente para coordinación y entrada en calor."),
  E("burpees", "Burpees", "Cardio", "Peso corporal", "Cuerpo completo", [
    "De pie, bajá a apoyar las manos.",
    "Llevá los pies atrás, flexión opcional, volvé y saltá.",
  ], "Mantené un ritmo que puedas sostener."),
];

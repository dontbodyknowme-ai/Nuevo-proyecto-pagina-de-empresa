# Especificación: Cerrar la verificación

## Contexto

Hay un control escrito, probado y guardado en el proyecto que **nadie corre**:
`herramientas/buscar-codigo-muerto.js`. En T6 encontró 25 símbolos sin
consumidor y sirvió para borrar unas 437 líneas. Desde entonces está en el
árbol de `AGENTS.md` y en ningún lado más: no está en la sección de
Verificación, y por lo tanto no se ejecuta.

La consecuencia es simple: **el código muerto puede volver sin que nada lo
note**. Es la misma razón por la que T5 arregló que el número de scripts no
pudiera mentir: un control que no se corre no controla nada.

En el camino de T6 apareció también una anotación que **ya no dice la verdad**.

### Defecto 1 — El control de código muerto no se puede correr como verificación

Hoy la herramienta sale con código **1**. Reporta cuatro cosas:

| Símbolo | Qué es en realidad |
|---------|--------------------|
| `registrarConsentimiento` | RF-12 sin conectar |
| `tieneConsentimiento` | RF-12 sin conectar |
| `revocarConsentimiento` | RF-12 sin conectar |
| `existeFecha` | Regla de fechas correcta, conservada a propósito |

Ninguna es un olvido. Las cuatro son **decisiones**, no descuidos: tres
dependen de un requisito que está en alcance y todavía no se conectó, y la
cuarta se conservó porque borrarla costaría 18 tests para eliminar una función
que el calendario podría necesitar mañana.

El problema no es que estén ahí. El problema es que la herramienta **no
distingue entre lo que hay que arreglar y lo que se decidió dejar**. Reporta
todo con el mismo tono: cuatro cosas que borrar, urgente.

Y el efecto sobre el paso de verificación es el que importa: un control que
siempre sale en rojo **es un control que no sirve**. La primera vez que dé rojo
de verdad, que es cuando importa, nadie lo va a mirar. Un paso de verificación
que se sabe que falla solo es ruido.

### Defecto 2 — La lista de días de la semana no dice la cantidad correcta

La deuda conocida dice, textualmente, que *"la lista de días de la semana
existe tres veces"*, y nombra `app.js`, `mapa-calor.js` y `fechas.js`.

Eso era cierto antes de T6. T6 borró `DIAS_EN_LA_SEMANA` de
`js/logica/fechas.js` por no tener consumidor. Hoy la lista vive en **dos**
lugares, y ambos son copias idénticas de la misma línea:

- `js/app.js:1534` - la usa al pintar el calendario
- `js/logica/mapa-calor.js:130` — la usa el mapa de calor

La anotación aparece en dos archivos: `AGENTS.md` y
`specs/004-app-funcional-y-limpeza/task.md`.

Un documento que miente en la cantidad hace creer que hay más trabajo del que
hay, o peor: hace que alguien busque un tercer lugar donde ya no está.

## Objetivos

1. Que el control de código muerto se pueda correr como paso de verificación.
2. Que las excepciones conocidas estén escritas al lado de la herramienta, con
   su razón.
3. Que la lista no se pudre: si una excepción deja de estar justificada, que
   avise.
4. Que la anotación de la deuda diga la verdad.

## Fuera de alcance

- **Unificar las dos listas de días que quedan.** Eso toca `js/app.js` y un
  dibujo que hoy anda. Es una tarea que mueve código entre archivos, con la
  fuente de línea base para demostrar que no cambió nada. Spec aparte.
- **Conectar RF-12.** Es trabajo sin empezar, no limpieza. Ya se decidió que el
  módulo se conserva.
- **Borrar `existeFecha`.** Decisión ya tomada: se conserva a propósito.
- **Las tres decisiones de comportamiento que dejó 004**: si el mapa muestra la
  sesión de Pomodoro en curso, si el umbral bloquea o avisa, y cuándo se conecta
  RF-12.

## Requisitos funcionales

### RF-1 — El control distingue lo que hay que arreglar de lo que se decidió dejar

La herramienta tiene que separar en su informe los símbolos sin consumidor que
son **decisiones tomadas** de los que son **pendientes reales**. Solo estos
últimos cuentan para el código de salida.

| Lo que queda | Código de salida |
|--------------|------------------|
| Solo excepciones conocidas | **0** |
| Excepciones conocidas y al menos un pendiente | **1** |

### RF-2 — Cada excepción dice por qué se queda

Cada símbolo de la lista de excepciones va con su razón escrita, **en el
archivo de la herramienta** y no en un documento que se puede no leer.

Una excepción sin razón es un código muerto con una nota al margen: dentro de
seis meses nadie recuerda por qué se dejó, y la razón correcta es la que hace
falta.

### RF-3 — La lista de excepciones avisa cuando sobra

Si un símbolo de la lista **deja de estar muerto** —porque alguien lo conectó—
la herramienta tiene que decir que esa excepción ya no está justificada.

Una lista de excepciones que se pudre en silencio es peor que no tener lista:
silencia la señal justo cuando deja de servir. Si se conectó RF-12 y nadie saca
`tieneConsentimiento` de la lista, el próximo control pasa sin mirar y la
excepción vieja sigue ahí.

### RF-4 — La anotación de la lista de días dice la verdad

La deuda conocida dice **dos** lugares, no tres, y nombra los dos archivos.

## Requisitos no funcionales

| | |
|---|---|
| **RNF-1** | No cambia el comportamiento de la aplicación. `js/`, `css/` e `index.html` no se tocan |
| **RNF-2** | La suite no baja de 328 tests. Esta tarea no agrega ni quita ninguno: no cambia código de la app |
| **RNF-3** | Las excepciones se declaran en una sola fuente. No en el archivo y también en un documento |
| **RNF-4** | La herramienta sigue siendo pura: lee archivos y escribe en la salida. No modifica nada |

## Casos límite

### Una excepción que ya no aplica

`registrarConsentimiento` deja de estar muerto el día que RF-12 se conecte. Ese
día la lista tiene una excepción vieja, y el control tiene que decirlo. Si no,
la lista se va llenando de cosas justificadas y deja de significar nada.

### Un símbolo que aparece tachado en la salida

Un símbolo puede estar en la lista de excepciones y **no** aparecer en el
informe, porque ya no está muerto. Eso es el caso anterior visto desde el otro
lado: no es un error de la herramienta, es información.

### Alguien mete un símbolo equivocado en las excepciones

El riesgo real: tapar código muerto de verdad para que el control dé verde.
Por eso la lista se arma con lo que **la herramienta reportó**, no de memoria,
y por eso el motivo de cada entrada tiene que quedar escrito.

### El control y la suite, juntos

`node --test` corre todo lo que hay en `test/`, y `herramientas/` está fuera a
propósito. Si esta herramienta se agregara a `test/`, cada corrida de la suite
abriría el proyecto entero. No se agrega.

## Decisiones ya tomadas

| Decisión | Respuesta |
|----------|-----------|
| ¿Dónde viven las excepciones? | En la herramienta, no en `AGENTS.md`. Ver DD-1 |
| ¿Se reorganizan los pasos de verificación? | No. Se agrega uno. Ver DD-3 |
| ¿Se toca `app.js` para unificar la lista de días? | No. Fuera de alcance |

## Criterios de finalización

- [ ] `node herramientas/buscar-codigo-muerto.js` da salida **0**
- [ ] Al inyectar un símbolo muerto nuevo, da salida **1** y lo nombra
- [ ] Al quitar una excepción de la lista, avisa que sobra
- [ ] Las cuatro excepciones están escritas con su motivo
- [ ] `AGENTS.md` lista el control como paso de verificación
- [ ] La deuda de la lista de días dice "dos" en los dos archivos
- [ ] La suite sigue en 328 y `js/` no se tocó
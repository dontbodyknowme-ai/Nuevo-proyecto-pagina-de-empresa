# Resolución de casos pendientes: Mapa de calor

**ID:** 001-heat-map
**Especificación relacionada:** [`spec.md`](spec.md) v2.1
**Constitución:** [`../../docs/constitucion.md`](../../docs/constitucion.md)
**Estado:** Preparada — para implementar más adelante
**Versión:** 1.0

---

## Propósito

La especificación del mapa de calor dejó **tres casos límite sin resolver** (CP-1, CP-2 y CP-3) a pedido explícito del usuario, para tratarlos en un momento posterior.

Este documento existe para que esas decisiones **no se pierdan**. Cuando quieras retomarlas, no hay que improvisar: acá están las opciones, con su justificación y lo que se necesita saber para elegir.

Ninguno de estos tres casos **bloquea** la implementación de la funcionalidad principal. El mapa se puede construir y usar sin resolverlos.

---

## CP-1 — El día en curso es indistinguible de un día sin estudio

### Situación

Un día en el que estás estudiando ahora mismo tiene minutos acumulados, pero si todavía no llegaste al minuto entero, muestra el mismo aspecto que un día en el que no estudiaste.

Peor: si ya acumulaste 30 minutos, el mapa muestra nivel 2, igual que un día anterior donde estudiaste 25 minutos y terminaste. No hay forma de saber si esa casilla todavía está creciendo.

### Por qué está pendiente

La decisión es de diseño visual, no técnica. El usuario decidió que **no se modificara** esta sección en la primera entrega.

### Opciones

| Opción | Qué se ve | A favor | En contra |
|--------|-----------|---------|-----------|
| **A. Nada especial** (actual) | El día en curso se ve como cualquier otro | Simple, cero trabajo | Puede confundir |
| **B. BordeDel día** | Un borde fino alrededor de la casilla de hoy | Se sabe dónde estás parado | El borde puede confundirse con el marcador de nivel |
| **C. Punto pulsante** | Un pulso suave en la casilla de hoy | Se siente vivo | Puede distraer, y el mapa es de consulta rápida |
| **D. Etiqueta "hoy"** | La casilla muestra un texto corto | inequívoco | Rompe el patrón visual de la grilla |

### Qué necesito saber

- ¿Querés que se destaque, o preferís que no?
- Si se destaca, ¿te parece un borde discreto o algo más visible?
- ¿El día en curso debería contar hacia el total del día aunque todavía no haya pasado un minuto completo? *(hoy no cuenta)*

### Impacto si se resuelve

| Si se elige | Cambio |
|------------|--------|
| A | Ninguno. Queda como está |
| B, C o D | Un estilo más en `css/styles.css` y una clase más en la grilla |
| Cualquiera sobre el conteo | Cambia `consolidar()` y su test |

---

## CP-2 — Manipulación del reloj del sistema

### Situación

Los minutos se calculan restando dos Instantes de tiempo. Si alguien adelanta el reloj de la computadora mientras estudia, el sistema registra minutos que nunca pasaron. Si lo atrasa, pierde minutos reales.

No es un problema raro: cambiar la fecha de la máquina es un gesto común cuando se quiere "activar" algo que expiró.

### Por qué está pendiente

El usuario decidió que **no se modificara** esta sección en la primera entrega.

### Opciones

| Opción | Qué hace | A favor | En contra |
|--------|----------|---------|-----------|
| **A. Nada** (actual) | Cuenta la diferencia tal cual | Simple | Acepta el fraude del reloj |
| **B. Tope por sección** | Ninguna sección puede superar su duración máxima esperada | Evita minutos infinitos de un salto | Un reloj atrasado sigue perdiendo minutos reales |
| **C. Validar contra el temporizador** | Compara con el tiempo del Pomodoro | Doble fuente de verdad | El Pomodoro también usa el reloj del sistema |
| **D. Marca de confianza** | Guarda la última marca conocida y detecta saltos | El más completo | Más complejo de lo que parece |

### Qué necesito saber

- ¿Te preocupa que alguien falsee los minutos a propósito?
- ¿O solo querés que un salto de reloj no Rompa los números?
- ¿Aceptás que un reloj atrasado pierda tiempo, siempre que no invente tiempo?

### Nota importante

Ninguna opción evita el problema **al 100 %**. El reloj del sistema es la única fuente de tiempo real que tiene el navegador, y las opciones C y D solo lo detectan, no lo corrigen.

La solución de verdad sería un contador que no dependa del reloj (por ejemplo, acumular con un temporizador de intervalo). Eso tiene su propio problema: si la pestaña se suspende, el conteo se pausa.

### Impacto si se resuelve

| Si se elige | Cambio |
|------------|--------|
| A | Ninguno |
| B | Una validación en `cerrarSeccion()` y un test nuevo |
| C o D | Cambia la estructura del registro de secciones |

---

## CP-3 — Comportamiento en los bordes de los umbrales

### Situación

Los niveles están definidos así:

| Nivel | Minutos |
|-------|---------|
| 1 | 1 – 24 |
| 2 | 25 – 49 |
| 3 | 50 – 74 |
| 4 | 75 – 99 |
| 5 | 100 o más |

La spec habla de "quebrillo" porque un día de **24 minutos** queda en nivel 1, y **un minuto más** lo lleva al nivel 2. El salto visual entre "casi un Pomodoro" y "un Pomodoro completo" es correcto conceptualmente, pero visualmente puede parecer brusco: dos días casi iguales se ven muy distintos.

### Por qué está pendiente

El usuario decidió que **no se modificara** esta sección en la primera entrega.

### Opciones

| Opción | Qué cambia | A favor | En contra |
|--------|-----------|---------|-----------|
| **A. Mantener** (actual) | Los umbrales quedan en 25, 50, 75, 100 | Simples, alineados al Pomodoro | El salto es brusco |
| **B. Subir el primer umbral** | El nivel 1 empieza en 10 minutos en vez de 1 | Menos falso positivo con 3 minutos | Un día de 5 min queda igual que uno de 0 |
| **C. Más niveles** | Agregar un nivel intermedio | Transitions más suaves | Más colores que designing, más complejo |
| **D. Escala logarítmica** | El nivel crece más despacio al principio | El esfuerzo pequeño también se ve | Menos intuitivo de explicar |

### Qué necesito saber

- ¿Te parece brusco el salto de nivel 1 a nivel 2?
- ¿Preferís que 5 minutos ya se vean como "algo estudié", o que no se exagere?
- ¿Aceptás que haya 5 niveles fijos, o preferís más?

### Impacto si se resuelve

| Si se elige | Cambio |
|------------|--------|
| A | Ninguno |
| B | Una constante en `nivelDe()` y su test |
| C o D | Cambia la paleta, los estilos y varios tests |

---

## Orden sugerido de resolución

Cuando quieras retomarlos, este es el orden más cómodo:

| Paso | Caso | Por qué en ese orden |
|------|------|---------------------|
| 1 | **CP-1** | Es el más visible en el uso diario y el más barato de cambiar |
| 2 | **CP-3** | Depende de los umbrales, que también usa RF-4 |
| 3 | **CP-2** | El más complejo, y el menos probable en el uso real |

Los tres son **independientes entre sí**. Resolver uno no obliga a tocar los otros.

---

## Cómo se cierra un caso

Cuando decidas cada uno:

1. Anotá la decisión acá, en la tabla de su sección, con la fecha.
2. Actualizá la sección *Casos límite pendientes* de [`spec.md`](spec.md), moviendo el caso a *Casos límite* con su comportamiento esperado.
3. Agregá el criterio de aceptación nuevo al requisito afectado.
4. Si el cambio afecta la lógica, agregá el test correspondiente.
5. Verificá que la constitución siga cumpliéndose (Principio 4: si es lógica, se prueba con Node).

---

## Registro de decisiones

| Fecha | Caso | Decisión | Motivo |
|-------|------|----------|--------|
| 2026-10-02 | **CP-1** | **A — Nada especial.** El día en curso se ve como cualquier otro, y **la sección abierta no cuenta hacia el mapa** hasta que se cierra | Ver abajo |
| — | CP-2 | Pendiente | — |
| — | CP-3 | Pendiente | — |

### Resolución de CP-1 — 2026-10-02

**Se elige la opción A**, y se resuelve **también la parte del conteo**, que
venía abierta aparte: *"¿El día en curso debería contar hacia el total del día
aunque todavía no haya pasado un minuto completo?"*.

**Respuesta: no cuenta.** Una sesión de Pomodoro aparece en el mapa recién
cuando termina, porque es cuando se sella la sección y se persisten sus
minutos.

**Por qué.**

El mapa es de consulta rápida: se mira para ver cómo viene la semana, no para
mirar un reloj. Si la casilla del día **cambia mientras la mirás** —crece con
cada minuto de Pomodoro y después se ajusta al cerrar— el número deja de ser un
dato y pasa a ser una animación. Un mapa que se recalcula bajo los ojos obliga
a volver a leerlo.

La contra es real y conviene tenerla escrita: durante los 25 minutos de una
sesión **el mapa no refleja nada**, y si el usuario cierra la pestaña a mitad
de sesión, esos minutos aparecen recién en la recarga siguiente. Se acepta: es
un costo de 25 minutos a cambio de un mapa estable.

**Qué no cambia.** La sección abierta **sí se sigue registrando y sellando**,
por RF-13: si el navegador se cierra con el Pomodoro corriendo, el tiempo
seguido no se pierde. Lo que se decidió es que **el mapa no la mira hasta que
está cerrada**, no que no se cuente.

**Dónde vive la decisión en el código.** `minutosDeEstudioPorDia()`, en
`js/app.js`, ya le pasa `seccionAbierta` a `minutosTotales()`. `minutosTotales()`
recorre solo `estado.secciones`, así que la ignora. **La decisión está tomada;
lo que falta es que quede escrita junto al código**, porque hoy se lee como un
accidente y no como una elección.

Esa es la razón por la que se abrió esta decisión en 005 y no antes: T6 borró
`consolidar()`, que era la única función que miraba la sección abierta, y con
ella se fue el rastro de por qué el comportamiento cambió.
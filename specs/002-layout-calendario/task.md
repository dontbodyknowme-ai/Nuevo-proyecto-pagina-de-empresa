# Tareas: Estructura y adaptabilidad del modal del calendario

**ID:** 002-layout-calendario
**Especificación:** [`spec.md`](spec.md) v1.0
**Plan:** [`plan.md`](plan.md) v1.0
**Constitución:** [`../../docs/constitucion.md`](../../docs/constitucion.md)
**Estado:** Completada
**Versión:** 2.0

---

## Cómo se usa este archivo

Cada tarea es un paso de la sección 4 del plan.

**Reglas para cada tarea:**

1. Los tests se escriben **primero**, luego el código.
2. Se verifica con `node --test` (Principio 4, camino 1) **y** mirando en Chrome
   (Principio 4, camino 2). Con una de las dos no se da por terminada.
3. Al terminar, se marca la tarea con su estado, los RF que cubre y la fecha.
4. **No se empieza la tarea siguiente sin que la anterior esté verificada.**
5. Si una tarea revela un defecto que no estaba en el plan, se anota en su tabla
   de hallazgos antes de seguir.

> Hoy el proyecto tiene **101 tests** en verde. Ese es el piso: ninguna tarea puede
> dejarlo abajo.

---

## T1 — Función pura de visibilidad del chrome

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-5, RNF-3, RNF-4
**Archivos que crea:** `js/logica/layout.js`, `test/layout.test.js`
**Verificación:** 17 tests nuevos, suite completa en 118

### Qué hace

Una función que, dada la vista activa, devuelve qué elementos del chrome se
muestran. Sin DOM, sin leer el ancho, sin leer el reloj.

```javascript
elementosVisibles('mapa')
// → { navMes: false, leyendaAnotaciones: false, panelAnotaciones: false,
//     botonAlternar: true, botonCerrar: true }

elementosVisibles('calendario')
// → { navMes: true, leyendaAnotaciones: true, panelAnotaciones: true,
//     botonAlternar: true, botonCerrar: true }
```

### Un hallazgo que bloqueó la tarea

Antes de escribir los tests se midió en Chrome dónde vive el botón de cerrar:

```
BUTTON#btnCerrarCalendario → DIV.panel-header → DIV.calendario-panel → DIV.calendario-body
```

`.calendario-panel` tiene `display: none` en la vista mapa. El botón quedaba con
**ancho 0**: invisible e inclicable. Como `RF-5` exige que el botón de cerrar se
muestre en **ambas** vistas, y ninguna lógica puede hacer visible un botón cuyo
padre está oculto, la especificación era insatisfacible tal como estaba.

**Decisión del usuario:** mover el botón de cerrar al encabezado del modal, que
siempre está visible. Por eso `botonCerrar` da `true` en las dos vistas.

> El movimiento en sí es parte de **T2**, que modifica `index.html`.

### Casos probados

| Caso | Resultado |
|------|-----------|
| Vista `'mapa'` | No muestra nav de mes, ni leyenda, ni panel de anotaciones |
| Vista `'calendario'` | Muestra los tres |
| Las dos vistas | Muestran siempre el botón de alternar y el de cerrar |
| Vista desconocida, vacía, nula o de otro tipo | No rompe; muestra todo, para no esconder el cierre |
| Misma vista dos veces | Devuelve lo mismo |
| Se modifica el objeto devuelto | No afecta la llamada siguiente |
| Todas las claves | Son exactamente cinco, y todas booleanas |

---

## T2 — El contenedor que falta

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-1, RF-2
**Archivos que modifica:** `index.html`
**Verificación:** mediciones en Chrome en cuatro anchos

### Qué se hizo

1. Agregar `<div class="calendario-container">` envolviendo los tres bloques del
   modal. **Markup puro: ni una clase nueva.**
2. Mover `#btnCerrarCalendario` del panel de anotaciones al encabezado, que
   siempre está visible. Sin esto el botón quedaba con ancho 0 en la vista mapa.

### Resultado en Chrome

| Ancho | Antes | Después |
|-------|-------|---------|
| 1920 | Panel inexistente, contenido suelto en fila | Panel 900 px, columna, fondo y borde |
| 1280 | Leyenda fuera de la ventana | Panel 900 px, celdas de 70 px, leyenda dentro |
| 768 | `rejilla(256>64)` y `panel(181>69)` recortados | **Ningún recorte.** Rejilla 369 + panel 320, celdas de 50 px |
| 375 | `rejilla(138>0)`, todo fuera de pantalla | Panel 356 px, pero el panel **todavía** se superpone a la rejilla |

Estilos del panel ahora sí aplicados, porque por fin hay elemento:

```
fondo=rgb(26, 26, 26)   radio=14px   borde=1px   flex-direction=column
```

El bloque `/* Responsive Calendario (iPhone) */` que ya existía en la hoja de
estilos **también empezó a funcionar**: antes apuntaba a un contenedor inexistente.

### Lo que queda para las siguientes tareas

- **375 px** sigue roto: el panel y la rejilla compiten en fila. Es **T5**.
- La navegación de mes y la leyenda siguen visibles en la vista mapa. Es **T4**.
- El botón de alternar se ve descolocado en 375 px. Lo resuelve **T5**.

---

## T3 — Ajustes de estilos del panel

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-1, RF-2, RF-3
**Archivos que modifica:** `css/styles.css`
**Verificación:** Chrome con `chrome-devtools`, consola con 0 errores

### Qué se hizo

| Ajuste | Motivo |
|--------|--------|
| DD-4: `width: min(94vw, 1320px)` | El valor anterior, 900 px fijos, desperdicia las pantallas grandes |
| Fusionar las **dos** definiciones de `.calendario-grid` | Competían por el mismo selector sin que nadie lo supiera |
| **Conservar** el bloque de la animación `scaleIn` | No es código muerto: estaba inerte por la misma causa que el resto |

### Resultado medido

| | Antes | Después |
|-------|-------|---------|
| Ancho del panel | 900 px | **1290 px** |
| Ancho de la rejilla | 579 px | **968 px** |
| Celda del día | 70 px | **126 px** |
| Definiciones de `.calendario-grid` | 2 | **1** |

### La rejilla duplicada, en detalle

`.calendario-grid` estaba definida dos veces en la misma hoja:

| Definición | Aportaba |
|------------|----------|
| La primera | `flex: 1`, `padding`, `overflow-y: auto`, `align-content` |
| La segunda | `gap: 4px`, `margin-bottom` |

La segunda ganaba por orden de cascada, así que el `gap: 6px` de la primera
nunca se aplicó. Pero su `flex`, su `padding` y su `overflow` **nunca se
perdieron**: los aplicaba la segunda, que no los declara. Funcionaba por
casualidad, no por diseño. Ahora hay una sola definición con todo junto.

### Un falso alarma que casi rompemos algo

La primera captura parecía mostrar las columnas de la rejilla desalineadas, y
reporté un desfase de 389 px. **Era una medición mal hecha.**

Había comparado la columna `Lu` contra la **primera celda no vacía** del mes. El
1 de octubre de 2026 cae en jueves, así que las tres primeras celdas están
vacías y la primera con contenido está en `Ju`. Eran dos columnas distintas.

Medición correcta:

```
xCabeceras:        74, 204, 333, 463, 593, 723, 852
xCeldas fila 1:   74, 204, 333, 463, 593, 723, 852
desfasajes:        0,   0,   0,   0,   0,   0,   0
```

**Las columnas estaban bien alineadas.** Si se hubiera aplicado el arreglo
propuesto, se habría roto el calendario.

> **La trampa:** en una rejilla de calendario hay celdas vacías al principio del
> mes. Comparar posiciones sin tener eso en cuenta da un desfase falso.

### Una regla que me inventé

El plan anunciaba borrar *"la regla muerta `max-height: 900px`"*. **Esa regla
no existe.** No se borró nada porque no había nada que borrar. El grep previo
debería haberse repetido antes de anunciarlo.

---

## T4 — Conectar la visibilidad con la alternancia

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-5, RF-6
**Archivos que crea:** `js/interfaz/visibilidad.js`, `test/visibilidad-calendario.test.js`
**Archivos que modifica:** `js/inicio-calendario.js`, `index.html`, `test/navegador.test.js`, `css/styles.css`
**Verificación:** 11 tests nuevos, suite en 129, y Chrome con 5 alternancias

### Qué se hizo

Un módulo de interfaz, `js/interfaz/visibilidad.js`, que aplica la decisión de la
función pura. `js/inicio-calendario.js` lo consulta al cambiar de vista y también
al arrancar.

Oculta con el atributo `hidden`, **no** pisando `display`, para que la hoja de
estilos siga teniendo el control de la presentación.

### El bug que encontró la verificación en Chrome

Los tests de Node pasaban, pero **la página no cambiaba nada**:

```
navHiddenAttr: true      ← el atributo se aplicaba
navDisplay:    flex      ← pero el CSS lo mostraba igual
navVisible:    true      ← seguía en pantalla
```

`.calendario-nav` tiene `display: flex`, y eso le gana al atributo `hidden` del
navegador. El atributo se ponía y a los 50 ms no pasaba nada.

Ningún test de Node lo detectó, porque el DOM falso de los tests no aplica CSS.
Es exactamente el motivo por el que el Principio 4 tiene dos caminos.

La corrección, con el porqué anotado en la hoja de estilos:

```css
[hidden] { display: none !important; }
```

### Dos errores míos en esta tarea

**Escribí un test que no probaba nada.** Definí `aplicarVisibilidad` dentro del
propio archivo de test, así que se probaba a sí mismo: 7 tests en verde sobre
código muerto. Se detectó porque dio sospechoso que pasara todo a la primera, y
se corrigió moviendo la función a un módulo real.

**Olvidé un script.** Se agregó `visibilidad.js` al HTML pero no `layout.js`, que
va antes. Los tests lo detectaron solos:

```
js/inicio-calendario.js: Cannot read properties of undefined (reading 'elementosVisibles')
```

Es el mismo error que casi deja el mapa en blanco, y lo atrapó el guardián de
carga del navegador.

### Resultado medido en Chrome

Cinco alternancias seguidas:

```
mapa:        nav ✗  leyenda ✗  panel ✗  cerrar ✓  botón "📅 Calendario"
calendario:  nav ✓  leyenda ✓  panel ✓  cerrar ✓  botón "🔥 Mapa"
```

Consola con 0 errores.

---

## T5 — Reglas de adaptación del calendario

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-2, RF-3, RF-4, RF-9, RNF-1, RNF-2
**Archivos que modifica:** `css/styles.css`
**Archivos que crea:** `test/responsive-calendario.test.js`
**Verificación:** 12 tests nuevos, suite completa en 141, Chrome en cuatro anchos

### Qué se hizo

Dos bloques `@media` nuevos, que **no existían**:

| Condición | Qué resuelve |
|-----------|--------------|
| `max-width: 900px` | Apila el panel de anotaciones debajo de la rejilla |
| `max-width: 600px` | Menos espaciado y tipografía más chica |

El segundo **ya existía** con otras reglas. SePASO a ampliarlo en lugar de
duplicarlo, y se le agregó el ajuste del encabezado, que antes no se contemplaba.

### El desplazamiento en un solo lugar

Las reglas apiladas hacen tres cosas:

1. El desplazamiento vertical pasa a `.calendario-body`.
2. La rejilla y el panel pasan a `overflow-y: visible`: dejan de desplazarse por su cuenta.
3. El panel pasa a `width: 100%`: deja de competir con la rejilla por el ancho.

Medido:

```
768 px  →  zonasConScroll: ["cuerpo"]
1024 px →  zonasConScroll: ["rejilla"]
```

Una zona, no dos.

### Resultado medido

| Ancho | Distribución | Panel | Recortes | Fuera de ventana | Scroll horizontal |
|-------|--------------|-------|----------|------------------|-------------------|
| 1280 | dos columnas | al costado | ninguno | ninguno | no |
| 1024 | dos columnas | al costado | ninguno | ninguno | no |
| 768 | una columna | debajo | ninguno | ninguno | no |
| **375** | **una columna** | debajo | ninguno | ninguno | no |

A 375 px: rejilla de 369 px, celdas de 46 px, panel debajo.

### Un defecto que apareció al verificar

La captura del móvil mostró que **el widget del Pomodoro tapaba los controles
del calendario**:

```
pomodoro encima del header:        213x40 px
pomodoro encima del nav:           114x28 px
```

Causa: el widget y el modal compiten por el mismo `z-index: 1000`, y el widget se
dibuja después, así que gana.

**Arreglado solo con CSS**, sin tocar JavaScript: el modal aparece antes que el
widget en el HTML, así que alcanza el selector de hermano general.

```css
.modal-calendario.visible ~ .pomodoro-widget { display: none; }
```

Verificado: con el modal abierto el widget no se ve, y al cerrarlo vuelve a
`display: flex` con sus 212 px. En escritorio, sin modal, se comporta siempre
como antes.

> Este defecto ya existía antes de T5. Lo hizo visible el borde redondeado del
> panel, que T2 agregó.

### Un test mío que era demasiado amplio

El primer test de RNF-4 prohíbe `clientWidth` en **todo** el JavaScript. Falló
contra `app.js` porque el visor de PDF mide el ancho del contenedor: renderiza a
un canvas y necesita saber cuánto espacio hay. Eso es inevitable y no es
geometría de calendario.

Se acotó a los cinco archivos que son del calendario.

### El límite de probar interfaz con Node

Estos tests **no pueden** comprobar que el navegador aplique las reglas: un
archivo de Node no sabe de anchos de pantalla ni de cascada. Verifican que la
hoja de estilos *contenga* lo correcto.

El comportamiento real se midió en Chrome. No es opcional: en T4 el atributo
`hidden` se aplicaba pero no ocultaba nada, porque `display: flex` le ganaba, y
ningún test de Node lo detectó.



---

## T6 — El medidor pasa a ser parte del proyecto

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-2, RF-3, RF-4, RF-9, RNF-1, RNF-2
**Archivos que crea:** `herramientas/verificar-layout.js`
**Verificación:** 8 mediciones en verde, salida 0; y detecta roturas, salida 1

### Dónde quedó y por qué no está en `test/`

El plan original decía `test/verificar-layout.js`, y decía que *"no es un
`*.test.js`, así que el runner no lo ejecuta"*. **Esa afirmación era falsa.**

Se comprobó con una sonda: un `.js` cualquiera dentro de un directorio llamado
`test` **sí se ejecuta** en `node --test`, y cuenta como un test. Si el
verificador hubiera quedado ahí, cada vez que se corriera la suite se abriría
un Chrome.

Por eso vive en `herramientas/`, fuera del alcance del runner.

### Qué hace

Abre Chrome, recorre cuatro anchos y las dos vistas, y reporta:

| Qué mide | Por qué |
|----------|---------|
| Elementos que recortan su contenido | Es el síntoma de la falta de ancho |
| Elementos fuera de la ventana, por los cuatro lados | Es el síntoma del desbordes |
| Si hay scroll horizontal en la página | RNF-1 |
| Si la rejilla y el panel se superponen | Solo en una columna sería un defecto |
| Cuántas zonas se desplazan en vertical | Tiene que ser una sola |

Usa `fetch` y `WebSocket`, que ya trae Node. **Sin dependencias.** El perfil de
Chrome es temporal y se borra al terminar.

Sale con código **0** si todo está bien y **1** si hay algo que arreglar, así
sirve como paso de verificación.

### Un falso positivo que el propio script tenía

La primera versión reportaba como defecto que el panel de anotaciones quedara
*"por debajo de la ventana"* en 768 y 375 px. No era un defecto: en una columna
con scroll vertical, que algo quede bajo el pliegue es normal y alcanzable.

Ahora distingue los dos casos: solo lo reporta si **ningún ancestro se puede
desplazar**, o sea si el usuario no tiene forma de llegar.

### Verificación de que el verificador sirve

Un script que siempre dice "todo bien" no verifica nada. Se rompió el layout a
propósito, sacando el `@media (max-width: 900px)`:

```
FALLA móvil 375 px  calendario
     ! la rejilla del mes recorta su contenido (178 de 53)
  1 problema(s)   ·   salida 1
```

Detecta la rotura y devuelve código de error. Con el CSS restaurado: 8
mediciones en verde y salida 0.

---

## T7 — Verificación final y documentación

**Estado:** Completada — 2026-10-01
**RF que cubre:** todos
**Archivos que modifica:** `AGENTS.md`, `MEMORY.md`, `specs/001-heat-map/task.md`
**Verificación:** los dos caminos del Principio 4 completos

### Checklist

- [x] `node --test` — **141 tests, 0 fallan** (arrancó en 101)
- [x] El desplazamiento vertical está en **un solo lugar** en modo angosto
- [x] `node --check` en los 11 `.js` del proyecto — 0 fallos de sintaxis
- [x] `node --test test/navegador.test.js` — 5 tests, 0 fallan
- [x] `node herramientas/verificar-layout.js` — 8 mediciones, salida 0
- [x] Consola de Chrome con **0 errores** tras recargar
- [x] Capturas de las dos vistas, en escritorio y en móvil
- [x] El mapa conserva 28 celdas, 6 niveles y el hover con minutos
- [x] El resaltado de días con estudio sigue funcionando
- [x] Agregar y ver anotaciones sigue funcionando, **también a 375 px**
- [x] El Pomodoro sigue intacto
- [x] Sin `package.json` ni `node_modules`
- [x] Todos los archivos de texto en UTF-8 **sin BOM**
- [x] `AGENTS.md` registra los archivos nuevos y el comando de verificación
- [x] `MEMORY.md` dice que el calendario es adaptable, con los anchos verificados
- [x] La afirmación *"responsive tipo iPhone"* es cierta

### Verificación funcional en Chrome

| Requisito | Qué se comprobó | Resultado |
|-----------|------------------|-----------|
| RF-5 | Nav y leyenda ocultas en mapa, visibles en calendario | ✓ |
| RF-5 | Botón de cerrar visible en las dos vistas | ✓ |
| RF-6 | El hover muestra fecha y minutos | ✓ `04/09/2026 — 20 minutos — nivel bajo` |
| RF-7 | Mapa: 28 celdas, 6 niveles, 6 muestras de leyenda | ✓ |
| RF-8 | Anotaciones: agregar, marcar celda, punto, contador `1/3` | ✓ |
| RF-8 | Anotaciones en 375 px | ✓ |
| — | Días con estudio resaltados | ✓ 24 de 24 en septiembre |
| — | Pomodoro | ✓ |

### Un detalle de encoding

`specs/001-heat-map/task.md` tenía BOM. Venía de un `Set-Content` de una sesión
anterior. Se quitó sin tocar el contenido.

`docs/constitucion.md` sí tiene un carácter roto, y **no se tocó a propósito**:
es el ejemplo `Anatom??a` que el propio documento usa para explicar qué pasa
cuando se rompe el UTF-8.

### El hueco que queda documentado

En `test/`, `node --test` ejecuta **cualquier** `.js`, aunque no sea
`*.test.js`. Los archivos que abren un navegador viven en `herramientas/`.

Y los tests de Node no detectan conflictos entre atributo y hoja de estilos: en
T4 el atributo `hidden` se aplicaba, los tests pasaban, y el elemento seguía en
pantalla. Ese error solo apareció al abrir Chrome.

### Si se abandona el trabajo

Si las tareas quedan a medias, hay que corregir la documentación antes de dejar de
trabajar: el calendario **no** es adaptable y `AGENTS.md` no puede seguir
afirmándolo.

---

## Hallazgos que las tareas pueden revelar

Esta tabla se completa a medida que aparezcan defectos no previstos.

| Tarea | Hallazgo | Qué se hizo |
|-------|----------|-------------|
| — | — | — |

---

## Deuda que esta especificación NO resuelve

Queda anotado para que no se pierda, y no se toca aquí.

| Deuda | Detalle |
|-------|---------|
| `js/datos.js` | 317 líneas de código muerto, nunca cargado |
| `app.js` monolítico | Más de 1300 líneas que mezclan lógica y dibujo |
| Tope del almacenamiento | La protección existe, pero el aviso no es una barra de progreso visible |
| Dos reglas que pisan en el mapa | La rejilla del mapa tiene la misma clave que una anterior en la hoja de estilos |
| Muestras de la leyenda sin clase propia | Comparten clase con las celdas reales del mapa, y un selector cuenta 34 en vez de 28. Ahora está declarado fuera de alcance en la spec |
# Tareas: Reducir `app.js` sin cambiar lo que se ve

**ID:** 006-reducir-app-js
**Estado:** Completada — T1 a T4, el 2026-10-02
**Especificación:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)

## Por qué el orden es este

**T1 va primero porque es lo contrario de lo natural.** Lo natural es mover el
código y después ver qué test se rompió. Acá sería un error: cuatro tests leen
`app.js` como texto, y si el código se muda, **siguen en verde mirando un archivo
donde ya no vive nada**.

El caso grave es `test/visor.test.js`: su trabajo es que el nombre del documento
no entre como marcado. Muevo el panel que lleva ese nombre y el test sigue
pasando, mientras ya no vigila nada. **Una red que dejó de cubrir no avisa que
dejó de cubrir**, así que hay que abrirla antes.

Después, T2 y T3 son chicos y no dependen entre sí. T4 es la que mueve código de
verdad, y para entonces las redes ya están mirando donde toca.

---

## T1 — Que las redes vigilen los archivos nuevos

**Estado:** Completada — 2026-10-02
**RF que cubre:** RF-4
**Riesgo:** Medio — si se hace mal, cuatro redes quedan mirando la nada

### Qué se hizo

Los cuatro tests que parsean un archivo de la aplicación como texto pasaron a
mirar **una lista de archivos**. La lista declara desde ahora los archivos de la
spec 006 que todavía no existen, para que la red ya los esté vigilando el día
que se creen.

| Test | Qué hace ahora |
|------|----------------|
| `test/visor.test.js` | Mira `app.js`, `interfaz/pdf.js` e `interfaz/documento.js` |
| `test/estadisticas-visibles.test.js` | Busca las funciones en `app.js` o en `interfaz/bienvenida.js` |
| `test/menu-movil.test.js` | Busca la sección del menú en `app.js` o en `interfaz/menu.js` |
| `test/responsive-calendario.test.js` | **Verifica que la excepción de `app.js` siga teniendo motivo** |

El cuarto es distinto y era el más frágil: no leía `app.js` para vigilarlo, lo
**excluía** de la vigilancia. Y una exclusión sin motivo es un agujero
silencioso: si el visor de PDF se muda y `app.js` deja de medir, el archivo más
grande del proyecto queda sin vigilar y el test pasa sin mirarlo.

### El caso que se descubrió mirando

**`test/visor.test.js` es la red que se iba a apagar en silencio.** Su trabajo es
que el nombre del documento no entre como marcado. El panel de "a este archivo
le falta el contenido" lleva ese nombre, y ese panel se va a mover en T4.

Sin este trabajo, la operación de moverlo habría sido: copiar el bloque a un
archivo nuevo, borrar el original, y `node --test` en verde. **La red habría
pasado sin mirar el código nuevo.** Y el XSS habría vuelto sin que nadie lo
notara hasta que un archivo llamado `<script>` lo ejecutara.

### Las pruebas de que las redes sirven

| Prueba | Resultado |
|--------|-----------|
| Inyecté un XSS real en `js/interfaz/documento.js` | **Falló en rojo**, diciendo el archivo |
| Corrí la suite entera con el XSS puesto | **330 pasan, 1 falla** |
| Saqué la inyección | Vuelve a **331, 0 fallan** |
| La lista de archivos tiene más de un elemento | Hay un test que lo comprueba |

Eso es lo que ninguna de las cuatro redes hacía: **probarlas inyectando lo que
deben detectar.**

### Resultado

| | Antes | Después |
|----|-------|---------|
| Tests | 328 | **331** (+3) |
| Redes que miran un archivo fijo | 4 | **0** |
| Archivos que la red del XSS vigila | 1 | **3**, dos de ellos aún inexistentes |
| Excepciones sin motivo comprobado | 1 | **0** |
| Líneas de `js/` cambiadas | — | **0** |

---

## T2 — La lista de días, de un solo lugar

**Estado:** Completada — 2026-10-02
**RF que cubre:** RF-1
**Riesgo:** Bajo — una línea, pero toca un dibujo

### Qué se hizo

`js/app.js` pedía su propia copia de `['Lu', 'Ma', ...]`. Ahora pide
`LogicaMapa.diasDeSemana()`, que ya estaba en `js/logica/mapa-calor.js`, con
tests y consumida por `js/interfaz/mapa-calor.js`.

**No se movió nada de `mapa-calor.js`** (DD-4): ya es la fuente buena, y moverla
sería cambiar el lugar de lo que está bien para no ganar nada.

### El problema de fondo: nadie impedía la duplicación

Unificar la lista es media línea. Lo que **no** estaba resuelto es que volviera a
duplicarse: nada lo impedía, y los tests de `diasDeSemana()` pasaban igual,
porque probaban la función y no que hubiera una sola copia.

Dos copias divergen solas. Un día alguien agrega un día, repara el mapa, y el
calendario sigue con los siete viejos — y ningún test se entera.

Por eso van **dos** tests nuevos:

| Test | Qué fija |
|------|---------|
| `ningún otro archivo escribe la lista de días otra vez` | Recorre `js/` entero y exige que la lista esté **solo** en `mapa-calor.js` |
| `app.js toma los encabezados del módulo, no los escribe` | Que la forma de duplicarla —escribirla en vez de pedirla— no esté |

### Las pruebas de que sirven

Volví a duplicar la lista en `app.js`, como estaba antes:

| | |
|---|---|
| Con la lista duplicada | **23 pasan, 2 fallan** |
| Los dos que fallan | Los dos nuevos |
| Al restaurar | **25 pasan, 0 fallan** |

Los dos saltan, no uno. Uno dice *dónde* está la copia; el otro dice *cómo* se
duplicó.

### Verificación en Chrome

El calendario **se miró**, porque un encabezado mal puesto se ve en pantalla y no
aparece en ningún test:

| | |
|---|---|
| Encabezados | `Lu Ma Mi Ju Vi Sa Do` |
| Cantidad | 7 |
| Arranca en lunes, termina en domingo | Sí |
| Consola | **0 errores** |

### Resultado

| | Antes | Después |
|----|-------|---------|
| Copias de la lista en `js/` | **2** | **1** |
| Tests | 331 | **333** (+2) |
| Que vuelva a duplicarse | Nadie lo impedía | **Dos tests lo impiden** |
| Encabezados del calendario | `Lu…Do` | `Lu…Do`, sin cambios |

---

## T3 — El aviso del almacenamiento

**Estado:** Completada — 2026-10-02
**RF que cubre:** RF-2
**Riesgo:** Bajo — solo cambia el texto

### Qué se hizo

Eran **cuatro** caminos, no tres. El cuarto usaba el motivo `'lectura'` —que ni
siquiera estaba escrito en el mensaje— y salía traducido como *"se pasó el
umbral crítico"*. El almacenamiento no estaba lleno: no respondía.

| Camino | Qué sabe | Qué dice |
|--------|----------|----------|
| Alcanzó el umbral | El porcentaje | *"Ocupación: 96 %. El umbral de alarma está en 95 %."* |
| La operación no entra | El porcentaje | Lo mismo, con un motivo distinto |
| El navegador **trió** al escribir | Nada | *"El navegador no dejó guardar."* — **sin números** |
| El navegador **trió** al leer | Nada | Igual que el anterior |

Los dos últimos ahora pasan por `mensajeFalloAlGuardar()`, que **no lleva
porcentaje**. No por descuido: el cálculo se corrió antes de escribir y dio bien
—si no, no se habría llegado a escribir—, así que el número describe el estado
previo, no el fallo.

Un motivo desconocido tampoco se anuncia como otro: antes todo motivo que no
fuera `'espacio'` salía como *"se pasó el umbral crítico"*.

### La red que encontró el hueco

Los tests se escribieron, pasaron, y **una prueba de la red no saltó**.

Se rompió a propósito el camino de escritura, volviéndolo a usar el aviso con
umbral. Los 15 tests dieron verde. El motivo: la aserción miraba la frase
*"umbral"*, y el defecto real de ese camino era el **porcentaje**.

Se agregó el test que faltaba y se repitió:

| Prueba de la red | Con el defecto | Sin |
|-----------------|----------------|-----|
| Porcentaje en el aviso de fallo | **3 fallan** | 0 |
| La escritura vuelve al aviso con umbral | **1 falla** | 0 |
| La lectura vuelve al aviso con umbral | **2 fallan** | 0 |

La segunda daba 0 antes de reinforcing. **Un test que no falla cuando tiene que
fallar es peor que no tenerlo**: dice que la red está puesta cuando no lo está.

### El arnés también era un obstáculo

Para probar el texto había que cargar `app.js`, que no se puede pedir con
`require`: toca `document` y aborta. El navegador falso estaba **enterrado dentro
de `test/navegador.test.js`** y no había forma de llegar a él.

Se extrajo a `test/dom-falso.js`, y `navegador.test.js` pasó a usarlo. Copiarlo
habría sido más rápido y habría sido la mala: dos DOM falsos se desincronizan, y
el que se queda viejo es el que nadie recuerda actualizar.

**202 líneas menos** en `navegador.test.js`.

#### El error de la primera versión

La primera versión del módulo viejosaba `window` como un objeto aparte del
ámbito global. Los tests de `navegador.test.js` seguían dando verde —porque ya
no usaban ese módulo—, y el nuevo fallaba con *"Cannot read properties of
undefined"*, un error que no señalaba la causa.

Un DOM falso que **no funciona es peor que no tener DOM falso**: no falla donde
está el defecto, falla donde se lo usa, y el mensaje apunta a otro lado.

#### Los tests del arnés, y dónde viven

`node --test` corre **todo** `.js` dentro de una carpeta `test`, no solo los
`*.test.js` (ya está anotado en AGENTS.md). O sea: `dom-falso.js` contaba como
un test de la suite **sin tener ninguno**.

La primera solución fue escribirle sus 4 tests a él mismo. **Esa salida creaba
un problema que no era el que parecía.**

`test()` se registra en el `require`. Como `navegador.test.js` y
`avisos-almacenamiento.test.js` lo piden, sus 4 tests se corrían **tres veces**:

| | |
|---|---|
| La suite informaba | **362** tests |
| Los reales, distintos | **354** |
| La diferencia | Los mismos 4 tests, contados 3 veces |

Ocho tests fantasma, en el archivo cuyo total conviene que sea exacto.

Los tests se movieron a `test/dom-falso.test.js`, que es lo que corresponde:
**el módulo es infraestructura; los tests van en un `*.test.js`.**

Después de moverlos la suite da **355**: 354 asserts y **1** que es el archivo
del arnés cargando. Ese uno no comprueba nada, pero tampoco es cero: si el arnés
tuviera un error de sintaxis, el `require` de `navegador.test.js` lo haría
fallar igual.

Y los tests sirven para algo que va más allá del conteo: si el arnés dejara de
cargar la app —porque `app.js` empiece a usar un método del DOM que el mock no
tiene— los tests que lo usan **no fallarían: no correrían nada**. El error
aparecería como un test que pasa sin comprobar nada.

Probado: separando `window` del contexto, fallan 2 de los 4.

### Verificación en Chrome

Los cuatro caminos, con el `alert` real. Se rompe `Storage.prototype` porque
este perfil no tiene los 5 MB que necesita `puedeEscribir()` para dar por pasado
el umbral —y romper `setItem` es exactamente lo que hace el navegador con la
cuota agotada.

| Camino | Porcentaje en el aviso |
|--------|------------------------|
| Alcanzó el umbral | **Sí**, y dice la ocupación y el umbral |
| La operación no entra | **Sí** |
| Trió al escribir | **No** |
| Trió al leer | **No** |

Consola: **0 errores**. El aviso sale **una sola vez** aunque se intente cinco
veces, como antes.

### Resultado

| | Antes | Después |
|----|-------|---------|
| Caminos | 4 con un solo mensaje | **4 con el texto que corresponde** |
| En los caminos sin dato | *"casi lleno (0 % de 95 %)"* | *"El navegador no dejó guardar."* |
| Un motivo desconocido | Se anunciaba como umbral | **Se dice lo único que se sabe** |
| Tests | 333 | **355** (+22) |
| Líneas de `navegador.test.js` | 706 | **504** (−202) |

Los +22 son **17** del aviso y **4** del arnés. El +1 restante es `dom-falso.js`,
que `node --test` cuenta como archivo aunque no tenga tests: está explicado en
la sección de arriba.

---

## T4 — La lógica del calendario, sola y probada

**Estado:** Completada — 2026-10-02
**RF que cubre:** RF-3
**Riesgo:** Medio — mueve código entre archivos

### Lo que la spec decía y lo que había

La spec pedía mover cuatro funciones: `esMesAnioValidos`, `nuevaAnotacion`,
`editarAnotacion` y `quitarAnotacion`. **Ninguna existía con ese nombre.**

| La spec decía | Lo que había |
|---------------|--------------|
| `esMesAnioValidos` | Una comparación escrita en línea dentro de `cambiarMes()` |
| `nuevaAnotacion` | Un `push` escrito en línea dentro de `guardarAnotacion()` |
| `editarAnotacion` | Existía, con la regla pegada al `prompt` |
| `quitarAnotacion` | Se llamaba `eliminarAnotacion` |

Lo que se movió es lo mismo: cuatro reglas. Pero dos no eran funciones, eran
**líneas sueltas dentro de funciones que dibujan**. Esa es la razón de que no
tuvieran tests, y de que no se pudieran tener: una línea que dice qué meses
existen, escondida en una función que abre un `alert`, no se prueba sin un
navegador.

### Qué se movió

`js/logica/calendario.js`, sin DOM y sin `localStorage`:

| Función | Qué decide |
|---------|-----------|
| `esMesAnioValidos` | Si un mes y un año tienen sentido |
| `agregarAnotacion` | Si una anotación se puede crear, y con qué forma |
| `cambiarDescripcion` | Qué pasa al editar, y cuándo no es un cambio |
| `quitarAnotacion` | Si se quitó algo de verdad |

**La costura ya existía**: esas funciones tenían el `prompt` y el `confirm`
pegados al lado de la regla. Se llevó la regla y se dejó el diálogo.

### DD-2: el rango de años, con su motivo vacío

Se movió tal cual: de 2020 a 2100, con una nota al lado que dice que **el
límite no tiene origen conocido**.

Lo que no se hizo fue inventarle una razón. Escribir *"de 2020 en adelante porque
nadie debería tener apuntes viejos"* sería una explicación fabricada y además
falsa: esto es un cuaderno de estudio y puede tener apuntes viejos.

Los dos números están **escritos en un test** (`ANIO_MINIMO` es 2020,
`ANIO_MAXIMO` es 2100). Así el rango no puede cambiar sin que se note, y cuando
alguien decida otro, se cambia el test y se escribe el motivo.

### Un detalle que no era un detalle

Al mover la regla de agregar, la lista del día pasó a asignarse **después** de
saber que se agregó algo:

```javascript
const resultado = LogicaCalendario.agregarAnotacion(...);
if (!resultado.agrego) { ...; return; }
calendario.anotaciones[fecha] = resultado.lista;
```

La primera versión la asignaba siempre. Con eso, abrir un día vacío y no
escribir nada creaba una lista vacía para ese día, que después se guardaba. El
código viejo no lo hacía, así que se dejó como estaba.

Es el tipo de detalle que aparece al mover: no es un error del código anterior,
es uno del movimiento. Por eso se comparó el resultado contra lo que hacía el
código anterior, con los mismos datos.

### Los 25 tests

Los valores salen del dominio, no del código. **Escribí los tests primero, y
fallaron con la razón correcta** — `Cannot find module
'../js/logica/calendario.js'` — que es la que tiene que ser.

| Qué | Casos |
|-----|-------|
| Qué meses existen | Los doce, y ni el 0 ni el 13 |
| Qué años existen | Los extremos, y uno fuera de cada lado |
| Valores que no son números | `NaN`, `undefined`, `null`, un texto |
| Agregar | Recorta espacios, rechaza vacío, respeta el máximo de 3 |
| Agregar a un día que ya tiene 4 | Lo rechaza **sin tocar las que hay** |
| Editar | Recorta, vacío no cambia, no toca tipo ni identificador |
| Editar un índice que no existe | No rompe, no pierde la anotación |
| Quitar | Saca la del índice, no deja huecos, uno inválido no cambia nada |
| Todo lo anterior con basura | `undefined`, `null`, un texto, un número |

El caso de **agregar a un día con más de tres** importa: un respaldo importado
puede traer más anotaciones que el máximo. Agregar una más tiene que
rechazarse sin tocar las que hay — son datos del usuario, y la app no tiene
permiso de descartar nada.

### Verificación en Chrome

Aquí `node --test` no alcanza: los diálogos (`prompt` y `confirm`) no existen en
Node, y el dibujo de la rejilla no se prueba con assertions.

| Qué se probó | Resultado |
|--------------|-----------|
| Encabezados y celdas | `Lu…Do`, celdas del mes |
| Mes 13, año 2019, campos vacíos | Avisa *"Mes o año inválido"* |
| Mes 3 año 2026 | Cambia sin avisar |
| Agregar con espacios alrededor | Queda recortado: *"Traer el trabajo"* |
| Agregar solo espacios | No agrega, **no avisa** |
| Cuarta anotación | No entra |
| Editar con espacios | Queda recortado |
| Editar a vacío, o cancelar | No cambia, no se pierde |
| Quitar, y luego cancelar el borrado | Quita solo la primera vez |
| Aviso del máximo, forzando el botón | *"Máximo 3 anotaciones por día"*, el mismo texto |

Consola: **0 errores**.

### El hallazgo: el aviso del máximo no se puede ver

Mirando el flujo en Chrome apareció esto: **con tres anotaciones el botón de
guardar ya está deshabilitado**, así que no hay forma de llegar al aviso de
*"Máximo 3 anotaciones por día"*. Solo sale si el botón se fuerza a mano.

**No es un defecto de esta tarea, y no se tocó.** El botón se deshabilitaba
antes también, en `mostrarAnotaciones()`. Es decir: el aviso ya era inalcanzable
desde la pantalla antes de que esta tarea empezara.

Se anotó y se dejó, como manda la regla de mover: es una decisión de la
interfaz, no un error de la regla que se movió. Queda acá para que alguien lo
decida: o el aviso sobra, o el botón no debería deshabilitarse.

### Lo que encontró la red nueva

Al agregar un módulo hubo que actualizar tres listas, y una de ellas tenía un
hueco que no se había visto:

`test/navegador.test.js` miraba una lista de globales **escrita a mano**. Un
módulo nuevo que publica su global y que nadie agrega a la lista no lo rompe
nada: el test sigue en verde mirando lo que ya estaba.

Se agregó el test del revés:

```
navegador · ningún script publica un global que no esté en la lista
```

Lee del código qué globales publica cada archivo y exige que todos estén
vigilados. **Cuando se escribió, encontró uno que faltaba**: `CuadernoVirtual`,
el de `app.js`, que muchos tests leían pero que nunca estuvo anotado.

Probado: publicar un `OutroLogica` cualquiera hace fallar el test.

### Resultado

| | Antes | Después |
|----|-------|---------|
| Reglas del calendario | 4 en línea, **sin ni un test** | **4 puras, con 25 tests** |
| Los 12 meses existen | escrito dentro de un `alert` | `esMesAnioValidos()`, con test |
| El máximo de 3 | `tieneLugar()` más un `alert` aparte | una sola pregunta |
| Tests | 355 | **381** (+26) |
| `index.html` | 16 scripts | **17** |

Y `comparar-arbol.js` da **IDÉNTICO**: el árbol lateral no se toca.

---

## Hallazgos que las tareas pueden revelar

Se anotan mientras se hacen, no después.

| Tarea | Hallazgo | Qué se hizo |
|-------|----------|-------------|
| T1 | **`test/visor.test.js` se iba a apagar en silencio.** Su trabajo es que el nombre del documento no entre como marcado, y el panel que lleva ese nombre se muda en T4 | La red pasó a mirar una lista, con los archivos nuevos declarados antes de que existan |
| T1 | `responsive-calendario.test.js` no leía `app.js`: lo **excluía**. Una exclusión sin motivo es un agujero silencioso | Hay un test que verifica que la excepción siga teniendo razón, y falla si `app.js` deja de medir |
| T1 | Con el XSS inyectado, la suite daba **330 de 331**, no un rojo limpio | No es problema: una red que detecta una cosa entre muchas es exactamente lo que tiene que pasar |
| T3 | El aviso de *"Máximo 3 anotaciones por día"* **no se puede ver**: con tres anotaciones el botón de guardar ya está deshabilitado | No se tocó. Es previo a T4, y es una decisión de la interfaz, no de la regla que se movió |
| T4 | La spec pedía cuatro funciones y **ninguna existía con ese nombre**: dos eran líneas sueltas dentro de funciones que dibujan | Se movieron las cuatro reglas, que es lo que había. Se anotan los nombres reales |
| T4 | `test/navegador.test.js` vigilaba una lista de globales escrita a mano. Un módulo nuevo que publica el suyo no lo rompe: el test sigue en verde | Se agregó el test del revés, y **encontró uno que faltaba**: `CuadernoVirtual` |
| T4 | Al mover la regla de agregar, la lista del día se creaba aunque no se agregara nada | Se asigna después de saber que se agregó, como antes. Es el tipo de detalle que aparece al mover |

---

## Decisiones del usuario, ya tomadas

| Decisión | Respuesta |
|----------|-----------|
| ¿Unificar las cuatro plantillas de `.bienvenida`? | **No.** No molestan. Se cierra la deuda sin trabajo |
| ¿Una sola spec para todo lo pendiente? | **No.** Esta spec agrupa lo verificable con "no cambió lo que se ve" |
| ¿Mover el visor de PDF? | No. Rompe la excepción de `responsive-calendario.test.js` |
| ¿Tocar los ids que se generan a mano? | No. Cambiaría los que el usuario tiene guardados |

---

## Lo que esta especificación NO resuelve

| Pendiente | Por qué queda |
|-----------|---------------|
| `app.js` monolítico | Sigue siendo el punto de entrada, por diseño. Sacarle el dibujo es un trabajo de spec propia, y los bloques grandes —construir el árbol, el Pomodoro— arrastran media app |
| El visor de PDF | Es el bloque más seguro del archivo respecto a XSS y el que menos gana moviéndose |
| `construirArbol()` | 180 líneas con nueve dependencias. Los manejadores cierran sobre los objetos reales |
| El Pomodoro | `setInterval`, `Notification`, `AudioContext` y estado propio |
| El rango de años 2020-2100 | Nadie lo escribió. Queda anotado como límite sin origen, a la espera de que alguien lo decida |
| `dot dot-${a.tipo}` en `className` | Dato del usuario entrando en markup. No es XSS —`className` no se parsea como HTML— pero conviene validarlo. **No se toca acá**: es una decisión aparte |
| La fecha `new Date()` dentro del bucle de días | Se anota al mover. No se corrige |

---

## Resultado

**Cerrada el 2026-10-02.** Las cuatro tareas, completas.

### Lo que cambió en el código

| | Antes | Después |
|----|-------|---------|
| Reglas del calendario | 4 en línea, **sin ni un test** | **4 puras, con 25 tests** |
| La lista de días | escrita en `app.js` y en `mapa-calor.js` | **una sola copia**, con un test que falla si vuelve a duplicarse |
| El aviso de almacenamiento | *"casi lleno (0 % de 95 %)"* | **dos mensajes**: el que sabe el porcentaje y el que no |
| `navegador.test.js` | 706 líneas, con el navegador falso adentro | **504 líneas**, arnés compartido |
| Módulos | 16 | **17** |

### Lo que no cambió

Eso es lo importante. La app se ve y se usa igual:

- `comparar-arbol.js` da **IDÉNTICO**, trece escenarios de menú lateral
- `verificar-layout.js` da **todo entra**, 24 mediciones, salida 0
- Los cuatro caminos del aviso de almacenamiento, probados con el `alert` real
- Agregar, editar y quitar anotaciones, con `prompt` y `confirm` reales
- Los cuatro caminos de navegación del calendario
- Consola: **0 errores**

`verificar-layout.js` recorre 24 combinaciones: 2 conjuntos de datos (limpios y
con problemas) × 4 anchos (1920, 1280, 768, 375) × 3 vistas. Con datos limpios y
el modal abierto, el Pomodoro está oculto por una regla de la spec 002; por eso
la vista "principal" va sin modal, que es la única forma de detectar que
algún elemento tape a otro.

**En la spec 005 este control no se corrió.** No era opcional: si el refactor
mueve una regla que decide qué se muestra, el único que lo mide es esto.

### Los números

| | Antes de la 006 | Después |
|----|------------------|---------|
| Tests | 328 | **381** (+53) |
| Módulos de lógica pura | 9 | **10** |
| Archivos de test | 19 | **23** |

### Las tres cosas que hay que recordar de esta spec

1. **El orden fue al revés a propósito.** T1 abrió las redes antes de mover una
   sola línea. Cuatro tests leían `app.js` como texto, y si el código se mudaba
   primero, seguirían en verde mirando un archivo donde ya no vive nada.

2. **Dos redes nuevas, y las dos por culpa de listas escritas a mano.** Una
   exige que los globales **publicados** estén en la lista —y encontró que
   `CuadernoVirtual` no estaba. La otra exige que no haya una **segunda copia**
   de la lista de días.

3. **`app.js` tiene más líneas, no menos.** Estaba en 1782 y quedó en 1906. No
   es una mejora de tamaño: es que cuatro reglas tienen tests y hay motivos
   escritos al lado de lo que se movió. Sacar líneas se hace borrando, y eso lo
   hizo la spec 004.

### Lo que quedó anotado para después

| Pendiente | Dónde |
|-----------|-------|
| El aviso de *"Máximo 3 anotaciones por día"* no tiene por dónde salir | Deuda en `AGENTS.md` |
| `dot dot-${a.tipo}` en `className` | En la tabla de arriba, sin tocar |
| La fecha `new Date()` dentro del bucle de días | Anotado al mover. No se corrige |
| El rango 2020-2100, de origen desconocido | Va con el código, en `js/logica/calendario.js` |
| `app.js` monolítico | Deuda en `AGENTS.md`, con el número real |

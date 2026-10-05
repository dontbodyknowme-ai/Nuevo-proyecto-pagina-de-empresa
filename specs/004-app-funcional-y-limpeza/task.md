# Tareas: Que la app funcione y borrar lo que no se usa

**ID:** 004-app-funcional-y-limpeza
**Estado:** Cerrada — las siete tareas completas, el 2026-10-01

---

## Cómo se usa este archivo

Una tarea a la vez. En este orden:

1. Se escribe el **test primero**, con el valor que dice el dominio.
2. Se ve que **falla**.
3. Recién ahí se escribe el código.
4. Se verifica con **las dos puertas**: `node --test` **y** Chrome.

Ningún borrado de código se hace sin pasar las dos puertas antes y después. Si un
borrado rompe algo, se revierte solo: por eso van agrupados y no de a uno.

---

## Por qué el orden es este

**Primero los tres bugs.** Son código roto, y borrar código muerto no mejora
nada que el usuario sienta. Si el menú no abre y el borrado se rompe a medias,
limpiar el resto no gana nada.

**RF-11 después.** Es un requisito sin implementar, no un defecto: la app no se
rompe hoy, y ya avisa cuando el almacenamiento está lleno.

**La limpieza al final.** Porque borrar código es lo único que se puede deshacer
fácil, y conviene hacerlo cuando todo lo demás ya está verificado.

**`js/datos.js` del final de todo.** Son 317 líneas en un archivo entero. Si
alguna verificación falla, el archivo entero se devuelve y listo.

---

## T1 — Que ningún ReferenceError salga del camino de guardado

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-3
**Riesgo:** Bajo — el cambio de código son unas 25 líneas
**Verificación:** 13 tests nuevos, suite en 297

### Eran **tres** defectos, no uno

El análisis automático había encontrado uno. Al arreglarlo aparecieron los otros
dos, que estaban **escondidos detrás**:

**1 · `LogicaCapacidad` no existe.** `guardarDatos()` llamaba a
`LogicaCapacidad.debeRevertir(error)`. Ese identificador no está en ninguna parte
del proyecto: el binding real es `debeRevertir`, destructurado en la línea 81 y ya
usado bien en la línea 1154.

**2 · `constextra`, sin el espacio.** En `avisarAlmacenamientoLleno()` estaba
escrito `constextra = ...`. Es un **identificador válido**, así que `node --check`
lo aceptaba y la app arrancaba bien. El `ReferenceError` saltaba recién al usar
`${extra}`, y solo cuando el almacenamiento estaba lleno: un camino que casi nadie
recorre.

**3 · `getItem` fuera del `try`.** La copia de seguridad se leía antes del
`try`, así que si `localStorage.getItem` fallaba —algunos navegadores en modo
privado lanzan al leer— la excepción salía entera.

Cada uno tapaba al siguiente. **El primero enmascaraba a los otros dos.**

### Y la mitad de RF-3 que faltaba

Arreglados los tres, la app ya no tiraba excepciones y no perdía datos. Pero
medido en Chrome, el menú seguía mintiendo:

| | Valor |
|---|---|
| Excepciones | ninguna |
| Errores de consola | 0 |
| **Nodos en pantalla** | **1** |
| **Materias guardadas** | **2** |

El motivo: **los ocho que llaman a `guardarDatos()` ignoran el retorno.** Al borrar
una materia, se la sacaba de la memoria, `guardarDatos()` devolvía `false`, y la
pantalla se redibujaba igual. El usuario veía un borrado que no se había
guardado, y al recargar la materia volvía.

### El arreglo

Un helper, `guardarRevirtiendoSiFalla(nuevasMaterias)`: cambia las materias,
intenta guardar, y si no puede, **vuelve a dejar la memoria como estaba**.

Los tres llamadores que **borran o pisan** datos lo usan:

| Llamador | Qué hace ahora |
|----------|----------------|
| `eliminarMateria` | Si no se guarda, `materias` vuelve a estar como antes y no redibuja |
| `eliminarDocumento` | Igual, armando el arreglo nuevo en vez de mutar el existente |
| Importar | Igual, y avisa que no pudo guardar |

Los que no borran datos (renombrar, subir, reordenar) se quedaron como estaban:
cambian algo reversible, y el aviso de almacenamiento ya les llega.

### Una decisión de seguridad que se tomó razonando

Si `getItem` falla, ¿se escribe o no? Lo fácil sería decir "si no sé qué había,
escribo igual". **Es exactamente lo peligroso**: el camino de reversión usa
`null` para significar *"no había datos guardados"*. Confundir "no había" con "no
pude leer" haría que un fallo de escritura **borrara lo que el usuario tenía**.

Así que si no se puede leer, no se escribe. Hay un test que lo fija.

### Para poder probarla, `guardarDatos` se publicó en la API

Vive dentro del IIFE y no había forma de llegar a ella desde los tests. Ahora está
en `window.CuadernoVirtual`, por el mismo motivo que `minutosDeEstudioPorDia`: una
función que hay que verificar tiene que ser alcanzable desde afuera.

### Verificación en Chrome

Con `localStorage.setItem` roto a propósito:

| | Antes | Después |
|---|---|---|
| Excepción en pantalla | `ReferenceError: LogicaCapacidad is not defined` | **ninguna** |
| Errores de consola | 1 | **0** |
| Datos previos | revueltos a medias | **intactos** |
| Nodos en pantalla vs. guardados | 1 vs 2 — **mintiendo** | **iguales** |

Con el almacenamiento sano: borrar materia y documento funciona, y lo que se ve
**sobrevive a la recarga**.

### Resultado

| | Antes | Después |
|----|-------|---------|
| Tests | 284 | **297** (+13) |
| Defectos en el camino de guardado | 3 | **0** |
| Llamadores que miran si se pudo guardar | 0 de 8 | **3 de 3** que borran datos |

### Verificación

- Suite: 297 pasan, 0 fallan
- Carga en navegador: 18 tests (era 5)
- `comparar-arbol.js`: `IDÉNTICO`, salida 0
- `buscar-caracteres-raros.js`: salida 0
- Consola: 0 errores, con el almacenamiento roto y sano

---

## T2 — Que las estadísticas no desaparezcan

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-2
**Riesgo:** Bajo
**Verificación:** 9 tests nuevos, suite en 306

### Qué hace

`mostrarBienvenida()` asigna a `visor.innerHTML` **entero**. Eso borra todo lo
que hay dentro de `#visor` — y `#statsContainer` vive adentro, en el bloque de
bienvenida que trae `index.html`.

La variable `statsContainer` seguía apuntando al nodo desprendido, así que
`actualizarStats()` escribía a un nodo que ya no estaba en la pantalla. El código
no fallaba: la barra simplemente desaparecía, y no volvía hasta recargar.

### La opción que se iba a recomendar era incorrecta

El plan decía sacar la barra de `#visor`, para que ningún `visor.innerHTML = ...`
la pudiera borrar. Al mirar el CSS se vio que eso **cambia el diseño**:

```css
.stats {
    display: flex;
    justify-content: center;
    gap: var(--space-5);
    margin-top: var(--space-6);
}
```

La barra es **parte del bloque de bienvenida**, no una cabecera. Hoy, con un
documento abierto, no se ven las estadísticas: es el diseño actual y **no es un
defecto**. Sacarla de `#visor` la haría visible **siempre**, que es un cambio de
producto que nadie pidió.

Por eso el arreglo fue el otro: que `mostrarBienvenida()` la reponga.

| Opción | Qué implica | Elegida |
|--------|-------------|---------|
| **A · Sacar la barra de `#visor`** | La barra queda siempre visible. **Cambia el diseño** | No |
| **B · Que `mostrarBienvenida()` la reponga** | Se ve **exactamente igual** que hoy, y la barra vuelve | **Sí** |

### Lo que se hizo

1. `statsContainer` pasa de `const` a `let`: el nodo viejo se destruye con cada
   `innerHTML` y hay que apuntar al nuevo.
2. La plantilla de `mostrarBienvenida()` vuelve a traer `<div class="stats"
   id="statsContainer"></div>`, en el mismo lugar que en `index.html`.
3. Después de escribir la plantilla, se vuelve a buscar el nodo y se llama a
   `actualizarStats()`. **En ese orden**: al revés se escribiría en el nodo viejo.
4. `actualizarStats()` arranca con `if (!statsContainer) return;`. Que el bloque
   de bienvenida cambie mañana no puede romper la app.

### El riesgo que queda, y cómo se cubre

El bloque de bienvenida queda escrito en **dos** lugares: `index.html` y la
plantilla del código. Si divergen, el defecto vuelve en silencio.

Hay un test que **compara las frases de los dos** y falla si se diferencian.

Es un test de fuente, no de comportamiento — más débil de lo ideal — porque el
DOM falso de `test/navegador.test.js` no parsea el `innerHTML`, así que no puede
reproducir el defecto por sí solo. La confirmación de verdad va en Chrome.

### Verificación en Chrome

| Momento | ¿En el DOM? | Números |
|---------|-------------|---------|
| Al cargar | sí | `3 · 2 · 2` |
| Tras eliminar una materia | **sí** | `2 · 2 · 2` |
| Tras eliminar un documento | **sí** | `2 · 1 · 0` |

Y lo que **no** cambió, que era lo importante: con un documento abierto la barra
sigue sin verse, exactamente como antes. Comprobado abriendo un PDF.

### Resultado

| | Antes | Después |
|----|-------|---------|
| Tests | 297 | **306** (+9) |
| La barra después de borrar | desaparece | **se queda, con el número nuevo** |
| Cambios de diseño | — | **ninguno** |

### Verificación

- Suite: 306 pasan, 0 fallan
- Carga en navegador: 18 tests
- `comparar-arbol.js`: `IDÉNTICO`, salida 0
- `verificar-layout.js`: salida 0 en las 24 mediciones
- `buscar-caracteres-raros.js`: salida 0
- Consola: 0 errores

---
## T3 — Que el menú se abra en el teléfono

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-1
**Riesgo:** Medio — es interfaz y hay CSS de por medio
**Verificación:** 17 tests nuevos, suite en 331

### El defecto

Abajo de 640 px el menú lateral es un cajón: está en `left: 0` con
`transform: translateX(-100%)`, o sea **fuera de la pantalla**. La regla que lo
trae de vuelta ya existía desde el principio:

```css
.menu-lateral.visible { transform: translateX(0); }
```

**Ningún código la usaba.** El botón solo alternaba `colapsado`, que en un cajón
fuera de pantalla no cambia nada visible: el panel sigue en `translateX(-100%)`
y lo único que se mueve es el botón, de `left: 316px` a `left: 16px`.

### La decisión: un clic, dos clases, y que el CSS decida

El botón hace **lo mismo** en un teléfono y en un escritorio, pero lo que
significa es distinto: en uno ancho pliega el panel a 60 px, en uno angosto abre
el cajón.

El código **no sabe en qué ancho está, y no debe saberlo**. Si el manejador
tuviera que elegir una clase u otra según el ancho, habría que medir la
pantalla, y eso está prohibido. Entonces el clic pone **las dos**:

```javascript
menuLateral.classList.toggle('visible', abierto);
menuLateral.classList.toggle('colapsado', abierto);
```

Y la hoja de estilos dice qué significa cada una en cada ancho:

| | Arriba de 640 px | Abajo de 640 px |
|---|---|---|
| Sin clases | Panel desplegado, 300 px | Cajón cerrado, fuera de pantalla |
| Con las dos | Panel plegado, 60 px | **Cajón abierto, 260 px** |

Abajo de 640 px hay que **anular** lo que `colapsado` hace, porque si no el
cajón entra con 60 px de ancho y el contenido con opacidad 0: una franja vacía.
Eso estaba medido antes de decidir el diseño, y por eso la anulación va en la
hoja y no en el manejador: para que ningún camino futuro lo alcance.

La flecha del botón también la gira el CSS, y en los dos anchos **al revés**
—cerrado apunta a la derecha, abierto a la izquierda—, porque en el escritorio
y en el teléfono el significado está invertido. Como el `title` no puede ser
preciso en los dos anchos a la vez, dice *"Mostrar u ocultar el menú"*: con el
mismo clic, "colapsar" o "abrir" estaría mintiendo en uno de los dos.

### El respaldo es un elemento de verdad

Se podía haber hecho con un `::before` del menú, y habría sido un error: un
pseudo-elemento no admite un manejador de clic, así que no se podría cerrar
tocando afuera. Es un `<div id="menuRespaldo">` con su propio manejador, apagado
por defecto y encendido por **una sola regla**, dentro del bloque de 640 px y
solo cuando el menú está abierto. En el escritorio no existe: si estuviera
prendido, cada clic fuera del menú lo cerraría.

Va con `z-index: 90`, debajo del menú (100) y debajo del botón (1000): así el
menú se puede seguir tocando y el botón sigue sirviendo para cerrar.

### Lo que se encontró mirando, no pensando

Tres cosas que ningún test de Node podía detectar y que salieron mirando la
página en Chrome:

**1. Con el menú cerrado, el tabulador entraba igual.** `translateX(-100%)` saca
el menú de la vista pero **no** del recorrido del teclado: con el cajón cerrado,
el `Tab` entraba al botón de "Añadir Materia" y el lector de pantalla leía el
árbol entero. Se arregla con `visibility: hidden`, que sí lo saca de las dos
cosas. Comprobado con ocho `Tab` reales: el menú no aparece en ninguno.

**2. Al abrir, el foco no entraba.** Este lo delató Chrome: `visibility` estaba
en la transición **con duración**, así que durante los 350 ms de la animación el
valor animado seguía siendo `hidden` —y un elemento con `visibility: hidden` no
puede recibir el foco—, así que `menuLateral.focus()` no hacía nada. El arreglo
es el patrón conocido: la visibilidad cambia **sin duración y con retardo al
cerrar, y sin retardo al abrir**.

**3. Un test mío fallaba por el motivo equivocado.** El helper que extraía un
bloque `@media` usaba `indexOf`, que devuelve la **primera** coincidencia.
Hay dos bloques de `@media (max-width: 640px)`: uno es del mapa de calor y otro
el general. El test decía *"el menú tiene que salir de la pantalla"* mirando un
bloque que no mencionaba el menú. Peor que no tener el test: hacía cambiar algo
que no estaba roto.

### Tocar un ítem también cierra, sin preguntar el ancho

Abajo de 640 px, porque el cajón tapa la pantalla y el usuario quiere ver lo
que tocó. Lo interesante es cómo **no** se pregunta el ancho:

En el escritorio el menú solo se puede tocar cuando ya está desplegado
—plegado, el contenido tiene `pointer-events: none`—, y desplegado significa que
las dos clases están ausentes. Así que "cerrar el menú" no tiene nada que
cerrar y sale sin hacer nada. La función se llama siempre y decide sola.

Comprobado: en el escritorio, tocar un documento **no** cierra nada y **no**
mueve el foco al botón.

### Verificación en Chrome, a 375 px

| Paso | Resultado |
|------|-----------|
| Recién cargado | Menú en `x: -260`, `hidden`, sin respaldo, flecha a la derecha |
| Clic en el botón | Abre: 260 px, `visible`, respaldo prendido, **foco dentro del menú**, flecha a la izquierda |
| Clic otra vez | Cierra, foco al botón |
| `Esc` | Cierra, foco al botón |
| Clic en el respaldo | Cierra, foco al botón |
| Tocar un documento | Cierra **y el documento se abre** (`iframe` creado) |
| Tocar "+ Añadir Materia" | Cierra **y el modal se abre** |
| 8 `Tab` con el menú cerrado | Nunca entra al menú |
| Consola | **0 errores** |

### Y el escritorio quedó idéntico

| | 1920 px y 1280 px |
|---|---|
| Sin tocar nada | Panel de 300 px, botón en 316, sin respaldo, flecha a la izquierda |
| Un clic | Se pliega a 60 px, el árbol se desvanece, el botón va a 16, la flecha gira |
| Dos clics | Se despliega de vuelta |

`comparar-arbol.js` dice **IDÉNTICO** y `verificar-layout.js` da **salida 0** en
las 24 mediciones.

El caso raro que también se probó: abrir el cajón a 375 px y agrandar a 900 px.
Las clases quedan puesta, el respaldo se apaga solo, y el panel queda a 60 px.
El siguiente clic lo despliega: **lo que se ve es lo que el clic hace**, que es
justo lo que tiene que pasar si el CSS es el que interpreta las clases.

### Un detalle de conectividad

Al abrir el menú hay que darle `tabindex="-1"` al `<aside>`: un `<aside>` no es
tabulable por su cuenta, así que `focus()` no habría hecho nada.

### Resultado

| | Antes | Después |
|----|-------|---------|
| Tests | 314 | **331** (+17) |
| A 375 px, el menú se podía abrir | no | **sí** |
| Cajas de salida en el teléfono | 0 | **4** |
| Con el menú cerrado, `Tab` entraba al menú | sí | **no** |
| Escritorio | — | **idéntico** |

---

## T4 — RF-11 · Bloquear las escrituras cuando no entra

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-4
**Riesgo:** Medio — toca el guardado de datos
**Verificación:** 5 tests nuevos, suite en 311

### El bloqueo ya existía. Lo que faltaba era que se obedeciera.

`guardarDatos()` ya llamaba a `puedeEscribir()` **antes** de intentar escribir, y
si no entraba avisaba y devolvía `false`. O sea: la parte de "no escribir" de
RF-11 estaba hecha desde antes.

Lo que faltaba era del otro lado: **cinco llamadores mutaban los datos y seguían
dibujando, sin mirar el retorno.**

| Llamador | Qué pasaba con el almacenamiento lleno |
|----------|------------------------------------------|
| Crear materia | La materia nueva se veía en el menú y **no existía**: desaparecía al recargar |
| Subir por botón | Los archivos se veían y **no existían** |
| Subir por arrastre | Igual |
| Renombrar documento | El nombre nuevo se veía y **no se guardaba** |
| Reordenar documentos | El orden se veía y **no se guardaba** |

Es el mismo defecto que la mitad de RF-3 que quedó pendiente en T1: la pantalla
diciendo una cosa y el almacenamiento otra.

### Lo que se hizo

Los cinco ahora usan `guardarRevirtiendoSiFalla()`:

| Cambio | Cómo |
|--------|------|
| Crear materia | `guardarRevirtiendoSiFalla([...materias, materia])` |
| Renombrar | Se arma el arreglo nuevo con el nombre cambiado, sin mutar el viejo |
| Reordenar | Se arma la lista de documentos nueva, sin `splice` sobre la original |
| Subir archivos | Se unificó en `agregarArchivosAMateria()`: los dos caminos usaban código casi idéntico |

`procesarArchivo()` se partió en dos: `crearDocumento(file)` **arma** el documento
sin agregarlo, y `agregarArchivosAMateria()` lo agrega y lo guarda. Antes la
primera mutaba los datos y dejaba que el llamador guardara: por eso el archivo
aparecía en pantalla sin estar guardado.

### Un bug del mock que llevaba años escondido

Para probar "con el almacenamiento lleno" hubo que llenar el `localStorage` del
navegador falso. La primera vez devolvió `true` — no se llenaba.

La causa: el mock guardaba los datos en `localStorage._d`, pero `guardarDatos()`
mide con `for (const llave in localStorage)`, que en el mock **no veía ninguna
clave guardada**. `usoActual` daba siempre 0.

O sea: **la comprobación de capacidad nunca se ejecutó en un solo test de Node.**
No había ningún test que pasara por el camino del almacenamiento lleno.

Ahora el mock pone las claves como propiedades del objeto, con los métodos
no-enumerables, que es como funciona un `Storage` real.

### `escriturasBloqueadas` resultó redundante

La bandera se escribía en cuatro lugares y **no se leía en ninguno**. Al
implementar RF-11 se vio que no hacía falta: `guardarDatos()` ya re-decide en cada
llamada con `puedeEscribir()`, así que si una escritura entra ahora, entra; y si
el usuario libera espacio, entra en la siguiente. `avisoMostrado` ya evita el
aviso repetido.

No se le inventó un uso artificial. Queda anotada como candidata a borrar en T6,
junto con el resto del código muerto.

### Verificación en Chrome

Con el almacenamiento **realmente lleno** (4,94 MB, 98 % del umbral):

| Operación | Resultado |
|-----------|-----------|
| Crear materia | **No aparece.** Avisó: *"98 % de 95 %, se pasó el umbral crítico"* |
| Renombrar documento | El nombre viejo sigue |
| Reordenar | El orden sigue |
| Consola | **0 errores** |
| Pantalla vs. guardado | **Coinciden** |

Y después de liberar el espacio:

| Operación | Resultado |
|-----------|-----------|
| Crear materia "Física" | **Aparece y se guarda** |

### Resultado

| | Antes | Después |
|----|-------|---------|
| Tests | 306 | **311** (+5) |
| Llamadores que ignoran el resultado | 5 | **0** |
| Operaciones que persisten lo que muestran | 3 de 8 | **8 de 8** |
| Paths de subida duplicados | 2 | **1** |

### Verificación

- Suite: 311 pasan, 0 fallan
- Carga en navegador: 23 tests
- `comparar-arbol.js`: `IDÉNTICO`, salida 0
- `verificar-layout.js`: salida 0 en las 24 mediciones
- `buscar-caracteres-raros.js`: salida 0
- Consola: 0 errores

---

## T5 — Que los números de los controles no mientan

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-6
**Riesgo:** Bajo
**Verificación:** 3 tests nuevos, suite en 314

### Qué pasaba

`test/navegador.test.js` se llamaba "los 15 scripts" cuando carga **16**. En
`AGENTS.md` el número estaba en dos lugares, y un comentario decía "los 7
scripts", que era cierto cuando se escribió y dejó de serlo a los tres scripts
siguientes.

Un número escrito a mano se desincroniza solo. Y un control de calidad que dice
"15" cuando carga 16 **se ve más fuerte de lo que es**: el que lo lee confía en
él y no lo vuelve a contar.

### Lo que se hizo

**El nombre del test sale de la lista**, no de un número escrito:

```javascript
test(`navegador · los ${ORDEN.length} scripts cargan sin errores`, () => {
```

Ahora no puede mentir. Si alguien agrega un script a `index.html` y a `ORDEN`, el
nombre se actualiza solo.

### El guard de verdad

Que el nombre se arme de la lista no alcanza si la lista se desincroniza de
`index.html`. Así que hay un test que compara las dos, en cantidad y en orden:

| | |
|---|---|
| Cantidad | Si `index.html` carga 17 y la lista tiene 16, falla |
| Orden | Si en la posición 5 uno tiene `fechas.js` y el otro `anotaciones.js`, falla |

El orden importa: los módulos tienen que cargarse antes de `app.js`, y eso
`test/navegador.test.js` reproduce porque carga en ese orden.

### Y la red se probó a sí misma

Agregar un `<script>` a `index.html` sin agregarlo a la lista tiene que hacer
fallar el test. Comprobado:

```
AssertionError: index.html carga 17 scripts y la lista del test tiene 16.
Alguien agregó o sacó un script de una de las dos.
```

Después de sacarlo, todo volvió a verde y el nombre volvió a decir 16 solo.

### Un test que se detectaba a sí mismo

El test que busca números viejos en comentarios buscaba `los \d+ scripts`. El
comentario que explicaba el problema tenía el ejemplo con su número, así que
**el test se detectaba a sí mismo y fallaba siempre**.

Se resolvió de dos maneras: el ejemplo ya no lleva el número, y la búsqueda
excluye explícitamente las líneas del propio test. El patrón se arma con
concatenación para que ni siquiera en el código quede escrito.

### Documentación corregida

| Archivo | Dice |
|---------|------|
| `test/navegador.test.js` | El número sale de `ORDEN.length` |
| `AGENTS.md`, 4 lugares | 16 scripts |
| `MEMORY.md` | 16 scripts, 314 tests |
| Comentario "los 7 scripts" | Ahora dice "los scripts", sin número |

### Resultado

| | Antes | Después |
|----|-------|---------|
| Tests | 311 | **314** (+3) |
| Nombre del test | "los 15", fijo | **sale de la lista** |
| ¿La lista puede desincronizarse? | sí, en silencio | **falla loudly** |
| Números viejos en comentarios | 1 | **0** |

### Verificación

- Suite: 314 pasan, 0 fallan
- Carga en navegador: 26 tests
- `comparar-arbol.js`: `IDÉNTICO`, salida 0
- `verificar-layout.js`: salida 0 en las 24 mediciones
- `buscar-caracteres-raros.js`: salida 0

---
## T6 — Borrar el código muerto, en grupos

**Estado:** Completada — 2026-10-01
**RF que cubre:** RF-5
**Riesgo:** Medio — toca archivos vivos
**Verificación:** 16 grupos, suite de 331 a 328 con 9 tests nuevos

### Primero una herramienta, porque a ojo no se encuentra

El código muerto es lo más difícil de ver que hay, porque **no rompe nada**: no
tira error, no aparece en la consola, ningún test se pone rojo. La única señal
es que un símbolo aparece una sola vez en todo el proyecto.

Se escribió `herramientas/buscar-codigo-muerto.js`, que separa cuatro
categorías, y las dos primeras son operaciones de riesgo distinto:

| | Qué es | Qué se borra |
|---|--------|--------------|
| **A** | No la usa nadie, ni el propio módulo | La función entera |
| **B** | Declaración sin usar, ni exportada | La declaración |
| **C** | Se le asigna y nunca se lee | La declaración y sus asignaciones |
| **D** | La usa su módulo, nadie la pide de afuera | Solo la línea del `API` |

### La herramienta tuvo cuatro bugs, y encontraros la volvió confiable

| El bug | Qué hacía |
|-------|-----------|
| Contaba comentarios como uso | `escapeHtml` parecía viva por dos comentarios en `visor.js` que explican el XSS que corrigió |
| Confundía `...base` con `objeto.base` | `base` parecía sin usar, y se reparte en cada respuesta de `puedeEscribir` |
| `getElementById` con el mismo nombre contaba dos | `calendarioMapa` parecía usada por su propio `id` en el HTML |
| **El último de un objeto sin coma final** | `estaOculto` y `DIAS_EN_LA_SEMANA` **no aparecían en la lista**, y son dos de los que T6 iba a borrar |

Y se **probó**: se le inyectaron cuatro tipos de código muerto —función,
constante, bandera escrita-y-no-leída, y export sin consumidor— y los detectó
los cuatro; al restaurar, dejó de verlos.

### El plan estaba incompleto: 25 ítems, no 13

Y dos de sus grupos estaban mal:

| El plan decía | La realidad |
|---------------|-------------|
| `consolidar` reimplementa `minutosDe` | No: reimplementa **`minutosTotales`**, que es la que usa la app |
| G4 borra `estaOculto` | Correcto: está muerto, sus 17 tests lo mantenían vivo |

### Lo que más costó: la regla duplicada estaba testeada, y la copia que quedó sin probar

`consolidar()` y `minutosTotales()` hacen lo mismo. `consolidar()` **no la usaba
nadie**, pero la testeaban tres archivos; `minutosTotales()`, que sí la usa la
app, tenía cinco tests.

Borrarla sin más era cambiar código muerto probado por código vivo sin probar.
Las reglas que fijaban —cruce de medianoche, días separados, redondeo por
sección, el objeto vacío— están ahora en `test/secciones.test.js`, contra
`minutosTotales()`, con un caso más: cinco pausas de 30 segundos.

`js/interfaz/aviso.js` tenía lo mismo: `resumenDeProblemas()` y
`reconstruirAviso()` generaban **las mismas cadenas carácter por carácter**. Las
reglas del texto estaban fijadas contra la muerta. Ahora están en
`test/aviso.test.js` contra la viva, con dos casos más: el singular cuando hay
uno solo, y que el número sea el de los problemas que se muestran.

### Los grupos

| Grupo | Qué borró | Líneas |
|-------|-----------|--------|
| G1 | `escapeHtml`, el alias de `existeFecha`, `calendarioMapa`, `sesionesCompletadas` | 22 |
| G2 | `resumenDeProblemas` y sus 2 tests, con 5 nuevos contra la función viva | 19 |
| G3 | 9 exportaciones sobrantes del `API` | 9 |
| G4 | `quedanCupos`, `estaAlMaximo`, `estaOculto` y sus tests | 27 |
| G5 | `minutosDe`, `aIso`, `DIAS_EN_LA_SEMANA`, `VISTAS`, `consolidar` | 70 |
| G6 | `alCerrarLaVentana` y sus 3 tests | 15 |
| G7 | `js/datos.js`, 317 líneas que no cargaba nadie | 317 |
| G8 | `escriturasBloqueadas`, encontrada en T4 | 8 |

### Lo que NO se borró, y por qué

**`consentimiento.js`.** `registrarConsentimiento`, `tieneConsentimiento` y
`revocarConsentimiento` no tienen **ningún** llamador. No es código muerto: es
**RF-12 sin implementar**. Ya se había decidido conservar el módulo, y un
módulo entero con sus tests, que todavía no se conectó.

**`existeFecha`.** La función de `js/logica/fechas.js` no la usa el código, solo
sus 18 tests. Se borró el alias de `app.js`, que era lo que sobraba; la función
se queda porque es una regla de fechas correcta y con nombre bueno, y borrar 18
tests para eliminar una función que el calendario podría necesitar mañana es un
mal negocio. Anotada para que se decida, no para que se conserve por inercia.

**`sesionesCompletadas`.** Se le sumaba 1 cada vez que terminaba una sesión del
Pomodoro y nadie lo leía. Se fue. Si algún día se quiere un "hoy: N sesiones",
ese contador se construye con la pantalla que lo muestra.

### Los 9 tests nuevos

T6 borró tests, porque los tests del código muerto son parte del código muerto.
El plan pedía reponer con cobertura de lo que no estaba cubierto, y
`test/sin-cubrir.test.js` tiene 9:

| | Qué cubren |
|---|---|
| RF-11 | Qué pasa sin almacenamiento declarado, y que el espacio disponible nunca sea negativo |
| RF-11 | Que un error que no es de cuota no revierte, y que `debeRevertir` aguanta basura |
| RF-11 | Que un umbral raro no cambia la decisión, y los dos extremos del umbral |
| RF-6 | Qué hace `elementosVisibles` con una vista que no existe |
| — | Que el mapa no muestra la sesión en curso, ni dice que sí |

### Dos cosas que aparecieron y NO se arreglaron

Son cambios de comportamiento, no borrados, y la constitución pide no
mezclarlos. Quedan anotadas para que las decidas:

**1. El mapa no muestra la sesión de Pomodoro en curso.**
`consolidar()` miraba `seccion.finMs ?? ahoraMs`, así que una sesión abierta
contaba. `minutosTotales()` recorre solo `estado.secciones`, y la sesión
abierta vive en `estado.seccionAbierta`. El mapa no muestra minutos hasta que
la sesión termina. ¿Tiene que mostrarla?

**2. El código contradice a RF-4 en el umbral.**
La tabla de RF-4 dice *"se pasó el umbral pero entra → se escribe, con un
aviso"*. `puedeEscribir()` devuelve `permitido: false` en cuanto el uso
alcanza el umbral. Con la capacidad real de 5 MB, a partir del 95 % —unos
4,75 MB— el usuario deja de poder guardar aunque cada operación entre de sobra.
Hay un test que deja el comportamiento a la vista, con la nota de que si se
cambia hay que actualizar la spec.

### Resultado

| | Antes | Después |
|----|-------|---------|
| Líneas de código muerto | ~437 | **0** |
| Exports sobrantes | 9 | **0** |
| Tests | 331 | **328** (−3 netos, con 9 nuevos) |
| Piso de RNF-1 | 284 | con 44 de margen |

### Verificación

- Suite: 328 pasan, 0 fallan
- Carga en navegador: 26 tests
- `comparar-arbol.js`: IDÉNTICO, salida 0
- `verificar-layout.js`: salida 0
- `buscar-codigo-muerto.js`: solo quedan `consentimiento.js` (RF-12, a
  propósito) y los exports que existen para poder probar
- Consola de Chrome: 0 errores, y el mapa de calor dibuja las 49 celdas

---

## T7 — Verificación final y documentación

**Estado:** Completada — 2026-10-01
**Riesgo:** Bajo
**Verificación:** el checklist entero, en automatico y en Chrome

### El checklist

Todo lo de la lista pasó. Lo que se puede medir con una comando dice el
comando; lo demás se miró en Chrome.

| | |
|---|---|
| A 375 px el menú se abre y se cierra | Abierto: 260 px en pantalla, respaldo prendido, foco adentro. Cerrado: fuera, respaldo apagado, foco al botón |
| Las estadísticas se ven después de eliminar, agregar e importar | 1→2→1→1 materias, y el `1 Materias / 2 Documentos / 4 Palabras` correcto tras importar |
| Con el almacenamiento roto no sale ningún `ReferenceError` | No se escribió, la pantalla no mintió, **0 errores** |
| Con el almacenamiento lleno no se escribe nada y se avisa | Avisó *"98 % de 95 %"*, no escribió, 0 errores |
| La suite no baja de 284 | **328**. Margen de 44 |
| `test/navegador.test.js` en verde | 26 |
| `comparar-arbol.js` da IDÉNTICO | salida 0 |
| `verificar-layout.js` da salida 0 | 24 mediciones |
| Consola con 0 errores, escritorio y a 375 px | 0 en los dos |
| `buscar-caracteres-raros.js` da salida 0 | salida 0 |
| `node --check` en los módulos | 0 malformados de **16** |
| Sin `package.json` ni `node_modules` | False / False |
| `AGENTS.md` y `MEMORY.md` al día | Actualizados por tarea |
| Los tres `.md` sin caracteres raros | 0 |

### La decisión que quedó pendiente desde el plan, resuelta sola

**El desplazamiento del panel con muchas materias.** El plan lo dejó para
decidirlo mirando Chrome, y con 40 materias se responde solo:

| | |
|---|---|
| Alto visible | 537 px |
| Alto del contenido | 3144 px |
| `overflow-y` | `auto` |
| Última materia | hay que desplazar, y se llega |

El panel se desplaza, y el `overflow-y: auto` ya estaba en la hoja de estilos.
No hacía falta nada. **A veces una decisión pendiente se resuelve con una
medición y no con un cambio.**

### Un detalle que se encontró mirando

Cuando el almacenamiento **tira** la excepción, el aviso dice
*"está casi lleno (0 % de 95 %)"*. El 0 % es real —el cálculo se hizo antes
de intentar escribir, y no falló— pero junto con "casi lleno" se lee como un
contrasentido. No se tocó: es el texto de un aviso, y cambiarlo es una tarea
propia con su propio criterio sobre qué le conviene leer al usuario.

### Estado final de la especificación

| | |
|---|---|
| Tareas | 7 de 7 |
| Tests | 306 → **328** (+22) |
| Módulos | 17 → **16** |
| Líneas de código muerto | ~437 → **0** |
| Piso de RNF-1 | 284, con 44 de margen |

### Lo que esta especificación NO resolvió

| Pendiente | Por qué queda |
|-----------|---------------|
| `app.js` monolítico | 1782 líneas. La 003 le sacó la lógica pero sigue siendo el archivo más grande. Requiere otra spec |
| Las cuatro plantillas de `.bienvenida` | Solo se unificó la parte del defecto 2 |
| La lista de días de la semana existe **dos** veces | `js/app.js:1534` y `js/logica/mapa-calor.js:130`. Antes eran tres: T6 borró la de `fechas.js` por no tener consumidor. Unificarlas **no** es un arreglo chico: toca `app.js` y un dibujo que hoy anda. Spec 006 |

### Las tres que estaban acá, resueltas el 2026-10-02

Salieron de esta lista. Ninguna cambió `js/`: las tres eran decisiones que ya
estaban tomadas en la práctica y faltaban por escrito.

| Estaba pendiente | Decisión | Ahora |
|------------------|----------|-------|
| El mapa no muestra la sesión en curso | **No la muestra, y no debe.** Es CP-1 de la spec 001 | Resuelto en `resolucion-cp.md`. El porqué quedó junto a `minutosDeEstudioPorDia()` |
| El umbral contradice a RF-4 | **El código estaba bien.** La tabla de RF-4 estaba mal escrita | RF-4 corregido, con la cita de RF-11 de la spec 001 al lado |
| RF-12 sin conectar | **No se conecta.** Sale del alcance | Notado en *Fuera de alcance* de la spec 001, con el motivo |

El test que dejó el comportamiento del umbral a la vista sigue en
`test/sin-cubrir.test.js`, y ahora dice lo que se decidió en vez de dejar la
duda abierta.

---

## Hallazgos que las tareas revelaron

Veintiséis. Todos se anotaron mientras hacían, no después.

| Tarea | Hallazgo | Qué se hizo |
|-------|----------|-------------|
| T1 | Eran **tres** defectos encimados, no uno | El primero enmascaraba a los otros dos |
| T1 | `constextra` sin espacio: identificador válido, `node --check` lo aceptaba | Corregido. Es el tipo de error que ninguna comprobación de sintaxis ve |
| T1 | Los que llaman a `guardarDatos()` ignoraban el retorno | Cambiados por `guardarRevirtiendoSiFalla` |
| T1 | Si `getItem` falla, escribir "por las dudas" borraría datos del usuario | No se escribe. Hay un test que lo fija |
| T2 | La opción A del plan (sacar la barra de `#visor`) **cambia el diseño**: la haría visible siempre | Se eligió la B. El plan estaba mal y se corrigió antes de codear |
| T2 | El DOM falso de `test/navegador.test.js` no parsea `innerHTML` | El test es de fuente, no de comportamiento. La prueba real va en Chrome |
| T3 | Una regla de CSS que nadie usa: `.menu-lateral.visible` existía y ningún código la ponía | Es código muerto. No rompe nada, por eso nadie lo notó |
| T3 | El helper de `@media` usaba `indexOf` y había **dos** bloques de 640 px | Agarraba el del mapa de calor. Los tests fallaban por un motivo que no era el suyo |
| T3 | `visibility` en la transición **con duración** impedía que el foco entrara al menú | Sin duración y con retardo al cerrar, sin retardo al abrir |
| T3 | El `title` del botón no puede ser preciso: el mismo clic pliega en un ancho y abre en otro | Dice "mostrar u ocultar". La flecha la gira el CSS, que sí sabe el ancho |
| T3 | Con el menú cerrado, el `Tab` entraba igual: `translateX(-100%)` no saca del teclado | `visibility: hidden`, verificado con ocho `Tab` reales |
| T4 | El mock guardaba los datos en `localStorage._d`, y `for...in` no veía ninguna clave | **La comprobación de capacidad nunca se había ejecutado en un test** |
| T4 | `escriturasBloqueadas` resultó redundante: `puedeEscribir()` ya re-decide en cada llamada | No se le inventó un uso. Anotada, borrada en T6 |
| T4 | Los dos caminos de subida tenían código casi idéntico | Unificados en `agregarArchivosAMateria()` |
| T5 | El test que buscaba números viejos **se detectaba a sí mismo**: el ejemplo tenía su número | El ejemplo ya no lleva número, y la búsqueda excluye sus propias líneas |
| T5 | La lista del test podía desincronizarse de `index.html` en silencio | Un test compara las dos, en cantidad **y en orden** |
| T6 | El inventario real era de **25** ítems, no los 13 del plan | Se escribió `herramientas/buscar-codigo-muerto.js` |
| T6 | Esa herramienta tenía 4 bugs, y uno se saltaba el **último** elemento de un objeto sin coma | Se probó inyectando código muerto: detectó los cuatro tipos |
| T6 | El plan decía que `consolidar` duplicaba a `minutosDe` | Duplicaba a **`minutosTotales`**, la que usa la app |
| T6 | El código muerto era la copia **testeada** de una regla viva, en dos casos | Las reglas se mudaron a la función que se ejecuta de verdad |
| T6 | `consentimiento.js` no tiene un solo llamador | No es código muerto: es **RF-12 sin implementar** |
| T6 | El mapa no muestra la sesión de Pomodoro en curso | Anotado. Es cambio de comportamiento, no un borrado |
| T6 | El código contradice a RF-4 en el umbral | Anotado, con un test que deja el comportamiento a la vista |
| T7 | Con el almacenamiento lleno, el aviso dice *"casi lleno (0 % de 95 %)"* | El 0 % es real pero se lee como contrasentido. Anotado, sin tocar |
| T7 | El panel con 40 materias se desplaza, con `overflow-y: auto` que ya estaba | La decisión pendiente del plan se resolvió con una medición, sin cambios |

---

## Decisiones del usuario, ya tomadas

| Decisión | Respuesta |
|----------|-----------|
| El menú en el teléfono | **Implementarlo.** El teléfono tiene que servir |
| `consentimiento.js` (91 líneas) | **RF-12 sigue en alcance: no se borra** |
| `escriturasBloqueadas` | **Implementar RF-11** |
| `consolidar` contra `minutosTotales` | **Borrar `consolidar` y mover su cobertura** a la que se usa |
| Los tests que se pierden al borrar | **Agregar tests de lo que hoy no está cubierto** |

---

## Decisiones pendientes

Ninguna bloquea. Las tres primeras necesitan una respuesta del usuario porque
son **cambios de comportamiento**, no limpieza:

**1. ¿El mapa de calor tiene que mostrar la sesión de Pomodoro en curso?**
Hoy no la muestra. `minutosTotales()` recorre solo `estado.secciones`, y la
sesión abierta vive en `estado.seccionAbierta`. La función anterior,
`consolidar()`, sí la contaba, pero estaba muerta.

**2. ¿El umbral tiene que bloquear o solo avisar?**
La tabla de RF-4 dice que se escriba con un aviso. El código bloquea. Con la
capacidad real de 5 MB, a partir del 95 % —unos 4,75 MB— el usuario deja de
poder guardar aunque cada operación por separado entre de sobra.

**3. RF-12, ¿cuándo se conecta?**
`consentimiento.js` está entero y probado, sin un llamador. Es la única
función del proyecto que existe completa y no hace nada.
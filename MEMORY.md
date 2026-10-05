# MEMORY.md — Cuaderno Virtual

## Descripción del Proyecto
Cuaderno virtual para organizar materias y documentos académicos. Permite subir archivos HTML, PDF y Word, organizarlos por materias y visualizarlos en un visor integrado. Incluye modo Pomodoro para estudio y exportación/importación de datos.

## Estructura del Proyecto
```
New Project/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js
│   ├── logica/         ← funciones puras (testeables con Node)
│   ├── datos/          ← estado de las secciones
│   ├── interfaz/       ← dibujado, sin cálculos
│   └── inicio-calendario.js
├── test/               ← tests de la lógica pura
├── docs/constitucion.md
├── specs/001-heat-map/
├── MEMORY.md
└── AGENTS.md
```

## Características Implementadas
- Crear/eliminar materias
- Subir documentos (HTML, PDF, Word)
- Visualizador de PDF con PDF.js (sin barra lateral)
- Conversión de Word a HTML with Mammoth.js
- Guardado automático en localStorage (sin botón de guardar)
- Renombrar documentos
- Estadísticas (materias, documentos, palabras)
- Modo lectura (pantalla completa)
- Arrastrar y soltar archivos
- Ordenar documentos arrastrando
- Menú lateral colapsable con botón flotante
- Pomodoro (temporizador 25/5 con notificaciones y sonido)
- Exportar/Importar datos (JSON)
- Calendario con anotaciones (máx 3/día, colores por tipo, integración con Pomodoro)
- El calendario solo dibuja fechas que existen: febrero muestra 28 o 29 días, nunca 31
- Resaltado de días con estudio en el calendario mensual (usa las mismas claves DD/MM/AAAA que el mapa de calor)
- Mapa de calor de las últimas 4 semanas con los minutos reales de estudio
- Modal del calendario en un panel con ancho flexible, adaptable de 375 a 1920 px
- El chrome del modal se ajusta a la vista: en el mapa no aparecen la navegación de mes ni la leyenda de anotaciones
- Registro de tiempo real por secciones (en vez de sesiones fijas de 25 min)
- Aviso de almacenamiento casi lleno, con reversión completa ante fallo de cuota
- El máximo de anotaciones por día (3) vive en un solo lugar, no en tres
- Las estadísticas se calculan aparte del dibujo, en `js/logica/estadisticas.js`
- La estructura del menú lateral se decide en `js/logica/arbol.js`; el dibujado y los clics siguen en `app.js`
- Un respaldo con datos raros no rompe la app: `js/logica/datos.js` los revisa, `js/interfaz/aviso.js` avisa arriba con un botón de cerrar, y **nunca se borra nada**
- Al abrir un documento al que le falta el contenido sale un panel que lo explica; el documento sigue en el menú
- La lista de los siete días vive **una sola vez**, en `js/logica/mapa-calor.js`. Un test falla si aparece en otro archivo
- El aviso de almacenamiento son **dos mensajes**: el que sabe el porcentaje y el que no. El segundo nunca muestra un número, porque en ese camino no lo hay
- Las reglas del calendario —qué mes y año existen, y agregar, editar y quitar anotaciones— están en `js/logica/calendario.js`, con tests. Antes eran líneas sueltas dentro de funciones que dibujaban
- `test/dom-falso.js` es el navegador falso que permite cargar `app.js` en Node. Lo comparten varios tests, y tiene tests propios en `dom-falso.test.js`

## Tecnologías
- HTML5, CSS3, JavaScript vanilla
- PDF.js (CDN) — visor de PDF
- Mammoth.js (CDN) — conversión de Word
- localStorage — persistencia
- Web Audio API — sonido de Pomodoro
- Notification API — notificaciones de Pomodoro
- node --test — tests de la lógica pura (viene con Node, no instala nada)

## Verificación

### 1. Lógica pura (rápido)
```powershell
node --test                              # 314 tests
node --check js/logica/mapa-calor.js     # sintaxis
```

### 2. Carga real en el navegador (obligatorio antes de decir "terminado")
```powershell
node --test test/navegador.test.js
# Los scripts cargan, los globales se publican, la API existe.
# Detecta duplicados de nombre y funciones escondidas en un IIFE.
```

### 3. Layout del calendario
```powershell
node herramientas/verificar-layout.js
# 24 mediciones: 2 conjuntos de datos x 4 anchos x 3 vistas.
# Sale 0 si todo entra, 1 si hay algo roto.
```

### 3.bis El menú lateral no cambió de forma
```powershell
node herramientas/comparar-arbol.js
# 13 escenarios. Sale 0 si dio idéntico, 1 si algo cambió.
# Compara el HTML real, no el comportamiento de los clics.
```

### 3.bis Los datos están enteros
```powershell
# Con datos raros sembrados, la app tiene que arrancar igual:
#   13 escenarios, ninguno con errores de consola.
# Es lo mismo que el punto 3.bis, pero mirando que nada esté roto.
```

### 4. En Chrome
`chrome-devtools` puede no estar disponible. Alternativa sin dependencias:
hablarle directo por el protocolo DevTools con el WebSocket nativo de Node.
Ver el punto `4.quater` de `AGENTS.md`.

## Trampa: `node --test` ejecuta todo lo que hay en `test/`

Un archivo `.js` dentro de un directorio llamado `test` **se ejecuta** en
`node --test`, aunque no se llame `*.test.js`, y **cuenta como un test**.

El plan de la spec 002 afirmaba lo contrario: que un verificador de layout en
`test/` no se correría por no ser `*.test.js`. Es falso, y se comprobó con una
sonda: el archivo corrió y el total de tests subió.

Por eso los scripts que abren un navegador viven en `herramientas/`, fuera del
alcance del runner.

**La regla:** en `test/`, solo cosas que el runner pueda correr sin efectos raro.
Un `.test.js` que abre Chrome sería tolerado por el runner, pero tardaría y
sería frágil.

## XSS en el visor: el nombre del documento (2026-10-01)

En `js/app.js` había un `innerHTML` con una plantilla:

```javascript
visor.innerHTML =
    `<iframe srcdoc="${escapeHtml(doc.contenido)}" title="${doc.nombre}"></iframe>`;
```

`doc.contenido` pasaba por `escapeHtml`. **`doc.nombre` no.** Un documento
llamado `informe" onload="codigoMalicioso()"` inyectaba un manejador de eventos
en el iframe, y **se ejecutaba al cargar**. Comprobado en Chrome: `SE_EJECUTO: true`.

Lo más incómoda: en `actualizarBreadcrumbs` usan `textContent` con el comentario
*"evita inyección de HTML"*. Sabían del riesgo y se les pasó este caso.

**Arreglado** con `js/interfaz/visor.js`, que construye el iframe con
`createElement` y asigna `title` como propiedad. Sin plantillas.

### Dos cosas que se aprendieron

1. **Un `escapeHtml` a mitad de camino es una falsa sensación de seguridad.**
   Escapar el contenido pero no el nombre deja el agujero abierto justo donde se
   mira menos.

2. **`srcdoc` no lleva `escapeHtml`.** Ese atributo está hecho para recibir HTML.
   Escaparlo y que el navegador lo decode es un doble trabajo que se cancela
   solo. La captura muestra el contenido escapado en el atributo, pero el
   atributo real es HTML crudo.

### El payload que sí funciona

El clásico `x"><img src=x onerror=...>` **no** funciona en un iframe: el `<img>`
queda como contenido de respaldo, que los navegadores modernos no activan.

El que sí funciona es el que **no cierra la etiqueta**:

```
informe" onload="window.__inyectado()"
```

Ese `onload` queda dentro del iframe y corre cuando carga. Por eso al probar
XSS hay que probar **variantes**, no solo el payload de manual.

### Queda sin usar

`escapeHtml` ya no se usa en ningún lado de `app.js`. Se puede borrar.

## Trampa: `[hidden]` no oculta si hay `display: flex`

En T4 el atributo `hidden` se aplicaba correctamente y los tests de Node
pasaban, pero en el navegador **el elemento seguía en pantalla**: las reglas de
la hoja de estilos tienen `display: flex`, y eso le gana al atributo.

```css
/* display: flex le gana al [hidden] del navegador */
[hidden] { display: none !important; }
```

**Ningún test de Node lo detectó**, porque el DOM falso de los tests no aplica
CSS. Solo apareció al abrir Chrome.

**La regla:** probar interfaz tiene dos caminos y no son intercambiables. Lo que
Node no sabe es de anchos de pantalla, de cascada y de specificity.

## Herramientas de Desarrollo (MCP)
- **chrome-devtools** (global) — consola, red, rendimiento, capturas, Lighthouse.
  Perfil aislado, sin telemetría, headers de red redactados, viewport 1280x800.
- **context7** (proyecto) — documentación actualizada de librerías

## Acceso Directo
- **Nombre:** Cuaderno Virtual
- **Ubicación:** Escritorio (OneDrive)
- **Icono:** Libro
- **Modo:** Kiosko (pantalla completa)

## Atajos de Teclado
- `Esc` — Salir del modo lectura
- `F11` — Pantalla completa del navegador

## El IIFE esconde funciones: la API pública (lección de 2026-10-01)

`chrome-devtools` **no estaba disponible** en la sesión (el MCP no aparece en el
catálogo de herramientas). Como Chrome sí está instalado, se puede hablar con
él **directo por el protocolo DevTools** usando el WebSocket nativo de Node,
sin `npm install` ni dependencias.

Y eso encontró el bug más serio de todos:

```
EXCEPCION: Uncaught ReferenceError: minutosDeEstudioPorDia is not defined
```

**El mapa de calor estaba en blanco desde que lo envolví en un IIFE.**
`minutosDeEstudioPorDia` era una función global de `app.js`;
`js/inicio-calendario.js` la llamaba y, al quedar dentro del IIFE, dejó de
existir. **96 tests en verde y la app rota** — porque los tests de la lógica
pura no Exercise el cableado entre archivos.

El arreglo es una **API pública** al final de `app.js`:

```javascript
const API = {
    minutosDeEstudioPorDia,   // la necesita js/inicio-calendario.js
    abrirSeccionEstudio,
    cerrarSeccionEstudio
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.CuadernoVirtual = API;
}
```

**La regla:** si una función de un archivo la necesita otro, tiene que salir
por la API pública. Si no, está escondida.

### El guardián: `test/navegador.test.js`

Hay tests que cargan los scripts **como lo hace el navegador** (sin
`require`, sin `module`, con `window` como ámbito global compartido) y exigen
que la API esté publicada. Es lo más cerca que se puede estar de abrir Chrome
sin abrirlo. Antes de esto no había **ninguna** red de seguridad para ese
error, y por eso pasó inadvertido.

## Trampa de los formatos de fecha (lección de 2026-10-01)

Hubo **dos bugs apilados** en el calendario mensual, y el segundo tapaba al primero.

**Bug 1 — comparación de formatos.** `generarCalendario()` armaba un `Set` con
las fechas ISO de `pomodoroSesiones` (`'2026-10-01T09:00:00.000Z'`) y después
comparaba contra las claves de las celdas, que son `DD/MM/AAAA`. Nunca coincidía,
así que **ningún día se resaltaba nunca**, en todo el historial de la app.

**Bug 2 — datos viejos.** Leía `pomodoroSesiones`, el almacén del formato
antiguo de 25 min fijos. El Pomodoro actual escribe en `mapaCalorSecciones`, así
que aunque el formato hubiera estado bien, tampoco habría visto nada de lo nuevo.

**El arreglo** fue una línea: usar `minutosDeEstudioPorDia()`, que ya existía,
ya convertsía bien y ya sumaba las dos fuentes.

```
  fecha    |  CODIGO VIEJO   |  CODIGO NUEVO
  ---------+-----------------+--------------
  01/10/2026 |        -       |  RESALTADO   ← 72 min (47 + 25)
```

**La regla:** los formatos de fecha no se comparan como texto. Para ordenar o
comparar hay que pasar por `new Date(fecha).getTime()`, y para mostrar, usar
siempre `aFechaClave()`. Ver `clasificarDia()` en `js/logica/mapa-calor.js`, que
ya lo hace así y tiene el comentario al respecto.

## Trampa del ámbito global (lección de 2026-10-01)

**Los tests de Node pasan aunque la página esté rota.**

En Node cada archivo es un módulo con su propio ámbito, así que `const API`
repetido en cuatro archivos no molesta. En el navegador **todos los `<script>`
comparten el ámbito global**, y ahí reventaba todo:

```
Identifier 'API' has already been declared
Identifier 'aFechaClave' has already been declared
```

Resultado: ni siquiera cargaba el primer archivo, y la app entera estaba muerta
con los 91 tests en verde.

**Cada archivo va envuelto en un IIFE:**

```javascript
(function () {
    const API = { /* ... */ };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    } else {
        window.MapaCalorLogica = API;
    }
})();
```

**No usar `<script type="module">`.** Aislaría el ámbito a secas, pero el
proyecto se abre con `file://` y los módulos ES están bloqueados por CORS en ese
caso. Chrome los rechaza con
`Access to script at 'file:///...' from origin 'null' has been blocked`.

### Regla que sale de esto

`node --test` en verde **no significa que la app funcione**: solo prueba la lógica
pura de forma aislada. Antes de dar por terminado algo que toca archivos nuevos,
hay que cargar la página de verdad (Chrome, o el simulador del punto 2 de
Verificación).

Y si la herramienta de verificación no está disponible, **decirlo antes** de
marcar la tarea como completa, no después.

## Separar cálculo de dibujo no es corregir (lección de 2026-10-01)

Al mover `actualizarStats()` a `js/logica/estadisticas.js` encontré que contar
palabras partiendo por espacios **cuenta de más en los bordes**:

```
'hola mundo'  → 2   correcto
'hola  mundo' → 2   correcto   (el \s+ es codicioso, agrupa los seguidos)
' hola'       → 2   debería 1
'hola '       → 2   debería 1
' hola '      → 3   debería 1
'   '         → 2   debería 0
```

La hipótesis inicial —"los espacios dobles inflan"— **era falsa**, y solo se
descartó al medir. Los del medio no sobran.

**No se corrigió.** Es **CP-2** de la spec 003, que está abierta: cambiarlo
haría bajar las estadísticas del usuario, y eso es una decisión suya, no de un
refactor. Los tests lo fijan tal como está, con el nombre CP-2 y una nota que
dice qué debería dar, para que quede a la vista.

**La regla:** un refactor que mueve código y otro que cambia comportamiento son
tareas distintas. En la misma tarea, uno de los dos se hace mal. Acá se movió, y
la prueba de que no se movió de más es comparar en Chrome contra el cálculo
hecho a mano con los datos viejos.

### Y un test mío que estaba mal

Escribí que `' hola '` contaba 2 palabras. Cuenta **3**: tiene espacio al
principio y al final, y cada uno suma uno. Cuando el test falla contra un valor
que uno acaba de inventar, **el que está equivocado es el valor esperado** —
se calcula a mano y se corrige el test, no al revés.

## El bug de febrero: un bucle que llegaba siempre hasta 31 (2026-10-01)

El calendario dibujaba los días con un bucle que **siempre iba hasta 31**:

```javascript
for (let dia = 1; dia <= 31; dia++) {   // ← en febrero sobraban 3 días
```

Febrero de 2026 tiene 28 días, pero se dibujaban el **29, el 30 y el 31**.

No era solo un desborde visual. Esas celdas eran **clicables**, así que se
podía abrir el formulario de anotación sobre el 31/02 y **guardar** la
anotación. Comprobado: la anotación persistió en `localStorage` con la clave
`31/02/2026`.

**El dato del usuario estaba contando un día que no existe**, y el calendario no
tenía forma de avisar.

Ahora `js/logica/fechas.js` calcula cuántos días tiene el mes y el bucle usa ese
número.

### La lección que importa: no copies el valor esperado del código que estás reemplazando

Al escribir los tests de `fechas.js`, el valor "correcto" de `diasDelMes` para
febrero se calculó **a mano, aparte**, mirando el calendario real.

Si se hubiera copiado del código viejo — o peor, si se hubiera escrito el test
**después** del código nuevo y con la expectativa de que pasara — el test habría
dado 31 en febrero, igual que el bug, y habría dado verde. **Un test que
confirma el error sigue siendo un test que pasa.**

Orden que funciona:

1. Escribir el test con el valor que dice el **dominio**, no el código.
2. Ver que falla.
3. Recién ahí escribir el código.

Si el test pasa antes de que exista el código, el valor esperado se inventó — y
probablemente salió del código viejo.

## Una regla escrita en tres lugares (2026-10-01)

El máximo de anotaciones por día estaba así:

```javascript
contador.textContent = `${anotaciones.length}/3 anotaciones`;   // 1
btnGuardarAnotacion.disabled = anotaciones.length >= 3;          // 2
if (calendario.anotaciones[fecha].length >= 3) { ... }          // 3
```

Tres copias del mismo `3`. Funcionaban juntas **solo porque nadie se olvidaba de
cambiar las tres**. Si mañana se quisiera 5 por día y se olvidara una, el contador
diría una cosa y el botón haría otra, sin ningún error en ninguna parte.

Ahora hay **0** copias: viven en `js/logica/anotaciones.js`.

### El detalle que hace que una regla tenga que ser tolerante

Un respaldo importado puede traer **más** anotaciones que el máximo. La regla
tiene que aguantarlo: no lanzar, no borrar, no romper. Solo decir que no hay
lugar.

Probado con 5 anotaciones en un día: el contador muestra `5/3 anotaciones`, el
botón queda deshabilitado y la página sigue viva.

**La regla:** cuando un cálculo se base en un tope, el caso que hay que probar
no es "se llegó al tope" sino **"hay más que el tope"**. Los datos del usuario
vienen de afuera y no respetan las reglas.

## Herramientas: lo que PowerShell hizo mal (2026-10-01)

Cuatro errores, todos el mismo día, todos evitables.

### 1 · `Set-Content` rompe los acentos de los `.md`

Escribir un archivo Markdown con `Set-Content` garbifica los acentos: `día`
pasa a ser `dÃ­a`. El archivo queda ilegible y, peor, **da la impresión de
estar bien** hasta que se abre en un editor que no lo disimula.

**Un `.md` se edita con la herramienta de archivos, nunca con PowerShell.**
PowerShell queda para correr tests y medir.

### 2 · Editar por número de línea desincroniza el archivo

Para reemplazar una sección se localizeó `## T2` y `## T3` por número de línea,
se borró el rango y se insertó el texto nuevo. Como el contenido anterior ya
había sido editado, **los números apuntaban a otro lado** y la sección no se
encontró.

La forma segura es buscar el encabezado y trabajar sobre el rango real, o
reemplazar por texto exacto.

### 3 · `if` no se puede usar dentro de `-f`

```powershell
Write-Output ("BOM: {0}" -f (if ($b[0] -eq 239) { "SI" } else { "no" }))
# El término 'if' no se reconoce como nombre de un cmdlet
```

`if` no es una expresión en PowerShell: no devuelve un valor, ejecuta.
Hay que calcular la variable antes.

### 4 · La base de datos del historial es un archivo vivo

`C:\Users\manun\.local\share\opencode\opencode.db` (SQLite) guarda **todo** el
historial de chat: 1915 mensajes en 4 sesiones, tabla `session_message`.

Mientras OpenCode está corriendo, **el archivo está bloqueado** y no se puede
leer con `ReadAllBytes`. Se puede leer en solo-lectura con el SQLite nativo de
Node v24 (`node:sqlite`, `new DatabaseSync(ruta, { readOnly: true })`).

**Nunca abrirla en escritura** — es la base viva de la aplicación.

Y ojo con el historial: es un detalle interno de la herramienta. **Lo durable es
`AGENTS.md`, `MEMORY.md` y `specs/`**, que son los archivos que uno escribe a
propósito.

## La sesión vive ahora en el proyecto

Estaba corriendo desde `C:\Users\manun`, así que cualquier archivo nuevo podía
caer en la carpeta personal sin darse cuenta. Se movió con `session_move` a
`C:/Users/manun/Proyectos/New Project`.

Se puede volver a mover. Los paths relativos de los documentos valen ahora.

## Los datos del usuario no respetan las invariantes (2026-10-01)

Un respaldo importado puede traer datos que el código no espera. Antes de
`js/logica/datos.js` no había **nada** que los revisara, y el resultado:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'forEach')
Uncaught TypeError: Cannot read properties of undefined (reading 'minutosDeEstudioPorDia')
```

Una sola materia sin lista de documentos **tumbaba la app entera**. Y lo peor
no era el menú: al cortarse el arranque, el mapa de calor nunca se inicializaba.
Eso no se veía mirando el error, porque el segundo `TypeError` habla de otra
variable.

**Los errores en cascada son síntomas.** El primero dice qué está mal; el segundo
dice qué se rompió por culpa del primero.

### Las dos reglas del módulo

1. **Nunca se borra nada.** Un dato raro se completa, no se descarta. Un
   documento sin contenido sigue en el menú, con su nombre, para que el usuario
   lo vea y decida.
2. **Un dato roto no tira la app.** Se anota como problema y se sigue. La función
   no lanza nunca.

### Tres decisiones que son del usuario, no del código

| Pregunta | Decisión | Por qué |
|----------|----------|---------|
| ¿Cómo avisar? | Banner con botón de cerrar | Un `alert()` con un respaldo viejo saltaría en cada arranque, y el usuario dejaría de abrir la app |
| ¿Qué se ve al abrir un documento sin contenido? | Panel que explica qué falta | No intenta cargar nada: sin ruido de consola ni espera |
| ¿Qué se hace con los datos rotos? | Normalizar y seguir | Descartar sería perder datos del usuario |

**La regla:** cuando un dato del usuario no encaja, la decisión de qué hacer con
él es del usuario. El código puede avisar; no puede decidir.

### Un HTML vacío NO es un documento roto

`{ tipo: 'html', contenido: '' }` se abre: sale un iframe en blanco, que es la
verdad. `{ tipo: 'pdf', contenido: '' }` no se puede abrir: no hay nada que
cargar.

**La regla:** "está vacío" y "está roto" no son lo mismo. Marcar como roto lo que
solo está vacío es mentir sobre lo que el usuario tiene, y lo hace desconfar del
aviso para todo lo demás.

## Congelar lo que se ve: la red del menú lateral (2026-10-01)

`construirArbol()` son 162 líneas de las que casi todas son `createElement` y
`addEventListener`. **`node --test` no puede verificar un refactor así**: los
tests de Node no saben de atributos ni de orden de nodos.

Así que se congeló lo que realmente se pinta:

- `herramientas/capturar-arbol.js` — siembra 11 juegos de datos, deja que la app
  se dibuje, y guarda el HTML real de `#arbolNavegacion`.
- `herramientas/comparar-arbol.js` — vuelve a capturar y contrasta contra
  `herramientas/linea-base-arbol.json`. Sale **0** si dio igual, **1** si cambió.

### Los errores en cascada son síntomas

Un `TypeError` puede ser consecuencia de otro. El caso de T6:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'forEach')
Uncaught TypeError: Cannot read properties of undefined (reading 'minutosDeEstudioPorDia')
```

El segundo **no era un bug aparte**: era la consecuencia de que el primero
cortara la inicialización. Arreglando el primero desapareció el segundo, y con él
el mapa de calor en blanco.

**Mirar solo el primer error de la consola hace que un problema parezca dos.**

## Dos ceros que no eran ceros (2026-10-01)

Dos verificaciones que daban "0" y no significaban nada:

**El aviso de datos de T6 tapaba el Pomodoro, y el verificador no lo veía.**
No por un error del verificador: porque abre el modal del calendario en cada
medición, y con el modal abierto el Pomodoro está oculto por una regla de
specs/002. El único estado donde el aviso puede taparlo era el estado que nunca
se medía.

Solución: agregar la vista "principal", sin modal. El verificador pasó de 8 a
**24 mediciones** (2 conjuntos de datos × 4 anchos × 3 vistas).

**El ancho del aviso era 155 px en una pantalla de 375.** `max-width` solo pone
el tope. Un `position: fixed` sin ancho explícito se ajusta al contenido
(*shrink-to-fit*), y con `overflow-wrap: anywhere` el contenido mínimo es
minúsculo.

La forma que no falla es `left` + `right` + `margin-inline: auto`. Nada de
`left: 50%` + `transform: translateX(-50%)`.

**La regla:** un chequeo que da 0 no dice "todo bien", dice "no encontré **esto**".
Vale preguntar qué más podría estar mal que el chequeo no cubre. Y vale
**probarlos a mano una vez**, porque el primer consumer de una red nueva
siempre tiene puntos ciegos que no se ven hasta que rompen algo.

## Verificar sin tocar los datos del usuario (2026-10-01)

Durante T4 y T6 sembré datos de prueba con
`localStorage.setItem('cuadernoVirtual', ...)` sobre el almacenamiento real, sin
preguntar. El usuario aclaró después que esos datos eran de prueba, así que no
se perdió nada. Pero el método estaba mal, y la próxima vez puede no ser igual.

**La regla:** para verificar, sembrar en un perfil de Chrome aparte
(`--user-data-dir` temporal), como ya hacen
`herramientas/capturar-arbol.js` y `verramientas/verificar-layout.js`. Nunca en
el perfil del usuario.

Y la razón de fondo: **pedir permiso cuesta un mensaje, y perder los datos de
alguien cuesta meses de trabajo.** Si el cálculo del riesgo no es obvio,
preguntar.

Una sonda que siempre dice "igual" no prueba nada. La primera versión lo demuestró
sin querer: marcaba `ok` cuando la lectura **fallaba**, porque confundía "no pude
leer" con "estaba vacío". Con eso, un bug real pasó como si todo anduviera bien.

Después de arreglarla, se cambió un `title` a propósito y la red lo detectó
señalando el carácter 556. Recién ahí se puede decir que sirve.

### El comparador no ve los manejadores

Compara HTML, no comportamiento. Los 11 `addEventListener` son invisibles para él,
y son justo lo que se refactorizó. Por eso hubo que probarlos a mano:

- Click en el nodo de un documento → abre la materia y el documento correctos
- Botón "ver" de un documento en **otra** materia → también correctos
- Arrastrar y soltar → reordena y guarda
- `stopPropagation` → el botón no pliega la lista de arriba

**La regla:** una red que compara estructura no reemplaza probar el
comportamiento. Son dos preguntas distintas.

### Y encontró dos bugs antes de tocar nada

La sonda se armó para el refactor, y en el camino destapó:

1. Una materia sin lista de documentos hace fallar **toda** la inicialización
2. Un documento sin `contenido` hace `fetch(undefined)`

Los dos son **datos importados que no respetan las invariantes** — la misma
familia que el bug de febrero de T1. Anotados como T6.

**La regla:** armar la red antes de refactorizar tiene el efecto secundario de
encontrar cosas. Una sonda que siembra datos raros es un test que no sabía que
tenías.

## Caracteres de otro idioma: el chequeo que no miraba (2026-10-01)

Dos palabras en un proyecto en español estaban **traducidas**:

| Dónde | Estaba | Debería ser |
|-------|--------|-------------|
| `specs/003-refactor-app/spec.md` | dos caracteres chinos (U+5E94, U+8BE5) | "debería" |
| `specs/001-heat-map/spec.md` | dos coreanos (U+C18C, U+C7AC) | "material" |

Los tres chequeos de encoding que venía usando daban **0** en los dos casos:

- sin BOM → el archivo estaba bien guardado
- `U+FFFD` → el mojibake no es `U+FFFD`, son caracteres **válidos** mal decodificados
- patrón de mojibake (`Ã`, `â€`) → tampoco: aquí no hubo decodificación incorrecta

**Los tres buscaban corrupción dentro de los caracteres que uno espera. Ninguno
buscó lo que no debería estar.**

Por eso ahora existe `herramientas/buscar-caracteres-raros.js`, que hace la
pregunta al revés: recorre los 96 archivos del proyecto y avisa si encuentra
chino, cirílico, árabe, hebreo, coreano, japonés o tailandés. Sale con código 1.

**La regla:** un control de calidad tiene que poder decir "esto no debería
existir". Un control que solo verifica lo que esperás, se puede pasar de largo
sin que te avise nunca.

### Y la sonda tuvo que probarse a sí misma

La primera versión del script reportaba **505** caracteres raros, todos falsos:
el salto de línea, los selectores de variación de los emojis (`U+FE0F`) y el
surrogate suelto de cada emoji. Tuve que corregir el rango permitido y saltar el
surrogate **antes** del `continue`, no después.

Y el script se reportaba a sí mismo, por citar en su propio comentario los
caracteres que buscaba. Ahora los nombra por su código en vez de copiarlos: una
herramienta que se culpa a sí misma deja de ser creíble.

Metí un carácter chino a propósito para confirmar que la sonda lo encuentra.
Lo encontró, y después volví todo a cero.

## Un número escrito a mano se desincroniza solo (2026-10-01)

`test/navegador.test.js` se llamaba "los 15 scripts" cuando carga 16. `AGENTS.md`
tenía el número en dos lugares y un comentario decía "los 7 scripts", cierto
cuando se escribió.

Lo peligroso no es que el número esté viejo: es que **el control queda más fuerte
de lo que es**. El que lee "navegador · los 15 scripts" confía en él y no lo
vuelve a contar.

El arreglo:

```javascript
test(`navegador · los ${ORDEN.length} scripts cargan sin errores`, () => {
```

Pero eso solo alcanza si la lista no se desincroniza de `index.html`. Así que
hay un test que compara las dos, en cantidad **y en orden**: el orden importa
porque los módulos tienen que cargarse antes de `app.js`.

**La regla:** un número en un nombre de test, en un comentario o en un documento
tiene que salir de la lista real. Si está escrito a mano, tarde o temprano
miente, y el que lo lea no tiene forma de saber que miente.

### Y un test que se detectaba a sí mismo

El test que buscaba números viejos en comentarios usaba el patrón `los \d+
scripts`, y el comentario que explicaba el problema **tenía el ejemplo con su
número**. El test se detectaba a sí mismo y fallaba siempre.

Se resolvió con dos cosas: el ejemplo dejó de llevar el número, y la búsqueda
excluye explícitamente las líneas del propio test.

**La regla:** un control que busca un patrón también puede tener el patrón. Al
escribirlo, hay que preguntarse si el propio control dispara.

## Un mock que miente hace que un camino nunca se pruebe (2026-10-01)

Para probar "con el almacenamiento lleno" hubo que llenar el `localStorage` del
navegador falso de `test/navegador.test.js`. Devolvió `true`: no se llenaba.

La causa estaba en el mock:

```javascript
localStorage: {
    _d: almacen,                          // los datos viven acá adentro
    getItem(k) { return this._d[k] ... }
}
```

Y `guardarDatos()` mide el espacio con:

```javascript
for (const llave in localStorage) { ... }
```

En el mock, `for...in` no ve **ninguna** clave guardada: `_d` es lo único que hay.
Así que `usoActual` daba siempre 0, y `puedeEscribir()` decidía siempre "entra".

**La comprobación de capacidad nunca se había ejecutado en un solo test de
Node.** No había forma de saberlo: todos los tests pasaban.

El arreglo: el mock ahora pone las claves **como propiedades del objeto**, con
los métodos no-enumerables. Es como funciona un `Storage` real.

**La regla:** un mock que no se parece a lo real no protege: esconde los caminos
que no sabe modelar. Cuando un test da un resultado "trivial" —todo anda,
nunca falla— sospechá del mock antes que del código.

Y ojo con el límite de las herramientas: `buscar-caracteres-raros.js` detecta
caracteres de otros alfabetos, **no palabras en inglés dentro de una frase en
español**. Esa palabra se coló en este mismo archivo y la sonda no la vio.
Cada control cubre una cosa, y lo que no cubre hay que buscarlo a mano.

## El bloqueo existía; lo que faltaba era que se obedeciera (2026-10-01)

RF-11 pedía bloquear las escrituras cuando el almacenamiento está lleno.
`guardarDatos()` ya lo hacía: llamaba a `puedeEscribir()` **antes** de escribir.

Lo que faltaba eran los llámadores: cinco mutaban los datos y seguían dibujando
sin mirar el retorno. Con el almacenamiento lleno, una materia nueva o un
archivo subido **se veían y no existían**.

Y la bandera `escriturasBloqueadas`, que se escribía en cuatro lugares y no se
leía en ninguno, resultó **redundante**: `puedeEscribir()` ya re-decide en cada
llamada, así que si una escritura entra ahora entra, y si el usuario libera
espacio entra en la siguiente. No se le inventó un uso: queda para borrar.

**La regla:** una bandera sin lectores no es una bandera sin usar: es una
intención que nadie terminó. Antes de darle un uso artificial, preguntarse si el
sistema **ya hace lo que la bandera prometía por otro camino**. Si ya lo hace,
la bandera sobra.

## Medir en el momento justo: el peor error es medir la animación (2026-10-01)

Tres veces en una sesión leí mal el estado del menú en Chrome, y las tres por
lo mismo: medí **durante** la transición de 350 ms, no después.

La primera vez el menú aparecía en `x: -260` con `visibility: hidden` y
concluí que las reglas de `.visible` no estaban ganando. Iba a cambiar CSS que
estaba bien. La segunda, el botón se había movido al revés. La tercera, leí un
estado que en realidad era el contrario: el menú ya estaba abierto de la prueba
anterior y mi clic lo había cerrado.

**La regla:** un valor medido en un momento del mundo es un hecho sobre ese
momento, no sobre el estado final. Después de una acción con animación, hay que
**esperar a que termine** antes de mirar. Y si un resultado parece un defecto
grande, la primera pregunta es si uno miró en el momento justo.

Cómo hacerlo sin esperar a ciegas: en el código de la página, no en el de la
consola. Un `await new Promise(r => setTimeout(r, 700))` **dentro** de la
función que se manda a evaluar devuelve el estado ya asentado. Y el dato de
apoyo es que dos llamadas seguidas den valores **distintos**: si dan lo mismo,
o ya se asentó o nunca arrancó.

## A veces una decisión pendiente se resuelve con una medición, no con un cambio (2026-10-01)

El plan dejó pendiente: "el desplazamiento del panel con muchas materias. Se
decide al implementarla, mirando cómo se comporta en Chrome. Si no hay dónde
desplazarse, es un defecto de T3 y se arregla en T3."

Se midió, con 40 materias: 537 px visibles, 3144 px de contenido,
`overflow-y: auto`, se llega a la última desplazando. El `overflow-y` **ya
estaba** en la hoja de estilos desde antes. No había ningún defecto, y el
trabajo era confirmar que no lo había.

**La regla:** una decisión que espera una medición no siempre termina en un
cambio. A veces termina en "ya estaba bien", y esa respuesta vale tanto como la
otra. Anotar un pendiente no es comprometer a cambiarlo: es comprometer a
**mirarlo**.

## Una decisión puede ser vieja y parecer nueva (2026-10-02)

Pregunté por qué el mapa no mostraba la sesión de Pomodoro en curso, y dije que
era una decisión pendiente. Fue a buscar dónde se TOMABA la decisión, y ya
estaba tomada: **CP-1 en `specs/001-heat-map/spec.md`**, con sus cuatro opciones
escritas y un archivo entero, `resolucion-cp.md`, con el procedimiento de cierre.

Llevaba tiempo esperando. No era una decisión nueva: era una vieja sin cerrar.

Lo que pasó es que T6 borró `consolidar()`, que era la única función que
miraba la sección abierta, y con ella se fue el rastro de por qué el
comportamiento había cambiado. Cuando se borra el código muerto, **se van
también las decisiones que estaban escondidas adentro**.

**La regla:** cuando algo "no funciona como debería", antes de tratarlo como
decisión nueva, buscá si ya hay un caso pendiente que lo cubra. El proyecto ya
tiene el lugar para anotarlas, y a veces hace meses que están ahí esperando.

## Dos specs que se dicen cosas distintas es peor que una decisión mala (2026-10-02)

Creí que el umbral del almacenamiento contradecía la especificación. Lo leí y
no era así: **el código hacía exactamente lo que dice RF-11 de la spec 001**,
que bloquea al 95 % y avisa.

Lo que estaba mal era **una tabla que yo había escrito en la spec 004**, sin
releer la original. Y la había escrito con toda seguridad.

Una especificación nueva reescribe cosas viejas sin mirar las viejas. Dos
documentos del mismo proyecto diciéndose cosas distintas es peor que tener la
decisión equivocada: la decisión equivocada se corrige; el conflicto hay que
encontrarlo primero.

**La regla:** cuando escribas una tabla de comportamiento que ya existía,
**empezá copiándola de la spec vieja**, y recién después mejorala. Y si las dos
specs discrepan, la respuesta no es elegir una: es arreglar el texto para que
digan lo mismo.

## Una red que se apaga en silencio es peor que no tenerla (2026-10-02)

`test/visor.test.js` comprueba que el nombre del documento nunca entre en un
`innerHTML`. Ese nombre es un dato del usuario, y un archivo llamado
`<script>` lo ejecutaría. Es la red más importante del proyecto.

Leía **`js/app.js`**, y solo ese archivo. Nadie lo notó durante meses, porque
nada se movía.

El día que se mueve el panel de "a este archivo le falta el contenido" —que
lleva ese nombre—, la operación natural es: copiar el bloque al archivo nuevo,
borrar el original, correr los tests. **Y pasan en verde.** La red sigue
mirando `app.js`, que ya no tiene el código, y sigue diciendo que todo está bien.

El XSS habría vuelto, y nadie lo habría notado hasta que un archivo con nombre
malicioso lo ejecutara en el navegador de alguien.

**La regla:** un control que vigila **una ubicación** se apaga en silencio el día
que el código se muda. Dos arreglos, y hay que hacer los dos:

**Que vigile una lista de archivos, no uno.** Y la lista declara los archivos
futuros, aunque todavía no existan: el día que se creen, la red ya los mira.

**Probar la red inyectando lo que debe detectar.** Acá se escribió un XSS real
en un archivo nuevo y la red falló en rojo diciendo el archivo. Sin esa prueba,
"amplié la red a tres archivos" es una afirmación sin respaldo: nadie sabe si la
red realmente mira los archivos nuevos.

Y un caso aparte: `responsive-calendario.test.js` no leía `app.js`, lo
**excluía** de la vigilancia, con un motivo escrito en un comentario. Una
exclusión sin motivo es peor que una lista incompleta, porque no falla nunca:
se limita a no mirar. Ahora hay un test que verifica que la excepción siga
teniendo razón, y que falla si `app.js` deja de medir.

**Y una cosa sobre el orden:** hacer esto **antes** de mover es lo contrario de
lo natural. Lo natural es mover y ver qué se rompió. Pero si la red no sigue
primero, el movimiento es a ciegas, y en el medio no hay forma de saber si algo
se rompió o si la red simplemente dejó de mirar.

## Las redes se prueban inyectando lo que deben detectar (2026-10-02)

Toda red de este proyecto se probó rompiendo algo a propósito: la de caracteres
raros, con caracteres raros; la del código muerto, con cuatro tipos de código
muerto; la del XSS, con un XSS real.

En los tres casos, la prueba importante es la misma y es la que más cuesta
hacer: **no probar la red en su estado normal**. El estado normal casi nunca
detecta nada, porque no hay nada que detectar. Y da verde, que se confunde con
"funciona".

La prueba real es: poner lo que la red busca, ver que falla, sacarlo, ver que
vuelve a verde. Las dos mitades.

## Un control de privacidad que no controla nada es peor que no tenerlo (2026-10-02)

RF-12 pedía "consultar cuadernos ajenos con consentimiento". El módulo estaba
escrito y testeado, sin un llamador. La tentación era cablearlo, y era
exactamente lo que no había que hacer.

Para cumplirlo hace falta saber **de quién** es cada cuaderno. Este proyecto no
tiene cuentas, ni identidades, ni servidor: es un cuaderno local, y en uno local
no hay cuaderno "ajeno". Si el consentimiento se guardara en el mismo cuaderno
al que protege, cualquiera podría firmarlo y leer lo que quisiera.

Eso no es una versión "mínima" del requisito. Es un simulacro que se puede
esquivar, y da una sensación de seguridad que no existe: el usuario confía en
algo que no protege, y es peor que saber que no hay nada.

**La regla:** antes de implementar un control de seguridad, preguntate contra
qué lo estás protegiendo. Si la respuesta es "nada", el control no va, por muy
escrito que esté el código. Y decilo por escrito, porque un módulo completo y
sin conectar **parece implementado**.

## Un control que siempre falla no es un control (2026-10-02)

`buscar-codigo-muerto.js` daba salida **1** desde el día que se escribió, porque
reportaba cuatro símbolos: tres de `consentimiento.js` —RF-12 en alcance pero
sin conectar— y `existeFecha`, conservada a propósito.

Ninguno era un olvido. Los cuatro eran **decisiones**. Pero la herramienta no
distinguía entre lo que hay que arreglar y lo que se decidió dejar, así que los
mezclaba con el mismo tono: cuatro cosas que borrar, urgente.

Y el problema de fondo era otro: **un control que siempre sale en rojo no es un
control.** La primera vez que dé rojo de verdad —que es la única que importa—
nadie lo va a mirar. Está entrenando al que lee a ignorar el rojo.

El arreglo fue una lista de excepciones, con el motivo escrito en la misma
línea del código. Tres cosas de eso:

**El motivo va en el código, no en el documento.** Una excepción escrita en un
`.md` termina borrada, porque en seis meses queda la lista y nadie recuerda
por qué se conservó. Y entonces la excepción vuelve a ser código muerto, sin que
nadie lo decida.

**La lista se arma con lo que la herramienta reportó, no de memoria.** Agregar
una excepción para tapar algo de lo que no estabas seguro convierte el control
en una pintura encima: ahora da verde, y nadie sabe qué está tapando.

**La lista se mantiene sola.** Si un símbolo deja de estar muerto —el día que se
conecte RF-12— la herramienta avisa que la excepción quedó vieja. No hay que
acordarse de sacarla, y la lista no se pudre en silencio.

### Y cómo se prueba un control que estaba mal

Tres pruebas, y la tercera fue la que importaba:

| Prueba | Resultado |
|--------|-----------|
| Inyectar una función muerta | Salida 1 y la nombra ✓ |
| Sacar una excepción de la lista | Pasa a ser pendiente, salida 1 ✓ |
| **Meter una excepción que no estaba** | Avisa que ya no aplica ✓ |

La tercera simula el día que RF-12 se conecte. Sin ella, el mecanismo de
"excepción vieja" podría no existir y nadie se enteraría, porque **nunca
ocurre solo**: el caso normal es que la lista esté bien.

**La regla:** un control que solo se probó en su estado normal no está probado.
Hay que provocarlo, y el estado normal casi nunca es el interesante.

**La regla:** un control que solo se probó en su estado normal no está probado.
Hay que provocarlo, y el estado normal casi nunca es el interesante.

## Buscar código muerto a ojo no funciona: hay que contar (2026-10-01)

Para T6 se escribió `herramientas/buscar-codigo-muerto.js`. No porque el
proyecto tenga la regla, sino porque la búsqueda a ojo **no encuentra** código
muerto: no rompe nada, no tira error, no hay ningún test rojo. La única señal
es que un símbolo aparezca una sola vez en todo el proyecto, y eso hay que
mirarlo en 30.000 líneas.

La herramienta clasifica en cuatro grupos, y la distinción importa: borrar una
función y borrar solo su exportación son operaciones de riesgo distinto.

| | Qué es | Qué se borra |
|---|--------|--------------|
| A | No la usa nadie, ni su propio módulo | La función entera |
| B | Declaración sin usar, no exportada | La declaración |
| C | Se le asigna y nunca se lee | La declaración y sus asignaciones |
| D | La usa su módulo, nadie la pide de afuera | Solo la línea del `API` |

Encontró **25 cosas** donde el plan había anotado 13, y dos de las del plan
estaban mal. La herramienta se usó como lista de candidatos y cada uno se
confirmó con una búsqueda a mano: **ella propone, una persona borra**.

### Y una herramienta que no se prueba no sirve

Se le inyectaron cuatro tipos de código muerto —función, constante, bandera
escrita-y-no-leída, y export sin consumidor— y tenía que verlos los cuatro.
Los vio. Después se restauró y dejó de verlos.

**Pero antes de eso tuvo cuatro bugs**, y cada uno tapaba justo lo que se
buscaba:

| El bug | Qué tapaba |
|-------|-----------|
| Contaba comentarios como uso | `escapeHtml` parecía viva por dos comentarios que explican el XSS |
| Confundía `...base` con `objeto.base` | `base` parecía sin usar, y se reparte en cada respuesta |
| `getElementById` con el mismo nombre contaba dos | `calendarioMapa` parecía usada por su propio `id` |
| **El último de un objeto sin coma final** | `estaOculto` y `DIAS_EN_LA_SEMANA` **no aparecían**, y son de los que había que borrar |

Ese último: en `{ a, b, c }` la `c` no lleva coma, y un patrón que exige coma
para encontrar el nombre se la salta. Falta exactamente el último.

**La regla:** una herramienta de análisis hay que probarla contra casos que uno
ya conoce, no contra lo que ella encuentra. Si nunca se la contradice con algo
que uno sabe que existe, no se sabe si calla porque no hay nada o porque no
mira. Y un falso negativo en una
herramienta de código muerto es peor que no tenerla: dice que no hay nada que
borrar mientras hay 400 líneas.

## El código muerto suele ser la copia testeada de una regla viva (2026-10-01)

Dos casos en T6, el mismo:

| Copia muerta, testeada | Original vivo, menos probado |
|---|---|
| `consolidar()` — 13 tests en 3 archivos | `minutosTotales()` — 5 tests |
| `resumenDeProblemas()` — 2 tests | `reconstruirAviso()` — 0 tests del texto |

En los dos, las reglas estaban fijadas contra la función que **nadie usaba**.
Si la que está viva se rompía, ningún test se enteraba.

Borrar la copia sin mirar es cambiar código muerto probado por código vivo
sin probar. Lo que se hizo: borrar la copia, y **mover sus tests a la viva**,
con un caso más cada una. Y en el caso de `reconstruirAviso()`, los textos
generados eran idénticos carácter por carácter: dos funciones para el mismo
cartel, que es exactamente como se desincronizan solas.

**La regla:** cuando borres algo que tiene tests, preguntate **qué reglas
estaban fijadas contra eso** y llevalas a la función que realmente se ejecuta.
Un test que ejercita código muerto es parte del código muerto, pero las reglas
que contiene no mueren con él: se mudan.


Abajo de 640 px el menú lateral es un cajón que sale de la pantalla. La regla
que lo trae de vuelta existía desde el principio:

```css
.menu-lateral.visible { transform: translateX(0); }
```

**Ningún código la usaba.** El botón solo alternaba `colapsado`, que en un cajón
fuera de pantalla no cambia nada visible. No había error en la consola, no había
ningún test en rojo. El menú era inalcanzable en un teléfono y el sistema
parecía entero.

**La regla:** una regla de CSS que ningún selector del proyecto produce es
código muerto, igual que una función que nadie llama. Es más difícil de ver
porque no rompe nada: no tira error, no aparece en la consola, no hay ningún
"undefined is not a function". Solo falta algo en pantalla y nadie sabe por qué.

Cómo se encuentra: buscar reglas cuyo selector lleva una clase o un id, y
preguntarse quién la pone. En este caso, `.visible` la ponía alguien. Nadie.

## Sacado de la vista no es lo mismo que sacado de la pantalla (2026-10-01)

El menú cerrado del teléfono estaba en `transform: translateX(-100%)`. Con eso
no se ve, pero **sigue en el recorrido del teclado y en el árbol de
accesibilidad**: con el menú cerrado, el `Tab` entraba al botón de "Añadir
Materia" y el lector de pantalla leía el árbol entero.

Se arregla con `visibility: hidden`, que sí lo saca de las dos cosas. El `<aside>`
además necesitaba `tabindex="-1"`, porque no es tabulable por su cuenta y
`focus()` no hacía nada.

**La regla:** "no se ve" y "no está" son cosas distintas, y el CSS tiene dos
propiedades para cada una. Al esconder algo para que moleste menos, preguntar
también por el teclado y por el lector de pantalla.

### Y animar `visibility` rompe el foco

`visibility` es discreta: entre el valor viejo y el nuevo no hay puntos
intermedios. Si está en una transición **con duración**, durante toda la
animación el valor sigue siendo el viejo. Y un elemento con `visibility: hidden`
**no puede recibir el foco**.

O sea que al abrir el menú, `menuLateral.focus()` no hacía nada: en ese
instante el elemento seguía oculto. Se comprobó en Chrome; ningún test de Node
lo podía ver.

El arreglo es el patrón conocido: **sin duración y con retardo al cerrar, sin
retardo al abrir.** Se conserva la animación de salida y el foco entra.

**La regla:** una transición de una propiedad discreta no arranca en el valor
nuevo. Si el estado nuevo depende de algo que solo existe "ya" —el foco—, hay
que sacarlo de la transición.

## Un helper que agarra la coincidencia equivocada es peor que no tener test (2026-10-01)

El helper que extraía un bloque `@media` usaba `indexOf`, que devuelve **la
primera** coincidencia. Hay **dos** bloques de `@media (max-width: 640px)`: uno
es del mapa de calor y otro el general.

El test de "el menú tiene que salir de la pantalla en pantallas angostas" falló
mirando el bloque del mapa de calor, que no menciona el menú. El mensaje decía
una cosa y la causa era otra.

Eso es peor que no tener el test: hace cambiar algo que no estaba roto, y el que
lo lee confía en un mensaje que no describe la causa.

**La regla:** cuando un test falla, leer el motivo y comprobar que el motivo sea
el que uno cree, antes de tocar nada. Y cuando un helper busque "el" bloque de
algo, preguntar si hay más de uno.

## Cuando no se sabe el ancho, que lo decida el CSS (2026-10-01)

El botón del menú hace lo mismo en un teléfono y en un escritorio, pero lo que
significa es distinto: en uno ancho pliega el panel, en uno angosto abre el
cajón.

La tentación era preguntar el ancho en JavaScript. La constitución lo prohíbe:
la geometría se resuelve en la hoja de estilos, y duplicar en el código una
decisión que el CSS ya tomó es exactamente cómo se desincronizan las dos.

La solución: **el clic pone las dos clases y se termina.** Abajo de 640 px la
hoja anula lo que una de ellas hace; arriba de 640 px la otra no tiene ninguna
regla y no molesta. Y la flecha del botón también la gira el CSS, al revés en
cada ancho.

El `title` no pudo ser preciso: con el mismo clic, decir "colapsar" o "abrir"
miente en uno de los dos anchos. Dice "mostrar u ocultar". El texto no puede
ser preciso; la flecha sí, porque el CSS sí sabe el ancho.

**La regla:** cuando el mismo gesto tenga dos significados según el contexto, no
preguntes el contexto. Dejá que el gesto sea el mismo y que cada contexto lea el
resultado a su manera. Si además hace falta **describir** la acción, esa
descripción no puede ser precisa: es preferible decir menos que prometer una
cosa y hacer otra.

## Un plan puede estar mal, y hay que revisarlo antes de codear (2026-10-01)

La spec 004 proponía, para el defecto de las estadísticas, **sacar la barra de
`#visor`** para que ningún `visor.innerHTML = ...` la borrara. Era el "arreglo de
raíz", y sonaba correcto.

Al ver el CSS se vio que la barra era `display: flex; justify-content: center`
**dentro del bloque de bienvenida**: no era una cabecera, era parte del cartel de
bienvenida. Sacarla de `#visor` la habría hecho visible **siempre**, incluso con
un documento abierto. Eso no es corregir un defecto: es cambiar el producto, y
nadie lo pidió.

El arreglo correcto era el otro: que la plantilla de `mostrarBienvenida()` vuelva
a traer su contenedor de estadísticas, re-apunte la variable y repinte.

**La regla:** "el arreglo más robusto" no siempre es el que corresponde. Antes de
elegir una opción, mirar **cómo se ve hoy la cosa** que se va a cambiar. La
palabra "raíz" a veces esconde un rediseño.

## Un `innerHTML` reescribe todo lo que tiene adentro (2026-10-01)

`visor.innerHTML = ...` **no reemplaza una parte**: borra todo lo que hubiera
adentro, incluidos los hijos que tu código ya tenía guardados en variables.

```javascript
const statsContainer = document.getElementById('statsContainer');
// ...
visor.innerHTML = '<div class="bienvenida">...</div>';   // statsContainer ya no está
actualizarStats();   // escribe en un nodo que no está en la página
```

Sin error. Sin excepción. `actualizarStats()` escribe cheerfully a un nodo
suelto, y la barra desaparece sin decir nada.

El arreglo tiene tres partes, y las tres importan:

1. El `let` en vez de `const`: el nodo viejo se destruye, hay que apuntar al nuevo.
2. La plantilla tiene que **traer** el contenedor, como lo trae `index.html`.
3. Buscar el nodo **antes** de pintar los números. Al revés se escribe en el viejo.

**La regla:** cuando guardás una referencia a un nodo del DOM, ese nodo puede
desaparecer en cualquier momento. Después de escribir un `innerHTML` que
reconstruye la zona, **volvé a buscarlo**. Y si puede no estar, `actualizarX()`
arranca con `if (!el) return;`.

Y el bloque de bienvenida quedó escrito en **dos** lugares, que es el precio de
esta solución. Se cubre con un test que compara las frases de los dos y falla si
divergen: si mañana alguien edita una, salta.

El análisis automático encontró **un** `ReferenceError` en `guardarDatos()`:
`LogicaCapacidad.debeRevertir(error)`, un identificador que no existe. Al
arreglarlo aparecieron dos más:

```javascript
constextra = porcentajeUmbral ? ...    // sin espacio: identificador VÁLIDO
```

`constextra` es un nombre de variable perfectamente sintáctico. `node --check`
acepta el archivo, la app carga, todo se ve bien. El `ReferenceError` saltea
**recién al usar `${extra}`**, y solo cuando el almacenamiento está lleno: un
camino que casi nadie recorre porque no falla nunca.

El tercero: `getItem` para la copia de seguridad estaba **fuera** del `try`.

**La regla:** un error puede tapar a otros. Arreglar el primero no es terminar:
hay que volver a medir y mirar qué aparece debajo, porque lo que estaba ahí
siempre estuvo.

## `node --check` no alcanza (2026-10-01)

`constextra` pasó la comprobación de sintaxis sin quejarse. No es un problema de
herramientas: **es código JavaScript válido**. Solo falla cuando se ejecuta, y en
un camino que la app normalmente no toma.

Los tests de Node tampoco lo detectaron: `guardarDatos()` vive dentro del IIFE de
`app.js` y no había forma de llamarla. Solo se encontró **rompiendo
`localStorage.setItem` desde Chrome**.

**La regla:** `node --check` dice que el archivo se puede *parsear*, no que
funcione. Un error de runtime solo aparece ejecutando el camino exacto, y un
camino que casi nadie recorre es un camino que nadie probó.

Por eso ahora `guardarDatos()` y `guardarRevirtiendoSiFalla()` están en la API
pública: sin eso no había forma de probarlas.

## No escribir "por las dudas" (2026-10-01)

Si `localStorage.getItem` falla, ¿se escribe igual o no? Lo fácil de responder es
"si no sé qué había, escribo igual".

Es exactamente lo peligroso. El camino de reversión usa `null` para significar
*"no había datos guardados"*. Si `getItem` falló y se pone `null` de todos modos,
un fallo de escritura posterior ejecutaría `removeItem` — **borrando lo que el
usuario tenía**.

Con lo que nunca se pierde nada: **si no se puede leer, no se escribe.** Hay un
test que lo fija, en `test/navegador.test.js`.

**La regla:** ante la duda, el camino que conserva datos es el que no hace nada.
Un valor por defecto que significa "no sé" no puede compartirse con un valor por
defecto que significa "no hay".

`specs/003-refactor-app/task.md` tenía **65 líneas** con los acentos rotos:
`menú` estaba como `menÃº`, `—` como `â€”`.

Y el chequeo que yo llevaba usando toda la sesión decía **0**:

```powershell
([regex]::Matches($t,'[\uFFFD]')).Count   # → 0
```

Da 0 porque el mojibake **no es `U+FFFD`**. `U+FFFD` es el carácter de
reemplazo que pone un decodificador cuando los bytes no son válidos. El mojibake
es otra cosa: son **caracteres válidos** (`Ã`, `â`, `€`) que son la
interpretación equivocada de bytes UTF-8 leídos como Windows-1252. Son texto
UTF-8 perfectamente válido. Por eso ningún chequeo de "bytes rotos" los ve.

### Cómo se detecta

```powershell
# Mojibake: 'Ã' o 'â' seguidos de un byte entre U+0080 y U+00BF
$patron = 'Ã[\x80-\xBF]|â€|Â[\x80-\xBF]'
```

Y cómo se repara, línea por línea, solo las que fallen:

```powershell
$cp1252 = [Text.Encoding]::GetEncoding(1252)
$bytes = $cp1252.GetBytes($linea)
$reparada = [Text.Encoding]::UTF8.GetString($bytes)
if ($reparada -notmatch $patron) { $lineas[$i] = $reparada }
```

**Línea por línea y solo si el resultado queda limpio.** Aplicarlo al archivo
entero destruiría las secciones que estaban bien.

### La lección

Un chequeo que da 0 no dice "todo está bien": dice "no encontré **esto**". Vale
preguntarse qué más podría estar roto que el chequeo no cubre.

Y: un archivo puede llevar semanas roto sin que nadie lo note, porque se lee
"lo bastante bien" — `menÃº` todavía se entiende. Vale abrir los `.md` en un
editor de verdad, no solo contarlos.

## La red tampoco sustituye a leer el código (2026-10-01)

`construirArbol()` pasó de 162 a **170 líneas**. El refactor no la achicó.

Lo que se movió fueron las *decisiones* —qué nodos, qué íconos, qué botones—
a un archivo puro con 26 tests. Lo que quedó dentro son `appendChild` y
`addEventListener`, que son imperativos por naturaleza y no tienen a dónde ir.

**No todas las funciones largas están mal partidas por la mitad.** Esta tenía
dos responsabilidades (decidir y dibujar) pero la grande era el dibujo. Separar
la pequeña no la hizo más corta: la hizo más fácil de probar.

## Un test que no falla cuando tiene que fallar es peor que no tenerlo (2026-10-02)

T3 de la 006. Los tests del aviso de almacenamiento se escribieron, pasaron, y
**una prueba de la red no saltó**.

Se rompió a propósito el camino de escritura al guardar, volviéndolo a usar el
aviso con porcentaje, que es el defecto original. Los 15 tests dieron verde.

La aserción miraba la frase *"se pasó el umbral"*. El defecto real de ese camino
no era la frase: era el **número**. Con el camino roto, el motivo era `'espacio'`,
y el mensaje decía *"la operación no entra"* — sin mencionar el umbral. La
aserción pasaba porque miraba otra cosa.

Agregado el test que faltaba, repetida la prueba: ahora **1 falla**.

> **Romper el código a propósito y ver qué tests se quejan es el único modo de
> saber si la red está puesta.** Si al romper el defecto original no falla nada,
> el test no estaba mirando el defecto. Estaba mirando otra cosa y se llamaba
> igual.

Salió con la red de `sin-cubrir.test.js`, pero aplica a toda aserción. La
diferencia entre un test que comprueba y uno que acompaña: el segundo pasa
siempre, y da la misma confianza.

## Un número que no explica nada es peor que ningún número (2026-10-02)

El aviso decía *"El almacenamiento del navegador está casi lleno (0 % de 95 %)"*.

El 0 % era **real y correcto**: `puedeEscribir()` se corre antes de escribir y
dio bien —si no, no se habría llegado a escribir—. Lo que falló fue el
`setItem`. El número describe el estado previo, no el fallo.

Junto a *"casi lleno"* se vuelve un contrasentido, y lo peor no es que sea
confuso: es que hace dudar de si la app está mal.

La regla que salió: **cada camino dice lo que sabe**. Un mensaje para cuatro
situaciones que no se parecen tiene que mentir en por lo menos una.

Una cuarta tenía un motivo que el mensaje ni mencionaba —`'lectura'`— y que salía
traducido como *"se pasó el umbral crítico"*. El almacenamiento no estaba lleno:
no respondía. Mandar a exportar por un problema de lectura hace que el usuario
gaste trabajo al pedo.

## El arnés de prueba también hay que probarlo (2026-10-02)

Para probar el texto del aviso hubo que cargar `app.js` en Node, que no se puede
pedir con `require`: toca `document` y aborta. El navegador falso estaba
**enterrado dentro de `test/navegador.test.js`** y no había forma de llegar a él
desde otro archivo.

Se extrajo a `test/dom-falso.js`. Copiarlo habría sido más rápido y habría sido
la mala: dos DOM falsos se desincronizan, y el que se queda viejo es el que nadie
recuerda actualizar.

La primera versión tenía `window` como un objeto aparte del ámbito global. Los
tests de `navegador.test.js` seguían en verde —porque ya no usaban ese módulo— y
el nuevo fallaba con *"Cannot read properties of undefined"*.

> **Un DOM falso que no funciona es peor que no tener DOM falso.** No falla donde
> está el defecto: falla donde se lo usa, y el mensaje apunta a otro lado. En el
> navegador `window` **es** el ámbito global, no un objeto al lado.

Y `node --test` corre todo `.js` dentro de `test/`, no solo los `*.test.js`. O
sea: `dom-falso.js` contaba como un test de la suite **sin tener ninguno**. En vez
de aceptar el número fantasma, se le escribieron 4 tests.

Ese es el motivo real: si el arnés dejara de cargar la app —porque `app.js`
empiece a usar un método del DOM que el mock no tiene— los tests que lo usan **no
fallarían: no correrían nada**. El error aparecería como un test que pasa sin
comprobar nada.

## Una lista escrita a mano se queda vieja sola, y el test que la mira no se entera (2026-10-02)

T4 de la 006. Agregar un móduloobligó a actualizar la lista de scripts en
`test/dom-falso.js` y la de globales en `test/navegador.test.js`.

La primera se actualizó sola, porque el test compara contra `index.html` y
falla con un mensaje que dice las dos cuentas.

La segunda **no podía**: el test recorre una lista escrita a mano y pregunta si
cada global existe. Si un módulo nuevo publica `window.CosaLogica` y nadie lo
agrega a la lista, el test **pasa igual**: no sabe que ese global existe.

El hueco no es que falte un global, es que sobre uno. Para eso hace falta el test
del revés:

```javascript
test('ningún script publica un global que no esté en la lista', () => {
    // Lee del CÓDIGO qué globales publica cada archivo, y exige que todos
    // estén en la lista.
});
```

> **Una lista escrita a mano necesita dos redes: una que diga "faltan" y otra que
> diga "sobran".** Con la primera sola, agregar sin querer pasa. Con la segunda
> sola, borrar sin querer pasa.

**Y encontró uno que faltaba:** `CuadernoVirtual`. Muchos tests lo leían, pero
nunca estuvo en la lista. Lo que un test *hace* y lo que una lista *vigila* no es
lo mismo.

## La spec puede pedir funciones que no existen (2026-10-02)

T4 pedía mover `esMesAnioValidos`, `nuevaAnotacion`, `editarAnotacion` y
`quitarAnotacion`. **Ninguna existía con ese nombre.**

Dos eran funciones y dos no: eran **líneas sueltas dentro de funciones que
dibujan**.

```javascript
if (mes >= 1 && mes <= 12 && anio >= 2020 && anio <= 2100) { ... }   // inline
calendario.anotaciones[fecha].push({ id, tipo, descripcion });       // inline
```

Por eso no tenían tests, y por eso no se podían tener. No es que faltara
escribirlos: es que **una línea que dice qué meses existen, escondida en una
función que abre un `alert`, no se prueba sin un navegador**.

Cuando la spec y el código no coinciden, el código manda y la spec se corrige.
Lo que hay que decir es qué cambió, no hacer que la spec mande.

## Al mover, aparece un detalle que no era un defecto (2026-10-02)

Al mover la regla de agregar, la lista del día pasó a asignarse **siempre**:

```javascript
calendario.anotaciones[fecha] = resultado.lista;   // antes de saber si se agregó
```

Eso abría un día vacío sin escribir nada y creaba una lista vacía, que después
se guardaba. El código viejo no lo hacía.

No es un error del código anterior: es un error **del movimiento**. Por eso la
comparación tiene que ser contra lo que hacía el código anterior con los mismos
datos, y no contra lo que debería hacer.

> **Mover y corregir son dos trabajos.** Si los hacés juntos, no se puede
> demostrar que el movimiento no cambió nada.

## Un test que no encuentra lo que busca también pasa (2026-10-02)

Borré el `alert('Máximo 3 anotaciones por día')`, que era imposible de ver: el
único camino para guardar es el clic del botón, y con tres anotaciones el botón
ya está deshabilitado.

Escribí el test que fija que no vuelva:

```javascript
assert.ok(!/Máximo\s+\d+\s+anotaciones por día/.test(codigo));
```

**Pasó en verde, con el cartel todavía escrito.** El código real es:

```javascript
alert('Máximo ' + AnotacionesLogica.MAXIMO_ANOTACIONES + ' anotaciones por día');
```

El `\d+` no matchea nada: entre "Máximo" y "anotaciones" no hay ningún dígito,
hay una expresión. El patrón **no podía** encontrar nada.

> **Un test que no falla cuando tiene que fallar es peor que uno que no
> encuentra.** El que no encuentra parece que la red está puesta. El que falla
> por otra cosa al menos delata que hay algo.

Are two ways to catch it, and the second one is the general fix:

| | |
|---|---|
| Buscar la frase literal, no un patrón con supuestos | Arregla **este** caso |
| Probar el patrón contra el texto que se va a borrar | Arregla **todos** los que vengan |

```javascript
test('el patrón tiene que encontrar el texto que se borró', () => {
    assert.match(elQueHabia, CARTEL_IMPOSIBLE,
        'si no lo encuentra, el test de arriba pasa siempre');
});
```

## El arnés también miente, y en silencio (2026-10-02)

Para poder probar el comportamiento del calendario hizo falta arreglar
`test/dom-falso.js`. **Tenía dos bugs que no daban error: bajaban la cantidad de cosas.**

**`getElementById` devolvía un elemento nuevo en cada llamada.** `app.js` guarda
`btnGuardarAnotacion` al arrancar; si el test lo busca después recibe **otro
objeto**. Lo que la app cambió no se veía, y el resultado era `false` siempre,
que es un valor plausible.

**`classList.add` reemplazaba en vez de sumar.** Llevaba un `Set` propio que
empezaba vacío, así que:

```javascript
celda.className = 'celda-dia';
celda.classList.add('hoy');        // className queda 'hoy'
```

La celda dejaba de matchear `.celda-dia`. **La rejilla tenía 32 celdas en vez de
34**, y las dos que faltaban eran justo las que tenían clases agregadas: el día
de hoy y el día con anotaciones. Los días que nadie marcaba aparecían.

> **Un arnés que miente hace que los tests midan otra cosa.** Y no siempre da
> error: a veces da *menos*, que es un resultado plausible y no se cuestiona.

El primero estaba en la versión que escribí ayer. Por eso `dom-falso.test.js`
existe: ahora los dos tienen test, y se comprueban con `crearElemento` a mano.

## Un comentario que cita el código borrado rompe el test que verifica el borrado (2026-10-02)

Explicar el cambio en el código es lo correcto. Pero el comentario decía:

```javascript
// No hay ningún cartel. Antes había uno:
//     alert('Máximo 3 anotaciones por día');
```

Y el test buscaba esa frase en el archivo entero. **Falló por su propia
documentación.**

La solución no es no documentar: es que la búsqueda ignore los comentarios, que
es lo que ya hace `herramientas/buscar-codigo-muerto.js`. Un comentario no es
código; si la búsqueda cuenta lo que está escrito en prosa, no está contando
código.

## Un dato del usuario puede elegir nombres de clase (2026-10-02)

En el calendario, el tipo de una anotación iba crudo al `className`. **En dos
lugares**, no en uno:

```javascript
dot.className  = `dot dot-${a.tipo}`;                    // el punto de la rejilla
item.className = `anotacion-item ${anotacion.tipo}`;    // el ítem de la lista
```

El `tipo` sale de un `<select>`, así que desde la interfaz es uno de tres. Pero
puede venir de un **respaldo importado**, y ahí es lo que quiera el archivo.

Con `tipo: "nota urgente"`, la primera línea produce:

```
class="dot dot-nota urgente"
```

**Son tres clases, no dos.** El dato pasó a elegir nombres de clase en un
elemento del DOM.

No es XSS —`className` no se parsea como HTML, no gana atributos ni ejecuta
guiones—, y ahí está la trampa: **"no es XSS" hace que parezca que no importa.**
El principio 3 dice que un dato del usuario al DOM va por `textContent`, y este
no iba.

### La frontera, y por qué está donde está

Se agregó `claseDeTipo()` a `js/logica/anotaciones.js`:

```javascript
function claseDeTipo(tipo) {
    return esTipoValido(tipo) ? tipo : SIN_TIPO;
}
```

Es lo único que se interpola. Con un tipo desconocido sale la palabra fija
`sin-tipo`, que **no viene del dato**.

Se validó en el punto donde se dibuja, no al importar. La razón: el
`localStorage` también se puede editar a mano, y una versión vieja de la app
podía haber guardado tipos que hoy no existen. **Validar en la frontera, no en
la puerta**: la puerta se puede saltar.

### Los datos se muestran, no se esconden

Con un tipo desconocido la anotación **sigue en la lista**, con su texto, y
cuenta para el máximo. Lo que cambia es el color: gris `#6b7280` en vez de
verde.

Y hizo falta una regla de CSS para eso:

```css
.dot-sin-tipo { background: #6b7280; }
```

Sin ella el punto queda sin fondo: **invisible**. O sea, el arreglo de seguridad
habría hecho desaparecer anotaciones de la vista, que es peor que el defecto.

> **Filtrar el dato no puede hacerlo invisible.** Si lo que no se reconoce no
> tiene un estado visible, se está borrando de la vista lo que el usuario tiene.

### Los tipos estaban escritos en tres lugares

El `<select>` de `index.html` ofrece tres `<option>`. `css/styles.css` tiene una
regla por tipo. `app.js` comparaba contra tres literales. Los tres coincidían, y
coincidirían mañana solo si nadie se olvida de los tres.

Ninguno decía cuál era el conjunto. Ahora `TIPOS_ANOTACION` está congelado en
`anotaciones.js`, con `Object.freeze`, y un test que falla si le empujan un tipo
nuevo.

## Medir en Chrome: el nodo que tenés puede ya no estar en la página (2026-10-02)

Dos trampas del mismo día, que parecían "la app está rota":

**La primera: el panel que estabas mirando estaba oculto.** El modal abre en
vista mapa, así que `.calendario-grid` tiene `display: none` y las celdas del
calendario existen en el DOM pero no se ven. La captura mostraba las **28** celdas
del mapa de calor, no las **34** del calendario. Los tests de Node tampoco lo
venen: leen el DOM, y el DOM estaba bien.

**La segunda: después del clic, el nodo dejó de estar.** `seleccionarDia()`
llama a `generarCalendario()`, que hace `calendarioGrid.innerHTML = ''` y
**reconstruye la rejilla entera**. El elemento que yo tenía en la variable quedó
prendido de un árbol que ya no está en el documento, y
`getBoundingClientRect()` devuelve `0x0`.

El orden correcto es: hacer clic, **después** volver a buscar el nodo.

> **Un `0x0` no siempre es que el elemento no se pinta.** Puede estar desprendido.
> Antes de cambiar código para un cero, mirá si el nodo sigue en el documento:
> `document.contains(nodo)`.

## El arnés: tres bugs que no daban error (2026-10-02)

Para poder probar el comportamiento del calendario hubo que arreglar
`test/dom-falso.js`. **Los tres bajaban la cantidad de cosas en vez de romper.**

| El bug | Qué pasaba | Cómo se notó |
|--------|-----------|--------------|
| `getElementById` devolvía un elemento nuevo cada vez | La app guarda el botón al arrancar; el test recibía **otro objeto** | El resultado era `false` siempre, que es plausible |
| `classList.add` **reemplazaba** en vez de sumar | `className = 'celda-dia'` + `add('hoy')` dejaba `'hoy'` | La rejilla tenía **32** celdas en vez de 34 |
| `innerHTML = ''` no borraba los hijos | `generarCalendario()` limpiaba sin limpiar: cada llamada sumaba | Con el calendario navegado había **62** celdas en vez de 31 |

Los dos últimos tienen la misma forma: el elemento seguía en el DOM, con su
texto, y todo parecía bien. Lo que faltaba eran **elementos**, y un test que
mide una cantidad no se pregunta de dónde salió.

> **Un arnés que miente hace que los tests midan otra cosa.** Y cuando lo que
> falsea es una cantidad, no hay error posible: el número es plausible.

Ahora los tres tienen test en `dom-falso.test.js`, y se comprueban con
`crearElemento()` a mano, sin cargar la app entera.

## Un valor inventado en un test es un test que va a fallar por la razón equivocada (2026-10-02)

Escribí que marzo de 2020 tenía **32** celdas. Falló.

| Mes | 1º día | Huecos | Días | Total |
|-----|--------|--------|------|-------|
| Octubre de 2026 | jueves | 3 | 31 | **34** |
| Marzo de 2020 | domingo | 6 | 31 | **37** |
| Febrero de 2024 | jueves | 3 | **29** | **32** |

Lo saqué de octubre, que da 32, sin mirar que marzo de 2020 empieza en domingo.

La regla de `AGENTS.md` dice: *"cuando un test falla contra un valor que uno acaba
de inventar, lo que está equivocado es el valor esperado, no el código"*. Esta
vez el test **acertaba** sobre el defecto —el arnés duplicaba las celdas— y
fallaba por dos razones a la vez. Por eso la corrección no fue poner 37: fue
**medir los tres meses, comprobar la aritmética a mano, y recién entonces
escribir el número**, con la explicación al lado para que el próximo no lo
adivine otra vez.

## Cuando un test que debe fallar pasa, el patrón está mal (2026-10-02)

Escribí para forbidding que la clave de fecha no se armara a mano:

```javascript
/Máximo\s+\d+\s+anotaciones por día/     // ✗
```

**Pasó en verde con el texto todavía escrito.** El código era:

```javascript
alert('Máximo ' + AnotacionesLogica.MAXIMO_ANOTACIONES + ' anotaciones por día');
```

El `\d+` no matchea nada: entre "Máximo" y "anotaciones" no hay un dígito, hay
una expresión.

Arreglé el caso con la frase literal. El arreglo que sirve para todos es el
segundo test:

```javascript
test('el patrón tiene que encontrar el texto que se va a borrar', () => {
    assert.match(elQueHabia, EL_PATRON, '...');
});
```

> **Un test que no encuentra lo que busca también pasa**, y es peor que uno que
> falla: el que falla delata que hay algo; el que no encuentra parece que la red
> está puesta.

## Un comentario que cita el código borrado rompe el test que verifica el borrado (2026-10-02)

Explicar el cambio en el código es lo correcto. Pero el comentario decía:

```javascript
// No hay ningún cartel. Antes había uno:
//     alert('Máximo 3 anotaciones por día');
```

Y el test buscaba esa frase en el archivo entero. **Falló por su propia
documentación.**

La solución no es no documentar: es que la búsqueda **ignore los comentarios**,
igual que ya hace `herramientas/buscar-codigo-muerto.js`. Un comentario no es
código.

## Notas
- Los archivos se guardan automáticamente en localStorage del navegador
- El modo kiosko requiere Chrome
- El acceso directo está en: C:\Users\manun\OneDrive\Escritorio\Cuaderno Virtual.lnk
- El widget Pomodoro está centrado en la parte superior
- El botón de modo lectura está en right: 120px
- El menú de configuración (exportar/importar) está en la esquina superior derecha
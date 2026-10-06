# AGENTS.md — Cuaderno Virtual

> **Fuente de verdad:** [`docs/constitucion.md`](docs/constitucion.md) — los 6 principios y por qué existen.
> **Bitácora de lo que se rompió y qué se aprendió:** [`MEMORY.md`](MEMORY.md).
> Este archivo es la referencia **operativa**: qué hay, qué comandos existen y qué reglas rompen la app.
> Todo en español, UTF-8 sin BOM (Principio 6).

## Qué es

App vanilla (HTML/CSS/JS, sin build) para organizar apuntes por materias y ver HTML/PDF/Word
en un visor, con calendario de anotaciones, mapa de calor de estudio y Pomodoro.
Todo vive en el navegador, sin red y sin cuentas. Desde la spec 008 los datos van al almacén
del navegador (`IndexedDB`), que separa cada dato; `localStorage` queda solo para leer lo viejo
y migrarlo, y **nunca se borra**.

## Estado del repo

- **Git:** rama `master` **sin ningún commit**: todo está sin trackear. No hay `.gitignore`,
  ni CI, ni hooks. No esperés historial ni diffs previos; los comandos de verificación de más
  abajo son la única puerta de calidad.
- **Cero dependencias:** no hay `package.json` ni `node_modules`, y no se agregan (Principio 1).
  Node se usa solo como runner (`node --test`) y para las sondas de `herramientas/`.
- **Suite:** 493 tests al momento de escribir esto. Los números escritos a mano en los
  documentos se desincronizan solos: **`docs/constitucion.md` y estas líneas se corrigen a
  mano**, y hay que hacerlo cuando cambia el conteo. No hay ningún test que lo vigile,
  porque una cifra escrita a mano no es una regla: es un dato.
- **Archivos que NO son de la app.** No los borres, no los "ordenes", no los muevas:
  - `New Project/` → apuntes del curso de OpenCode.
  - `.npmrc` (`allow-scripts=opencode-ai`), `skills-lock.json`, `.agents/` → instalación de skills.
  - `.opencode/` → configuración y flujo de trabajo (sección siguiente).

## Estructura

```
index.html              Único HTML. <script> clásicos, NUNCA type="module".
css/styles.css          Tema oscuro + responsivo (640 px = teléfono)
js/
  app.js                2533 líneas: dibujo y conexión de eventos, más lo que quedó.
                         Publica window.CuadernoVirtual.
  inicio-calendario.js  Conecta el mapa de calor con el modal (RF-7)
  logica/               PURO: sin DOM, sin reloj del sistema, sin almacenamiento
  datos/secciones.js    Estado de las secciones de estudio
  datos/almacenamiento.js  Habla con el almacén del navegador: abre, migra, lee y escribe.
                         NO es lo mismo que logica/almacenamiento.js, y ese ya **no
                         existe** (spec 008, T10).
  interfaz/             Solo dibuja, no calcula
herramientas/           Sondas que abren Chrome. Va acá y NO en test/ (ver trampas)
test/                   *.test.js + dom-falso.js (arnés compartido) + datos-un-anio.json
specs/NNN-nombre/       spec.md (QUÉ) · plan.md (CÓMO) · task.md (T1..Tn) · resolucion-cp.md
docs/constitucion.md    Los 6 principios
```

**Orden de carga en `index.html`** (está comentado ahí, y el orden importa):
`js/logica/*` y `js/datos/*` **antes** de `app.js` · `logica/layout.js` antes de
`interfaz/visibilidad.js` (la lógica decide, la interfaz aplica) · `interfaz/mapa-calor.js`
antes de `inicio-calendario.js` · los CDN (`mammoth`, `pdf.js`) en `<head>`.

## El flujo de trabajo real está en `.opencode/`

Antes de abrir `app.js`, mirá esto: hay un Spec-Driven Development configurado.

| Qué | Dónde |
|-----|-------|
| Skill del flujo | `.opencode/skills/sdd/SKILL.md` |
| Agentes | `.opencode/agents/`: `cordinator` (**primary**, sin permisos de edición ni de shell: solo reparte), `planner` (solo escribe dentro de `specs/`), `implementer` (UNA tarea, tests primero), `reviewer` (no modifica nada; arranca siempre con `VEREDICTO: APROBADO` o `VEREDICTO: CAMBIOS NECESARIOS`) |
| Comandos | `/sdd-constitucion` `/sdd-spec` `/sdd-clarify` `/sdd-plan` `/sdd-task` `/sdd-implement` `/validate` `/sdd-change` `/sdd-status` `/feature` |

**Flujo:** Constitución → Spec → Clarificación → Plan → Tareas → Implementación → Validación → Cambio.

- **Nunca se pasa de fase sin aprobación explícita del usuario.**
- La spec manda: si algo no está en la spec, no se implementa; si falta una decisión, se para y se pregunta.
- Un cambio de requisito va **primero** a `spec.md`, después a `plan.md`/`task.md`, y al final al código.
- Una tarea por llamada, tests en rojo primero, `node --test` en verde, marcar la tarea y **parar**.
- Cambio chico que no merece una spec → `/feature`.

### Nombres exactos (se rompieron una vez, ya están corregidos)

- **El archivo de tareas es `specs/NNN/task.md`, en singular.** Los cuatro agentes, la skill y
  los comandos tienen que decir eso. Cualquier `tasks.md` que aparezca es un error.
- **La constitución es `docs/constitucion.md`.** Con "ción" y una sola palabra.
- **Los agentes se llaman `planner`, `implementer` y `reviewer`.** Si un comando declara
  `agent: plan` o `agent: build`, está roto: no existen. El mapeo correcto es
  `planner` para redactar y consultar, `implementer` para implementar,
  `reviewer` para `/validate` (no arregla nada: solo da veredicto).
- **Todos los comandos del flujo usan el prefijo `sdd-` (con guion).** El prefijo `ssd-` no
  existe: hasta el 2026-10-04 cinco archivos se llamaban `ssd-*.md`, y por lo tanto los comandos
  se invocaban con `ssd-`, mientras este documento anunciaba `sdd-`. Referencias a `ssd-` en
  cualquier lado son un error, salvo dentro de esta línea.
- El archivo del coordinador se llama `cordinator.md` (sin la "o"). No lo busques por nombre:
  se carga por su `mode: primary`.
- Cuando toques `.opencode/`, revisá que **todo nombre de archivo que mencionen** exista de verdad.
  Una referencia a un archivo inexistente no da error: el agente simplemente no lo lee y sigue
  como si no existiera.

## Reglas que rompen la app si no se respetan

### 1 · Cada `<script>` va en un IIFE y exporta de dos formas

En Node cada archivo es un módulo con su propio ámbito; en el navegador **todos los `<script>`
comparten el global**, así que dos `const API` sueltos rompen la página entera con
`Identifier 'API' has already been declared`.

```javascript
(function () {
    const API = { /* ... */ };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;          // Node (tests)
    } else {
        window.MapaCalorLogica = API;  // navegador
    }
})();
```

Quien lo consume usa el mismo puente:

```javascript
const Logica = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./logica/mapa-calor.js')
    : window.MapaCalorLogica;
```

**Prohibido `<script type="module">`**: el proyecto se abre con `file://` y Chrome bloquea los
módulos ES por CORS ahí.

### 2 · La API pública: cuando un archivo necesita a otro

El IIFE esconde sus funciones. Si un archivo necesita algo de otro, eso tiene que **salir por la
API pública** del archivo que lo tiene (en `app.js`, `const API = { ... }` antes del `})();`).
`window.CuadernoVirtual` hoy publica 5 funciones; varias existen solo para que los tests
lleguen a caminos que si no serían imposibles de probar (fallos de almacenamiento, etc.).

**Ya rompió la app una vez:** al envolver `app.js` en un IIFE, `minutosDeEstudioPorDia()` dejó de
ser global, `inicio-calendario.js` siguió llamándola y el mapa de calor quedó **en blanco** — con
los tests en verde y sin errores en la consola. Lo detectó abrir Chrome, no `node --test`.
Por eso existe `test/navegador.test.js`.

### 3 · Si agregás un `<script>` a `index.html`, actualizá `ORDEN`

`test/dom-falso.js` tiene la lista `ORDEN` con los scripts en el mismo orden que `index.html`.
Hay un test que compara ambas y falla si se desincronizan. El nombre del test se arma con
`ORDEN.length`, así que no hay número que actualizar a mano (y hay otro test que falla si queda
uno escrito en un comentario).

### 4 · Nunca midas la pantalla desde el código

| Decisión | Dónde vive | Por qué |
|----------|-------------|---------|
| **Qué** se muestra en cada vista | `js/logica/layout.js` (pura) + `js/interfaz/visibilidad.js` | Es contenido: se prueba con `node --test`, sin pantalla |
| **Cómo** se acomoda: ancho, columnas, scroll | La hoja de estilos | Un archivo de Node no sabe de anchos ni de cascada |

`test/responsive-calendario.test.js` falla si algún archivo del calendario usa `innerWidth`,
`clientWidth`, `matchMedia` o `getBoundingClientRect`. **No lo esquives con un `matchMedia`**:
sería duplicar en el código una decisión que la hoja ya tomó.

Lo mismo vale para el menú del teléfono: el botón pone las dos clases
(`visible` + `colapsado`) y se termina. Abajo de 640 px el CSS anula lo que `colapsado` hace;
arriba de 640 px `visible` no tiene regla y no estorba. `test/menu-movil.test.js` lo vigila.

```css
/* El atributo hidden no ocultaba nada: display: flex le gana. */
[hidden] { display: none !important; }
```

### 5 · Datos del usuario al DOM, nunca con plantillas

**Un `innerHTML` con `${nombre}` adentro es un XSS esperando.** Ya se encontró uno: el nombre de
un documento interpolado en el `title` de un iframe — `informe" onload="codigo()"` inyectaba un
manejador que se ejecutaba al cargar.

1. **Un dato del usuario nunca entra en un `innerHTML`.** Se usa `createElement` y se asigna con
   `.textContent`, `.title` o `.setAttribute()`.
2. **`srcdoc` NO lleva `escapeHtml`.** Ese atributo espera HTML crudo; escaparlo y dejar que el
   navegador lo decodifique se cancela a sí mismo y da falsa sensación de protección.
3. Lo mismo con **nombres de clase**: el tipo de una anotación pasa por `claseDeTipo()`; sin tipo
   conocido, clase fija `sin-tipo` y la anotación **se sigue viendo** (no se esconde).

`test/visor.test.js` falla si vuelve a aparecer un `${...nombre...}` dentro de un `innerHTML`.

## Bugs ya encontrados (no repetirlos)

- **Mapa de calor en blanco con los tests verdes** — ver punto 2.
- **`[hidden]` no ocultaba nada** con `display: flex`.
- **Los PDF y los Word no se podían abrir** (2026-10-05, reportado por el usuario): `verDocumento()`
  cortaba con `documentoSinContenido(doc)` **antes** de ir a buscar el archivo al almacén. Como el
  índice ya no trae el contenido, la respuesta era siempre "le falta", y la lectura no llegaba a
  ejecutarse. Ahora se pregunta al almacén y se decide con la respuesta. Ojo con esto en general:
  **una función que respondía bien deja de responder bien el día que cambia el dato que mira.**
  En `test/abrir-documento.test.js`. Y ojo también con el arnés: el panel se arma con
  `appendChild`, así que un test que lea `innerHTML` ve `''` y pasa sin mirar nada.
- **A PDF y Word se les pasaba el texto, no los bytes** (2026-10-05): lo guardado es
  `data:…;base64,…` porque eso devuelve `readAsDataURL`, y pdf.js quiere **bytes**. Tomaba los
  caracteres de esa cadena como si fueran el archivo y no abría. El Word pasaba por `fetch()`,
  que sí descodifica —por eso funcionaba **por accidente**—, y esa era una **petición de red**
  para abrir un archivo que ya está en tu computadora. Ahora los dos usan `bytesDeDocumento()`.
  Y ojo: un `try` alrededor de la llamada **no** ve los errores de la librería, porque pasan
  adentro. En `test/abrir-pdf-word.test.js`.
- **`atob` en el arnés, no en la app** — es un global del navegador. La primera versión del
  `atob` falso estaba mal: tiraba los caracteres raros en vez de fallar, así que un test del
  camino del error pasaba por la razón equivocada. **Un simulador más permisivo que la
  realidad no puede probar qué pasa cuando algo falla.**
- **Un fixture tiene que tener la forma del dato real.** `'BASE64-DEL-PDF'` no es base64: pasó
  muchos tests porque nada lo descodificaba todavía, y saltó cuando apareció la conversión.
- **El selector ofrecía `.doc`, que no se puede abrir** (2026-10-05): `mammoth` solo entiende
  `.docx`. El `.doc` de Word 97-2003 se subía, se guardaba, aparecía en el menú con su nombre,
  y al abrirlo decía "error al convertir". **Aceptar un formato que después no se puede abrir es
  peor que no ofrecerlo.** Ahora `crearDocumento()` devuelve `null` y hay un aviso que dice
  qué formatos sí y **cómo** guardarlo bien. Ojo: **`accept` es una sugerencia del navegador**,
  no una regla —se puede elegir cualquier archivo igual—, así que la regla está en `crearDocumento()`.
  En `test/formatos-aceptados.test.js`.
- **`FileReader` en el arnés era un stub** (`function () {}`): eso dejaba **todo el camino de
  subida** sin poder probarse con `node --test`, porque `crearDocumento()` reventaba con
  "readAsDataURL is not a function". Ahora lee de verdad. Los archivos de prueba llevan los
  bytes en `_bytes`, con guion bajo para que nadie lo confunda con algo real.
- **Menú del teléfono:** cerrado lleva `visibility: hidden` (si no, el tabulador entra a "Añadir
  Materia" con `translateX(-100%)`), y la `visibility` va **con retardo al cerrar y sin retardo
  al abrir**: con duración, durante la animación el elemento no puede recibir el foco.
- **Bucle de días que llegaba siempre a 31**, incluso en febrero.
- **El aviso decía "casi lleno (0 % de 95 %)"**: hoy son dos mensajes distintos según se sepa o
  no el porcentaje. **Los dos textos se borraron** en la spec 008 (T10): ese muro de 5 MB ya no
  existe, y anunciar un muro que no está es peor que no avisar. Ahora hay **un** texto, que dice
  que no se pudo guardar sin inventar la causa.
- **Contar palabras por espacios cuenta de más** con espacio al principio o al final
  (`' hola '` da 3, debería dar 1). Declarado **CP-2** en la spec 003 y fijado así en los tests,
  con una nota de qué debería dar. **No lo "arregles" de paso.**
- **`docs/constitucion.md` tenía palabras en inglés que sobraban** ("Eso *freedom*…", "Son dos
  *Battlefield* distintos"). `buscar-caracteres-raros.js` **no las puede ver**: solo busca
  alfabetos no latinos, y esas son letras latinas válidas. **Corregidas el 2026-10-05.** La
  lección sigue viva: un archivo puede tener la regla escrita y no cumplirla, y ninguna
  herramienta que busque alfabetos raros lo va a avisar.

### 6 · Una función que no lanza esconde el error tres pasos más abajo

Una función que devuelve `[]`, `null` o un valor por defecto en vez de tirar **es lo correcto**
cuando el dato es del usuario: mejor un cuaderno con un dato raro que una página muerta. Es el
principio 5.

Pero tiene un precio, y hay que conocerlo: **el error se corre un paso más adentro, y a tres
pasos deja de parecerse a lo que es.**

Pasó dos veces en la spec 008. `separarIndice()` devolvía `[]` con un objeto donde se esperaba
una lista, y el síntoma apareció tres pasos después, en la lectura del almacén. Se buscó el
defecto en el módulo, en el orden de las escrituras y en las promesas: **el dato de prueba
estaba mal**, y la función hacía exactamente lo que debía.

Cuando una función pura devuelva algo vacío y no debería, **probá la entrada antes de suspectar
de la función**. Y si el vacío es a propósito, que lo diga con un test propio, para que el
próximo que lo lea no lo interprete como "todavía no lo implementaron".

## Mover no es corregir

Una tarea que saca lógica de `app.js` **no corrige comportamiento**. Son dos tareas distintas y
hacerlas juntas arruina una de las dos: si movés y corregís, no se puede demostrar que el
movimiento no cambió nada.

Cuando aparece un defecto en el camino, se **anota y se deja**:

| Defecto | Qué hacer |
|---------|-----------|
| Rompe datos o la app | Corregir, en su propia tarea |
| Es una decisión del usuario | Anotarlo como CP, preguntar, no tocarlo |
| Es cosmético | Anotarlo como deuda |

## Los tests se escriben antes, y con el valor del dominio

1. Escribí el test con lo que dice el **dominio** (el calendario real, la regla de negocio).
2. **Ver que falla.** Este paso no es opcional.
3. Recién ahí escribí el código.

Si el test pasa antes de que exista el código, el valor esperado se inventó — y casi siempre sale
del código viejo. Pasó con `diasDelMes` de febrero: copiado del código a reemplazar daba 31, que
era exactamente el bug. **Un test que confirma el error sigue siendo un test que pasa.**

Si el test falla contra un valor que uno acaba de inventar, lo que está mal es **el valor
esperado**, no el código: se calcula a mano y se corrige el test.

Ningún test necesita librería externa. Si un test pide una, el test está mal.

## Cómo editar archivos

**Un archivo de texto se edita con la herramienta de archivos.** PowerShell se usa para **correr
tests y medir**, nunca para escribir contenido.

| Nunca con PowerShell | Por qué |
|----------------------|---------|
| `Set-Content` / `Out-File` sobre un `.md` | Garbifica los acentos: `día` pasa a ser `dÃ­a`. El archivo queda ilegible y **parece** estar bien |
| Reemplazar una sección por número de línea | Los números se desincronizan apenas el archivo se editó otra vez |
| `if` dentro de `-f` | `if` no es una expresión en PowerShell: ejecuta, no devuelve valor |

`specs/*/task.md` y `MEMORY.md` crecen a lo largo de las tareas: buscá el encabezado (`## T3 `) y
reemplazá el bloque completo por texto exacto. Editarlos por línea deja **dos versiones de la
misma sección**.

Chequeo de encoding (no escribe nada):

```powershell
$t = [IO.File]::ReadAllText("MEMORY.md")
([regex]::Matches($t,'\uFFFD')).Count   # tiene que dar 0
```

## Verificación

Corré todo esto después de cada cambio. Los tres primeros son los que atrapan lo que los tests no.

| # | Comando | Debe terminar con |
|---|---------|-------------------|
| 1 | `Test-Path package.json` / `Test-Path node_modules` | `False` / `False` |
| 2 | `node herramientas/buscar-caracteres-raros.js` | "Nada fuera de lugar", salida 0 |
| 3 | `node herramientas/buscar-codigo-muerto.js` | "Nada que limpiar", salida 0 |
| 4 | `node --test` | `fail 0` |
| 5 | `node herramientas/verificar-layout.js` | "Todo entra…", salida 0 |
| 6 | `Get-ChildItem js -Recurse -Filter *.js \| % { node --check $_.FullName }` | sin salida (17 archivos) |
| 7 | `node herramientas/comparar-arbol.js` | "IDÉNTICO", salida 0 |

Además, en Chrome (`chrome-devtools`): consola con **0 errores**, todas las requests en `200`,
captura legible y viewport de 375 px sin scroll horizontal. En la página, la consola **no** debe
decir `require is not defined` — ese es el síntoma de un módulo que olvidó la exportación doble.

**`node --test` no alcanza por sí solo**: los tests corren cada archivo aislado, así que no
detectan colisiones de ámbito entre `<script>`. Por eso `test/navegador.test.js` carga todo como
el navegador lo carga:

```powershell
node --test test/navegador.test.js
```

Correrlo siempre que agregues, renombres o muevas una función entre archivos.

### Notas de las sondas

- **`buscar-caracteres-raros.js`** pregunta al revés: ¿qué hay que *no* debería estar? Los tres
  chequeos rápidos (sin BOM, sin `U+FFFD`, sin patrón de mojibake) buscan corrupción *dentro* de
  los caracteres esperados y no encuentran nada *de más*. Excluye `.opencode/` y `.agents/`.
- **`buscar-codigo-muerto.js`** separa lo que existe solo para que un test lo llame (no es un
  problema) de lo que está muerto de verdad. Las excepciones viven en `EXCEPCIONES`, dentro de la
  herramienta, con su motivo — **no en un documento**, porque una excepción escrita en un `.md`
  termina borrada. Hoy hay cuatro: tres de `consentimiento.js` (RF-12 quedó fuera de alcance) y
  `existeFecha`. No agregues una excepción para tapar algo de lo que no estabas seguro.
- **`verificar-layout.js`** recorre 24 combinaciones: 2 juegos de datos (limpios y con problemas)
  × 4 anchos (1920/1280/768/375) × 3 vistas (modal calendario, modal mapa, **y la principal sin
  modal**). Los dos extremos son a propósito: con el modal abierto el Pomodoro está oculto por
  regla, así que un verificador que solo midiera eso **nunca** detectaría un elemento que lo tape;
  y el aviso de datos está oculto con datos limpios.
- **Nunca sembrar datos sobre el perfil del usuario.** Las sondas abren Chrome con
  `--user-data-dir` temporal. Si hay que probar en el navegador del usuario, preguntar antes.
- **Las sondas siembran con `herramientas/sembrar.js`, y no con `localStorage.setItem`.** Con la
  app leyendo del almacén del navegador, sembrar por `localStorage` **no siembra nada**: el
  primer escenario migraba, dejaba la marca, y todos los siguientes medían una aplicación
  vacía. El helper usa `window.CuadernoVirtual.importarRespaldo()`, que es el camino de
  escritura de la app y además **marca la migración** — sin la marca, la recarga lee el
  almacén viejo y no ve lo recién escrito—. **La línea base del árbol no se regenera nunca:**
  si se regenera después de cambiar algo, congela como verdad lo que estaba mal.

### Si `chrome-devtools` no está en el catálogo

Se puede hablar con Chrome por CDP usando el WebSocket nativo de Node, sin instalar nada.
Es lo mismo que hace `verificar-layout.js`, que quedó en el proyecto justo para eso:

```powershell
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
Start-Process $chrome -ArgumentList @(
  "--remote-debugging-port=9222", "--headless=new",
  "--user-data-dir=$env:TEMP\cdp", "--window-size=1280,800", "about:blank")
# después, con node: conectar a http://127.0.0.1:9222/json/version
```

> **Las herramientas MCP solo existen después de reiniciar OpenCode.** El catálogo se arma al
> arrancar la sesión; si editaste `.opencode/opencode.json`, cerrá y volvé a abrir.
> Y el archivo va **una sola vez**: en `.opencode/opencode.json`. No crees uno en la raíz — se
> mezclan, y como el formato es JSON estricto, un error en cualquiera de los dos impide cargar
> los servidores.

## Refactorizar algo que se ve: congelar lo que se ve

Un refactor de una función que dibuja pantalla **no se verifica con `node --test`**: los tests de
Node no saben de `createElement`, ni de atributos, ni de orden de nodos.

```powershell
node herramientas/capturar-arbol.js herramientas/linea-base-arbol.json
# antes de tocar nada: guarda el HTML real del menú lateral de 13 escenarios

... se refactoriza ...

node herramientas/comparar-arbol.js
# después: tiene que decir IDÉNTICO y salir 0
```

Las tres cosas que hacen que la red sirva: **la línea base se congela antes de editar** (si se
regenera después, se compara contra algo que ya estaba mal); **la red se prueba a sí misma** (se
cambió un `title` a propósito para confirmar que detecta cambios); y **los datos raros se siembran
a propósito** (ícono ausente, tipo desconocido, nombre con HTML, nombre vacío, lista de
documentos que falta).

**Lo que el comparador NO ve: los manejadores de clic.** Compara HTML, no comportamiento. Eso
hay que probarlo a mano en Chrome: que el botón abra el documento correcto, que `stopPropagation`
siga frenando la propagación, que arrastrar y soltar reordene.

## Trampas del runner

- **`node --test` ejecuta cualquier `.js` dentro de `test/`**, aunque no se llame `*.test.js`.
  Por eso las sondas que abren Chrome viven en `herramientas/`: en `test/` cada corrida de la
  suite abriría un navegador. Comprobado con una sonda.
- **`test/dom-falso.js` no es un test, pero el runner lo carga igual** (y por eso cuenta como 1 en
  el total). Es el DOM mínimo que permite cargar `js/app.js` en Node. **Nunca lo copies**: si hace
  falta otra cosa, se agrega ahí — dos DOM falsos se desincronizan, y el que se queda viejo es el
  que nadie recuerda actualizar. Si la app empieza a usar un método que el mock no tiene, los tests
  que lo usan **no fallan: no corren nada**, que es la peor forma de pasar.
- **Un módulo de `test/` que no sea `*.test.js` no define `test()`**: los tests se registran en el
  `require`, así que correrían una vez por cada archivo que lo pida.
- **Para correr un solo archivo, usá la ruta:** `node --test test/archivo.test.js`. Con
  `--test-name-pattern` Node cuenta además un ítem por cada archivo del proyecto, y el número que
  informa no es el de tests reales.
- **Un helper que agarra la coincidencia equivocada es peor que no tener test.** Si una prueba pasa
  sin encontrar lo que busca, es un test que no prueba.

## Deuda y cosas viejas (no son urgentes)

| Deuda | Detalle |
|-------|---------|
 | `app.js` grande | **2533 líneas**. Subió porque la spec 008 le sacó el almacenamiento entero a `js/datos/almacenamiento.js` y le *sumó* comentarios, flujos y el latido. **Grande no es roto**: no tiene un defecto, y achicarlo más está descartado (abajo) |
| Tope de `localStorage` | **Ya no aplica.** El muro de 5 MB era del cuaderno entero en una clave; el almacén nuevo separa cada dato. Los PDFs **siguen** en base64, un 33 % más grandes, y eso sí conviene tenerlo presente para los documentos muy grandes |
| **RF-12 sin implementar** | `js/logica/consentimiento.js` está entero y probado, pero **ninguna función tiene un llamador**. Decidido el 2026-10-02: **no se conecta**. Sin identidades ni servidor no hay cuaderno "ajeno", y un control de privacidad que no controla nada es peor que no tenerlo. Se conserva como andamiaje |
| `existeFecha` sin usar | La exporta `js/logica/fechas.js` y 18 tests la prueban, pero el código no la llama. Se conservó a propósito |
| **Los 30 segundos del latido** | El latido escribe la sección de estudio en curso cada 30 segundos, así que cerrar la pestaña pierde como máximo eso. Es el precio de acotar lo que antes era *la sesión entera*. Decidido por el usuario el 2026-10-05 |
| **Calendario ilegible sin salida** | Si las anotaciones guardadas no se pueden interpretar, el usuario ve el calendario vacío y **no tiene forma de recuperar el valor viejo desde la app**. Se puede a mano desde el almacenamiento del navegador, y el cartel avisa, pero no hay botón. Es decisión de producto |
| **Dos pestañas abiertas** | Gana la última escritura. Declarado fuera de alcance por la spec 008 |
| **Sin internet no abren los PDF ni los Word** | `mammoth` y `pdf.js` vienen de un CDN, y el PDF además baja un *worker* desde ahí. **Decidido el 2026-10-05: se deja así.** Se evaluó bajarlas al proyecto y no se hizo: ~1 MB de código minificado de terceros en un proyecto que se está aprendiendo, y **no resolvería el worker**, que sigue siendo una petición a la red. La decisión real era "¿querés que funcione sin internet?", y fue que no. Lo demás —materias, calendario, Pomodoro, mapa de calor, guardar, exportar, importar— y leer los **HTML** sí funcionan sin red |
| Sección duplicada | `MEMORY.md` tiene el encabezado "Un comentario que cita el código borrado…" **dos veces** |

> **Decidido el 2026-10-02: no hay spec 007.** Se evaluó achicar más `app.js` y se descartó. Lo
> que quedaría es mover `construirArbol()`, `toggleNodo()`, `alternarMenu()` e
> `inicializarDragDrop()`. Para eso habría que poder verificar que un manejador de clic sigue
> haciendo lo mismo, y hoy no se puede: `comparar-arbol.js` compara HTML, y los manejadores no
> están en el HTML. Un refactor que solo se puede comprobar abriendo la página a ojo no es un
> refactor, es un acto de fe. Y el archivo **anda**: no tiene un defecto, es grande. Grande no es roto.

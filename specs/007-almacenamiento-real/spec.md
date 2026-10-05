# Spec 007 — Almacenamiento real

Estado: abortada

> **Esta especificación no se va a implementar como está.** Va a
> [`cierre.md`](cierre.md), que dice por qué (los cuatro hallazgos del `reviewer`), qué
> partes se reparten y cuáles quedan como trabajo aparte. El objetivo que sí importa —
> más almacenamiento — se pide en la spec 008. Acá queda el análisis, no una tarea
> pendiente.

## Contexto y objetivo

Esta especificación sale de una pregunta del usuario: si la app se deja como está,
en HTML, o si se lleva al siguiente nivel para que sea una aplicación de escritorio.
Se pidió el listado de ventajas y desventajas de cada opción.

**La respuesta fue: no se hace nada de escritorio.** El usuario descartó explícitamente
Tauri y Electron, y también se descartó la PWA: no aporta nada que los dos pasos que
sí van no den, y obliga a servir la app por http, rompiendo el "doble clic y abre"
que es la forma de usar este proyecto.

Lo que sí se acordó son tres pasos, más uno previo:

| # | Paso | Por qué |
|---|------|---------|
| 0 | **Primer commit de git.** El repositorio está en rama `master` **sin ningún commit**: todo está sin trackear | Es prerrequisito, no negociable. Hoy no hay forma de volver atrás |
| 1 | **Servir `mammoth` y las fuentes desde el proyecto** en vez de pedirlas a internet | La constitución promete que la app funciona sin red. Hoy no es cierto en tres lugares, no en dos |
| 2 | **IndexedDB en vez del almacenamiento actual** | El tope de ~5 MB y el base64 son el muro real, y con un PDF de 3 MB ya se acerca |
| 3 | **Exportación automática periódica** | Red de seguridad extra, por si todo lo demás falla |

Lo que se trae al proyecto, **sin actualizar nada**, vive en una carpeta propia en la
raíz, llamada `vendor/`, **fuera de `js/`**. `vendor/` tiene **tres** contenidos de
código: `mammoth` (la conversión de Word), `pdf.min.js` (el visor de PDF, **sin su
worker**) y `vendor/fonts/` (las dos familias de tipografía, con sus pesos).
**Junto a cada pieza se copia también su archivo de licencia**, dentro de `vendor/`: sin
él la pieza está incompleta. Las licencias **no se traducen** —son texto de terceros en
su idioma, y no son código propio— así que van por la misma excepción del Principio 6
que va el código. Es un requisito comprobable, con sus criterios, en RF-1. **El worker
del visor de PDF no va a `vendor/`**: queda apuntando al CDN, igual que hoy, y es la
única petición a internet que la app va a hacer. Está escrito con su motivo y con su
riesgo en RF-1.

El motivo de que `vendor/` no sea una carpeta más no es estético: `test/dom-falso.js`
ejecuta contra el DOM falso todos los scripts de su lista `ORDEN`, y esa lista está
construida con archivos de `js/`. Si lo que se trae estuviera debajo de `js/`, se
intentaría cargar en Node y la suite se caería. Lo que eso obliga a cambiar en las
reglas del proyecto está escrito en RF-1.

### Defecto 1 — La app no funciona sin internet, y la constitución dice que sí

La constitución, en el Principio 5 y en el requisito no funcional RNF-2 de la
spec 001, afirma que el proyecto funciona entero sin red. Es falso, y son **cinco
peticiones a tres orígenes**:

| Qué | Qué pasa hoy |
|-----|--------------|
| Abrir un PDF | Se piden **dos** archivos: la librería del visor **y, aparte, el worker** con el que procesa los documentos. Los dos salen de internet, y el segundo se pide desde `js/app.js:1048` |
| Abrir un Word | Se pide la librería de conversión, que también sale de internet |
| **Mirar cualquier pantalla** | Se piden las fuentes de Google: dos conexiones previas y la hoja de estilo, desde dos orígenes distintos |

Lo de las fuentes es el más visible de los tres y es el que nadie había anotado:
`index.html:7-9` trae los `<link>` de `fonts.googleapis.com` y `fonts.gstatic.com`, y
`css/styles.css:49-50` usa las familias en `--font-titulos` y `--font-cuerpo`. Sin
red, la app arranca **con otra tipografía** en cada pantalla. Es decir: la app "funciona"
hoy sin internet, y se ve distinto. Eso no es funcionar sin red.

El resto de la app (materias, documentos HTML, calendario, Pomodoro, mapa de calor)
no sale a la red. Lo que falla es exactamente lo que el usuario más usa para
apuntes: los PDF.

Ojo con el detalle: **no alcanza con traer la primera librería**. El visor de PDF
además pide un segundo archivo. Si se trae solo uno, el PDF sigue sin abrir sin
internet y parece que el paso se hizo.

### Defecto 2 — Todo el cuaderno es un solo texto, y los archivos pesan un 33 % más

Hoy el cuaderno entero (materias, documentos y el contenido de cada archivo) vive
en **una sola clave** del almacenamiento del navegador, como un único texto JSON.
Los archivos van guardados en base64, que es texto: un PDF queda un 33 % más grande
de lo que es realmente.

Las consecuencias, todas medibles:

| Hoy | Consecuencia |
|-----|--------------|
| Tope de ~5 MB del navegador | El muro es real: alrededor de 3,5 MB de PDF se alcanza |
| Base64: +33 % | Un PDF de 3 MB ocupa 4 MB de los 5 |
| Un solo texto para todo | Guardar un cambio reescribe el cuaderno entero |
| El tope se compara contra un número escrito a mano (5 MB) | El número es del navegador, no de la app: puede estar equivocado y nadie se entera |

> **Sobre la cifra de "3,5 MB de PDF": es una estimación derivada, no una medición.**
> Sale de aplicar el 33 % de base64 sobre el tope de ~5 MB del navegador. Sirve para
> dimensionar el problema y no como dato medido. Se conserva como estimación y
> aparece marcado como tal acá y en RNF-5.

### Defecto 3 — Las escrituras no están todas en el mismo lugar, y una no tiene ninguna protección

Este es el hallazgo más importante de la verificación, y corrige una creencia del
proyecto: **no todas las escrituras pasan por el mismo camino.**

Hoy hay cuatro datos guardados, y cuatro caminos distintos:

| Dato | Camino de escritura | Si falla, ¿qué pasa? |
|------|--------------------|----------------------|
| Materias y documentos | Camino protegido: mide el espacio, avisa, y **vuelve a dejar lo anterior** si la escritura se corta | Datos intactos, el cambio se deshace en pantalla |
| Minutos de Pomodoro (formato viejo) | Solo se lee, no se escribe más | — |
| Minutos de estudio por secciones | Camino propio: un `try`/`catch` que avisa, pero **solo** si el error es de cuota | Si falla por otro motivo, el error sube y los minutos quedan en memoria |
| Anotaciones del calendario | **Ninguno.** La escritura va sin ninguna protección | Si falla, el error sube, la anotación queda en memoria y **no está guardada** |

El último caso es el síntoma que la constitución prohíbe: **el fallo silencioso**.
Hoy una anotación del calendario puede no guardarse y no habría ni error visible ni
aviso: en la siguiente apertura del calendario desaparece.

Además, la lectura de las anotaciones tampoco está protegida: si el valor guardado
no es un texto válido, la lectura rompe el arranque del calendario.

### Defecto 4 — La exportación de hoy no es una copia de seguridad

La mecánica de exportar existe y funciona, pero **el archivo que produce solo
contiene las materias con sus documentos**. No incluye los minutos de Pomodoro, ni
los minutos de estudio por secciones, ni las anotaciones del calendario.

O sea: si el usuario exporta y le pasa algo, recupera sus documentos y **pierde
todo el historial de estudio y el calendario**. Un año de estudio no está en el
respaldo. Para una copia que se presenta como "tu salida" (Principio 5), eso es un
defecto.

### Defecto 5 — Lo que no se puede probar con Node es el almacén en sí, no las protecciones

Node no tiene el almacén nuevo. La suite corre en Node, con un DOM falso. Eso es
cierto, y de ahí sale un malentendido que hay que corregir antes de escribir nada:

**Las protecciones de escritura NO son un hueco de cobertura. Hoy son pruebas de
Node, y hoy pasan.** Están en `test/navegador.test.js` (desde la línea 226), con un
almacenamiento inyectado al que se lo rompe a propósito:

| Protección | Cómo se prueba hoy |
|------------|--------------------|
| Bloqueo por falta de espacio | Se siembra casi 5 MB y la escritura se rehúsa **antes** de escribir |
| Lectura que falla | Se rompe `getItem`: la escritura no ocurre y lo anterior queda byte por byte |
| Reversión que falla | Se rompe `setItem` en el camino de volver atrás: la función devuelve "no pudo" y no lanza |
| Deshacer el cambio | Se rompe `setItem` en un cambio real: lo que no se pudo guardar no queda en memoria |
| Acumulación de cambios | Se hacen dos cambios seguidos con el almacenamiento roto: tampoco se acumulan |

O sea: lo que esta especificación tiene que hacer con las protecciones es
**reescribirlas contra el almacén nuevo**, porque cambian el almacén al que se
rompen. No es escribir cobertura que falta: es cambiar el punto de apoyo de cinco
protecciones que ya están.

Lo que sí no se puede probar con el runner es el **comportamiento del almacén
nuevo en sí**: que exista, que aguante un cuaderno de 200 MB, que una segunda
pestaña lo bloquee, que devuelva lo que se le escribió. Eso se verifica en Chrome,
y es lo que dice RF-7.

> La lección de que *los tests pasan y la página está rota* está contada en
> `MEMORY.md`, en la sección **"El IIFE esconde funciones: la API pública
> (lección de 2026-10-01)"**, con el error exacto que la produjo. Se cita ahí
> porque es el precedente de por qué el navegador sigue siendo un camino de
> verificación y no un extra.

## Usuarios

**Un solo usuario: el dueño del cuaderno, en su computadora.** No hay cuentas, ni
servidor, ni equipos compartidos, ni nadie más que pueda ver los datos.

Eso descarta de entrada toda una familia de requisitos (cuentas, sincronización,
permisos, trabajo en equipo). Y fija la regla de oro de esta especificación, con su
límite escrito: **el único objetivo es que no se pierda nada de lo que esa persona
guardó, y nada se pierde sin que se le avise.**

El límite, porque sin él la regla promete más de lo que los requisitos garantizan:
**la única operación que puede hacer perder datos es importar un respaldo**, porque
reemplaza el cuaderno entero. El usuario lo pide, el sistema **le nombra por
adelantado qué se va a perder** y recién después de que lo confirme se borra lo
que había. Fuera de esa operación, ningún camino de esta especificación borra datos
del usuario: ni la migración (que copia y deja lo viejo), ni el cambio de almacén
(que no borra), ni una escritura fallida (que se revierte).

## Historias de usuario

- **HU-1.** Como dueño del cuaderno, quiero abrir un PDF sin tener internet, para
  poder estudiar en cualquier lugar. (Esta historia depende de una premisa que
  **todavía no está medida**: que el respaldo automático del visor funcione bajo
  `file://`. Ver el riesgo declarado en RF-1 y la medición en RF-7. Si la medición da
  negativo, esta historia vuelve a la mesa.)
- **HU-2.** Como dueño del cuaderno, quiero subir los PDF y los apuntes que necesito
  sin que la app me diga que no entra, para no tener que decidir qué borrar.
- **HU-3.** Como dueño del cuaderno, quiero que la app siga funcionando con doble
  clic, sin instalar nada, como hasta ahora, para que no cambie mi costumbre.
- **HU-4.** Como dueño del cuaderno, quiero que mis datos no se pierdan nunca en
  silencio, ante un fallo de escritura o una caída, para no enterarme al día
  siguiente de que no están.
- **HU-5.** Como dueño del cuaderno, quiero una copia de todo lo mío cada cierto
  tiempo sin acordarme de pedirla, para no depender de mi memoria.
- **HU-6.** Como dueño del cuaderno, quiero que el aviso de la copia automática diga
  exactamente lo que la app sabe —que generó el archivo y qué incluye— y no diga
  dónde quedó ni dé por hecho que llegó, para no confiar en un aviso que no dice la
  verdad.
- **HU-7.** Como dueño del cuaderno, quiero que la app funcione igual aunque mi
  navegador no tenga el almacén nuevo, para no quedarme sin app por un detalle del
  navegador.
- **HU-8.** Como dueño del cuaderno, quiero que la app me diga **qué** datos se van a
  perder si importo un respaldo, para no perder el historial de estudio por un
  `sí` dado a ciegas.

## Definiciones

| Término | Qué significa |
|---------|--------------|
| **El almacén viejo** | El del navegador que guarda todo en un texto JSON por clave, con un tope de ~5 MB |
| **El almacén nuevo** | El del navegador que separa cada dato y no tiene el tope de 5 MB |
| **Disponible** (el almacén nuevo) | Que se lo puede abrir, escribirle un registro de prueba y volver a leer ese mismo registro con el mismo contenido, dentro de un plazo fijo. Ver RF-6 |
| **Modo normal** | El modo en que el cuaderno vive en el almacén nuevo |
| **Modo limitado** | La situación en que el cuaderno sigue en el almacén viejo, la app avisa por qué y sigue funcionando |
| **Modo iniciando** | El tercer estado: la app está dibujada pero todavía no sabe en qué modo está. Ninguna operación que cambie datos está habilitada |
| **Copia automática** | La copia de seguridad que la app hace sola, sin que el usuario la pida |
| **Última copia** | La copia más reciente, sea automática o hecha a mano |
| **Sin internet** | La computadora sin conexión a la red |
| **`vendor/`** | La carpeta de la raíz donde vive lo que se trae de terceros: `mammoth`, el visor de PDF **sin su worker**, los archivos de las dos familias de tipografía **y el archivo de licencia de cada una de esas piezas, junto a su código**. No es código propio |
| **Los cuatro grupos de datos** | Materias con sus documentos · minutos de Pomodoro (formato viejo, solo lectura) · minutos de estudio por secciones · anotaciones del calendario |

### Cuántas veces se repite cada aviso

"Una sola vez" y "una vez por sesión" son cosas distintas y no se mezclan:

| Aviso | Alcance | Por qué ese y no otro |
|-------|---------|------------------------|
| Modo limitado | **Una vez por sesión** | El modo se decide en cada arranque. Si el navegador se actualiza o la ventana privada cambia, el usuario tiene que enterarse otra vez |
| Migración completada | **Una vez por cada arranque en que la copia termina bien** | Con la regla única de RF-4, en la práctica es una vez. Si una migración se corta y se reintenta y recién ahí termina, el aviso aparece **una sola vez**, en el arranque donde terminó, no en cada intento fallido |
| Migración que no se pudo completar | **Una vez por cada arranque en que se intenta y falla** | Cada intento fallido es un hecho nuevo. Si al día siguiente vuelve a fallar, vuelve a avisar: el problema sigue |
| Copia automática generada | **Una vez por cada copia hecha** | Una copia por cada 7 días, una por arranque. No hay repetición dentro de un arranque |
| Copia automática que no se pudo hacer | **Una vez por cada intento fallido** | Igual que el anterior |
| Fallo de escritura de un dato | **Una vez por cada intento que falla** | Si el usuario reintenta y vuelve a fallar, tiene que volver a ver el aviso |
| Cuaderno todavía se está cargando | **Una vez por cada intento mientras carga** | El usuario no lo ve solo: lo ve cuando toca algo y no pasa nada. Por eso va con cada intento, y no una vez por sesión |
| El visor de PDF cayó al hilo principal | **Una vez por cada apertura de PDF que cae al respaldo** | El aviso va con el documento, y explica una demora, no un error |
| Cuaderno abierto en otra pestaña | **Una vez por sesión, y de nuevo si el rechazo vuelve a ocurrir más tarde** | Una vez por sesión alcanza para avisar; pero si el usuario insiste y nada se guarda en toda la sesión, no vuelve a ver la causa. No se repite mientras insiste sin hacer nada, porque ahí ya lo leyó y el problema no es no haberlo leído. **Que reaparezca es lo que evita que los minutos de la segunda pestaña se pierdan en silencio**, y lo dice el caso límite de las dos pestañas |
| Datos raros de un respaldo importado | **Una vez por importación** | Va junto al resultado de la importación |

## Requisitos funcionales

---

### RF-0 — El estado actual queda guardado antes de tocar nada

**Descripción.** El repositorio no tiene ningún commit: todo el proyecto está sin
versionar. No hay forma de volver atrás, y no hay forma de ver qué cambió. Esta
especificación cambia el lugar donde viven los datos del usuario: sin un punto de
vuelta, no hay red.

**Qué entra y qué no.** `AGENTS.md` ya dice qué archivos "no son de la app":

| Entra en el commit | No entra, y queda en `.gitignore` |
|--------------------|-----------------------------------|
| `index.html`, `css/`, `js/`, `test/`, `herramientas/` | `New Project/` (apuntes del curso) |
| `docs/` y `specs/` (la documentación es del proyecto) | `.npmrc` y `skills-lock.json` (instalación de skills) |
| `MEMORY.md` y `AGENTS.md` | `.agents/` y `.opencode/` (instalación y flujo de trabajo) |
| | `package-lock.json` |

**Sobre `package-lock.json`.** Hay uno en la raíz y **no estaba antes**: lo creó una
herramienta al correr un comando, y está vacío de verdad (`packages: {}`). Entra en
`.gitignore` por dos razones que no son opinables: versionar el archivo de bloqueo de
un proyecto **sin dependencias** contradice RNF-1 y el Principio 1, y el archivo dice
que no hay nada que bloquear. Si mañana el proyecto tuviera dependencias de verdad, eso
es otro día.

**Criterios de aceptación**

- Cuando comience la implementación de esta especificación, entonces el
  repositorio tendrá un commit con el estado actual completo del proyecto.
- Ese commit se hace **antes** del primer cambio de código.
- EL SISTEMA crea un `.gitignore` en ese mismo commit, con **exactamente** la lista
  de lo que no entra —`New Project/`, `.npmrc`, `skills-lock.json`, `package-lock.json`,
  `.agents/` y `.opencode/`—, porque hoy no hay ninguno y un `git add` de todo se
  llevaría los apuntes del curso, la configuración y el archivo de bloqueo que no
  tiene nada que bloquear.
- CUANDO se mire la lista de archivos versionados después de ese commit, entonces
  **no aparece ninguno** de los excluidos, y sí aparecen los incluidos.

---

### RF-1 — La app abre y funciona sin internet

**Descripción.** La constitución promete que la app funciona sin red. Hoy no es
cierto para los PDF y los Word, y es exactamente lo que el usuario más usa.

**Qué va en `vendor/` y qué no va, y por qué.**

| Qué | Decisión | Por qué |
|-----|----------|---------|
| `mammoth` (conversión de Word) | **Se trae a `vendor/`**, en la versión exacta de hoy | Es la dependencia que no tiene respaldo: sin ella, no hay conversión de Word |
| `pdf.min.js` (el visor de PDF) | **Se trae a `vendor/`**, en la versión exacta de hoy | **Sin la librería no hay nada que caiga al respaldo**: si el visor tampoco fuera local, sin red no se abriría ningún PDF, y no habría forma de medir la premisa de abajo |
| El **worker** del visor de PDF (`pdf.worker.min.js`) | **NO se trae.** `js/app.js:1048` sigue apuntando al CDN, igual que hoy | Es el único archivo que queda fuera, y por eso es el único que genera una petición externa. Los dos caminos locales ya están medidos y cortados: `new Worker('file:///…')` da `SecurityError` y `import('./w.js')` da `TypeError` bajo `file://`. Traerlo no es que sea difícil: es que no anda |
| Las dos familias de tipografía | **Se traen a `vendor/fonts/`**, con los **mismos nombres y los mismos pesos** que hoy | Es la única de las tres dependencias que no obliga a elegir entre el criterio de red y el diseño. Sacar las fuentes y quedarse con Georgia rompería RNF-6 |
| La licencia de cada pieza de terceros | **Se copia a `vendor/`, junto al código al que pertenece**, tal como viene, en su idioma | El código es de terceros: traerlo sin su licencia es traérlo a medias. Las tipografías tienen su propia licencia de uso, y es tan parte de la pieza como los archivos de fuente |

**Los pesos, confirmados.** El `<link>` de `index.html:9` pide exactamente
**Inter 300/400/500/600/700** y **Playfair Display 400/500/600/700**, y
`css/styles.css:49-50` las usa en `--font-titulos` y `--font-cuerpo`. Esos son los
pesos que hay que bajar. Si se baja otra combinación, cambia la tipografía y RNF-6 se
rompe: self-hostear no es cambiar lo que se ve. Las reglas `@font-face` las escribe el
proyecto en su propia hoja de estilos; en `vendor/fonts/` van los archivos de fuente.

**El riesgo declarado: la premisa del respaldo automático.**

Con el worker apuntando al CDN, sin red la petición falla y `pdf.js` cae a su respaldo
automático (el worker simulado, en el hilo principal). **Que ese respaldo funcione
bien bajo `file://` no está medido**, y es la única cosa que hace que "los PDF abren
sin internet" sea cierto.

> **Si el respaldo no funciona bajo `file://`, los PDF no abren sin red.** Eso hay que
> **detectarlo y decirlo** en la etapa de verificación, no descubrirlo el día que
> alguien esté estudiando sin internet. La medición está pedida en RF-7, con nombre
> propio, y su resultado escrito en el proyecto.

**El costo conocido: la demora.** La petición al CDN tiene que **fallar** antes de que
`pdf.js` caiga al hilo principal. Sin red, esa espera se nota, y con PDF grandes
puede dejar la interfaz sin responder unos segundos. El aviso de RF-1 existe para eso,
no para un archivo que falta.

Consecuencias para las reglas del proyecto, porque son reglas y no detalles:

1. **`vendor/` queda fuera del Principio 6.** No es código propio: no se traduce, no se
   comenta en español y no se le exige UTF-8 sin BOM a propósito. Es una excepción con
   nombre, no un olvido. **Las licencias van por la misma excepción**: son texto de
   terceros, en su idioma, y traducirlas o "corregirlas" sería falsear la licencia.
2. **`herramientas/buscar-caracteres-raros.js` es la única sonda que hay que tocar.**
   Hoy recorre todos los archivos del proyecto salvo `node_modules`, `.opencode` y
   `.agents`: hay que agregarle `vendor/`, en `buscar-caracteres-raros.js:35`. Y
   **no hay que tocar ninguna otra**: `buscar-codigo-muerto.js` solo lee `js/`, `test/`,
   `herramientas/` y `specs/`; la comparación de scripts de `test/navegador.test.js:58`
   solo matchea rutas que empiezan con `js/`; y el barrido de sintaxis también solo
   mira `js/`. Agregar exclusiones de más es ruido: deja la sensación de que `vendor/`
   es un problema en más lugares de los que es. Las licencias van dentro de `vendor/`,
   así que entran con ese mismo cambio y no necesitan ninguna regla propia.
3. **La lista `ORDEN` de los scripts que se prueban en Node no cambia.** Solo
   matchean los archivos de `js/`, y `vendor/` no está abajo de `js/`: ni se cargan
   en Node, ni entran en la comparación con lo que carga `index.html`. Esa comparación
   sigue siendo válida tal como está, y tiene que seguir dando lo mismo.
4. **La constitución tiene que dejar de decir que las librerías "ya incluidas en
   `index.html`".** Es una frase que queda falsa y que hay que corregir (ver checklist).

**Lo que la app pide, y lo que pide el contenido de un documento.** Son dos cosas
distintas y este requisito solo cubre la primera:

- **Peticiones del sistema:** los archivos de la propia app, `mammoth` y las fuentes,
  que salen del proyecto. **Y una sola excepción, con nombre: el worker del visor de
  PDF, que se pide al CDN cada vez que se abre un PDF.** No hay otra.
- **Peticiones del contenido que el usuario abrió:** un documento HTML guardado por
  el usuario puede traer una imagen o una hoja de estilos apuntando a un sitio. El
  visor lo muestra **hoy** y lo seguirá mostrando: el navegador pide eso que el
  propio documento pide, y no es la app. Queda **fuera de alcance, escrito acá**, y
  no cuenta como incumplimiento de este requisito.

**Criterios de aceptación**

- EL SISTEMA obtiene `mammoth`, el visor de PDF y los archivos de las dos familias de
  tipografía desde su propia carpeta del proyecto, sin pedirlos a ningún sitio de
  internet.
- EL SISTEMA **conserva** las familias y los **pesos de hoy**: Inter 300/400/500/600/700
  y Playfair Display 400/500/600/700.
- CUANDO la computadora está sin conexión, entonces las fuentes del cuaderno se ven
  **exactamente igual** que con conexión.
- CUANDO la computadora está sin conexión, entonces el sistema convierte y abre un
  documento Word igual que con conexión.
- CUANDO arranca la aplicación **sin ningún documento abierto**, entonces el sistema
  no hace ninguna petición a un origen externo, ni al arrancar ni durante el uso.
- CUANDO el usuario abre un documento PDF, ENTONCES el sistema pide el worker del visor
  al CDN, y **esa es la única petición a un origen externo que hace la aplicación**.
- CUANDO la computadora está sin conexión, entonces el visor procesa el PDF en el hilo
  principal y el documento **abre igual**, siempre que la medición haya dado bien. Si esa medición da negativo, este criterio **se cae**,
  y hay que decirlo y revisarlo, no dejarlo prometido.
- CUANDO el sistema detecta que la petición del worker falló y que el visor cayó al
  hilo principal, ENTONCES lo dice **en la página**, en el área de avisos, con un
  mensaje que dice: (a) que el PDF se está procesando en el hilo principal porque no
  se pudo traer el archivo de apoyo, (b) que la interfaz puede quedar unos segundos
  sin responder, y (c) que con conexión el PDF abre más rápido. El aviso queda en la
  página, no en la consola: una consola es invisible para la persona que usa la app.
- CUANDO el peso total de `vendor/` y de los archivos de fuente se mida, ENTONCES el
  número queda anotado en `specs/007-almacenamiento-real/verificacion-navegador.md`. No
  es un requisito con tope: es un dato, y un dato que no se escribe se desincroniza.
- Se conserva **exactamente** la versión de `mammoth` y del visor de PDF que están en
  uso hoy. Esta especificación los trae, no los actualiza.
- EL SISTEMA copia **junto a cada pieza de terceros su archivo de licencia**, dentro de
  `vendor/`: la de `mammoth`, la del visor de PDF y la de cada una de las dos familias de
  tipografía. Una pieza sin su licencia al lado es una pieza que está a medias.
- CUANDO se mire el contenido de `vendor/`, ENTONCES **cada archivo de terceros tiene su
  licencia al lado**, y ninguna queda solo "por constar en la documentación del
  proyecto": la constancia escrita no reemplaza el archivo.
- EL SISTEMA **no traduce las licencias** ni las pasa por las correcciones del proyecto:
  van tal como vienen, en su idioma (Principio 6, con la excepción de RF-1).
- CUANDO corra `herramientas/buscar-caracteres-raros.js` con `vendor/` entre los archivos
  que recorre, ENTONCES termina diciendo **"Nada fuera de lugar"** y sale con código 0:
  las licencias son texto de terceros en inglés y no las hace falta arreglar para que la
  sonda las acepte.

---

### RF-2 — El cuaderno deja de tener el muro de 5 MB

**Descripción.** El tope de ~5 MB y el base64 son el límite real. Este requisito
saca ese muro para el caso normal, sin cambiar nada de lo que el usuario ve.

**Criterios de aceptación**

- CUANDO el usuario guarda un cambio, entonces el sistema lo escribe en el almacén
  nuevo.
- CUANDO el usuario recarga la página, entonces el sistema vuelve a leer lo mismo
  que estaba antes del cambio.
- MIENTRAS el sistema está en modo normal, ENTONCES **no** muestra el aviso de
  "almacenamiento casi lleno", porque ese límite ya no es el del navegador. Es una
  decisión explícita, no un olvido: el aviso desaparece en modo normal y se
  conserva tal cual en modo limitado (RF-6).
- **El valor de capacidad que se le pasa a la decisión de escribir tiene que ser
  mayor que cero, siempre.** Con cero o menos, `js/logica/almacenamiento.js:75`
  bloquea **toda** escritura y la app queda de pronto inusable sin decir por qué. Es
  el bloqueo preventivo, y **se evita solo** con esa regla. El 5 MB escrito a mano en
  `js/app.js:333` es el tope del almacén viejo: en modo normal **no** es el número que
  corresponde, y en ningún modo puede ser cero ni menos.
- SI una escritura falla y el error **dice** que no hay espacio, ENTONCES el sistema
  lo avisa nombrando esa causa, ofrece exportar y **no** dice un porcentaje que no
  sabe.
- SI una escritura falla y el error **no dice** por qué, ENTONCES el sistema avisa
  que no se pudo guardar, **sin inventar una causa**, y ofrece exportar igual.

---

### RF-3 — Ningún dato se escribe por un camino sin garantías

**Descripción.** El defecto 3 es el más serio de esta especificación: hoy hay cuatro
caminos de escritura y uno no tiene ninguno. Después de esta especificación, todos
los datos del usuario se escriben por caminos que dan las mismas garantías.

**Lo que tiene que ser igual son las garantías, no el código.** No se pide un único
camino: en modo normal los datos se escriben en el almacén nuevo (RF-2) y en modo
limitado en el viejo (RF-6). Son dos caminos distintos y **los dos tienen que dar las
tres garantías**. Una garantía comprobada en un modo no vale para el otro.

Las tres garantías, para todo dato del usuario (materia, documento, registro de
minutos de estudio, anotación del calendario), en los dos modos:

1. **Avisa.** El usuario se entera de que no se pudo guardar.
2. **Revierte.** Lo que ve en pantalla vuelve a ser lo que estaba guardado. Nunca ve
   algo que no está guardado.
3. **No deja datos a medias.** No queda una escritura a medio hacer en ningún
   almacén.

**Criterios de aceptación**

- CUANDO el usuario agrega, edita o borra una anotación del calendario, un registro
  de minutos de estudio, una materia o un documento, entonces el sistema lo guarda
  por un camino que cumple **las tres garantías**, y en los dos modos.
- SI la escritura falla, entonces el sistema deshace el cambio en la pantalla: lo
  que el usuario ve nunca es algo que no está guardado.
- SI la escritura falla, entonces el sistema le dice que no se pudo guardar, con un
  mensaje que nombra la causa **solo si el error la nombra**.
- SI la escritura falla y no había nada guardado previo, entonces el sistema no deja
  una entrada a medias y avisa.
- SI no se puede leer lo que estaba guardado, entonces el sistema **no escribe nada**
  y avisa. No hacer nada es menos malo que perder: el camino que conserva datos es el
  que no hace nada.
- CUANDO la escritura **no responde** —la operación no termina dentro del plazo fijo—,
  ENTONCES el sistema avisa que el almacenamiento no respondió y no escribe.
- CUANDO el almacenamiento **está bloqueado** —abrirlo, escribirle o volver a leer lo
  escrito lanza un error, o lo que se lee de vuelta no es lo que se escribió—,
  ENTONCES el sistema avisa que no está disponible y no escribe.
- CUANDO el almacenamiento **se llenó** —el error dice que no hay espacio—, ENTONCES
  el sistema avisa que no hay espacio, ofrece exportar y no escribe.

---

### RF-4 — Lo que ya está guardado pasa al almacén nuevo, sin borrar lo viejo

**Descripción.** El usuario tiene datos guardados en el almacén viejo. La decisión
tomada es: **se copian y lo viejo queda intacto.** El principio es que nada se borra
hasta que el usuario lo diga, y que haya una red detrás de cada migración.

**La regla única de la migración.** Toda esta sección se apoya en una sola regla, que
resuelve la contradicción que había entre "migra una sola vez" y "puede migrar más
adelante". La migración **se intenta al arrancar, y solo si se cumplen las tres
condiciones**:

1. El almacén nuevo está **disponible** (la prueba de RF-6).
2. El almacén viejo tiene datos.
3. El almacén nuevo **no está marcado como migración terminada**.

Y después, **una sola regla para todo**:

- **Si la copia termina bien**, el almacén nuevo queda marcado como migración
  terminada. La condición 3 deja de cumplirse y **la migración no vuelve a
  intentarse**. Se ejecutó una sola vez.
- **Si la copia se corta o falla**, el almacén nuevo sigue sin la marca, así que en
  el siguiente arranque las tres condiciones se cumplen otra vez y **se vuelve a
  intentar desde el principio**. No es un mecanismo de reintento aparte: es la misma
  regla, evaluada de nuevo. Vale para los dos motivos de fallo —que se cierre la
  pestaña y que no haya espacio— porque en los dos casos la condición que falla es
  la misma: la marca no llegó a escribirse.
- **Si el almacén nuevo no está disponible**, la condición 1 no se cumple: **la
  migración no se intenta, ni ahora ni en los próximos arranques mientras siga sin
  estar disponible.** Ese es el único motivo por el que no se reintenta, y conviene
  decirlo con precisión, porque generalizarlo se contradice con los casos de arriba:
  en cuanto el almacén nuevo **sí** está disponible, y quedan las otras dos
  condiciones, la migración corre. Eso no es un reintento: es la primera vez que puede
  correr.

Lo que hay que tener claro para que esto no se lea mal: **el "no reintentar" tiene una
sola causa, que es el almacén nuevo no disponible.** Cualquier otro motivo de que la
migración no haya terminado —falta de espacio, error de disco, pestaña cerrada— deja
el almacén nuevo sin marcar y se reintenta en el siguiente arranque.

**Los minutos de Pomodoro son un valor heredado de solo lectura.** Hoy se leen una
sola vez al arrancar (`js/app.js:1446`) y ya no se escriben: los minutos que cuentan
de verdad son los de estudio por secciones. La migración **los copia tal cual**, sin
interpretarlos ni convertirlos, y la copia de seguridad también los incluye para que
no se pierdan. Esta especificación **no** empieza a escribirlos de nuevo: cambiar el
registro del Pomodoro es otro trabajo.

**Criterios de aceptación**

- CUANDO el usuario abre la aplicación con el almacén nuevo disponible y hay datos en
  el viejo, entonces el sistema copia **los cuatro grupos** al nuevo: materias con sus
  documentos, minutos de Pomodoro (tal cual), minutos de estudio por secciones y
  anotaciones del calendario.
- CUANDO termina la copia, entonces el sistema **no borra nada** del almacén viejo:
  queda entero, como red.
- CUANDO termina la copia, entonces el sistema avisa **una vez por arranque** qué se
  copió y que lo anterior quedó ahí como respaldo.
- SI la copia se corta a la mitad (se cierra la pestaña, falla el navegador), en la
  siguiente apertura se cumplen otra vez las tres condiciones y **se vuelve a intentar
  desde el principio**, y el cuaderno no queda a medias en ninguno de los dos almacenes.
- SI no hay datos en el almacén viejo, entonces el sistema arranca vacío y sin
  preguntar nada.
- CUANDO termina la copia, entonces todo lo que había antes sigue visible: mismas
  materias, mismos documentos, mismos minutos, mismas anotaciones.
- **MIENTRAS la migración no ha terminado**, entonces el cuaderno que se ve y sobre el
  que se guarda es el del almacén viejo, que está entero, y **ninguna operación que
  cambie datos está habilitada** hasta que la migración termine o falle.
- SI la migración termina bien y después el usuario **limpia los datos del sitio**
  desde el navegador, ENTONCES el sistema **no dice que se migró nada**: no hay datos
  que migrar, porque el almacén viejo se limpió con el resto.
- MIENTRAS el almacén nuevo **no esté disponible**, ENTONCES el sistema **no intenta
  migrar**. En cuanto el almacén nuevo esté disponible, si además hay datos en el viejo
  y el nuevo no está marcado, la migración corre: no es un reintento, es la regla.

**La fecha de la última copia.** Es el dato que decide si la copia automática está
pendiente, y hoy **no existe**: no hay ninguna clave así en el cuaderno. Se define acá:

| Pregunta | Respuesta |
|----------|-----------|
| ¿Dónde vive? | En un registro de nombre reservado, **en el almacén del modo en que está la app**: el nuevo en modo normal, el viejo en modo limitado. Viaja con el cuaderno, no en un lado aparte |
| ¿Y la primera vez, cuando no hay fecha? | **No hay fecha = la copia está pendiente.** La primera apertura que llegue a esa parte arma la copia. Para un usuario que ya tiene datos, eso es una copia de regalo el primer día |
| ¿Y si esa escritura falla? | El sistema **no** la da por guardada y **lo dice** en el aviso de la copia: que puede volver a aparecer. No se da por hecho lo que no se sabe |
| ¿Es un dato del usuario? | **No.** Es una cuenta de la app, no una anotación del dueño del cuaderno. Por eso **no entra entre los datos con las tres garantías de RF-3** (no hay nada en pantalla que revertir), y sí tiene una regla propia: es un registro de nombre reservado que **se escribe entero o no se escribe**, así que no hay forma de que quede a medias |

---

### RF-5 — La copia de seguridad automática

**Descripción.** Hoy exportar es un trabajo manual, y lo que se exporta no incluye
los minutos ni el calendario. Este requisito hace que la copia sea automática,
periódica, **completa** y honesta sobre lo que sabe.

**Lo que la app puede observar y lo que no.** La copia se dispara con un enlace de
descarga sobre un archivo generado en memoria. Con eso **no hay forma de saber si la
descarga ocurrió, ni dónde quedó**: el navegador puede bloquearla, cancelarla o
escribirle un nombre distinto, y ninguno de esos hechos es observable desde la app.
Por lo tanto **el aviso nunca afirma dónde quedó el archivo ni que la descarga se haya
completado**. Lo que sí es observable, y lo único que el aviso afirma, es que la app
**generó** el archivo con todo lo que había guardado.

**Copia automática y copia a mano se arman con el mismo criterio**, y de dónde se lee
cada dato depende del modo:

| Modo | De dónde se leen los cuatro grupos para armar la copia |
|------|--------------------------------------------------------|
| Normal | Del almacén nuevo. La copia automática se arma **después** de que la migración terminó, así que el almacén nuevo ya tiene los cuatro grupos |
| Limitado | Del almacén viejo, que está entero |

**Los nombres de archivo.** Hoy la copia a mano se llama `cuaderno-virtual-AAAA-MM-DD.json`,
que **choca**: dos copias el mismo día, o una automática y una a mano el mismo día,
piden el mismo nombre. La copia a mano **conserva su nombre de hoy** (para no cambiar
lo que el usuario ya conoce) y la automática usa uno propio, con fecha **y hora hasta
el segundo**: `cuaderno-virtual-automatico-AAAA-MM-DD-HHMMSS.json`.

**Criterios de aceptación**

- CUANDO pasan 7 días desde la última copia y la aplicación arranca, entonces el
  sistema arma una copia automática **después** de resolver la migración, leyendo los
  datos del almacén del modo en que está.
- CUANDO no hay fecha de última copia, ENTONCES la copia automática está **pendiente**:
  la primera apertura la arma.
- CUANDO el sistema arma la copia automática, ENTONCES guarda la fecha de esa copia
  **después** de armarla, y si esa escritura falla, ENTONCES lo dice en el mismo aviso:
  la copia se generó pero la fecha no, así que puede volver a aparecer. El sistema no
  dice "copia hecha" cuando lo que sabe es que generó el archivo (D1).
- EL SISTEMA incluye en la copia **los cuatro grupos**: materias con sus documentos,
  minutos de Pomodoro, minutos de estudio por secciones y anotaciones del calendario.
- SI no hay ningún dato guardado, ENTONCES el sistema **no arma copia ni avisa**: una
  copia vacía no es un respaldo.
- CUANDO el sistema arma la copia automática, ENTONCES muestra un aviso que dice, como
  mínimo, estas cuatro cosas: (a) que **se generó una copia** del cuaderno, (b) que
  incluye todo lo guardado, (c) que **la app no puede confirmar que la descarga haya
  ocurrido ni en qué carpeta quedó**, porque con un enlace de descarga eso no se sabe,
  y (d) que si quiere estar seguro, use el botón de exportar, que sí le pregunta
  antes.
- EL SISTEMA **no dice nunca** dónde quedó el archivo, ni que la descarga se completó,
  ni que el archivo "está guardado".
- SI el sistema **no puede leer** alguno de los cuatro grupos, ENTONCES **no arma una
  copia incompleta**: avisa que no pudo hacer la copia y nombra qué no pudo leer. Una
  copia a medio hacer sin avisar es peor que no hacer copia.
- SI el navegador bloquea la descarga, la cancela o la guarda con otro nombre, ENTONCES
  el sistema **no se entera y no dice nada más**. Es una limitación conocida y
  aceptada: justamente por eso el aviso no promete la descarga.
- CUANDO el usuario importa una copia, EL SISTEMA recupera los cuatro grupos que
  contiene, incluido el historial de estudio y las anotaciones del calendario.
- CUANDO el usuario importa **una copia automática**, ENTONCES el sistema la trata
  **exactamente igual que una copia hecha a mano**: no le ofrece ninguna opción que
  solo tenga sentido en el caso automático.
- CUANDO el usuario exporta a mano, entonces esa exportación cuenta como última copia:
  no se genera un archivo redundante al día siguiente.
- SI el archivo de la copia automática ya existe en el disco, ENTONCES el sistema **no
  lo comprueba y no avisa de eso**: con un enlace de descarga no se puede saber. Por
  eso su nombre lleva la hora hasta el segundo, y por eso solo se pide **una copia
  por arranque**: dos copias automáticas no pueden pedir el mismo nombre.

---

### RF-6 — La app funciona aunque el almacén nuevo no exista

**Descripción.** El almacén nuevo no está disponible en todos los navegadores ni en
todos los modos (por ejemplo, ventanas privadas). La app se abre con doble clic y no
puede dejar de funcionar por un detalle del navegador.

**Cómo se decide el modo, con algo observable.** "Disponible" no es una palabra: es
una prueba de tres pasos que el sistema hace **una vez al arrancar**. La prueba
escribe un registro propio de nombre fijo y de tamaño despreciable, lo vuelve a leer
y compara. Si ese registro no existía antes de la prueba, se borra al terminar. El
paso de lectura es asíncrono, así que hay un plazo fijo: si algo no termina dentro
de él, la respuesta es que no está disponible.

**El modo se decide en el arranque, y solo ahí.** La secuencia es una sola: prueba de
disponibilidad, después migración si hay algo que migrar. Al terminar esa secuencia el
modo queda fijado. Lo que **no** puede cambiar el modo es **que una escritura falle más
tarde** —por falta de espacio o por un problema de disco—: la app sigue en el modo en
que está, avisa, revierte y sigue funcionando con lo que ya estaba guardado. Pasarse
de modo a mitad de sesión dejaría al usuario con un cuaderno partido entre dos
almacenes, que es peor que el problema original.

Decirlo con precisión, porque las dos cosas se parecen y no son lo mismo: **el vuelco
del arranque sí cambia el modo** (es cuando se decide), **un fallo de escritura
posterior no**.

**Criterios de aceptación**

- CUANDO arranca la aplicación, ENTONCES el sistema hace **una sola** prueba de
  disponibilidad del almacén nuevo: abrirlo, escribir un registro de prueba, y volver
  a leerlo con el mismo contenido, dentro de un plazo fijo.
- CUANDO la prueba se completa entera dentro del plazo, ENTONCES el sistema queda en
  modo normal.
- SI la prueba falla en cualquiera de sus tres pasos, o no termina dentro del plazo,
  ENTONCES el sistema queda en modo limitado.
- CUANDO la prueba termina bien pero **había datos en el almacén viejo y la migración no
  termina bien**, ENTONCES el sistema queda en modo limitado, con un aviso que dice que
  **no se pudieron copiar los datos** y por qué. Estar en modo normal exige que el
  cuaderno del almacén nuevo esté completo, no solo que el almacén se pueda abrir.
- MIENTRAS el sistema está en modo iniciando —la prueba todavía no terminó— ENTONCES
  **ninguna operación que cambie datos está habilitada**: si el usuario la intenta, se
  le dice que el cuaderno todavía se está cargando y no se escribe nada.
- SI la lectura inicial **nunca** termina, ENTONCES el sistema declara modo limitado
  después del plazo fijo, con un aviso que dice que el almacén nuevo no respondió a
  tiempo, y sigue funcionando con el almacén viejo.
- MIENTRAS el sistema está en modo limitado, ENTONCES avisa **una vez por sesión** que
  está en modo limitado, y sigue funcionando.
- MIENTRAS el sistema está en modo limitado, ENTONCES conserva el aviso de espacio
  casi lleno, el bloqueo preventivo y la reversión completa, con las mismas reglas y
  los mismos textos de hoy.
- EL SISTEMA **nunca cambia de modo por un fallo de escritura posterior**: sigue en el
  modo en que está, avisa, revierte y sigue funcionando. Lo único que puede cambiar el
  modo es el vuelco del arranque.
- SI el almacén nuevo aparece **después** de que la app ya decidió el modo, ENTONCES
  el sistema **no cambia de modo en esa sesión**: sigue en modo limitado, guarda en el
  almacén viejo y funciona. En el próximo arranque la prueba de disponibilidad corre
  otra vez, y si el almacén nuevo ya está, la app entra en modo normal y migra si
  corresponde. Nada se pierde en la espera: el almacén viejo queda entero.
- EL SISTEMA nunca se queda sin guardar por estar en modo limitado: guarda en el
  almacén viejo, y avisa.

---

### RF-7 — Lo que no se puede probar sin navegador se prueba en el navegador, y queda escrito

**Descripción.** Este es el requisito que protege la especificación de sí misma.
El almacén nuevo no existe en Node, así que **el comportamiento del almacén en sí**
no lo puede verificar el runner del proyecto. Y las pruebas que hoy protegen los
datos del usuario están escritas contra el almacén viejo: se tienen que **reescribir**
contra el nuevo, no solo adaptar.

Cada protección, con su comprobación. La columna de hoy dice dónde está probada; la de
después dice qué tiene que quedar:

| # | Protección | Cómo se comprueba hoy | Qué tiene que quedar después |
|---|------------|----------------------|-----------------------------|
| 1 | **Espacio**: con el almacenamiento lleno no se escribe nada | Se siembra casi 5 MB y la escritura se rehúsa antes de escribir; y liberado el espacio, se puede volver a escribir | La misma protección, contra el almacén nuevo: una escritura que no entra no deja nada escrito, y con espacio vuelve a andar |
| 2 | **Lectura que falla**: si no se puede leer lo anterior, no se escribe nada | Se rompe la lectura: no lanza, devuelve que no pudo guardar y lo anterior queda byte por byte | Igual, contra el almacén nuevo, y también contra el viejo en modo limitado |
| 3 | **Reversión que falla**: si no se puede ni escribir ni volver atrás, no se rompe la pantalla | Se rompe la escritura también en el camino de revertir: no lanza | Igual, en los dos almacenes |
| 4 | **Deshacer**: si un cambio no se pudo guardar, no queda en memoria | Se rompe la escritura en un cambio real y después se guarda: lo que no se pudo guardar no aparece | Igual, en los dos almacenes. **Es la que arregla el defecto 3**: la anotación del calendario que hoy no tiene ninguna protección |
| 5 | **Acumulación**: dos cambios seguidos con el almacenamiento roto no acumulan nada, y deshacer no borra lo que estaba guardado | Dos cambios seguidos con la escritura rota; y una reversión que no borra el respaldo del almacenamiento | Igual, en los dos almacenes |

Las cinco existen hoy, en `test/navegador.test.js` desde la línea 226, y hoy pasan.
**Después tienen que seguir existiendo las cinco, cada una con una comprobación que
falla si deja de estar.** Reorganizarlas, agruparlas o renombrarlas está permitido;
borrar una está prohibido.

**Criterios de aceptación**

- Las cinco protecciones que existen hoy **siguen existiendo** después del cambio, y
  cada una tiene **una comprobación que falla si deja de estar**. Las cinco existen
  hoy; después no puede haber menos.
- CUANDO algo del comportamiento nuevo depende del almacén del navegador, entonces se
  verifica abriendo el navegador, y **el resultado queda escrito en el proyecto**, en
  `specs/007-almacenamiento-real/verificacion-navegador.md`: qué se probó, cómo se
  probó, qué se vio y con qué fecha. Si el resultado no está en ese archivo, el
  requisito **no** está cumplido. Ese archivo es donde se lee después.
- CUANDO algo no se puede verificar de otra manera, entonces se anota como verificación
  pendiente y con qué se tapó. No se aprueba como "probado" algo que solo se probó en
  su camino sin importancia.
- CUANDO se arme el checklist de verificación de esta especificación, ENTONCES **cada
  punto** declara si se puede comprobar sin abrir Chrome o si necesita el navegador, y
  **no queda ningún punto sin decirlo**. Lo que solo se puede comprobar en el navegador
  es, como mínimo: que el almacén nuevo exista y guarde en este navegador; que la
  copia automática se genere al abrirse; que los dos casos de fallo del almacén
  (no disponible, y llenado) produzcan su aviso en la pantalla; y que la segunda
  pestaña no escriba encima. Y la medición de la premisa del visor de PDF sin red, que
  está detallada abajo y tiene nombre propio.

**La medición de la premisa del visor de PDF.** Tiene nombre propio, porque es la
medición de la que depende una promesa de RF-1, y una promesa que depende de una
medición que no se hizo no es una promesa: **la medición del respaldo automático del
visor de PDF bajo `file://` sin red**.

| Qué | Cómo |
|-----|------|
| **Qué se mide** | Que el visor de PDF abre un documento **sin conexión a la red**, cayendo a su worker simulado en el hilo principal. Y también que **no se rompe la interfaz**: que la espera por el fallo de la petición no la deja sin responder |
| **Cómo se mide** | En Chrome, abierto desde el archivo como la app se usa, **con la red desconectada de verdad** (apagando el Wi-Fi, no simulándolo), abriendo un PDF corto y uno grande, y mirando: si abre, cuántas páginas, y si la interfaz responde mientras tanto |
| **Dónde queda escrito** | En `specs/007-almacenamiento-real/verificacion-navegador.md`, con el resultado. Si da negativo, **se escribe que dio negativo** |
| **Qué pasa si da negativo** | Los PDF no abren sin red. Eso se dice en el documento de resultados y se vuelve a la decisión, porque la premisa de RF-1 se cae. No se deja "funciona" en un requisito que no se comprobó |
- Las decisiones sobre si una escritura entra (capacidad, umbral, espacio disponible)
  **siguen siendo comprobables sin navegador**, con valores que entran por parámetro.
- Las pruebas de escritura se escriben primero, se ven fallar, y recién ahí se
  escribe el código que las hace pasar.
- Las redes que vigilan el código se rompen a propósito para confirmar que siguen
  mirando lo que deben mirar.
- La red que vigila el orden de los scripts **no cambia**: `vendor/` no entra en la
  comparación, y esa comparación tiene que seguir dando lo mismo que hoy.

## Requisitos no funcionales

| ID | Requisito | Verificación |
|----|-----------|--------------|
| RNF-1 | El proyecto no gana dependencias: sigue sin `package.json` y sin `node_modules` | `Test-Path` → `False` en los dos |
| RNF-2 | La aplicación se sigue abriendo con doble clic, sin servidor y sin instalar nada | Se abre desde el disco y funciona |
| RNF-3 | **Ningún dato del usuario sale de la computadora.** Hay una excepción y está con nombre: el worker del visor de PDF se pide al CDN, y ese archivo no lleva datos del usuario | En el navegador, con la app abierta y sin abrir ningún documento, la red no muestra ninguna petición a un origen externo. Con un PDF abierto, la única petición externa es la del worker, y se comprueba que no lleva nada del cuaderno. Lo que pida el contenido de un documento que el usuario abre no es de la app: queda fuera de alcance y escrito en RF-1 |
| RNF-4 | **No se pierde ninguna protección.** Las cinco protecciones de escritura de hoy siguen teniendo una comprobación que falle si dejan de estar, en los dos almacenes. Reescribir, agrupar o renombrar pruebas puede cambiar la cuenta y no es un problema: **la cuenta de tests deja de ser el requisito** — un número escrito a mano se desincroniza solo y además premia la forma de agrupar | `node --test` → `fail 0`, más una comprobación por cada una de las cinco protecciones de RF-7 |
| RNF-5 | Con el almacén nuevo disponible, un cuaderno de 200 MB se guarda entero y se vuelve a leer, sin avisar de espacio | Medición en Chrome, con el resultado escrito (abajo) |
| RNF-6 | Nada de lo que se ve cambia, **salvo lo enumerado abajo** | La comparación del árbol da IDÉNTICO, el flujo completo se prueba a mano en el navegador, y cada texto nuevo, cada texto que desaparece, el cambio de origen de las fuentes y cada cambio de comportamiento están en la lista de abajo |
| RNF-7 | Todo lo nuevo está en español, en UTF-8 sin BOM. **`vendor/` queda exceptuado**: es código de terceros y no se traduce | La sonda de caracteres raros y la de codificación, con `vendor/` agregado a las exclusiones — y solo esa sonda: las demás herramientas ya solo miran `js/` (ver RF-1) |
| RNF-8 | El umbral de espacio y el cálculo de capacidad siguen siendo lógica comprobable, sin pantalla y sin reloj. Incluye el criterio del bloqueo preventivo: con capacidad cero o menos, `puedeEscribir()` **no** permite escribir | Los tests de lógica pura siguen verdes y crecen, y hay uno que pasa una capacidad de cero y espera el bloqueo |
| RNF-9 | Los datos raros de un respaldo importado no rompen la aplicación: **se completan igual que hoy, sin cambios**, se anotan, y no se borra nada. Incluye el nombre de un documento que trae algo con pinta de HTML: se muestra literal | Importar un respaldo con datos raros: la app arranca y avisa |

> **Qué significa "se completan", sin dejar margen.** Significa **exactamente lo que
> significa hoy**: la app ya normaliza lo que importa (hoy, al importar, en
> `js/app.js:1297`), completa lo que falta, anota el problema en el aviso de arriba y
> **no descarta nada del archivo**. Esta especificación no cambia ese criterio ni
> inventa campos nuevos: lo que hace es extenderlo a los otros tres grupos, que hasta
> hoy ni siquiera entraban al importar.
>
> Los datos raros que tienen que quedar cubiertos, y que ninguno borra nada:
>
> | Qué trae el respaldo | Qué hace la app |
> |---------------------|------------------|
> | Una materia sin lista de documentos | La completa y la muestra; el aviso nombra el problema |
> | Un tipo de anotación que no existe | Se muestra igual, con la clase fija `sin-tipo`. **No se esconde**: esconderla sería perderla |
> | Un documento al que le falta el contenido | Se muestra, y el aviso lo nombra |
> | Un **nombre de documento que trae algo con pinta de HTML** (`informe" onload="…"`), que es el caso de `AGENTS.md` | Se muestra **literal**, porque el nombre entra al DOM por `.textContent` o por `title`, nunca por `innerHTML`. No se ejecuta, y no se "limpia" el texto: limpiarlo sería cambiar el nombre que el usuario le puso |
>
> Ninguno de estos casos cambia de comportamiento con esta especificación: ya están
> cubiertos. Se enumeran porque un requisito que dice "no se rompe" sin decir con qué
> datos raros no se puede dar por cumplido ni por fallado.

> **Sobre RNF-5, con honestidad:** el tamaño que entra depende del disco de la
> máquina, no de la app. El navegador le reserva una parte del espacio libre. Por eso
> el requisito habla de 200 MB **con el almacén nuevo disponible**, no de una
> promesa general.
>
> **Qué son los 200 MB, y por qué está escrito con tanto detalle.** Sin esto, el
> requisito no se puede dar por cumplido ni por fallado, porque "un cuaderno de
> 200 MB" admite mil preparaciones distintas:
>
> - **Qué son:** los **datos del usuario, medidos como ocupa el cuaderno hoy**, con
>   los archivos en base64 como hoy están. Si no, la comparación con el tope de 5 MB
>   sería tramposa y el requisito no mediría lo que dice medir.
> - **De dónde sale el conjunto:** de un conjunto de datos **preparado a mano** con la
>   misma forma que un cuaderno real (materias, documentos con contenido, minutos y
>   anotaciones), guardado en el proyecto para que se pueda repetir la medición. Si el
>   conjunto fuera generado al azar, el número de la medición no serviría para
>   comparar con nada.
> - **En qué entorno se mide:** en Chrome abierto desde el archivo, como la app se
>   usa (doble clic), en modo normal, en la computadora donde vive el cuaderno. Si se
>   mide en otro lado, el resultado dice dónde.
> - **Dónde queda escrito el resultado:** en
>   `specs/007-almacenamiento-real/medicion-200mb.md`, con fecha, tamaño del conjunto,
>   navegador, tiempo de escritura y tiempo de lectura. Sin ese archivo, RNF-5 no
>   está cumplido.
> - **El tiempo no es un requisito.** Se anota lo que tardar, pero no se pone un tope:
>   un tope de tiempo dependería de la máquina.
> - **La cifra de "3,5 MB de PDF" es una estimación derivada** del 33 % de base64
>   sobre el tope de ~5 MB, no una medición. Ver Defecto 2.

> **Sobre RNF-6, la lista completa.** Nada de lo que se ve cambia, y esta es toda la
> lista de lo que cambia. No hay otras:
>
> **Textos nuevos:**
>
> 1. Aviso de modo limitado (con la causa: no disponible, o no respondió a tiempo, o
>    no se pudieron copiar los datos).
> 2. Aviso de que se generó la copia automática, con el contenido de RF-5.
> 3. Aviso de que la copia automática no se pudo hacer, con qué dato no se pudo leer.
> 4. Aviso de migración completada: qué se copió y que lo anterior quedó de respaldo.
> 5. Aviso de migración que no se pudo completar, con la causa.
> 6. Aviso de fallo de escritura con la causa nombrada (modo normal).
> 7. Aviso de que no se pudo guardar, sin causa, cuando el error no la dice.
> 8. Aviso de que el cuaderno ya está abierto en otra pestaña.
> 9. Aviso de que el PDF se está procesando en el hilo principal porque no se pudo
>    traer el worker del CDN, y de que la interfaz puede quedar unos segundos sin
>    responder.
> 10. Aviso de que el cuaderno todavía se está cargando, mientras está en modo iniciando.
> 11. Aviso de que la copia automática se generó pero **la fecha no se pudo guardar**,
>     así que puede volver a aparecer.
>
> **Textos que cambian de contenido:** el de "no se pudo guardar lo importado" (hoy es
> una ventana; sigue siéndolo, porque responde a una pregunta modal, y lo que cambia
> es que nombra la causa cuando la hay), y el de confirmación de importar (nombra los
> datos que se van a perder; ver RF-5 y el caso límite).
>
> **Texto que desaparece:** el de "casi lleno", **solo en modo normal**. En modo
> limitado queda igual que hoy. Es una decisión explícita.
>
> **Cambio de código sin cambio de lo que se ve:** los `<link>` de Google Fonts de
> `index.html:7-9` se reemplazan por los archivos locales de `vendor/fonts/`. Lo que se
> ve es **la misma tipografía**: mismas familias y mismos pesos (RF-1). Esta es la
> excepción de RNF-6 que no es un texto nuevo, y también es intencional: cambiar de
> dónde vienen las fuentes no cambia cómo se ve, al contrario que sacarlas del todo.
>
> **Cambio de comportamiento, declarado a propósito:** con el cuaderno abierto en dos
> pestañas, **hoy gana la última escritura**; después, **la segunda pestaña avisa y
> no guarda encima**. Es el único cambio de comportamiento que no es un texto nuevo, y
> es intencional: el criterio del proyecto ante la duda es que el camino que conserva
> datos es el que no hace nada.

## Casos límite

### La migración se corta a la mitad

El usuario cierra la pestaña mientras se copia. El cuaderno no puede quedar partido.

Lo que se decide: **se vuelve a intentar desde el principio** en la siguiente apertura
—porque el almacén nuevo sigue sin la marca de migración terminada, así que la regla
única se vuelve a cumplir—, y lo viejo queda entero, porque no se borra nada hasta
terminar. Mientras tanto no se habilita ninguna operación que cambie datos y lo que
se ve es el cuaderno del almacén viejo, que está entero.

### La migración falla porque no hay espacio o falla el disco

No es lo mismo que cerrarse la pestaña. Acá la copia no terminó y el almacén nuevo
quedó a medio llenar.

Lo que se decide: la app **no entra en modo normal**, porque el cuaderno en modo normal
es el del almacén nuevo y ese cuaderno no está. Entra en **modo limitado** con un
aviso que dice que **no se pudieron copiar los datos** y por qué, y sigue
funcionando con el almacén viejo, que está entero. No hay copia a medias de la que
fiarse: o el cuaderno del nuevo está completo, o no se usa.

En el siguiente arranque, la regla única se cumple otra vez (el nuevo sigue sin la
marca) y se reintenta desde el principio, sobrescribiendo lo que quedó a medias. Si
vuelve a fallar, avisa otra vez.

### El almacén nuevo no está disponible

Se aplica RF-6: modo limitado, aviso **con la causa**, la app sigue funcionando con el
almacén viejo y con sus avisos de siempre. Y no se intenta migrar: **mientras el
almacén nuevo no esté disponible, ni ahora ni en ningún arranque posterior**. Si el
almacén nuevo aparece —en otro navegador o en el mismo, ya con red— alcanza con que
esté disponible en el próximo arranque: ahí corre, si quedan las otras dos condiciones
de la regla. No hay botón de reintentar a mano (ver Dudas abiertas).

### El almacén nuevo aparece tarde, con la app ya abierta

El modo se decidió en el arranque y **esa sesión no lo cambia**. La app sigue en modo
limitado durante esa sesión, avisa una vez, guarda en el almacén viejo y funciona. En
el próximo arranque, si el almacén nuevo está disponible, arranca en modo normal y
migra. Nada se pierde en la espera: lo viejo sigue entero, y esperar un arranque no
es lo mismo que perder el respaldo.

### La lectura inicial nunca termina

Es el tercer estado, y no es "no se puede leer": es "todavía no se sabe". La app
arranca, se dibuja, y queda en modo iniciando. Mientras está ahí, ninguna operación
que cambie datos está habilitada, y si el usuario la intenta se le dice que el
cuaderno se está cargando. Si la lectura no termina nunca, después del plazo fijo la
app declara modo limitado con el aviso que dice que el almacén nuevo no respondió a
tiempo, y sigue funcionando.

### El navegador se queda sin disco

La escritura falla con un error que puede no ser de cuota. **La app no puede
distinguir "no hay cuota" de "no hay disco"**: los dos llegan como errores del
almacenamiento y el navegador no siempre los distingue. Por eso:

- SI el error **nombra** la causa, el aviso nombra esa causa.
- SI el error **no** la nombra, el aviso dice que no se pudo guardar, sin inventar
  causa, y ofrece exportar igual.
- EL SISTEMA **no cambia de modo**: sigue en modo normal, cada escritura que falla
  avisa y revierte, y sigue funcionando con lo que ya estaba guardado. No propone
  modo limitado, porque el modo se decidió en el arranque y una escritura que falla
  no lo cambia.

Decir lo que uno sabe, en cada camino: es la misma lección de "casi lleno (0 % de 95 %)",
un mensaje que mostraba un porcentaje que no correspondía con lo que estaba pasando.

### El cuaderno está abierto en dos pestañas

El usuario hace doble clic dos veces. Hoy el almacén viejo tiene una regla simple: la
última escritura gana. Con el almacén nuevo, dos pestañas escribiendo a la vez pueden
pisarse.

Lo que se decide: **la segunda pestaña avisa que el cuaderno ya está abierto en otra y
no guarda encima.** Es el mismo criterio que ya aplica el proyecto ante la duda: el
camino que conserva datos es el que no hace nada.

**Qué se detecta exactamente:** no "hay otra pestaña", sino "**otra pestaña escribió
desde que yo leí**". La app guarda en qué momento leyó el cuaderno y lo compara antes
de cada escritura: si cambió, no escribe y avisa. Detectar "hay otra pestaña"
exigiría coordinarse con navegadores que no dicen nada, y daría falsos positivos con
una pestaña sola que quedó abierta.

**En qué modo aplica: en los dos.** La regla no depende del almacén: depende de que
pisar lo que la otra pestaña guardó sea perder datos. Y en modo limitado **importa
más**, no menos: ahí el muro de 5 MB sigue existiendo, así que un dato pisado no se
puede recuperar de ningún lado. Por eso la segunda pestaña **tampoco guarda nada en
modo limitado**, y no es una excepción caritativa.

**Y los minutos también se revierten, sin excepción.** Los minutos de estudio por
secciones y los del Pomodoro son datos del usuario como los otros, y van por el mismo
camino: en la segunda pestaña **se revierten y avisan**, igual que una materia o una
anotación. No hay una excepción caritativa para ellos. Se acepta perderlos antes que
pisar lo que la primera pestaña guardó, y el precio es visible, no silencioso: es el
caso más normal de estudiar —dejar la app abierta de fondo y abrir otra pestaña—, así
que el usuario se va a enterar. Lo que evita que se entere tarde es el reaparecimiento
del aviso, que está en el párrafo siguiente.

Y como el aviso es una vez por sesión, hay un problema real: el usuario puede perder
minutos del Pomodoro media hora sin volver a ver la causa. Por eso el aviso **vuelve
a aparecer si el rechazo vuelve a ocurrir más tarde**, y no se repite mientras el
usuario insiste sin hacer nada (ver la tabla de frecuencias). Recargar la pestaña es
lo que la deja ser la dueña, y el aviso lo dice.

**Y las dos copias, en la segunda pestaña:**

| Operación | En la segunda pestaña |
|-----------|----------------------|
| Exportar a mano | **Funciona.** Arma el archivo desde lo que esa pestaña tiene. No actualiza la fecha de última copia, porque esa fecha es una escritura, y ahí no se escribe: si no, la primera pestaña dejaría de generar su propia copia automática sin avisar |
| Copia automática | **No se genera.** Generarla exige guardar la fecha de última copia. La segunda pestaña avisa que el cuaderno está abierto en otra, y la copia la hace la primera pestaña |
| Leer y usar la app | **Funciona.** Solo no se escribe |

Después del aviso, lo que puede hacer la segunda pestaña es recargar, y ahí pasa a
ser la dueña. Perder lo que la primera pestaña acaba de guardar no es aceptable, ni
por comodidad.

### Dos pestañas nuevas abiertas a la vez

El caso más borde de este: el usuario hace doble clic dos veces **seguidas**, antes de
que ninguna escriba nada. Las dos se leen el cuaderno, las dos ven que nadie escribió
desde que ellas leyeron, y **las dos se creen la dueña**. Ninguna de las dos va a
avisar, porque a ninguna le consta que haya otra.

Lo que se decide: **se tolera, a propósito.** No se agrega un candado ni un aviso
preventivo. El motivo es que el daño real es chico y acotado: las dos escriben cosas
que existían en el mismo estado, así que lo que se pisa es un cambio de cada una, y la
que pierde es la segunda. La copia automática de esa apertura también puede salir dos
veces, con nombres distintos (llevan la hora), y eso es ruido en la carpeta de
descargas, no pérdida de datos.

Lo que **no** se tolera es lo de verdad: que una segunda pestaña que ya estaba abierta
pise lo que la primera guardó después. Eso sí está frenado. Si la consecuencia de este
caso resultara molesta en el uso real, se anota como deuda y se resuelve aparte: hoy
no se le agrega complejidad a un caso que no rompe nada.

### El navegador bloquea la descarga de la copia automática

Chrome pide permiso para descargas múltiples la primera vez, y el usuario puede
negarlo. **Este caso no tiene regla posible**, y por eso está escrito: con un enlace
de descarga **no hay forma de saber** si la descarga ocurrió, si se bloqueó, ni dónde
quedó el archivo.

Lo que se decide: el aviso dice que **se generó una copia** y que la app **no puede
confirmar** que haya llegado ni dónde quedó (RF-5). Un aviso que dice "copia hecha y
guardada en tu carpeta de descargas" cuando eso no se sabe es peor que no avisar. La
vía de estar seguro es el botón de exportar, que sí le pregunta antes al usuario.

### Se limpia el almacenamiento del navegador desde el menú de Chrome

Este escenario destruye los dos almacenes por igual. La copia automática es la única
salida, y por eso tiene que ser completa, automática y visible: un archivo en el
disco, no una copia dentro del mismo almacenamiento que se está limpiando.

Lo que se decide además: como los dos almacenes quedan vacíos, **no hay nada que
migrar** y el sistema **no avisa de migración**. La marca de "migración terminada" se
fue con todo lo demás, pero la condición 2 de la regla única (datos en el almacén viejo)
ya no se cumple, así que no hay reintento. La app arranca vacía, como una app nueva.

### Un documento abierto mientras se migra

La migración no interrumpe lo que el usuario está haciendo. El documento que ya está
abierto **se sigue viendo con el contenido con el que se abrió**, y no se recarga ni
se reemplaza a mitad de la copia.

Cuando el usuario lo cierre y lo vuelva a abrir, lo verá desde el almacén que quedó
siendo el cuaderno (el nuevo), con **el mismo contenido**: la migración copia, no
transforma. Por lo tanto no hay ningún cambio en lo que se ve, ni un instante.

### Importar sobre un cuaderno con datos más nuevos

Importar **reemplaza**, no combina. Se mantiene la semántica de hoy, que sobrescribe;
lo que cambia es que el aviso previo **nombra lo que se va a perder**.

Lo que se decide: antes de reemplazar nada, el sistema pide confirmación y el mensaje
**nombra los cuatro grupos**: las materias con sus documentos, los minutos de
Pomodoro, los minutos de estudio por secciones y las anotaciones del calendario. La
confirmación tiene que dejar claro que lo que se importa **reemplaza** a eso, no que
se agrega a eso. Importar un respaldo no es "traer algo más".

Y con las dos protecciones que ya existen: si lo importado no se puede guardar, **no
se pisa nada** y se avisa que los datos siguen como estaban; y si el archivo trae
datos raros, se completan, se anotan y no se borra nada del archivo (RNF-9).

Consecuencia que hay que decir de frente: como la copia automática ahora incluye los
cuatro grupos (RF-5), importar una copia hecha con esta versión devuelve todo. Importar
una copia hecha **con la versión anterior** devuelve solo las materias, y por eso el
aviso previo tiene que seguir nombrando los otros tres grupos.

### Dos copias el mismo día, o una automática y una a mano

Los nombres no chocan: la automática lleva fecha **y hora hasta el segundo**. El
sistema **no comprueba** si el archivo ya existe, porque con un enlace de descarga no
se puede saber, y por eso no avisa de un choque que quizá no existe.

### Un respaldo importado con datos raros

Una materia sin lista de documentos, un tipo de anotación que no existe, un
documento al que le falta el contenido: la aplicación arranca, avisa arriba y
**no borra nada**. Es la regla que ya está escrita en el proyecto y este requisito
no la cambia.

### La escritura falla y no hay nada que revertir

Cuando lo que estaba guardado era nada (por ejemplo la primera anotación), el sistema
no tiene a qué volver atrás: no deja una entrada a medias y avisa. Es el mismo caso
que hoy.

## Fuera de alcance

- **Escritorio de cualquier tipo.** Tauri y Electron fueron descartados por el
  usuario. La PWA se descartó también: no aporta nada que los dos pasos que sí van
  no den, y obliga a servir la app por http, rompiendo el doble clic.
- **Achicar `app.js` más allá de lo que haga falta para esta especificación.** No es
  el objetivo acá, y mezclar las dos cosas hace que ninguna se pueda demostrar.
- **Actualizar las librerías.** Se traen las que están en uso. Subir la versión es
  otro trabajo, con sus propios riesgos.
- **Hacer que el worker del visor de PDF funcione en local.** Decidido el 2026-10-04:
  sigue en el CDN y se confía en el respaldo automático. Los dos caminos locales están
  medidos y cortados bajo `file://`, y hacerlos andar sería un trabajo de
  investigación propio, con sus propios riesgos. Acá lo que corresponde es **medir la
  premisa y decir la verdad** (RF-7).
- **Dejar de guardar los archivos en base64.** Aunque el almacén nuevo lo permita y
  ocupara un 33 % menos, cambiar la forma en que se guarda el contenido toca el
  visor y es otro proyecto.
- **Que el contenido de un documento no salga a internet.** Un documento guardado por
  el usuario que apunta a una imagen o a una hoja de estilos externa se sigue
  mostrando como hoy. Cambiar eso es otra especificación, y acá queda escrito que no
  se cambia.
- **Una forma de volver al modo normal a mano.** Decidido el 2026-10-04: si el almacén
  nuevo no está disponible, no se reintenta automáticamente. Agregar un botón para
  reintentarlo es alcance nuevo (ver Dudas abiertas).
- **Conectar el módulo de consentimiento por terceros.** Decidido el 2026-10-02:
  sin identidades ni servidor no hay cuaderno ajeno, y un control de privacidad
  que no controla nada es peor que no tenerlo.
- **Borrar el código muerto que ya se conoce** (el que está declarado en las
  excepciones de la sonda). Se anota, no se mezcla con esto.
- **Un tope de tiempo** para guardar o para leer el cuaderno. Se anota en la
  medición, no se exige.

## Criterios de finalización

- [ ] Hay un commit con el estado actual del proyecto, hecho **antes** del primer
      cambio de código, con un `.gitignore` que deja afuera `New Project/`, `.npmrc`,
      `skills-lock.json`, `package-lock.json`, `.agents/` y `.opencode/`, y con la
      lista de archivos versionados comprobada (RF-0)
- [ ] Sin internet: un Word se convierte y se abre, y **la tipografía se ve igual**
      (RF-1)
- [ ] Con la app abierta y **sin ningún documento abierto**, la red no muestra ninguna
      petición a un origen externo (RF-1)
- [ ] `mammoth`, el visor de PDF y los archivos de las dos familias están en `vendor/`,
      fuera de `js/`, con los mismos pesos de fuente que hoy, y **el worker del PDF
      sigue yendo al CDN** (RF-1)
- [ ] Abriendo un PDF hay **una sola** petición a un origen externo, y es la del worker
      (RF-1, RNF-3)
- [ ] **Medida la premisa del respaldo del visor de PDF bajo `file://` sin red**, con
      el resultado escrito en `verificacion-navegador.md`, aunque haya dado negativo
      (RF-1, RF-7)
- [ ] Cuando el visor cae al hilo principal, el aviso aparece **en la página** con las
      tres cosas que dice RF-1 (RF-1)
- [ ] El peso total de `vendor/` quedó anotado (RF-1)
- [ ] La lista de scripts probados en Node **no cambió**, y ninguna herramienta nueva
      quedó excluida (RF-1)
- [ ] La sonda de caracteres raros tiene `vendor/` entre sus exclusiones y sigue
      saliendo con "Nada fuera de lugar" (RF-1, RNF-7)
- [ ] El cuaderno se guarda en el almacén nuevo y sigue ahí al recargar (RF-2)
- [ ] En modo normal no aparece el aviso de "casi lleno", y en modo limitado aparece
      igual que hoy (RF-2, RF-6)
- [ ] Un cuaderno de 200 MB se guarda y se vuelve a leer, con el resultado escrito en
      `specs/007-almacenamiento-real/medicion-200mb.md` (RNF-5)
- [ ] Los cuatro grupos de datos se escriben por caminos que dan las tres garantías, y
      **cada garantía está comprobada en los dos almacenes** (RF-3)
- [ ] Una anotación del calendario que no se puede guardar avisa, revierte y no queda
      a medias: el defecto 3 está arreglado (RF-3)
- [ ] Los datos que ya estaban guardados se copian al almacén nuevo, lo viejo queda
      intacto y todo sigue visible (RF-4)
- [ ] La migración se puede interrumpir sin dejar el cuaderno a medias, y el reintento
      pasa por la misma regla (RF-4)
- [ ] Con el almacén nuevo no disponible, la app arranca igual, avisa por qué, **no
      intenta migrar mientras siga sin estar disponible** y sigue guardando (RF-6)
- [ ] La copia automática sale a los 7 días, **dice que se generó una copia** y que no
      puede confirmar dónde quedó, e incluye los cuatro grupos (RF-5)
- [ ] Sin fecha de última copia, la copia está pendiente: la primera apertura la arma
      (RF-4, RF-5)
- [ ] La copia automática se arma con la hora en el nombre y no con la fecha sola
      (RF-5)
- [ ] Importar una copia devuelve también el historial de estudio y las anotaciones,
      y el aviso previo nombra los cuatro grupos que se van a perder (RF-5)
- [ ] Con dos pestañas, en **los dos modos**, la segunda avisa y no guarda encima, el
      aviso reaparece si el rechazo vuelve a ocurrir más tarde, y la copia automática
      la hace la primera (caso límite)
- [ ] Las cinco protecciones de RF-7 siguen existiendo, cada una con su comprobación,
      en los dos almacenes (RF-7, RNF-4)
- [ ] La parte que solo se puede probar en el navegador está probada en el navegador y
      el resultado quedó escrito en
      `specs/007-almacenamiento-real/verificacion-navegador.md` (RF-7)
- [ ] El checklist de verificación dice, punto por punto, **qué partes no se pueden
      comprobar sin abrir Chrome** (RF-7)
- [ ] La comparación del árbol del menú lateral da IDÉNTICO
- [ ] Las sondas de calidad dan lo mismo que hoy: sin `package.json`, sin
      `node_modules`, nada fuera de lugar, nada que limpiar, todo entra
- [ ] En el navegador: consola con 0 errores, todo legible a 375 px sin scroll
      horizontal
- [ ] **`docs/constitucion.md` está actualizado** (ver abajo)
- [ ] `AGENTS.md` y `MEMORY.md` están al día

### Qué hay que actualizar en `docs/constitucion.md`, punto por punto

La constitución misma dice que hay que actualizarla cuando deja de ser cierta, y con
este trabajo deja de ser cierta en varios lugares concretos:

| Dónde | Qué queda falso y hay que cambiar |
|-------|----------------------------------|
| Principio 1 | Dice que las librerías externas están "ya incluidas en `index.html`", y las nombra dos. Ahora las que se traen son **`mammoth`, el visor de PDF y las fuentes**, en `vendor/`, en la raíz y fuera de `js/`, hay que decir por qué, y hay que **agregar la excepción**: el worker del visor de PDF sigue yendo al CDN |
| Principio 2 | El árbol de `AGENTS.md` tiene que incluir `vendor/` (con sus dos contenidos) y `package-lock.json` como lo que no es de la app |
| Principio 5 | El límite de "~5 MB" y el "33 %" siguen siendo ciertos **en modo limitado**. Hay que aclararlo: en modo normal ese muro no existe, y el aviso de espacio cambia con el modo |
| Principio 5 | El bloque del "respaldo está en el JSON descargado": hoy el JSON no trae los minutos ni el calendario. Después sí, y eso hay que decirlo |
| Principio 6 | Hay que declarar que `vendor/` es la excepción: código de terceros, no se traduce |
| Tabla de estado | La fila de Principio 5 dice "Datos seguros ✅ El aviso de almacenamiento y la reversión **ya están implementados**". Sigue siendo cierto y hay que **sumarle** que ahora las anotaciones del calendario también están protegidas, y que hay un modo limitado con su propio aviso |
| Tabla de estado | La fila de Principio 4 dice "91 tests con Node". La cifra está desactualizada y, con RNF-4, **la cifra dejó de ser el requisito**: lo que se exige es que las cinco protecciones tengan comprobación |
| Glosario | No hay entrada para el almacén nuevo, ni para el modo limitado, ni para el modo iniciando, ni para `vendor/`. Hay que agregarlas |

## Decisiones tomadas en esta especificación

| Decisión | Respuesta | Quién | Fecha |
|----------|-----------|-------|-------|
| ¿Aplicación de escritorio? | **No.** Tauri, Electron y PWA quedan descartados | Usuario | 2026-10-04 |
| ¿Cada cuánto se hace la copia automática? | **Cada 7 días**, al abrir la aplicación | Usuario | 2026-10-04 |
| ¿La copia automática avisa o es silenciosa? | **Avisa**, diciendo que se generó una copia | Usuario | 2026-10-04 |
| ¿La copia automática **dónde quedó**? | **No se puede saber y no se dice.** Con un enlace de descarga sobre un archivo en memoria no hay forma de saber si la descarga ocurrió ni dónde quedó. El aviso dice que se generó una copia, qué incluye, y que la app no puede confirmarlo | Usuario | 2026-10-04 |
| ¿Qué pasa con los datos que ya están en el almacén viejo? | **Se copian y lo viejo queda intacto.** No se borra nada | Usuario | 2026-10-04 |
| ¿La copia automática incluye los minutos y el calendario? | **Sí, todo.** Hoy la exportación solo incluye las materias | Usuario | 2026-10-04 |
| ¿Importar combina o reemplaza? | **Reemplaza**, como hoy. Lo que se agrega es que el aviso previo **nombra los cuatro grupos que se van a perder** | Usuario | 2026-10-04 |
| ¿Qué pasa si el almacén nuevo no está disponible? | **Se vuelve al viejo avisando**, y la app sigue funcionando | Usuario | 2026-10-04 |
| ¿Cuántas veces se migra? | **Una sola vez.** Si el almacén nuevo no está disponible, la app entra en modo limitado y **no vuelve a intentar migrar automáticamente** | Usuario | 2026-10-04 |
| ¿Dónde viven las dos librerías? | `mammoth`, el visor de PDF y las fuentes van a `vendor/`, en la raíz, **fuera de `js/`**, y `vendor/` queda fuera del Principio 6. Lo único que queda en el CDN es el worker del visor | Usuario | 2026-10-04 |
| ¿Y el worker del visor de PDF? | **No se baja.** Sigue apuntando al CDN, como hoy. Sin red, `pdf.js` cae a su worker simulado. Los dos caminos locales ya están medidos y cortados bajo `file://` (`SecurityError` y `TypeError`). La única petición externa que hace la app, con nombre | Usuario | 2026-10-04 |
| ¿Y las fuentes de Google? | **Se self-hosteen en `vendor/fonts/`**, con los mismos nombres y los mismos pesos (Inter 300-700 y Playfair Display 400-700). Es la única de las tres dependencias que no obliga a elegir entre el criterio de red y el diseño: sacarlas del todo rompería RNF-6 | Usuario | 2026-10-04 |
| ¿Por qué `vendor/` y no dentro de `js/`? | Porque `test/dom-falso.js` ejecuta en Node todos los scripts de su lista, y esa lista matchea rutas de `js/` | Verificado | 2026-10-04 |
| ¿Se agrega una forma de reintentar la migración a mano? | **No, queda fuera de alcance.** Si el almacén nuevo no está disponible, la app entra en modo limitado y no reintenta: al siguiente arranque, en otro navegador, la regla se cumple sola. Un botón sería alcance nuevo | Usuario | 2026-10-04 |
| ¿Los minutos se guardan en la segunda pestaña? | **No: se revierten con aviso**, como cualquier otro dato. La regla de no pisar el cuaderno no tiene excepción para ellos. El aviso reaparece si el rechazo vuelve a ocurrir, para que no se pierdan minutos en silencio | Usuario | 2026-10-04 |
| ¿La licencia de lo que se trae? | **Se copia junto al código**, dentro de `vendor/`. Las tipografías tienen su propia licencia de uso y es tan parte de la pieza como los archivos de fuente | Usuario | 2026-10-04 |
| ¿Conectar el módulo de consentimiento? | **No.** Queda como andamiaje, sin llamadores | Usuario | 2026-10-02 |

## Dudas abiertas

- **[MENOR] El plazo fijo de la prueba de disponibilidad y de la lectura inicial**, y
  el intervalo que separa dos avisos de "otra pestaña". La especificación exige que
  ambos sean fijos y cortos, y que el número no se escriba en un texto de la interfaz.
  El valor exacto es cosa del plan, no de acá.

# Spec 009 — Proteger los datos guardados: no se cae, no destruye, avisa

Estado: borrador

## Contexto y objetivo

Hay lecturas y escrituras de los datos del usuario **sin ninguna protección**. Dos consecuencias,
y las dos son pérdida de datos:

1. Si un valor guardado **se corrompe**, la aplicación **no abre**.
2. Si una escritura **falla**, el dato **se pierde sin avisar**.

La constitución dice, por escrito: *"nunca se pierde nada en silencio"*. Hoy eso no es cierto en cuatro
lecturas y en dos escrituras.

**Esto no depende del cambio de almacenamiento**: es un arreglo sobre el de hoy, independiente de la
008. Ver [Fuera de alcance](#fuera-de-alcance).

### El inventario, verificado en el código

Este inventario es **nuevo** y no reemplaza al anterior: aquel decía que había un solo camino sin
protección, y son seis.

| Dato | Dónde se toca hoy | Situación |
|------|-------------------|-----------|
| Cuaderno principal (materias y documentos) | Al arrancar | ✅ Protegido: revisa lo que lee, avisa y no borra |
| El archivo que el usuario importa | Al importar | ✅ Protegido |
| Materias y documentos, al guardar | `guardarRevirtiendoSiFalla` | ✅ Las tres garantías |
| **Minutos del Pomodoro (sesión heredada)** | **Al arrancar** | ❌ Lectura sin protección: si el valor guardado no es un texto válido, **la aplicación no abre** |
| **Minutos de estudio por secciones** | **Al cerrar una sección de estudio** | ❌ Lectura sin protección, y la escritura avisa **solo** si el error es de falta de espacio: con cualquier otro motivo **no dice nada** y el minuto se pierde |
| **Minutos de estudio por secciones** | **Al consultarlos para el mapa de calor** | ❌ Lectura sin protección |
| **Anotaciones del calendario** | **Al abrir el calendario** | ❌ Lectura sin protección |
| **Anotaciones del calendario** | **Al guardar una anotación** | ❌ **Sin ninguna protección**: si la escritura falla, no avisa, no revierte, y al día siguiente la anotación desapareció |

**Son cuatro lecturas sin proteger y dos escrituras con huecos.**

### Una de esas lecturas es delicada, y el motivo está anotado

La función que junta los minutos para el mapa de calor es **pública**: la consume otro archivo, por
eso vive detrás de la API pública y no se puede esconder. **Ya rompió el mapa de calor una vez**:
quedó en blanco con todas las pruebas en verde, y lo detectó abrir Chrome, no el runner. Está
anotado en `MEMORY.md`. Por eso la lectura de los minutos de estudio **no se verifica solo con pruebas
de lógica pura**: se verifica cargando la página como la carga el navegador, que es una red que ya
existe.

### La confusión que hay que evitar: revisar no es borrar

Este trabajo trata de datos corruptos, y esa combinación tiene una forma de terminar en pérdida de
datos que hay que decir de entrada:

> **Un valor que no se puede interpretar no se puede usar, pero tampoco se puede tirar.**

La clase de error a evitar es esta: "revisar el texto" entendido como *"borro lo que no entiendo"*.
No. Si el valor está corrupto, **se avisa y se deja escrito tal como estaba**, intacto, para que el
usuario pueda recuperarlo a mano o exportar lo que sí se pudo leer.

Y al revés también: **completar un valor que sí se pudo leer es lo que ya se hace** con el cuaderno
principal —un documento al que le falta el contenido sigue en el menú, un tipo de anotación que no
existe se muestra en gris— y **no cambia**. Revisar lo legible y descartar lo ilegible son dos cosas
distintas.

## Usuarios

**Un solo usuario: el dueño del cuaderno, en su computadora.** No hay cuentas, ni servidor, ni
equipos compartidos. El único objetivo es que no se le pierda nada de lo que guardó sin que se entere.

## Historias de usuario

- **HU-1.** Como dueño del cuaderno, quiero que la aplicación **abra igual** aunque uno de mis datos
  esté dañado, para no quedarme sin el cuaderno entero por un valor roto.
- **HU-2.** Como dueño del cuaderno, quiero que me **digan qué** no se pudo leer y que no se haya
  borrado nada, para saber si hay que hacer algo o no hacer nada.
- **HU-3.** Como dueño del cuaderno, quiero que una anotación que no se pudo guardar **no aparezca
  igual**, para no enterarme al día siguiente de que no está.

## Definiciones

| Término | Qué significa |
|---------|---------------|
| **Un grupo de datos** | Uno de los cuatro que se guardan por separado: el cuaderno principal, los minutos heredados del Pomodoro, los minutos de estudio por secciones y las anotaciones del calendario |
| **Un valor guardado** | Lo que está escrito en el almacenamiento del navegador para un grupo |
| **No se puede interpretar** | Que el valor no es un texto del formato que el grupo necesita. No es lo mismo que esté vacío, ni que le falte una parte: un valor **vacío o incompleto se puede usar**, un valor que no se puede interpretar, no |
| **Las tres garantías** | No se cae, no destruye, avisa. Ver [La regla](#la-regla) |
| **Causa que el error nombra** | Un motivo que el navegador dice en el error, como la falta de cuota. Si el error no lo dice, no hay causa que anunciar |
| **El cartel de arriba** | El aviso no bloqueante que ya existe para los datos con problemas, con su botón de cerrar |

## La regla

Es la decisión de fondo de esta especificación, y es lo que la hace corta. **No-crash, no-destruir,
avisar.**

**Cuando un valor guardado no se puede leer:**

1. La aplicación **no se cae**.
2. **No lo sobrescribe.** El valor roto se deja donde está, intacto, para que se pueda recuperar.
3. **Avisa** en la pantalla, con un texto que diga qué no se pudo leer.
4. Sigue funcionando con el resto.

**Cuando una escritura no se puede hacer:**

1. **Revierte** lo que se ve en pantalla: el usuario nunca ve algo que no está guardado.
2. **Avisa**, nombrando la causa **solo si el error la nombra**. Si el error no dice por qué, el aviso
   dice que no se pudo guardar **sin inventar causa**.
3. No deja nada a medias.

**El motivo, con sus palabras.** Es el criterio que el proyecto ya aplica en todos lados: *"el camino
que conserva datos es el que no hace nada"*. Y es lo contrario del fallo silencioso, que la
constitución prohíbe por escrito.

## Requisitos funcionales

---

### RF-1 — Una lectura que no se puede hacer no se cae, no destruye nada y avisa

**Descripción.** Los cuatro caminos de lectura sin protección pasan por el mismo criterio, y por eso
no hacen falta cuatro requisitos. Lo que cambia entre ellos es **dónde se rompe la aplicación**, y
eso se nombra abajo.

**Criterios de aceptación**

- SI el valor guardado de un grupo **no se puede interpretar**, ENTONCES el sistema **no lanza**:
  la aplicación abre y sigue funcionando con el resto.
- SI el valor guardado de un grupo **no se puede interpretar**, ENTONCES el sistema **no escribe
  nada** sobre ese valor: queda escrito exactamente como estaba, intacto.
- SI el valor guardado de un grupo **no se puede interpretar**, ENTONCES el sistema **avisa qué
  grupo** no se pudo leer y que **no se borró nada**. El aviso nombra el grupo, no dice genéricamente
  "algo anda mal".
- CUANDO los minutos heredados del Pomodoro **no se pueden interpretar al arrancar**, ENTONCES la
  **aplicación abre igual** y el cuaderno se ve completo.
- CUANDO las anotaciones del calendario **no se pueden interpretar al abrir el calendario**,
  ENTONCES el **calendario abre igual**: muestra los días del mes y las anotaciones que ya estaban
  en memoria, y no rompe.
- CUANDO los minutos de estudio por secciones **no se pueden interpretar al cerrar una sección**,
  ENTONCES la sección se cierra, **el mapa de calor se dibuja** y no queda nada a medias.
- CUANDO los minutos de estudio por secciones **no se pueden interpretar al consultar el mapa de
  calor**, ENTONCES el mapa **se dibuja entero** —las cuatro semanas, con todas sus celdas— y la
  función pública que junta los minutos **devuelve un resultado con la misma forma que devuelve
  cuando no hay minutos**, en vez de lanzar.
- SI no se puede leer lo que estaba guardado, ENTONCES el sistema **no borra, no reescribe y no
  completa** ese valor —tampoco por un valor por defecto que después se vuelva a guardar—, **no
  escribe nada** aunque el usuario haga un cambio, y avisa. El camino que conserva datos es el que
  no hace nada.
- **Completar un valor que sí se pudo leer no cambia**: un documento al que le falta el contenido
  sigue en el menú, y un tipo de anotación que no existe se sigue mostrando. Lo que se conserva es lo
  que se pudo leer.

---

### RF-2 — Una escritura que no se puede hacer revierte lo que se ve y avisa

**Descripción.** Hoy hay dos escrituras con huecos, y los dos huecos son del mismo tipo: **el camino
no mira el resultado**. En los dos, el usuario ve un cambio que no está guardado.

**Criterios de aceptación**

- CUANDO el usuario **agrega, edita o quita** una anotación del calendario, ENTONCES el sistema la
  guarda por un camino que cumple **las tres garantías**.
- SI la escritura de una anotación **falla**, ENTONCES el sistema **deshace el cambio en la
  pantalla** —la anotación no queda puesta si no quedó guardada—, **avisa que no se pudo guardar esa
  anotación** y **no deja nada a medias** en el almacenamiento.
- CUANDO el usuario **cierra una sección de estudio** y la escritura de los minutos **falla por un
  motivo que no es falta de espacio**, ENTONCES el sistema **avisa igual** que cuando la falta de
  espacio, y no se queda en silencio.
- SI una escritura de cualquier grupo **falla**, ENTONCES el sistema **revierte lo que se ve en
  pantalla** —nunca ve un cambio que no está guardado— y **el aviso nombra el grupo** que no se pudo
  guardar.
- SI una escritura falla y el error **nombra** la causa, ENTONCES el aviso **nombra esa causa**; SI el
  error **no** la nombra, ENTONCES el aviso dice que no se pudo guardar **sin inventar ninguna**.
- SI una escritura falla y **no había nada guardado previo**, ENTONCES el sistema **no deja una
  entrada a medias** y avisa.

---

### RF-3 — El aviso es el que ya existe; lo único que cambia son los textos

**Descripción.** No hay ningún cartel nuevo que construir. El de los datos con problemas **ya existe**
y es no bloqueante, a propósito: uno que bloquea, con un problema que viene de un respaldo viejo,
saltaría en cada arranque y el usuario dejaría de abrir la aplicación. Las escrituras avisan por el
camino que ya avisa hoy.

| # | Texto | Dónde |
|---|-------|-------|
| 1 | **Nuevo:** no se pudo leer *qué grupo*, y que no se borró nada | Lecturas (RF-1) |
| 2 | **Nuevo:** no se pudo guardar *la anotación del calendario*, y que lo que se ve volvió a como estaba | Escritura de anotaciones (RF-2) |
| 3 | **Cambia:** el de "no se pudieron guardar los minutos de estudio", que hoy presume falta de espacio. Con un error que **no** dice eso, el texto **no lo presume** | Escritura de minutos (RF-2) |
| 4 | **Cambia:** el de "el navegador no dejó guardar", que hoy no nombra **qué** grupo se intentó guardar | Escritura en general (RF-2) |

**Criterios de aceptación**

- CUANDO hay un problema de datos, ENTONCES el sistema lo muestra en el **cartel de arriba**, con su
  botón de cerrar. No usa un cartel que bloquee la aplicación.
- CUANDO se puede interpretar el valor guardado de todos los grupos, ENTONCES **no aparece ningún
  aviso de lectura**: el cartel queda oculto.
- El texto de una lectura fallida dice **qué grupo** no se pudo leer y **que no se borró nada**. No
  dice qué hacer: esa decisión es del usuario.
- El texto de una escritura fallida dice **qué grupo** no se pudo guardar. Nombra la causa **solo si
  el error la nombra**.
- Ningún texto nuevo nombra un número que no se midió, ni una causa que el error no dijo.

---

### RF-4 — Las protecciones se reusan: se generaliza una, no se escriben cinco

**Descripción.** El cuaderno principal ya tiene un camino de escritura probado que mide el espacio
disponible, **avisa y vuelve a dejar lo anterior** si la escritura se corta. Ese camino **ya funciona
y ya está probado**.

**Lo único que cambia es el punto de apoyo**: ese mismo camino pasa a ser el que usan los otros tres
grupos. No se escriben protecciones nuevas en paralelo.

**Criterios de aceptación**

- El camino de escritura de los cuatro grupos es **el mismo**, el que ya existe y ya avisa y ya
  revierte. No hay **cinco protecciones nuevas**: hay una, usada por los cuatro.
- La capacidad de almacenamiento se sigue midiendo **antes** de escribir, y sigue faltando el
  cálculo a los grupos que hoy no lo hacen.
- Las protecciones que ya existen **siguen existiendo**: reescribir, agrupar o renombrar la
  comprobación puede cambiar la cuenta y no es un problema, porque **la cuenta deja de ser el
  requisito**.
- La lógica que decide **qué se puede leer y qué se hace cuando no** vive en la capa pura —sin DOM,
  sin reloj del sistema y sin almacenamiento— y se prueba con el runner nativo de Node.

---

### RF-5 — La comprobación usa la red que ya existe, y siembra el dato roto

**Descripción.** En `test/navegador.test.js` ya hay un almacenamiento inyectado al que **se lo rompe
a propósito** para comprobar las protecciones de escritura. **Es el mismo truco, aplicado a las
lecturas**: sembrar un valor corrupto donde la aplicación lee y comprobar las tres cosas. No hace
falta ninguna librería nueva.

**Por qué en ese archivo y no en otro.** Porque una red que compara lógica aislada no ve el cableado
entre archivos, y la lectura de los minutos del mapa de calor **es** cableado entre archivos: ya
rompió el mapa entero una vez con las pruebas en verde.

**Criterios de aceptación**

- Hay una comprobación que **siembra cada uno de los cuatro grupos** con un valor que no se puede
  interpretar, y que **falla con el código de hoy** y pasa después. Una comprobación que ya pasara
  antes de tocar nada no demostraría nada.
- Las comprobaciones de lectura se hacen **cargando la página como la carga el navegador**, no solo
  con pruebas de lógica pura.
- La red se prueba **sembrando el dato roto y sacándolo después**: el caso normal casi nunca detecta
  nada, porque no hay nada que detectar.
- Ninguna comprobación nueva necesita una librería externa. Si una comprobación pide una, está mal.

## Requisitos no funcionales

| ID | Requisito | Verificación |
|----|-----------|--------------|
| RNF-1 | **El proyecto no gana dependencias**: sigue sin `package.json` y sin `node_modules` | Los dos dan `False` |
| RNF-2 | Se sigue abriendo con **doble clic**, sin servidor y sin instalar nada | Se abre desde el disco y funciona |
| RNF-3 | **Ningún dato del usuario sale de la computadora.** Esta especificación no agrega ninguna petición | Con la aplicación abierta y sin ningún documento abierto, la red no muestra ninguna petición a un origen externo |
| RNF-4 | Todo lo nuevo está en **español, en UTF-8 sin BOM** | La sonda de caracteres raros sale con código 0 y el archivo no tiene BOM |
| RNF-5 | La **lógica** va en la capa pura y se prueba con el runner nativo; la **interfaz** se verifica abriendo Chrome | Las dos cosas, no una en lugar de la otra |
| RNF-6 | **Nada de lo que se ve cambia, salvo los cuatro textos de RF-3.** Mismo calendario, mismo mapa de calor, mismos botones | La comparación del árbol da IDÉNTICO, el flujo completo se prueba a mano, y la lista de textos de RF-3 es toda la lista |
| RNF-7 | Cada una de las protecciones de escritura que existen hoy sigue teniendo una comprobación que falle si deja de estar | `node --test` con `fail 0`, más una comprobación por protección |

## Casos límite

### El valor no se puede interpretar **y** el usuario hace un cambio

Ya está resuelto en el cuaderno principal y hay que llevarlo a los otros tres: **no se escribe nada y
se avisa**. Un valor por defecto que significa *"no sé"* no puede completarse con uno que significa
*"no hay"*.

### Dos grupos dañados a la vez

Lo que se decide: el cartel muestra **una línea por grupo**, con su nombre, y no un aviso genérico,
porque el usuario necesita saber cuál revisar.

### La escritura falla después de que la pantalla ya cambió

Es el caso más caro, porque el usuario ya vio el cambio. Lo que se decide: **la pantalla vuelve a lo
que está guardado** y el aviso dice que no se pudo guardar. Nunca se ve un cambio que no está guardado.

### La escritura de los minutos de estudio falla por un motivo que no es falta de espacio

Lo que se decide: **avisa igual**, con un texto que no presume la causa. Hoy ese camino es mudo, y
eso es el fallo silencioso que la constitución prohíbe.

### Los minutos de estudio no se pueden interpretar al consultar el mapa de calor

Lo que se decide: el mapa **se dibuja entero**, con sus celdas, y los minutos que no se pudieron leer
no se cuentan. No es un caso raro: es el mismo camino público que ya rompió el mapa una vez.

### Un valor vacío **no** es un valor que no se puede interpretar

Un grupo sin nada guardado se muestra vacío y funciona. Solo es un problema cuando el valor existe y no
se puede entender. Marcar como roto lo que solo está vacío es mentir sobre lo que el usuario tiene, y
hace desconfiar del aviso para todo lo demás.

### El almacenamiento del navegador falla al leer, y no solo al escribir

Es el mismo criterio: si no se puede leer, **no se escribe nada** y se avisa. El camino de reversión usa
un valor que significa *"no había nada guardado"*, así que confundir *"no había"* con *"no pude
leer"* haría que un fallo de escritura borrara lo que el usuario tenía.

## Fuera de alcance

Cada punto dice **qué** y **por qué**.

- **El cambio a otro almacén.** Es la especificación 008, que está en revisión aparte, y es otra cosa.
  Esta especificación es un arreglo **sobre el almacenamiento de hoy** y no depende de aquél. Mezclarlos
  haría que ninguno de los dos se pueda verificar por separado.
- **Que los datos se lean en memoria o a pedido.** También es de la 008, y por el mismo motivo.
- **Que las escrituras midan la capacidad con precisión.** Se sigue midiendo como hoy, con la
  estimación que ya existe. Cambiarla es otro trabajo.
- **Coordinación de dos pestañas abiertas.** Hoy gana la última escritura, y también después. Es
  deuda, no un agujero: es un comportamiento que el usuario ya conoce.
- **Un botón para "reintentar" o "reparar" un dato dañado.** Esta especificación avisa y deja el dato
  donde estaba. Un botón que repara necesita saber qué quería el usuario, y esa decisión es suya. Que
  avise le da la información para decidir.
- **Que la aplicación no abra cuando un dato está dañado.** Se decide lo contrario: **abre**. Un
  cuaderno que no se abre es peor que un cuaderno que avisa, porque con el aviso el usuario todavía
  puede exportar lo que sí se pudo leer.
- **Que el aviso ofrezca arreglar.** Por lo mismo de arriba: el código puede informar, no decidir.
- **El resto de lo que no entra en la 008**, tal como está escrito en su sección de fuera de alcance.

## Criterios de finalización

- [ ] Los **cuatro** grupos de datos se leen por un camino protegido: si el valor no se puede
      interpretar, la aplicación **abre igual**, **no se cae** y **avisa qué grupo** (RF-1)
- [ ] Un valor que no se puede interpretar queda **escrito tal como estaba**, y hay una comprobación
      que falla si se sobrescribe o se borra (RF-1)
- [ ] El mapa de calor **se dibuja entero** con el valor de minutos dañado, con sus celdas, y la
      función pública **devuelve la forma de siempre** en vez de lanzar (RF-1)
- [ ] El calendario **abre igual** con las anotaciones dañadas y la aplicación **abre igual** con los
      minutos heredados (RF-1)
- [ ] Las **cuatro lecturas** tienen una comprobación que **fallaba antes de este trabajo** (RF-5)
- [ ] Una anotación que no se pudo guardar **no queda puesta**, **avisa** y no deja nada a medias
      (RF-2)
- [ ] Los minutos de estudio que no se pudieron guardar **avisan con cualquier motivo de fallo**, no
      solo con falta de espacio (RF-2)
- [ ] Ningún texto nombra una causa que el error **no** dijo (RF-2, RF-3)
- [ ] El camino de escritura es **uno solo**, usado por los cuatro grupos, y es el que ya existía
      (RF-4)
- [ ] Cada protección de escritura que existe hoy sigue teniendo una comprobación (RNF-7)
- [ ] La comparación del árbol del menú lateral da **IDÉNTICO**
- [ ] Las sondas de calidad dan lo mismo que hoy: sin `package.json`, sin `node_modules`, nada fuera
      de lugar, nada que limpiar
- [ ] En el navegador: consola con **0 errores**, y todo legible a 375 px sin scroll horizontal
- [ ] `AGENTS.md` y `MEMORY.md` están al día en lo que les corresponde

## Dudas abiertas

- **[MENOR] Qué pasa con los minutos de estudio que no se pudieron guardar.** La regla dice que no se
  destruye nada y que se avisa, pero no dice si esos minutos **se vuelven a intentar** en el próximo
  guardado o si quedan solo en memoria hasta que se cierra la página. Reintentarlos tiene un riesgo
  propio: hay que garantizar que no se cuenten dos veces el mismo minuto. **El valor y la forma son
  cosa del plan**, no de acá.

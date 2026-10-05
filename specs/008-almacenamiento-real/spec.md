# Spec 008 — Almacenamiento real, en un solo almacén

Estado: borrador

> **Origen.** De la especificación 007, que está **abortada**. El motivo está escrito en
> su [`cierre.md`](../007-almacenamiento-real/cierre.md) y hay que leerlo antes que este
> documento: la 007 mezclaba cuatro problemas distintos con riesgos distintos, y su
> diseño tenía cuatro agujeros que no se arreglaban escribiendo más texto.
>
> De esos cuatro, esta spec toma **uno**, el único que el usuario pidió: **más
> almacenamiento**. Los otros tres salen por escrito en [Fuera de alcance](#fuera-de-alcance),
> con su motivo.

## Contexto y objetivo

El pedido es una frase: *"estoy cerca del muro de 5 MB, quiero tener más almacenamiento"*.

El muro es real y se puede señalar: hoy el cuaderno entero —materias, documentos y el
contenido de cada archivo— vive en **una sola clave** del almacenamiento del navegador,
como un único texto. Los archivos van en base64, que es texto, y eso los agranda un 33 %.
El tope del navegador es de unos 5 MB, así que **alrededor de 3,5 MB de archivo ya se
alcanza**. *(Cifra estimada a partir del 33 % y del tope, no medida.)*

Eso es todo el objetivo. No es una reescritura del almacenamiento: es **cambiar el lugar
donde vive el cuaderno**, y arreglar de paso los dos defectos que ese cambio hace
visibles porque tocan exactamente las mismas escrituras y el mismo camino de salida.

### Los dos defectos que entran, y por qué entran acá

Ninguno de los dos es un riesgo del almacén nuevo. **Los dos existen hoy**, y por eso la
007 los encontró al inventariar los caminos de escritura.

| Defecto | Qué pasa hoy | Por qué entra en esta spec |
|---------|--------------|---------------------------|
| **La anotación del calendario se puede perder sin avisar** | La función que guarda las anotaciones escribe en el almacenamiento del navegador **sin ninguna protección**: si la escritura falla, el error sube, no se avisa, no se revierte, y la anotación desaparece al día siguiente. Y la función que las lee interpreta el valor guardado **sin protección**: si no es un texto válido, se rompe la apertura del calendario | Toca las mismas escrituras que el resto de los datos. Es la razón por la que la 007 se caía: el hallazgo más serio no era el almacén, era **este** |
| **Exportar no es una copia de seguridad** | El archivo que produce exportar hoy **solo incluye las materias con sus documentos**. Pierde los minutos de Pomodoro, los minutos de estudio y las anotaciones del calendario. Un año de estudio no está en el respaldo | Es el callejón de salida del usuario, y es lo que la constitución le promete: *"si algo sale mal, tu respaldo está en el JSON descargado"*. Va aunque no dé ni un KB de espacio |

### La premisa que ya está medida: el almacén abre desde un archivo local

El almacén que se elige **no es una cosa cualquiera**: es el único del navegador que
separa cada dato y no tiene el tope de 5 MB. Y hay una pregunta que este proyecto nunca
midió: si ese almacén se puede abrir desde un archivo abierto con doble clic, que es
como se usa la aplicación.

**Está medida. Dio bien.** Con `file://`, el almacén abre, escribe un registro, lo vuelve
a leer con el mismo contenido y borra la base de prueba, sin red y sin pedirle nada a
ningún sitio:

| Qué se midió | Resultado |
|---|---|
| Protocolo y origen | `file:`, origen `null` — el de un archivo local |
| Abrir el almacén | Abre |
| Escribir un registro | Escribe |
| Volver a leer ese registro | Se lee **con el mismo contenido** |
| Borrar la base de prueba | Borra |
| Navegador | **Chrome 154** (Chromium 154), Windows |
| Cuánto tardó | Sin medir; **no es un requisito con tope** |
| Con red | La medición se hizo **sin red**, que es el caso difícil |

**Alcance de la medición, con sus límites.** Es una medición, no una garantía: cubre
Chrome 154 en Windows, desde el archivo, **con su perfil real y no en una ventana
privada**. La excepción conocida sigue siendo la **ventana privada**, que es exactamente
lo que RF-3 nombra como causa posible de que el almacén no abra. Si el usuario llegara a
usar la app en una ventana privada, la app no abre y lo dice — y con el diseño de más
abajo **eso todavía no toca los datos de nadie**, porque en ese punto todavía no se
migró nada.

Lo que la medición **no** cubre, y queda dicho: otros navegadores, y el mismo
navegador en una versión distinta. El proyecto se verifica en Chrome (ver
`herramientas/verificar-layout.js`), así que la medición es del navegador que se usa.

**Si algún día Chrome cambia este comportamiento, el plan tiene que notar la premisa
antes de migrar**, no después: es el único requisito cuya falla significa "la app no
abre".

## La decisión que sostiene todo: un solo almacén, sin vuelta atrás

Esta sección es el corazón de la especificación. Todo lo demás se apoya en ella.

> **Hay un solo almacén, y es el del navegador que separa cada dato. Si no abre, la
> aplicación no abre y lo dice. No hay vuelta atrás.**

En concreto:

| Momento | Qué pasa |
|---------|----------|
| Arranque | Se abre el almacén nuevo. Si abre, se migra lo que haya. Si no abre, **la aplicación no abre** |
| Mientras la migración no terminó | La aplicación sigue con el almacén viejo, que está entero, y reintenta en el próximo arranque |
| Después de migrar | Todo se lee y se escribe en el almacén nuevo. **Del viejo no se lee nunca más** |

No existe "modo normal" ni "modo limitado", no hay dos almacenes en los que la aplicación
vive a la vez, y no hay ninguna operación que escriba en el viejo después de migrar.

### Por qué un solo almacén, y no dos

Porque **con dos almacenes, tres cosas se pueden construir**, y las tres son malas:

1. **Datos huérfanos.** Se escribe en el viejo mientras el nuevo está de moda, y después
   nadie vuelve a leer los viejos. Lo escrito ahí queda donde nadie lo va a buscar.
2. **Hay que decidir de dónde se lee cada grupo de datos.** Cuatro grupos, cuatro reglas,
   y cada vez que se agrega un grupo hay que acordarse de la regla.
3. **La migración se convierte en un estado más, sin nombre.** No es "migrado" ni "sin
   migrar": hay un tercer caso, con datos en los dos lados y ninguna regla que diga cuál
   gana.

Con un solo almacén, **ninguna de las tres se puede construir**, porque no hay dos lugares
donde haya datos. Ese es el argumento, y es lo que justifica el recorte: no es que las
otras cosas sean difíciles, es que la forma de que aparezcan desaparece.

### El precio, con todas sus letras

**Si después de migrar el almacén nuevo deja de funcionar, la aplicación no abre.**

No muestra el cuaderno viejo. No cae a "un modo reducido". No ofrece una salida. Abre una
página que dice que no puede abrir el almacenamiento y por qué.

Es una escena poco probable, y es **precisamente lo que hace que esto sea seguro**. La
alternativa —mostrar lo viejo y dejar guardar en un almacén que nadie lee— es exactamente
el hallazgo grave que tumbó la 007: la aplicación sigue pareciendo entera y los datos
nuevos se pierden en silencio. **Un cuaderno que no abre se ve; un cuaderno que se
parece a funcionar y pierde lo que se le guarda no.**

Este precio no se suaviza ni se promete que "nunca pasa". Se acepta y queda escrito.

## Usuarios

**Un solo usuario: el dueño del cuaderno, en su computadora.** No hay cuentas, ni
servidor, ni equipos compartidos, ni nadie más que pueda ver los datos.

Eso descarta de entrada toda una familia de requisitos (cuentas, sincronización,
permisos, trabajo en equipo) y fija la regla de oro de esta especificación, con su límite
escrito: **el único objetivo es que no se pierda nada de lo que esa persona guardó, y nada
se pierde sin que se le avise.**

El límite: **la única operación que puede hacer perder datos es importar un respaldo**,
porque reemplaza el cuaderno entero. El usuario lo pide, el sistema **le nombra por
adelantado qué se va a perder** y recién después de que lo confirme reemplaza. Fuera de esa
operación, ningún camino de esta especificación borra datos: ni la migración (que copia y
deja lo viejo), ni una escritura fallida (que se revierte), ni una lectura que no se puede
hacer (que no escribe nada).

## Historias de usuario

- **HU-1.** Como dueño del cuaderno, quiero subir los apuntes que necesito sin que la
  aplicación me diga que no entra, para no tener que decidir qué borrar.
- **HU-2.** Como dueño del cuaderno, quiero que una anotación del calendario que no se
  pudo guardar me avise y no aparezca igual, para no enterarme al día siguiente de que no
  está.
- **HU-3.** Como dueño del cuaderno, quiero que el archivo que exporto tenga todo lo mío,
  para que sea una copia de verdad y no solo de mis documentos.
- **HU-4.** Como dueño del cuaderno, quiero que la aplicación siga funcionando con doble
  clic y sin instalar nada, como hasta ahora, para que no cambie mi costumbre.
- **HU-5.** Como dueño del cuaderno, quiero que, si la aplicación no puede abrirse, me
  diga por qué y me diga que nada se borró, para no pensar que perdí el cuaderno.

## Definiciones

| Término | Qué significa |
|---------|---------------|
| **El almacén viejo** | El del navegador que guarda el cuaderno entero en un texto JSON por clave, con un tope de unos 5 MB |
| **El almacén nuevo** | El del navegador que separa cada dato y no tiene el tope de 5 MB |
| **Disponible** (el almacén nuevo) | Que se lo puede abrir, escribirle un registro de prueba y volver a leer ese mismo registro con el mismo contenido, dentro de un plazo fijo. Ver RF-3 |
| **Migración terminada** | Que está escrito en el almacén nuevo el registro que dice que la copia se terminó |
| **Los cuatro grupos de datos** | Materias con sus documentos · minutos del Pomodoro del formato viejo · minutos de estudio por secciones · anotaciones del calendario |
| **Los minutos heredados** | El registro de minutos del Pomodoro en el formato viejo. **Se lee y ya no se escribe**: los minutos que cuentan de verdad son los de estudio por secciones |
| **Las tres garantías** | Avisar, revertir y no dejar datos a medias. Ver RF-1 |
| **Sin internet** | La computadora sin conexión a la red |

### Los cuatro caminos de escritura de hoy

Este inventario es lo que hace que las cosas de esta especificación no sean inventadas:
**hoy hay cuatro datos guardados y cuatro caminos distintos, y uno no tiene ninguna
protección.**

| Dato | Camino de escritura hoy | Si falla, ¿qué pasa? |
|------|-------------------------|----------------------|
| Materias y documentos | Camino protegido: mide el espacio, avisa y **vuelve a dejar lo anterior** si la escritura se corta | Datos intactos, el cambio se deshace en pantalla |
| Minutos de Pomodoro (formato viejo) | **Solo se lee**, no se escribe más | — |
| Minutos de estudio por secciones | Camino propio: avisa, pero **solo** si el error es de cuota | Si falla por otro motivo, el error sube y los minutos quedan en memoria |
| Anotaciones del calendario | **Ninguno** | Si falla, el error sube, la anotación queda en memoria y **no está guardada** |

Después de esta especificación, los cuatro grupos se leen y se escriben por caminos que dan
las mismas garantías.

## Requisitos funcionales

---

### RF-1 — Los datos viven en un solo almacén, y se leen de ahí

**Descripción.** El cuaderno pasa al almacén nuevo, y ahí se queda. Y es **uno solo**: la
aplicación no escribe en el almacén viejo ni lo lee, después de migrar.

**Las tres garantías, para todo dato y en las dos direcciones.** No se pide un camino
único: se piden las mismas garantías para todos los grupos.

1. **Avisa.** El usuario se entera de que no se pudo guardar.
2. **Revierte.** Lo que ve en pantalla vuelve a ser lo que está guardado. Nunca ve algo
   que no está guardado.
3. **No deja datos a medias.** No queda una escritura a medio hacer.

Y lo mismo para **leer**: una lectura que no se puede hacer **no rompe la aplicación**,
deja lo que ya estaba en pantalla, **avisa** y **no borra nada**.

**Se reusan los caminos que ya existen, no se inventan.** Los de hoy —`guardarDatos`,
`guardarRevirtiendoSiFalla`, `mensajeAlmacenamientoLleno` y `mensajeFalloAlGuardar`, todos
en `js/app.js`— ya miden, ya avisan, ya revierten y ya distinguen el camino que sabe la
causa del que no la sabe, y **están probados**. Lo único que cambia es el punto de apoyo:
hoy esos caminos escriben en el almacenamiento del navegador; después escriben en el
almacén nuevo.

> **Lo que se reusa es la decisión y la reversión, no los textos.** El texto que nombra el
> muro de 5 MB y el umbral del 95 % **desaparece**, porque ese muro ya no existe (RNF-6). Un
> mensaje que anuncia un muro que no está es peor que no avisar.

**De dónde se lee cada grupo, después de migrar.** Esto hoy **no está especificado en
ningún lado**, y es lo que hay que dejar dicho:

| Grupo | Dónde vive hoy | Dónde vive después de migrar |
|-------|----------------|-------------------------------|
| Materias y documentos | una clave con todo el cuaderno | un registro del almacén nuevo |
| Minutos heredados del Pomodoro | una clave que **ya no se escribe** | **una copia** en el almacén nuevo, sin transformar |
| Minutos de estudio por secciones | una clave | un registro del almacén nuevo |
| Anotaciones del calendario | una clave | un registro del almacén nuevo |

Y la regla que lo gobierna: **después de migrar, cada grupo se lee del almacén nuevo y de
ningún otro lugar.**

**Por qué esa regla es necesaria, y no una preferencia.** Hoy los minutos se leen con dos
ritmos distintos: los heredados se leen **una sola vez al arrancar** y quedan en memoria,
y los de estudio por secciones se leen **en cada consulta**. Si después de migrar los dos
grupos pasan a estar en el mismo almacén y uno de los dos se cargó en memoria antes de que
la copia terminara, **los mismos minutos se cuentan dos veces en el mismo día**. Con la
regla de arriba eso no se puede construir: un registro vive en un solo lugar.

Y por la misma regla, **la migración copia, no transforma**: los minutos heredados se
copian tal cual, sin convertirlos ni interpretarlos. Transformar sería otro requisito, con
su propia verificación.

**Criterios de aceptación**

- CUANDO el usuario guarda un cambio —una materia, un documento, un registro de minutos o
  una anotación—, ENTONCES el sistema lo escribe en el almacén nuevo.
- CUANDO el usuario recarga la página, ENTONCES el sistema vuelve a leer lo mismo que
  estaba antes del cambio, del almacén nuevo.
- EL SISTEMA **no borra nada** del almacén viejo: queda entero, como red. No hay ninguna
  operación que lo borre.
- Después de migrar, EL SISTEMA lee los cuatro grupos **del almacén nuevo y de ningún
  otro**. Del almacén viejo no se lee nada.
- CUANDO el mapa de calor cuenta los minutos de un día, ENTONCES cuenta **cada registro
  una sola vez**: un día que tiene una sesión del formato heredado muestra los minutos de
  esa sesión una vez, no dos.
- CUANDO el usuario agrega, edita o borra cualquiera de los cuatro grupos, ENTONCES el
  sistema lo guarda por un camino que cumple **las tres garantías**.
- SI una escritura falla, ENTONCES el sistema deshace el cambio en la pantalla: lo que el
  usuario ve nunca es algo que no está guardado, y **avisa**.
- SI una escritura falla y no había nada guardado previo, ENTONCES el sistema no deja una
  entrada a medias y avisa.
- SI no se puede leer lo que estaba guardado, ENTONCES el sistema **no escribe nada** y
  avisa. El camino que conserva datos es el que no hace nada.
- SI una lectura falla, ENTONCES el sistema **no rompe la aplicación**: sigue con lo que
  ya tenía, avisa y **no borra nada**.
- SI una escritura no termina dentro del plazo fijo, ENTONCES el sistema avisa que el
  almacenamiento no respondió y no escribe.
- SI una escritura falla y el error **nombra** la causa, ENTONCES el aviso nombra esa
  causa; SI el error **no** la nombra, ENTONCES el aviso dice que no se pudo guardar **sin
  inventar ninguna**, y en los dos casos ofrece exportar: la salida es la misma.
- MIENTRAS el almacén nuevo esté funcionando, ENTONCES **no** aparece el aviso de
  "almacenamiento casi lleno" ni el umbral que lo acompaña, porque ese muro ya no existe.
  Es una decisión explícita, no un olvido.
- EL SISTEMA **no empieza a escribir el registro heredado del Pomodoro**. Sigue siendo de
  solo lectura. Volver a escribirlo es otro trabajo.
- Los caminos que dan las tres garantías son los que ya existen y están probados, con el
  punto de apoyo cambiado. No hay caminos nuevos paralelos.

---

### RF-2 — Lo que ya está guardado pasa al almacén nuevo una sola vez, y lo viejo queda entero

**Descripción.** El usuario tiene datos guardados. Se **copian** al almacén nuevo y lo
viejo queda **entero**. Lo único que decide dónde está el cuaderno es la marca de
migración terminada.

**La regla única.** Al arrancar, la migración se intenta si se cumplen las tres
condiciones:

1. El almacén nuevo está **disponible** (la prueba de RF-3).
2. El almacén viejo tiene datos.
3. El almacén nuevo **no está marcado** como migración terminada.

Y después, una sola regla para los dos desenlaces:

- **Si la copia termina bien**, el sistema escribe la marca de migración terminada. La
  condición 3 deja de cumplirse y **la migración no vuelve a intentarse nunca más**.
- **Si la copia se corta o falla**, el almacén nuevo sigue sin la marca, y en el siguiente
  arranque las tres condiciones se cumplen otra vez: **se vuelve a intentar desde el
  principio**, sobrescribiendo lo que quedó a medias. No es un mecanismo de reintento
  aparte: es la misma regla, evaluada de nuevo.

**La marca se escribe al final, y por eso importa dónde.** Si la marca se escribiera
primero, una copia cortada dejaría el almacén nuevo marcado como terminado con datos a
medias, y eso es un cuaderno partido que **nadie volvería a reparar**, porque la regla ya
diría que no hay nada que hacer. Escribiéndola al final, una migración incompleta es
indistinguible de una que no empezó, y se repite entera.

**Por qué es seguro seguir en el almacén viejo si la copia falla.** Mientras la migración
no terminó, **el cuaderno que se ve y el único sobre el que se guarda es el del almacén
viejo**. En el almacén nuevo no se escribió nada nuevo del usuario: solo hay, como mucho,
una copia a medias de lo que ya estaba en el viejo. No hay dato del usuario que viva en un
solo lado, y por eso volver a intentarlo desde el principio no puede perder nada.

**Criterios de aceptación**

- CUANDO arranca la aplicación y el almacén nuevo está disponible y hay datos en el viejo y
  el nuevo no está marcado, ENTONCES el sistema copia **los cuatro grupos** al nuevo:
  materias con sus documentos, minutos heredados (tal cual), minutos de estudio por
  secciones y anotaciones del calendario.
- CUANDO termina la copia, ENTONCES el sistema **no borra nada** del almacén viejo: queda
  entero, como red.
- CUANDO termina la copia, ENTONCES el sistema escribe la marca de migración terminada
  **después** de los datos, no antes.
- CUANDO termina la copia, ENTONCES el sistema avisa **una vez por arranque** qué se copió
  y que lo anterior quedó ahí como respaldo.
- CUANDO termina la copia, ENTONCES todo lo que había antes sigue visible: mismas
  materias, mismos documentos, mismos minutos, mismas anotaciones.
- SI la copia se corta a la mitad —se cierra la pestaña, falla el navegador—, ENTONCES en
  la siguiente apertura se cumplen otra vez las tres condiciones y **se vuelve a intentar
  desde el principio**, y el cuaderno no queda a medias en ninguno de los dos almacenes.
- SI la copia falla, ENTONCES la aplicación **sigue con el almacén viejo**, que está
  entero, y sigue funcionando como hasta ahora. Y avisa, una vez por arranque, que **no se
  pudieron copiar los datos** y por qué.
- MIENTRAS la migración no terminó, ENTONCES lo que se ve y lo único sobre lo que se
  guarda es el cuaderno del almacén viejo, y **ninguna operación que cambie datos está
  habilitada** hasta que la migración termine o falle.
- SI el almacén viejo no tiene datos, ENTONCES la aplicación arranca vacía, sin preguntar
  nada y **sin decir que migró nada**.
- SI el usuario limpia los datos del navegador desde el menú del navegador, ENTONCES los
  dos almacenes quedan vacíos, **no hay nada que migrar** y el sistema no dice que migró
  nada: arranca como una aplicación nueva.

---

### RF-3 — Si el almacén no abre, la aplicación no abre, y dice por qué

**Descripción.** No hay modo alternativo. Si el almacén no abre, la aplicación **no
abre**: no dibuja el cuaderno, no muestra los datos viejos y no guarda en ninguna parte.

**Cómo se decide, con algo observable.** "Disponible" no es una palabra: es una prueba de
tres pasos que el sistema hace **una sola vez al arrancar**. La prueba escribe un registro
propio de nombre reservado y tamaño despreciable, lo vuelve a leer y compara. Si ese
registro no existía antes de la prueba, se borra al terminar. El paso de lectura es
asíncrono, así que hay un plazo fijo: si algo no termina dentro de él, la respuesta es que
no está disponible.

**El precio, repetido porque es lo importante.** Esto vale también **después** de migrar:
si el almacén nuevo deja de funcionar, la aplicación no abre, y no muestra el cuaderno
viejo. No es un detalle de arranque, es la decisión entera. Ver
[El precio, con todas sus letras](#el-precio-con-todas-sus-letras).

**Criterios de aceptación**

- CUANDO arranca la aplicación, ENTONCES el sistema hace **una sola** prueba de
  disponibilidad: abrir el almacén, escribir un registro de prueba, y volver a leerlo con
  el mismo contenido, dentro de un plazo fijo.
- CUANDO el registro de prueba no existía antes de la prueba, ENTONCES el sistema lo borra
  al terminar.
- SI la prueba falla en cualquiera de sus tres pasos, o no termina dentro del plazo, ENTONCES
  **la aplicación no abre**: no dibuja el cuaderno, no muestra los datos viejos y no
  escribe en ninguna parte.
- CUANDO la aplicación no abre por eso, ENTONCES muestra **en la página** un texto que
  dice, como mínimo, estas cuatro cosas: (a) que no puede abrir el almacenamiento del
  navegador; (b) que **por eso el cuaderno no abre**; (c) las dos causas más probables —una
  ventana privada, y un navegador que no lo soporta con el archivo abierto desde el disco—;
  y (d) que **no se borró nada**: el cuaderno sigue donde estaba, y hay que abrir la
  aplicación fuera de la ventana privada o con otro navegador.
- MIENTRAS la prueba no terminó, ENTONCES **ninguna operación que cambie datos está
  habilitada**: si el usuario la intenta, se le dice que el cuaderno todavía se está
  cargando y no se escribe nada.
- EL SISTEMA **no vuelve al almacén viejo en ningún momento**, ni antes ni después de
  migrar. No hay ninguna operación que escriba en el viejo una vez terminada la migración.
- EL SISTEMA **no cambia de almacén en mitad de una sesión** por un fallo de escritura
  posterior: avisa, revierte y sigue funcionando con lo que ya está guardado.
- CUANDO el plazo de la prueba termine sin respuesta, ENTONCES el sistema lo trata como
  "no disponible": la aplicación no abre, con el mismo texto.

---

### RF-4 — Una anotación del calendario que no se puede guardar avisa, revierte y no queda a medias

**Descripción.** Este es un defecto que **existe hoy**, no un riesgo del almacén nuevo.
Entra acá porque toca las mismas escrituras que el resto de los datos, y porque el
inventario de los caminos de escritura no se puede ignorar: hoy es el único que no
tiene ninguna protección.

Los dos detalles de hoy:

- La función que **guarda** las anotaciones escribe sin ninguna protección: si la escritura
  falla, el error sube, **no se avisa, no se revierte** y la anotación queda solo en
  memoria. Al día siguiente no está.
- La función que **carga** las anotaciones interpreta el valor guardado sin ninguna
  protección: si no es un texto válido, **se rompe la apertura del calendario**.

**Criterios de aceptación**

- CUANDO el usuario agrega, edita o quita una anotación del calendario, ENTONCES el sistema
  la guarda por un camino que cumple **las tres garantías** de RF-1.
- SI la escritura de una anotación falla, ENTONCES el sistema avisa que **no se pudo
  guardar esa anotación**, **deshace el cambio en la pantalla** —la anotación no queda
  puesta si no quedó guardada— y no deja nada a medias en el almacén.
- SI el valor guardado de las anotaciones **no se puede leer**, ENTONCES la apertura del
  calendario **no se rompe**: el sistema sigue con lo que ya tenía, avisa que no pudo leer
  lo que estaba guardado y **no borra nada**.
- SI no se puede leer lo que estaba guardado y el usuario hace un cambio, ENTONCES el
  sistema **no escribe nada** y avisa.
- El mismo criterio vale para las lecturas de los minutos de estudio, que pasan por el
  mismo punto de apoyo: no hacen falta un requisito aparte.
- Este defecto está **comprobado antes de cambiar nada**: hay una prueba que falla con el
  código de hoy, y después pasa. Una prueba que ya pasara antes de tocar nada no
  demostraría nada.

---

### RF-5 — Exportar e importar incluyen los cuatro grupos de datos

**Descripción.** Hoy el archivo que produce exportar solo tiene las materias con sus
documentos. Eso **no es una copia de seguridad**: un año de estudio no está en el respaldo.
Es el callejón de salida que la constitución le promete al usuario, así que va en esta
especificación aunque no dé ni un KB de espacio.

Importar **reemplaza**, como hoy. Lo que cambia es qué entra y qué se le nombra al
usuario antes de reemplazar nada.

**Criterios de aceptación**

- CUANDO el usuario exporta, ENTONCES el archivo incluye **los cuatro grupos**: materias
  con sus documentos, minutos heredados del Pomodoro, minutos de estudio por secciones y
  anotaciones del calendario.
- CUANDO el usuario importa un respaldo, ENTONCES el sistema restaura **los cuatro grupos
  que el archivo trae**.
- SI el respaldo es de una versión anterior y trae solo las materias, ENTONCES el sistema
  importa las materias y **avisa que el archivo no trae historial de estudio ni
  calendario**. No dice que estaban vacíos: eso no lo sabe.
- CUANDO el usuario va a importar, ENTONCES el sistema pide confirmación y el mensaje
  **nombra los cuatro grupos** que se van a perder, y deja claro que lo importado
  **reemplaza** a eso y no se agrega a eso.
- SI no se puede guardar lo importado, ENTONCES no se pisa nada y avisa que los datos
  siguen como estaban. *(Comportamiento que ya existe: se conserva.)*
- SI el sistema no puede leer alguno de los cuatro grupos para armar la copia, ENTONCES
  **no arma una copia incompleta**: avisa **qué no pudo leer**. Una copia a medio hacer sin
  avisar es peor que no hacer copia.
- SI el respaldo trae datos raros —una materia sin lista de documentos, un tipo de
  anotación que no existe, un documento al que le falta el contenido—, ENTONCES se
  completan, se anotan en el aviso de arriba y **no se borra nada**. *(Comportamiento que
  ya existe: se extiende a los otros tres grupos.)*
- El nombre del archivo y la forma de descargarlo **no cambian**.

## Requisitos no funcionales

| ID | Requisito | Verificación |
|----|-----------|--------------|
| RNF-1 | **El proyecto no gana dependencias**: sigue sin `package.json` y sin `node_modules`. El almacén nuevo es una capacidad del navegador, no un paquete | `Test-Path` da `False` en los dos |
| RNF-2 | La aplicación se sigue abriendo con doble clic, sin servidor y sin instalar nada. **Con una condición escrita:** depende de la medición del contexto. Si el navegador del usuario no abre el almacén desde un archivo local, **RF-3 dice que la aplicación no abre**, y eso hace que la decisión vuelva a la mesa | Se abre desde el disco y funciona, y la medición del contexto está hecha y escrita |
| RNF-3 | **Ningún dato del usuario sale de la computadora.** La única petición externa que hace la aplicación es el archivo de apoyo del visor de PDF, y **no lleva nada del cuaderno**. Lo que pida el contenido de un documento que el usuario abre no es de la aplicación | Con la aplicación abierta y sin ningún documento abierto, la red no muestra ninguna petición a un origen externo |
| RNF-4 | **No se pierde ninguna protección.** Las cinco protecciones de escritura que existen hoy siguen teniendo cada una una comprobación que falle si deja de estar. Reescribir, agrupar o renombrar comprobaciones puede cambiar la cuenta y no es un problema: **la cuenta deja de ser el requisito**, porque un número escrito a mano se desincroniza solo | `node --test` con `fail 0`, más una comprobación por cada una de las cinco protecciones |
| RNF-5 | **Las herramientas de verificación siembran los datos donde la aplicación lee.** Hoy `herramientas/capturar-arbol.js` y `herramientas/verificar-layout.js` siembran en el almacenamiento del navegador. Con los datos en el almacén nuevo, esas dos siembran donde la aplicación ya no lee: **miden una aplicación vacía**, y "el árbol da IDÉNTICO" se cumpliría de mentira | Las dos herramientas siembran por el camino de escritura que usa la aplicación, y el escenario de datos raros sigue dando 0 errores de consola |
| RNF-6 | Nada de lo que se ve cambia, **salvo lo enumerado abajo** | La comparación del árbol da IDÉNTICO, el flujo completo se prueba a mano, y cada texto nuevo y cada texto que cambia está en la lista de abajo |
| RNF-7 | Todo lo nuevo está en español, en UTF-8 sin BOM | La sonda de caracteres raros termina diciendo "Nada fuera de lugar" y sale con código 0, y el archivo no tiene BOM |

> **Sobre RNF-6, la lista completa.** Nada de lo que se ve cambia, y esto es **toda** la
> lista:
>
> **Textos nuevos:**
>
> 1. La aplicación no abre: por qué, y que nada se borró.
> 2. Migración completada: qué se copió y que lo anterior quedó ahí como respaldo.
> 3. Migración que no se pudo completar, con la causa.
> 4. Fallo al guardar una anotación del calendario.
> 5. Lectura de las anotaciones que no se pudo interpretar.
> 6. Copia que no se pudo armar, nombrando qué grupo no se pudo leer.
> 7. Respaldo importado que no trae historial de estudio ni calendario.
> 8. Confirmación de importar, nombrando los cuatro grupos que se van a perder.
> 9. Cuaderno todavía se está cargando, mientras la prueba no terminó.
>
> **Texto que desaparece:** el de "almacenamiento casi lleno", con su ocupación y su
> umbral del 95 %. Ese muro ya no existe, y el aviso que nombra un muro que no está es
> peor que no avisar.
>
> **Texto que cambia, sin cambiar de función:** el aviso de "no se pudo guardar", que hoy
> promete que exportar libera espacio del almacenamiento del navegador. Con el almacén
> nuevo exportar sigue siendo la salida, pero **no porque el navegador se llene**: el texto
> dice lo que sabe y nada más.
>
> **Cambio de comportamiento, declarado a propósito:** con el cuaderno abierto en dos
> pestañas, **hoy gana la última escritura**, y después también. Esa coordinación está
> [fuera de alcance](#fuera-de-alcance) y no cambia.

## Casos límite

### La migración se corta a la mitad

El usuario cierra la pestaña mientras se copia. El cuaderno no puede quedar partido.

Lo que se decide: **el cuaderno que se ve y el único sobre el que se guarda es el del
almacén viejo, que está entero**; mientras tanto no se habilita ninguna operación que
cambie datos; y en la siguiente apertura **se vuelve a intentar desde el principio**,
porque el almacén nuevo sigue sin la marca.

### La migración falla porque no hay espacio o falla el disco

No es lo mismo que cerrarse la pestaña: acá la copia no terminó y el almacén nuevo quedó a
medio llenar.

Lo que se decide: **la aplicación no pasa al almacén nuevo**. Sigue con el almacén viejo,
que está entero, y avisa **una vez por arranque** que no se pudieron copiar los datos y por
qué. En el siguiente arranque se reintenta desde el principio, sobrescribiendo lo que
quedó a medias. Si vuelve a fallar, avisa otra vez.

No hay copia a medias de la que fiarse: o el cuaderno del almacén nuevo está completo, o
no se usa.

### El almacén deja de funcionar después de migrar — el precio

Desenchufar el disco externo donde el navegador guardó los datos, o un navegador que deja
de dar el almacén. **La aplicación no abre.** No muestra el cuaderno viejo, no cae a ningún
otro almacén y no ofrece una salida. Muestra el texto de RF-3.

Es el precio que se aceptó a cambio de que no existan datos huérfanos ni un tercer estado
sin nombre. Ver [El precio](#el-precio-con-todas-sus-letras).

### Una escritura falla después de migrar, por falta de espacio o por un problema del disco

**La aplicación no puede distinguir "no hay cuota" de "no hay disco"**: los dos llegan como
errores del almacenamiento y el navegador no siempre los distingue. Por eso:

- SI el error **nombra** la causa, el aviso nombra esa causa.
- SI el error **no** la nombra, el aviso dice que no se pudo guardar, **sin inventar
  causa**, y ofrece exportar igual.
- EL SISTEMA **no cambia de almacén**: sigue en el que está, avisa, revierte y sigue
  funcionando con lo que ya está guardado.

Es decir: **cada camino dice lo que sabe.** Es la misma lección del aviso que decía "casi
lleno (0 % de 95 %)", un mensaje que mostraba un porcentaje que no correspondía con lo que
estaba pasando.

### Se limpia el almacenamiento del navegador desde el menú del navegador

Este escenario destruye los dos almacenes por igual. Lo que se decide: como los dos quedan
vacíos, **no hay nada que migrar**, el sistema **no dice que migró nada** y la aplicación
arranca vacía, como una aplicación nueva. El archivo que exportó el usuario es la única
salida, y por eso RF-5 lo hace completo.

### El cuaderno está abierto en dos pestañas

**No se especifica.** Con el almacén por registro, una colisión entre dos pestañas se
limita a un registro, no a todo el cuaderno, y hoy ya gana la última escritura. Es deuda,
no un agujero: si en el uso real molesta, se anota aparte y se decide por su cuenta. Ver
[Fuera de alcance](#fuera-de-alcance).

### Importar un respaldo de una versión anterior

Trae solo las materias. Lo que se decide: **se importan las materias y se avisa que el
archivo no trae historial de estudio ni calendario**. No se dice que estaban vacíos: eso
no lo sabe, y decirlo sería inventar.

### Importar sobre un cuaderno con datos más nuevos

Importar **reemplaza**, no combina, como hoy. Antes de reemplazar nada se pide confirmación
y el mensaje nombra los cuatro grupos. Si lo importado no se puede guardar, **no se pisa
nada** y avisa que los datos siguen como estaban; y si el archivo trae datos raros, se
completan, se anotan y no se borra nada.

### Un documento abierto mientras se migra

La migración no interrumpe lo que el usuario está haciendo. El documento que ya está
abierto **se sigue viendo con el contenido con el que se abrió** y no se recarga a mitad
de la copia. Cuando lo cierre y lo vuelva a abrir, lo verá desde el almacén nuevo, **con el
mismo contenido**: la migración copia, no transforma. No hay ningún cambio en lo que se ve,
ni un instante.

### La primera anotación, cuando no había nada guardado

No hay a qué volver atrás. Lo que se decide: el sistema **no deja una entrada a medias** y
avisa. Es el mismo caso que hoy.

## Fuera de alcance

Cada punto dice **qué** y **por qué**. Lo que queda acá no es una lista de deseos: son
trabajos que existen, con su motivo.

- **`vendor/`, self-hosteo de las fuentes y sus licencias.** **No da ni un KB de
  almacenamiento**: son archivos en disco que se cargan por `file://`, no cuota del
  navegador. Medido: Google Fonts sirve hoy **51 archivos `.woff2`** para las dos familias
  (9 combinaciones de peso y 7 subconjuntos de idioma); latin y latin-ext son **18 de esos
  archivos y ocupan 884 KB**. Y además no arregla lo que más duele: el archivo de apoyo del
  visor de PDF sigue yendo al CDN, así que **los PDF seguirían sin abrir sin internet**.
  Traerse las fuentes arregla la tipografía, no el acceso.
- **Coordinación de dos pestañas.** Con el almacén **por registro**, una colisión entre dos
  pestañas se limita a un registro, no a todo el cuaderno. Es deuda, no un agujero. Si en
  el uso real molesta, se anota aparte y se decide por su cuenta.
- **Copia automática periódica.** Esta especificación arregla exportar, que **ya es** el
  mecanismo de salida y es un botón que el usuario ya conoce. Agregar una copia que salga
  sola es alcance nuevo para una misma garantía.
- **Dejar de guardar los archivos en base64.** Aunque el almacén nuevo lo permita y ocupara
  un 33 % menos, cambiar la forma en que se guarda el contenido toca el visor: es otro
  trabajo, con sus propios riesgos.
- **Convertir los minutos heredados al formato nuevo.** La migración copia, no transforma.
  Interpretar el registro viejo para convertirlo sería otro requisito, con su propia
  verificación.
- **Volver a escribir el registro heredado del Pomodoro.** Sigue siendo de solo lectura.
- **Un botón para reintentar la migración a mano.** Con un solo almacén **no hay a qué
  volver**: si el almacén no abre, la aplicación no abre, y un botón de reintento sobre una
  pantalla que no llegó a abrir no tiene dónde aparecer.
- **Escritorio de cualquier tipo, o PWA.** Descartado por el usuario el 2026-10-04: no
  aporta nada que esto dé, y obliga a servir la aplicación por http, rompiendo el doble
  clic.
- **Achicar el archivo grande de la aplicación más allá de lo que exija este trabajo.**
  Mover y corregir son dos trabajos distintos, y mezclarlos arruina alguno de los dos.
- **Actualizar las librerías.** Se usan las que están en uso. Subir de versión es otro
  trabajo, con sus propios riesgos.
- **Conectar el módulo de consentimiento por terceros.** Decidido el 2026-10-02: sin
  identidades ni servidor no hay cuaderno ajeno, y un control de privacidad que no
  controla nada es peor que no tenerlo.
- **Que el contenido de un documento no salga a internet.** Un documento guardado por el
  usuario que apunta a una imagen o a una hoja de estilos externa se sigue mostrando como
  hoy.
- **El primer commit con `.gitignore`.** Está pendiente y **no depende de esta
  especificación**: es no perder el trabajo, no el almacenamiento. Queda anotado en el
  [`cierre.md`](../007-almacenamiento-real/cierre.md) de la 007.

## Criterios de finalización

- [x] La medición del contexto **está hecha y escrita**: el almacén abre, escribe y relee
      desde el archivo abierto con doble clic, en Chrome 154, sin red. Está en la sección
      del contexto, con su alcance y sus límites
- [x] La decisión de "un solo almacén" se apoya en esa medición, no en una suposición
- [ ] Los datos se guardan en el almacén nuevo y siguen ahí al recargar (RF-1)
- [ ] Después de migrar, **nada se lee del almacén viejo**, y hay una comprobación que
      falla si eso deja de ser cierto (RF-1)
- [ ] Un día con una sesión del formato heredado muestra sus minutos **una vez, no dos**
      (RF-1)
- [ ] Los cuatro grupos se guardan por caminos que cumplen las tres garantías, y **cada
      garantía está comprobada** (RF-1)
- [ ] Si la escritura falla, el cambio se deshace en la pantalla y se avisa; **el defecto
      de las anotaciones está arreglado** (RF-4)
- [ ] Si las anotaciones guardadas no se pueden leer, **el calendario abre igual** y no se
      borra nada (RF-4)
- [ ] Lo que ya estaba guardado se copió, **lo viejo quedó intacto** y todo sigue visible
      (RF-2)
- [ ] La marca de migración terminada se escribe **después** de los datos, y una migración
      cortada se reintenta desde el principio sin dejar el cuaderno a medias (RF-2)
- [ ] Con el almacén no disponible, **la aplicación no abre**, muestra el texto con las
      cuatro cosas que dice RF-3 y **no vuelve al almacén viejo** (RF-3)
- [ ] El aviso de "casi lleno" **no aparece nunca**, y el texto de fallo al guardar ya no
      nombra un muro que no existe (RF-1, RNF-6)
- [ ] Exportar incluye los cuatro grupos, e importar un respaldo devuelve también el
      historial de estudio y las anotaciones (RF-5)
- [ ] El aviso previo de importar nombra los cuatro grupos que se van a perder (RF-5)
- [ ] `herramientas/capturar-arbol.js` y `herramientas/verificar-layout.js` siembran donde
      la aplicación lee, y el escenario de datos raros sigue dando **0 errores de consola**
      (RNF-5)
- [ ] Las cinco protecciones de escritura siguen existiendo, cada una con su comprobación
      (RNF-4)
- [ ] La comparación del árbol del menú lateral da **IDÉNTICO**
- [ ] Las sondas de calidad dan lo mismo que hoy: sin `package.json`, sin `node_modules`,
      nada fuera de lugar, nada que limpiar, todo entra
- [ ] En el navegador: consola con **0 errores** y todo legible a 375 px sin scroll
      horizontal
- [ ] `AGENTS.md`, `MEMORY.md` y `docs/constitucion.md` están al día en lo que les
      corresponde

## Decisiones tomadas en esta especificación

| Decisión | Respuesta | Quién | Fecha |
|----------|-----------|-------|-------|
| ¿Con qué almacén? | El del navegador que separa cada dato y no tiene el tope de 5 MB. **Siempre**: no hay modo normal ni modo limitado | Usuario | 2026-10-04 |
| ¿Puede la aplicación vivir en los dos almacenes a la vez? | **No.** Hay **un solo almacén**, sin vuelta atrás. Es lo que elimina los datos huérfanos, la decisión de dónde leer cada grupo y el tercer estado sin nombre | Usuario | 2026-10-04 |
| ¿Si el almacén no abre? | **La aplicación no abre**, y muestra por qué. Sin volver al almacén viejo | Usuario | 2026-10-04 |
| ¿El precio de no tener vuelta atrás? | **Aceptado y escrito**: si el almacén deja de funcionar después de migrar, la aplicación no abre. La alternativa —mostrar lo viejo y guardar donde nadie lee— es el hallazgo grave que tumbó la 007 | Usuario | 2026-10-04 |
| ¿Cuántas veces se migra? | Al arrancar, mientras no esté terminada. Después de terminada, **nunca más** | Usuario | 2026-10-04 |
| ¿La migración borra lo viejo? | **No, nunca.** Queda entero como red, y no hay ninguna operación que lo borre | Usuario | 2026-10-04 |
| ¿Dónde se lee cada grupo después de migrar? | **Del almacén nuevo y de ningún otro.** Los minutos heredados se copian tal cual y se leen de su copia | Consecuencia de la decisión del almacén | 2026-10-04 |
| ¿El aviso de "casi lleno"? | **Desaparece.** Ese muro ya no existe, y un aviso que nombra un muro que no está es peor que no avisar | Consecuencia de la decisión del almacén | 2026-10-04 |
| ¿La migración transforma los minutos heredados? | **No.** Copia, no transforma | Consecuencia del principio de no perder nada | 2026-10-04 |
| ¿Exportar sigue siendo manual? | **Sí.** Es el mecanismo de salida, y ahora incluye los cuatro grupos. La copia automática periódica queda afuera | Usuario | 2026-10-04 |
| ¿Se arregla lo de `vendor/` y las fuentes? | **No.** No da ni un KB de cuota del navegador, y los PDF seguirían sin abrir sin internet | Usuario | 2026-10-04 |
| ¿Se coordinan dos pestañas? | **No.** Es deuda: con el almacén por registro, la colisión se limita a un registro | Usuario | 2026-10-04 |

## Dudas abiertas

- **[MENOR] El plazo fijo de la prueba de disponibilidad y de la lectura inicial.** La
  especificación exige que sea **fijo y corto**, y que el número **no aparezca en ningún
  texto de la interfaz**: un número escrito a mano en un mensaje se desincroniza solo, y
  además un plazo en pantalla que el usuario no puede cambiar solo puede confundir. **El
  valor es cosa del plan**, no de acá.

- **[MENOR] El plazo fijo** de la prueba de disponibilidad y de la lectura inicial: **el
  valor es cosa del plan**, no de acá.

## Cómo se lee el cuaderno: el índice en memoria, los archivos a pedido

Esta duda estaba abierta y **el usuario la cerró el 2026-10-04**. Se escribe acá porque
condiciona cómo se lee todo lo demás, y porque el motivo de la decisión es una clase de
falla que el proyecto ya payé una vez.

**Lo que decide:** al abrir el almacén, el **índice** del cuaderno —materias, documentos,
minutos y anotaciones— se lee **una sola vez** y queda en memoria. Los **archivos** de
cada documento (el PDF, el Word) **no se cargan**: se piden al almacén **en el momento en
que el usuario abre ese documento**, y no antes.

| | Qué se guarda en memoria | Qué se pide al almacén | Cuándo |
|---|---|---|---|
| Materias, sus documentos y el índice | Sí, al arrancar | — | Una vez |
| Minutos de Pomodoro y de estudio por secciones | Sí, al arrancar | — | Una vez |
| Anotaciones del calendario | Sí, al arrancar | — | Una vez |
| **El contenido de cada documento** | **No** | **Sí** | **Cuando el usuario lo abre** |

**Por qué el índice sí y los archivos no.** Si los archivos se cargaran al arrancar, un
cuaderno de 200 MB (RNF) tendría 200 MB en la memoria de la pestaña, y abrir la app por
la mañana costaría lo mismo que abrirla después de subir el año entero de apuntes. Como el
índice es lo chico —nombres, tipos, fechas y minutos— se puede tener entero en memoria sin
que se note, y lo que pesa se pide solo cuando hace falta.

**Por qué esto y no "preguntar al almacén cada vez".** La alternativa era volver asíncrona
la lectura, y eso obliga a cambiar el contrato de una función pública que consume otro
archivo. Ese modo de falla —tests en verde, página rota— ya está documentado en
`MEMORY.md`: pasó con el mapa de calor en blanco. Con el índice en memoria, **la lectura
sigue siendo sincrónica y ese contrato no se toca.**

**Lo que esta decisión deja escrito, y no es negociable:** el cuaderno se lee del
almacén nuevo, y **ningún registro se cuenta dos veces** (RF-1). La forma de leer no
cambia ese regla: la hace posible.
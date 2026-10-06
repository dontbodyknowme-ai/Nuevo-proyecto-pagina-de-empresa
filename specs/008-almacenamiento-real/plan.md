# Plan de implementación: Almacenamiento real, en un solo almacén

> **Antes de leer este plan.** La spec 008 está **aprobada** (2026-10-05). Este plan se
> escribió después de **verificar la spec contra el código**, no antes: cada afirmación
> sobre lo que hay hoy tiene número de línea, y una de las afirmaciones de la spec era
> **incorrecta** y quedó corregida en la spec. Las decisiones que esa verificación abrió
> están en la tabla **Decisiones tomadas en esta especificación** de `spec.md`, con fecha.

## 0. Decisiones que este plan propone

### DD-1 — El almacén nuevo es un módulo aparte, y no se toca `js/logica/almacenamiento.js`

> **SUPERADO el 2026-10-05 (T10), con el usuario a favor.** El módulo **ya no existe**.
>
> Lo que pasó: al borrarse el aviso de "casi lleno", `app.js` dejó de llamarlo, y
> `buscar-codigo-muerto.js` marcó `debeRevertir` y `puedeEscribir` sin consumidor.
> Desaparecer el consumidor dejó el módulo entero, con sus 45 tests, probando lógica a la
> que ningún camino de la aplicación llega.
>
> Se borró el módulo, sus dos tests, su `<script>` en `index.html`, su entrada en `ORDEN`
> y su global en la lista de `navegador.test.js`.
>
> **Lo que de este DD sigue en pie:** el módulo nuevo se llama `js/datos/almacenamiento.js`
> y no amplía `js/logica/almacenamiento.js` — ya no hay nada que ampliar. La lógica de
> capacidad **no se mudó**; se fue con su único consumidor, que era el aviso que nombraba
> un muro de 5 MB que ya no existe.
>
> La lección que queda: **un DD que dice "no se toque" es una decisión sobre el estado de
> ese día.** Escrito en el plan y nunca revisado, deja de ser una decisión y pasa a ser
> una costumbre.

El almacén se encapsula en **`js/datos/almacenamiento.js`**: abre, migra, lee y escribe.
`js/logica/almacenamiento.js` **no se toca**: es lógica pura de capacidad
(`puedeEscribir`, `debeRevertir`, `umbralDe`, `estimarEspacioDisponible`) y sus tests
siguen valiendo, porque deciden lo mismo que siempre.

Los dos archivos se llaman parecido y no son lo mismo, y esa confusión es un riesgo
concreto: hoy uno **mide** y el otro **guarda**. Para que el nombre no invite a
confundirlos, el nuevo se llama **`js/datos/almacenamiento.js`** —en `datos/`, que es
donde vive lo que habla con el navegador— y el primero se queda en `logica/` con su
nombre. El plan deja escrito que la parecido de los nombres es **deuda de nombres**, no
una decisión neutra: se acepta porque cambiar el nombre del módulo puro rompería
`test/navegador.test.js` sin aportar nada.

**Alternativa descartada:** ampliar `js/logica/almacenamiento.js` para que también
escriba. Rompe su contrato —es puro, sin navegador, y por eso `node --test` lo corre sin
DOM— y obliga a los tests a tener el almacén falso para probar capacidad.

### DD-2 — El arranque se secuencializa con `await`, y solo al arrancar

El almacén nuevo es **asíncrono** y el actual es **sin cronía**. La spec 008 decidió
(más abajo, *"Cómo se lee el cuaderno"*) que **el índice se lee una sola vez al arrancar
y queda en memoria**, y que la lectura **sigue siendo sincrónica** para no romper el
contrato de funciones públicas que consumen otros archivos.

Las dos cosas juntas tienen una consecuencia que hay que decidir acá y no se puede dejar
suelta: **el arranque deja de ser una lista de llamadas y pasa a ser una secuencia con
`await`**. Hoy el orden es fijo y declarativo (`app.js:131-135`); con el almacén, la
secuencia es: abrir → probar disponibilidad → migrar si toca → recién ahí dibujar.

Eso **no cambia nada de lo que se ve**: el usuario no ve ninguna diferencia porque hasta
que la secuencia no termina no hay nada que dibujar, que es exactamente lo que dice RF-3
("modo iniciando": ninguna operación que cambie datos habilitada).

**Alternativa descartada:** arrancar el dibujo sin esperar al almacén y llenar la pantalla
después. Es lo que más rápido se ve, y es exactamente lo que la spec veta: se vería un
cuaderno vacío que después se llena, y si el almacén no abre habría que *desdibujar* lo
dibujado. Un cuaderno que se ve y después se vacía es peor que uno que tarda un instante
en aparecer.

### DD-3 — Los caminos que guardan pasan a ser `async`, y los ocho llamadores los esperan

**Este es el punto que cambia más código y el que más fácilmente se hace mal.**

La garantía 2 de RF-1 —*revertir: lo que ve en pantalla vuelve a ser lo que está
guardado, nunca ve algo que no está guardado*— **no se puede cumplir con escrituras
asíncronas si el llamador no espera**. Con el almacén viejo, `guardarDatos()` devolvía
`true` o `false` **sin cronía**: el `catch` ya había corrido cuando volvía. Con el almacén
nuevo, la escritura se confirma después, así que un `return true` temprano sería una
mentira.

Por eso la decisión es: **`guardarDatos()` y `guardarRevirtiendoSiFalla()` devuelven una
promesa**, y **los ocho llamadores la esperan antes de redibujar**. Si no se espera, la
reversión ocurre sobre una pantalla que ya se pintó con el cambio, y el usuario ve
justo lo que la garantía promete que no va a ver.

Los ocho llamadores ya están inventariados en el código (`app.js:572`, `626`, `703`,
`827`, `854`, `1186`, `1301`, y el camino de las anotaciones). Cada uno pasa a `async` y
pone `await` antes de su redibujado.

**Alternativa descartada:** dejar los caminos sin cronía y que la reversión llegue
después. Es la tentación natural —no hay que tocar los ocho llamadores— y **es la que
produce exactamente el fallo que RF-1 prohíbe**: durante un instante el usuario ve un
cambio que quizá no exista. Un fallo de guardado que se corrige solo treinta milisegundos
después **sigue siendo un fallo silencioso**.

**Consecuencia que hay que aceptar:** con `async`, dos clics rápidos sobre el mismo botón
pueden solaparse. Hoy no hay problema porque todo es sin cronía; mañana dos escrituras
pueden terminar en orden inverso. Esto **no se resuelve en esta especificación** —es la
misma deuda de dos pestañas que ya está escrita en *Fuera de alcance*— pero **sí hay que
anotarlo como riesgo conocido**, no descubrirlo cuando aparezca.

### DD-4 — La garantía de revertir se reparte, y no vive entera en un archivo

La primera versión de este plan decía que "las tres garantías se implementan en el
módulo". **Es falso, y está escrito por qué.** La garantía de revertir es, por
definición, sobre el estado en memoria —la palabra "volver a ser lo que estaba
guardado" necesita saber cuál era— y ese estado vive en `app.js` (`materias`,
`calendario.anotaciones`, `seccionesEstado`). El módulo no tiene acceso a él.

Así que la garantía se reparte en dos mitades, y **cada mitad sabe lo suyo**:

| Mitad | Dónde vive | Qué hace |
|-------|-----------|----------|
| **Escribir y no dejar a medias** | `js/datos/almacenamiento.js` | Escribe en el almacén y, si la escritura se corta, deja el registro como estaba antes |
| **Revertir la memoria** | `js/app.js`, en `guardarRevirtiendoSiFalla` | Si la escritura devuelve que no pudo, vuelve a poner en memoria lo que había |

El módulo **no conoce la pantalla**; `app.js` **no conoce cómo se escribe**. El contrato
entre los dos es una promesa, y esa promesa es lo que hay que probar: *el módulo devuelve
falso solo cuando no dejó nada escrito a medias.*

**Alternativa descartada:** que el módulo reciba un callback con el estado anterior y
revierta él. Parece más limpio, y en realidad esconde el problema: el módulo tendría que
saber qué es "el estado" de cada grupo, y son cuatro con cuatro formas distintas. Es la
razón por la que `guardarDatos` está hoy atado a `materias` y a
`JSON.stringify(materias)`: no es un descuido, es que cada grupo tiene su forma.

### DD-5 — El módulo expone una interfaz sin cronía para leer, y asíncrona para guardar

El contrato que consume `js/inicio-calendario.js` y las funciones públicas
**no se toca** (`minutosDeEstudioPorDia` sigue siendo sincróna). Eso lo consigue el
**índice en memoria**: al arrancar se leen los cuatro grupos una vez, quedan en variables,
y las lecturas de siempre leen esas variables.

| Operación | Sin cronía o asíncrona | Por qué |
|-----------|------------------------|---------|
| Leer el índice | **Sin cronía** | Ya está en memoria; el contrato público no cambia |
| Leer el contenido de un documento | **Asíncrona** | Son los archivos pesados, que no se cargan al arrancar |
| Guardar cualquier cosa | **Asíncrona** | La escritura al almacén es asíncrona; por eso los llamadores esperan (DD-3) |
| La prueba de disponibilidad | **Asíncrona**, con plazo fijo | El paso de lectura lo es |

**Alternativa descartada:** un almacén de contenidos separado, con los archivos sin cargar.
Es
lo que dice la spec (el índice en memoria), pero con `localStorage` no había forma de
"apuntar" a algo sin cargarlo; con el almacén nuevo sí, y esa es la diferencia que hace
que un cuaderno de 200 MB abra igual que uno de 2 MB.

### DD-6 — La marca de migración se escribe al final, en su propio registro

RF-2 dice que la marca se escribe **después** de los datos, y por qué: si se escribiera
primero, una copia cortada dejaría el almacén marcado como terminado con datos a medias, y
eso nadie lo repara porque la regla ya diría que no hay nada que hacer.

La decisión concreta: la marca es **un registro con nombre reservado** en un almacén de
metadatos, y se escribe **en el último paso**, después de los cuatro grupos. Si la
escritura de la marca falla, la migración **no se dio por terminada** y se reintenta.

**Alternativa descartada:** guardar la marca dentro del mismo registro de materias. Se
escribiría "gratis" junto con los datos, pero entonces una copia a medias llevaría la marca
adelante, que es exactamente el problema que RF-2 quiere evitar.

### DD-7 — La lectura de arranque de los minutos heredados se protege antes de migrar

La lectura de `pomodoroSesiones` (`app.js:1445-1447`) es **código de nivel superior** con
`JSON.parse` sin `try`: si el valor guardado no es un texto válido, **la aplicación no
abre**. RF-4 dice que debe abrir igual, y la spec (corregida) lo dice con esas palabras.

La decisión: **la lectura del almacén viejo se hace dentro de la secuencia de arranque, ya
protegida**, antes de decidir si hay migración. Es decir: primero se abre el almacén viejo
con protección —que nunca tira— y recién después se pregunta si hay algo que migrar. Un
JSON roto se convierte en "no hay datos que migrar" con un aviso, no en una página muerta.

**Alternativa descartada:** poner un `try`/`catch` alrededor de la línea 1446 y seguir.
Es la tentación —es una línea— y deja el problema en su sitio: en dos años, cuando la
lectura vuelva a moverse, el `try` se queda atrás y vuelve el fallo. La protección se
pone **en el punto por donde pasa todo el mundo**, que es el módulo del almacén.

### DD-8 — El plazo de la prueba de disponibilidad, medido: 2000 ms

RF-3 exige que la prueba tenga "un plazo fijo" y que, si no se completa, la respuesta sea
que el almacén no está disponible. La spec deja el **valor** al plan y, además, exige que
**el número no aparezca en ningún texto de la interfaz**.

**Primero se eligió sin medir, y después se midió.** El valor original eran **5000 ms**,
elegidos por la asimetría de las consecuencias. Con el dato en la mano bajó a **2000 ms**.

**La medición** (`herramientas/medir-disponibilidad.js`, 2026-10-05): Chrome 154, desde
el archivo, **con la red desconectada de verdad** por el protocolo DevTools.

| | |
|---|---|
| Primer tiempo, en frío | **87 ms** |
| Los cuatro siguientes | **8, 6, 4, 4 ms** |
| Peor caso observado | **87 ms** |

El primer tiempo es casi 20 veces más grande que los otros: es la apertura en frío, la
primera vez que se crea la base. **Un promedio lo escondería**, y por eso la sonda mide
cinco vueltas y muestra cada una.

**La segunda corrida dio 9 ms, y con eso hay que tener cuidado.** Con todo caliente, la
misma sonda midió 9, 7, 4, 4, 3 ms. **El número con el que se diseña sigue siendo 87**,
porque el caso que hay que cubrir es el peor y no el típico: un falso negativo hace que
la aplicación **no abra**. Si se diseñara con 9, el plazo bajaría a un valor que
funcionaría en toda máquina ya usada y **fallaría en la primera vez después de encender
la computadora**.

**El valor: 2000 ms para la prueba entera** —abrir, escribir el registro de prueba,
leerlo y borrarlo—, no por paso.

Se elige así por la **asimetría de las consecuencias**, que es lo único que importa acá:

| Si el plazo es… | Qué pasa | Cómo se vive |
|-----------------|----------|--------------|
| **Corto de más** | Un falso negativo: el almacén **sí** abre, pero la prueba no terminó a tiempo | **La aplicación no abre.** Muestra "no puedo abrir el almacenamiento", y el usuario se queda sin poder estudiar. Es un fallo total disfrazado de fallo del navegador |
| **Largo de más** | Un falso positivo: se espera de más en el arranque | El usuario espera unos segundos más, una vez, y solo en una máquina lenta |

Ninguna de las dos se puede compensar con un número, y no hay forma de promediarlas: el
primer caso cuesta todo, el segundo cuesta una espera.

- **2000 ms** es unas **23 veces** el peor caso medido. Es el margen para una máquina
  lenta, con el antivirus revisando el archivo, o con el disco duro — 23 veces más
  lenta antes de un falso negativo.
- Y sigue estando por debajo de los ~10 s en que alguien que espera una página **asume
  que se colgó** y la cierra.

**Que la spec pida "corto" y este plan elija un plazo es deliberado**, y hay que decirlo:
"corto" era el deseo, y el deseo no es el requisito. El requisito de RF-3 es que la prueba
**termine o se declare no disponible**, y un plazo corto prefiriendo la app cerrada
incumple el requisito que de verdad importa.

**Por qué 5000 no era el número.** Con 87 ms de peor caso, 5000 daba un margen de 57
veces: prudente, pero tan holgado que **el plazo dejó de proteger nada**. Un plazo que
ninguna circunstancia real puede alcanzar no es una garantía, es un número decorativo.

> **El número no aparece en ningún texto de la interfaz.** El texto de RF-3 dice que no puede
> abrir el almacenamiento y nombra las dos causas probables; **no** dice "esperó dos
> segundos". Un plazo escrito en un mensaje es un número que se desincroniza solo y que el
> usuario no puede cambiar. Hay un test que falla si el texto vuelve a tener un dígito.

**Cómo se vuelve a cambiar bien.** Con `node herramientas/medir-disponibilidad.js`, que
es repetible. Si algún día el navegador o la máquina cambian y el peor caso se acerca al
plazo, la sonda lo dice sin que nadie lo note.

## 1. Archivos que se crean

| Archivo | Qué lleva |
|---------|-----------|
| `js/datos/almacenamiento.js` | Abre el almacén, prueba disponibilidad, migra, lee, escribe, arma copia y restaura |
| `test/almacenamiento-disponible.test.js` | Las funciones puras de `js/datos/almacenamiento.js`: qué se responde a partir de los tres pasos, el valor del plazo, y el texto de "no abre" |
| `test/almacenamiento-navegador.test.js` | Lo que **no** se puede probar con Node: que el almacén abre, que guarda y que relee. Corre en el mismo arranque de navegador falso que el resto |

> **Por qué dos archivos de test.** Los módulos que se prueban en Node exportan por
> `module.exports`; los que se cargan como el navegador los carga `test/navegador.test.js`
> por su lista `ORDEN`. El módulo del almacén es **de los segundos** (habla con el
> navegador), así que sus tests de comportamiento van con `ORDEN`, no en un `require`.

## 2. Archivos que se modifican

| Archivo | Qué cambia |
|---------|-----------|
| `js/app.js` | El arranque pasa a ser una secuencia con `await`. `guardarDatos()` y `guardarRevirtiendoSiFalla()` devuelven promesa. Los **ocho** llamadores esperan antes de redibujar. Las anotaciones dejan de escribir por su cuenta. `minutosDeEstudioPorDia()` sigue siendo sin cronía y lee del índice en memoria. Los avisos de fallo siguen siendo `alert()`. Desaparece `mensajeAlmacenamientoLleno` y el texto de `mensajeFalloAlGuardar` deja de nombrar el espacio |
| `js/interfaz/aviso.js` | Le llega un caso nuevo: el texto de que la aplicación no abre |
| `js/logica/datos.js` | `normalizarMaterias` ya existe; se le suma un equivalente para los otros tres grupos, o se generaliza. **Decisión de Implementación**, ver más abajo |
| `test/navegador.test.js` | Las cinco protecciones se reescriben contra el almacén nuevo, y la red que vigila que los que mudan datos usen la versión que deshace se actualiza |
| `test/visor.test.js` | La lista de archivos que mira ya incluye los nuevos |
| `herramientas/capturar-arbol.js` | Siembra en el almacén nuevo, no en `localStorage`. **Sin esto mide una app vacía** |
| `herramientas/verificar-layout.js` | Ídem |
| `index.html` | **No se toca.** El módulo entra en la lista `ORDEN` de `test/dom-falso.js`, y el test que compara esa lista con `index.html` falla si se olvida |
| `AGENTS.md` | La estructura gana `js/datos/almacenamiento.js`; y el orden de carga, si el módulo va antes de `app.js` |
| `MEMORY.md` | La spec 008 y sus cuatro decisiones |
| `docs/constitucion.md` | Solo lo que le corresponda: la glosario de "el almacén nuevo" y la afirmación de que las librerías son de CDN (esa la **no** cambia: `vendor/` salió de alcance) |

## 3. Archivos que NO se tocan

| | Por qué |
|---|---|
| `css/styles.css` | RNF-6. No cambia ni un píxel |
| `js/logica/almacenamiento.js` | DD-1, **superado en T10**: se borró el módulo y sus 45 tests, sin consumidor desde que se fue el aviso de "casi lleno" |
| `js/logica/*` (el resto) | La lógica pura no cambia: lo que cambia es dónde viven los datos |
| `js/interfaz/mapa-calor.js`, `js/inicio-calendario.js` | No cambian: siguen recibiendo `minutosDeEstudioPorDia()` sin cronía, que es el contrato que DD-5 preserva |
| `vendor/` | Fuera de alcance, decidido por el usuario el 2026-10-04: no da ni un KB de cuota |
| La copia automática cada 7 días | Fuera de alcance |
| La coordinación de dos pestañas | Fuera de alcance, y es deuda asumida (DD-3) |
| Base64 → binario | Fuera de alcance |
| `js/interfaz/visor.js` | Ya está bien. **Y el plan anterior metía aquí una tarea que es de la spec 006**; no corresponde |

## 4. Orden de ejecución

```
T1  Congelar la línea base y abrir las redes que todavía no miran el archivo nuevo
T2  El módulo: abrir el almacén y la prueba de disponibilidad
T3  El arranque secuencializado, la lectura protegida del almacén viejo, y el cableado
T4  La migración: los cuatro grupos, y la marca al final
T5  El índice en memoria y los archivos a pedido
T6  La escritura: promesa, y los ocho llamadores que la esperan
T7  Las anotaciones del calendario, por fin con las tres garantías
T8  Exportar e importar con los cuatro grupos
T9  Los textos: fuera "casi lleno", y el texto de fallo sin nombrar el espacio
T10 Las herramientas, que siembran donde la aplicación lee
```

> **T2 y T3 están pegadas a propósito, y por un motivo que se descubrió al
> implementarlas.**
> El módulo del almacén se puede escribir y probar sin tocar el arranque (sus funciones
> puras andan en Node), pero **la prueba de disponibilidad no hace nada hasta que el
> arranque la consulta**. Por eso el módulo quedó terminado y el detector de código
> muerto reportó `probarDisponibilidad` y `textoAlmacenamientoNoAbre` **sin consumidor**,
> que es la verdad: en T2 todavía no los llama nadie. **El rojo se va solo en T3**, sin
> excepciones ni parches.
>
> La salida que se evaluó y se descartó: meter un `indexedDB` falso en
> `test/dom-falso.js` para poder cablear antes. El arnés no tiene `indexedDB`, así que
> hacerlo en T2 haría que **la app tomara el camino de "no abre" en todos los tests de
> navegador**, y taparlo con un mock en memoria es meter algo que se parece al almacén
> sin ser el almacén. `MEMORY.md` ya avisa dos veces de ese modo de fallo.

**Son diez, y son el máximo que admite la skill.** Lo que sigue a la última tarea **no es
una tarea más**: es la fase de *Validación* del flujo, que se corre entera y no se
implementa tarea por tarea. Por eso el plan no lista "verificación" como undécima tarea.

**Por qué T1 antes que todo.** Es lo contrario de lo natural: primero se abre la red, y
después se mueve. Lo natural es cambiar el código y ver qué se rompe. Pero las cinco
protecciones de escritura miran `localStorage`, y si se migra el almacén sin tocarlas
primero, **pasan en verde mirando un lugar donde ya no se escribe**: exactamente lo que
le pasó a `test/visor.test.js` y está escrito en `MEMORY.md`.

**Por qué T3 antes que T4.** La lectura de `pomodoroSesiones` sin `try` tumba el
arranque, y el arranque es lo que va a cambiar primero. Si se migra antes de proteger esa
lectura, hay una ventana en la que la app no abre.

**Por qué T6 y T7 separadas.** T6 toca los ocho llamadores y es lo que más se parece a un
refactor. T7 es un defecto que **existe hoy**, con pérdida silenciosa. Si van juntas, y en
T6 aparece un problema, no se sabe si era de la migración o de las anotaciones. La
constitución lo dice: **mover no es corregir**.

**Por qué T10 va al final y no al principio.** Las herramientas siembran hoy con
`localStorage`, que es donde la aplicación lee **hasta que migra**. T10 las mueve al
camino nuevo. El riesgo que esto crea —que el árbol dé IDÉNTICO o no por la migración y no
por un cambio de la aplicación— está escrito en los riesgos, y T10 lo nombra para que no
se confunda.

## 5. Verificación

### Lógica pura (Principio 4, camino 1)

```
node --test                                  # → fail 0. El número sale de la corrida
node --test test/almacenamiento-disponible.test.js   # → la prueba de disponibilidad
node --test test/navegador.test.js           # → las cinco protecciones reescritas
node herramientas/buscar-codigo-muerto.js    # → salida 0
node herramientas/buscar-caracteres-raros.js # → salida 0
```

**El número de tests no se escribe a mano.** Sale de la corrida, y RNF-4 dice que la cuenta
deja de ser el requisito: lo que no puede bajar es que **cada una de las cinco
protecciones siga teniendo su comprobación**.

### Lo que se ve (Principio 4, camino 2)

```
node herramientas/capturar-arbol.js herramientas/linea-base-arbol.json
node herramientas/comparar-arbol.js          # → IDÉNTICO, salida 0
node herramientas/verificar-layout.js        # → salida 0
```

**La línea base se congela antes de tocar nada**, y T0 lo dice en voz alta para que nadie
la regenere sin querer. Si se regenera después, el movimiento se compara contra algo que
ya estaba mal y no prueba nada.

Y en Chrome, a mano, con un `--user-data-dir` temporal (**nunca** en el perfil del
usuario):

| Qué | Cómo se comprueba |
|-----|-------------------|
| El almacén abre desde `file://`, sin red | Abrir con doble clic y desconectar la red |
| La migración copia los cuatro grupos | Sembrar datos en el almacén viejo, abrir, y comparar |
| La marca se escribe **al final** | Cortar la migración, reabrir, verificar que se reintenta entera |
| Una anotación que no entra avisa y **no queda puesta** | Romper el almacén, guardar una anotación |
| Exportar trae los cuatro grupos | Exportar y abrir el JSON |
| Importar avisa los cuatro que se pierden | Importar y leer el `confirm()` |
| Los minutos heredados rotos **no tumban la app** | Sembrar `pomodoroSesiones` con basura, abrir |
| A 375 px no hay scroll horizontal | Ventana angosta |
| Consola con **0 errores** | Consola de Chrome |

### La red se prueba rompiéndola

Las cinco protecciones se **verifican inyectando lo que deben detectar**: se rompe la
escritura a propósito y tiene que verse el aviso. Una red probada solo en su estado normal
casi nunca detecta nada, y da verde, que se confunde con "funciona".

## 6. Riesgos

| Riesgo | Cómo se evita |
|--------|---------------|
| **Las redes dejan de cubrir y nadie se entera** | T0. Las cinco protecciones y la red de XSS se abren **antes** de mover nada, mirando la lista de archivos |
| **`pomodoroSesiones` con basura tumba la app** | T2, antes de que el arranque cambie |
| **Un llamador no espera la promesa y la pantalla muestra lo no guardado** | T5 toca los ocho, y hay una comprobación que falla si alguno no espera |
| **Dos escrituras se pisan por solaparse** | **No se resuelve acá.** Es la deuda de dos pestañas, ya escrita en *Fuera de alcance*. Se anota como riesgo, no se esconde |
| **`guardarDatos` y `guardarRevirtiendoSiFalla` quedan atadas a `materias`** | DD-4. El módulo no ve la pantalla; cada grupo conserva su forma |
| **Los dos `almacenamiento.js` se confunden** | DD-1. Se acepta la parecido del nombre como deuda, y se escribe por qué |
| **Las herramientas siembran donde la app ya no lee** | T9. Y RNF-5 lo pone como criterio de finalización: si no, "IDÉNTICO" se cumple de mentira |
| **El texto de fallo sigue nombrando el espacio** | T8, con una comprobación que falle si la palabra vuelve |
| **Alguien "arregla" el fallo silencioso de paso con el refactor** | T5 y T6 son tareas separadas. Si aparece un defecto al mover, **se anota y se deja** |

## 7. Lo que este plan deja escrito

- Un módulo `js/datos/almacenamiento.js` con apertura, disponibilidad, migración, lectura,
  escritura, copia y restauración.
- El arranque secuencializado con `await`, y la lectura protegida del almacén viejo.
- La migración de los cuatro grupos, con la marca escrita **al final**.
- El índice en memoria y los archivos a pedido, con el contrato público **sin cronía**.
- Los caminos de escritura como promesa, y los ocho llamadores esperándola.
- Las anotaciones del calendario con las tres garantías, en el camino compartido.
- Exportar e importar con los cuatro grupos, y el aviso que los nombra.
- Fuera el aviso de "casi lleno"; el texto de fallo sin nombrar el espacio; los avisos de
  escritura **seguyen siendo `alert()`**.
- Las cinco protecciones reescritas contra el almacén nuevo, cada una con su comprobación.
- Las dos herramientas de verificación sembrando donde la aplicación lee.

Y deja **sin** tocar, con el motivo anotado: `vendor/`, la copia automática, la
coordinación de dos pestañas, base64 → binario, la conversión de los minutos heredados, y
el `app.js` monolítico.

## 8. Lo que este plan deja sin decidir

Cosas que son **del Implementación** y que este plan no cierra a propósito, para que se
decidan con el código a la vista y no desde un papel:

1. **Si `normalizarMaterias` se generaliza o se hace una función por grupo.** La spec pide
   que los datos raros de los otros tres grupos **se completen y no se borren**, pero no
   dice cómo. Con un grupo es `normalizarMaterias`; con cuatro, puede ser una función con
   un parámetro o cuatro funciones. Se decide leyendo `js/logica/datos.js`.
2. **El nombre del archivo del módulo** y si `datos/` necesita una regla escrita de qué va
   en `logica/` y qué va en `datos/`. Es una regla de la que la rama 008 se va a acordar
   después.

> **Lo que estaba acá y ya no está:** el plazo de la prueba de disponibilidad. La spec lo
> deja al plan, y el plan lo elige: **5000 ms**, justificado en **DD-8**. No es que se
> mida durante la implementación —se mide **para poder bajarlo**, si se baja, y la medición
> es la comprobación de T2—, pero el número está decidido acá y no abajo.

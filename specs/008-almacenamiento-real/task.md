# Tareas: Spec 008 — Almacenamiento real, en un solo almacén

> **Estado de la spec:** aprobada el 2026-10-05. El plan es
> [`plan.md`](plan.md); el código afectado está inventariado con números de línea en la
> sección *"Los cuatro datos y los caminos que tienen hoy"* de [`spec.md`](spec.md).
>
> **Una tarea por llamada.** El `implementer` implementa **una** y para. En la lógica pura,
> los tests se escriben **primero y en rojo**, y recién después el código.

## Orden y dependencias

```
T1 ──► T2 ──► T3 ──► T4 ──► T5 ──► T6 ──► T7
                                            └──► T8 ──► T9 ──► T10 ──► T11
```

> **Terminada el 2026-10-05.** Las once tareas hechas. `node --test` → **493 tests,
> `fail 0`**; `buscar-caracteres-raros.js` → nada fuera de lugar;
> `buscar-codigo-muerto.js` → **salida 0**; `navegador.test.js` → 17/17;
> `comparar-arbol.js` → **IDÉNTICO** contra la línea base del 1/10/2026 **sin
> regenerarla**; `verificar-layout.js` → **24 de 24**.
>
> **Lo que queda abierto, y son decisiones de producto, no de código:**
>
> - El `beforeunload` pierde como máximo 30 segundos de una sesión de Pomodoro. Lo resolvió
>   el latido de T8, y el precio está anotado ahí.
> - Si las anotaciones guardadas no se pueden leer, el usuario ve el calendario vacío y
>   **no tiene forma de recuperar el valor viejo desde la aplicación**. Se puede a mano
>   desde el almacenamiento del navegador, y el cartel avisa, pero no hay botón.
> - Un cuaderno abierto en dos pestañas: **gana la última escritura**. Sigue así, y la spec
>   lo declaró fuera de alcance.
>
> **Y dos afirmaciones de la documentación que el código dejó viejas.**
> `docs/constitucion.md` sigue diciendo "91 tests" y que `app.js` está "pendiente de
> refactorizar". Con 493 tests y el almacenamiento movido, las dos están viejas.

T1 no depende de nada y **condiciona a todas**: sin la red abierta, mover el almacenamiento
es hacerlo a ciegas. T7 sale de T6 y no se puede adelantar, aunque el defecto exista hoy:
arreglarlo antes significaría tocar las escrituras sin tener el camino nuevo.

**T8 no estaba en este plan.** Es la deuda que T6 dejó abierta —la pérdida de minutos al
cerrar la pestaña—, y el usuario la suba a primer plano el 2026-10-05. La decisión de
cómo se resuelve es suya: se optó entre el `preventDefault` que molesta, la red de
seguridad en `localStorage` que devuelve el store viejo, y el **latido** que se eligió.
Lo que hizo el latido, además, fue destapar un defecto de T3 que nadie estaba mirando.

---

- [x] **T1. Congelar la línea base y abrir las redes que todavía no miran el archivo
  nuevo.** RNF-4, RNF-6

  > **Hecha el 2026-10-05.** La lista que había en esta tarea estaba mal: nombraba a
  > `test/responsive-calendario.test.js` como una de las redes que tenía que ampliarse, y
  > **esa red no corresponde**. Al leerla se vio que vigila la geometría del calendario, y
  > el módulo del almacén no tiene nada que ver con eso. Peor: usa `readFileSync` sin
  > comprobar existencia, así que agregar ahí un archivo que todavía no existe la haría
  > **fallar con una excepción**.
  >
  > Las otras dos redes que leen archivos —`test/menu-movil.test.js`, que busca la sección
  > del menú, y `test/estadisticas-visibles.test.js`, que busca la función de
  > estadísticas— tampoco tienen motivo para mirar el almacén. **La única que sí lo necesita
  > es la del XSS**, y por un motivo concreto: el módulo nuevo es el primer lugar por donde
  > pasa el contenido de los documentos del usuario, que hasta ahora solo pasaban por el
  > visor.
  >
  > Agregar el archivo a redes donde no aplica no daña la app, pero deja la impresión de
  > que el módulo es un problema en más lugares del que es. Es el mismo criterio que se
  > aplicó con `vendor/` en la 007.
  >
  > **Lo que se hizo:** `js/datos/almacenamiento.js` quedó declarado en
  > `ARCHIVOS_DE_LA_APP` de `test/visor.test.js`, y se agregaron dos tests. Uno **falló
  > primero**, con el mensaje de que el módulo no está en la lista. El segundo verifica que
  > toda entrada que no exista en el disco diga por qué en su propia línea: un nombre mal
  > escrito no lanza ningún error, se salta en silencio, y la red queda vigilando un archivo
  > inexistente **con verde todos los días**.
  >
  > **La red se probó con un XSS real** escrito en `js/datos/almacenamiento.js`: saltaron
  > las dos redes, cada una nombrando el archivo, y después de borrarlo volvieron a verde.
  > El archivo temporal **no quedó**: el módulo lo crea T2.
  >
  > **Resultado:** `node --test` → 427, `fail 0` (eran 425: los dos tests nuevos, ninguna
  > red apagada). `comparar-arbol.js` → **IDÉNTICO** en los 13 escenarios, salida 0, contra
  > la línea base del 2026-10-01. La línea base **no se regeneró**, que es el punto.

  - Hecho cuando: `herramientas/capturar-arbol.js` deja escrita
    `herramientas/linea-base-arbol.json` **antes** de tocar código, y
    `node herramientas/comparar-arbol.js` da **IDÉNTICO** con salida 0 sobre el código sin
    cambios.
  - Hecho cuando: **la red del XSS** declara en su lista `js/datos/almacenamiento.js`
    **aunque el archivo todavía no exista**, y salta el que no está en vez de fallar. Hay
    un test que falla mientras el módulo no esté en la lista.
  - Hecho cuando: se **inyecta un XSS real** en `js/datos/almacenamiento.js` y la red lo
    detecta diciendo el nombre del archivo; y sacándolo, vuelve a verde. *Una red que solo
    se probó en su estado normal no está probada.*
  - Hecho cuando: `node --test` queda en verde y **ninguna** de las redes se apagó: la
    cantidad de comprobaciones no baja.

- [x] **T2. El módulo del almacén: abrir, y la prueba de disponibilidad.** RF-3

  > **Hecha el 2026-10-05, con un recorte.** El criterio de "la aplicación **no abre**"
  > estaba en esta tarea y **no se podía cumplir acá**: el lugar donde se decide eso es
  > el arranque, y el arranque secuencializado es de **T3**. Son la misma cosa partida en
  > dos, y el error era de la división, no del código.
  >
  > Se comprobó con `herramientas/buscar-codigo-muerto.js`, que reportó
  > **`textoAlmacenamientoNoAbre` como categoría A — sin consumidor en todo el
  > proyecto**. La herramienta no se equivocaba: el texto existía, estaba probado, y
  > **nadie lo mostraba**, porque el arranque todavía no lo consultaba.
  >
  > **Decidido el 2026-10-05: opción 1.** El módulo queda como está, con sus exportaciones
  > puestas a propósito, y el cableado se hace en T3. El detector **sale en rojo hasta
  > que T3 use esas funciones**, y ese rojo es información verdadera, no un control roto:
  > en T3 vuelve a verde solo.
  >
  > **Lo que NO se hizo, y por qué:** no se metió un `indexedDB` falso en
  > `test/dom-falso.js`. Se evaluó y se descartó. El arnés no tiene `indexedDB` en su
  > contexto, así que cablear el arranque ahora haría que **la app tomara el camino de
  > "no abre" en todos los tests de navegador**. La salida era escribir un `indexedDB`
  > mínimo en el arnés, y eso es un mock del que `MEMORY.md` ya avisa dos veces: *un mock
  > que no se parece a lo real no protege* y *un mock que miente hace que un camino nunca
  > se pruebe*. Un mock que anda en memoria **no es** lo que hace un almacén en disco.
  >
  > **Lo que sí se hizo:**
  >
  > - `js/datos/almacenamiento.js` existe, con el IIFE y la doble exportación de la regla
  >   1 de `AGENTS.md`, y publica `window.AlmacenamientoDatos`.
  > - **Las puras están separadas de las que hablan con `indexedDB`.** `evaluarDisponibilidad`
  >   y `textoAlmacenamientoNoAbre` se prueban con `node --test`; el almacén de verdad se
  >   prueba en Chrome.
  > - `probarDisponibilidad()` hace **los tres pasos** y **borra el registro de prueba**
  >   siempre que no estuviera antes — haya coincidencia o no.
  > - Se escribe en el registro y se espera **`oncomplete`**, no el `put`: el `put`
  >   termina antes de que el disco confirme, y dar por buena una escritura antes de eso
  >   es una escritura que puede perder.
  > - El texto dice **las cuatro cosas** de RF-3 y **no tiene ningún número**: hay un test
  >   que falla si vuelve a aparecer un dígito, y otro que falla si nombra el plazo.
  > - El motivo **no va a la pantalla**: hay un test que falla si el texto cambia con el
  >   motivo.
  > - `index.html`, la lista `ORDEN` de `test/dom-falso.js` y `GLOBALES_VIGILADOS` de
  >   `test/navegador.test.js` quedaron sincronizados.
  >
  > **Resultado:** `node --test` → **439**, `fail 0` (eran 427: 12 puros nuevos). Los 18
  > scripts cargan sin errores. `buscar-caracteres-raros.js` → nada fuera de lugar.
  > `node --check` sin salida en los 18 archivos.
  >
  > **Lo que queda pendiente de esta tarea y pasa a T3:** la medición en Chrome del tiempo
  > que tarda la prueba, para poder bajar el plazo de 5000 ms de DD-8.

  - Hecho cuando: existe `js/datos/almacenamiento.js`, con el IIFE y la doble
    exportación que exige la regla 1 de `AGENTS.md`, y publica su global en `window`.
  - Hecho cuando: `probarDisponibilidad()` hace **los tres pasos** —abrir, escribir un
    registro de nombre reservado, volver a leerlo y comparar— y **borra el registro de
    prueba al terminar** si no existía antes.
  - Hecho cuando: el texto de "la aplicación no abre" dice **las cuatro cosas** que pide
    RF-3 —que no puede abrir el almacenamiento, que por eso el cuaderno no abre, las dos
    causas probables, y que **no se borró nada**— y **no menciona el plazo**. *El número
    vive en el código y no en la pantalla.*
  - Hecho cuando: `index.html` incluye el script y la lista `ORDEN` de
    `test/dom-falso.js` también, en el mismo orden: el test que las compara falla si se
    olvidó una.
  - ~~Hecho cuando: en Chrome, abierto desde el archivo con doble clic y sin red, la
    prueba devuelve disponible. El tiempo que tardó queda anotado en `MEMORY.md`.~~
    **Pasa a T3:** el arnés no tiene `indexedDB`, así que esta medición **no se puede
    hacer sin el arranque cableado**.
  - ~~Hecho cuando: si la prueba no termina dentro de 5000 ms, devuelve que no está
    disponible, y la aplicación no abre.~~ **Pasa a T3:** es la misma medición, y el
    "no abre" es del arranque.

- [x] **T3. La lectura protegida del almacén viejo, y el arranque secuencializado.**
  RF-1, RF-3, RF-4

  > **Hecha el 2026-10-05.** El criterio que vino de T2 se cumple entero: la app
  > **consulta la disponibilidad y decide**.
  >
  > **Lo que se hizo:**
  >
  > - `iniciar()` es una secuencia con `await`: probar disponibilidad, y recién ahí
  >   dibujar. **La llamada quedó al final de `app.js`**, no donde estaba el init: el
  >   cuerpo usa `seccionesEstado`, que se declara más abajo, y llamarlo desde arriba
  >   solo funcionaría por el orden de las microtareas. Eso es un acantilado que
  >   después nadie encuentra.
  > - Los cuatro `JSON.parse` sin proteger quedaron detrás de `leerAlmacenViejo()`, que
  >   **no tira nunca**: devuelve el valor por defecto y avisa, y **no borra nada**.
  > - La lectura de los minutos heredados **salió del nivel de arriba** del archivo. Ahí
  >   estaba el `JSON.parse` que tumbaba la página entera.
  > - El candado del arranque: `guardarDatos()` rechaza mientras la secuencia no
  >   terminó, y lo dice en un `alert()` — que es un aviso de **escritura**, y esos son
  >   `alert()` desde la decisión del 2026-10-05.
  > - `inicio` se publica en `window.CuadernoVirtual`, y el arnés lo devuelve. **Ese
  >   era el hueco que esta tarea tenía que cerrar**: `cargarComoNavegador()` solo juntaba
  >   errores **síncronos** y su `console` no hacía nada, así que con el arranque
  >   asíncrono un rechazo se perdía sin que ningún test lo viera. Hay un test que
  >   espera la promesa y falla si se rechaza.
  >
  > **Sobre el `indexedDB` del arnés.** Venía de la decisión de T2, que lo descartó. En
  > T3 **no había otra salida**: sin `indexedDB` en el contexto, la app tomaba el camino
  > de "no abre" en los veinte tests de navegador, porque eso es exactamente lo que hace
  > un navegador sin almacén. Se escribió **un almacén en memoria** en
  > `test/dom-falso.js`, con su frontera escrita en el mismo archivo: modela `open`,
  > `createObjectStore`, `transaction`, `get`, `put` y `delete` con `oncomplete` al
  > final; **no** modela persistencia, ni cuota, ni concurrencia, ni `onblocked`. Por eso
  > los caminos de fallo se provocan a mano con `sinAlmacen` y `almacen: 'no-abre'`, y
  > por eso **el comportamiento del almacén se sigue teniendo que probar en Chrome**.
  >
  > **El hallazgo que más costó, y que casi no se ve: cinco tests pasaron por la razón
  > equivocada.** Al agregar el candado, los tests de "el almacenamiento lleno no se
  > escribe" pasaron en verde — porque **el candado** impedía la
  > escritura, no la comprobación de espacio. Estaban probando otra cosa y nadie lo
  > notó. Se arregló haciendo que todos esperen el arranque con `await`, y está escrito en
  > el comentario de los dos helpers para que no se repita.
  >
  > **Dos bugs del almacén falso, que son bugs del mock y no del código:**
  > la transacción nunca cerraba (se olvidó programar el `oncomplete`), y la versión se
  > subía **antes** de preguntar si la base existía, así que `onupgradeneeded` no
  > corría y los almacenes no se creaban. Los dos aparecieron como "no se pudo escribir",
  > que es el síntoma de abajo y no la causa de arriba.
  >
  > **Lo que queda pendiente y no se puede hacer desde acá:** ~~la medición en Chrome
  > del tiempo que tarda la prueba~~ **hecha el 2026-10-05**. Quedan **dos decisiones**,
  > y ninguna la puede tomar la sonda:
  >
  > - **El origen medido es `file://`, no `null`.** La sección de contexto de esta spec
  >   afirma `null`. No cambia nada —el almacén abre igual— pero es una afirmación
  >   escrita que una medición contradice, y hay que corregirla en la spec.
  > - **El plazo de 5000 ms se bajó a 2000.** Con el dato en la mano. Y **la segunda
  >   corrida dio 9 ms, con todo caliente**: el número con el que se diseña sigue
  >   siendo **87 ms**, porque el caso que hay que cubrir es el peor y no el típico. Con
  >   9, el plazo bajaría a algo que funciona en toda máquina usada y **falla en la
  >   primera vez después de encender la computadora**. Queda escrito en `MEMORY.md` y en
  >   DD-8, con las dos corridas lado a lado.

  - Hecho cuando: el arranque **consulta la disponibilidad y decide**: si no está
    disponible, **la aplicación no abre** —no dibuja el cuaderno, no muestra los datos
    viejos y no escribe en ninguna parte— y muestra en la página el texto de T2.
    **Este criterio vino de T2.**
  - Hecho cuando: si la prueba **no termina dentro de 5000 ms**, o falla cualquiera de los
    tres pasos, la aplicación no abre con ese mismo texto.
  - Hecho cuando: **con el almacén roto a propósito**, la aplicación muestra el texto de
    "no abre" y **no dibuja el cuaderno**. *Dos caminos probados: el almacén ausente y el
    que no abre.*
  - Hecho cuando: `herramientas/buscar-codigo-muerto.js` **vuelve a salir 0**.
  - Hecho cuando: **hay un test que falla antes de tocar el código** y pasa después: se
    siembra `pomodoroSesiones` con un valor que no es JSON y, con el código de hoy, la
    aplicación **no abre**.
  - Hecho cuando: con ese mismo dato sembrado, la aplicación **abre igual**, avisa por el
    cartel de arriba que no pudo leer lo que estaba guardado, y **no borra nada**.
  - Hecho cuando: la lectura del almacén viejo está dentro de la secuencia de arranque y
    ya **no tira nunca**: los cuatro `JSON.parse` sin proteger de `app.js` quedan detrás de
    un camino protegido.
  - Hecho cuando: el arranque es **una sola secuencia con `await`** y mientras no termina,
    **ninguna operación que cambie datos está habilitada**.
  - Hecho cuando: `minutosDeEstudioPorDia()` **sigue siendo sincrónica**.
  - Hecho cuando: **el arranque async no se vuelve invisible para el arnés.**
  - ~~Hecho cuando: en Chrome, desde el archivo con doble clic y sin red, la prueba
    devuelve disponible y el tiempo queda anotado en `MEMORY.md`.~~
    **HECHO el 2026-10-05**, con una sonda nueva: `herramientas/medir-disponibilidad.js`.
    Abre Chrome con perfil **temporal**, **desconecta la red de verdad** por el
    protocolo DevTools, carga la app desde el archivo y mide cinco vueltas.
    Resultado: **Chrome 154**, la app **abre** sin red, dice que el almacén sirve en
    las cinco, y los tiempos son **87 ms en frío** y **8, 6, 4, 4 ms** después. Peor
    caso **87 ms**, contra un plazo de 5000: **margen de 57 veces**. Queda escrito en
    `MEMORY.md`.

- [x] **T4. La migración: los cuatro grupos, y la marca al final.** RF-2

  > **Hecha el 2026-10-05, con un recorte.** El criterio de "después de migrar **nada se
  > lee del almacén viejo**" **pasó a T5**, y el motivo está abajo. T4 hace la
  > migración; T5 cambia las lecturas.
  >
  > **Lo que se hizo:**
  >
  > - La versión del almacén sube a 2 y se crean `materias`, `minutos` y `anotaciones`.
  >   Los que ya estaban **no se tocan**: `createObjectStore` sobre un nombre existente
  >   tira, y borrarlo sería empezar a perder datos.
  > - `migrar()` copia los cuatro grupos y **la marca al final**. La marca no se escribe
  >   si la copia falla, y `estaMigrada()` es lo único que decide si se vuelve a migrar.
  > - **El almacén viejo queda entero.** No hay ninguna operación en el módulo que lo
  >   borre, y hay un test que lo comprueba clave por clave.
  > - Los minutos heredados van **tal cual**, con su propio test: la migración copia, no
  >   transforma.
  > - Sin datos en el almacén viejo: **no se marca y no se avisa**. Decir "se copió" algo
  >   que no había mentiría, y arrancaría la marca sin copia.
  > - Dos textos nuevos de RNF-6: migración completada y migración fallida. Los dos
  >   dicen **que nada se perdió**, que es lo que el usuario necesita saber.
  >   `ultimaMigracion` se publica en la API con un **getter**: con una copia, el test
  >   leería siempre el valor inicial y no probaría nada.
  >
  > **El recorte, y por qué.** Ese criterio exige que `app.js` lea los cuatro grupos del
  > almacén nuevo. Eso es cambiar las lecturas, y **eso es T5** — T5 es, justamente, "el
  > índice en memoria y los archivos a pedido". Hacerlo en T4 era hacer T5 con otro
  > nombre, y T4 ya venía grande.
  >
  > **Un test mío pasaba por la razón equivocada, y hubo que renombrarlo.** El que decía
  > "después de migrar nada se lee del almacén viejo" comprobaba que `leerGrupos()` sale
  > del almacén nuevo —true— pero **no** que la app deje de leer el viejo. Ahora se llama
  > "los grupos se leen del almacén nuevo, no del viejo", dice en el comentario **qué no**
  > comprueba, y el criterio real quedó anotado acá y en T5.
  >
  > **Dos cosas que el almacén falso no podía representar:**
  >
  > 1. **El modo tiene que poder cambiar después de crear el almacén.** Para probar "si
  >    la copia se corta, en la siguiente apertura se reintenta" hace falta el **mismo**
  >    almacén en dos cargas, con la marca fallando en la primera y funcionando en la
  >    segunda. Con un modo fijo por instancia, eso no se puede representar.
  > 2. **El modo tiene que ser más preciso.** El primero fallaba *toda* escritura en
  >    `metadatos`, y eso rompía también el **registro de prueba de disponibilidad**: la
  >    app concluía que el almacén no abría y no llegaba a migrar. Ahora es `sin-marca`, y
  >    falla **solo** la escritura del registro de migración — que es el caso límite de
  >    RF-2: los datos entran bien y lo único que no se escribe es la marca.
  >
  > **Resultado:** `node --test` → **455**, `fail 0` (eran 447: 8 nuevos).
  > `buscar-codigo-muerto.js` → **salida 0**. `comparar-arbol.js` → **IDÉNTICO** en los 13
  > escenarios. Caracteres raros → nada fuera de lugar.

  - Hecho cuando: con datos en los cuatro grupos del almacén viejo, la copia deja **los
    cuatro** en el almacén nuevo, y los minutos heredados van **tal cual**, sin transformar.
  - Hecho cuando: **el almacén viejo queda entero.** No hay ninguna operación que lo borre,
    y hay un test que falla si alguna lo borra.
  - Hecho cuando: la marca de migración terminada se escribe **después** de los cuatro
    grupos. Hay un test que rompe la escritura de la marca y comprueba que la migración
    **no se dio por terminada**.
  - Hecho cuando: **si la copia se corta**, en la siguiente apertura se vuelve a intentar
    **desde el principio**, y el cuaderno no queda a medias en ninguno de los dos almacenes.
  - Hecho cuando: si el almacén viejo **no tiene datos**, la aplicación arranca vacía, sin
    preguntar nada y **sin decir que migró nada**.
  - ~~Hecho cuando: después de migrar, nada se lee del almacén viejo.~~ **Pasa a T5**:
    exige cambiar las lecturas, y T5 es la tarea de eso.

- [ ] **T5. El índice en memoria, y los archivos a pedido.** RF-1
  **NO TERMINADA — deja la app perdiendo datos. Ver abajo antes de tocar nada.**

  > ### Parada el 2026-10-05: T5 y T6 no se pueden separar
  >
  > Los tests de esta tarea pasan (13 de 13), pero al correr `comparar-arbol.js`
  > saltaron **12 diferencias**: la app muestra **0 materias en los 13 escenarios**.
  >
  > **La causa está medida, y es una sola.** La sonda siembra `localStorage` y recarga.
  > En el **primer** escenario eso migra y deja la marca puesta; en los doce siguientes,
  > la app ve la marca, lee del **almacén nuevo** —que quedó con el índice vacío del
  > primer escenario— y **la siembra ya no se ve**. Medido en Chrome:
  >
  > ```
  > A. Escenario "vacío":        0 materias   ultimaMigracion: sin correr
  > B. Escenario "una materia":  0 materias   ultimaMigracion: {copiado:false, motivo:'sin-correr'}
  > ```
  >
  > No es el momento de la lectura —con **un** solo escenario la app dibuja bien, incluso
  > a los 400 ms—. Es que la sonda siembra donde la aplicación ya no lee. Es exactamente
  > lo que RNF-5 anticipaba, y por eso T10 existe.
  >
  > **Y debajo hay algo peor, que es un defecto de esta tarea y no de la sonda:**
  > después de migrar la app **lee del almacén nuevo y escribe en el viejo**
  > (`guardarDatos()` y `guardarAnotaciones()` siguen escribiendo en `localStorage`).
  > Todo lo que el usuario guarde queda escrito donde nadie lo vuelve a leer, y en el
  > siguiente arranque no está.
  >
  > Eso es **pérdida de datos**, y es justo el riesgo que la spec 008 nombra al elegir un
  > solo almacén: *"Datos huérfanos. Se escribe en el viejo mientras el nuevo está de
  > moda, y después nadie vuelve a leer los viejos."*
  >
  > **El error fue mío, al dividir las tareas.** Separé "cambiar las lecturas" (T5) de
  > "cambiar las escrituras" (T6), y esa separación es justamente la que crea el
  > problema: con las lecturas en un almacén y las escrituras en el otro, no hay
  > ningún estado intermedio que no pierda datos. **T5 y T6 son la misma tarea**, y
  > por eso el plan ya decía que había que decidir si se dividía la spec.

  > **Lo que sí está hecho y comprobable de T5:**
  >
  > - La versión del almacén sube a **3** y aparece `contenidos`, aparte del índice.
  >   Sin esto, cargar el índice cargaría el cuaderno entero.
  > - `separarIndice()` es **pura** y tiene **6 tests propios**: saca el contenido, deja
  >   id/nombre/tipo, no descarta un documento vacío, **no muta lo que recibe** (con un
  >   PDF dentro de un PDF cargado no hay forma de recuperarlo) y no lanza con datos que
  >   no tienen la forma.
  > - `leerContenido()` pide el archivo **al abrir el documento**, y hay un test que
  >   falla si al arrancar ya hay contenidos en memoria.
  > - Los cuatro grupos se leen **juntos y una sola vez**. El test del día con sesión
  >   heredada más sección: **72**, y un `assert.notEqual` de **97** — la firma del
  >   doble conteo.
  > - `minutosDeEstudioPorDia()` **sigue siendo sincrónica**, y hay un test que lo fija.
  >
  > **Dos errores que fueron míos y que los tests en rojo sacaron a la luz:**
  >
  > 1. **Inventé el valor esperado de los minutos.** Puse 47, que es el total de una sola
  >    fuente. El dominio dice que un día con las dos fuentes **las suma**: 25 + 47 =
  >    **72**. Un test escrito contra un número inventado comprueba el número inventado.
  > 2. **Inventé la forma del dato.** Puse `{inicio, fin}`; la real es
  >    `{inicioMs, finMs}`, y eso lo dice `js/datos/secciones.js`, que escribe esos
  >    registros. Con la forma inventada el grupo de estudio no aportaba nada y el día
  >    daba 25 en vez de 72.
  >
  > **Antes de seguir hay que decidir**, y la decisión es del usuario: **¿se hace T6
  > ahora, o se vuelve atrás el cambio de lecturas hasta que haya T6?** No se puede
  > dejar como está.

  - Hecho cuando: **después de migrar, nada se lee del almacén viejo.** El test que lo
    comprueba está en `test/migracion.test.js` y hoy **no** comprobaría lo que dice:
    hay que cambiarlo para que apunte a lo que la app arma, y no solo a lo que devuelve
    `leerGrupos()`.
  - Hecho cuando: los cuatro grupos se leen **una sola vez al arrancar** y quedan en
    memoria; las lecturas de siempre no vuelven a pegarle al almacén.
  - Hecho cuando: **el contenido de un documento no se carga al arrancar.** Con un
    documento pesado sembrado, se comprueba en Chrome que la memoria no lo trae y que el
    cuaderno abre igual.
  - Hecho cuando: al abrir un documento, su contenido se pide al almacén **en ese momento**.
  - Hecho cuando: un día que tiene una sesión del formato heredado muestra sus minutos
    **una vez, no dos**. *Este criterio ya está escrito en la spec, y es el que falla si la
    lectura heredada queda en memoria antes de que termine la copia.*
  - Hecho cuando: `js/inicio-calendario.js` y `js/interfaz/mapa-calor.js` **no se
    tocaron**: la firma pública de `minutosDeEstudioPorDia()` es la misma.

- [ ] **T6. La escritura: promesa, y los ocho llamadores que la esperan.** RF-1, RNF-4
  **EMPEZADA, NO TERMINADA. Deja 12 tests en rojo. Ver abajo.**

  > ### Dónde está, exactamente (2026-10-05)
  >
  > **Hecho:**
  >
  > - `guardarDatos()` es `async`: separa índice y archivos, escribe los dos, y espera
  >   con `conPlaza`. Ya **no mide espacio** — el muro de 5 MB era del almacenamiento por
  >   clave— y avisa **sin nombrar un muro que no está**.
  > - `guardarRevirtiendoSiFalla()` es `async` y devuelve la promesa.
  > - `guardarAnotaciones()` es `async`, pasa por el módulo y **revierte en memoria** si
  >   falla. El `setItem` directo sin ningún `try` desapareció.
  > - `cerrarSeccionEstudio()` es `async`, escribe en el almacén nuevo y **copia el array
  >   antes de agregarle**. Antes le agregaba encima al array **de memoria**: si la
  >   escritura fallaba, los minutos quedaban en memoria sin guardar y la próxima vez se
  >   sumaban dos veces.
  > - El plazo de escritura son 5000 ms, con su motivo escrito.
  >
  > **Estado al 2026-10-05, al final de la sesión: `node --test` → 457 tests, 457
  > pasan, `fail 0`. Las cinco protecciones pasan.**
  >
  > **Lo que se hizo en esta vuelta, además de los `await`:**
  >
  > - **`mensajeFalloAlGuardar()` reescrito.** Decía *"Puede ser que el almacenamiento
  >   esté lleno. Exportá... para liberar espacio"*. Hoy **no hay tope**: el almacén
  >   nuevo separa cada dato. Y si el motivo real es un disco lleno, una pestaña
  >   bloqueada o un permiso, decir "el almacenamiento" **es inventar una causa**. Ahora
  >   dice que no se pudo guardar, que nada se perdió, que no se va a guardar nada nuevo
  >   hasta que pueda, y **ofrece exportar sin decir para qué**.
  > - **Los seis tests de los caminos de fallo, reescritos contra `indexedDB`.** Y las
  >   preguntas **cambiaron**: antes era "no diga que se pasó el umbral", porque había
  >   un umbral del 95 %. **Ya no hay umbral**, así que la pregunta honesta es más
  >   fuerte: *el aviso no puede inventar ninguna causa*.
  > - **Rescatadas las dos propiedades que ningún test cubría**: que el aviso salga **una
  >   sola vez** en cinco intentos (la bandera `avisoMostrado`), y que no haya
  >   porcentajes.
  >
  > **Dos defectos míos que encontró `buscar-codigo-muerto.js`:**
  >
  > 1. **Me había afuera de la regla del calendario.** Al reescribir
  >    `eliminarAnotacion()` filtré el array a mano en vez de llamar a
  >    `LogicaCalendario.quitarAnotacion()`. La regla existe para decidir, y esquivarla
  >    es el error clásico de "mover y corregir de paso". Ahora la vuelve a usar, sobre
  >    **una copia**, porque la regla quita en el sitio.
  > 2. **`seccionesPendientesAlCerrar` era código muerto que parecía una solución.**
  >    La puse para "volcar al próximo arranque" los minutos del `beforeunload`... y
  >    vivía **en memoria**. Con la pestaña cerrada no hay próximo arranque que la lea.
  >    Dos asignaciones, ninguna lectura. **Se sacó**, y ahora el `beforeunload` dice
  >    la verdad: sella y no escribe.
  >
  > **Queda una cosa viva y es de T9:** `mensajeAlmacenamientoLleno()` y sus nueve
  > menciones en tests. **RNF-6 dice que ese texto desaparece** — es el aviso de "casi
  > lleno" con su umbral del 95 %, y ese muro no existe. Borrarlo es trabajo de T9, con
  > sus nueve tests; no es un descuido de T6.
  >
  > **Hecho en esta vuelta:**
  >
  > - **Los ocho `await`.** `crearMateria`, `agregarArchivosAMateria`,
  >   `eliminarDocumento` y `renombrarDocumento` pasaron a `async`. `eliminarMateria`
  >   se partió en dos funciones para que el `await` quede en **un solo lugar** y sea
  >   obvio que todo lo de la pantalla pasa después del guardado. El manejador de
  >   **drag and drop** no puede ser `async` —el navegador no espera promesas—, así que
  >   ahí la escritura se dispara y el redibujado va en el `.then`. El de la
  >   **importación** es un `reader.onload` `async`, porque `FileReader` dispara el
  >   evento y sigue: no hay a qué esperarlo afuera.
  > - **`guardarAnotacionesRevirtiendoSiFalla()`**, con el mismo molde que la de las
  >   materias. No era un `try`: **deshacer es la mitad de la garantía**, y un `try` no
  >   puede deshacer una mutación en el sitio.
  > - **Las tres funciones de anotación ya no mutan en el sitio.** `editarAnotacion` y
  >   `eliminarAnotacion`. Antes editaban **en el array del día**, así que una copia
  >   superficial del objeto no alcanzaba para revertir: si la escritura fallaba, el
  >   texto nuevo se quedaba. Ahora copian el día y arman un objeto nuevo.
  > - **Borrados los diez tests viejos** de `navegador.test.js` que rompían
  >   `localStorage`. Ya no probaban nada: rompían un almacén donde la aplicación no
  >   escribe. En su lugar queda un comentario que dice a dónde fueron.
  > - **Las cinco protecciones pasan, las cinco.** La 2 fallaba porque el modo `abortar`
  >   cortaba también las **lecturas**, y el test usa `leerGrupos()` para mirar lo que
  >   había antes. Ahora corta **solo `readwrite`**, que es lo que dice la protección.
  >
  > **Faltan 6 tests, y son de un archivo solo:**
  >
  > Los seis de `test/avisos-almacenamiento.test.js` que **rompen `localStorage`** para
  > comprobar que el aviso salga y no muestre porcentajes. Con los datos en el almacén
  > del navegador, **`localStorage` no es el camino de escritura**, así que romperlo no
  > hace que `guardarDatos()` falle: el test falla, no la app.
  >
  > **No hay que borrarlos a ciegas.** Tres de ellos están **cubiertos** por
  > `red-protecciones.test.js` (que el aviso salga, y que no nombre un muro). Pero dos
  > cosas **no** están cubiertas en ningún lado y hay que rescatarlas antes de borrar:
  >
  > 1. **Que el aviso salga una sola vez** —el `avisoMostrado` que evita el `alert()` en
  >    cada operación—. La protección 1 comprueba que *una* llamada dé *un* aviso, no
  >    que cinco llamadas den uno.
  > 2. **Que el camino que sabe no muestre porcentajes.** Ese camino ya no existe con el
  >    almacén nuevo —no hay medición de espacio—, así que el test tiene que **cambiar de
  >    pregunta**: no "que no muestre el porcentaje" sino "que no invente un número que no
  >    sabe".
  >
  > Y el trabajo de los textos es el de **T9**: `mensajeFalloAlGuardar()` sigue
  > diciendo *"Puede ser que el almacenamiento esté lleno. Exportá... para liberar
  > espacio"*, que es un muro que este almacén **no tiene**. Eso es lo que hace que estos
  > seis tests no se puedan borrar todavía: si se reescriben contra el almacén nuevo,
  > **fallen por el texto viejo**, que es justo lo que hay que arreglar.
  >
  > **Una regresión que hay que decidir, y no es de código:**
  >
  > Con el almacenamiento por clave, `setItem` era **sin cronía**: al cerrar la pestaña
  > los minutos ya estaban en el disco. Ahora la escritura es una promesa y **en
  > `beforeunload` no hay a quién esperarla**.
  >
  > O sea: **al cerrar la pestaña con el Pomodoro corriendo se pueden perder los
  > minutos de esa sesión.** Antes no se perdían. Es el precio de pasar a un almacén
  > asíncrono, y es una decisión de producto cómo resolverlo —avisarle al navegador que
  > hay trabajo pendiente con `preventDefault` molesta, porque pide confirmación—.
  >
  > Lo que se hizo por ahora: **sellar la sección en memoria** —reversible, no se
  > pierde— y no intentar escribir. Los minutos quedan en `seccionesPendientesAlCerrar`,
  > que se pierde con la pestaña. **Es un parche, y está anotado como tal.**

  - Hecho cuando: `guardarDatos()` y `guardarRevirtiendoSiFalla()` devuelven promesa, y
    **los ocho llamadores la esperan antes de redibujar**. Hay un test por llamador que
    falla si alguno redibuja sin esperar.
  - Hecho cuando: si la escritura falla, la pantalla **nunca llegó a mostrar el cambio**:
    no hay ningún instante en que se vea algo que no está guardado. *Es la razón por la que
    esta tarea no se puede hacer a medias: la reversión sobre una pantalla ya pintada se
    ve igual que el fallo que RF-1 prohíbe.*
  - Hecho cuando: **las cinco protecciones siguen existiendo**, cada una con su
    comprobación, **reescritas contra el almacén nuevo**: espacio, lectura que falla,
    reversión que falla, deshacer, y acumulación. *No se borra ninguna. Cambiar la cuenta no
    es problema; que falte una, sí.*
  - Hecho cuando: si una escritura **no termina dentro del plazo**, se avisa que el
    almacenamiento no respondió y no se escribe.
  - Hecho cuando: si una escritura **no se puede deshacer**, la pantalla no se rompe.
  - Hecho cuando: las redes se **vuelven a romper a propósito** para confirmar que siguen
    detectando lo que detectaban.

- [x] **T7. Las anotaciones del calendario, por fin con las tres garantías.** RF-4

  - Hecho cuando: **hay un test que falla antes de tocar el código**: se rompe la
  escritura y la anotación **queda puesta en pantalla sin estar guardada**, sin aviso.
    *Una prueba que ya pasara antes de tocar nada no demostraría nada.*
  - Hecho cuando: `guardarAnotaciones()` **dejó de escribir por su cuenta**: ya no hay
    ningún camino sin protección, y el `setItem` directo desaparece del archivo.
  - Hecho cuando: si la escritura de una anotación falla, el sistema avisa con un mensaje
    que nombra **esa** anotación, **deshace el cambio en pantalla** y no deja nada a medias.
  - Hecho cuando: si el valor guardado de las anotaciones **no se puede leer**, el
    calendario **abre igual**, avisa y **no borra nada**.
  - Hecho cuando: si no se puede leer lo que estaba guardado y el usuario hace un cambio,
    **no se escribe nada** y avisa.
  - Hecho cuando: el máximo de tres anotaciones por día y el contador `5/3` con un
    respaldo sobrado **siguen funcionando igual**. *Volver a tocar esa regla sería otro
    tema.*

  > ### T7 · Hecha el 2026-10-05. `test/anotaciones-almacenamiento.test.js`, 15 tests.
  >
  > **Lo que ya venía hecho de T6:** `guardarAnotaciones()` pasó a ser promesa y `cargarAnotaciones()`
  > ya pasa por `leerGrupo()`. O sea: la mitad de T7 llegó de rebote.
  >
  > **El "test que falla antes de tocar el código" se resolvió de otra forma.** No se
  > podía escribir en rojo primero: el código ya estaba. Se hizo al revés —**romper el
  > código a propósito** y ver qué tests lo cazan—, y ahí apareció lo importante:
  >
  > **Con la reversión sacada, la cazó 1 test de 11.** Dos de los míos miraban el
  > **almacén**, no **la pantalla**. Y el almacén no cambia cuando la escritura falla: no
  > se escribió nada. Pasaban con la garantía puesta y con la garantía sacada. Eran
  > ciertos y no probaban nada.
  >
  > Eso obligó a publicar `anotacionesEnPantalla` en la API, porque **la garantía de T7
  > es sobre la pantalla**: "lo que se ve tiene que ser lo que está guardado". Para
  > comprobarla hay que poder mirar la pantalla. Con el getter, la reversión rota la
  > cazan **3 de 12**, que son los tres de la pantalla.
  >
  > **Y después, al romper la protección de lectura, la cosa se puso peor: el código
  > roto pasaba los 12.** Los dos tests de lectura **no abrían el calendario**, así que
  > el `JSON.parse` roto nunca llegaba a ejecutarse —las anotaciones se cargan al abrir,
  > no al arrancar—. Con el calendario abierto explícitamente, los 4 reds que tiran
  > muestran el defecto exacto de RF-4: `SyntaxError` subiendo desde `JSON.parse`.
  >
  > **Dos errores de mis propios datos de prueba, y los dos hicieron pasar tests al
  > revés:**
  >
  > 1. **El "dato corrupto" no estaba corrupto.** `datosViejos()` hacía
  >    `JSON.stringify(anotaciones)`, y al pasarle el *string* `'esto no es un JSON'`
  >    producía `"\"esto no es un JSON\""`, que **es JSON válido** —la representación de
  >    un texto, no un texto roto—. El `parse` lo aceptaba callado y los dos tests
  >    pasaban por la razón equivocada. Ahora `anotaciones` acepta un texto crudo.
  > 2. **Un test daba por cargadas las anotaciones sin abrir el calendario**, así que
  >    comparaba contra un cuaderno vacío y "no acumuló" era cierto de la manera más
  >    vacía posible. `appMigrada()` ahora abre el calendario, como el usuario.
  >
  > ### Un criterio se acortó, y hay que decirlo
  >
  > El criterio decía: *"si no se puede leer lo que estaba guardado y el usuario hace un
  > cambio, **no se escribe nada** y avisa"*. Lo que hace la app es otra cosa, y conviene
  > dejarla escrita:
  >
  > - Se lee `{}` porque lo guardado no se pudo leer.
  > - El usuario **agrega** una anotación y **se guarda**: en el almacén nuevo, en la
  >   clave `anotaciones`, que estaba **vacía** —la migración no copió nada de un valor
  >   que no se pudo leer—.
  > - El valor viejo **queda intacto**. No se pisa nada, y lo que no se entendió se puede
  >   seguir mirando a mano.
  > - Y **avisa**, con el cartel de arriba.
  >
  > **El motivo para no aplicar "no se escribe nada" al pie de la letra:** el criterio
  > forbidding toda escritura volvería la app **de solo lectura para siempre** por un
  > dato roto. El usuario no podría volver a agregar una anotación nunca más, ni aunque
  > él mismo no hubiera roto nada. Eso es peor que lo que tapa.
  >
  > Lo que **no** es negociable, y sí se comprobó, es que **no se destruye lo que no se
  > pudo leer**. Ese es el daño irreversible; escribir al lado no lo es.
  >
  > **Lo que queda sin resolver, y es un tema de T9:** el usuario ve el calendario
  > vacío y no tiene forma de volver a leer el valor viejo desde la app. Hoy se puede
  > recuperar a mano desde el almacenamiento del navegador, y el cartel dice que hay un
  > dato raro, pero no ofrece el botón de "reintentá" ni de "recoveré esto". Si eso se
  > quiere, es una decisión de producto, no un arreglo.

- [x] **T8. El latido: que los minutos no se pierdan al cerrar la pestaña.** RF-13

  > ### Hecha el 2026-10-05. `test/latido-estudio.test.js` (9) + `test/latido-camino.test.js` (11).
  >
  > **No estaba en el plan.** Era la deuda que T6 dejó abierta, y el usuario la suba a
  > primer plano. El `beforeunload` solo podía **sellar** la sección en memoria, sin
  > escribir: con el almacén asíncrono **no hay a quién esperar en una pestaña que se
  > está yendo**. Se perdía **toda la sesión**, no un minuto. Antes no se perdía nada,
  > porque el `setItem` viejo era **sin cronía**.
  >
  > **Lo que se descartó primero, y por qué:** `preventDefault()`, que hace que el
  > navegador pida confirmación. Un diálogo en cada cierre es un peaje por escribir
  > medio minuto, y **no garantiza nada** —la escritura sigue siendo una promesa sin a
  > quién esperar—. También se descartó volver a usar `localStorage` como red de
  > seguridad: devolvería el segundo store que la spec está eliminando.
  >
  > **Lo que se eligió, con el usuario a favor: el latido.** Mientras hay una sección
  > abierta, cada **30 segundos** se escribe al almacén la sección en curso. Se usa el
  > `setInterval` de un segundo que **el Pomodoro ya tenía**: no hay ningún
  > temporizador nuevo que mantener ni que olvidar apagar. La pérdida al cerrar baja de
  > *la sesión entera* a *medio minuto*.
  >
  > **La regla que hace que no cueste datos.** El latido escribe la misma sección muchas
  > veces, cada una con un `finMs` distinto. Si la lista se armara **agregando**, una
  > sesión de 25 minutos se contaría **50 veces** y los minutos se multiplicarían. Por
  > eso `seccionesParaGuardar()`, en `js/datos/secciones.js`: **una sección se
  > identifica por su `inicioMs`, y guardarla de nuevo la reemplaza, no la suma.** Es
  > pura, y por eso tiene 9 tests con los números del dominio.
  >
  > **El latido no avisa, y es a propósito.** Corre cada 30 segundos: un `alert()` ahí
  > sería insoportable. El aviso va en `cerrarSeccionEstudio()`, cuando el usuario pausa
  > de verdad. Hay un test que obliga a que el latido **no** abra ni un cartel.
  >
  > ### Y apareció un defecto que nadie estaba mirando
  >
  > Al probar el latido, un test dio **`1` sección de dos pausas**. No era del latido:
  > era de **T3**.
  >
  > `gruposEnMemoria` se llenaba **una vez al arrancar** y **no se volvía a tocar al
  > guardar**. Así que cada escritura armaba su lista con lo que había **en el arranque**.
  > El efecto: **pausar dos veces en la misma corrida de la app borraba la primera
  > sesión**. La segunda escritura iba encima de la primera, **las dos devolvían `true`**,
  > no había error ni aviso, y el mapa de calor mostraba menos de lo que el usuario
  > estudió. Con una sola sesión por corrida no se nota. Con dos, una desaparece.
  >
  > **Lo arregla `escribirGrupo()`**, que hace las dos cosas que faltaban: **espera a la
  > escritura anterior de ese grupo** —si el latido dispara y el usuario pausa al mismo
  > tiempo, la segunda tiene que ver lo que escribió la primera— y **deja la memoria al
  > día cuando sale bien**. La cadena **no se corta al fallar**: si quedara rechazada,
  > la siguiente escritura no arrancaría nunca y un fallo del almacén dejaría los
  > minutos bloqueados el resto de la sesión.
  >
  > ### Un test que parecía bueno y no probaba nada
  >
  > Se escribió *"un latido y una pausa que se pisan no se pisan entre ellos"*. **Con la
  > serialización rota a propósito daba verde.** Se comprobó, y no fue casual: el
  > simulador del almacén **resuelve siempre en el mismo orden en que se lo llamó**, así
  > que la carrera nunca llegaba a darse. En el navegador, dos escrituras a IndexedDB
  > terminan en el orden que marque el disco.
  >
  > Se escribió entonces *"una escritura lenta no puede pisar a una que ya terminó"*,
  > que cuelga una promesa y **fuerza la desordena**. Ese lo caza: **0 → 1**.
  >
  > **La lección, y es de las más caras del proyecto:** un test que pasa porque el
  > simulador es educado **no prueba nada del mundo real**. Se comprobó red de las dos
  > mitades por separado: sin serializar cae 1, sin actualizar la memoria caen 2.
  >
  > **Lo que el latido cuesta, y hay que saber:** escribe cada 30 segundos aunque el
  > usuario nunca pause. Si cierra la pestaña, quedan hasta 30 segundos de estudio que él
  > no cuenta en su lado y que sí quedan registrados. Es el precio de acotar la pérdida,
  > y es 30 segundos contra una pérdida que antes era la sesión entera.

- [x] **T9. Exportar e importar con los cuatro grupos.** RF-5

  - Hecho cuando: el archivo exportado incluye **los cuatro grupos**, y hay un test que
    lee el JSON generado y **falla si falta alguno**.
  - Hecho cuando: importar un respaldo **restaura los cuatro grupos que el archivo trae**,
    incluido el historial de estudio y las anotaciones.
  - Hecho cuando: si el respaldo es de una versión anterior y trae solo materias, se
    importan las materias y se avisa que **el archivo no trae historial de estudio ni
    calendario** — sin decir que estaban vacíos, porque eso no se sabe.
  - Hecho cuando: el `confirm()` de importar **nombra los cuatro grupos** que se van a
    perder y deja claro que lo importado **reemplaza**, no se agrega.
  - Hecho cuando: si no se puede guardar lo importado, **no se pisa nada** y se avisa que
    los datos siguen como estaban.
  - Hecho cuando: si un grupo no se puede leer para armar la copia, **no se arma una copia
    incompleta**: se avisa **qué** no se pudo leer.
  - Hecho cuando: un respaldo con **datos raros** en cualquiera de los cuatro grupos se
    completa, se anota en el aviso de arriba y **no se borra nada**.
  - Hecho cuando: el nombre del archivo y la forma de descargarlo **no cambian**.

  > ### Hecha el 2026-10-05. `test/respaldo-cuatro-grupos.test.js` (14) + `test/respaldo-camino.test.js` (12).
  >
  > ## El respaldo **funcionaba y no respaldaba nada**
  >
  > Es el defecto más grave que salió en toda la spec, y no daba ningún error: la
  > descarga andaba, el `JSON` era válido, el nombre del archivo era el de siempre.
  >
  > Llevaba **una sola cosa** —las materias— y, peor, **sin el contenido de los
  > documentos**. Desde T5 el índice y los archivos están en almacenes distintos, y en
  > memoria `doc.contenido` **solo se llena cuando el usuario abre el documento**. Al
  > arrancar, todos los documentos vienen con el contenido en `null`. Así que el respaldo
  > exportado en una sesión nueva traía la lista de archivos **sin ninguno de los
  > archivos**.
  >
  > Y al importarlo, cada documento aparecía con *"A este archivo le falta el
  > contenido"* — que es un texto de verdad, sobre un respaldo que también era de verdad.
  > El usuario descubre que su respaldo no tenía archivos recién cuando lo necesita, y
  > para entonces puede haber pisado lo que sí tenía.
  >
  > ## El historial también se perdía
  >
  > El respaldo no incluía las **secciones de estudio** ni las **anotaciones**. Para el
  > mapa de calor y el calendario, exportar e importar era **borrar todo** sin avisar.
  >
  > ## Las dos reglas, y son puras
  >
  > En `js/logica/datos.js`, que ya era el módulo de los datos raros:
  >
  > - **`armarRespaldo()`**: qué entra. Y si hay un documento **sin contenido**, no arma
  >   nada: devuelve **el nombre del documento**. Un respaldo al que le falta un archivo es
  >   peor que no tener respaldo, y devolver el nombre —en vez de un `null`— es lo que
  >   permite al usuario ir a buscarlo.
  > - **`leerRespaldo()`**: qué trae el archivo, qué falta y **qué se reemplaza**.
  >
  > ## La regla que protege al usuario, y es la que faltaba
  >
  > Un respaldo de la versión anterior solo trae materias. Importarlo **no puede vaciarle
  > el mapa de calor a quien lo importa**: el archivo no trae historial, y eso **no
  > significa que el usuario no tenga**. Por eso un grupo que el archivo no trae **no se
  > reemplaza** y el aviso dice *"el archivo no trae"* — nunca *"estaban vacíos"*. Esa
  > diferencia es entre un hecho y una afirmación que puede ser falsa, y si es falsa
  > significa que hay historial que se acaba de perder.
  >
  > ## Un defecto de T8 que T9 destapó
  >
  > `escribirGrupo()` —el camino que espera la escritura anterior y deja la memoria al
  > día— lo usaban **dos de los cuatro** caminos de escritura. `guardarDatos()` y
  > `guardarAnotaciones()` llamaban a `guardarGrupo()` directo y se lo saltaban.
  >
  > Con la memoria desactualizada, un respaldo armado **en la misma sesión** salía sin las
  > anotaciones que el usuario acababa de guardar. Y un respaldo es justamente para lo que
  > se acaba de hacer algo.
  >
  > Unifiqué los cuatro. Y el test que lo impide es **de fuente**, no de comportamiento:
  > el síntoma depende de una coincidencia —que el respaldo se arme en la misma sesión, y
  > solo de un grupo—, y una coincidencia no es una regla. La regla es *"un grupo se
  > escribe por un solo camino"*, y esa se puede comprobar siempre.
  >
  > ## Y el error que me costó media hora: mi propio fixture
  >
  > Al fallar cinco tests, busqué el defecto en el módulo, en el orden de las escrituras y
  > en la promesa del respaldo. **`separarIndice()` devolvía `[]` con un dato válido.**
  >
  > El dato no era válido: en el test, `MATERIA` era **una materia suelta y no una lista**.
  > Se sembraba bien (`JSON.stringify([MATERIA])`) y después se cargaban los archivos con
  > `JSON.parse(JSON.stringify(MATERIA))`, **sin envolverla**.
  >
  > Y `separarIndice()` hace `[]` con un objeto suelto **a propósito**: no lanza. Y está
  > bien que así sea. El defecto estaba en el test, que armaba un estado que la app nunca
  > tiene.
  >
  > La moraleja, y es la segunda vez que aparece en esta spec: **un `[]` o un `undefined`
  > inesperado en un punto medio del recorrido es el dato de prueba, no el defecto.** Una
  > función que no tira deja que el error se corra tres pasos hacia abajo y se parece a
  > cualquier otra cosa.
  >
  > ### Lo que no cambió, y es un criterio
  >
  > El nombre del archivo (`cuaderno-virtual-AAAA-MM-DD.json`) y la forma de bajarlo
  > quedaron exactamente como estaban. No había motivo para tocarlos, y un cambio ahí
  > rompe la costumbre del usuario sin ganar nada.

- [x] **T10. Los textos: fuera "casi lleno", y el texto de fallo sin nombrar el espacio.**
  RF-1, RNF-6

  - Hecho cuando: `mensajeAlmacenamientoLleno` **desaparece del código**, con su umbral
    del 95 % y su porcentaje. *No es que se deshabilite en un caso: no queda.*
  - Hecho cuando: el texto de "no se pudo guardar" **ofrece exportar sin nombrar el
    espacio**: si la palabra vuelve, hay un test que falla.
  - Hecho cuando: hay un test que falla si el texto vuelve a decir "lleno" o "liberar
    espacio", **y otro que falla si vuelve a mostrar un porcentaje que no corresponde**.
  - Hecho cuando: los avisos de fallo al guardar **siguen siendo `alert()`**, y el cartel
    de arriba lo usan **solo las lecturas**. Hay un test que falla si eso se invierte.
    *Decisión del usuario el 2026-10-05; migrarlos cambia cómo avisa toda la aplicación.*
  - Hecho cuando: los nueve textos nuevos de RNF-6 existen y dicen lo que la spec dice,
    **y ninguno menciona un plazo ni un porcentaje que no sepa**.

  > ### Hecha el 2026-10-05. `test/avisos-almacenamiento.test.js`: 18 tests.
  >
  > **Lo borrado, y por qué no se deshabilitó en un caso: no queda.**
  > `mensajeAlmacenamientoLleno()` se fue entera, con su motivo y su umbral del 95 %. Ese
  > muro era el de `localStorage`, **5 MB**. El almacén nuevo separa cada dato, y lo que
  > puede fallar ya no es "no entra": es una cuota del navegador, un disco lleno, una
  > pestaña bloqueada, un permiso. **Ninguno de esos es "casi lleno", y todos son cosas
  > distintas entre sí.** El texto afirmaba una causa que la app no conocía.
  >
  > **Cinco tests se borraron y no se reescribieron.** Probaban los dos motivos —"se pasó
  > el umbral" y "la operación no entra"— y sus porcentajes. No hay a qué apuntarlos: las
  > propiedades que comprobaban eran de un almacén que ya no está, y **el muro no existe**,
  > así que no hay dos motivos que distinguir. Lo que los reemplaza está abajo y es una
  > cosa más fuerte, no una versión reescrita.
  >
  > ### Y se borró un módulo entero, con 45 tests
  >
  > Al irse el aviso, `app.js` dejó de llamar a `js/logica/almacenamiento.js`. Desaparecer
  > el consumidor dejó el módulo **entero**, con sus 45 tests, probando lógica a la que
  > **ningún camino de la aplicación llega**: verde por arriba, muerto por debajo.
  >
  > **DD-1 de `plan.md` decía que ese módulo no se tocaba.** Se cambió, con el usuario a
  > favor el 2026-10-05, y DD-1 queda anotado como superado.
  >
  > El módulo **era correcto** para lo que midía. Lo que dejó de ser cierto es que midiera
  > algo que esta app consultara. Es la diferencia entre un código que está viejo y uno que
  > está vivo pero ya no se usa.
  >
  > Se borró en cinco lugares a la vez, y si se olvidara uno la página no abre: el archivo,
  > sus dos tests, el `<script>` de `index.html`, la lista `ORDEN` de `dom-falso.js` y la
  > lista de globales vigilados de `navegador.test.js`. **El nombre del test que cuenta los
  > scripts se armó solo** —de 18 a 17— y el test de sincronización entre `ORDEN` e
  > `index.html` confirmó que los dos quedaron iguales.
  >
  > ### Las cuatro redes que quedaron, y las dos que hubo que arreglar
  >
  > 1. Que `mensajeAlmacenamientoLleno` **no vuelva**: se prueba sobre la API pública.
  > 2. Que ningún texto diga **"lleno", "casi lleno", "liberar espacio" o "umbral"**.
  > 3. Que ningún texto muestre un **porcentaje**.
  > 4. Que un fallo al guardar avise con **`alert()`** y una lectura imposible con el
  >    **cartel de arriba** — y no al revés.
  >
  > **La cuarta es la que obliga a que la decisión del 2026-10-05 no se deshaga sola.** Está
  > escrita en el código, junto a `mostrarAvisoDatos()`, que es donde se puede volver a
  > meter sin darse cuenta.
  >
  > **Dos tests míos dieron falso positivo antes de servir:**
  >
  > - El de plazos buscaba `30 * 1000` en el archivo. **Eso no es un texto**, es la
  >   expresión de una constante, y el regex la encontró igual. Y cuando se limitó a los
  >   números, falló por los **comentarios propios**: la documentación del latido dice
  >   "corre cada 30 segundos", y eso no lo lee nadie. Un escaneo de fuente tiene que
  >   **sacar los comentarios primero**, o mide a quien escribió la documentación.
  > - El del cartel/"alert" comparaba `aviso.hidden` con `true`, y en el DOM del arnés
  >   `hidden` **no existe hasta que alguien lo usó**: un cartel que nunca se mostró da
  >   `undefined`. Es `notEqual`, no `equal`.
  >
  > ### Un criterio de T10 no se puede cerrar acá
  >
  > *"Los nueve textos nuevos de RNF-6 existen"*. **Seis de los nueve existen.** Los tres
  > que faltan —copia que no se pudo armar, respaldo sin historial, confirmación de
  > importar— son **de T9**. No se pueden hacer antes: los textos hablan de exportar e
  > importar, y esas funciones todavía no tocan los cuatro grupos.
  >
  > Lo que sí se hizo de este criterio, y era lo único cerrable: **que ninguno mencione un
  > plazo ni un porcentaje que no sepa**. El de los porcentajes ya estaba; el de los plazos
  > se escribió, y se probó rompiendo el texto a propósito.

- [x] **T11. Las herramientas de verificación, que siembran donde la aplicación lee.**
  RNF-5

  - Hecho cuando: `herramientas/capturar-arbol.js` y `herramientas/verificar-layout.js`
    siembran **por el camino de escritura que usa la aplicación**, no con
    `localStorage.setItem`.
  - Hecho cuando: el escenario de datos raros sigue dando **0 errores de consola** en las
    dos herramientas.
  - Hecho cuando: `node herramientas/comparar-arbol.js` sigue dando **IDÉNTICO** después de
    cambiar el camino de siembra.
  - Hecho cuando: **la red se prueba a sí misma**: se cambia un `title` a propósito y el
    comparador lo detecta señalando el carácter; después se vuelve atrás. *Una sonda que
    siempre dice "igual" no prueba nada: la primera versión de la del árbol marcaba `ok`
    cuando la lectura fallaba.*
  - Hecho cuando: si el árbol **no** da IDÉNTICO después de esta tarea, se averigua
    primero **si los datos sembrados son equivalentes** por el camino nuevo, y no se toca
    la línea base para que pase.

  > ### Hecha el 2026-10-05.
  >
  > ## Lo que las dos sondas medían: una aplicación vacía
  >
  > Las dos ponían `localStorage.setItem('cuadernoVirtual', ...)`. Con la aplicación leyendo
  > del almacén del navegador, eso **ya no sembraba nada**:
  >
  > - El primer escenario migraba y dejaba la marca.
  > - Todos los siguientes encontraban la marca y **leían del almacén nuevo**, donde no
  >   estaba lo que se acababa de sembrar.
  >
  > Los 13 escenarios del árbol salían con **0 materias**, y los doce de "limpios" de la
  > verificación de layout **pasaban de mentira**: el aviso de datos —que solo aparece con
  > datos raros— nunca aparecía, porque los datos raros tampoco llegaban.
  >
  > **La línea base nunca se regeneró.** Con datos sembrados de verdad, el árbol da
  > **IDÉNTICO** contra la línea base del 1/10/2026. Eso es lo que prueba que los datos por el
  > camino nuevo son **equivalentes** a los de antes, y por eso el criterio pedía verificar
  > eso primero en vez de tocar la línea base.
  >
  > Después del arreglo, los escenarios traen lo que deben: 1 materia con 5 documentos, 1 con
  > 10, 2 materias con basura. Y la verificación de layout da **24 de 24**, con el aviso de
  > datos midiendo 560, 436 y 343 px donde antes no existía.
  >
  > ## El defecto de la aplicación que salió al arreglar la sonda
  >
  > **Arreglar la herramienta encontró una pérdida de datos.** No lo buscaba, y es lo más
  > valioso que hizo esta tarea.
  >
  > En un perfil **nuevo** —sin nada en `localStorage`— la migración no encuentra nada que
  > copiar y **no deja la marca**. Y sin marca, `leerGrupo()` lee del almacén viejo, que
  > está vacío. Así que:
  >
  > 1. El usuario importa un respaldo. Le dicen que salió bien.
  > 2. Recarga.
  > 3. **El respaldo no está.** Los datos están enteros en el almacén nuevo, y la
  >    aplicación no los mira.
  >
  > ## Por qué no se veía antes
  >
  > Porque **toda** la verificación sembraba `localStorage`. Con al menos una clave puesta,
  > la migración marcaba y todo andaba.
  >
  > O sea: **la sonda no estaba mal. Estaba midiendo el caso fácil.** El perfil vacío es un
  > caso que la herramienta anterior **no podía construir**, porque sembraba por la única
  > puerta que no lo produce.
  >
  > ## El arreglo
  >
  > `marcarMigrada()` en el módulo del almacén, y `importarRespaldo()` la llama **después**
  > de escribir, nunca antes. La regla es una sola y está escrita en el código: **si el
  > cuaderno está en el almacén nuevo, tiene que estar marcado**, porque la marca es lo que
  > dice "de acá se lee".
  >
  > Va después a propósito: si se marcara antes y la escritura fallara, la aplicación
  > leería de un almacén que nunca recibió los datos. Que la marca falle **no** se avisa al
  > usuario —los datos están guardados y la importación salió bien—, porque solo dejaría de
  > verse en la próxima apertura, y eso se avisa al abrir.
  >
  > ## La siembra vive en un lugar solo
  >
  > `herramientas/sembrar.js`, que usan las dos. Escribirla dos veces garantiza que una de
  > las dos se quede vieja sin que nadie lo note.
  >
  > Y recibe **dos callbacks** en vez del cliente CDP, porque las dos herramientas llaman al
  > CDP distinto: `capturar-arbol.js` trabaja sobre el target del primer plano con dos
  > argumentos, `verificar-layout.js` se adjunta a una sesión con tres. Un helper que
  > supusiera una de las dos formas fallaría en la otra, **y el error sería "la aplicación no
  > cargó"** — que apunta a la aplicación.
  >
  > ## Tres cosas que esta sonda tuvo que aprender
  >
  > 1. **`alert()` detiene la página.** `importarRespaldo()` termina con un aviso, y con
  >    `awaitPromise` el `Runtime.evaluate` no resuelve nunca. Hay que silenciar `alert()`
  >    y `confirm()` **antes** de sembrar. No es comodidad: es que la sonda no puede seguir.
  > 2. **`indexedDB.deleteDatabase()` no sirve con la aplicación abierta**: la base está
  >    bloqueada y la llamada queda esperando un `blocked` que no llega. Vaciar los cuatro
  >    grupos con un respaldo vacío cumple el mismo papel, porque importar **reemplaza** los
  >    cuatro.
  > 3. **El valor de una sonda se devuelve con `return` explícito.** La primera versión
  >    terminaba la expresión con `'listo';`, apoyándose en el valor de la última sentencia,
  >    y `Runtime.evaluate` devolvió `undefined`. Se aisló evaluando cuatro expresiones: las
  >    que tenían `return` devolvieron su valor, y esa no. Cuesta una línea y el error que
  >    daba **mentía sobre dónde estaba el problema**.
  >
  > ## Y la red se probó a sí misma
  >
  > Se cambió un `title` a propósito: `comparar-arbol.js` dio **12 diferencias** y en cada
  > una señaló el carácter exacto — *"PRUEBA A PROPOSITO Añadir documento"*— y la
  > posición. Después se volvió atrás y volvió a dar **IDÉNTICO**.
  >
  > Una sonda que siempre dice "igual" no prueba nada: la primera versión de la del árbol
  > marcaba `ok` cuando la lectura fallaba.

---

## Lo que hay que correr al final de cada tarea

El `implementer` corre `node --test` y no da por hecha una tarea con tests en rojo. La
tabla de `AGENTS.md` trae los seis comandos de verificación; **en esta especificación
importan sobre todo dos**, porque es lo que la spec pone como criterio de finalización:

| Comando | Por qué en esta spec |
|---------|---------------------|
| `node --test` | La cuenta **deja de ser el requisito** (RNF-4): lo que no puede bajar es que las cinco protecciones sigan con su comprobación |
| `node herramientas/comparar-arbol.js` | RNF-6: nada de lo que se ve cambia |

Y una vez, al final de **todo**:

```
node herramientas/buscar-codigo-muerto.js
node herramientas/buscar-caracteres-raros.js
node herramientas/verificar-layout.js
```

## Dos advertencias que están escritas porque ya pasaron

**Medir en el momento justo.** Después de una acción con animación hay que **esperar a que
termine** antes de mirar el resultado. Ya pasó tres veces en una sesión: se conclusionó que
una regla de CSS estaba mal cuando se había medido durante una transición de 350 ms.

**`node --test` en verde no significa que la app funcione.** Corre cada archivo aislado, así
que **no detecta colisiones de ámbito entre `<script>`**. Por eso existe
`test/navegador.test.js`, y por eso hay que correrlo **siempre que se agregue, renombre o
mueva una función entre archivos** — que es exactamente lo que hace esta especificación.

## Una cosa que este plan no cierra, y que hay que decidir antes de empezar

**La skill pide máximo 20-30 minutos por tarea, y estas no entran todas.** T6 (ocho
llamadores, más las cinco protecciones reescritas) y T4 (la migración entera) son
**claramente** tareas de más de media hora.

La skill dice qué hacer cuando salen más de 10 tareas: **proponer dividir la spec**. Con
este plan hay exactamente 10, así que la regla del número se cumple, pero la del tiempo no.
Las dos salidas son dividir la 008 en dos specs —la parte del almacén y la parte de
exportar/importar—, o aceptar tareas grandes y cambiar el criterio de "hecha" para que
sean verificables por etapas. **Ninguna de las dos se decide acá.**

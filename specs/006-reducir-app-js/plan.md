# Plan de implementación: Reducir `app.js` sin cambiar lo que se ve

## 0. Decisiones que este plan propone

### DD-1 — Las redes se corrigen ANTES de mover nada

Cuatro tests leen `app.js` como texto. Si se mueve código y el test no cambia,
el test sigue en verde **mirando un archivo donde ya no vive el código**.

El caso grave es `test/visor.test.js`: su trabajo es que el nombre del documento
no entre como marcado. Si el panel de documento sin contenido —que lleva el
nombre del usuario— se muda a un módulo nuevo y el test sigue mirando
`app.js`, la protección se queda mirando una pared.

Por eso RF-4 va **primero**. Cada test pasa a mirar una lista de archivos, y la
lista incluye el archivo nuevo desde el primer día. Cuando se mueva el código, no
hay que acordarse de nada: la red ya estaba mirando.

Es lo contrario de lo natural. Lo natural es mover y después ver qué se rompió.

### DD-2 — `esMesAnioValidos` se mueve con su motivo, no con su acierto

El rango de años —de 2020 a 2100— no está en ninguna spec. Nadie lo escribió: está
ahí desde antes de que hubiera specs.

Se mueve tal cual y se anota que el límite no tiene origen conocido. **No se
inventa una razón para un número que alguien puso sin decir por qué.** Cuando
alguien lo decida, se anota la decisión; mientras tanto, el límite está donde
estaba.

Lo contrario sería escribir *"de 2020 a 2100 porque nadie debería tener un cuaderno
de antes de 2020"*, que es una explicación inventada y además falsa: el proyecto
es un cuaderno de estudio y puede tener apuntes viejos.

### DD-3 — El aviso se reescribe, no se parchea

Hoy el mensaje se arma con un `extra` que se mete o no:

```javascript
const extra = porcentajeUmbral ? ` (${porcentajeUso} % de ${porcentajeUmbral} %)` : '';
```

El problema no es el `if`: es que **el paréntesis con números entra cuando hay
números**, y en el camino del almacenamiento roto los números existen pero no
significan nada. Sale 0 % porque el cálculo se hizo antes de escribir.

Un parche sería: no mostrar el `extra` cuando `porcentajeUso === 0`. Funciona,
pero deja el código lleno de condiciones que existen por una glosa suelta.

La reescritura es que **cada camino diga lo que sabe**. El camino que sabe el
porcentaje lo muestra; el que no lo sabe, no dice número. Son dos mensajes, y
por eso se escriben dos.

### DD-4 — La lista de días se toma del módulo que ya la tiene

Hay dos candidatas: mover la de `app.js` a `mapa-calor.js`, o la de
`mapa-calor.js` a otro lado.

Se toma la de `mapa-calor.js` porque ya está probada y ya se consume desde
`js/interfaz/mapa-calor.js`. Moverla sería cambiar el lugar de la fuente buena
para no ganar nada.

### DD-5 — Lo que se mueve se mueve entero o no se mueve

Cada bloque sale completo. No se deja "la parte fácil" en `app.js` y se lleva la
difícil: dos mitades de la misma función es peor que tenerla entera en un lado.

Cuando un bloque mezcla dibujo y lógica —`mostrarAnotaciones` es el caso— **se
parte por la costura que ya existe**, que es la que separa `prompt` y `confirm`
de las decisiones que toman.

## 1. Archivos que se crean

| Archivo | Qué lleva |
|---------|-----------|
| `js/logica/calendario.js` | Las tres reglas de dominio del calendario, puras |
| `test/calendario.test.js` | Sus tests, con los valores del dominio |

## 2. Archivos que se modifican

| Archivo | Qué cambia |
|---------|-----------|
| `js/app.js` | La lista de días se va, el aviso se reescribe, las tres reglas se mudan |
| `js/logica/mapa-calor.js` | Nada. Ya tiene la lista y los tests |
| `test/visor.test.js` | **Deja de mirar un archivo.** Pasa a mirar una lista |
| `test/estadisticas-visibles.test.js` | Ídem, aunque el bloque no se mueva todavía |
| `test/menu-movil.test.js` | Ídem |
| `test/responsive-calendario.test.js` | La explicación de por qué `app.js` está exceptuado |
| `AGENTS.md` | La deuda de la lista de días, cuando se cierre |

## 3. Archivos que NO se tocan

| | Por qué |
|---|---|
| `js/interfaz/visor.js` | Ya está bien. El panel sin contenido se parece a lo que hace, pero va a su propio lugar por otra razón: la red de XSS |
| `css/styles.css` | RNF-1. No cambia ni un píxel |
| `js/logica/mapa-calor.js` | DD-4. Ya tiene la fuente buena |
| Los ids que genera `app.js` | Cambiaría los que el usuario tiene guardados. Otro tema |

## 4. Orden de ejecución

```
T1  Las redes vigilan los archivos nuevos    → el test se cae si muevo algo
T2  La lista de días, de un solo lugar        → el calendario se ve igual
T3  El aviso del almacenamiento              → los tres casos se leen bien
T4  La lógica del calendario, con tests      → js/ baja, la suite sube
```

T1 primero porque es lo que hace que los demás sean seguros. Es lo contrario de
lo natural: primero el test, después el código. Pero acá el código ya existe y
lo que falta es **moverlo**, y si la red no sigue, el movimiento es a ciegas.

T2 y T3 no dependen entre sí y son chicos. T4 es la que mueve código de verdad.

## 5. Verificación

### Lógica pura (Principio 4, camino 1)

```
node --test                          # → 328 o más, 0 fallan
node --test test/navegador.test.js   # → 26, y el número de scripts sube a 17
node --test test/calendario.test.js  # → nuevo
```

El número de scripts de `navegador.test.js` **sale de la lista**, así que sube
solo. Y hay un test que compara esa lista con `index.html`, así que si se olvida
agregar el script nuevo, falla.

### Lo que se ve (Principio 4, camino 2)

```
node herramientas/capturar-arbol.js herramientas/linea-base-arbol.json
node herramientas/comparar-arbol.js          # → IDÉNTICO, salida 0
```

**La línea base se congela antes de tocar nada.** Si se regenera después, el
movimiento se compara contra algo que ya estaba mal y no prueba nada.

Y en Chrome, a mano:

| Qué | Cómo se comprueba |
|-----|-------------------|
| El calendario dibuja los mismos siete encabezados | Abrir el calendario y comparar |
| Los meses con anotaciones muestran los puntos | Agregar una anotación, mirarla, recargar |
| El aviso con el almacenamiento lleno | Llenar a 4,9 MB y guardar |
| El aviso con el almacenamiento roto | Romper `setItem` y guardar |

`verificar-layout.js` **sí se corre**, a diferencia de la spec 005: acá se toca
código de dibujo del calendario, y el layout es exactamente lo que podría
cambiar. Tarda más de diez minutos, así que va una vez, al final, y en segundo
plano.

### Siempre

```
node herramientas/buscar-codigo-muerto.js   # → salida 0
node herramientas/buscar-caracteres-raros.js # → salida 0
node herramientas/verificar-layout.js        # → salida 0
```

## 6. Riesgos

| Riesgo | Cómo se evita |
|--------|---------------|
| **Una red deja de cubrir y nadie se entera** | T1. Las redes se abren primero y miran una lista de archivos |
| Mover `app.js` rompe `menu-movil.test.js`, que recorta por marcas | T1 lo anticipa. La lista pasa a ser explícita |
| La lista de días cambia un encabezado sin que nadie lo note | El test de `diasDeSemana()` ya existe. Se compara en Chrome también, que es donde se vería |
| El aviso nuevo es *peor* que el viejo | Se prueban los tres casos a mano en Chrome antes de dar por buena la tarea |
| Mover lógica y corregirla de paso | La constitución lo prohíbe. Si aparece un bug al mover, **se anota y se deja** |

## 7. Lo que este plan deja escrito

- Una lista de días en un solo lugar, con su test.
- Las tres reglas del calendario probadas, que hoy no tienen ni un test.
- Cuatro redes que vigilan donde vive el código, no donde vivía.
- Un aviso que no se contradice.

Y deja **sin** tocar, con el motivo anotado: el visor de PDF, la construcción del
árbol, el Pomodoro, las plantillas, y el `app.js` monolítico —que sigue siendo
el archivo más grande del proyecto y necesita su propia spec.
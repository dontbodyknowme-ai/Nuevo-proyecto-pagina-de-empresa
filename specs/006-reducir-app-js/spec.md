# Especificación: Reducir `app.js` sin cambiar lo que se ve

## Contexto

`js/app.js` tiene 1800 líneas y 47 funciones. De esas, **393 son comentarios y
274 están en blanco**: el código real son unas 1100 líneas, y las dos-thirds del
resto son explicaciones de por qué cada cosa está como está.

La spec 003 ya le sacó la lógica pura y dejó el archivo como punto de entrada,
que es lo correcto. Lo que quedó pendiente después fue: sacarle el **dibujo**,
que es lo que la spec 003 dejó explícitamente para otra.

### Defecto 1 — La lista de días de la semana está escrita dos veces

`js/app.js:1534` y `js/logica/mapa-calor.js:130` tienen la misma línea:

```javascript
['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
```

Antes eran tres. T6 borró la de `fechas.js` por no tener consumidor, y la
anotación quedó diciendo la cantidad vieja. Ya se corrigió el número; lo que
falta es **unificar de verdad**.

### Defecto 2 — El aviso del almacenamiento se contradice a sí mismo

Con el almacenamiento **roto**, el aviso dice:

> *El almacenamiento del navegador está casi lleno (0 % de 95 %).*

El 0 % es real —el cálculo se hizo antes de intentar escribir y no falló— pero
junto a "casi lleno" se lee como un contrasentido. El usuario no sabe si
inventó el número, si la app está mal, o qué hacer.

### Defecto 3 — Hay lógica de dominio dentro del archivo más grande

Tres decisiones del calendario están mezcladas con el dibujo, en un archivo que
`node --test` no puede mirar:

| Qué | Qué decide |
|-----|-----------|
| `esMesAnioValidos` | Si un mes y un año tienen sentido |
| `nuevaAnotacion` | Si una anotación se puede crear, y con qué forma |
| `editarAnotacion` / `quitarAnotacion` | Qué pasa al cambiar o borrar una anotación |

Son reglas de dominio con límites claros —año bisiesto, mes 13, descripción
vacía, el cuarto intento con 3 anotaciones puestas— y son exactamente el tipo de
cosa que se prueba fácil una vez que está sola, y no se prueba nada mientras
vive entre `prompt`, `confirm` y `localStorage`.

### Defecto 4 — Cuatro tests leen `app.js` como texto

No es un defecto del código: es una **deuda oculta** que aparece apenas se mueve
algo. Estos tests parsean el archivo:

| Test | Qué exige |
|------|-----------|
| `test/visor.test.js` | que `app.js` no interpole el nombre del documento en un `innerHTML` |
| `test/estadisticas-visibles.test.js` | que `mostrarBienvenida()` siga en `app.js` |
| `test/menu-movil.test.js` | que la sección del menú siga entre las marcas `// =====` |
| `test/responsive-calendario.test.js` | que `app.js` **no** mida la pantalla, y lo exceptúa explícitamente por el visor de PDF |

El más peligroso es el primero: **si el panel de documento sin contenido se muda
a un módulo nuevo, el test sigue mirando `app.js` y deja de cubrir el XSS.**
La red se corre en verde mientras ya no vigila nada.

## Objetivos

1. Que la lista de días exista en un solo lugar.
2. Que el aviso del almacenamiento se entienda.
3. Que la lógica de dominio del calendario esté sola, con sus tests.
4. Que los tests que miran `app.js` **sigan mirando el código movido**.

## Fuera de alcance

- **`app.js` monolítico.** Sigue siendo el punto de entrada, por diseño, y sacarle
  lo de dibujo es un trabajo de spec propia. Esta spec saca el dominio y dos
  duplicaciones, nada más.
- **El visor de PDF.** Moverlo rompe la excepción de `responsive-calendario.test.js`,
  que lo excluye *precisamente* por el `clientWidth` de la línea 1044. Es el
  bloque más seguro del archivo respecto a XSS y el que menos gana moviéndose.
- **Construir el árbol.** `construirArbol()` son 180 líneas con nueve
  dependencias; los manejadores de clic cierran sobre los objetos reales. Es medio
  archivo, y moverlo a la mitad rompe más de lo que arregla.
- **El Pomodoro.** `setInterval`, `Notification`, `AudioContext` y estado propio.
  Va después de todo lo demás.
- **Las plantillas de `.bienvenida`.** Decidido el 2026-10-02: **no molestan.** Las
  tres con `innerHTML` son pantallas de error distintas, no tres versiones de lo
  mismo. La cuarta ya usa `createElement`. No hay nada que unificar.

## Requisitos funcionales

### RF-1 — La lista de días está en un solo lugar

`app.js` toma la lista de `js/logica/mapa-calor.js`, que es donde ya está y donde
tiene tests. La copia de `app.js` desaparece.

| | |
|---|---|
| El calendario mensual sigue mostrando los mismos siete encabezados | Igual que antes, carácter por carácter |
| La línea duplicada desaparece | Una sola fuente |

### RF-2 — El aviso del almacenamiento se entiende

| Situación | Qué dice |
|-----------|----------|
| No entra por espacio, y se sabe cuánto hay | *"casi lleno (98 % de 5 MB)"* o similar con **cifras que signifiquen algo** |
| El almacenamiento **trió** al escribir | **No dice un porcentaje.** Dice que no se pudo guardar |

El 0 % desaparece porque en ese camino **no hay porcentaje que mostrar**: el
cálculo se hizo antes de escribir y falló al escribir. No se sabe cuánto había.

### RF-3 — La lógica del calendario se puede probar sola

Un módulo nuevo con las tres funciones, sin DOM y sin `localStorage`, y tests
propios con los valores del dominio:

| Caso | Valor esperado |
|------|----------------|
| Mes 13 | No es válido |
| Año 2019 | No es válido |
| Mes 0 | No es válido |
| Año bisiesto, mes 2 | Válido |
| Cuarta anotación en un día | No entra: el máximo es 3 |
| Descripción con espacios | Se recorta, y vacía no entra |
| Editar con texto vacío | No cambia nada |

### RF-4 — Las redes siguen vigilando el código movido

Los cuatro tests que leen `app.js` como texto tienen que seguir mirando donde
viva el código después de moverlo. Si no, se corrigen antes de mover, no
después: **una red que dejó de cubrir no avisa que dejó de cubrir.**

## Requisitos no funcionales

| | |
|---|---|
| **RNF-1** | Nada de lo que se ve cambia. El calendario dibuja lo mismo, el aviso es el único texto que cambia |
| **RNF-2** | La suite no baja de 328, y sube con los tests nuevos de RF-3 |
| **RNF-3** | Ningún dato del usuario entra como marcado en el código nuevo. `textContent` |
| **RNF-4** | `app.js` sigue siendo el punto de entrada y el que se carga último |

## Casos límite

### Mover código que un test vigila por su ubicación

Es el riesgo real de esta spec. La respuesta es **corregir el test primero**:
que mire una lista de archivos en vez de uno. Así el día que se mueva algo más,
el test ya cubre lo nuevo.

### La lista de días y el orden de carga

`app.js` ya carga `MapaCalorLogica` y usa `diasDeSemana` por otra vía. Agregar
una dependencia más no cambia el orden: el módulo de lógica ya está cargado.

### El aviso sin porcentaje

El caso del almacenamiento roto no tiene un número que mostrar. La tentación es
poner "0 %" o esconder el paréntesis. Las dos cosas quedan raras. Lo correcto
es **no mostrar nada que no sepa**, y decirlo con palabras.

### El mes y el año, dos cosas distintas

`esMesAnioValidos` tiene dos límites: el mes es 1 a 12, y el año tiene un rango.
La razón del rango de años no está escrita en ninguna spec. Se deja el valor
que hay y se anota que es un límite sin origen conocido, para que alguien lo
decida.

## Decisiones ya tomadas

| Decisión | Respuesta |
|----------|-----------|
| ¿Unificar las cuatro plantillas de `.bienvenida`? | **No.** No molestan. Las tres con `innerHTML` son pantallas de error distintas |
| ¿Una sola spec para todo lo pendiente? | **No.** Esta spec agrupa lo que se verifica con "no cambió lo que se ve". `app.js` entero va aparte |
| ¿Mover el visor de PDF? | No. Rompe la excepción de `responsive-calendario.test.js` y es el bloque más seguro del archivo |
| ¿Tocar los ids que genera `app.js` a mano? | No. Cambiaría los que ya están guardados en el `localStorage` del usuario. Es otro tema |

## Criterios de finalización

- [ ] La lista de días está en un solo lugar y el calendario se ve igual
- [ ] El aviso con almacenamiento roto no dice un porcentaje
- [ ] Los tres casos del aviso dicen algo entendible
- [ ] La lógica del calendario está en un módulo propio, con sus tests
- [ ] Los cuatro tests que leían `app.js` vigilan los archivos nuevos
- [ ] `capturar-arbol.js` da IDÉNTICO
- [ ] La suite sube de 328
- [ ] Chrome: el calendario dibuja igual y el aviso se lee bien
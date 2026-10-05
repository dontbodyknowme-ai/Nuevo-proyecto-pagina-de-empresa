# Plan de implementación: Estructura y adaptabilidad del modal del calendario

**ID:** 002-layout-calendario
**Basado en:** [`spec.md`](spec.md) v1.0 y [`../../docs/constitucion.md`](../../docs/constitucion.md)
**Estado:** Ejecutado por completo — ver [`task.md`](task.md). Incluye tres decisiones tomadas sobre la marcha (DD-6, DD-7, DD-8) y una sección de errores propios corregidos.
**Versión:** 2.0

---

## 0. Decisiones que este plan propone

### DD-1 — Qué se decide con código y qué se decide con estilos

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | La decisión de **qué elementos se muestran** se toma con una función pura en JavaScript. La **geometría** —anchos, alturas,distribution en columnas, cortes— se resuelve únicamente en la hoja de estilos. |
| **Justificación** | El Principio 4 exige que lo comprobable como función pura se compruebe como función pura. Qué chrome pertenece a cada vista es una decisión de contenido y se puede testear sin pantalla. Los breakpoints, en cambio, no se pueden testear con el runner de Node: medirlos en JavaScript los duplicaría con las hojas de estilo y las dos fuentes terminarían discrepando. |
| **Alternativa descartada** | Calcular en JavaScript el modo según `window.innerWidth`. Se descartó porque introduce una segunda fuente de verdad para los umbrales, obliga a escuchar el redimensionado y hace imposible testearlo. |
| **Validación necesaria** | Ninguna. Es la lectura directa de los Principios 3 y 4. |

### DD-2 — Restaurar el panel en lugar de rediseñar el modal

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | Agregar a la estructura de la página el contenedor que el proyecto **ya define y ya paga** en la hoja de estilos, envolviendo los tres bloques actuales. No se cambia ninguna clase ni se escribe CSS nuevo para el panel. |
| **Justificación** | El panel ya está escrito en `css/styles.css` con fondo, borde, esquinas redondeadas, ancho máximo, alto máximo y desbordes. Falta únicamente el elemento que lo usa. Es la causa raíz y el arreglo más pequeño posible. |
| **Alternativa descartada** | Reescribir el modal con un diseño nuevo. Se descartó porque `RF-1` no pide un rediseño y la especificación declara fuera de alcance cambiar el aspecto visual. |

### DD-3 — Dónde queda el panel de anotaciones cuando el ancho no alcanza

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | El panel de anotaciones pasa **debajo** de la rejilla y el conjunto se lee con desplazamiento vertical dentro del panel. |
| **Justificación** | Es el cambio de menor alcance: no altera el flujo de selección de día, que ya funciona, y no esconde ninguna función. El usuario llega a la anotación scrolleando, que es lo esperable en un teléfono. |
| **Alternativas descartadas** | **Ocultar el panel** y mostrarlo aparte al tocar un día: esconde una función que hoy está siempre visible y agrega un estado nuevo que habría que probar. **Pantalla completa**: es un rediseño del modal, y `RF-4` no lo pide. |
| **Validación necesaria** | Confirmar con el usuario que scrollear para llegar a las anotaciones le resulta cómodo en un teléfono. Si molesta, el caso queda como pendiente con sus opciones anotadas. |

### DD-4 — Ancho del panel

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | `width: min(94vw, 1320px)`, con 375 px declarados como ancho mínimo de ventana. |
| **Justificación** | El valor actual de 900 px **alcanza y no recorta**: con 900 px de panel la rejilla queda en 580 px y las celdas del mes miden unos 70 px. Pero el beneficio real del ancho flexible **no está en las pantallas muy grandes**, donde la diferencia es de 34 px, sino en las de escritorio común: a 1280 px el ancho flexible lleva las celdas de 50 px a unas 113. |
| **Alternativa descartada** | Mantener 900 px fijos. Se descartó porque desperdicia espacio horizontal en monitores, que es el caso más común. |
| **Validación necesaria** | El valor exacto es un número de diseño. Se propone 1320 px y se ajusta mirando capturas reales, sin cambiar el resto del plan. |

### DD-5 — Qué queda fuera de alcance aunque sea tentador

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | No se agrega ningún criterio de ancho en JavaScript, no se agrega librería de medición, no se reorganiza el modal y no se rediseña ningún estilo. |
| **Justificación** | El Principio 1 congela el stack y el Principio 2 exige que todo lo nuevo esté justificado. Agregar herramientas para resolver un problema de estilos sería ampliar el proyecto por un problema de estilos. |

---

### DD-6 — Mover el botón de cerrar al encabezado

> **Decisión tomada durante la ejecución.** No estaba en el plan original.

| Aspecto | Detalle |
|---------|---------|
| **Decisión tomada** | `#btnCerrarCalendario` se mueve del panel de anotaciones al encabezado del modal, que siempre está visible. |
| **Por qué fue necesaria** | El panel tiene `display: none` en la vista mapa, y el botón estaba dentro. Quedaba con **ancho 0**: invisible e inclicable. Como `RF-5` exige que el botón de cerrar se muestre en **ambas** vistas, y ninguna lógica puede hacer visible un botón cuyo padre está oculto, la especificación era **insatisfacible** tal como estaba escrita. |
| **Decisión del usuario** | Mover el botón, en vez de corregir `RF-5` para que aceptara que en la vista mapa se cierra con Escape. |
| **Alternativa descartada** | Ocultar el panel en mapa ya lo hace; el problema es que el botón vivía adentro. La otra opción era cambiar el requisito. |
| **Alternativa descartada** | Duplicar el control con dos ids distintos y mostrar uno u otro. Se descartó porque agrega estado nuevo que habría que probar. |

---

### DD-7 — `[hidden]` necesita `display: none !important`

> **Decisión tomada durante la ejecución.** No estaba en el plan original.

| Aspecto | Detalle |
|---------|---------|
| **Decisión tomada** | Agregar `[hidden] { display: none !important; }` a la hoja de estilos. |
| **Por qué fue necesaria** | Los elementos que se ocultan tienen `display: flex`. Eso **le gana al atributo `hidden`** del navegador: el atributo se aplicaba y el elemento seguía en pantalla. Los 11 tests de Node pasaban porque el DOM falso de los tests no aplica CSS. |
| **Por qué `!important`** | No hay forma de ganar por orden de cascada: `display: flex` está en la regla del componente, y el atributo se resuelve antes. |
| **Alternativa descartada** | Pisar `display` desde JavaScript. Se descartó porque la hoja de estilos deja de tener el control de la presentación, yPrincipio 3 pide separar lógica de dibujo. |

---

### DD-8 — Ocultar el Pomodoro mientras el modal está abierto

> **Decisión tomada durante la ejecución.** No estaba en el plan original.

| Aspecto | Detalle |
|---------|---------|
| **Decisión tomada** | `.modal-calendario.visible ~ .pomodoro-widget { display: none; }` |
| **Por qué fue necesaria** | El widget del Pomodoro y el modal compiten por el mismo `z-index: 1000`. El widget se dibuja después, así que gana: medido **213×40 px encima del encabezado** a 375 px, tapando los controles. |
| **Por qué alcanza con CSS** | El modal aparece **antes** que el widget en el HTML, así que el selector de hermano general funciona. No hizo falta tocar JavaScript. |
| **Alternativa descartada** | Subir el `z-index` del modal. Se descartó porque funciona por número y se rompe con el primer `z-index: 1001` que se agregue. |

---

## 1. Archivos que se crean

| Archivo | Responsabilidad | Requisitos |
|---------|-----------------|------------|
| `js/logica/layout.js` | Función pura que, dada la vista activa, dice qué elementos del chrome se muestran. **No toca el DOM, no lee el ancho, no lee el reloj** | RF-5 |
| `js/interfaz/visibilidad.js` | Aplica esa decisión poniendo `hidden`. Oculta con el atributo, **no** pisando `display` | RF-5 |
| `test/layout.test.js` | Verificación de la función pura con el runner nativo de Node | RF-5, RNF-3 |
| `test/visibilidad-calendario.test.js` | Verificación de la aplicación, con un DOM falso. También comprueba que **no** mida la pantalla | RF-5, RNF-4 |
| `test/responsive-calendario.test.js` | Comprueba que la hoja de estilos **contenga** las reglas correctas, y que el código del calendario no lea medidas | RF-3, RF-4, RF-9, RNF-1, RNF-4 |
| `herramientas/verificar-layout.js` | Script de medición: abre Chrome, recorre cuatro anchos y las dos vistas, y reporta lo que no entra. **Sale con código 1 si encuentra algo** | RF-2, RF-3, RF-4, RF-9, RNF-1, RNF-2 |

> ### Corrección al plan original
>
> El plan decía `test/verificar-layout.js`, y que *"no es un `*.test.js`, así que el runner no lo ejecuta"*.
>
> **Eso era falso.** Se comprobó con una sonda: `node --test` ejecuta **cualquier** `.js` dentro de un directorio llamado `test`, aunque no se llame `*.test.js`, y **cuenta como un test**. Si el verificador hubiera quedado ahí, cada corrida de la suite habría abierto un Chrome.
>
> Por eso vive en `herramientas/`, fuera del alcance del runner.

---

## 2. Archivos que se modifican

| Archivo | Cambio | Requisitos |
|---------|--------|------------|
| `index.html` | Agregar el contenedor del modal (**ni una clase nueva**); mover el botón de cerrar al encabezado (DD-6); cargar `layout.js` y `visibilidad.js` en el orden correcto | RF-1, RF-5 |
| `css/styles.css` | Aplicar DD-4; **fusionar** las dos definiciones de la rejilla; agregar `[hidden]` (DD-7); ocultar el Pomodoro con el modal abierto (DD-8); agregar los dos `@media` de adaptación | RF-1 a RF-4, RF-9, RNF-1, RNF-2 |
| `js/inicio-calendario.js` | Al alternar y al arrancar, aplicar la visibilidad. **Sin medir píxeles, sin `innerHTML`** | RF-5, RF-6 |
| `test/navegador.test.js` | Actualizar la lista de scripts: pasaron de 7 a 9, y exigir los globales nuevos | Principio 4 |
| `AGENTS.md` | Registrar los archivos nuevos, el comando de verificación y la regla de qué decide el código y qué el CSS. Corregir la descripción del calendario | Principio 2 |
| `MEMORY.md` | Registrar que el calendario es adaptable, con los anchos verificados | Principio 2 |
| `specs/001-heat-map/task.md` | Sacarle el BOM. Venía de una sesión anterior | Principio 6 |

> `js/interfaz/mapa-calor.js` figuraba en el plan original para darle una clase propia a las muestras de la leyenda. **Quedó fuera de alcance**: es higiene de selección de nodos, no un defecto visible, y la `spec.md` lo declara así explícitamente.

---

## 3. Archivos que NO se tocan

| Archivo | Por qué |
|---------|---------|
| `js/app.js` | La causa del resaltado de días con estudio ya estaba corregida y probada. Esta especificación es de presentación y no lo necesita. |
| `js/logica/mapa-calor.js` | Toda la lógica del mapa se mantiene intacta. `RF-7` lo prohíbe explícitamente. |
| `js/interfaz/mapa-calor.js` | Ídem: `RF-7` lo prohíbe. El plan original lo tenía en la lista de modificación, y eso fue un error. |
| `js/datos/secciones.js` | No participa del layout. |
| `js/datos.js` | Código muerto. Fuera del alcance de esta especificación. |
| Cualquier clave de `localStorage` | `RNF-6`: no se lee, escribe, migra ni transforma ningún dato del usuario. |

---

## 4. Orden de ejecución

El orden importa: cada paso se verifica antes de pasar al siguiente.

| # | Paso | Por qué en este orden |
|---|------|------------------------|
| 1 | Función pura y sus tests | Es lo único comprobable sin navegador. Va primero porque fija la decisión de DD-1. |
| 2 | Agregar el contenedor a la estructura | Arregla la causa raíz. Se verifica mirando y ya debería mejorar mucho el ancho de 1280. |
| 3 | Ajustes de estilos del panel | Activa el panel y aplica DD-4. Verificable de inmediato. |
| 4 | Conectar la función pura con la alternancia | Recién acá tiene efecto RF-5. |
| 5 | Reglas de adaptación | Agrega las que nunca existieron. Cierra el problema de 768 y 375. Al apilar el panel hay que **corregir los desplazamientos anidados**: hoy el cuerpo recorta y las dos partes se desplazan por su cuenta, y eso en una sola columna produce dos zonas de scroll dentro de una caja recortada. |
| 6 | Clase propia para las muestras de la leyenda | Higiene de DOM. Sin efecto visible, puede ir al final. |
| 7 | Script de medición en el proyecto | Convierte la verificación en parte del proyecto. |
| 8 | Verificación final y documentación | Cierra con evidencia medida. |

---

## 5. Verificación

### Camino 1 — Lógica pura (Principio 4)

```powershell
node --test
# Debe terminar con: fail 0, y el total sube respecto de los 101 actuales
```

```powershell
node --test test/layout.test.js
# Solo las pruebas de la función nueva
```

### Camino 2 — Interfaz (Principio 4)

```powershell
node herramientas/verificar-layout.js
# Debe imprimir, para 1920 / 1280 / 768 / 375 en las dos vistas:
#   - elementos recortados: 0
#   - elementos fuera de la ventana: 0
#   - scroll horizontal: no
#   - zonas con desplazamiento: 1
# Y terminar con "Todo entra" y código de salida 0.
```

Además, en Chrome:

| Paso | Qué se mira |
|------|--------------|
| 1 | Consola con 0 errores |
| 2 | Captura de las dos vistas en los cuatro anchos |
| 3 | El botón de alternar funciona ida y vuelta en el ancho mínimo |
| 4 | Agregar una anotación sigue funcionando en el ancho mínimo |
| 5 | El hover del mapa sigue mostrando minutos |
| 6 | Al cambiar el tamaño con el modal abierto, la distribución se recalcula |

### Siempre, en cada paso

```powershell
Test-Path package.json    # → False
Test-Path node_modules    # → False
node --check js/logica/layout.js
node --test test/navegador.test.js
# UTF-8 sin BOM en los archivos tocados
```

> Para correr **un solo archivo** de tests usá siempre la ruta:
> `node --test test/archivo.test.js`. Con `--test-name-pattern` Node cuenta
> además un ítem por cada archivo del proyecto, y el número que informa no es el
> de tests reales.

---

## 6. Riesgos

| Riesgo | Impacto | Cómo se acotó |
|--------|---------|---------------|
| Tocar el flujo de anotaciones al apilar el panel | Alto | Fue el paso 5, el último. Verificado en Chrome a 375 px: agregar, marcar, punto y contador `1/3` |
| El valor de DD-4 deja las celdas del mes demasiado chicas | Medio | Medido: a 1280 px quedaron en 126 px, de 70 px. El número no hizo falta ajustarlo |
| Regresión en el mapa de calor | Medio | `RF-7` lo prohíbe, y se comparó celdas y niveles antes y después: 28 celdas, 6 niveles |
| Los estilos nuevos pisan los del mapa | Bajo | Los selectores del panel son propios del modal |
| **Dos zonas de desplazamiento anidadas** al apilar el panel | Medio | Resuelto a propósito: el scroll pasó al conjunto. Medido: `["cuerpo"]` a 768 px |
| **El atributo `hidden` no ocultaba nada** | Alto: la funcionalidad clave no hacía nada | No estaba previsto. Lo detectó Chrome, no los tests. Resuelto con DD-7 |

---

## 7. Lo que este plan deja escrito

`AGENTS.md` y `MEMORY.md` tienen que decir la verdad sobre:

- Los cuatro archivos de código nuevos y los tres de test, y para qué son.
- Cómo se verifica el layout: `node herramientas/verificar-layout.js`.
- Que el calendario es adaptable, con los cuatro anchos verificados.
- Qué decide el código y qué decide el CSS, y por qué no se mezclan.
- El tamaño real de `app.js`: la documentación decía 1119 y el archivo tiene 1334.

---

## 8. Errores de este plan, corregidos durante la ejecución

Quedan escritos para que no se repitan.

| Afirmación del plan | Qué era en realidad |
|--------------------|----------------------|
| *"`test/verificar-layout.js` no se ejecuta porque no es `*.test.js`"* | Falso. `node --test` ejecuta cualquier `.js` en un directorio `test`. Comprobado con una sonda |
| *"Borrar el bloque de panel que sobra al final de la hoja"* | Ese bloque no existe. Es la animación `scaleIn`, que **había que conservar**: estaba inerte por la misma causa que el resto |
| *"La rejilla pisa el espaciado de la primera definición"* | Cierto a medias. La segunda ganaba el `gap`, pero la primera seguía aportando `flex`, `padding` y `overflow`. Funcionaba por casualidad, no por diseño |
| El `Contexto` de la spec: *"no hay ninguna regla de adaptación para este modal"* | Falso. Ya existía un `@media (max-width: 600px)` con reglas del calendario. Apuntaban a un contenedor inexistente, así que nunca se aplicaron |
| *"El mapa de calor se altera si se toca `js/interfaz/mapa-calor.js`"* | No hace falta tocarlo. La clase de las muestras quedó fuera de alcance |
| El paso de T3: "alinear las columnas del calendario" | No había desalineación. El "desfase de 389 px" fue una medición mal hecha: comparé la columna `Lu` contra la primera celda *no vacía*, que es `Ju`. Aplicar ese arreglo habría roto el calendario |

---

## 9. Lo que aprendimos haciendo

Tres cosas que no estaban previstas y que conviene tener presentes:

1. **Probar interfaz tiene dos caminos que no se sustituyen.** En T4 el atributo `hidden` se aplicaba, los tests pasaban, y el elemento seguía en pantalla. El DOM falso de los tests no aplica CSS.

2. **`node --test` ejecuta todo lo que hay en `test/`.** Un archivo que abre un navegador rompería cada corrida de la suite.

3. **Un test que se pasa a sí mismo no es un test.** Al arrancar T4 definí la función a probar dentro del propio archivo de test: 7 tests en verde sobre código que nadie llamaba.
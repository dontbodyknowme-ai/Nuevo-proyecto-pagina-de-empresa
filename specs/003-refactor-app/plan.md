# Plan de implementación: Separar el cálculo del dibujo en la aplicación principal

**ID:** 003-refactor-app
**Basado en:** [`spec.md`](spec.md) v1.0 y [`../../docs/constitucion.md`](../../docs/constitucion.md)
**Estado:** Planificado — requiere aprobación
**Versión:** 1.0

---

## 0. Decisiones que este plan propone

### DD-1 — Un test que fija el comportamiento, antes de mover nada

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | Antes de extraer una función, se escribe su test describiendo **qué debe devolver**, no qué hace el código actual. Si no se puede escribir el test sin mirar la implementación, la extracción no está lista. |
| **Justificación** | Es lo que hace que un refactor sea demostrablemente neutro: si el test describe el comportamiento esperado y pasa antes y después, se puede probar que el comportamiento no cambió. Sin eso, "no.toqué nada" es una intención, no una garantía. |
| **Alternativa descartada** | Escribir el test copiando lo que hace el código actual. Se descartó porque congela los bugs: si el código está mal, el test lo ratifica como correcto. |
| **Consecuencia asumida** | El primer paso **cambia comportamiento a propósito** (RF-2). Por eso el test describe lo correcto, no lo que hay. |

---

### DD-2 — Una pieza por tarea, y en orden de valor de prueba

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | El orden no es por tamaño de función sino por **cuánto testeable se vuelve el cálculo**. Primero la aritmética de fechas, que tiene muchos casos límite; al final lo que queda pegado al dibujo. |
| **Justificación** | `construirArbol` es la función más grande (162 líneas) pero su cálculo depende de cuántas veces se llama al almacenamiento. Empezar por ahí sería empezar por lo más difícil sin el mecanismo probado. |
| **Alternativa descartada** | Empezar por `construirArbol` por ser la más grande. Se descartó: grande no quiere decir riesgosa de extraer, quiere decir difícil de entender primero. |
| **Alternativa descartada** | Migrar todo en una sola tarea. Se descartó por `RNF-5`: con 686 líneas de DOM, un error se localiza mal. |

---

### DD-3 — `app.js` sigue siendo el punto de entrada

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | Se extraen cálculos a `js/logica/`, pero `app.js` sigue siendo el archivo grande que coordina y dibuja. No se parte en varios puntos de arranque. |
| **Justificación** | Partirlo exige decidir el orden de carga y volver a probar todo de golpe. La ganancia es estética y el costo es alto. El Principio 1 pide no ampliar la complejidad, y reorganizar el arranque es exactamente eso. |
| **Alternativa descartada** | Un archivo por funcionalidad (`js/materias.js`, `js/documentos.js`, `js/visor.js`...). Se descartó porque obliga a decidir qué comparte qué, y eso no se necesita para el objetivo de la spec. |

---

### DD-4 — Lo que está muy atado al DOM no se toca

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | Si la lógica está tan mezclada con el dibujo que partirla exigiría inventar una interfaz nueva entre las dos, se deja como está y se anota como deuda. |
| **Justificación** | El objetivo es que el cálculo sea verificable. Si para|Separarlo hay que inventar un contrato nuevo, primero hay que entenderlo bien; ahora no se entiende. |
| **Qué queda afuera por esta decisión** | `cargarPDF` y `renderPDFPage`: renderizan a un canvas y el cálculo es inseparable del tamaño de la imagen. |

---

### DD-5 — Las fechas imposibles: avisar, no borrar

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | Al terminar la corrección, si quedan anotaciones en fechas que no existen, se avisa al usuario y se ofrece borrarlas. **No se borran solas.** |
| **Justificación** | Principio 5: los datos son sagrados. Un error del programa no autoriza a borrar cosas. Además, puede que alguien haya escrito "31/02" queriendo decir "31/12" o "28/02" y prefiera corregirlo a perderlo. |
| **Validación necesaria** | **Requiere decisión del usuario**: es el caso CP-1 de la spec, y lo tiene que resolver él. |

---

### DD-6 — Cómo se verifica que algo no cambió

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | Cada tarea termina con cuatro chequeos, en este orden: `node --test` (el total no baja) → `node herramientas/verificar-layout.js` (salida 0) → revisión en Chrome (consola limpia y el flujo del calendario) → los flujos manuales de `AGENTS.md`. |
| **Justificación** | Los tests de lógica pura no tocan el DOM, y la app tiene 686 líneas que sí. El verificador de layout y la revisión en Chrome son los que detectan que algo se rompió de verdad. |

---

## 1. Archivos que se crean

| Archivo | Responsabilidad | Requisitos |
|---------|-----------------|------------|
| `js/logica/fechas.js` | Funciones puras: cuántos días tiene un mes, qué día de la semana cae el primero, si un año es bisiesto, si una fecha existe | RF-1, RF-2 |
| `js/logica/arbol.js` | Función pura que devuelve la estructura del menú lateral como datos | RF-3 |
| `js/logica/anotaciones.js` | Función pura que dice si un día tiene lugar para otra anotación | RF-4 |
| `js/logica/estadisticas.js` | Función pura que devuelve las cantidades de la barra superior | RF-5 |
| `test/fechas.test.js` | Casos límite de la aritmética de fechas | RF-1, RF-2, RF-6 |
| `test/arbol.test.js` | Verificación de la estructura del menú | RF-3, RF-6 |
| `test/anotaciones.test.js` | Verificación de la regla de anotaciones | RF-4, RF-6 |
| `test/estadisticas.test.js` | Verificación de los números | RF-5, RF-6 |

---

## 2. Archivos que se modifican

| Archivo | Cambio | Requisitos |
|---------|--------|------------|
| `js/app.js` | Usar las funciones puras en lugar de calcular en línea. **Solo se quitan cálculos; el dibujo se queda** | RF-1 a RF-5 |
| `js/inicio-calendario.js` | Sigue igual: ya no calcula nada de fechas | — |
| `index.html` | Cargar los módulos nuevos de lógica **antes** que `app.js` | — |
| `test/navegador.test.js` | Actualizar la lista de scripts y los globales esperados | RNF-4 |
| `AGENTS.md` | Registrar los módulos nuevos | Principio 2 |
| `MEMORY.md` | Registrar que el cálculo ya no está mezclado con el dibujo | Principio 2 |

---

## 3. Archivos que NO se tocan

| Archivo | Por qué |
|---------|---------|
| `js/logica/mapa-calor.js` | Ya es lógica pura. `RF-7` de la spec 001 lo exige. |
| `js/logica/almacenamiento.js` | Ya es lógica pura. |
| `js/logica/consentimiento.js` | Ya es lógica pura. |
| `js/logica/layout.js` | Ya es lógica pura. |
| `js/datos/secciones.js` | Ya está separado. |
| `js/interfaz/` | Dibujo. Esta spec no agrega ni quita dibudos. |
| `js/datos.js` | Código muerto. Fuera de alcance. |
| Los datos guardados | **RNF-3**: no se modifica nada que ya esté en el almacenamiento. |

---

## 4. Orden de ejecución

| # | Tarea | Qué sale | Riesgo |
|---|-------|----------|--------|
| 1 | Aritmética de fechas | `js/logica/fechas.js` | Bajo. Además **corrige** las fechas imposibles |
| 2 | Regla de anotaciones | `js/logica/anotaciones.js` | Bajo. Regla chica y clara |
| 3 | Estadísticas | `js/logica/estadisticas.js` | Bajo. Calcular números y ya está |
| 4 | Estructura del menú | `js/logica/arbol.js` | Medio. Es la función más grande |
| 5 | Verificación y documentación | — | — |

La 4 va última a propósito: es la única que toca una función de más de cien
líneas, y para entonces el mecanismo de extracción ya está probado tres veces.

---

## 5. Verificación

### Lógica pura (Principio 4, camino 1)

```powershell
node --test
# El total no puede bajar de 151
node --test test/fechas.test.js
```

### Interfaz (Principio 4, camino 2)

```powershell
node herramientas/verificar-layout.js
# salida 0
```

Y en Chrome:

| Paso | Qué se mira |
|------|--------------|
| 1 | Consola con 0 errores |
| 2 | Navegar a febrero de 2027: 28 celdas, ninguna imposible |
| 3 | Navegar a abril: 30 celdas |
| 4 | Un mes que empieza en domingo: la columna vacía es la correcta |
| 5 | Agregar anotación sigue funcionando |
| 6 | El menú lateral muestra lo mismo que antes |

### Siempre

```powershell
Test-Path package.json    # → False
Test-Path node_modules    # → False
node --check js/logica/fechas.js
node --test test/navegador.test.js
```

---

## 6. Riesgos

| Riesgo | Impacto | Cómo se acota |
|--------|---------|---------------|
| Romper el menú lateral | Alto: es la pantalla principal | Es la tarea 4, la última, y con el mecanismo ya probado |
| Cambiar el aspecto del calendario sin querer | Medio | El verificador de layout mide cajas reales en cuatro anchos y en las dos vistas |
| Que las tareas "puras" no sean puras | **Ya pasó una vez** | El análisis automático marcó 16 funciones como puras y solo 3 lo eran. Hay que leer cada una, no confiar en el conteo |
| Que el total de tests **baje** | Alto: señal de que se perdió cobertura | `RNF-1` lo prohíbe explícitamente |
| Perder anotaciones al corregir las fechas | Alto | `DD-5`: avisar y preguntar, nunca borrar solas |
| Que la extracción esconda un comportamiento raro | Medio | El test se escribe describiendo lo esperado, no copiando el código |

---

## 7. Lo que este plan deja escrito

`AGENTS.md` y `MEMORY.md` tienen que decir:

- Qué cálculo vive ahora en `js/logica/` y qué sigue en `app.js`.
- Que `app.js` no se parte, y por qué.
- Que los datos en fechas imposibles no se borran sin permiso.
- La lección del análisis automático que marcó 16 funciones como puras y
  solo 3 lo eran.
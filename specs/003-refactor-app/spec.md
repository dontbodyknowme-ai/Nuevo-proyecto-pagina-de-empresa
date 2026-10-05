# Especificación: Separar el cálculo del dibujo en la aplicación principal

**ID:** 003-refactor-app
**Estado:** Lista para planificar
**Versión:** 1.0

---

## Contexto

La aplicación principal está en un solo archivo de **1339 líneas**, con **40
funciones**. De esas, **21 tocan el DOM** y ocupan **686 líneas**.

El Principio 3 pide que calcular y dibujar sean cosas distintas. Hoy no lo son:
**17 funciones hacen las dos cosas en el mismo cuerpo.**

| Función | Líneas | Qué mezcla |
|---------|--------|------------|
| `construirArbol` | 162 | Calcula la estructura del menú *y* crea cada nodo |
| `generarCalendario` | 86 | Calcula qué días tiene el mes *y* pinta cada celda |
| `mostrarAnotaciones` | 65 | Filtra, cuenta y agrupa *y* dibuja la lista |
| `cargarPDF` | 54 | Coordina la carga *y* construye la barra |
| `guardarDatos` | 53 | Calcula el espacio usado *y* decide si escribe |

Un análisis automático sumó 274 líneas a "funciones puras". Al revisarlas una
por una, **solo 3 lo eran de verdad**: las demás usan `alert`, `localStorage`,
`confirm`, `prompt`, `FileReader` o `AudioContext`.

Eso cambia el problema. **No hay una capa de cálculo escondida esperando ser
extraída.** Hay 17 funciones donde el cálculo está pegado al dibujo, y
separarlas es un trabajo distinto, más invasivo, que "mover archivos".

### Un defecto que aparece justo en el primer paso

Al revisar `generarCalendario` se encontró que el bucle de días **siempre corre
hasta 31**, sin mirar cuántos días tiene el mes:

- Febrero de 2026 muestra **31 celdas**, incluidas `29/02/2026`, `30/02/2026` y
  `31/02/2026`.
- Esas celdas son clicables, y al hacer clic **se guarda la anotación** en una
  fecha que no existe.
- Como esa celda nunca vuelve a dibujarse al navegar, **la anotación queda
  invisible para siempre**, pero ocupa lugar en el almacenamiento.

Comprobado en el navegador: se guardó una entrega en `31/02/2026` y quedó
persistida.

Esto lo corrige la primera extracción. Por eso el primer paso **no es un
refactor puro**: es una corrección de comportamiento, y se declara como tal.

---

## Objetivos

1. **Que calcular y dibujar estén separados**, empezando por las partes donde la
   separación tiene valor de prueba, no solo de orden.
2. **Que cada cálculo quede verificable sin abrir un navegador**, con los casos
   límite que hoy nadie comprueba: febrero en año bisiesto, meses de 30 días, el
   primer día de cada mes.
3. **No romper nada.** La aplicación tiene 151 tests y un verificador de layout.
   Ninguna tarea puede dejarlos abajo.
4. **Corregir las fechas imposibles** que hoy se pueden generar al navegar el
   calendario.

---

## Fuera de alcance

Esta especificación **no** incluye:

- Partir `app.js` en varios archivos de arranque.
- Rediseñar la interfaz, cambiar colores o reorganizar pantallas.
- Cambiar cómo se guardan los datos o el formato del respaldo.
- Migrar o reescribir los datos que ya están guardados.
- Extraer el cálculo de funciones donde esté demasiado atado al dibujo.
- Sacar el visor de PDF, el Pomodoro o el modo lectura de `app.js`.

---

## Requisitos funcionales

### RF-1 — Las cantidades de un mes se calculan aparte

El sistema debe calcular cuántos días tiene un mes, y qué día de la semana cae
el primero, **sin tocar la pantalla**.

**Criterios de aceptación**

- Con año y mes válidos, el sistema dice cuántos días tiene el mes.
- Un mes de 30 días devuelve 30, y uno de 31 devuelve 31.
- Febrero devuelve 28 en un año común y 29 en uno bisiesto.
- Un año bisiesto es el que es divisible por 4 y no por 100, salvo que también
  sea divisible por 400.
- El sistema dice en qué día de la semana cae el primero, con la semana
  empezando en lunes.
- Un mes o un año imposibles producen un mensaje claro, no una fecha inventada.

---

### RF-2 — El calendario no dibuja días que no existen

El sistema no debe mostrar, ni permitir anotar, en fechas que no existen.

**Criterios de aceptación**

- En un mes de 28 días se dibujan exactamente 28 celdas de día.
- En un mes de 30 días se dibujan exactamente 30.
- En un mes de 31 días se dibujan exactamente 31.
- Ninguna celda corresponde a una fecha imposible como `31/02/2026`.
- Un mes que tiene 29 días no muestra ni el 30 ni el 31.

---

### RF-3 — La estructura del menú se calcula aparte

El sistema debe construir la estructura del menú lateral **como datos**, antes de
dibujarla.

**Criterios de aceptación**

- El cálculo recibe las materias y devuelve la estructura a dibujar, sin
  conversar con la pantalla.
- La estructura devuelta dice, para cada materia, cuántos documentos tiene y
  cuáles días tienen estudio.
- Si no hay materias, la estructura lo dice sin inventar nada.
- El dibujo usa esa estructura y no vuelve a decidir por su cuenta.

---

### RF-4 — El límite de anotaciones por día se comprueba con datos

El sistema debe decidir si se puede agregar una anotación a un día, aplicando la
regla del máximo, **antes de dibujar nada**.

**Criterios de aceptación**

- El cálculo recibe las anotaciones que ya tiene ese día y dice si hay lugar.
- Con menos anotaciones que el máximo, dice que hay lugar.
- Con el máximo alcanzado, dice que no hay lugar.
- Con más anotaciones que el máximo —datos viejos o importados— la regla no se
  rompe: simplemente no hay lugar.

---

### RF-5 — Las estadísticas se calculan aparte

El sistema debe calcular los números que se muestran arriba **como datos**.

**Criterios de aceptación**

- El cálculo recibe las materias y devuelve cuántos documentos hay y cuántas
  palabras, sin leer la pantalla.
- El total de palabras suma las de todos los documentos HTML.
- Los documentos que no son HTML no aportan palabras.
- Sin materias, los números son cero.

---

### RF-6 — Lo que se extrae se prueba antes de moverse

Ninguna parte del cálculo se mueve a otro archivo sin que antes exista un test
que compruebe qué hace.

**Criterios de aceptación**

- Cada función extraída tiene su archivo de test, escrito **antes** que ella.
- El test falla si la función no existe todavía.
- El test describe el comportamiento esperado, no "lo que hace el código".

---

### RF-7 — Nada se rompe en el camino

Cada paso se verifica con los dos caminos del Principio 4 antes de seguir.

**Criterios de aceptación**

- Después de cada tarea, los tests siguen en verde y su cantidad **no baja**.
- El verificador de layout sigue sin encontrar problemas.
- La consola del navegador no muestra errores nuevos.
- Los flujos de agregar materia, subir documento, anotar un día y usar el
  Pomodoro siguen funcionando.

---

## Requisitos no funcionales

| ID | Requisito | Verificación |
|----|-----------|--------------|
| RNF-1 | Ninguna tarea deja menos tests de los que había. | Comparar el total antes y después |
| RNF-2 | No se agregan dependencias. | Verificar que no existen `package.json` ni `node_modules` |
| RNF-3 | No se modifica ningún dato ya guardado, salvo los que la RF-2 impida crear de ahora en adelante. | Revisión de que no hay migraciones |
| RNF-4 | Todo texto nuevo está en español y los archivos en UTF-8 sin BOM. | Revisión de los archivos tocados |
| RNF-5 | Se hace de a una pieza por vez, nunca dos en la misma tarea. | Revisión del historial de tareas |

---

## Casos límite

| Caso | Comportamiento esperado |
|------|-------------------------|
| Año bisiesto divisible por 400, como 2000 | Febrero tiene 29 días |
| Año divisible por 100 pero no por 400, como 1900 | Febrero tiene 28 días |
| Año divisible por 4 pero no por 100, como 2024 | Febrero tiene 29 días |
| Un mes que empieza en domingo | La primera columna queda vacía, no la última |
| Un mes de 30 días | No existe la celda 31 |
| Un día ya tiene el máximo de anotaciones | No se puede agregar otra, y se avisa |
| Un día tiene más anotaciones que el máximo, por datos importados | La regla no se rompe: no se agrega, y las que hay se siguen viendo |
| El usuario tiene anotaciones en fechas imposibles guardadas antes | Se avisan y se ofrecen borrar. **No se borran solas** |
| No hay ninguna materia | La estructura del menú lo dice sin inventar nada |
| Un archivo no es HTML | No aporta palabras a las estadísticas |

---

## Casos límite pendientes de definir

| Caso | Situación |
|------|-----------|
| CP-1 | Qué hacer con las anotaciones ya guardadas en fechas imposibles. No está decidido si se limpian al abrir, se avisan una vez, o se dejan como están. |
| CP-2 | Cuánto vale como "palabra" en las estadísticas. Hoy se cuenta partiendo por espacios. No está definido si se debería contar de otra forma. |

---

## Criterios de finalización

La especificación se considera finalizada cuando:

1. Las extracciones planificadas están hechas, una por tarea.
2. Los requisitos **RF-1** a **RF-7** cumplen sus criterios de aceptación.
3. Los no funcionales **RNF-1** a **RNF-5** están verificados.
4. Los casos límite de la sección *Casos límite* tienen un test, salvo los que
   dependen de CP-1 y CP-2.
5. La consola del navegador no muestra errores.
6. El calendario no dibuja fechas que no existen.
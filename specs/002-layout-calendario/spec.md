# Especificación: Estructura y adaptabilidad del modal del calendario

**ID:** 002-layout-calendario
**Estado:** Implementada — ver [`task.md`](task.md)
**Versión:** 1.1

---

## Contexto

El Cuaderno Virtual tiene un modal de calendario con dos vistas que se alternan
con un botón: el **calendario mensual** con sus anotaciones, y el **mapa de calor**
de las últimas cuatro semanas.

Ambas vistas funcionan, pero el modal **no tiene estructura**. El comportamiento
se verificó midiendo las cajas reales en un navegador en cuatro anchos:

| Ancho de ventana | Lo que ocurre |
|------------------|---------------|
| 1920 px | Correcto |
| 1280 px | Funciona, pero el área central queda comprimida a la mitad y las celdas del mes quedan de 50 px |
| 768 px | La rejilla conserva 64 px de los 256 px que necesita. El panel de anotaciones, 69 de 181. **Se pierde el 75 % del contenido.** |
| 375 px | La rejilla y el panel quedan fuera de la pantalla. En la vista del mapa, el área llega a medir **cero píxeles de ancho**. |

Las causas son tres y están identificadas:

1. **Falta el contenedor.** El proyecto define el panel que debe envolver todo el
   modal —con fondo, bordes, esquinas redondeadas, ancho máximo y alto máximo— pero
   ese contenedor **no está en la estructura de la página**. Sin él, el modal se
   acomoda en fila: la navegación de mes a la izquierda, el contenido al centro y
   la leyenda a la derecha.

2. **Las reglas de adaptación apuntan a un contenedor que no existe.** El
   proyecto tiene un bloque `@media (max-width: 600px)` con reglas para el
   calendario: `.calendario-container`, `.celda-dia`, `.calendario-leyenda`.
   Como el contenedor no estaba en el HTML, **esas reglas nunca se aplicaron**.

   Hay además dos bloques más que tocan el menú, el visor, las estadísticas y el
   espaciado del mapa. **Ninguno apila el panel de anotaciones debajo de la
   rejilla**, que es lo que hace falta en pantalla angosta.

3. **Elementos que no corresponden a la vista activa.** En la vista del mapa siguen
   visibles los campos de mes y año, y la leyenda de tipos de anotación. Ambos
   hablan de un mes que la vista activa no muestra, y el botón de navegación opera
   sobre un calendario que en ese momento está oculto.

El resultado es que el calendario **solo se puede usar cómodamente en pantallas
grandes**, pese a que la documentación del proyecto afirma lo contrario.

> La documentación dice *"responsive tipo iPhone"*. Hoy eso **no es cierto**, y por
> Principio 2 hay que corregirlo o dejarlo de afirmar.

---

## Objetivos

1. **Que el calendario sea usable en cualquier pantalla.** Desde un teléfono de
   375 px hasta un monitor de 1920 px, sin perder contenido.
2. **Que nada quede recortado.** Ningún elemento visible puede tener menos ancho
   del que su contenido necesita.
3. **Que cada vista muestre lo que le corresponde.** La navegación de mes y la
   leyenda de anotaciones son de la vista mensual; el mapa no las necesita.
4. **No perder nada de lo que funciona.** Las anotaciones, el mapa de calor, el
   Pomodoro y todos los datos del usuario deben seguir funcionando igual.

---

## Usuarios

| Usuario | Necesidad |
|---------|-----------|
| **Estudiante** (usuario principal) | Consultar el calendario y sus anotaciones desde el teléfono, en el colectivo o entre clases, sin que la pantalla le quede mal. |
| **Estudiante** en computadora | Ver el calendario cómodo en un monitor, con el panel de anotaciones al costado y no encima. |

> No hay usuarios nuevos. Esta especificación no agrega funcionalidades de
> estudio: corrige la presentación de las que ya existen.

---

## Definiciones

| Término | Significado en esta especificación |
|---------|-----------------------------------|
| **Modal del calendario** | La ventana superpuesta que contiene el calendario mensual, el mapa de calor y el panel de anotaciones. |
| **Vista activa** | Cuál de las dos —calendario mensual o mapa de calor— está mostrando el modal. |
| **Panel** | El contenedor visual del modal: fondo, borde, esquinas redondeadas y límites de tamaño. |
| **Chrome del modal** | Los elementos que acompañan a las vistas pero no son las vistas: la navegación de mes y año, el botón de alternar, el botón de cerrar y la leyenda de tipos de anotación. |
| **Ancho suficiente** | A partir del cual el panel de anotaciones puede ponerse al costado de la rejilla sin que ninguna de las dos se recorte. |
| **Elemento recortado** | Un elemento visible cuyo contenido necesita más espacio del que tiene disponible. |
| **Sin desbordes** | Ningún elemento visible queda fuera de la ventana, por ninguno de sus cuatro lados. |

---

## Historias de usuario

**HU-1 — Consultar desde el teléfono**
Como estudiante, quiero ver el calendario completo en mi teléfono, para anotarme
un parcial sin tener que prender la computadora.

**HU-2 — Leer los días de un vistazo**
Como estudiante, quiero que los días del mes se vean completos y separados, para
ubicar una fecha sin adivinar.

**HU-3 — Ver y editar anotaciones**
Como estudiante, quiero llegar a la anotación de un día y editarla, sin importar
en qué pantalla esté.

**HU-4 — No ver controles inútiles**
Como estudiante, quiero que la vista del mapa no me muestre campos de mes y año,
para no pensar que puedo navegar por mes un mapa que no funciona por mes.

**HU-5 — Conservar el mapa de calor**
Como estudiante, quiero que el mapa de calor siga mostrando sus cuatro semanas,
sus seis niveles y sus minutos al pasar el cursor, para no perder lo que ya
funciona.

**HU-6 — No perder nada**
Como estudiante, quiero que mis anotaciones, documentos e historial de estudio
sigan exactamente como estaban, para que un arreglo de pantalla no me cueste nada.

---

## Requisitos funcionales

### RF-1 — Panel contenedor del modal

El modal del calendario debe estar contenido dentro de un panel visual único, con
fondo propio, borde, esquinas redondeadas y sombra.

**Criterios de aceptación**

- Cuando el usuario abre el calendario, entonces la navegación, el contenido y la
  leyenda se ven **dentro de un mismo panel** con fondo, borde y esquinas
  redondeadas.
- El panel no se dibuja repetido ni superpuesto al contenido.
- El panel mantiene la misma identidad visual en las dos vistas.

---

### RF-2 — Límites de tamaño del panel

El panel no puede ocupar más del espacio disponible en ninguna dirección.

**Criterios de aceptación**

- El panel tiene un ancho máximo y **nunca supera el 90 % del alto de la ventana**.
- Cuando el contenido del panel es más alto que ese límite, entonces el contenido
  se lee con desplazamiento **vertical** dentro del panel.
- El panel nunca provoca desplazamiento horizontal de la página.

---

### RF-3 — Distribución en dos columnas cuando hay ancho

Cuando hay ancho suficiente, el calendario mensual y el panel de anotaciones se
muestran uno al lado del otro.

**Criterios de aceptación**

- Con espacio suficiente, la rejilla de días ocupa el ancho disponible y el panel
  de anotaciones queda a su costado.
- Los siete días de la semana y todos los días del mes se ven completos.
- El botón de cerrar queda accesible desde el panel de anotaciones.

---

### RF-4 — Distribución en una columna cuando no hay ancho

Cuando no hay ancho suficiente, el panel de anotaciones se ubica debajo de la
rejilla de días.

**Criterios de aceptación**

- Con espacio reducido, el panel de anotaciones queda **debajo** de la rejilla, no
  al costado.
- El conjunto se lee con desplazamiento vertical, nunca horizontal.
- Ninguna de las dos partes pierde contenido.
- **El desplazamiento vertical vive en un solo lugar.** En una sola columna no puede haber dos zonas que se deslicen por separado dentro de una caja que recorta: el desplazamiento se corre al conjunto y las partes dejan de desplazarse por su cuenta.

---

### RF-5 — El chrome corresponde a la vista activa

Los elementos que no son parte de la vista activa no se muestran.

**Criterios de aceptación**

- En la vista del mapa de calor, los campos de mes y año **no se muestran**, porque
  el mapa representa las últimas cuatro semanas y no se navega por mes.
- En la vista del mapa de calor, la leyenda de tipos de anotación **no se
  muestra**, porque no hay anotaciones en esa vista.
- En la vista del calendario mensual, la navegación de mes y año y la leyenda **sí
  se muestran**.
- El botón de alternar y el botón de cerrar se muestran en **ambas** vistas.

---

### RF-6 — Alternancia intacta

El botón que alterna entre las dos vistas sigue funcionando en cualquier tamaño de
pantalla.

**Criterios de aceptación**

- El usuario alterna entre calendario mensual y mapa de calor tantas veces como
  quiera, en cualquier ancho.
- El botón identifica siempre la vista a la que se va a pasar, no a la que se
  está.
- Al alternar, la vista queda activa completa: no quedan partes de la vista
  anterior ni partes faltantes de la nueva.

---

### RF-7 — El mapa de calor no se altera

Esta especificación no modifica el comportamiento del mapa de calor.

**Criterios de aceptación**

- El mapa sigue mostrando cuatro semanas, de siete columnas cada una.
- Los seis niveles de intensidad, el color y el marcador de tamaño se mantienen.
- Los minutos al pasar el cursor se siguen mostrando.
- Los días sin estudio y los días futuros siguen sin relleno.

---

### RF-8 — Las anotaciones no se alteran

Esta especificación no modifica el comportamiento de las anotaciones.

**Criterios de aceptación**

- El usuario sigue pudiendo agregar, ver y eliminar anotaciones.
- El máximo de anotaciones por día se mantiene.
- Los colores por tipo de anotación se mantienen.
- Un día con estudio y sin anotaciones se sigue distinguiendo de uno sin ninguno
  de los dos.

---

### RF-9 — Ningún contenido recortado

Ningún elemento visible puede mostrar menos espacio del que su contenido necesita.

**Criterios de aceptación**

- Entre 375 y 1920 px de ancho, ningún elemento visible queda con su
  contenido cortado.
- Ningún elemento visible sobresale de la ventana por ninguno de sus lados.
- La página nunca genera desplazamiento horizontal.

---

## Requisitos no funcionales

| ID | Requisito | Verificación |
|----|-----------|--------------|
| RNF-1 | El modal es utilizable entre 375 y 1920 px de ancho sin scroll horizontal. | Medición de anchos reales en cuatro viewports |
| RNF-2 | Ningún elemento visible pierde contenido. | Medición de contenido requerido contra contenido disponible |
| RNF-3 | La decisión de qué elementos se muestran es comprobable sin abrir un navegador. | Verificación con el runner nativo de Node |
| RNF-4 | La geometría y el cálculo de tamaños no se calculan desde el código de la página. | Revisión de que las medidas viven en las hojas de estilo |
| RNF-5 | El sistema no introduce dependencias nuevas. | Verificación de que no existen `package.json` ni `node_modules` |
| RNF-6 | Ningún dato del usuario se lee, escribe, migra ni transforma. | Revisión de que no se toca el almacenamiento |
| RNF-7 | El mapa de calor sigue dibujándose en menos de 1 segundo con un año de datos. | Medición con el conjunto de datos de prueba existente |
| RNF-8 | Todo texto visible para el usuario está en español. | Revisión de la interfaz |

---

## Casos límite

| Caso | Comportamiento esperado |
|------|-------------------------|
| La ventana mide exactamente el umbral que separa una distribución de la otra | El contenido no se recorta en ninguna de las dos distribuciones |
| La ventana mide 375 px, el mínimo soportado | La rejilla y el panel se leen completos, con desplazamiento vertical y nunca horizontal |
| La ventana mide menos de 375 px | El contenido se sigue desplazando en vertical y no aparece scroll horizontal, aunque las celdas del mes queden mas pequenas y el panel quede por debajo |
| El usuario tiene anotaciones en varios días del mes | Cada día muestra su color y el panel de anotaciones sigue mostrando la del día elegido |
| El usuario alterna de vista muchas veces seguidas | La vista queda siempre completa y coherente con su botón |
| El usuario pasa de pantalla angosta a ancha con el calendario abierto | La distribución se recalcula al cambiar el tamaño, sin recargar |
| El mes tiene 28, 29, 30 o 31 días | La rejilla muestra exactamente los días del mes, sin celdas de más |
| El usuario cierra el modal con la tecla Escape | El modal se cierra igual que antes |
| El usuario abre el calendario y no tiene ningún día con estudio | El mapa se dibuja vacío, sin celdas de color |
| El mapa se muestra en pantalla angosta | Sigue mostrando sus cuatro semanas completas, no una versión recortada |

---

## Fuera de alcance

Esta especificación **no** incluye:

- Rediseñar el aspecto visual del calendario, del panel de anotaciones o del mapa.
- Cambiar los colores, las tipografías, las sombras o el espaciado.
- Mover la ventana de cuatro semanas del mapa con los campos de mes y año.
- Convertir el modal en una pantalla completa o en una hoja deslizante.
- Agregar indicadores de cantidad de anotaciones por día.
- Reordenar la navegación del modal.
- Cualquier funcionalidad nueva de estudio, más allá de presentar bien las existentes.
- Dar una clase propia a las muestras de la leyenda del mapa. Hoy comparten clase con las celdas reales, y eso hace que un selector cuente 34 elementos en vez de 28. Es higiene de seleccion, no un defecto visible, y esta especificacion no lo toma.

---

## Criterios de finalización

La funcionalidad se considera finalizada cuando:

1. Todos los requisitos funcionales (**RF-1** a **RF-9**) cumplen sus criterios de aceptación.
2. Todos los requisitos no funcionales (**RNF-1** a **RNF-8**) están verificados.
3. Todos los casos límite de la sección *Casos límite* se prueban a lo ancho
   mínimo, en un ancho intermedio y en el ancho máximo.
4. El sistema no introduce errores en la consola durante el uso normal.
5. Las funcionalidades existentes siguen funcionando sin regresiones: calendario
   mensual, anotaciones, mapa de calor y Pomodoro.
6. La afirmación *"responsive tipo iPhone"* de la documentación del proyecto es
   cierta, o se corrite.

---

## Nota sobre la documentación del proyecto

`AGENTS.md` describe el calendario como *"responsive tipo iPhone"*. Con esta
especificación implementada la afirmación pasa a ser cierta y se conserva. Si
las tareas se abandonan, esa línea debe corregirse, porque el Principio 2 exige
que la documentación diga la verdad.
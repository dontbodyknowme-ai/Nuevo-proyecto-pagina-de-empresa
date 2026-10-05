# Cierre de la especificación: Almacenamiento real

**ID:** 007-almacenamiento-real
**Especificación relacionada:** [`spec.md`](spec.md)
**Constitución:** [`../../docs/constitucion.md`](../../docs/constitucion.md)
**Estado:** Abortada — el trabajo se reparte en la 008
**Fecha de cierre:** 2026-10-04

---

## Propósito de este documento

La spec 007 está completa y escrita con mucho detalle, pero **no se va a implementar como
está**. Este documento existe para que no se pierda el análisis y, sobre todo, para que
**el motivo del aborto quede escrito**: sin esto, en unos meses alguien la encuentra, ve
que está bien redactada, y la implementa —con los mismos cuatro agujeros que tiene hoy.

La 007 mezclaba **cuatro problemas distintos**, con riesgos distintos, en una sola decisión
de aprobación. La 008 se queda con el único que el usuario pidió: más almacenamiento.

---

## Los cuatro hallazgos que la hacen ir

Los encontró el `reviewer` en la fase de clarificación, y son de la clase que no se
arreglan escribiendo más texto: son del diseño.

**1. Rompe la promesa que la spec misma se pone.** Su regla de oro (línea 155) es que la
única operación que puede hacer perder datos es importar un respaldo. El hallazgo #1 crea
una segunda: se migra, se entra en modo normal, el almacén nuevo deja de estar disponible,
se escribe en el viejo, y al volver **no se vuelve a migrar** porque la marca de migración
terminada sigue puesta. Lo escrito en modo limitado queda donde nadie lo vuelve a leer.

**2. El riesgo está al revés que el beneficio.** Se gana espacio para archivos más grandes;
se arriesga perder, sin vuelta, el historial de estudio. La constitución (Principio 5) ya
eligió qué no se sacrifica en este proyecto, y no es el dato del usuario.

**3. El beneficio visible depende de una medición que nunca se hizo.** HU-1 promete abrir
PDF sin internet, y eso depende de que el respaldo automático del visor funcione bajo
`file://`. La spec lo admite sin medirlo; el reviewer tampoco lo pudo confirmar.

**4. Cambia la red de seguridad en el mismo cambio que la valida.** Las sondas siembran
con `localStorage.setItem('cuadernoVirtual', …)` (`herramientas/capturar-arbol.js:232` y
`herramientas/verificar-layout.js:386`). Con los datos en el almacén nuevo, esas dos
siembran donde la app ya no lee: miden una app vacía, y "el árbol da IDÉNTICO" se cumpliría
de mentira. La 007 además afirma (RF-1) que hay que tocar **una sola** herramienta: esas
dos no aparecen en ningún requisito, y de ellas dependen dos criterios de finalización.

---

## Lo que se reparte

| Lo que estaba en la 007 | Dónde va |
|---|---|
| IndexedDB, migración, y el arreglo de las escrituras sin protección | **008**, como único objetivo |
| Exportar no incluye los minutos ni el calendario (Defecto 4) | **008**: es el callejón de salida y sale por cuatro campos |
| `vendor/`, fuentes self-hosteadas y sus licencias (RF-1) | Fuera. **No da ni un KB de almacenamiento**: son archivos en disco, no cuota del navegador |
| Coordinación de dos pestañas (caso límite) | Fuera. El almacén por registro ya reduce una colisión a *un* registro, no a todo el cuaderno |
| Copia automática cada 7 días (RF-5) | Fuera. La 008 arregla exportar, que es el 80 % del valor por el 5 % del código |
| Actualizar la constitución (tabla del final) | La 008 actualiza solo lo que le corresponda |

Medición que motivó la decisión de sacar `vendor/`: Google Fonts sirve hoy **51 archivos
`.woff2`** para esas dos familias (no 9: son 9 combinaciones de peso × 7 subconjuntos de
idioma). Latin + latin-ext son 18 archivos y 884 KB. **Ninguno de esos KB sale de la cuota
del navegador**, porque son archivos que se cargan por `file://`.

---

## Lo que sí queda bueno, y no hay que perder

Aunque no se implemente, esta spec contiene análisis que costó trabajo y que sirve:

- **El inventario de los cuatro caminos de escritura.** Hoy hay cuatro datos guardados y
  cuatro caminos distintos, y uno —las anotaciones del calendario— **no tiene ninguna
  protección**. Eso es un defecto real, existe hoy, y no tiene nada que ver con IndexedDB.
- **La honestidad sobre lo que la app no puede saber**: que no puede confirmar dónde quedó
  una copia ni si la descarga ocurrió, y que el respaldo del visor bajo `file://` no está
  medido.
- **La decisión sobre `vendor/`**, con su motivo: que no puede ir debajo de `js/` porque
  `test/dom-falso.js` carga en Node todo lo que matchea rutas de `js/`.

---

## Lo que hay que hacer igual, aunque la 007 muera

Dos cosas de acá no dependían de la spec y quedan pendientes igual:

1. **El primer commit con `.gitignore`.** El repositorio sigue **sin un solo commit**, y
   esta sesión modificó archivos de configuración. No tiene nada que ver con el
   almacenamiento: es no perder el trabajo.
2. **La anotación del calendario que no se guarda sin avisar** (`js/app.js:1582`, sin
   `try/catch`). Es pérdida silenciosa que existe hoy. Entra en la 008 porque toca las
   mismas escrituras, pero no depende de nada de esto para arreglarse.
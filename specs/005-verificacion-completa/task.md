# Tareas: Cerrar la verificación

**Especificación:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)

## Por qué el orden es este

T1 antes que T2 porque sin la lista de excepciones el control sigue dando 1, y
no hay forma de distinguir "rojo porque hay algo pendiente" de "rojo porque
siempre". Un control que siempre falla no se puede probar.

T3 al final porque un paso de verificación solo se documenta cuando existe, y
la deuda se corrige cuando ya se sabe que el control anda.

---

## T1 — Excepciones conocidas y separación en el informe

**Estado:** Completada — 2026-10-02
**RF que cubre:** RF-1, RF-2
**Riesgo:** Bajo — no toca código de la app

### Qué hace

Agregar a `herramientas/buscar-codigo-muerto.js` una lista de excepciones
conocidas, con el motivo de cada una escrito en la misma línea. La herramienta
las separa del resto en el informe y solo cuenta para el código de salida lo que
**no** es excepción.

Las cuatro que van, y de dónde sale cada motivo:

| Símbolo | Motivo |
|---------|--------|
| `registrarConsentimiento` | RF-12 está en alcance pero sin conectar |
| `tieneConsentimiento` | RF-12 está en alcance pero sin conectar |
| `revocarConsentimiento` | RF-12 está en alcance pero sin conectar |
| `existeFecha` | Regla de fechas correcta; borrarla costaría 18 tests para sacar algo que el calendario podría necesitar |

La lista se arma con lo que **la herramienta reportó**, no de memoria. Si un
símbolo no estaba en el informe, no entra: una excepción para algo que no está
tapando nada solo esconde el error de haberla agregado.

Además, el informe tiene que decir que la categoría E —"exportadas para poder
probar"— **no cuenta** para el código de salida. Hoy `total` ya la excluye; lo
que falta es que el lector lo entienda sin abrir el archivo.

### Casos a probar

| Caso | Resultado esperado |
|------|--------------------|
| Solo quedan las cuatro excepciones | Salida **0** |
| Una excepción nueva que no está en el informe | Se cuenta como pendiente, salida **1** |
| El informe lista las excepciones con su motivo | Se ven las cuatro y por qué |
| El informe dice que E no cuenta | Queda escrito |

### Cómo se verifica

```
node herramientas/buscar-codigo-muerto.js
# → "Salida 0"
# → el total a limpiar pasa de 4 a 0
# → las cuatro excepciones aparecen con su motivo
```

---

## T2 — Probar que la red funciona

**Estado:** Completada — 2026-10-02
**RF que cubre:** RF-3
**Riesgo:** Bajo — la prueba modifica archivos y los restaura

### Qué hace

Probar las dos formas en que esta red puede mentir, y las dos tienen que
fallar.

La primera: **inyectar código muerto de mentira.** Se agrega una función sin
uso a un módulo que sí se carga, se corre la herramienta, tiene que dar salida
1 y nombrarla. Después se saca.

La segunda: **desviar una excepción de la lista.** Si `tieneConsentimiento`
está en la lista y la herramienta no lo reporta en el informe, tiene que
avisar que la excepción sobró. Eso es lo que mantiene la lista honesta.

Ninguna de las dos se puede simular: las dos necesitan cambiar el archivo.

### Casos a probar

| Caso | Resultado esperado |
|------|--------------------|
| Función muerta inyectada | Salida **1**, y la nombra |
| Se saca la inyección | Vuelve a salida **0** |
| Excepción quitada de la lista sin tocar el código | Avisa que **sobró** |
| Se restaura la lista | Silencio otra vez |

### Cómo se verifica

Cuatro corridas de la herramienta, dos con cambios y dos después de
restaurarlos. Si alguna deja el proyecto modificado, la prueba está mal: el
archivo tiene que quedar exactamente como estaba.

---

## T3 — Documentar el paso y corregir la deuda

**Estado:** Completada — 2026-10-02
**RF que cubre:** RF-4, RNF-3
**Riesgo:** Bajo — solo documentos

### Qué hace

Dos cosas, en dos archivos cada una.

**El paso de verificación.** Agregar a la sección Verificación de `AGENTS.md` el
comando de la herramienta, con la nota de que las excepciones están en el
propio archivo y no en el documento, para que nadie las borre sin verlas.

**La deuda de la lista de días.** Dice *"existe tres veces"* y nombra tres
archivos. Son dos: T6 borró el de `fechas.js`. Corregir en los dos archivos
donde aparece: `AGENTS.md` y `specs/004-.../task.md`.

La entrada corregida tiene que decir **dos** y nombrar los dos archivos que de
verdad la tienen. Y conviene que diga que unifyinglas **no** es un arreglo
chico: toca `js/app.js` y un dibujo que hoy anda.

### Casos a probar

| Caso | Resultado esperado |
|------|--------------------|
| El paso está en la sección de Verificación | Con su comando y su salida esperada |
| La deuda dice "dos" | En `AGENTS.md` |
| La deuda dice "dos" | En `task.md` |
| Los dos archivos nombrados son los que tienen la lista | `js/app.js` y `js/logica/mapa-calor.js` |
| Queda escrito que unificarlas es otra cosa | No se promete un arreglo que no es |

### Cómo se verifica

Los dos archivos se leen y se busca "tres" y "fechas.js" en la entrada de la
deuda. Después, las puertas de siempre: `node --test`,
`comparar-arbol.js`, `buscar-caracteres-raros.js`, y que no haya `package.json`.

**`verificar-layout.js` no se corre en esta tarea.** No se toca CSS ni el DOM,
así que el layout no puede cambiar. Tarda más de diez minutos y no hay nada que
pueda detectar.

---

## Hallazgos que las tareas pueden revelar

Se anotan mientras se hacen, no después.

| Tarea | Hallazgo | Qué se hizo |
|-------|----------|-------------|
| T1 | El informe mezclaba en el mismo tono cuatro cosas que no son lo mismo | La E ahora dice **que no cuenta** para la salida, y las excepciones salen con su motivo al lado |
| T1 | Las categorías A, B y C también tenían que marcar las excepciones, no solo la E | Se agrega `[excepción: no borrar]` y el motivo en cada una |
| T2 | **La segunda prueba no probaba lo que decía probar.** Sacar una excepción de la lista no activa el aviso de "excepción vieja": activa otra cosa, que es que el símbolo pasa a ser pendiente | Se agrega una tercera prueba, que sí activa el aviso. Las tres de verdad, en `task.md` |
| T3 | La deuda de la lista de días estaba en **un** archivo, no en dos | `AGENTS.md` nunca la tuvo: estaba en `task.md` de la 004. Se corrige ahí y se agrega a `AGENTS.md`, que es donde vive la deuda conocida |

---

## Decisiones del usuario, ya tomadas

| Decisión | Respuesta |
|----------|-----------|
| ¿Las tres piezas o dos? | **Las tres.** Se escribe también el `plan.md` |
| ¿Dónde viven las excepciones? | En la herramienta, no en `AGENTS.md`. DD-1 |
| ¿Se reorganizan los pasos de verificación? | No. Se agrega uno. DD-3 |

---

## Lo que esta especificación NO resuelve

| Pendiente | Por qué queda |
|-----------|---------------|
| Unificar las dos listas de días de la semana | Toca `js/app.js` y un dibujo que hoy anda. Mover código entre archivos necesita la fuente de línea base para demostrar que no cambió nada. Spec aparte |
| El aviso que dice "casi lleno (0 % de 95 %)" | El 0 % es real, pero junto a "casi lleno" se lee mal. Es una decisión sobre qué texto conviene |

---

## Las tres decisiones que dejó 004, resueltas el 2026-10-02

Se anotan acá aunque no fueran parte de esta spec, porque se declararon
en este archivo y habrían quedado pendientes un rato más.

| Decisión | Respuesta | Dónde quedó escrita |
|----------|-----------|---------------------|
| ¿El mapa muestra la sesión de Pomodoro en curso? | **No.** La sección abierta no se cuenta hasta que se cierra | **CP-1 de la spec 001**, en `resolucion-cp.md`. La decisión de por qué está junto al código, en `minutosDeEstudioPorDia()` |
| ¿El umbral bloquea o solo avisa? | **Bloquea.** El código estaba bien; la tabla de RF-4 estaba mal | La tabla de RF-4 corregida, con la cita de RF-11 de la spec 001 al lado |
| ¿Cuándo se conecta RF-12? | **No se conecta.** Sale del alcance de esta versión | La nota en *Fuera de alcance* de la spec 001, con el motivo |

Tres correcciones de documentación. **Cero líneas de `js/` cambiaron de
comportamiento**: la sesión abierta ya no se contaba, el umbral ya bloqueaba, y
RF-12 ya no estaba conectado. Lo que cambió es que las tres decisiones están
**escritas y con motivo**, en vez de ser algo que alguien tiene que deducir
del código.

Lo que encontró el proceso: las tres no eran realmente las que parecían.

- La del mapa **ya tenía un caso pendiente propio** —CP-1 en la spec 001— que
  llevaba tiempo esperando y nunca se retomó. No era una decisión nueva: era
  una vieja sin cerrar.
- La del umbral no era un conflicto entre código y spec. El código hacía bien lo
  que dice la spec 001. **Lo mal escrito era una tabla de la spec 004**,
  escrita sin releer la original. Dos specs del mismo proyecto diciéndose cosas
  distintas.
- RF-12 no era "un interruptor que hay que prender": sin identidades, en un
  cuaderno local no hay cuaderno "ajeno", y no hay nada que proteger.

---

## Resultado

| | Antes | Después |
|---|---|---|
| El control de código muerto se podía correr | **No.** Salía 1 siempre | **Sí.** Sale 0 |
| Distingue pendiente de excepción | No | Sí, y con el motivo al lado |
| Está en los pasos de verificación | No | **Sí**, el paso 4.seis |
| Avisa si una excepción quedó vieja | No | **Sí**, solo |
| La deuda de la lista de días | Decía tres | Dice **dos**, con los dos archivos |
| Tests | 328 | **328** (no cambió código de la app) |

### Las tres pruebas de T2

| Prueba | Resultado |
|--------|-----------|
| Inyectar `funcionMuertaInventada` en `fechas.js` | Salida **1**, la nombró |
| Sacar la inyección | Volvió a **0** |
| Sacar `existeFecha` de la lista de excepciones | Pasó a ser pendiente, salida **1** |
| Meter una excepción que no estaba (`estaAbierta`) | **Avizó que ya no aplica** |

La tercera y la cuarta son las que importan: las dos que prueban el mecanismo
de "excepción vieja", que es el que hace que la lista se mantenga sola.

### Verificación

- `node --test` → **328 pasan, 0 fallan**
- `node --test test/navegador.test.js` → 26 pasan
- `node herramientas/buscar-codigo-muerto.js` → **salida 0**
- `node herramientas/comparar-arbol.js` → salida 0
- `node herramientas/buscar-caracteres-raros.js` → salida 0
- Sin `package.json` ni `node_modules`
- `node --check` en los 16 módulos

**`verificar-layout.js` no se corrió, a propósito.** Esta tarea no toca CSS ni
el DOM: no hay forma de que el layout cambie. Tarda más de diez minutos y no
tiene nada que detectar. Es la primera vez en el proyecto que un paso de
verificación se omite a propósito, y queda escrito acá para que no parezca un
olvido.

### La trampa de este trabajo

El control estaba escrito, probado y guardado, y **nadie lo corría**. Es la
misma razón por la que T5 arregló el número de scripts: un control que no se
corre no controla nada, y uno que siempre sale en rojo tampoco.

Lo segundo pesa más de lo que parece. Un paso que se sabe que falla **entrena
al que lee a ignorar el rojo**. La primera vez que dé rojo de verdad —que es la
única que importa— nadie lo va a mirar. Por eso el arreglo no fue "borrar las
cuatro cosas reportadas": fueron decisiones, y borrar decisiones porque molestan
en un informe es la forma más rápida de perder el criterio.
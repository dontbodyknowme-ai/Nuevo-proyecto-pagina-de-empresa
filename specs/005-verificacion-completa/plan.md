# Plan de implementación: Cerrar la verificación

## 0. Decisiones que este plan propone

### DD-1 — Las excepciones viven en la herramienta, no en un documento

La lista de excepciones podría ir en `AGENTS.md`, junto a los demás pasos de
verificación, que es donde alguien la va a buscar. Va en
`herramientas/buscar-codigo-muerto.js`, por dos razones.

La primera es la que importa: **una excepción sin el motivo al lado se borra**.
Hoy están los símbolos; dentro de seis meses va a quedar la lista y nadie
recordará por qué se conservaron, y la razón correcta es la que hace falta para
decidir si se conservan o no.

La segunda: si la lista vive en el archivo, no puede desincronizarse de lo que
la herramienta reporta. Vive en el documento, y el documento no lo lee nadie
cuando escribe código.

### DD-2 — La herramienta avisa cuando una excepción sobra

Si un símbolo de la lista deja de estar muerto —porque se conectó— la
herramienta dice que esa excepción ya no está justificada.

Una lista de excepciones que se pudre en silencio es **peor que no tener
lista**: silencia la señal justo cuando deja de servir. El día que se conecte
RF-12, `tieneConsentimiento` va a dejar de aparecer en el informe, y sin este
aviso la lista se va llenando de cosas justificadas hasta no significar nada.

Esto convierte la lista en algo que se mantiene solo: cuando RF-12 se conecte,
la excepción avisa que sobró y se saca. No hace falta acordarse.

### DD-3 — Se agrega un paso de verificación, no se reorganizan

`AGENTS.md` tiene siete pasos numerados que funcionan. Agregar el nuevo como
paso 4 y renumerar el resto produce un diff grande en un documento que se lee
todos los días, y no aporta nada.

El número se corre porque el criterio es "corré estos comandos", no "el cuarto
de la lista". Si/molestara, el paso nuevo va al final.

### DD-4 — La salida separa las categorías que merecen decisiones distintas

Hoy la herramienta mezcla en el mismo tono cuatro cosas que no son la misma
cosa:

| Categoría | Qué es | Qué hay que hacer |
|-----------|--------|-------------------|
| **A · B · C** | Código muerto de verdad | Borrarlo |
| **D** | Export que sobra | Sacar la línea del `API` |
| **E** | Exportado para poder probar | No es un problema |

La E no es un problema: es la puerta de entrada de los tests, y quitarla sería
desarmar la suite. Sigue saliendo en el informe, pero **sabiendo que no cuenta**
para el código de salida. Hoy `total` ya la excluye; lo que falta es que el
lector lo entienda sin leer el código de la herramienta.

### DD-5 — El motivo de cada excepción es obligatorio

Una excepción sin motivo es código muerto con una nota al margen. El formato
deliberadamente no admite entradas sin razón: la razón va en la misma línea,
de modo que Agregar una excepción sin explicar es más incómodo que no
agregarla.

## 1. Archivos que se crean

Ninguno. Esta tarea no agrega archivos.

## 2. Archivos que se modifican

| Archivo | Qué cambia |
|---------|-----------|
| `herramientas/buscar-codigo-muerto.js` | La lista de excepciones con su motivo, la separación en el informe, y el aviso de excepción vieja |
| `AGENTS.md` | El paso nuevo de verificación, y la deuda de la lista de días |
| `specs/004-app-funcional-y-limpeza/task.md` | La misma deuda, en "Lo que esta especificación NO resolvió" |
| `MEMORY.md` | Una lección |

## 3. Archivos que NO se tocan

| | Por qué |
|---|---|
| `js/` entero | RNF-1. Esta tarea no cambia comportamiento de la app |
| `css/`, `index.html` | Ídem |
| `test/` | RNF-2. No hay nada que probar: no cambia código de la app |
| `specs/004-.../spec.md` | Ya está cerrada. La deuda se corrige donde está escrita, que es `task.md` |

## 4. Orden de ejecución

```
T1  Excepciones y separación en el informe   → la herramienta da 0
T2  Probar la red: inyectar y desviar        → da 1, y avisa lo que sobra
T3  Documentar el paso y corregir la deuda    → los dos archivos dicen la verdad
```

T1 antes que T2 porque sin la lista el control sigue dando 1 y no hay forma de
distinguir "rojo porque hay algo pendiente" de "rojo porque siempre".

T3 al final porque el paso de verificación solo se documenta cuando existe, y
la deuda se corrige cuando ya se sabe que el control anda.

## 5. Verificación

### Lógica pura (Principio 4, camino 1)

La suite no cambia: 328 antes y 328 después. No hay código de la app que haya
cambiado, así que no hay tests nuevos. **Un test que no agrega valor es ruido.**

```
node --test                    # → 328 pasan, 0 fallan
node --test test/navegador.test.js   # → 26 pasan
```

### La herramienta (el camino de esta tarea)

```
node herramientas/buscar-codigo-muerto.js
# → Salida 0, con las cuatro excepciones listadas y el motivo de cada una
```

Y las dos pruebas que hay que hacer a mano, porque una red que nunca falló no
prueba nada:

| Prueba | Lo que tiene que pasar |
|--------|------------------------|
| Inyectar una función muerta nueva | Salida **1**, y la nombra |
| Sacar una excepción de la lista | Avisa que **sobró** esa excepción |

La segunda es la que no se puede simular: necesita que la lista cambie, y
cambiarla es parte de la prueba.

### Siempre

```
node herramientas/comparar-arbol.js       # → salida 0
node herramientas/buscar-caracteres-raros.js  # → salida 0
Test-Path package.json                    # → False
```

`verificar-layout.js` **no se corre**: esta tarea no toca CSS ni el DOM, así
que el layout no puede cambiar. Tarda más de diez minutos y no hay nada que
pueda detectar. Esa omisión es deliberada y está anotada en `task.md`.

### Interfaz (Principio 4, camino 2)

No se abre Chrome. No hay cambio de interfaz.

## 6. Riesgos

| Riesgo | Cómo se evita |
|--------|---------------|
| **Meter un símbolo equivocado en las excepciones** y tapar código muerto de verdad | La lista se arma con lo que **la herramienta reportó**, no de memoria. T2 lo comprueba inyectando uno y exigiendo salida 1 |
| Que el paso nuevo canse desde el primer día | Por eso T1 va primero. El paso se documenta en T3, cuando la herramienta ya da 0 |
| Que la lista de excepciones crezca sin control | DD-2: la herramienta avisa cuando una sobra |
| Que la corrección de la deuda sea a medias | T3 exige las **dos** menciones, y las dos están en archivos distintos |

## 7. Lo que este plan deja escrito

- Una lista de excepciones **con motivo y en el código**, no en un documento.
- Un control que se autoverifica: avisa cuando deja de necesitar una excepción.
- Un paso de verificación más, y la deuda corregida donde estaba escrita.

Y deja **sin** resolver, porque son de otra naturaleza:

- Las dos listas de días de la semana que quedan, que necesitan mover código
  entre archivos.
- Las tres decisiones de comportamiento que dejó 004.
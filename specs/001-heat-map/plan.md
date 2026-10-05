# Plan de implementación: Mapa de calor de estudio

**ID:** 001-heat-map
**Basado en:** [`spec.md`](spec.md) v2.1 y [`../../docs/constitucion.md`](../../docs/constitucion.md)
**Estado:** Planificado — requiere aprobación
**Versión:** 1.0

---

## 0. Decisiones que este plan propone validar

### DD-1 — Tests con `node --test` vs. Principio 4

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | Usar el runner nativo de Node para las funciones puras de lógica |
| **Justificación** | `node --test` viene incluido en Node 24. No requiere `npm install`, no genera `package.json` ni `node_modules`. No viola el Principio 1 |
| **Conflicto** | El Principio 4 dice textualmente *"Sin framework de tests"*. Node no es un framework externo, pero la verificación manual deja de ser la única vía |
| **Alternativa descartada** | Mantener verificación 100 % manual con `chrome-devtools`. Se descartó porque los cálculos de minutos, umbrales y consolidados tienen demasiados casos límite (14 en la spec) para verificarlos a ojo sin errores |
| **Validación necesaria** | Actualizar el Principio 4 para dejar explícito que existen dos vías: lógica pura con Node, interfaz con `chrome-devtools` |

### DD-2 — Separación física de la lógica nueva

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | Los cálculos van en archivos propios bajo `js/logica/`, fuera de `app.js` |
| **Justificación** | El Principio 3 exige separar lógica de DOM y hoy `app.js` tiene 1119 líneas que ya lo incumplen. Agregar más cálculo ahí empeora una deuda que la spec pide no agrandar (RNF-7) |
| **Alternativa descartada** | Agregar las funciones a `app.js`. Se descartó porque contradice RNF-7 y aumenta la carga cognitiva de quien está aprendiendo |

### DD-3 — Formato de fecha único

| Aspecto | Detalle |
|---------|---------|
| **Decisión propuesta** | Toda fecha del mapa usa `DD/MM/AAAA` como clave, y las conversiones a ISO quedan encapsuladas en una sola función |
| **Justificación** | El calendario actual mezcla ISO y `DD/MM/AAAA` y por eso nunca marca un día como estudio (hallazgo A). El mapa no puede repetir ese error |
| **Alternativa descartada** | Usar ISO como clave. Se descartó porque la spec muestra fechas en `DD/MM/AAAA` al usuario y obliga a convertir en cada lectura |

---

## 1. Archivos: se crean

| Archivo | Responsabilidad | RF que cubre |
|---------|-----------------|---------------|
| `js/logica/mapa-calor.js` | Funciones puras. Calcula períodos, niveles, consolida secciones y arma la grilla. **No toca el DOM ni el almacenamiento** | RF-1 a RF-9, RF-14 |
| `js/logica/almacenamiento.js` | Funciones puras de capacidad. Decide si una escritura es segura según el uso estimado. **No escribe nada** | RF-11 |
| `js/logica/consentimiento.js` | Función pura que verifica si un cuaderno ajeno tiene consentimiento registrado | RF-12 |
| `js/datos/secciones.js` | Estado de la sección abierta. Acumula milisegundos, decide cuándo una sección se cierra y persiste al almacenamiento | RF-1, RF-2, RF-13 |
| `js/interfaz/mapa-calor.js` | Dibuja la grilla. Construye elementos, aplica clases, conecta eventos de cursor. **No calcula nada** | RF-5 a RF-8, RF-14 |
| `js/inicio-calendario.js` | Punto de entrada. Conecta la lógica con la interfaz y con las funciones ya existentes del proyecto | RF-7, RF-10, RF-11 |
| `test/mapa-calor.test.js` | Verificación de la lógica pura con el runner nativo de Node | RF-1 a RF-5, RF-9, RF-14 |
| `test/secciones.test.js` | Verificación del cálculo de secciones y minutos | RF-1, RF-2, RF-3, RF-13 |
| `test/almacenamiento.test.js` | Verificación de la prevención por capacidad | RF-11 |
| `test/consentimiento.test.js` | Verificación del consentimiento | RF-12 |

---

## 2. Archivos: se modifican

| Archivo | Cambio | RF que cubre |
|---------|--------|---------------|
| `index.html` | Agregar botón de alternancia, contenedor del mapa y leyenda. Agregar los scripts nuevos | RF-5, RF-7, RF-14 |
| `css/styles.css` | Agregar estilos de la grilla, los seis niveles de verde, los marcadores por nivel y el comportamiento responsive | RF-4, RF-5, RF-14 |
| `js/app.js` | Reemplazar `guardarSesionPomodoro()` por la versión en secciones. Exponer un gancho para el aviso de capacidad | RF-1, RF-2, RF-10, RF-11 |
| `AGENTS.md` | Documentar los archivos nuevos | Principio 2 |
| `MEMORY.md` | Registrar la funcionalidad operativa | Principio 2 |
| `docs/constitucion.md` | Aclarar el Principio 4 sobre las dos vías de verificación | DD-1 |

---

## 3. Funciones puras de lógica

Todas reciben `hoy` como parámetro. Ninguna lee el reloj del sistema, el almacenamiento ni el DOM. Esa es la condición para poder verificarlas con Node.

### 3.1 `js/logica/mapa-calor.js`

| Función | Qué hace | RF |
|---------|----------|-----|
| `aFechaClave(fecha)` | Convierte cualquier fecha a clave `DD/MM/AAAA`. Única puerta de entrada al formato | RF-3 |
| `aIso(fecha)` | Convierte a ISO. Puerta de salida. Nunca se usa como clave de comparación | RF-3 |
| `minutosDe(duracionMilisegundos)` | Separa minutos completos de remanente. Devuelve `{ minutos, remanenteMilisegundos }` | RF-2 |
| `nivelDe(minutos)` | Devuelve `0` a `5` según los umbrales fijos | RF-4 |
| `clasificarDia(fechaClave, hoyClave)` | Devuelve `"futuro"`, `"hoy"` o `"pasado"` | RF-5 |
| `periodoDe(hoyClave)` | Devuelve las 28 claves de las últimas 4 semanas, ordenadas | RF-9 |
| `diasDeSemana()` | Devuelve los siete encabezados, empezando por lunes | RF-9 |
| `consolidar(secciones)` | Toma una lista de secciones y devuelve `{ "DD/MM/AAAA": minutos }`, sumando todas las que pertenecen a ese día | RF-1, RF-3 |
| `construirGrilla(hoyClave)` | Devuelve 4 filas de 7 columnas, cada celda con su clave, minutos, nivel y estado | RF-4, RF-5, RF-9 |
| `describir(celda)` | Devuelve el texto que se muestra al pasar el cursor. Ej: `"01/10 — 52 minutos — nivel alto"` | RF-6, RF-8, RF-14 |
| `etiquetaDeNivel(nivel)` | Devuelve el texto legible de un nivel. Para lectores de pantalla | RF-14 |

**Contrato de `consolidar`:**

```
consolidar(secciones) → { "DD/MM/AAAA": númeroDeMinutos }

secciones = [{ inicioMs, finMs }]

Reglas:
  - Si finMs falta, la sección sigue abierta: se cuenta hasta "ahora"
  - Los minutos van al día del inicioMs, aunque termine al día siguiente
  - Los remanentes de cada sección se suman entre sí antes de convertir a minutos
```

### 3.2 `js/logica/almacenamiento.js`

| Función | Qué hace | RF |
|---------|----------|-----|
| `umbreDe(porcentaje)` | Umbral configurable. Por defecto `95` | RF-11 |
| `puedeEscribir(usoActual, capacidadTotal, tamanoEstimado, umbral)` | Devuelve si la escritura es segura, incluyendo el caso en que el tamaño estimado no entre | RF-11 |
| `debeRevertir(error)` | Indica si el error fue por cuota agotada y corresponde revertir | RF-11 |

### 3.3 `js/logica/consentimiento.js`

| Función | Qué hace | RF |
|---------|----------|-----|
| `tieneConsentimiento(registros, cuadernoId)` | Devuelve `true` solo si existe un registro con consentimiento vigente | RF-12 |

---

## 4. Algoritmo del mapa en pseudocódigo

### 4.1 Registro de una sección

```
// Se llama al pausar, reiniciar o completar
CERRAR_SECCION():
    si no hay sección abierta:
        retornar

    minutos, remanente = minutosDe(ahora - inicioDeSección)

    si minutos > 0:
        totales[díaDeInicio] = totales[díaDeInicio] + minutos

    // El remanente NO se guarda: se pierde entre secciones
    // si no se cumplió el minuto entero
    cerrar sección abierta

    PERSISTIR(totales)
```

> Nota: el remanente se descarta al cerrar. La spec pide minutos enteros y accumulate entre secciones de **más de un minuto**. Se aclara acá para que la decisión sea explícita.

### 4.2 Cálculo del mapa

```
CONSTRUIR_GRILLA(hoy):
    hoyClave = aFechaClave(hoy)
    claves    = periodoDe(hoyClave)        // 28 claves

    filas = agrupar(claves, 7)             // 4 filas

    para cada clave en claves:
        minutos = totales[clave] ?? 0
        nivel   = nivelDe(minutos)
        estado  = clasificarDia(clave, hoyClave)

        // Regla de la spec: el futuro NO se pinta
        si estado == "futuro":
            nivel = 0
            minutosMostrados = 0

        celda = {
            clave,
            minutos,
            nivel,
            estado,
            descripcion = describir(celda)
        }

    retornar grilla con las 4 filas
```

### 4.3 Migración de registros antiguos

```
RESTAURAR_SESIONES_ANTIGUAS():
    registros = leerDelAlmacenamiento()

    // RF-10: se conservan tal cual
    para cada registro de registros:
        si registro no tiene campo "secciones":
            clave = aFechaClave(desdeIso(registro.fecha))
            totales[clave] = totales[clave] + registro.minutos   // 25
```

### 4.4 Prevención por capacidad

```
ESCRIBIR(datos):
    uso     = medicionDeUso()
    tamano  = estimarTamano(datos)

    si no puedeEscribir(uso, capacidad, tamano, 95):
        BLOQUEAR_ESCRITURAS()
        AVISAR("Exportá tus documentos para liberar espacio")
        retornar

    copiaAnterior = leerTodo()

    intentar:
        escribir(datos)
    si falla por cuota:
        revertir(copiaAnterior)      // RF-11: sin datos parciales
        AVISAR("No se pudo guardar. Exportá tus documentos.")
        DESBLOQUEAR_ESCRITURAS()
        retornar

    DESBLOQUEAR_ESCRITURAS()
```

---

## 5. Cómo se pinta la interfaz

### 5.1 Estructura en la página

```
┌─────────────────────────────────────────────────────┐
│  Mes [9]  Año [2026]      [🗓 Mapa] [📅 Calendario] │  ← RF-7 botón alternar
├────────────────────────────────────┬────────────────┤
│  Lu  Ma  Mi  Ju  Vi  Sa  Do       │  Anotaciones   │  ← el calendario mensual
│                                    │  (solo en vista │
│   ▢   ▢   ▢   ▢   ▢   ▢   ▢      │   calendario)   │
│                                    │                │
│   ▢   ▢   ▢   ▢   ▢   ▢   ▢      │                │
│                                    │                │
│   ▢   ▢   ▢   ▢   ▢   ▢   ▢      │                │
│                                    │                │
│   ▢   ▢   ▢   ▢   ▢   ▢   ▢      │                │
├────────────────────────────────────┴────────────────┤
│  Menos ░▒▓███ Más        (verde ░ = nivel 1)        │  ← RF-5 leyenda
└─────────────────────────────────────────────────────┘
```

Cuando el mapa está activo, el panel de anotaciones **se oculta completo**. No hay información cruzada (RF-7).

### 5.2 Cómo se construye cada celda

**Regla dura del Principio 3:** todo texto que venga del usuario entra con `textContent`. El mapa no muestra texto del usuario en las celdas, pero el tooltip sí compone una descripción.

```
para cada celda de la grilla:

    elemento = crearElemento("div")
    elemento.classList = "celda-mapa"
    elemento.classList.agregar("nivel-" + celda.nivel)   // RF-4
    elemento.classList.agregar(celda.estado)             // RF-5

    // Marca visual para no depender del color — RF-14
    marcador = crearElemento("span")
    marcador.classList = "marcador-nivel"
    marcador.setAttribute("aria-hidden", "true")

    // Texto accesible — RF-14
    elemento.setAttribute(
        "role", "img",
        "aria-label", celda.descripcion
    )

    // Cursor — RF-6
    al pasar el cursor:
        tooltip.textContent = celda.descripcion    // ← textContent, nunca innerHTML
```

### 5.3 Los seis niveles de verde

| Nivel | Color | Marcador | Texto |
|-------|-------|----------|-------|
| 0 | Sin relleno | Ninguno | Sin estudio |
| 1 | Verde muy claro | Punto pequeño | Bajo |
| 2 | Verde claro | Punto mediano | Moderado |
| 3 | Verde medio | Punto grande | Alto |
| 4 | Verde intenso | Punto grande + borde | Muy alto |
| 5 | Verde máximo | Punto grande + borde grueso | Máximo |

El marcador cambia de tamaño en vez de color, para que el nivel se lea sin depender del verde (RF-14).

### 5.4 Responsive

En pantallas pequeñas la grilla se comprime pero **mantiene las 7 columnas**. Cada celda baja a un mínimo de 16 px de ancho. No hay scroll horizontal (RNF-5).

---

## 6. Cobertura de requisitos

| RF | Dónde se resuelve |
|----|-------------------|
| **RF-1** | `js/datos/secciones.js` + `consolidar()` + `js/app.js` |
| **RF-2** | `minutosDe()` + pseudocódigo 4.1 |
| **RF-3** | `consolidar()` + `aFechaClave()` + pseudocódigo 4.1 |
| **RF-4** | `nivelDe()` + estilos de nivel + tabla 5.3 |
| **RF-5** | `clasificarDia()` + `construirGrilla()` + estilos de estado |
| **RF-6** | `describir()` + evento de cursor en `js/interfaz/mapa-calor.js` |
| **RF-7** | Botón alternar + `js/inicio-calendario.js` + diagram 5.1 |
| **RF-8** | `describir()` + selección de celda |
| **RF-9** | `periodoDe()` + `diasDeSemana()` |
| **RF-10** | Pseudocódigo 4.3 + exportación existente |
| **RF-11** | `js/logica/almacenamiento.js` + pseudocódigo 4.4 |
| **RF-12** | `js/logica/consentimiento.js` |
| **RF-13** | `js/datos/secciones.js` (cierre en evento de salida) |
| **RF-14** | `etiquetaDeNivel()` + marcadores + tabla 5.3 |
| **RNF-1** | 28 celdas es trivial; medición manual con datos de un año |
| **RNF-7** | Separación `js/logica/` vs `js/interfaz/` |

---

## 7. Estrategias de test con `node --test`

### 7.1 Qué se puede testear y qué no

| Capa | ¿Testeable con Node? | Por qué |
|-------|----------------------|---------|
| `js/logica/mapa-calor.js` | ✅ Sí | Funciones puras, reciben `hoy` |
| `js/logica/almacenamiento.js` | ✅ Sí | Funciones puras |
| `js/logica/consentimiento.js` | ✅ Sí | Función pura |
| `js/datos/secciones.js` | ⚠️ Parcial | Se puede testear el cálculo, no la persistencia real |
| `js/interfaz/mapa-calor.js` | ❌ No | Necesita DOM. Va con `chrome-devtools` |
| `js/inicio-calendario.js` | ❌ No | Es cableado |

### 7.2 Cómo se ejecuta

```powershell
# Sin instalar nada. Node 24 trae el runner.
node --test test/

# Ver un archivo puntual
node --test test/mapa-calor.test.js
```

**No se crea `package.json` ni `node_modules`.** Node detecta los archivos `*.test.js` por convención.

### 7.3 Qué se verifica en cada archivo

**`test/mapa-calor.test.js`**

| Caso | RF |
|------|-----|
| `minutosDe()` con 59 000 ms devuelve 0 minutos | RF-2 |
| `minutosDe()` con 60 000 ms devuelve 1 minuto | RF-2 |
| `nivelDe(0)` devuelve 0 · `nivelDe(24)` devuelve 1 · `nivelDe(25)` devuelve 2 | RF-4 |
| `nivelDe(800)` devuelve 5, igual que `nivelDe(100)` | RF-4 |
| `periodoDe()` devuelve exactamente 28 claves | RF-9 |
| `clasificarDia()` reconoce hoy, pasado y futuro | RF-5 |
| Una celda futura siempre tiene nivel 0 | RF-5 |
| `consolidar()` suma varias secciones del mismo día | RF-1, RF-3 |
| Una sección que cruza la medianoche suma todo al día de inicio | RF-3 |
| `construirGrilla()` devuelve 4 filas de 7 columnas | RF-9 |
| `describir()` devuelve texto con los minutos y el nivel | RF-6, RF-14 |
| `hoy` es un parámetro: pasar otro `hoy` cambia el resultado | RNF-7 |

**`test/secciones.test.js`**

| Caso | RF |
|------|-----|
| Cinco pausas de 5 minutos suman 25 minutos | RF-1, RF-2 |
| Cinco pausas de 30 segundos suman 0 minutos | RF-2 |
| Cerrar una sección la sella con su hora de fin | RF-1 |
| Un reinicio a mitad de sesión conserva lo acumulado | RF-1 |
| Al cerrar la ventana se conservan solo las secciones selladas | RF-13 |

**`test/almacenamiento.test.js`**

| Caso | RF |
|------|-----|
| Con 94 % de uso y escritura chica, permite | RF-11 |
| Con 96 % de uso, bloquea | RF-11 |
| Con espacio insuficiente para la escritura, bloquea aunque esté bajo el umbral | RF-11 |
| Un error de cuota activa la reversión | RF-11 |

**`test/consentimiento.test.js`**

| Caso | RF |
|------|-----|
| Sin registro, devuelve `false` | RF-12 |
| Con consentimiento vigente, devuelve `true` | RF-12 |
| Con consentimiento revocado, devuelve `false` | RF-12 |

### 7.4 Lo que se verifica con `chrome-devtools`

| Qué | Herramienta | RF |
|-----|-------------|-----|
| El mapa se dibuja | captura | RNF-1 |
| Cero errores de consola | consola | RF-1 a RF-14 |
| Sin scroll horizontal en móvil | viewport reducido | RNF-5 |
| El cursor muestra los minutos | inspección manual | RF-6 |
| El botón alterna sin mezclar | inspección manual | RF-7 |
| Los marcadores se distinguen sin color | captura en escala de grises | RF-14 |
| El aviso de capacidad aparece | inspección manual | RF-11 |

### 7.5 Datos de prueba para RNF-1

Se genera un conjunto de **un año** de secciones por escrito, guardado como un archivo de datos que se carga solo en la versión de prueba. No se genera con código ni se agrega al proyecto como dependencia. Cumple con la constitución: *"conjunto de datos de prueba preparado a mano y con medición manual"*.

---

## 8. Orden de implementación

| Paso | Qué se hace | RF que cierra |
|------|-------------|---------------|
| 1 | `js/logica/mapa-calor.js` con sus funciones puras | RF-2, RF-3, RF-4, RF-5, RF-9 |
| 2 | `test/mapa-calor.test.js` y correr | Verifica paso 1 |
| 3 | `js/logica/almacenamiento.js` y su test | RF-11 |
| 4 | `js/logica/consentimiento.js` y su test | RF-12 |
| 5 | `js/datos/secciones.js` y su test | RF-1, RF-13 |
| 6 | Cambiar `guardarSesionPomodoro()` en `app.js` | RF-1, RF-2, RF-10 |
| 7 | Estilos de la grilla y los seis niveles | RF-4, RF-14 |
| 8 | `js/interfaz/mapa-calor.js` | RF-5, RF-6, RF-8, RF-14 |
| 9 | Botón alternar y `js/inicio-calendario.js` | RF-7 |
| 10 | Pseudocódigo 4.4 aplicado al guardado real | RF-11 completo |
| 11 | Verificación con `chrome-devtools` | RNF-1 a RNF-7 |
| 12 | Actualizar `AGENTS.md`, `MEMORY.md`, constitución | Principio 2, DD-1 |

---

## 9. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| El formato de fecha rompe la comparación | Días no se pintan | `aFechaClave()` como única puerta. El test lo cubre |
| El registro antiguo se pierde al migrar | Se borra historial | `RESTAURAR_SESIONES_ANTIGUAS()` lee y conserva. Test dedicado |
| La reversión de escritura daña datos previos | Pérdida de apuntes | Se guarda copia antes de escribir. Es el punto más delicado: revisar antes de implementar |
| El mapa no entra en pantallas chicas | Incumple RNF-5 | Verificación con viewport reducido en el paso 11 |
| `node --test` choca con el Principio 4 | Inconsistencia documental | DD-1: se actualiza la constitución en el paso 12 |

---

## 10. Lo que este plan NO hace

- No modifica la lógica existente del calendario mensual, salvo la parte que comparte formato de fecha
- No arregla el bug de las 33 funciones mezcladas de `app.js`. Solo deja de sumaarle
- No toca las anotaciones
- No implementa los casos pendientes CP-1, CP-2 y CP-3, que la spec dejó explícitamente abiertos. Las opciones para resolverlos están en [`resolucion-cp.md`](resolucion-cp.md)
- No agrega dependencias de ningún tipo
# Especificación: Mapa de calor de estudio

**ID:** 001-heat-map
**Estado:** Lista para planificar
**Versión:** 2.1

---

## Contexto

El Cuaderno Virtual ya permite estudiar con un Pomodoro y ver un calendario mensual con anotaciones de fechas importantes (parciales, entregas, notas personales).

Hoy existe un vacío entre ambas cosas. El Pomodoro registra **sesiones completadas** con un valor fijo de 25 minutos, pero no registra cuánto tiempo real se estudió. El calendario mensual muestra qué días tienen anotaciones, no cuánto estudiaste. Para saber si sos constante hay que abrir día por día o acordarte.

El resultado es doble: **el esfuerzo no se ve**, y **el registro actual no es honesto**. Un día en el que estudiaste 8 minutos y abandonaste cuenta igual que uno de 25. Eso impide saber la verdad y desmoraliza.

Esta funcionalidad agrega una vista propia —un mapa de calor— donde cada día se pinta con mayor o menor intensidad según los minutos realmente estudiados.

---

## Objetivos

1. **Hacer visible la constancia.** Que el usuario vea, de un vistazo, cómo viene su estudio en las últimas semanas.
2. **Dar una señal inmediata de intensidad.** Que la intensidad tenga un significado obvio y comparable entre días.
3. **Registrar el tiempo real.** Que los minutos reflejen tiempo efectivamente cargado, no sesiones completadas.
4. **No perder lo existente.** Que las anotaciones, los documentos y el historial registrado no se pierdan ni se modifiquen por la incorporación de esta vista.

---

## Usuarios

| Usuario | Necesidad |
|---------|-----------|
| **Estudiante** (usuario principal) | Ver si mantiene la constancia y detectar descansos prolongados sin depender de la memoria. |
| **Docente o material** (usuario secundario, opcional) | Consultar cuadernos que le fueron entregados con consentimiento, para ver la constancia de sus alumnos. |

> Nota: el Cuaderno Virtual es una herramienta personal. El usuario secundario es opcional y requiere consentimiento explícito según RF-12.

---

## Definiciones

| Término | Significado en esta especificación |
|---------|-----------------------------------|
| **Sección** | Bloque de tiempo continuo durante el cual el temporizador está en ejecución. Una pausa **cierra** la sección. Reanudar **abre** una sección nueva. |
| **Minutos efectivos** | Suma de todas las secciones del día, contadas en minutos enteros. |
| **Día de registro** | El día en el que **comenzó** la sección, aunque haya cruzado la medianoche. |
| **Nivel de intensidad** | Uno de cinco niveles visuales derivados de umbrales fijos de minutos. |

---

## Historias de usuario

**HU-1 — Constancia visible**
Como estudiante, quiero ver un mapa de las últimas semanas donde el color de cada día represente cuánto estudié, para saber de un vistazo cómo vengo.

**HU-2 — Incentivo al esfuerzo**
Como estudiante, quiero que las sesiones largas se vean claramente distintas de las cortas, para que el esfuerzo realizado tenga un reflejo visible.

**HU-3 — Registro honesto**
Como estudiante, quiero que solo se cuente el tiempo en que el temporizador estuvo efectivamente corriendo, para que el mapa refleje estudio real y no tiempo perdido.

**HU-4 — Mapa independiente**
Como estudiante, quiero alternar entre el mapa de calor y el calendario mensual sin que se mezclen ni se pierdan, para consultar cualquiera de los dos sin resignar el otro.

**HU-5 — Consultar un día puntual**
Como estudiante, quiero ver los minutos de un día concreto al pasar el cursor por encima, para entender por qué un día tiene una intensidad y otro no.

**HU-6 — No perder nada**
Como estudiante, quiero que mis datos sobrevivan a esta funcionalidad, para poder seguir usándolos y exportarlos igual que antes.

---

## Requisitos funcionales

### RF-1 — Registro de minutos reales por sección

El sistema debe contabilizar el tiempo durante el cual el temporizador está en ejecución, segmentado en secciones independientes.

**Criterios de aceptación**

- Mientras el temporizador está en ejecución, el sistema cuenta el tiempo como una sección abierta.
- Cuando el usuario pausa, el sistema cierra la sección abierta y persiste los minutos acumulados.
- Cuando el usuario reanuda, el sistema abre una sección nueva que continúa desde el punto de pausa.
- Cuando el usuario reinicia, el sistema cierra la sección abierta y persiste los minutos acumulados.
- Cuando el usuario completa una sesión, el sistema cierra la sección abierta y persiste los minutos acumulados.

> Este requisito **reemplaza** el registro actual, que solo anotaba la finalización de sesiones completas con un valor fijo.

---

### RF-2 — Conversión a minutos enteros

El sistema debe contabilizar los minutos en parte entera y acumular los remanentes hacia el minuto siguiente.

**Criterios de aceptación**

- Si una sección dura menos de un minuto completo, entonces el sistema no registra minutos por esa sección.
- Si cada sección alcanza un minuto completo, entonces el sistema registra ese minuto.
- El sistema nunca registra fracciones de minuto.

> **Decisión sobre los remanentes:** cada sección se redondea por separado. Los segundos que no completan un minuto se descartan al cerrar y **no se suman** a la sección siguiente. Cinco pausas de 30 segundos dan 0 minutos.
>
> Este texto antes decía que la suma de varias secciones sí contaba. Se corrigió para eliminar la contradicción con el caso límite correspondiente.

---

### RF-3 — Consolidación por día de inicio

El sistema debe acumular todas las secciones en un único total diario, asignado al día en que comenzó cada sección.

**Criterios de aceptación**

- Si un usuario estudia con varias pausas dentro del mismo día, el sistema suma la totalidad de las secciones a un único total para esa fecha.
- Si una sección comienza antes de la medianoche y termina después, entonces el sistema asigna la totalidad de sus minutos al día en que comenzó.
- Si el usuario estudia en fechas distintas, el sistema mantiene un total separado para cada fecha.

---

### RF-4 — Escala de intensidad fija

El sistema debe asignar a cada día un nivel de intensidad derivado de umbrales fijos de minutos, independientes de otros días o períodos.

| Nivel | Minutos | Descripción |
|-------|---------|-------------|
| 0 | 0 | Sin relleno de intensidad |
| 1 | 1 – 24 | Bajo |
| 2 | 25 – 49 | Moderado |
| 3 | 50 – 74 | Alto |
| 4 | 75 – 99 | Muy alto |
| 5 | 100 o más | Máximo |

**Criterios de aceptación**

- Si un día tiene entre 1 y 24 minutos, entonces el sistema aplica el primer nivel de intensidad.
- Si un día tiene entre 25 y 49 minutos, entonces el sistema aplica el segundo nivel.
- Si un día tiene entre 50 y 74 minutos, entonces el sistema aplica el tercer nivel.
- Si un día tiene entre 75 y 99 minutos, entonces el sistema aplica el cuarto nivel.
- Si un día tiene 100 minutos o más, entonces el sistema aplica el quinto nivel, de intensidad máxima.
- Si un día supera los 100 minutos, entonces el sistema no lo distingue visualmente de un día de 100 minutos, aunque continúa contabilizando la totalidad de los minutos.

---

### RF-5 — Días sin estudio y días futuros

El sistema debe presentar de manera uniforme las fechas sin minutos registrados.

**Criterios de aceptación**

- Si una fecha no tiene minutos registrados, entonces el sistema muestra la casilla sin relleno de intensidad.
- Si una fecha es posterior al día actual, entonces el sistema muestra la casilla sin relleno de intensidad, de igual forma que un día pasado sin estudio.
- Si no existen datos de ningún día del período visible, entonces el sistema muestra todas las casillas vacías.

> Nota: el sistema no distingue visualmente entre un día futuro y un día pasado sin estudio. Ver *Casos límite pendientes* — CP-1.

---

### RF-6 — Consulta por cursor

El sistema debe comunicar los minutos de un día cuando el usuario pasa el cursor por encima, en la vista de mapa.

**Criterios de aceptación**

- Cuando el usuario pasa el cursor por encima de una casilla del mapa, entonces el sistema muestra los minutos estudiados en ese día.
- Si el día no tiene minutos registrados, entonces el sistema informa que ese día no registra estudio.
- Si el día es posterior al día actual, entonces el sistema informa que ese día aún no ha ocurrido.

> Esta consulta es exclusiva de la vista de mapa. No aplica al calendario mensual.

---

### RF-7 — Vista independiente con alternancia

El sistema debe presentar el mapa de calor y el calendario mensual como vistas independientes, alternables entre sí.

**Criterios de aceptación**

- Cuando el usuario abre el calendario, entonces el sistema muestra el mapa de calor como vista inicial.
- Cuando el usuario activa la vista de calendario mensual, entonces el sistema muestra la grilla mensual con sus anotaciones y oculta el mapa por completo.
- Cuando el usuario vuelve al mapa de calor, entonces el sistema muestra el mapa por completo y oculta la grilla mensual.
- Si el usuario cambia de mes o de año, entonces el sistema no altera la vista seleccionada.
- Cuando el usuario vuelve a una vista, entonces el sistema conserva el día que tenía seleccionado en esa vista.

> La información de ambas vistas no se cruza: el mapa no muestra anotaciones y el calendario mensual no muestra minutos.

---

### RF-8 — Detalle de minutos por día seleccionado

El sistema debe comunicar los minutos del día seleccionado en la vista de mapa.

**Criterios de aceptación**

- Cuando el usuario selecciona una casilla del mapa, entonces el sistema muestra los minutos estudiados en ese día junto con su nivel de intensidad.

---

### RF-9 — Período consultable

El sistema debe representar un período fijo de cuatro semanas.

**Criterios de aceptación**

- Cuando el usuario abre el mapa de calor, entonces el sistema muestra las últimas cuatro semanas.
- Si el período visible incluye días sin ningún dato, entonces el sistema los muestra como casillas vacías.
- Si el período visible incluye días posteriores al día actual, entonces el sistema los muestra como casillas vacías.

---

### RF-10 — Conservación de datos existentes

El sistema no debe invalidar ni descartar la información ya registrada por el usuario.

**Criterios de aceptación**

- Si existen registros de sesiones anteriores a esta funcionalidad, entonces el sistema los conserva con su valor original de 25 minutos por sesión completada.
- Si el usuario importa un respaldo con datos de estudio, entonces el sistema los reconoce y los incorpora al mapa.
- Si el usuario exporta sus datos, entonces el respaldo incluye la información de minutos de estudio.

---

### RF-11 — Prevención por capacidad de almacenamiento

El sistema debe proteger los datos del usuario ante el agotamiento del espacio de almacenamiento.

**Criterios de aceptación**

- Cuando la capacidad de almacenamiento alcance un umbral crítico, o el espacio disponible sea menor al tamaño estimado de la operación, entonces el sistema bloquea preventivamente las escrituras nuevas.
- Cuando se bloquean las escrituras, entonces el sistema informa al usuario que exporte sus documentos para liberar espacio.
- Si una escritura falla por falta de espacio durante su ejecución, entonces el sistema revierte la operación completa para evitar persistencia parcial.
- Cuando el usuario exporta y libera espacio, entonces el sistema reanuda las escrituras normalmente.

> Este requisito corrige un defecto conocido: el guardado actual falla en silencio al superarse el tope de almacenamiento.

---

### RF-12 — Uso de cuadernos de terceros con consentimiento

El sistema debe permitir consultar cuadernos ajenos únicamente cuando existe consentimiento explícito.

**Criterios de aceptación**

- Cuando el usuario abre un cuaderno que no es propio, entonces el sistema verifica que tiene constancia de consentimiento.
- Si no existe constancia de consentimiento, entonces el sistema no permite la consulta.
- Si existe constancia de consentimiento, entonces el sistema muestra el mapa correspondiente al cuaderno ajeno.

---

### RF-13 — Interrupción del registro por cierre

El sistema debe dejar de contabilizar el tiempo cuando la sesión de uso se interrumpe.

**Criterios de aceptación**

- Cuando el navegador se cierra con un temporizador en ejecución, entonces el sistema deja de contar tiempo en ese momento.
- Si el navegador se cierra durante una sección abierta, entonces el sistema conserva únicamente los minutos ya persistidos por secciones anteriores.

---

### RF-14 — Paleta y accesibilidad sin dependencia del color

El sistema debe utilizar una escala de verdes y comunicar la intensidad sin depender exclusivamente del color.

**Paleta**

| Nivel | Minutos | Color |
|-------|---------|-------|
| 0 | 0 | Sin relleno |
| 1 | 1 – 24 | Verde muy claro |
| 2 | 25 – 49 | Verde claro |
| 3 | 50 – 74 | Verde medio |
| 4 | 75 – 99 | Verde intenso |
| 5 | 100 o más | Verde máximo |

**Criterios de aceptación**

- Cuando el mapa muestra un nivel de intensidad, entonces el sistema lo representa con el color correspondiente de la paleta de verdes.
- Cuando el mapa muestra un nivel de intensidad, entonces el sistema acompaña el color con un marcador visual distinto por nivel.
- Si el usuario no percibe la diferencia entre los colores de la escala, entonces los marcadores visuales permiten distinguir los niveles.
- Cuando el mapa se consulta con un lector de pantalla, entonces el sistema describe cada casilla con su fecha y sus minutos.
- Si un día no tiene minutos registrados, entonces el sistema no le asigna ningún color de la escala.

---

## Requisitos no funcionales

| ID | Requisito | Verificación |
|----|-----------|--------------|
| RNF-1 | El mapa se visualiza en menos de 1 segundo con al menos 1 año de datos de estudio. | Medición con un conjunto de datos de prueba generado a mano |
| RNF-2 | El sistema no depende de conexión a internet para funcionar. | Verificación del flujo completo sin red |
| RNF-3 | Ningún dato del usuario se transmite fuera de su equipo. | Verificación de que no existen salidas de datos |
| RNF-4 | Todo texto visible para el usuario está en español. | Revisión de la interfaz |
| RNF-5 | El mapa es legible en pantallas pequeñas sin requerir desplazamiento horizontal. | Verificación en viewport reducido |
| RNF-6 | El sistema no pierde datos ante un fallo durante la escritura. | Verificación de que un fallo no deja registros parciales |
| RNF-7 | La lógica de cálculo de minutos no accede a la interfaz. | Revisión de que el cálculo es independiente del dibujo |

---

## Casos límite

| Caso | Comportamiento esperado |
|------|-------------------------|
| El usuario reinicia el Pomodoro en el mismo día | Los minutos de la sección cerrada se conservan y se suman al total del día |
| El usuario completa un Pomodoro de 25 minutos exactos | El día queda en el segundo nivel de intensidad |
| El usuario estudia 25 minutos repartidos en cinco pausas de 5 minutos | El día acumula 25 minutos, porque las pausas no consumen tiempo contabilizado |
| El usuario estudia 25 minutos repartidos en cinco pausas de 30 segundos | El día acumula 0 minutos, porque ninguna sección alcanza el minuto completo |
| El usuario cambia de mes o de año mientras está en la vista de mapa | La vista seleccionada no se altera |
| El usuario tiene cero minutos en todo el período | Todas las casillas aparecen vacías |
| El almacenamiento alcanza el 95 % de su capacidad | El sistema bloquea escrituras, informa y ofrece exportar para liberar espacio |
| Una escritura falla a mitad de ejecución por falta de espacio | El sistema revierte la operación completa, sin datos parciales |
| El usuario restaura un respaldo generado antes de esta funcionalidad | El sistema reconoce el respaldo y conserva los 25 minutos por sesión |
| El usuario importa un cuaderno ajeno sin consentimiento | El sistema impide la consulta |
| El navegador se cierra con un Pomodoro en ejecución | El tiempo deja de contarse en el momento del cierre |
| Una sección cruza la medianoche | Todos sus minutos se asignan al día en que comenzó |
| El usuario estudia 800 minutos en un día | Se contabilizan los 800 minutos; visualmente equivale a un día de 100 minutos |
| El usuario llega a 100 minutos a mitad de una sesión | El mapa pasa al nivel máximo y permanece allí |

---

## Casos límite pendientes de definir

Estos casos fueron identificados y **no están resueltos**. No bloquean la implementación.

Las opciones, lo que hay que decidir y el impacto de cada decisión están en
[`resolucion-cp.md`](resolucion-cp.md).

| Caso | Situación |
|------|-----------|
| CP-1 | El día en curso con una sección abierta es indistinguible de un día sin estudio. No está definido si debe destacarse. |
| CP-2 | Manipulación del reloj del sistema: no está definido el comportamiento si el reloj se adelanta o atrasa durante una sección. |
| CP-3 | Quebrillo de los umbrales exactos de intensidad. |

---

## Fuera de alcance

Esta versión **no** incluye:

- Rachas, premios, logros o cualquier mecanismo de gamificación
- Comparación entre materias
- Metas diarias configurables
- Estadísticas agregadas (promedios semanales, totales del mes, totales del año)
- Exportación del mapa de calor como imagen
- Mapas de calor de otras dimensiones (por materia, por tipo de tarea)
- Filtros por rango de fechas personalizado
- Diferenciación visual entre día futuro y día pasado sin estudio
- **RF-12 en sí: consultar cuadernos ajenos.** El módulo existe, sin conectar.
  Ver la nota de abajo

> ##### RF-12 se decide el 2026-10-02: sin identidad no hay nada que proteger
>
> RF-12 pide poder consultar **cuadernos de terceros** con consentimiento
> explícito. Para cumplirlo hace falta saber **de quién** es cada cuaderno, y
> este proyecto no tiene nada que lo diga: no hay cuentas, ni identidades, ni
> un servidor. La app es un cuaderno local, y en uno local no hay "ajeno".
>
> El módulo `js/logica/consentimiento.js` está escrito y tiene sus tests, pero
> **no tiene ni un solo llamador**, y no se va a conectar. Se conserva como
> andamiaje.
>
> La razón para no cablearlo igual: un control de privacidad que no controla
> nada es **peor** que no tenerlo. Si el consentimiento se guardara en el mismo
> cuaderno al que protege, cualquiera podría firmarlo y leer lo que quisiera. Eso
> no es una versión "mínima" de RF-12: es un simulacro que se puede esquivar, y
> daría una sensación de seguridad que no existe.
>
> Cuando se quiera retomar, hace falta una decisión previa que no es técnica:
> **dónde vive la constancia de consentimiento.** Mientras no se responda eso,
> implementar los criterios de aceptación sería escribir código que no protege.

---

## Criterios de finalización

La funcionalidad se considera finalizada cuando:

1. Todos los requisitos funcionales (**RF-1** a **RF-14**) cumplen sus criterios de aceptación.
2. Todos los requisitos no funcionales (**RNF-1** a **RNF-7**) están verificados.
3. Todos los casos límite de la sección *Casos límite* se prueban y se comportan según lo especificado.
4. Todas las dudas abiertas están resueltas y la especificación refleja las decisiones tomadas. *(Sin dudas abiertas al momento de esta versión.)*
5. El sistema no introduce errores en la consola durante el uso normal.
6. Las funcionalidades existentes (calendario mensual, anotaciones, Pomodoro) siguen funcionando sin regresiones.
7. El aviso de capacidad de almacenamiento (RF-11) está implementado, eliminando el fallo silencioso registrado como deuda.
8. La documentación del proyecto refleja la nueva funcionalidad: `AGENTS.md` (estructura y convenciones), `MEMORY.md` (funcionalidades operativas) y `docs/constitucion.md` (verificación de rendimiento y de diseño responsive).

---

## Decisiones tomadas

Las decisiones que|USUARIO tomó durante la redacción quedaron registradas acá.

| ID | Decisión |
|----|----------|
| **DA-1** | Cinco niveles fijos con umbrales de 25 minutos: 1–24, 25–49, 50–74, 75–99, 100+. Sin estudio = sin relleno. |
| **DA-3** | El mapa representa **4 semanas**. |
| **DA-5** | Paleta de **verdes**, al estilo de GitHub. |

---

## Decisiones anteriores

| ID | Decisión | Origen |
|----|----------|--------|
| Fuente de los minutos | Secciones de tiempo activo del temporizador, no el registro de sesiones completas | Aclaración del usuario |
| Definición de sección | Bloque continuo de ejecución; una pausa la cierra, reanudar abre una nueva | Aclaración del usuario |
| Unidad de conteo | Minutos enteros; los remanentes se acumulan al minuto siguiente | Aclaración del usuario |
| Días futuros | Se muestran vacíos, igual que un día sin estudio | Aclaración del usuario |
| Independencia de vistas | El mapa no comparte información con el calendario mensual; se alternan con un botón | Aclaración del usuario |
| Consulta de minutos | Al pasar el cursor por encima, solo en la vista de mapa | Aclaración del usuario |
| Días con exceso | Se contabilizan todos; el color llega al tope y no distingue más | Aclaración del usuario |
| Almacenamiento | Bloqueo preventivo al 95 %, aviso al usuario, operación en modo lectura y reversión completa ante fallo | Aclaración del usuario |
| Cuadernos ajenos | Solo con consentimiento explícito | Aclaración del usuario |
| DA-2 | El mapa no tiene panel de anotaciones | Aclaración del usuario |
| DA-4 | Los registros anteriores se conservan con su valor original de 25 minutos | Aclaración del usuario |

---

## Trazabilidad

| Objetivo | Requisitos que lo cubren |
|----------|------------------------|
| Hacer visible la constancia | RF-4, RF-5, RF-8, RF-9 |
| Dar una señal inmediata de intensidad | RF-1, RF-4, RF-14 |
| Registrar el tiempo real | RF-1, RF-2, RF-3, RF-13 |
| No perder lo existente | RF-10, RF-11, RF-12 |
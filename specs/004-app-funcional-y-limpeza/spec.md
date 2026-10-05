# Especificación: Que la app funcione y borrar lo que no se usa

**ID:** 004-app-funcional-y-limpeza
**Estado:** Completada — 2026-10-01. Las 7 tareas de `task.md` están hechas. Quedan
cinco cosas anotadas abajo, ninguna bloqueante.
**Versión:** 1.0

---

## Contexto

La spec 003 terminó de separar el cálculo del dibujo. Al revisar lo que quedó, un
análisis automático buscó código muerto y encontró **tres defectos que no son
código muerto: son código roto.**

Ninguno estaba en la lista de tareas de la 003, porque ninguno se había detectado
antes: la 003 verificaba el layout del calendario y el árbol lateral, no el
comportamiento del menú en el teléfono ni la persistencia de datos.

### Defecto 1 — En el teléfono no se ve el menú lateral

A 640 px o menos la hoja de estilos convierte el menú en un panel deslizable
que sale de la pantalla:

```css
@media (max-width: 640px) {
    .menu-lateral {
        position: absolute;
        transform: translateX(-100%);
    }
}
```

Existe una regla que lo vuelve a poner en pantalla:

```css
.menu-lateral.visible { transform: translateX(0); }
```

**Ningún archivo nunca agrega esa clase.** El botón flotante solo alterna
`colapsado` y `oculto`, que son otra cosa.

Medido a 375 px:

| | Valor |
|---|---|
| Menú lateral | `left: -260` px, fuera de pantalla |
| Después de tocar el botón flotante | `left: -60` px, **sigue fuera** |
| Árbol de materias | No se ve |
| Lo único visible | El botón, modo lectura, configuración y el Pomodoro |

**En el teléfono no se pueden abrir documentos, agregar materias ni navegar.**
La app pierde su función principal. Y no hay ningún botón que lo arregle: no es
un detalle de apariencia, es que falta una pieza.

### Defecto 2 — Las estadísticas desaparecen al borrar algo

La barra de números vive **dentro del visor**, en el bloque de bienvenida que
`index.html` trae puesto:

```html
<div class="visor" id="visor">
    <div class="bienvenida">
        <div class="bienvenida-icono">📚</div>
        <h2>Tu Cuaderno Virtual</h2>
        <p>Crea materias y sube tus documentos HTML, PDF o Word…</p>
        <div class="stats" id="statsContainer"></div>   <!-- acá, adentro -->
        <p class="hint">Haz clic en "Añadir Materia" para comenzar.</p>
    </div>
</div>
```

Y `mostrarBienvenida()` hace esto:

```javascript
visor.innerHTML = `
    <div class="bienvenida">
        <div class="bienvenida-icono">📚</div>
        <h2>Tu Cuaderno Virtual</h2>
        <p>Crea materias y sube tus documentos HTML, PDF o Word…</p>
        <p class="hint">Haz clic en "Añadir Materia" para comenzar.</p>
    </div>`;
```

Asigna a `innerHTML` de `#visor` **entero**, así que borra todo lo que había
adentro — incluida la barra de estadísticas.

La variable `statsContainer` sigue apuntando al nodo desprendido, así que
`actualizarStats()` sigue escribiendo ahí: a un nodo que ya no está en la
página. El código no falla. La barra simplemente no está.

Medido:

| Momento | ¿El contenedor está en el DOM? | Qué se ve |
|---------|-------------------------------|-----------|
| Al cargar | sí | `2 Materias · 1 Documentos · 3 Palabras` |
| Tras eliminar una materia | **no** | nada |
| Tras eliminar un documento | **no** | nada |

Las estadísticas **no vuelven a aparecer** en toda la sesión. Solo vuelven si se
recarga la página.

Y hay un detalle extra: el bloque de bienvenida **está duplicado**, una vez en el
HTML y otra en la plantilla del código, y no son idénticos. La versión del HTML
tiene la barra de estadísticas; la del código no.

### Defecto 3 — Un nombre que no existe corta el guardado de datos

`guardarDatos()` tiene un `catch` que llama a `LogicaCapacidad.debeRevertir()`.
Ese identificador **no existe en ninguna parte del proyecto**: el binding real se
llama `debeRevertir` y ya está destructurado en la línea 81.

Cuando `localStorage.setItem` falla —por cuota, por ejemplo— la línea lanza:

```
Uncaught ReferenceError: LogicaCapacidad is not defined
```

Como el `catch` no tiene un `try` anidado, la excepción sale de `guardarDatos()`
y corta a quien la llamó. El peor caso medido:

1. `eliminarMateria()` quita la materia del arreglo en memoria
2. `guardarDatos()` lanza la excepción
3. `construirArbol()` **nunca se llama**

Resultado: la materia se borró de los datos, **pero el nodo sigue en pantalla**.
El menú queda mostrando algo que ya no está guardado. Si el usuario toca otro
botón, se pierde el cambio.

### Lo que no es código muerto, pero se parecía

`escriturasBloqueadas` es una bandera que se escribe en cuatro lugares y **no se
lee en ninguno**. La spec 001, RF-11, pide que al llenarse el almacenamiento se
**bloqueen** las escrituras. Hoy no se bloquea nada: se revierte a medias y se
avisa, pero el usuario puede seguir intentando y ver el mismo error.

No es código muerto: es un requisito sin implementar, con el nombre de la
variable ya puesto.

---

## Objetivos

1. **Que la app sirva en un teléfono.** El menú tiene que abrirse y cerrarse, y
   las materias tienen que ser alcanzables.
2. **Que las estadísticas no desaparezcan.** Y que la barra de números no esté
   duplicada entre el HTML y el código.
3. **Que un fallo de almacenamiento no corte la operación.** El guardado tiene que
   dejar al sistema en un estado coherente, o avisar, pero nunca dejar el menú
   mintiendo.
4. **Cumplir RF-11**: bloquear las escrituras cuando el almacenamiento no entra, y
   no perder nada.
5. **Borrar el código que no se usa**, de los ~528 líneas encontrados, sin tocar lo
   que sí tiene función.

---

## Fuera de alcance

| No se hace | Por qué |
|------------|---------|
| `js/logica/consentimiento.js` (91 líneas sin uso) | El usuario decidió que **RF-12 sigue en alcance**. Es el andamiaje de un requisito pendiente, no un descuido. Se conserva y se anota |
| Rediseñar el menú lateral | Solo se le hace funcionar lo que ya está diseñado |
| Unificar las cuatro plantillas de `.bienvenida` | Es cosmético. Se hace la parte necesaria para el defecto 2, no las otras |
| El Pomodoro y la vista de lectura | No se tocan. Se verifican, no se modifican |
| `js/datos.js` | Son 317 líneas muertas y se borran, pero es un archivo entero: se hace al final y aparte, para que un fallo sea fácil de revertir |
| Migrar a un framework o agregar dependencias | Principio 1 |

---

## Requisitos funcionales

### RF-1 · El menú lateral se abre y se cierra en pantallas angostas

A 640 px o menos, el usuario tiene que poder **abrir el menú lateral**, ver sus
materias y documentos, y **cerrarlo** sin recargar la página.

**En el teléfono el botón solo abre y cierra. No encoge.**

El botón hoy alterna `colapsado`, que encoge el menú a una barra de íconos. Eso
tiene sentido en el escritorio, donde el menú está siempre visible y encogerlo
deja más lugar al contenido. En un cajón deslizable **no tiene sentido**: el panel
ya está oculto y no hay nada que ganar.

Peor: si se aplicaran las dos clases a la vez, el resultado medido es un panel
**abierto de 60 px con el contenido invisible**:

| Estado | `left` | Ancho | Árbol |
|--------|--------|-------|-------|
| Solo `visible` | 0 | 260 px | visible, opacidad 1 |
| `visible` + `colapsado` | 0 | **60 px** | opacidad **0** |

Un panel abierto y vacío no es un estado aceptable. **Por debajo de 640 px,
`colapsado` no debe poder aplicarse.**

**Nada de esto puede cambiar lo que se ve en 641 px o más.** El menú de escritorio
y el comportamiento del botón se quedan exactamente como están.

| Caso | Resultado esperado |
|------|--------------------|
| A 640 px, menú cerrado | El contenido se ve, el menú no, y no queda un fondo encima |
| A 640 px, se toca el botón | El menú entra **ancho completo**, con un fondo oscuro detrás |
| Con el menú abierto, se toca el botón | El menú sale y el fondo desaparece |
| **Con el menú abierto, se toca el fondo** | **El menú sale y el fondo desaparece** |
| Con el menú abierto, se toca `Esc` | El menú sale |
| Con el menú abierto, se toca un ítem del menú | El menú sale, después de actuar |
| El menú está abierto y se agranda a 900 px | El menú queda cerrado, sin fondo |
| El menú está abierto y se achica a 900 px desde escritorio | El menú queda cerrado |
| A 641 px o más | El botón encoge el menú, como hoy |

**El fondo tiene que ser oscuro y semitransparuo.** Es lo que le dice a la persona
que se puede tocar afuera, y lo que tapa el contenido para que no quede la
ilusión de que se puede interactuar con él.

**El foco de teclado tiene que poder entrar al menú abierto, y volver al botón al
cerrarlo.** Un panel que se abre con un botón y no se puede recorrer con el
teclado deja fuera a quien navega sin mouse.

Cuando el menú está abierto, **el fondo no puede ser un obstáculo invisible**:
tiene que ser un elemento real, con su propio manejador, al que se pueda llegar
con el teclado.

### RF-2 · Las estadísticas no desaparecen y no están duplicadas

| Caso | Resultado esperado |
|------|--------------------|
| Al cargar | La barra de números se ve |
| Tras eliminar una materia | **Se sigue viendo**, con el número actualizado |
| Tras eliminar un documento | **Se sigue viendo**, con el número actualizado |
| Tras agregar una materia | Se sigue viendo |
| Tras importar datos | Se sigue viendo |
| Con cero materias | Se ve la barra con `0 · 0 · 0`, o el mensaje de bienvenida sin barra |

El bloque de bienvenida **no debe eliminar** la barra de estadísticas. Si la barra
vive en el HTML y la bienvenida se dibuja aparte, no hay nada que borrar.

### RF-3 · Un fallo al guardar deja el sistema coherente

Cuando `localStorage` no acepta la escritura, la operación **no puede quedar a
medias**: o se revierte del todo y la pantalla vuelve a lo que había, o se avisa y
se reintenta.

| Caso | Resultado esperado |
|------|--------------------|
| `setItem` falla y no había datos antes | Se avisa. El menú sigue mostrando lo que había |
| `setItem` falla y había datos antes | Se reponen los anteriores. El menú sigue mostrando lo que había |
| Falla la reposición | Se avisa que no se pudo guardar nada |
| Todo sale bien | No cambia nada: ni avisos ni Exceptions |

**Ningún `ReferenceError` puede salir de `guardarDatos()`.** Con el
almacenamiento roto, la app tiene que seguir siendo usable.

### RF-4 · RF-11 · Las escrituras se bloquean cuando no hay espacio

| Caso | Resultado esperado |
|------|--------------------|
| Hay espacio | Se escribe normal |
| **Se alcanzó el umbral** | **No se escribe.** Se avisa |
| **No entra** | **No se escribe.** Se avisa. Todo lo demás sigue funcionando |
| Con escrituras bloqueadas, se borra un documento | **No se borra.** Se avisa |
| Con escrituras bloqueadas, se sube un archivo | **No se sube.** Se avisa |
| Con escrituras bloqueadas, se importa un respaldo | **No se importa.** Se avisa |
| El usuario libera espacio | Se puede volver a escribir |

**Nunca se pierden datos.** Si algo no entra, se avisa y no se toca lo que ya
está.

> #### El umbral bloquea. Esta tabla estuvo mal y se corrigió el 2026-10-02.
>
> Decía antes *"se pasó el umbral y aún entra → se escribe y se avisa una sola
> vez"*. Eso **contradecía a RF-11 de `specs/001-heat-map/spec.md`**, que dice:
>
> > *"Cuando la capacidad de almacenamiento alcance un umbral crítico, **o** el
> > espacio disponible sea menor al tamaño estimado de la operación, entonces el
> > sistema **bloquea** preventivamente las escrituras nuevas."*
>
> Y el caso límite de la spec 001 es explícito: *"El almacenamiento alcanza el
> 95 % de su capacidad | El sistema **bloquea** escrituras, informa y ofrece
> exportar para liberar espacio"*.
>
> **El código hacía bien lo que dice la spec 001.** Lo que estaba mal era esta
> tabla, escrita sin releer la spec original: dos specs del mismo proyecto
> diciéndose cosas distintas, que es peor que cualquier decisión.
>
> Decisión del 2026-10-02: **el código manda, el umbral bloquea.** El 95 % es
> un número que salió de una aclaración del usuario, y bloquear antes de lleno
> es exactamente el principio 5: proteger los datos. Con 5 MB son unos 4,75 MB,
> así que a partir de ahí no se puede guardar ni una nota más, aunque la nota
> entre de sobra. **Eso es lo que se pidió.**

### RF-5 · Se borra el código que no se usa

Se borran **~437 líneas**: 120 dispersas, 15 de exports en objetos `API`, y 317
del archivo `js/datos.js`.

Cada borrado tiene que **verificar antes y después** que los tests pasan, la carga
en el navegador sigue limpia, el árbol lateral se ve idéntico y el layout no
cambió. **Ningún borrado se hace "de a uno y veremos"**.

Lo que se borra:

| Qué | Líneas |
|-----|--------|
| `js/datos.js` (archivo entero, nunca cargado) | 317 |
| `resumenDeProblemas` — duplica `reconstruirAviso` | 17 |
| `quedanCupos`, `estaAlMaximo` — solo sus tests | 19 |
| `minutosDe`, `aIso`, `DIAS_EN_LA_SEMANA` | 23 |
| `alCerrarLaVentana` — alias de una línea | 9 |
| `escapeHtml`, `sesionesCompletadas`, import muerto de `existeFecha` | 8 |
| `estaOculto`, `calendarioMapa` | 6 |
| Exports muertos en objetos `API` (9 entradas) | 15 |
| La regla CSS `.menu-lateral.visible` **solo si RF-1 no la usa** | 0-3 |

**No se borra si algo está en uso**, y no se borra a ciegas: cada línea se
verifica con una búsqueda antes de tocarla.

### RF-6 · Las historias de cálculo quedan correctas

`test/navegador.test.js` se llama "los 15 scripts" cuando carga **16**. Lo mismo
dice `AGENTS.md` en dos lugares, y hay un comentario que dice "los 7 scripts".
Un número que no coincide con la realidad hace que el control parezca más
fuerte de lo que es.

| Caso | Resultado esperado |
|------|--------------------|
| `test/navegador.test.js` | El nombre dice el número que carga |
| `AGENTS.md` | Dice el mismo número |
| El comentario interno | Dice el mismo número |

**El nombre del test no se puede desincronizar del archivo.** Idealmente, que el
número salga de la lista y no esté escrito a mano.

---

## Requisitos no funcionales

| # | Requisito |
|---|-----------|
| RNF-1 | La suite no baja de **284 tests**. Los que se borran junto con código muerto se reemplazan por otros que cubran lo que queda |
| RNF-2 | El árbol lateral se ve **idéntico** antes y después, en los 13 escenarios de `comparar-arbol.js` |
| RNF-3 | `verificar-layout.js` da salida 0 en las **24** mediciones |
| RNF-4 | La consola del navegador queda con **0 errores** en escritorio y a 375 px |
| RNF-5 | Todo en español, UTF-8 sin BOM, y `buscar-caracteres-raros.js` da salida 0 |
| RNF-6 | El menú abierto se puede recorrer con el teclado, y `Esc` lo cierra |
| RNF-7 | Ningún dato se borra sin que el usuario lo haya confirmado |
| RNF-8 | Sin `package.json`, sin `node_modules`, sin dependencias nuevas |

---

## Casos límite

### El menú en pantallas angostas

| Caso | Por qué importa |
|------|-----------------|
| La ventana se agranda de 375 a 900 px con el menú abierto | Quedaría un panel flotando sobre el diseño de escritorio |
| Se abre el menú y se rota el teléfono | El ancho cambia; el panel tiene que seguir siendo alcanzable |
| Se abre el menú, se toca un documento y se vuelve | El visor se abre sobre el contenido, con el menú todavía abierto |
| Dos clics seguidos muy rápido en el botón | El menú no puede quedar en un estado intermedio |
| El menú está abierto y se importan datos | El árbol se redibuja; el panel tiene que sobrevivir |

### El almacenamiento

| Caso | Por qué importa |
|------|-----------------|
| Falla `setItem` pero `removeItem` sí funciona | Hoy se repone con `setItem`: también fallaría |
| El almacenamiento falla **desde el arranque** | No hay datos que reponer. La app tiene que igual mostrar el mensaje |
| Se llena entre dos operaciones | Una funciona y la siguiente no: el estado tiene que quedar coherente |
| El navegador está en modo privado sin almacenamiento | Algunos navegadores lanzan al leer, no al escribir |

### El borrado de código

| Caso | Por qué importa |
|------|-----------------|
| Una función solo la usa su propio test | Borrarla deja el test apuntando al vacío: hay que borrar el test también, y eso baja el total de tests |
| Un export en un objeto `API` lo usa otro archivo | Se ve en el `import` de ese archivo, pero solo si se busca la cadena exacta |
| La función está en la API pública pero nadie la consume | Muerta igual, pero es más fácil que se reintroduzca: conviene dejar una nota |

---

## Decisiones ya tomadas

Se tomaron midiendo, no opinando. Los datos están en RF-1.

| Decisión | Respuesta |
|----------|-----------|
| **CP-1 · Qué hace el botón en el teléfono** | **Solo abrir y cerrar.** Encoger no tiene sentido en un cajón deslizable, y hacerlo junto con abrir deja un panel de 60 px vacío |
| **CP-2 · Cómo se cierra el panel abierto** | **Tocando el fondo oscuro**, que además tiene su propio botón |

### Lo que CP-2 dejó abierto

**El desplazamiento del panel.** Con muchas materias, el panel de 260 px de alto
y su contenido pueden no entrar. Hay dos caminos: darle su propio
desplazamiento, o apoyarse en el de la página.

**No bloquea T3**: se decide al implementarla, mirando cómo se comporta con
muchas materias en Chrome. Si el panel no tiene dónde desplazarse, es un defecto
de T3 y se arregla en T3.

---

## Criterios de finalización

- [ ] A 375 px se abre y se cierra el menú, y las materias son alcanzables
- [ ] El menú abierto se recorre con el teclado y `Esc` lo cierra
- [ ] A 640 px o más la pantalla se ve **exactamente** como hoy
- [ ] Las estadísticas se ven después de eliminar, agregar e importar
- [ ] Con el almacenamiento roto no sale ningún `ReferenceError` y el menú no miente
- [ ] RF-11: con el almacenamiento lleno no se escribe nada y se avisa
- [ ] ~437 líneas de código muerto borradas, cada una verificada
- [ ] La suite no baja de 284 tests
- [ ] `comparar-arbol.js` da `IDÉNTICO`
- [ ] `verificar-layout.js` da salida 0 en las 24 mediciones
- [ ] Consola con 0 errores, en escritorio y a 375 px
- [ ] `node herramientas/buscar-caracteres-raros.js` da salida 0
- [ ] Sin `package.json` ni `node_modules`
- [ ] `AGENTS.md` y `MEMORY.md` al día
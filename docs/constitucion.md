# Constitución del Cuaderno Virtual

> Este documento explica **las reglas del proyecto** y **por qué existen**.
> Para las reglas operativas que sigue una IA al tocar el código, ver [`AGENTS.md`](../AGENTS.md).

---

## 1. Qué es este proyecto

Un cuaderno virtual para organizar apuntes:

- Creás **materias** y dentro de cada una **documentos** (HTML, PDF, Word)
- Los ves en un visor integrado sin salir del navegador
- Tiene **Pomodoro** para estudiar con temporizador
- Tiene **calendario** con anotaciones de parciales y entregas
- Todo se guarda **en tu computadora**, sin internet y sin cuentas

No es una app para publicar. Es una herramienta tuya. Esa libertad es lo que define cada decisión del proyecto.

---

## 2. Los 6 principios

### Principio 1 — El stack no crece

Solo HTML, CSS y JavaScript. Sin frameworks, sin build, sin `npm install`.

**Por qué:** lo estás aprendiendo. Un framework te escondería justamente lo que querés entender. Y tu proyecto ya funciona: no hay razón para agregar complejidad.

**Se verifica:**

```powershell
Test-Path package.json    # → False
Test-Path node_modules    # → False
```

Las únicas librerías externas son dos, ya incluidas en `index.html`:

| Librería | Para qué |
|----------|----------|
| `mammoth` | Convertir Word a HTML |
| `pdf.js` | Mostrar PDFs |

Si necesitás algo más, primero preguntate: ¿se puede con 20 líneas propias?

---

### Principio 2 — Si no está escrito, no existe

Si una función, carpeta o archivo no está en `AGENTS.md` o `MEMORY.md`, no pertenece al proyecto.

**Por qué:** dentro de seis meses no vas a recordar por qué existe cada archivo. La documentación es lo que te salva.

**Se verifica:**

```powershell
Get-ChildItem -Recurse -File |
  Where-Object { $_.FullName -notmatch '\\.opencode\\|\\.agents\\|\\docs\\' } |
  Select-Object Name
```

Esa lista tiene que coincidir con el árbol de `AGENTS.md`.

---

### Principio 3 — La lógica no toca el DOM

Una función calcula datos o cambia estado. Dibujar es **otra** función.

**Por qué:** cuando la lógica y el dibujo están mezclados, cambiar el diseño rompe la lógica y viceversa. Son dos caminos distintos.

**Se verifica:** todo texto que venga del usuario entra al DOM **solo** con `textContent` o `createElement`.

```javascript
// Correcto — el usuario escribe "<b>hola</b>" y se ve literal
elemento.textContent = textoDelUsuario;

// Incorrecto — ejecuta HTML
elemento.innerHTML = textoDelUsuario;   // ← XSS
```

`innerHTML` queda reservado para marcado estático que escribís vos.

---

### Principio 4 — Probar es mirar, con dos caminos

La lógica se verifica con el runner nativo de Node. La interfaz se verifica abriendo Chrome. Ninguno de los dos caminos exige instalar nada.

**Por qué:** hay dos tipos de errores distintos y cada uno necesita una herramienta distinta.

- La **lógica** (calcular minutos, decidir colores, agrupar días) tiene muchos casos límite. Verificarlos a ojo lleva a errores tontos. Con Node se comprueban todos de una vez.
- La **interfaz** (que se vea bien, que no haya errores en consola, que funcione en móvil) solo se puede mirar en un navegador.

**Camino 1 — Lógica pura**

Las funciones de cálculo son puras: reciben `hoy` como parámetro y devuelven un resultado. Sin DOM, sin reloj del sistema, sin almacenamiento.

```powershell
node --test test/          # corre todos los tests
node --test test/archivo.test.js   # uno puntual
```

Node trae el runner instalado. **No hace falta `npm install`, ni `package.json`, ni `node_modules`.**

**Camino 2 — Interfaz**

| Paso | Herramienta | Qué mirás |
|------|-------------|-----------|
| 1 | `chrome-devtools` | Consola → **0 errores** |
| 2 | `chrome-devtools` | Red → todas las requests en `200` |
| 3 | `chrome-devtools` | Captura → se ve bien |
| 4 | `chrome-devtools` | Viewport reducido → sin scroll horizontal, todo legible |
| 5 | A mano | El flujo completo funciona |

Tenés 30 herramientas de `chrome-devtools` configuradas. Usarlas es parte del trabajo, no un extra.

**Las dos reglas que no se negocian:**

1. Lo que se puede probar como función pura, **se prueba como función pura**. Si podés calcularlo sin la pantalla, hacelo así.
2. Ningún test necesita una librería externa. Si un test pide una librería, el test está mal.

**Sobre rendimiento:** si una funcionalidad declara un requisito de tiempo (por ejemplo, "el mapa se dibuja en menos de 1 segundo"), se verifica con un conjunto de datos de prueba **preparado a mano** y con medición manual. No se agregan herramientas de benchmark ni dependencias: eso rompería el principio 1.

---

### Principio 5 — Los datos del usuario son sagrados

Se guardan solo en tu navegador y salen solo cuando vos lo exportás.

**Por qué:** son tus apuntes. No le pertenecen a nadie más.

**Las tres reglas:**

1. **Nunca** `innerHTML` con texto del usuario (el XSS que encontramos)
2. **Nunca** enviar datos a internet — tus apuntes no salen de tu computadora

   > **Aclaración, agregada el 2026-10-05.** La primera mitad se cumple siempre. La
   > segunda —"el proyecto funciona entero sin red"— **no es cierta**, y conviene que lo sepas:
   > `mammoth` (para ver Word) y `pdf.js` (para ver PDF) se cargan desde `cdnjs.cloudflare.com`,
   > y el PDF además baja un *worker* desde ahí. **Sin internet no se abre ningún PDF ni
   > ningún Word**, aunque el archivo esté guardado en tu máquina.
   >
   > Lo que sí funciona sin red: todo lo demás —las materias, el calendario, el Pomodoro, el
   > mapa de calor, guardar, exportar, importar— y leer los archivos **HTML**, que no
   > necesitan ninguna librería.
   >
   > **Decidido el 2026-10-05: se deja así.** Se evaluó bajar las dos librerías al proyecto y
   > no se hizo, a propósito: serían alrededor de un megabyte de código minificado de
   > terceros dentro de un proyecto que estás aprendiendo, y **seguirían sin resolver el
   > worker del PDF**, que es una petición a la red. La decisión real no era "¿las bajamos?",
   > sino "¿querés que funcione sin internet?", y la respuesta fue que no.
3. **Siempre** confirmar antes de borrar: materia, documento o importación

**Y siempre tenés salida:** exportá antes de tocar algo importante.

```powershell
# Si algo sale mal, tu respaldo está en el JSON descargado
```

> **Regla:** nunca se pierde nada en silencio. Si no se pudo guardar, el sistema **te avisa**,
> te dice que lo que ya tenías sigue ahí, y te ofrece exportar. El aviso **no dice por qué**
> no pudo guardar, porque no lo sabe: lo que falló puede ser la cuota del navegador, un disco
> lleno, una pestaña bloqueada o un permiso, y son cosas distintas. **Un aviso que inventa la
> causa manda al usuario a buscar un problema que puede no tener.**
>
> **El fallo silencioso ya no está permitido.** Es una deuda histórica, no un comportamiento
> aceptable.
>
> *Nota:* este texto antes decía que el almacenamiento tiene un tope de ~5 MB. **Ya no hay ese
> muro**: el cuaderno pasó a un almacén que separa cada dato, así que no hay un solo texto que
> se llene entero. Por eso el aviso de "casi lleno" y su umbral del 95 % **se borraron** el
> 2026-10-05. Lo que **sigue siendo cierto** es que cada PDF ocupa un 33 % más de lo que
> ocupa, porque se guarda en base64: eso hay que tenerlo presente con los documentos grandes.

---

### Principio 6 — Todo en español, siempre

Comentarios, nombres de variables y textos de la interfaz. En español. UTF-8 sin BOM.

**Por qué:** es tu proyecto y lo leés todos los días. Que se entienda a la primera es lo mínimo.

**Se verifica:** los archivos tienen que estar en UTF-8 sin BOM. Si se rompe, el acento se convierte en un signo de interrogación: `Anatom?a` en vez de `Anatomía`.

> Esta misma línea, en su versión anterior, tenía **dos caracteres de reemplazo dentro**,
> para ilustrar la corrupción: el documento que la describía **la tenía**. Un archivo con el
> síntoma adentro no puede afirmar que no lo tiene.

```powershell
# Debe devolver 0 para cada archivo
Get-ChildItem index.html,js\app.js,css\styles.css | ForEach-Object {
  $b = [IO.File]::ReadAllBytes($_.FullName)
  ($b | Where-Object { $_ -gt 127 }).Count
}
```

---

## 3. Hacia dónde vas

Estos principios son el destino. El proyecto **todavía no los cumple todos** — y está bien, porque es una foto del camino.

| Principio | Estado actual |
|-----------|---------------|
| 1 · Stack simple | ✅ Cumplido — sin `package.json`, sin `node_modules`. El almacén nuevo es una capacidad del navegador, no un paquete |
| 2 · Documentado | ✅ Cumplido — existe `docs/constitucion.md`, `specs/` y `test/` |
| 3 · Lógica / DOM | ⚠️ **Mejorado**: la lógica vive en `js/logica/` y `js/datos/`, separada del DOM. `app.js` sigue mezclando lógica y dibujo, y sigue siendo grande |
| 4 · Probar es mirar | ✅ Dos caminos funcionando: **493 tests** con Node, `chrome-devtools` para la interfaz, y dos sondas que abren Chrome solas |
| 5 · Datos seguros | ✅ La **reversión** y los avisos están implementados en los cuatro caminos de escritura. El aviso de espacio **ya no existe**: ver el principio 5 |
| 6 · Español UTF-8 | ✅ Cumplido |

Sobre la fila 3: `app.js` ya no tiene lo peor. El almacenamiento —abrir, migrar, leer,
escribir— salió a `js/datos/almacenamiento.js`, y las reglas de las secciones de estudio a
`js/datos/secciones.js`. **Lo que queda dentro es sobre todo dibujo y conexión de eventos.**
Aun así mezcla cálculo y dibujo, y por eso sigue en amarillo.

Los que están en amarillo o rojo **no se arreglan de una**. Se mejoran de a poco, sin romper lo que ya funciona.

> **Una redacción que engaña.** La versión anterior decía que `app.js` estaba *"pendiente de
> refactorizar"*, como si hubiera un plan esperando. No lo hay, y la especificación 006
> decidió **explícitamente no seguir achicándolo**: lo que quedaría por mover son funciones
> cuyo comportamiento —los manejadores de clic— no se puede comprobar hoy, porque el
> comparador de árboles mira el HTML y los manejadores no están en el HTML.
>
> Un refactor que solo se puede comprobar abriendo la página a ojo no es un refactor, es un
> acto de fe. Y **el archivo anda**: no tiene un defecto, es grande. Grande no es roto.

---

## 4. Glosario

Porque estás empezando, estas son las palabras que vas a ver.

| Palabra | Qué significa |
|---------|---------------|
| **HTML** | La estructura de la página. Lo que se ve. |
| **CSS** | Cómo se ve: colores, espacios, tamaños. |
| **JavaScript** | Lo que hace: la lógica. |
| **DOM** | La estructura de la página una vez que el navegador la interpretó. "Los elementos de la página". |
| **`innerHTML`** | Pegar HTML dentro de un elemento. **Peligroso** con datos del usuario. |
| **`textContent`** | Poner texto plano dentro de un elemento. Siempre seguro. |
| **`localStorage`** | Memoria del navegador, donde todo es un texto con clave. **Donde vivía el cuaderno antes de la especificación 008.** Ahora solo se usa para leer los datos viejos y migrarlos, y **nunca se borra**: es la red, por si algo sale mal |
| **IndexedDB** | El almacén del navegador que **separa cada dato**. Es donde vive el cuaderno desde la especificación 008: el índice por un lado, cada archivo por otro. No es un paquete ni una instalación: es una capacidad del navegador |
| **`base64`** | Forma de guardar un archivo binario como texto. Agranda el tamaño un 33 %. |
| **Respaldo** | El archivo JSON que exportás. **Desde la especificación 008 incluye los cuatro grupos** —materias, minutos antiguos, historial de estudio y anotaciones—, no solo las materias |
| **XSS** | Un ataque donde un texto malicioso se ejecuta como código. |
| **CDN** | Servidor que te presta una librería. `cdnjs.cloudflare.com` es uno. |
| **iframe** | Una página dentro de otra. Acá la usamos para mostrar tus documentos. |
| **`npm install`** | Instalar dependencias. Este proyecto **no lo usa**. |
| **Función pura** | Una función que da el mismo resultado siempre, sin mirar la pantalla ni la hora real. Por eso puede probarse sola. |
| **`node --test`** | El runner de tests que ya viene en Node. Corre archivos `*.test.js`. No instala nada. |
| **Día de registro** | El día en que empezaste a estudiar, aunque la sesión termine después de medianoche. |

---

## Cómo usar este documento

- **Antes de tocar código:** leé los 6. Si tu cambio rompe alguno, no lo hagas.
- **Después de tocar código:** actualizá `AGENTS.md` (estructura) y `MEMORY.md` (qué funciona).
- **Cuando algo falle:** el principio 4 te dice exactamente dónde mirar.

Si algo de acá ya no es cierto —porque el proyecto cambió o entendiste mejor— **actualizalo**. Una constitución que miente es peor que no tenerla.
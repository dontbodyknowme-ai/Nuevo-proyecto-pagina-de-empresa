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

No es una app para publicar. Es una herramienta tuya. Eso freedom es lo que define cada decisión del proyecto.

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

**Por qué:** cuando la lógica y el dibujo están mezclados, cambiar el diseño rompe la lógica y viceversa. Son dos Battlefield distintos.

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
2. **Nunca** enviar datos a internet — el proyecto funciona entero sin red
3. **Siempre** confirmar antes de borrar: materia, documento o importación

**Y siempre tenés salida:** exportá antes de tocar algo importante.

```powershell
# Si algo sale mal, tu respaldo está en el JSON descargado
```

> **Límite que tenés que respetar:** el almacenamiento del navegador tiene un tope de ~5 MB. Los PDFs se guardan en base64, que los agranda un 33 %.
>
> **Regla:** nunca se pierde nada en silencio. Si el espacio se está agotando, el sistema **te avisa** y te ofrece exportar para liberar lugar antes de seguir subiendo.
> **El fallo silencioso ya no está permitido.** Es una deuda histórica, no un comportamiento aceptable.

---

### Principio 6 — Todo en español, siempre

Comentarios, nombres de variables y textos de la interfaz. En español. UTF-8 sin BOM.

**Por qué:** es tu proyecto y lo leés todos los días. Que se entienda a la primera es lo mínimo.

**Se verifica:** los archivos tienen que estar en UTF-8 sin BOM. Si se rompe, aparece `Anatom��a` en vez de `Anatomía`.

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
| 1 · Stack simple | ✅ Cumplido — sin `package.json`, sin `node_modules` |
| 2 · Documentado | ✅ Cumplido — existe `docs/constitucion.md`, `specs/` y `test/` |
| 3 · Lógica / DOM | ⚠️ **Mejorado**: la lógica nueva vive en `js/logica/` separada del DOM. `app.js` sigue mezclando, pendiente de refactorizar |
| 4 · Probar es mirar | ✅ Dos caminos funcionando: 91 tests con Node, chrome-devtools para la interfaz |
| 5 · Datos seguros | ✅ El aviso de almacenamiento y la reversión **ya están implementados** |
| 6 · Español UTF-8 | ✅ Cumplido |

Los que están en amarillo o rojo **no se arreglan de una**. Se mejoran de a poco, sin romper lo que ya funciona.

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
| **`localStorage`** | Memoria del navegador. Se borra si limpiás los datos del navegador. |
| **`base64`** | Forma de guardar un archivo binario como texto. Agranda el tamaño un 33 %. |
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
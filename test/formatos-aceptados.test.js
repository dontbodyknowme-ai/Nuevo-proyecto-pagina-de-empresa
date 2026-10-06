// ============================================
// QUÉ FORMATOS ACEPTA LA APLICACIÓN, Y POR QUÉ
// ============================================
//
// ## El problema: se aceptaba un archivo que no se puede abrir
//
// El selector de archivos aceptaba `.docx` **y `.doc`**, y `crearDocumento()` leía ambos
// como tipo `'word'`.
//
// Pero `mammoth` —la librería que convierte Word a HTML— **solo entiende `.docx`**. `.doc` es
// el formato binario de Word 97-2003, que no es un zip y mammoth no lo abre.
//
// Así que un `.doc` pasaba por todo el camino: se subía, se guardaba, aparecía en el menú con
// su nombre, y **al abrirlo salía "Error al convertir"**.
//
// Eso es lo peor de los dos mundos: la aplicación acepta algo que no puede hacer, y el
// usuario descubre la diferencia recién cuando lo quiere usar, con el archivo ya guardado.
//
// ## Lo que se decide acá
//
// Un archivo que la aplicación no puede abrir **no se acepta**. Es una decisión, y conviene
// que sea explícita en el código y no una excepción escondida en un `||`.
//
// ## Las tres capas, y por qué las tres
//
// 1. El `accept` del `<input>`: lo que el explorador deja elegir. Quitarlo **no** impide
//    subir un `.doc` —el `accept` es una sugerencia, y se puede arrastrar un archivo—.
// 2. `crearDocumento()`: lo que la aplicación **entiende**. Si no está aquí, el archivo se
//    rechaza con un mensaje que dice qué hacer.
// 3. El `accept` de `index.html`: tiene que coincidir con (1), o el explorador y la app
//   -prometen cosas distintas.
//
// Y por qué (1) no alcanza: **el `accept` es una sugerencia del navegador, no una regla.**
// Un `input type="file"` con `accept=".pdf"` deja elegir cualquier archivo igual. La regla
// está en (2).

const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const { cargarComoNavegador } = require('./dom-falso.js');

/**
 * Un archivo para probar, con la forma que el arnés espera.
 *
 * `_bytes` es lo que lee el `FileReader` del arnés. **No es una propiedad de `File`**: es
 * la forma que este arnés usa para los bytes de un archivo de prueba, y está escrito con
 * guion bajo justamente para que nadie lo confunda con algo real.
 */
function archivo(nombre, texto) {
    return { name: nombre, _bytes: Buffer.from(texto, 'latin1') };
}

const RAIZ = path.join(__dirname, '..');
const INDICE = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const APP = fs.readFileSync(path.join(RAIZ, 'js', 'app.js'), 'utf8');

// ---------- La regla: los formatos que la aplicación puede abrir ----------

test('la aplicación abre HTML, PDF y DOCX, y nada más', () => {
    // La lista de lo que sabe abrir. **Es una lista corta a propósito**: `.doc` no está, y
    // no por olvido.
    assert.match(APP, /extension === 'docx'/,
        'la app dejó de reconocer los .docx');

    assert.doesNotMatch(APP, /extension === 'docx' \|\| extension === 'doc'/,
        'la app todavía acepta `.doc`, que mammoth no puede abrir. El archivo se sube, se '
        + 'guarda, aparece en el menú, y al abrirlo dice "error al convertir"');
});

// ---------- El selector de archivos ----------

test('el selector no ofrece .doc, y sí ofrece .docx', () => {
    const accept = (INDICE.match(/id="inputArchivo"[^>]*accept="([^"]+)"/) || [])[1];

    assert.ok(accept, 'no se encontró el accept del selector de archivos');

    assert.match(accept, /\.docx/,
        `el selector no ofrece .docx: "${accept}"`);

    assert.doesNotMatch(accept, /(^|,)\.doc(,|$)/,
        `el selector ofrece .doc, que la aplicación no puede abrir: "${accept}". `
        + 'Ofrecer un formato que después no abre es peor que no ofrecerlo');
});

test('el selector ofrece los tres formatos que la app abre', () => {
    const accept = (INDICE.match(/id="inputArchivo"[^>]*accept="([^"]+)"/) || [])[1];

    for (const formato of ['.html', '.pdf', '.docx']) {
        assert.ok(accept.includes(formato),
            `el selector no ofrece "${formato}": "${accept}"`);
    }
});

// ---------- El mensaje cuando alguien arrastra un .doc igual ----------

test('un archivo que no se puede abrir se rechaza diciendo qué hacer', () => {
    // El `accept` **no** impide nada: se puede elegir cualquier archivo con el diálogo, o
    // arrastrarlo sobre la ventana. Así que la regla tiene que estar en la app, y cuando se
    // rechaza tiene que decir **qué hacer**, no solo que no puede.
    //
    // ## Por qué este test mira el aviso y no "la app en general"
    //
    // La primera versión buscaba las palabras "`.docx`" y "guardá" en todo el archivo. Dio
    // verde **sin que existiera ningún aviso**: las dos palabras ya estaban en un
    // comentario. Un test que busca una palabra en un archivo de mil líneas no comprueba
    // nada; comprueba que la palabra exista.
    const aviso = APP.match(/function avisarArchivosNoAceptados\([^)]*\)\s*\{([\s\S]*?)\n\}/);

    assert.ok(aviso, 'no existe el aviso de archivos no aceptados. Sin él, el usuario ve '
        + 'que el archivo no aparece y no sabe si la app está rota o qué hacer');

    const cuerpo = aviso[1];

    assert.match(cuerpo, /\.docx/,
        'el aviso no dice que los Word tienen que ser `.docx`');

    assert.match(cuerpo, /\.doc[^x]/,
        'el aviso no menciona los `.doc`, que son los que se están rechazando. El '
        + 'usuario tiene que entender por qué **su** archivo no entró');

    assert.match(cuerpo, /guard/i,
        'el aviso no dice cómo resolverlo. Decir "no se puede" sin decir cómo guardarlo '
        + 'bien deja al usuario sin salida');
});

// ---------- La decisión, que es donde está la regla de verdad ----------

test('un .doc se rechaza, y un .docx se acepta', () => {
    // El `accept` del selector es **una sugerencia del navegador**: con `accept=".pdf"` se
    // puede elegir cualquier archivo igual, y también se puede arrastrar. Así que la regla
    // real está acá, y es lo único que evita que un `.doc` entre.
    const contexto = cargarComoNavegador({
        cuadernoVirtual: '[]',
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    });
    const crear = contexto.contexto.CuadernoVirtual.crearDocumento;

    return Promise.all([
        // El `.doc` viejo: no entra.
        crear(archivo('TP.doc', 'algo')).then(doc => {
            assert.equal(doc, null,
                'un .doc volvió como documento. Se guarda, aparece en el menú, y al '
                + 'abrirlo dice "error al convertir"');
        }),

        // El `.docx`: entra, y con su contenido.
        crear(archivo('TP.docx', 'contenido')).then(doc => {
            assert.ok(doc, 'un .docx no entró. Es el formato que sí se puede abrir');
            assert.equal(doc.tipo, 'word');
            assert.equal(doc.nombre, 'TP.docx');
            // El contenido es el **archivo**, no el texto: un `.docx` se guarda en base64.
            assert.match(doc.contenido, /^data:.*;base64,/,
                'el contenido del .docx no es una URL de datos. La app lo guarda con '
                + '`readAsDataURL`, y al abrirlo lo descodifica con `bytesDeDocumento()`');
        }),

        // Un texto cualquiera: tampoco.
        crear(archivo('notas.txt', 'x')).then(doc => {
            assert.equal(doc, null, 'un .txt entró como documento');
        }),

        // Un PDF: entra, y la extensión en mayúsculas también.
        crear(archivo('parcial.PDF', '%PDF-1.4')).then(doc => {
            assert.ok(doc, 'un .PDF en mayúsculas no entró');
            assert.equal(doc.tipo, 'pdf');
        })
    ]);
});

// ---------- Lo que no hay que romper ----------

test('un .docx sigue siendo un documento de tipo word', () => {
    // Lo que sí funciona, y no hay que romper por el camino.
    const bloque = APP.match(/extension === 'docx'[^;]*;/);

    assert.ok(bloque, 'no se encuentra el reconocimiento del .docx');
    assert.match(bloque[0], /tipo = 'word'/,
        'un .docx dejó de ser tipo "word"');
});
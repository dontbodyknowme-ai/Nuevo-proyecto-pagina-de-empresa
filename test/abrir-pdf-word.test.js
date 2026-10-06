// ============================================
// ABRIR UN PDF Y UN WORD: LO QUE NECESITAN DE VERDAD
// ============================================
//
// ## El PDF: se le pasaba un texto donde pdf.js quiere bytes
//
// `fileToBase64()` usa `readAsDataURL`, así que lo que queda guardado **no es el archivo**:
// es el texto `data:application/pdf;base64,JVBERi0xLjQK…`.
//
// Y `cargarPDF()` hacía:
//
//     pdfjsLib.getDocument({ data: dataUrl });
//
// `data:` de pdf.js son **bytes**, no un texto. Pasarle la URL entera hace que el lector
// Tome los caracteres ASCII de "data:application/pdf;base64,JVBER…" como si fueran los
// bytes del archivo, y el PDF no abre. **Es el mismo bug dos veces**: el contenido llega al
// almacén bien, y se rompe recién al abrir.
//
// Lo importante: este error **no daba ningún aviso**. `cargarPDF()` tiene un `catch` que
// avisa, pero el error ocurre adentro de pdf.js, en otra promesa, y el `catch` no lo ve.
//
// ## El Word: el camino correcto, por accidente
//
// El Word hacía `fetch(contenido)`, y `fetch` **sí** decodifica una URL de datos. Por eso
// el Word nunca sufrió este bug: no porque estuviera bien escrito, sino porque pasó por una
// función del navegador que hacía el trabajo sin que nadie lo pidiera.
//
// Y eso tiene un coste: `fetch` de una URL de datos es una petición de red. El proyecto no
// manda datos a internet, pero depender de una petición para **abrir un archivo que ya
// está en tu computadora** es una dependencia que no hace falta.
//
// ## Lo que se hace
//
// **Un solo lugar** que convierte el texto guardado en bytes, y los dos caminos lo usan.
// PDF y Word dejan de depender de funciones distintas que casualmente dan lo mismo.

const test = require('node:test');
const assert = require('node:assert/strict');

const { cargarComoNavegador, crearIndexedDB } = require('./dom-falso.js');

// Un PDF mínimo y válido, en base64. Armado acá y no copiado: un literal partido en
// varias líneas es un error de sintaxis, y copiarlo a mano es la forma más rápida de
// escribir un PDF que no abre.
const PDF_BASE64 = Buffer.from([
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 992]'
        + '/Resources<</Font<</F1 7 0 R>>>>/Contents 4 0 R>>endobj',
    '4 0 obj<</Length 45>>stream',
    'BT /F1 24 Tf 72 720 Td (Parcial) Tj ET',
    'endstream endobj',
    '7 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
    'trailer<</Root 1 0 R/Size 8>>',
    '%%EOF'
].join('\n'), 'latin1').toString('base64');

const DATA_URL = 'data:application/pdf;base64,' + PDF_BASE64;

const PDF_BYTES = Buffer.from(DATA_URL.split(',')[1], 'base64');

// Un `.docx` es un zip, y **todo zip empieza con "PK"**. Con eso se comprueba que a
// mammoth le llegaron los bytes del archivo y no otra cosa.
//
// La primera versión de este test le daba a mammoth un **PDF** y después esperaba que
// empezara con "PK". El test era contradictorio: el código estaba haciendo bien la
// conversión de lo que se le había dado, y el test se quejaba.
const DOCX_BYTES = Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from('contenido')]);

/**
 * Carga la app con un documento guardado, ya separado del índice como en la realidad.
 *
 * @param {object} doc  el documento, con `nombre` y `tipo`
 * @param {Buffer} [carga] los bytes del archivo. Por defecto, un PDF.
 */
async function appConDocumento(doc, carga = PDF_BYTES) {
    const almacen = crearIndexedDB('bien');

    const datos = {
        cuadernoVirtual: JSON.stringify([{ id: 'm1', nombre: 'Matemáticas', documentos: [] }]),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    };

    const carga1 = cargarComoNavegador(datos, { indexedDB: almacen });
    await carga1.inicio;
    carga1.contexto.alert = () => {};

    const url = 'data:application/pdf;base64,' + carga.toString('base64');

    assert.equal(await carga1.contexto.CuadernoVirtual.guardarRevirtiendoSiFalla([{
        id: 'm1',
        nombre: 'Matemáticas',
        documentos: [{ id: 'd1', ...doc, contenido: url }]
    }]), true, 'no se pudo guardar el archivo de prueba');

    // **Devuelve el objeto, no el contexto.** La primera versión devolvía
    // `carga.contexto` y los tests hacían `const { contexto } = await appConDocumento(...)`,
    // así que `contexto` llegaba `undefined` y los cinco tests fallaban con un
    // `TypeError` que señalaba al test equivocado: el error decía "no existe la propiedad"
    // y hacía suspectar al código, que estaba bien.
    return { contexto: carga1.contexto, almacen };
}

// ---------- Los bytes, que es lo que los dos necesitan ----------

test('el contenido guardado es un texto con el archivo adentro, no el archivo', async () => {
    // La premisa. `readAsDataURL` deja el archivo **codificado dentro de un texto**, y
    // cualquier cosa que abra un archivo tiene que descodificarlo primero.
    const { contexto } = await appConDocumento({ nombre: 'Parcial.pdf', tipo: 'pdf' });

    const guardado = await contexto.AlmacenamientoDatos.leerContenido('d1');

    assert.equal(typeof guardado, 'string');
    assert.match(guardado, /^data:.*;base64,/,
        'el contenido guardado no es una URL de datos. Si esto cambia, hay que revisar '
        + 'los dos caminos de apertura, que asumen esta forma');
});

test('el texto guardado se convierte en los bytes del archivo', async () => {
    // **Este es el test del bug.** Lo que pdf.js y mammoth necesitan son **bytes**, y lo que
    // está guardado es un texto.
    //
    // La comprobación es directa: la salida tiene que **empezar con los bytes del PDF**
    // —`%PDF`— y no con la letra "d" de "data:". Una señal de que el archivo se está
    // leyendo entero como texto.
    const { contexto } = await appConDocumento({ nombre: 'Parcial.pdf', tipo: 'pdf' });

    const bytes = contexto.CuadernoVirtual.bytesDeDocumento(DATA_URL);

    // **`length`, no `instanceof`.** El arnés carga los scripts en su propio contexto, así
    // que el `Uint8Array` que devuelve la app **no es** el de este archivo, y `instanceof`
    // da `false` con bytes perfectamente buenos. Es el mismo problema que con
    // `deepStrictEqual`: el prototipo viene de otro lado.
    assert.ok(bytes && typeof bytes.length === 'number' && bytes.length > 0,
        'la conversión no devolvió bytes');

    const texto = Buffer.from(bytes).toString('latin1');

    assert.ok(texto.startsWith('%PDF'),
        `los bytes no empiezan con "%PDF": arrancan con "${texto.slice(0, 12)}". `
        + 'Se está leyendo el archivo como texto, y por eso pdf.js no lo puede abrir');

    assert.ok(texto.endsWith('%%EOF'),
        'a los bytes les falta el final del archivo: se cortaron en el medio');
});

test('convertir a bytes no inventa datos si el contenido no es una URL de datos', async () => {
    // Si algún día se guarda el archivo de otra forma, la conversión tiene que **decir que
    // no puede**, no devolver una lista vacía. Con una lista vacía, pdf.js falla con un
    // error que no menciona el problema real.
    const { contexto } = await appConDocumento({ nombre: 'a.pdf', tipo: 'pdf' });

    assert.equal(contexto.CuadernoVirtual.bytesDeDocumento('esto no es una URL'), null,
        'devolvió bytes para un texto que no es una URL de datos. Con una lista vacía el '
        + 'error que ve el usuario no dice que el archivo no se pudo leer');
});

test('convertir a bytes acepta el base64 pelado, sin el prefijo', async () => {
    // Los respaldos que exportó la versión anterior guardaban el contenido **con** el
    // prefijo, pero nada garantiza que todos lo tengan. Aceptar las dos formas es una
    // línea y evita que un respaldo viejo quede ilegible.
    const { contexto } = await appConDocumento({ nombre: 'a.pdf', tipo: 'pdf' });

    const bytes = contexto.CuadernoVirtual.bytesDeDocumento(PDF_BASE64);

    assert.ok(bytes && Buffer.from(bytes).toString('latin1').startsWith('%PDF'),
        'el base64 pelado no se convirtió. Un respaldo que lo traiga sin prefijo quedaría '
        + 'ilegible');
});

// ---------- Los dos caminos lo usan ----------

test('pdf.js recibe los bytes del archivo, no el texto guardado', async () => {
    // El bug, de punta a punta. Se intercepta lo que se le pasa a pdf.js y se mira qué
    // llega: si es el texto, el PDF no abre.
    const { contexto } = await appConDocumento({ nombre: 'Parcial.pdf', tipo: 'pdf' });

    let recibido;
    contexto.window = contexto;
    contexto['pdfjs-dist/build/pdf'] = {
        GlobalWorkerOptions: {},
        getDocument(par) {
            recibido = par.data;
            return { promise: Promise.resolve({ numPages: 1 }) };
        }
    };

    await contexto.CuadernoVirtual.verDocumento(
        { id: 'm1', nombre: 'Matemáticas' },
        { id: 'd1', nombre: 'Parcial.pdf', tipo: 'pdf' }
    );
    // `renderPDFPage()` queda pendiente: solo importa qué recibió pdf.js.

    assert.ok(recibido !== undefined, 'pdf.js no llegó a llamarse');

    assert.notEqual(typeof recibido, 'string',
        `pdf.js recibió un texto, y su "data:" son bytes. Con un texto, `
        + `toma los caracteres de "${String(recibido).slice(0, 30)}…" como si fueran el `
        + 'archivo, y el PDF no abre');

    assert.ok(Buffer.from(recibido).toString('latin1').startsWith('%PDF'),
        'lo que recibió pdf.js no son los bytes del archivo');
});

test('mammoth recibe los bytes, sin hacer una petición de red', async () => {
    // El Word pasaba por `fetch()`, que **sí** decodificaba —y por eso funcionaba, por
    // accidente—. Pero `fetch` de una URL de datos es una petición de red, y el proyecto
    // no necesita una para abrir un archivo que ya está en tu computadora.
    const { contexto } = await appConDocumento({ nombre: 'TP.docx', tipo: 'word' }, DOCX_BYTES);

    let recibido = null;
    let huboFetch = false;
    const fetchReal = contexto.fetch;

    contexto.fetch = (...args) => {
        huboFetch = true;
        return fetchReal ? fetchReal(...args) : Promise.reject(new Error('sin red'));
    };

    contexto.mammoth = {
        convertToHtml(opciones) {
            recibido = opciones;
            return Promise.resolve({ value: '<p>hola</p>' });
        }
    };

    await contexto.CuadernoVirtual.verDocumento(
        { id: 'm1', nombre: 'Matemáticas' },
        { id: 'd1', nombre: 'TP.docx', tipo: 'word' }
    );

    assert.equal(huboFetch, false,
        'abrir un Word hizo una petición de red para leer un archivo que ya está en el '
        + 'almacen. Sin internet, el archivo que está guardado no abre');

    assert.ok(recibido, 'mammoth no llegó a llamarse');

    const buffer = recibido.arrayBuffer;
    const bytes = new Uint8Array(buffer);
    const cabeza = Buffer.from(bytes.slice(0, 2)).toString('latin1');

    assert.equal(cabeza, 'PK',
        `a mammoth le llegó algo que no empieza con "PK", que es como empieza un .docx. `
        + `Llegó "${cabeza}"`);
});
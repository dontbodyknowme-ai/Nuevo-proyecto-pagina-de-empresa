// ============================================
// ABRIR UN DOCUMENTO CUANDO EL ÍNDICE NO TIENE SU CONTENIDO
// ============================================
//
// ## El defecto: los PDF no se podían leer
//
// Desde que el índice y los archivos están en almacenes distintos, el índice **no trae el
// contenido del documento**: trae nombre, tipo y fecha, y nada más. El archivo se pide
// cuando el usuario lo abre.
//
// Y `verDocumento()` hacía esto:
//
//     if (DatosLogica.documentoSinContenido(doc)) {
//         mostrarDocumentoSinContenido(doc);
//         return;
//     }
//     contenido = await AlmacenamientoDatos.leerContenido(doc.id);
//
// `documentoSinContenido()` responde **"¿el objeto que tenés trae contenido?"**. Y un PDF
// del índice **no lo trae**, porque el contenido está en otro almacén. Así que la función
// contestaba que sí faltaba, y **la lectura nunca llegaba a ejecutarse**.
//
// El usuario veía *"A este archivo le falta el contenido"* en cada PDF y en cada Word, sin
// importar que el archivo estuviera guardado.
//
// ## Por qué el HTML andaba
//
// Porque `documentoSinContenido()` tiene una excepción: un HTML vacío **se puede abrir**,
// sale un iframe en blanco, así que nunca lo da por faltante. Esa excepción, escrita para un
// caso legítimo, **tapaba el bug entero para los PDF**, que son justo los que no tienen
// excepción.
//
// O sea: la función no estaba mal. El que la llamaba estaba preguntando por el objeto
// equivocado: en vez de *"¿el archivo está guardado?"* preguntaba *"¿este objeto trae el
// archivo adentro?"*, y desde T5 la respuesta a esa pregunta siempre es que no.
//
// ## Lo que hay que mirar acá
//
// **No** que el visor dibuje algo. Que **no** muestre el panel de "sin contenido" cuando el
// archivo **sí está en el almacén**. El render del PDF es de una librería externa y no le
// corresponde a este archivo.

const test = require('node:test');
const assert = require('node:assert/strict');

const { cargarComoNavegador, crearIndexedDB } = require('./dom-falso.js');

const PDF = {
    id: 'd1',
    nombre: 'Parcial.pdf',
    tipo: 'pdf',
    // **Sin `contenido`.** Así viene un documento del índice desde que el contenido vive
    // en su propio almacén. Si este test lo incluyera, probaría el caso fácil.
};

// Un archivo **de verdad**, en base64. La primera versión usaba el texto
// `'BASE64-DEL-PDF'`, que no es base64: tiene letras, guiones y un guion medio.
//
// Pasó sin que se notara durante varios tests, porque nada lo descodificaba todavía.
// Cuando `bytesDeDocumento()` apareció —que es lo correcto— el fixture roto saltó, y el
// fallo parecía un defecto nuevo de la app.
//
// Un fixture que no parece un archivo real esconde todos los defectos que dependen de que
// el archivo sea real.
const ARCHIVO = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF',
    'latin1').toString('base64');

const DATA_URL = 'data:application/pdf;base64,' + ARCHIVO;

/**
 * Carga la app con un PDF guardado **solo** en el almacén de contenidos.
 *
 * @param {string|null} contenidoLoQueHay el contenido del archivo en el almacén:
 *   la URL de datos si está, `null` si de verdad no está.
 */
async function appConPdf(contenidoLoQueHay) {
    const almacen = crearIndexedDB('bien');

    // El índice: **sin contenido**, que es como llega de verdad.
    const carga = cargarComoNavegador({
        cuadernoVirtual: JSON.stringify([{
            id: 'm1', nombre: 'Matemáticas', documentos: [PDF]
        }]),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    }, { indexedDB: almacen });

    await carga.inicio;

    // Se sube el archivo por el camino de la app, como lo haría el usuario. Así queda en
    // el almacén de contenidos y **no** en el índice.
    const conArchivo = [{
        id: 'm1',
        nombre: 'Matemáticas',
        documentos: [{ ...PDF, contenido: contenidoLoQueHay }]
    }];

    const alertas = [];
    carga.contexto.alert = (t) => { alertas.push(t); };

    assert.equal(await carga.contexto.CuadernoVirtual.guardarRevirtiendoSiFalla(conArchivo), true,
        'no se pudo guardar el archivo de prueba');

    // **Recarga**: recién acá el documento vuelve a tener el contenido en `null`, porque
    // el índice no lo trae. Es el estado en el que estaba el usuario al abrir su cuaderno.
    const segunda = cargarComoNavegador({
        cuadernoVirtual: JSON.stringify([{
            id: 'm1', nombre: 'Matemáticas', documentos: [PDF]
        }]),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    }, { indexedDB: almacen });

    await segunda.inicio;

    return { contexto: segunda.contexto, visor: segunda.contexto.document.getElementById('visor') };
}

/**
 * Todos los textos que hay dentro del visor, juntando hijos y nietos.
 *
 * ## Por qué no se lee `innerHTML`
 *
 * Porque **el visor nunca se arma con `innerHTML`**. El panel de "sin contenido" se arma
 * con `appendChild`, que en el arnés deja `innerHTML` en `''`. La primera versión de estos
 * tests leía `innerHTML` y por eso **los dos primeros pasaban y el tercero fallaba**: no
 * estaban mirando el árbol, estaban mirando un string que nunca se escribe.
 *
 * Es el patrón de siempre: un test que no encuentra lo que busca pasa igual. Y acá era al
 * revés —encontraba algo falso— que es peor, porque el verde esconde el bug.
 */
function textosDe(el) {
    const salida = [];

    const visitar = (nodo) => {
        if (!nodo) return;
        if (typeof nodo.textContent === 'string') salida.push(nodo.textContent);
        for (const hijo of (nodo.hijos || [])) visitar(hijo);
    };

    visitar(el);
    return salida.join(' | ');
}

test('un PDF guardado en el almacén se abre, aunque el índice no traiga su contenido', async () => {
    const { contexto, visor } = await appConPdf(DATA_URL);

    await contexto.CuadernoVirtual.verDocumento(
        { id: 'm1', nombre: 'Matemáticas' },
        { ...PDF }
    );

    assert.doesNotMatch(textosDe(visor), /le falta el contenido/,
        'el visor muestra "A este archivo le falta el contenido" para un PDF que **sí** '
        + 'está guardado. El archivo está en el almacén de contenidos; lo que no lo trae '
        + 'es el índice, y por eso la app tiene que ir a buscarlo');
});

test('un Word guardado en el almacén también se abre', async () => {
    // El mismo camino que el PDF: `documentoSinContenido()` no distingue los dos, así que
    // el bug los rompía a los dos.
    const { contexto, visor } = await appConPdf(DATA_URL);

    await contexto.CuadernoVirtual.verDocumento(
        { id: 'm1', nombre: 'Matemáticas' },
        { ...PDF, tipo: 'word', nombre: 'TP.docx' }
    );

    assert.doesNotMatch(textosDe(visor), /le falta el contenido/,
        'un Word guardado tampoco se puede abrir');
});

test('un PDF que de verdad no está guardado sí avisa', async () => {
    // Y el otro lado, que es el que hace útil el aviso: **lo que no se inventó nada**.
    // Un archivo que no está en el almacén tiene que decir que no está, no abrir en blanco
    // y hacer creer al usuario que el PDF está vacío.
    const { contexto, visor } = await appConPdf(null);

    await contexto.CuadernoVirtual.verDocumento(
        { id: 'm1', nombre: 'Matemáticas' },
        { ...PDF }
    );

    assert.match(textosDe(visor), /le falta el contenido/,
        'un archivo que no está en el almacén se abrió igual. El usuario creería que el '
        + 'PDF está vacío');
});

test('el índice no trae el contenido del documento, y eso es lo esperado', async () => {
    // La premisa de todo lo de arriba, comprobada. Si este test falla, el problema **no**
    // es `verDocumento()`: es que el índice volvió a traer los archivos adentro, que es lo
    // que la separación de almacenes vino a evitar.
    const { contexto } = await appConPdf(DATA_URL);

    const grupo = await contexto.AlmacenamientoDatos.leerGrupos();

    assert.equal(grupo.materias[0].documentos[0].contenido, undefined,
        'el índice volvió a traer el contenido del documento. Arrancar cargaría el '
        + 'cuaderno entero, que es justo lo que la separación vino a evitar');

    // Lo que se guarda es la **URL de datos entera**, no el base64 pelado: eso es lo que
    // devuelve `readAsDataURL`. Y el fallo lo mostrou claro: el valor esperado era el
    // base64 solo, y el guardado traía el prefijo.
    assert.equal(await contexto.AlmacenamientoDatos.leerContenido('d1'), DATA_URL,
        'el contenido no está en su almacén. El archivo se perdió al guardar');
});
// ============================================
// EL RESPALDO: LOS CUATRO GRUPOS, Y LO QUE NO SE PIERDE
// ============================================
//
// Cubre: RF-5 de specs/008-almacenamiento-real/spec.md
//
// ## El defecto que vino a arreglar
//
// El respaldo de hoy lleva **una sola cosa**: las materias. Y, peor, las lleva **sin el
// contenido de los documentos**.
//
// `doc.contenido` **solo se llena cuando el usuario abre el documento**. Al arrancar, la
// lista de materias se carga del índice y todos los documentos vienen con el contenido en
// `null`. Así que un respaldo exportado en una sesión nueva traía la lista de archivos
// **sin ninguno de los archivos**:
//
//     "documentos": [{ "nombre": "Parcial.pdf", "tipo": "pdf", "contenido": null }]
//
// Y al importarlo, cada documento aparecía con *"A este archivo le falta el contenido"*.
//
// O sea: **el respaldo funcionaba, y no respaldaba nada.** Un usuario que confiara en él
// descubriría que perdió todos sus archivos, y el aviso que vería al importar hablaría de
// documentos sin contenido —como si siempre hubieran estado así— en vez de decir que el
// respaldo no los traía.
//
// ## Y el historial también se perdía
//
// El respaldo tampoco incluía las **secciones de estudio** ni las **anotaciones del
// calendario**, así que exportar e importar era, para el mapa de calor y el calendario,
// **borrar todo** sin avisar.
//
// Las reglas de qué entra y qué pasa cuando algo falta están en
// `js/logica/datos.js` y son **puras**: no saben nada del navegador, ni de archivos, ni de
// descargas. Lo que las usa es `app.js`.

const test = require('node:test');
const assert = require('node:assert/strict');

const Datos = require('../js/logica/datos.js');

// ---------- Armar el respaldo ----------

test('el respaldo lleva los cuatro grupos', () => {
    // El criterio, directo. Los cuatro grupos son las materias, los minutos heredados, el
    // historial de estudio por secciones y las anotaciones del calendario.
    const datos = Datos.armarRespaldo({
        materias: [{ id: 'm1', nombre: 'Matemáticas', documentos: [] }],
        heredados: [{ fecha: '2026-10-01T00:00:00.000Z', minutos: 25 }],
        estudio: [{ inicioMs: 0, finMs: 1500000 }],
        anotaciones: { '01/10/2026': [] }
    });

    assert.ok(Array.isArray(datos.materias), 'faltan las materias');
    assert.ok(Array.isArray(datos.heredados), 'faltan los minutos heredados');
    assert.ok(Array.isArray(datos.estudio), 'falta el historial de estudio');
    assert.ok(typeof datos.anotaciones === 'object' && datos.anotaciones !== null,
        'faltan las anotaciones del calendario');
});

test('el respaldo guarda el contenido de los documentos, no solo el nombre', () => {
    // **El defecto original.** El índice y los archivos están en almacenes distintos desde
    // T5, y en memoria el contenido solo se llena al abrir el documento. Armar el respaldo
    // desde el índice produce un archivo que **no sirve para restaurar nada**.
    //
    // Por eso el respaldo no se arma solo con el índice: quien lo arma tiene que traer los
    // contenidos ya leídos, y si no puede, **no arma nada** (eso lo comprueba el app.js,
    // y acá se comprueba que la función no los inventa).
    const indice = [{ id: 'd1', nombre: 'Parcial.pdf', tipo: 'pdf', contenido: null }];

    const datos = Datos.armarRespaldo({
        materias: [{ id: 'm1', nombre: 'M', documentos: indice }],
        heredados: [],
        estudio: [],
        anotaciones: {},
        contenidos: { d1: 'base64-del-pdf' }
    });

    const doc = datos.materias[0].documentos[0];

    assert.equal(doc.contenido, 'base64-del-pdf',
        'el respaldo salió con el contenido en null. Importarlo deja todos los '
        + 'documentos sin archivo');
});

test('un contenido vacío en el respaldo no se inventa', () => {
    // Si el archivo del documento estaba vacío de verdad, el respaldo tiene que traerlo
    // vacío. Poner algo sería inventar datos del usuario.
    const datos = Datos.armarRespaldo({
        materias: [{ id: 'm1', nombre: 'M', documentos: [{ id: 'd1', nombre: 'x.html', tipo: 'html', contenido: '' }] }],
        heredados: [],
        estudio: [],
        anotaciones: {},
        contenidos: { d1: '' }
    });

    assert.equal(datos.materias[0].documentos[0].contenido, '');
});

test('un documento sin contenido no se borra del índice', () => {
    // Y el otro lado de la regla: **un documento nunca se borra del respaldo**. Sigue con
    // su nombre, aunque su contenido no haya venido. Perderlo en silencio sería peor que
    // mostrarlo roto: el usuario no sabría ni qué tenía.
    //
    // ## Por qué el caso del que se puede hablar es el HTML
    //
    // La primera versión de este test usaba un PDF sin contenido y **se contradecía con
    // el de abajo**: mismo dato de entrada, y los dos no pueden ser ciertos a la vez. Con
    // un PDF sin contenido, `armarRespaldo()` devuelve el nombre del documento y no arma
    // nada —que es lo correcto— así que no hay un índice del que mirar si el documento
    // quedó.
    //
    // Con un HTML vacío sí se arma el respaldo: un HTML vacío **se puede abrir**, sale un
    // iframe en blanco, y no es un archivo que se perdió. Ahí sí se puede comprobar que el
    // documento sigue ahí.
    const datos = Datos.armarRespaldo({
        materias: [{
            id: 'm1',
            nombre: 'M',
            documentos: [
                { id: 'd1', nombre: 'con-tenido.pdf', tipo: 'pdf', contenido: 'base64' },
                { id: 'd2', nombre: 'nota.html', tipo: 'html' }
            ]
        }],
        heredados: [],
        estudio: [],
        anotaciones: {},
        contenidos: { d1: 'base64', d2: '' }
    });

    const documentos = datos.materias[0].documentos;

    assert.equal(documentos.length, 2, 'un documento desapareció del índice');
    assert.deepEqual(documentos.map(d => d.nombre), ['con-tenido.pdf', 'nota.html']);
});

test('el respaldo no se arma si falta el contenido de un documento', () => {
    // **La regla que de verdad importa.** Un respaldo al que le falta un archivo es peor
    // que no tener respaldo: el usuario lo descubre cuando ya lo necesitaba, y para entonces
    // puede haber pisado lo que sí tenía.
    //
    // Por eso, si hay un documento **sin contenido**, `armarRespaldo()` no devuelve un
    // respaldo: devuelve **el nombre del documento**, que es la señal de "no se armó".
    //
    // ## Por qué un nombre y no `null`
    //
    // La primera versión pedía `null` y se contradijo con el test de al lado, que pedía un
    // texto. El nombre es lo correcto: **`null` no le dice al usuario qué archivo falta**,
    // y sin eso no puede ir a buscarlo ni decidir qué hacer.
    const datos = Datos.armarRespaldo({
        materias: [{ id: 'm1', nombre: 'M', documentos: [{ id: 'd1', nombre: 'a.pdf', tipo: 'pdf' }] }],
        heredados: [],
        estudio: [],
        anotaciones: {},
        contenidos: {}
    });

    assert.equal(typeof datos, 'string',
        'se armó un respaldo sin el contenido de un documento. El usuario lo descubre '
        + 'cuando ya lo necesitaba, y para entonces puede haber pisado lo que sí tenía');

    assert.equal(Array.isArray(datos), false,
        'devolvió una lista de grupos en vez de la señal de que no se armó nada');
});

test('el respaldo dice qué documento no se pudo leer', () => {
    // No alcanza con no armar nada: el usuario tiene que saber **cuál** archivo falta, o
    // no puede ir a buscarlo.
    const datos = Datos.armarRespaldo({
        materias: [{ id: 'm1', nombre: 'Matemáticas', documentos: [{ id: 'd1', nombre: 'a.pdf', tipo: 'pdf' }] }],
        heredados: [],
        estudio: [],
        anotaciones: {},
        contenidos: {}
    });

    assert.equal(typeof datos, 'string',
        'tiene que decir qué documento no se pudo leer, no solo que no se pudo leer');
    assert.match(datos, /a\.pdf/,
        `no nombra el documento que falta: "${datos}"`);
});

test('un HTML sin contenido no impide armar el respaldo', () => {
    // Un HTML vacío **se puede abrir**: sale un iframe en blanco, y eso es honesto. Es la
    // misma regla de `documentoSinContenido()`, y tiene que valer acá también: un
    // documento vacío de verdad no es un documento que se perdió.
    const datos = Datos.armarRespaldo({
        materias: [{ id: 'm1', nombre: 'M', documentos: [{ id: 'd1', nombre: 'nota.html', tipo: 'html' }] }],
        heredados: [],
        estudio: [],
        anotaciones: {},
        contenidos: { d1: '' }
    });

    assert.notEqual(datos, null,
        'no se armó el respaldo por un HTML vacío, que es un documento válido y vacío');
});

// ---------- Leer un respaldo ----------

test('un respaldo con los cuatro grupos restaura los cuatro', () => {
    const leido = Datos.leerRespaldo({
        materias: [{ id: 'm1', nombre: 'Matemáticas', documentos: [] }],
        heredados: [{ fecha: '2026-10-01T00:00:00.000Z', minutos: 25 }],
        estudio: [{ inicioMs: 0, finMs: 1500000 }],
        anotaciones: { '01/10/2026': [] }
    });

    assert.equal(leido.trae.materias, true);
    assert.equal(leido.trae.heredados, true);
    assert.equal(leido.trae.estudio, true);
    assert.equal(leido.trae.anotaciones, true);
    assert.equal(leido.materias.length, 1);
    assert.equal(leido.estudio.length, 1);
    assert.deepEqual(leido.anotaciones, { '01/10/2026': [] });
});

test('un respaldo viejo, con solo materias, dice qué no trae', () => {
    // Los respaldos que se exportaron antes no tienen historial ni calendario. **No se puede
    // saber si estaban vacíos**: el archivo simplemente no lo dice.
    //
    // Y por eso el aviso tiene que decir *"no trae"*, y **no** *"están vacíos"*. La
    // diferencia es la diferencia entre "el archivo no lo tiene" y "no tenés nada": lo
    // primero es un hecho; lo segundo es una afirmación que puede ser falsa, y si es
    // falsa significa que hay historial que se acaba de perder.
    const leido = Datos.leerRespaldo({ materias: [] });

    assert.equal(leido.trae.materias, true);
    assert.equal(leido.trae.heredados, false);
    assert.equal(leido.trae.estudio, false);
    assert.equal(leido.trae.anotaciones, false);

    assert.ok(leido.faltantes.includes('estudio'),
        'no dice que al respaldo le falta el historial de estudio');
    assert.ok(leido.faltantes.includes('anotaciones'),
        'no dice que al respaldo le falta el calendario');
});

test('un respaldo viejo no borra el historial que el usuario ya tenía', () => {
    // **La consecuencia de lo anterior, y es la importante.**
    //
    // Importar un respaldo viejo **no puede vaciar** el mapa de calor y el calendario de
    // quien lo importa. El archivo no trae historial: eso no significa que el usuario no
    // tenga, significa que el archivo no lo tiene.
    //
    // Por eso los grupos que el archivo no trae se dejan como estaban.
    const leido = Datos.leerRespaldo({ materias: [{ id: 'm1', nombre: 'M', documentos: [] }] });

    assert.equal(leido.reemplazar.heredados, false,
        'el respaldo va a pisar los minutos heredados, que el archivo no trae');
    assert.equal(leido.reemplazar.estudio, false,
        'el respaldo va a pisar el historial de estudio, que el archivo no trae');
    assert.equal(leido.reemplazar.anotaciones, false,
        'el respaldo va a pisar el calendario, que el archivo no trae');
});

test('un respaldo con los cuatro grupos sí reemplaza los cuatro', () => {
    const leido = Datos.leerRespaldo({
        materias: [],
        heredados: [],
        estudio: [],
        anotaciones: {}
    });

    for (const grupo of ['materias', 'heredados', 'estudio', 'anotaciones']) {
        assert.equal(leido.reemplazar[grupo], true,
            `el respaldo trae "${grupo}" y no lo va a reemplazar: lo que hay en la `
            + 'aplicación sobrevive a una importación que el usuario pidió');
    }
});

test('un respaldo sin lista de materias no se puede importar', () => {
    // Sin materias no hay un cuaderno: no hay nada que reemplazar. Y no se "empieza de
    // cero", porque eso **borraría** lo que el usuario tiene.
    const leido = Datos.leerRespaldo({});

    assert.equal(leido.importable, false,
        'dijo que se puede importar un archivo sin materias. Importarlo vaciaría el '
        + 'cuaderno del usuario');
});

test('un respaldo con datos raros se importa y anota el problema', () => {
    // La regla del módulo, sin cambios: **un dato raro se completa y se avisa; nunca se
    // descarta**. Un respaldo con una materia sin lista de documentos se importa, esa
    // materia llega con una lista vacía, y el problema queda anotado para el cartel de
    // arriba.
    const leido = Datos.leerRespaldo({
        materias: [{ id: 'm1', nombre: 'Matemáticas' }],
        estudio: []
    });

    assert.equal(leido.importable, true);
    assert.deepEqual(leido.materias[0].documentos, [],
        'la materia sin lista de documentos no llegó normalizada');
    assert.ok(leido.problemas.length > 0,
        'normalizó la materia y no anotó por qué: el dato raro se corrige en silencio');
});

test('una sección de estudio sin números no rompe la lectura del respaldo', () => {
    // El mismo camino raro en el historial. Un respaldo importado a mano puede traer
    // cualquier cosa, y un `undefined` en un `finMs` haría que el mapa de calor calcule
    // `NaN` en lugar de fallar.
    const leido = Datos.leerRespaldo({
        materias: [],
        estudio: [null, { inicioMs: 'x' }, { inicioMs: 0, finMs: 1500000 }]
    });

    assert.equal(leido.estudio.length, 1,
        'el historial salió con registros que no son secciones');
    assert.deepEqual(leido.estudio[0], { inicioMs: 0, finMs: 1500000 });
});
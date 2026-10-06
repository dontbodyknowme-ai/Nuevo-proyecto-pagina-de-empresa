// ============================================
// ÍNDICE EN MEMORIA, ARCHIVOS A PEDIDO
// ============================================
//
// Cubre: RF-1 de specs/008-almacenamiento-real/spec.md
// Ver: specs/008-almacenamiento-real/spec.md, "Cómo se lee el cuaderno"
//
// ## Por qué esto es una tarea y no un detalle
//
// El cuaderno de un año de apuntes pesa. Si **todo** se cargara al arrancar, la app
// costaría lo mismo abrirla por la mañana que después de subir el año entero. Lo
// chico —nombres, tipos, fechas, minutos— puede estar entero en memoria sin que se
// note; lo que pesa se pide solo cuando hace falta.
//
// Y el contrato público **no se toca**: `minutosDeEstudioPorDia()` sigue siendo
// sincrónica. Volverla asíncrona ya dejó el mapa de calor en blanco una vez.

const test = require('node:test');
const assert = require('node:assert');

const { cargarComoNavegador, crearIndexedDB } = require('./dom-falso.js');

// `separarIndice()` es pura: no toca el almacén, solo parte una estructura. Por eso se
// puede probar en Node, y por eso tiene sus propios tests acá y no solo a través de la
// migración.
const { separarIndice } = require('../js/datos/almacenamiento.js');

// ---------- La función pura: partir el índice ----------

test('separarIndice · saca el contenido y lo deja aparte', () => {
    const { indice, contenidos } = separarIndice([
        { id: 'm1', nombre: 'Materia', documentos: [
            { id: 'd1', nombre: 'A', tipo: 'pdf', contenido: 'PDF' }
        ] }
    ]);

    assert.equal(contenidos.d1, 'PDF', 'el contenido tiene que estar en el diccionario');
    assert.equal(indice[0].documentos[0].contenido, undefined,
        'el contenido tiene que haber salido del índice');
});

test('separarIndice · el índice conserva lo que el menú necesita', () => {
    const { indice } = separarIndice([
        { id: 'm1', nombre: 'Materia', documentos: [
            { id: 'd1', nombre: 'Parcial', tipo: 'pdf', contenido: 'PDF' }
        ] }
    ]);

    assert.deepEqual(indice[0].documentos[0],
        { id: 'd1', nombre: 'Parcial', tipo: 'pdf' },
        'sin el contenido, el documento tiene que conservar id, nombre y tipo');
});

// Un documento **vacío** y uno **roto** no son lo mismo. Marcar vacío como si le
// faltara el contenido haría que el visor diga que al usuario le falta un archivo que
// en realidad tiene.
test('separarIndice · un documento sin contenido sigue en el índice', () => {
    const { indice, contenidos } = separarIndice([
        { id: 'm1', nombre: 'Materia', documentos: [
            { id: 'd1', nombre: 'Vacío', tipo: 'html', contenido: '' },
            { id: 'd2', nombre: 'Sin nada', tipo: 'pdf' }
        ] }
    ]);

    assert.equal(indice[0].documentos.length, 2,
        'no se puede descartar un documento: el usuario tiene que verlo y decidir');
    assert.deepEqual(Object.keys(contenidos), ['d1'],
        'el vacío sí es un contenido: es una cadena vacía, no "no hay"');
});

// Si mutara lo que recibe, el llamador quedaría con un objeto al que ya no le puede
// volver a preguntar por el contenido.
test('separarIndice · NO muta lo que recibe', () => {
    const original = [{
        id: 'm1', nombre: 'Materia',
        documentos: [{ id: 'd1', nombre: 'A', tipo: 'pdf', contenido: 'PDF' }]
    }];

    separarIndice(original);

    assert.equal(original[0].documentos[0].contenido, 'PDF',
        'separar el índice le sacó el contenido al objeto original. El llamador ya '
        + 'no puede volver atrás, y con un PDF dentro de un PDF cargado no hay forma '
        + 'de recuperarlo');
});

// ---------- Lo que pasa con datos que no tienen la forma ----------

test('separarIndice · una materia sin lista de documentos no rompe nada', () => {
    const { indice, contenidos } = separarIndice([
        { id: 'm1', nombre: 'Sin documentos' }
    ]);

    assert.deepEqual(indice, [{ id: 'm1', nombre: 'Sin documentos', documentos: [] }]);
    assert.deepEqual(contenidos, {});
});

test('separarIndice · algo que no es una lista de materias no rompe nada', () => {
    // Es el caso de un respaldo raro. La función no puede lanzar: una excepción
    // stopping la migración dejaría al usuario sin acceso a su propio cuaderno.
    assert.deepEqual(separarIndice(null), { indice: [], contenidos: {} });
    assert.deepEqual(separarIndice('no soy nada'), { indice: [], contenidos: {} });
    assert.deepEqual(separarIndice(42), { indice: [], contenidos: {} });
});

// Una materia con un documento **que tiene contenido**, que es lo que hace visible la
// separación entre el índice y los archivos.
const UN_PDF = 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoK'.repeat(40);

const MATERIAS = [{
    id: 'm1',
    nombre: 'Matemáticas',
    documentos: [
        { id: 'd1', nombre: 'Parcial 1', tipo: 'pdf', contenido: UN_PDF },
        { id: 'd2', nombre: 'Apuntes', tipo: 'html', contenido: '<p>apuntes</p>' }
    ]
}];

// Un día que tiene **una sesión del formato heredado y una de estudio**: es el caso
// donde los mismos minutos se podrían contar dos veces si los dos grupos vivieran en
// lugares distintos y uno se cargara antes de que terminara la copia.
//
// Las fechas van **en ISO**, como las que hay guardadas de verdad: los registros
// heredados son del formato viejo y llevan marca de tiempo. Y las secciones nuevas
// llevan `inicioMs`/`finMs` en milisegundos, que es lo que escribe
// `js/datos/secciones.js`.
const HEREDADOS = [{ fecha: '2026-10-01T09:00:00.000Z', minutos: 25 }];
const ESTUDIO = [{
    inicioMs: Date.parse('2026-10-01T10:00:00.000Z'),
    finMs: Date.parse('2026-10-01T10:47:00.000Z')
}];

function datosViejos() {
    return {
        cuadernoVirtual: JSON.stringify(MATERIAS),
        pomodoroSesiones: JSON.stringify(HEREDADOS),
        mapaCalorSecciones: JSON.stringify(ESTUDIO),
        calendarioAnotaciones: JSON.stringify({ '01/10/2026': [] })
    };
}

async function app(datos = datosViejos(), opciones = {}) {
    const carga = cargarComoNavegador(datos, opciones);
    await carga.inicio;
    return { contexto: carga.contexto, mod: carga.contexto.AlmacenamientoDatos };
}

// ---------- La separación: índice y archivos ----------

test('el índice del cuaderno NO trae el contenido de los documentos', async () => {
    const { mod } = await app();

    const grupos = await mod.leerGrupos();
    const indice = grupos.materias;

    assert.ok(Array.isArray(indice), 'las materias tienen que estar en el índice');
    assert.equal(indice.length, 1);

    for (const documento of indice[0].documentos) {
        assert.equal(
            documento.contenido, undefined,
            'el documento "' + documento.nombre + '" todavía trae su contenido en el '
            + 'índice. Con un cuaderno de 200 MB, cargar el índice cargaría los 200 MB '
            + 'y abrir la app costaría lo mismo después de subir el año entero'
        );
    }

    // El contenido se conserva: se separó, no se perdió.
    assert.equal(await mod.leerContenido('d1'), UN_PDF);
    assert.equal(await mod.leerContenido('d2'), '<p>apuntes</p>');
});

test('lo que importa del documento sobrevive en el índice', async () => {
    // Separar no puede perder lo que la app necesita para dibujar el menú.
    const { mod } = await app();

    const documentos = (await mod.leerGrupos()).materias[0].documentos;

    assert.deepEqual(
        documentos.map(d => ({ id: d.id, nombre: d.nombre, tipo: d.tipo })),
        [
            { id: 'd1', nombre: 'Parcial 1', tipo: 'pdf' },
            { id: 'd2', nombre: 'Apuntes', tipo: 'html' }
        ]
    );
});

test('un documento sin contenido sigue en el índice', async () => {
    // Separar no puede inventar contenido donde no lo hay: un documento vacío
    // aparece en el menú y se avisa al abrirlo. Marcarlo como roto sería mentir.
    const { mod } = await app();

    const grupos = await mod.leerGrupos();

    assert.equal(grupos.materias[0].documentos.length, 2);
    assert.equal(await mod.leerContenido('no-existe'), undefined,
        'un documento que no existe no tiene contenido: no se inventa');
});

// ---------- Después de migrar, del viejo no se lee nada ----------

test('después de migrar, el cuaderno se arma con los datos del almacén NUEVO', async () => {
    // Este es el criterio que T4 no podía comprobar. El truco es cambiar lo que hay
    // en el almacén viejo **después** de migrar: si la app leyera de ahí, el menú
    // mostraría la otra materia.
    const compartido = crearIndexedDB('bien');

    const primera = await app(datosViejos(), { indexedDB: compartido });
    assert.equal(await primera.mod.estaMigrada(), true, 'la migración tiene que estar');

    const segunda = cargarComoNavegador({
        cuadernoVirtual: JSON.stringify([
            { id: 'otra', nombre: 'Fisica', documentos: [] }
        ]),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    }, { indexedDB: compartido });

    await segunda.inicio;

    // Lo que se ve sale del almacén nuevo.
    const arbol = segunda.contexto.document.getElementById('arbolNavegacion');
    const texto = JSON.stringify(arbol.hijos);

    assert.ok(texto.includes('Matem'),
        'el menú no muestra la materia migrada. O no migró, o la app sigue '
        + 'leyendo del almacén viejo');

    assert.ok(!texto.includes('Fisica'),
        'el menú muestra la materia del almacén VIEJO. Después de migrar, del viejo '
        + 'no se lee nada: los datos nuevos se escribirían donde nadie los vuelve a leer');
});

// ---------- Los minutos, una vez y no dos ----------

test('un día con una sesión heredada y una de estudio muestra sus minutos UNA vez', async () => {
    // Este criterio ya estaba escrito en la spec, y falla si los dos grupos de
    // minutos quedan en lugares distintos con ritmos de carga distintos.
    //
    // **El valor sale del dominio, no de lo que yo esperaba.** Un día que tiene las dos
    // fuentes **las suma**: 25 del heredado + 47 de la sección = **72**. Y lo que
    // habría que ver si el doble conteo volviera es **97** — el heredado dos veces.
    //
    // La primera vez que escribí este test puse 47, que era el valor de una sola
    // fuente: el dominio nunca dijo eso. Un test escrito contra un número inventado
    // comprueba el número inventado.
    const { contexto } = await app();

    const totales = contexto.CuadernoVirtual.minutosDeEstudioPorDia();
    const delDia = totales['01/10/2026'];

    assert.equal(
        delDia, 72,
        'El 01/10/2026 tiene 25 minutos heredados y 47 de estudio, y los dos se suman: '
        + '72. Da ' + delDia + '. Si el heredado se contara dos veces daría 97'
    );

    assert.notEqual(
        delDia, 97,
        'los minutos heredados se están contando DOS veces. Es lo que pasa cuando los '
        + 'dos grupos de minutos se leen de lugares distintos y uno quedó cargado '
        + 'antes de que terminara la copia'
    );
});

// ---------- El contrato público no se toca ----------

test('minutosDeEstudioPorDia sigue siendo sincrónica', async () => {
    // Si volviera a ser una promesa, `js/inicio-calendario.js` —que la consume sin
    // esperar— dejaría el mapa de calor en blanco. Ya pasó una vez.
    const { contexto } = await app();

    const totales = contexto.CuadernoVirtual.minutosDeEstudioPorDia();

    assert.ok(totales && typeof totales === 'object' && !(totales instanceof Promise),
        'minutosDeEstudioPorDia tiene que devolver los totales directo, no una promesa');

    assert.equal(typeof contexto.CuadernoVirtual.minutosDeEstudioPorDia, 'function');
});

// ---------- El contenido se pide cuando se abre ----------

test('el contenido NO se pide al arrancar: se pide al abrir el documento', async () => {
    const { mod } = await app();

    // Antes de abrir nada, el módulo no tiene el contenido en memoria.
    assert.equal(mod.contenidosEnMemoria(), 0,
        'arrancó con ' + mod.contenidosEnMemoria() + ' contenidos en memoria. '
        + 'El punto de la tarea es que no se carguen al arrancar');

    await mod.leerContenido('d1');

    assert.equal(mod.contenidosEnMemoria(), 1,
        'después de pedir uno, tiene que haber exactamente uno en memoria');
});

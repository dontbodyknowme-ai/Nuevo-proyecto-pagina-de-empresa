// ============================================ TESTS — Estructura del menú lateral
// Ejecutar: node --test
// Cubre: RF-3, RF-6
// Ver: specs/003-refactor-app/spec.md
// ============================================
//
// `construirArbol()` son 162 líneas y casi todas son dibujo. Lo que se saca
// acá es la decisión de **qué** nodos existen: cuántos, con qué ícono y con
// qué botones.
//
// Lo que NO se saca son los `addEventListener`. Un manejador es comportamiento,
// no estructura, y cada uno cierra sobre su `materia` o su `doc`. Moverlos es
// lo que haría que un click empiece a abrir el documento equivocado.
//
// Esta tarea NO corrige nada: mueve. Por eso hay tests que fijan el
// comportamiento tal como está, incluso el que está roto.

// El IIFE y el patrón de exportación doble son obligatorios: sin ellos Node
// rompe los tests y el navegador dice `require is not defined`.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    modeloArbol,
    iconoMateria,
    iconoDocumento,
    accionesMateria,
    accionesDocumento,
    mensajeSinMaterias,
    ICONO_MATERIA_POR_DEFECTO,
    ICONO_DOCUMENTO_POR_DEFECTO,
    ACCIONES_MATERIA,
    ACCIONES_DOCUMENTO
} = require('../js/logica/arbol.js');

// ---------- El árbol vacío ----------

test('sin materias no hay modelo: hay un mensaje, no una lista', () => {
    assert.equal(modeloArbol([]), null);
});

test('lo que no es una lista se trata como vacío', () => {
    for (const valor of [null, undefined, 'no soy una lista', 42, {}]) {
        assert.equal(modeloArbol(valor), null, 'con ' + JSON.stringify(valor));
    }
});

test('el mensaje de "no hay materias" son las dos frases de siempre', () => {
    // El salto de línea entre las dos frases es del dibujado, no del texto.
    assert.deepEqual(mensajeSinMaterias(), {
        principal: 'No hay materias aún.',
        secundario: 'Crea una para comenzar.'
    });
});

// ---------- El ícono de la materia ----------

test('una materia sin ícono usa la carpeta', () => {
    assert.equal(ICONO_MATERIA_POR_DEFECTO, '📁');
    assert.equal(iconoMateria({}), '📁');
});

test('una materia con ícono usa el suyo', () => {
    assert.equal(iconoMateria({ icono: '⚗️' }), '⚗️');
    assert.equal(iconoMateria({ icono: '🎨' }), '🎨');
});

test('un ícono vacío o ausente cae en la carpeta', () => {
    // El `||` de siempre: cadena vacía es falsy, así que usa la carpeta.
    assert.equal(iconoMateria({ icono: '' }), '📁');
    assert.equal(iconoMateria({ icono: null }), '📁');
    assert.equal(iconoMateria({ icono: 0 }), '📁');
});

// ---------- El ícono del documento ----------

test('cada tipo de documento tiene su ícono', () => {
    assert.equal(iconoDocumento('html'), '🌐');
    assert.equal(iconoDocumento('pdf'), '📕');
    assert.equal(iconoDocumento('word'), '📘');
});

test('un tipo desconocido o ausente usa la hoja 📄', () => {
    assert.equal(ICONO_DOCUMENTO_POR_DEFECTO, '📄');
    assert.equal(iconoDocumento('txt'), '📄');
    assert.equal(iconoDocumento('lo-que-sea'), '📄');
    assert.equal(iconoDocumento(undefined), '📄');
    assert.equal(iconoDocumento(null), '📄');
    assert.equal(iconoDocumento(''), '📄');
});

test('los íconos de los documentos NO dependen de los de las materias', () => {
    // Son dos listas distintas. Que una vez una confusion.
    assert.notEqual(iconoDocumento('html'), ICONO_MATERIA_POR_DEFECTO);
});

// ---------- Los botones ----------

test('una materia tiene 2 botones: añadir documento y eliminar materia', () => {
    const a = accionesMateria();
    assert.equal(a.length, 2);
    assert.deepEqual(a.map(x => x.clave), ['agregar', 'eliminar']);
});

test('los títulos de los botones de materia son los de siempre', () => {
    assert.equal(ACCIONES_MATERIA[0].titulo, 'Añadir documento');
    assert.equal(ACCIONES_MATERIA[0].icono, '📄');
    assert.equal(ACCIONES_MATERIA[1].titulo, 'Eliminar materia');
    assert.equal(ACCIONES_MATERIA[1].icono, '🗑️');
});

test('un documento tiene 3 botones: ver, renombrar y eliminar', () => {
    const a = accionesDocumento();
    assert.equal(a.length, 3);
    assert.deepEqual(a.map(x => x.clave), ['ver', 'renombrar', 'eliminar']);
});

test('los títulos de los botones de documento son los de siempre', () => {
    assert.equal(ACCIONES_DOCUMENTO[0].titulo, 'Ver documento');
    assert.equal(ACCIONES_DOCUMENTO[0].icono, '👁️');
    assert.equal(ACCIONES_DOCUMENTO[1].titulo, 'Renombrar documento');
    assert.equal(ACCIONES_DOCUMENTO[1].icono, '✏️');
    assert.equal(ACCIONES_DOCUMENTO[2].titulo, 'Eliminar documento');
    assert.equal(ACCIONES_DOCUMENTO[2].icono, '🗑️');
});

test('solo el botón de eliminar lleva la clase "peligro"', () => {
    // Si aparece "peligro" en otro lado, todos los botones se ponen rojos.
    assert.equal(ACCIONES_MATERIA[0].clase, 'btn-icono-small');
    assert.equal(ACCIONES_MATERIA[1].clase, 'btn-icono-small peligro');

    assert.equal(ACCIONES_DOCUMENTO[0].clase, 'btn-icono-small');
    assert.equal(ACCIONES_DOCUMENTO[1].clase, 'btn-icono-small');
    assert.equal(ACCIONES_DOCUMENTO[2].clase, 'btn-icono-small peligro');
});

test('las acciones se devuelven como copia, no el original', () => {
    // Si `construirArbol()` los modificara, al segundo redibujado el botón
    // de eliminar perdería la clase "peligro" y nadie sabría por qué.
    const a = accionesMateria();
    a.push({ clave: 'inventado' });
    a[0].titulo = 'CAMBIADO';

    assert.equal(accionesMateria().length, 2);
    assert.equal(ACCIONES_MATERIA[0].titulo, 'Añadir documento');
});

test('cada botón trae un "clave" que dice qué hace, y no una función', () => {
    // La lógica pura no puede guardar manejadores: no tiene con qué ejecutarlos.
    // Lo que viaja al dibujo es la clave, y allá se decide el comportamiento.
    for (const b of [...ACCIONES_MATERIA, ...ACCIONES_DOCUMENTO]) {
        assert.equal(typeof b.clave, 'string');
        assert.equal(typeof b.titulo, 'string');
        assert.equal(typeof b.icono, 'string');
        assert.equal(typeof b.clase, 'string');
        assert.equal(b.handler, undefined, 'no debe traer manejador');
    }
});

// ---------- El modelo completo ----------

test('el modelo trae una entrada por materia, en orden', () => {
    const m = modeloArbol([
        { id: 'm1', nombre: 'Primera', documentos: [] },
        { id: 'm2', nombre: 'Segunda', documentos: [] },
        { id: 'm3', nombre: 'Tercera', documentos: [] }
    ]);

    assert.equal(m.length, 3);
    assert.deepEqual(m.map(x => x.nombre), ['Primera', 'Segunda', 'Tercera']);
});

test('cada entrada del modelo trae id, nombre, ícono, botones y documentos', () => {
    const m = modeloArbol([{ id: 'm1', nombre: 'Matemáticas', documentos: [] }]);

    assert.deepEqual(Object.keys(m[0]).sort(),
        ['acciones', 'documentos', 'icono', 'id', 'nombre']);
});

test('el modelo baja a los documentos con su ícono resuelto', () => {
    const m = modeloArbol([{
        id: 'm1', nombre: 'Varios', documentos: [
            { id: 'd1', nombre: 'a.html', tipo: 'html' },
            { id: 'd2', nombre: 'b.pdf', tipo: 'pdf' }
        ]
    }]);

    assert.equal(m[0].documentos.length, 2);
    assert.deepEqual(m[0].documentos.map(d => d.icono), ['🌐', '📕']);
    assert.deepEqual(m[0].documentos.map(d => d.nombre), ['a.html', 'b.pdf']);
});

test('cada documento trae sus propios 3 botones', () => {
    const m = modeloArbol([{
        id: 'm1', nombre: 'M', documentos: [{ id: 'd1', nombre: 'x', tipo: 'html' }]
    }]);

    assert.equal(m[0].documentos[0].acciones.length, 3);
});

test('una materia sin documentos tiene la lista vacía, noundefined', () => {
    const m = modeloArbol([{ id: 'm1', nombre: 'Vacía', documentos: [] }]);

    assert.deepEqual(m[0].documentos, []);
});

test('el modelo no toca los datos que le pasan', () => {
    // Si el modelo modificara la materia, el segundo redibujado mostraría
    // otra cosa y nadie sabría de dónde salió el cambio.
    const materia = { id: 'm1', nombre: 'Original', documentos: [{ id: 'd1', nombre: 'Doc', tipo: 'pdf' }] };
    const copia = JSON.parse(JSON.stringify(materia));

    modeloArbol([materia]);
    accionesMateria();

    assert.deepEqual(materia, copia);
});

// ---------- Nombres raros ----------

test('un nombre con HTML sale como texto, nunca como marcado', () => {
    const m = modeloArbol([{
        id: 'm1', nombre: '<img src=x onerror=alert(1)>', documentos: []
    }]);

    assert.equal(m[0].nombre, '<img src=x onerror=alert(1)>');
});

test('un nombre con comillas y atributos sale entero', () => {
    const m = modeloArbol([{ id: 'm1', nombre: 'informe" onload="alert(1)', documentos: [] }]);
    assert.equal(m[0].nombre, 'informe" onload="alert(1)');
});

// ---------- El defecto que se conserva a propósito ----------

test('una materia sin lista de documentos ya no rompe nada', () => {
    // Esto fallaba hasta T6: `materia.documentos.forEach` reventaba con la
    // lista ausente, y como `construirArbol()` se llama durante el arranque,
    // se caía toda la app y el mapa de calor quedaba sin dibujar.
    const m = modeloArbol([{ id: 'm1', nombre: 'Rota' }]);

    assert.equal(m.length, 1, 'la materia se dibuja igual');
    assert.deepEqual(m[0].documentos, [], 'con cero documentos');
    assert.equal(m[0].nombre, 'Rota');
});

test('una lista de documentos que no es lista tampoco rompe', () => {
    for (const raro of ['texto', 42, null, {}]) {
        const m = modeloArbol([{ id: 'm1', nombre: 'X', documentos: raro }]);
        assert.deepEqual(m[0].documentos, [], 'con ' + JSON.stringify(raro));
    }
});

// ---------- El cálculo no toca la pantalla ----------

test('el modelo es puro: no lee nada del entorno', () => {
    const g = globalThis;
    const antes = { document: g.document, localStorage: g.localStorage, window: g.window };
    delete g.document;
    delete g.localStorage;
    delete g.window;

    try {
        const m = modeloArbol([{ id: 'm1', nombre: 'X', documentos: [] }]);
        assert.equal(m[0].nombre, 'X');
    } finally {
        if (antes.document) g.document = antes.document;
        if (antes.localStorage) g.localStorage = antes.localStorage;
        if (antes.window) g.window = antes.window;
    }
});
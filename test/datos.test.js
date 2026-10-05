// ============================================ TESTS — Datos que no respetan las invariantes
// Ejecutar: node --test
// Cubre: RF-11, principio 5
// Ver: specs/003-refactor-app/task.md (T6)
// ============================================
//
// Qué resuelve esto:
//
// Un respaldo importado puede traer datos que no son los que el código espera.
// Hoy eso rompe la app entera: una materia sin lista de documentos hace fallar
// `materia.documentos.forEach` **durante el arranque**, y al cortarse la
// inicialización el mapa de calor nunca se dibuja.
//
// La regla de este módulo, en dos líneas:
//
//   1. NUNCA se borra nada. Un dato raro se completa, no se descarta.
//   2. Un dato roto no tira la app. Se anota como problema y se sigue.
//
// Lo que el código hacía antes de este módulo: nada. No validaba, y por eso un
// archivo mal formado se comía la aplicación entera.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizarMaterias,
    documentoSinContenido
} = require('../js/logica/datos.js');

// ---------- Lo normal: no cambia nada ----------

test('una materia bien formada queda igual', () => {
    const entrada = [{
        id: 'm1',
        nombre: 'Matemáticas',
        documentos: [{ id: 'd1', nombre: 'Ecuaciones.pdf', tipo: 'pdf', contenido: 'data:...' }]
    }];

    const r = normalizarMaterias(entrada);

    assert.deepEqual(r.materias, entrada);
    assert.deepEqual(r.problemas, []);
});

test('varias materias y varios documentos se mantienen en orden', () => {
    const entrada = [
        { id: 'm1', nombre: 'A', documentos: [{ id: 'd1', nombre: 'a1' }, { id: 'd2', nombre: 'a2' }] },
        { id: 'm2', nombre: 'B', documentos: [{ id: 'd3', nombre: 'b1' }] }
    ];

    const r = normalizarMaterias(entrada);

    assert.deepEqual(r.materias.map(m => m.nombre), ['A', 'B']);
    assert.deepEqual(r.materias[0].documentos.map(d => d.nombre), ['a1', 'a2']);
    assert.deepEqual(r.materias[1].documentos.map(d => d.nombre), ['b1']);
});

// ---------- El defecto 1: la materia sin lista de documentos ----------

test('DEFECTO 1 · una materia sin documentos recibe una lista vacía y no rompe', () => {
    // Este es el caso que tumbaba la app entera.
    const r = normalizarMaterias([{ id: 'm1', nombre: 'Rota' }]);

    assert.equal(r.materias.length, 1, 'la materia se conserva');
    assert.deepEqual(r.materias[0].documentos, [], 'recibe una lista vacía');
    assert.equal(r.problemas.length, 1);
    assert.equal(r.problemas[0].tipo, 'materia-sin-documentos');
});

test('DEFECTO 1 · el nombre de la materia se conserva igual', () => {
    const r = normalizarMaterias([{ id: 'm1', nombre: 'Rota' }]);
    assert.equal(r.materias[0].nombre, 'Rota');
    assert.equal(r.materias[0].id, 'm1');
});

test('una sola materia rota no afecta a las demás', () => {
    // Ojo con el fixture: los documentos llevan tipo y contenido. Un documento
    // sin ellos SÍ es un problema, y entonces este test contaría más de uno.
    const r = normalizarMaterias([
        { id: 'm1', nombre: 'Buena', documentos: [{ id: 'd1', nombre: 'x.pdf', tipo: 'pdf', contenido: 'data:...' }] },
        { id: 'm2', nombre: 'Rota' },
        { id: 'm3', nombre: 'Buena 2', documentos: [{ id: 'd2', nombre: 'y.html', tipo: 'html', contenido: '<p>hola</p>' }] }
    ]);

    assert.equal(r.materias.length, 3);
    assert.equal(r.materias[0].documentos.length, 1);
    assert.equal(r.materias[1].documentos.length, 0);
    assert.equal(r.materias[2].documentos.length, 1);
    assert.equal(r.problemas.length, 1, 'solo una materia estaba rota');
    assert.equal(r.problemas[0].tipo, 'materia-sin-documentos');
});

test('una lista de documentos que no es lista se reporta, no se adivina', () => {
    for (const raro of ['no soy lista', 42, {}, true]) {
        const r = normalizarMaterias([{ id: 'm1', nombre: 'X', documentos: raro }]);
        assert.deepEqual(r.materias[0].documentos, [], 'con ' + JSON.stringify(raro));
        assert.equal(r.problemas[0].tipo, 'documentos-invalidos');
    }
});

// ---------- El defecto 2: el documento sin contenido ----------

test('DEFECTO 2 · un documento sin contenido SE CONSERVA, no se borra', () => {
    // La regla del proyecto: los datos son sagrados.
    //
    // El nombre tiene un espacio al principio a propósito: la normalización
    // no puede "limpiar" los nombres. Un archivo así se llama así.
    const r = normalizarMaterias([{
        id: 'm1', nombre: 'M', documentos: [{ id: 'd1', nombre: ' roto.pdf', tipo: 'pdf' }]
    }]);

    assert.equal(r.materias[0].documentos.length, 1, 'el documento sigue ahí');
    assert.equal(r.materias[0].documentos[0].nombre, ' roto.pdf',
        'el nombre se conserva tal cual, con su espacio');
    assert.equal(r.problemas.length, 1);
    assert.equal(r.problemas[0].tipo, 'documento-sin-contenido');
});

test('DEFECTO 2 · el problema dice en qué documento está', () => {
    const r = normalizarMaterias([{
        id: 'm1', nombre: 'Física', documentos: [{ id: 'd9', nombre: 'Apuntes.pdf', tipo: 'pdf' }]
    }]);

    const p = r.problemas[0];
    assert.equal(p.materia, 'Física');
    assert.equal(p.documento, 'Apuntes.pdf');
    assert.ok(p.mensaje.includes('Apuntes.pdf'), 'el mensaje nombra el archivo');
});

test('DEFECTO 2 · un PDF o un Word vacío SÍ es un problema', () => {
    // '' es falsy pero no hay nada que cargar: no se puede abrir.
    for (const tipo of ['pdf', 'word']) {
        const r = normalizarMaterias([{
            id: 'm1', nombre: 'M', documentos: [
                { id: 'd1', nombre: 'vacio.' + tipo, tipo, contenido: '' }
            ]
        }]);

        assert.equal(r.problemas.length, 1, 'tipo ' + tipo);
        assert.equal(r.problemas[0].tipo, 'documento-sin-contenido');
    }
});

test('un HTML vacío NO es un problema: se abre en blanco', () => {
    // Un archivo HTML de 0 bytes se abre: sale un iframe vacío, que es la
    // verdad. Marcarlo como roto sería mentir sobre lo que el usuario tiene.
    const r = normalizarMaterias([{
        id: 'm1', nombre: 'M', documentos: [
            { id: 'd1', nombre: 'vacio.html', tipo: 'html', contenido: '' }
        ]
    }]);

    assert.equal(r.problemas.length, 0);
    assert.equal(r.materias[0].documentos.length, 1, 'y el documento sigue ahí');
});

// ---------- documentoSinContenido ----------

test('documentoSinContenido dice qué documentos no se pueden abrir', () => {
    assert.equal(documentoSinContenido({ tipo: 'pdf' }), true);
    assert.equal(documentoSinContenido({ tipo: 'word' }), true);
    assert.equal(documentoSinContenido({ tipo: 'pdf', contenido: '' }), true);
    assert.equal(documentoSinContenido({ tipo: 'pdf', contenido: null }), true);
});

test('documentoSinContenido NO marca un HTML vacío', () => {
    // Un HTML sin contenido se abre: sale un iframe en blanco, que es honesto.
    assert.equal(documentoSinContenido({ tipo: 'html', contenido: '' }), false);
    assert.equal(documentoSinContenido({ tipo: 'html' }), false);
    assert.equal(documentoSinContenido({ tipo: 'html', contenido: '<p>hola</p>' }), false);
});

test('documentoSinContenido con contenido real no marca', () => {
    assert.equal(documentoSinContenido({ tipo: 'pdf', contenido: 'data:application/pdf;base64,AAA' }), false);
});

test('documentoSinContenido no explota con cualquier cosa', () => {
    for (const valor of [null, undefined, 'texto', 42, {}]) {
        assert.doesNotThrow(() => documentoSinContenido(valor));
    }
});

// ---------- Cosas raras que también tienen que sobrevivir ----------

test('una materia sin id recibe uno, para que el menú pueda dibujarla', () => {
    const r = normalizarMaterias([{ nombre: 'Sin id', documentos: [] }]);

    assert.ok(r.materias[0].id, 'recibe un id');
    assert.equal(r.problemas.length, 1);
    assert.equal(r.problemas[0].tipo, 'materia-sin-id');
});

test('dos materias sin id reciben ids distintos', () => {
    const r = normalizarMaterias([{ nombre: 'A', documentos: [] }, { nombre: 'B', documentos: [] }]);

    assert.notEqual(r.materias[0].id, r.materias[1].id,
        'con el mismo id el menú no puede distinguirlas');
});

test('un documento sin id también recibe uno', () => {
    const r = normalizarMaterias([{
        id: 'm1', nombre: 'M', documentos: [{ nombre: 'Sin id.pdf', tipo: 'pdf', contenido: 'x' }]
    }]);

    assert.ok(r.materias[0].documentos[0].id);
    assert.equal(r.problemas[0].tipo, 'documento-sin-id');
});

test('una materia sin nombre se dibuja con nombre vacío, no con undefined', () => {
    const r = normalizarMaterias([{ id: 'm1', documentos: [] }]);

    assert.equal(r.materias[0].nombre, '');
    assert.notEqual(r.materias[0].nombre, undefined);
});

test('una entrada que no es una materia se saltea y se avisa', () => {
    // Un string no tiene nada que preservar. Se avisa igual, no se ignora en silencio.
    const r = normalizarMaterias([{ id: 'm1', nombre: 'Buena', documentos: [] }, 'no soy una materia']);

    assert.equal(r.materias.length, 1);
    assert.equal(r.materias[0].nombre, 'Buena');
    assert.equal(r.problemas.length, 1);
    assert.equal(r.problemas[0].tipo, 'materia-invalida');
});

test('un documento que no es un documento se saltea y se avisa', () => {
    const r = normalizarMaterias([{
        id: 'm1', nombre: 'M', documentos: [{ id: 'd1', nombre: 'Bien', tipo: 'html', contenido: 'x' }, 42]
    }]);

    assert.equal(r.materias[0].documentos.length, 1);
    assert.equal(r.problemas[0].tipo, 'documento-invalido');
});

test('algo que no es una lista de materias no rompe', () => {
    for (const valor of [null, undefined, 'texto', 42, { materias: [] }]) {
        const r = normalizarMaterias(valor);
        assert.deepEqual(r.materias, [], 'con ' + JSON.stringify(valor));
        assert.ok(Array.isArray(r.problemas));
    }
});

test('lo que devuelve el formato de importacion tambien se acepta', () => {
    // El import guarda { materias: [...] }, no el arreglo pelado.
    const r = normalizarMaterias({ materias: [{ id: 'm1', nombre: 'X', documentos: [] }] });

    assert.equal(r.materias.length, 1);
    assert.equal(r.problemas.length, 0);
});

// ---------- La lista de problemas ----------

test('cada problema tiene tipo, mensaje y texto para mostrar', () => {
    const r = normalizarMaterias([{ id: 'm1', nombre: 'Rota' }]);

    for (const p of r.problemas) {
        assert.equal(typeof p.tipo, 'string');
        assert.equal(typeof p.mensaje, 'string');
        assert.ok(p.mensaje.length > 0, 'el mensaje no puede estar vacío');
    }
});

test('todos los mensajes están en español y sin doble espacio', () => {
    const r = normalizarMaterias([
        { nombre: 'A' },
        { id: 'm2', nombre: 'B', documentos: [null] },
        { id: 'm3', nombre: 'C', documentos: [{ id: 'd1', nombre: 'x', tipo: 'pdf' }] }
    ]);

    for (const p of r.problemas) {
        assert.ok(!/\s{2,}/.test(p.mensaje), 'doble espacio en: ' + p.mensaje);
        assert.ok(p.mensaje.trim() === p.mensaje, 'espacio al principio o al final: ' + p.mensaje);
    }
});

test('sin datos raro no hay ni un problema', () => {
    assert.equal(normalizarMaterias([{ id: 'm1', nombre: 'A', documentos: [] }]).problemas.length, 0);
    assert.equal(normalizarMaterias([]).problemas.length, 0);
});

// Aquí estaban los dos tests de `resumenDeProblemas()`. Esa función armaba el
// texto del cartel y no la usaba nadie: el cartel real lo arma
// `reconstruirAviso()`, en `js/interfaz/aviso.js`, con las mismas cadenas.
//
// Las reglas que fijaban —contar los problemas, aclarar que no se borró nada,
// decir que todo está bien— están ahora en `test/aviso.test.js`, contra la
// función que de verdad arma el texto, y con dos casos más: el singular
// cuando hay uno solo, y que el número sea el de los problemas que se van a
// mostrar. Ver T6.

// ---------- No toca el entorno ----------

test('normalizar es puro: no lee ni escribe nada del entorno', () => {
    const g = globalThis;
    const antes = { document: g.document, localStorage: g.localStorage, window: g.window };
    delete g.document;
    delete g.localStorage;
    delete g.window;

    try {
        const r = normalizarMaterias([{ id: 'm1', nombre: 'X' }]);
        assert.equal(r.materias.length, 1);
    } finally {
        if (antes.document) g.document = antes.document;
        if (antes.localStorage) g.localStorage = antes.localStorage;
        if (antes.window) g.window = antes.window;
    }
});
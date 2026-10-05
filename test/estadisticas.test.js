// ============================================
// TESTS — Cálculo de las estadísticas
// Ejecutar: node --test
// Cubre: RF-5, RF-6
// Ver: specs/003-refactor-app/spec.md
// ============================================
//
// Esta tarea **no corrige nada, mueve**. Los tests fijan lo que el código
// hace hoy, para que se pueda demostrar que el movimiento no cambió nada.
//
// Eso incluye un defecto conocido: contar palabras partiendo por espacios
// cuenta de más cuando el texto tiene espacio al principio o al final. Está
// declarado como CP-2 en la spec y **no se resuelve acá**, porque cambiarlo
// haría que las estadísticas bajen y eso es una decisión del usuario.
//
// Lo que sí se verifica es que el cálculo no dependa de la pantalla.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { calcularEstadisticas } = require('../js/logica/estadisticas.js');

// ---------- Materias ----------

test('sin materias, todo en cero', () => {
    const r = calcularEstadisticas([]);
    assert.equal(r.totalMaterias, 0);
    assert.equal(r.totalDocumentos, 0);
    assert.equal(r.totalPalabras, 0);
});

test('una materia cuenta como una materia', () => {
    const r = calcularEstadisticas([{ documentos: [] }]);
    assert.equal(r.totalMaterias, 1);
    assert.equal(r.totalDocumentos, 0);
});

test('varias materias se cuentan todas', () => {
    const r = calcularEstadisticas([
        { documentos: [] }, { documentos: [] }, { documentos: [] }
    ]);
    assert.equal(r.totalMaterias, 3);
});

// ---------- Documentos ----------

test('los documentos se suman de todas las materias', () => {
    const r = calcularEstadisticas([
        { documentos: [{ tipo: 'html', contenido: 'a' }] },
        { documentos: [{ tipo: 'html', contenido: 'b' }, { tipo: 'pdf', contenido: 'x' }] }
    ]);
    assert.equal(r.totalDocumentos, 3);
});

test('una materia sin documentos no rompe el cálculo', () => {
    const r = calcularEstadisticas([
        { documentos: [] },
        { documentos: [{ tipo: 'html', contenido: 'hola' }] }
    ]);
    assert.equal(r.totalDocumentos, 1);
});

// ---------- Palabras ----------

test('un documento HTML cuenta sus palabras', () => {
    const r = calcularEstadisticas([
        { documentos: [{ tipo: 'html', contenido: 'uno dos tres' }] }
    ]);
    assert.equal(r.totalPalabras, 3);
});

test('un PDF no aporta palabras', () => {
    const r = calcularEstadisticas([
        { documentos: [{ tipo: 'pdf', contenido: 'no deberia contar esto' }] }
    ]);
    assert.equal(r.totalPalabras, 0);
});

test('un documento Word no aporta palabras', () => {
    const r = calcularEstadisticas([
        { documentos: [{ tipo: 'word', contenido: 'tampoco esto' }] }
    ]);
    assert.equal(r.totalPalabras, 0);
});

test('las palabras se suman entre documentos y entre materias', () => {
    const r = calcularEstadisticas([
        { documentos: [{ tipo: 'html', contenido: 'uno dos' }] },
        { documentos: [
            { tipo: 'html', contenido: 'tres cuatro' },
            { tipo: 'pdf', contenido: 'no cuenta' }
        ] }
    ]);
    assert.equal(r.totalPalabras, 4);
});

test('un documento HTML sin contenido no aporta palabras', () => {
    const r = calcularEstadisticas([
        { documentos: [{ tipo: 'html', contenido: '' }] }
    ]);
    assert.equal(r.totalPalabras, 0);
});

// ---------- El defecto conocido (CP-2) ----------

test('CP-2 · hoy se cuenta de más con espacio al principio o al final', () => {
    // Se fija el comportamiento ACTUAL, no el que debería.
    // Cuando el usuario decida qué vale como palabra, se cambia acá.
    // ' hola ' parte en ['', 'hola', '']: los pedacitos vacíos cuentan como
    // palabras. Debería contar 1 y cuenta 3.
    const r = calcularEstadisticas([
        { documentos: [{ tipo: 'html', contenido: ' hola ' }] }
    ]);
    assert.equal(r.totalPalabras, 3, 'por ahora cuenta 3; debería contar 1');
});

test('CP-2 · con espacio en un solo lado cuenta uno de más', () => {
    const r = calcularEstadisticas([
        { documentos: [{ tipo: 'html', contenido: ' hola' }] }
    ]);
    assert.equal(r.totalPalabras, 2, 'por ahora cuenta 2; debería contar 1');
});

test('CP-2 · hoy un texto de puros espacios cuenta como 2 palabras', () => {
    const r = calcularEstadisticas([
        { documentos: [{ tipo: 'html', contenido: '   ' }] }
    ]);
    assert.equal(r.totalPalabras, 2, 'por ahora cuenta 2; debería contar 0');
});

test('CP-2 · hoy los espacios en el medio NO inflan el conteo', () => {
    // Este caso sí funciona bien. Se prueba para que nadie lo "arregle" mal.
    const r = calcularEstadisticas([
        { documentos: [{ tipo: 'html', contenido: 'hola  mundo' }] }
    ]);
    assert.equal(r.totalPalabras, 2);
});

// ---------- Robustez ----------

test('no rompe con una materia sin lista de documentos', () => {
    const r = calcularEstadisticas([{ documentos: undefined }, { documentos: [] }]);
    assert.equal(r.totalMaterias, 2);
    assert.equal(r.totalDocumentos, 0);
});

test('no rompe si no le pasan materias', () => {
    for (const valor of [null, undefined, 'no soy una lista', 42]) {
        const r = calcularEstadisticas(valor);
        assert.equal(r.totalMaterias, 0);
        assert.equal(r.totalPalabras, 0);
    }
});

test('no rompe con un documento sin tipo', () => {
    const r = calcularEstadisticas([
        { documentos: [{ contenido: 'hola' }] }
    ]);
    assert.equal(r.totalDocumentos, 1);
    assert.equal(r.totalPalabras, 0);
});

// ---------- El cálculo no toca la pantalla ----------

test('el cálculo es puro: no lee nada del entorno', () => {
    // Si tocara el DOM o el almacenamiento, en Node no tendria con estos datos.
    const global = globalThis;
    const antes = {
        document: global.document,
        localStorage: global.localStorage,
        window: global.window
    };
    delete global.document;
    delete global.localStorage;
    delete global.window;

    try {
        const r = calcularEstadisticas([
            { documentos: [{ tipo: 'html', contenido: 'hola mundo' }] }
        ]);
        assert.equal(r.totalPalabras, 2);
    } finally {
        if (antes.document) global.document = antes.document;
        if (antes.localStorage) global.localStorage = antes.localStorage;
        if (antes.window) global.window = antes.window;
    }
});
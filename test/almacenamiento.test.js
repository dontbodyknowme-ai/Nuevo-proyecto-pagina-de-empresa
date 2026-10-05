// ============================================
// TESTS — Prevención por capacidad de almacenamiento
// Ejecutar: node --test
// Cubre: RF-11
// Ver: specs/001-heat-map/spec.md
// ============================================

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    umbralDe,
    puedeEscribir,
    debeRevertir,
    estimarEspacioDisponible,
    PORCENTAJE_UMBRAL_POR_DEFECTO
} = require('../js/logica/almacenamiento.js');

// Capacidad de 1000 unidades, comoda para calcular porcentajes
const CAPACIDAD = 1000;

// ---------- Umbral configurable ----------

test('RF-11 · el umbral por defecto es 95', () => {
    assert.equal(PORCENTAJE_UMBRAL_POR_DEFECTO, 95);
    assert.equal(umbralDe(), 95);
});

test('RF-11 · el umbral se puede configurar', () => {
    assert.equal(umbralDe(80), 80);
    assert.equal(umbralDe(99), 99);
});

test('RF-11 · un umbral invalido vuelve al valor por defecto', () => {
    assert.equal(umbralDe(0), 95);
    assert.equal(umbralDe(-10), 95);
    assert.equal(umbralDe(120), 95);
    assert.equal(umbralDe('hola'), 95);
    assert.equal(umbralDe(null), 95);
});

// ---------- Espacio disponible ----------

test('RF-11 · el espacio disponible descuenta el uso', () => {
    assert.equal(estimarEspacioDisponible(0, CAPACIDAD), 1000);
    assert.equal(estimarEspacioDisponible(500, CAPACIDAD), 500);
    assert.equal(estimarEspacioDisponible(CAPACIDAD, CAPACIDAD), 0);
});

// ---------- Escritura segura ----------

test('RF-11 · con 94 por ciento de uso y escritura chica, permite', () => {
    const resultado = puedeEscribir(940, CAPACIDAD, 10);
    assert.equal(resultado.permitido, true);
    assert.equal(resultado.motivo, null);
});

test('RF-11 · con 96 por ciento de uso, bloquea', () => {
    const resultado = puedeEscribir(960, CAPACIDAD, 10);
    assert.equal(resultado.permitido, false);
    assert.equal(resultado.motivo, 'umbral');
});

test('RF-11 · con 95 por ciento exacto, bloquea', () => {
    const resultado = puedeEscribir(950, CAPACIDAD, 10);
    assert.equal(resultado.permitido, false);
    assert.equal(resultado.motivo, 'umbral');
});

test('RF-11 · con 94 por ciento pero escritura grande, bloquea', () => {
    // Está bajo el umbral, pero no entra lo que se quiere guardar
    const resultado = puedeEscribir(940, CAPACIDAD, 100);
    assert.equal(resultado.permitido, false);
    assert.equal(resultado.motivo, 'espacio');
});

test('RF-11 · con 94 por ciento y escritura que alcanza justo, permite', () => {
    const resultado = puedeEscribir(940, CAPACIDAD, 60);
    assert.equal(resultado.permitido, true);
});

test('RF-11 · con espacio cero, cualquier escritura se bloquea', () => {
    const resultado = puedeEscribir(CAPACIDAD, CAPACIDAD, 1);
    assert.equal(resultado.permitido, false);
    assert.equal(resultado.motivo, 'espacio');
});

test('RF-11 · con almacenamiento vacio y escritura chica, permite', () => {
    const resultado = puedeEscribir(0, CAPACIDAD, 10);
    assert.equal(resultado.permitido, true);
});

test('RF-11 · una capacidad total de cero bloquea siempre', () => {
    const resultado = puedeEscribir(0, 0, 10);
    assert.equal(resultado.permitido, false);
});

test('RF-11 · el umbral se puede bajar por parametro', () => {
    // Con umbral de 80, el 85 por ciento bloquea
    const resultado = puedeEscribir(850, CAPACIDAD, 10, 80);
    assert.equal(resultado.permitido, false);
    assert.equal(resultado.motivo, 'umbral');
});

test('RF-11 · devuelve el porcentaje de uso para mostrarlo al usuario', () => {
    const resultado = puedeEscribir(940, CAPACIDAD, 10);
    assert.equal(resultado.porcentajeUso, 94);
});

test('RF-11 · avisa cuanto falta para llegar al umbral', () => {
    const resultado = puedeEscribir(900, CAPACIDAD, 10);
    assert.equal(resultado.porcentajeUso, 90);
    assert.equal(resultado.porcentajeUmbral, 95);
});

// ---------- Reversión ----------

test('RF-11 · un error de cuota activa la reversión', () => {
    assert.equal(debeRevertir({ name: 'QuotaExceededError' }), true);
    assert.equal(debeRevertir({ code: 22 }), true);
    assert.equal(debeRevertir({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }), true);
});

test('RF-11 · un error que no es de cuota no revierte', () => {
    assert.equal(debeRevertir({ name: 'TypeError' }), false);
    assert.equal(debeRevertir({ code: 5 }), false);
    assert.equal(debeRevertir(null), false);
    assert.equal(debeRevertir(undefined), false);
});

test('RF-11 · un error de cuota con mensaje en español tambien revierte', () => {
    assert.equal(debeRevertir({ message: 'Se alcanzó la cuota de almacenamiento' }), true);
});
// ============================================
// TESTS — Verificación de consentimiento
// Ejecutar: node --test
// Cubre: RF-12
// Ver: specs/001-heat-map/spec.md
// ============================================

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    tieneConsentimiento,
    registrarConsentimiento,
    revocarConsentimiento
} = require('../js/logica/consentimiento.js');

// Fecha fija para los tests, así no dependen del reloj
const HOY = '2026-10-01';

test('RF-12 · sin registro, devuelve falso', () => {
    assert.equal(tieneConsentimiento([], 'cuaderno_1', HOY), false);
});

test('RF-12 · con consentimiento vigente, devuelve verdadero', () => {
    const registros = [{ cuadernoId: 'cuaderno_1', fechaOtorgamiento: '2026-09-01' }];
    assert.equal(tieneConsentimiento(registros, 'cuaderno_1', HOY), true);
});

test('RF-12 · un registro de otro cuaderno no habilita este', () => {
    const registros = [{ cuadernoId: 'cuaderno_2', fechaOtorgamiento: '2026-09-01' }];
    assert.equal(tieneConsentimiento(registros, 'cuaderno_1', HOY), false);
});

test('RF-12 · el consentimiento revocado no habilita', () => {
    const registros = [{
        cuadernoId: 'cuaderno_1',
        fechaOtorgamiento: '2026-09-01',
        revocado: true
    }];
    assert.equal(tieneConsentimiento(registros, 'cuaderno_1', HOY), false);
});

test('RF-12 · sin fecha de otorgamiento, no habilita', () => {
    const registros = [{ cuadernoId: 'cuaderno_1' }];
    assert.equal(tieneConsentimiento(registros, 'cuaderno_1', HOY), false);
});

test('RF-12 · un cuaderno vacío no habilita', () => {
    assert.equal(tieneConsentimiento([], '', HOY), false);
});

test('RF-12 · un registro mal formado no rompe la verificación', () => {
    const registros = [null, undefined, 'basura', 42];
    assert.equal(tieneConsentimiento(registros, 'cuaderno_1', HOY), false);
});

test('RF-12 · hoy es un parámetro, no se lee del reloj', () => {
    const registros = [{ cuadernoId: 'cuaderno_1', fechaOtorgamiento: '2026-09-01' }];
    assert.equal(tieneConsentimiento(registros, 'cuaderno_1', '2026-09-02'), true);
    assert.equal(tieneConsentimiento(registros, 'cuaderno_1', '2026-08-01'), true);
});

// --- Registrar y revocar ---

test('RF-12 · registrar consentimiento lo habilita', () => {
    const registros = registrarConsentimiento([], 'cuaderno_1', '2026-09-01');
    assert.equal(tieneConsentimiento(registros, 'cuaderno_1', HOY), true);
});

test('RF-12 · revocar deja de habilitar', () => {
    let registros = registrarConsentimiento([], 'cuaderno_1', '2026-09-01');
    registros = revocarConsentimiento(registros, 'cuaderno_1');
    assert.equal(tieneConsentimiento(registros, 'cuaderno_1', HOY), false);
});

test('RF-12 · registrar dos veces no duplica el registro', () => {
    let registros = registrarConsentimiento([], 'cuaderno_1', '2026-09-01');
    registros = registrarConsentimiento(registros, 'cuaderno_1', '2026-09-15');
    assert.equal(registros.length, 1);
});
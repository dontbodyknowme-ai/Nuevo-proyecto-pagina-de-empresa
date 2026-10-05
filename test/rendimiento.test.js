// ============================================
// TESTS — Comportamiento con datos de un año
// Ejecutar: node --test
// Cubre: RNF-1
// Ver: specs/001-heat-map/spec.md
// ============================================
//
// Este archivo mide el tiempo que tarda el mapa en armarse con
// un año completo de datos. Los datos vienen de
// test/datos-un-anio.json, que es un archivo de datos estático:
// no lo genera código ni agrega dependencias (Principio 1).
//
// La verificación final se hace a mano en el navegador, como
// pide la constitución. Esto acota el cálculo puro.
// ============================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { construirGrilla, aFechaClave } = require('../js/logica/mapa-calor.js');
const { minutosTotales } = require('../js/datos/secciones.js');

const ARCHIVO_DATOS = path.join(__dirname, 'datos-un-anio.json');

// El archivo es una lista plana de secciones. `minutosTotales()` es la que
// suma los minutos de verdad —la usa la app—, y espera el estado completo, así
// que se lo armamos acá. Antes se usaba `consolidar()`, que hacía lo mismo y no
// la usaba nadie. Ver T6.
function totalesDe(archivo) {
    const secciones = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    return { secciones, totales: minutosTotales({ secciones, seccionesAntiguas: [] }, aFechaClave) };
}

test('RNF-1 · el archivo de datos de prueba existe', () => {
    assert.ok(fs.existsSync(ARCHIVO_DATOS));
});

test('RNF-1 · el conjunto tiene al menos un año de datos', () => {
    const { secciones, totales } = totalesDe(ARCHIVO_DATOS);
    const totalMinutos = Object.values(totales).reduce((a, b) => a + b, 0);

    assert.ok(totalMinutos > 0, 'el conjunto debe tener minutos');
    assert.ok(secciones.length > 100, 'debe tener muchas secciones');
});

test('RNF-1 · armar el mapa con un año de datos es rápido', () => {
    const { totales } = totalesDe(ARCHIVO_DATOS);

    const inicio = process.hrtime.bigint();
    const grilla = construirGrilla('01/10/2026', totales);
    const fin = process.hrtime.bigint();

    const milisegundos = Number(fin - inicio) / 1e6;

    assert.ok(milisegundos < 1000, `tardó ${milisegundos.toFixed(2)} ms`);
});

test('RNF-1 · la grilla sale completa aunque haya muchos datos', () => {
    const { totales } = totalesDe(ARCHIVO_DATOS);
    const grilla = construirGrilla('01/10/2026', totales);

    assert.equal(grilla.length, 4);
    grilla.forEach((fila) => assert.equal(fila.length, 7));

    // Ninguna celda puede quedar con minutos pero sin nivel
    for (const fila of grilla) {
        for (const celda of fila) {
            if (celda.minutos > 0) {
                assert.ok(celda.nivel >= 1, `${celda.clave} tiene ${celda.minutos} min y nivel ${celda.nivel}`);
            }
        }
    }
});
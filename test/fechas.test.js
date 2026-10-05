// ============================================
// TESTS — Aritmética de fechas del calendario
// Ejecutar: node --test
// Cubre: RF-1, RF-2, RF-6
// Ver: specs/003-refactor-app/spec.md
// ============================================
//
// Estas funciones son puras: reciben año y mes, devuelven números. No tocan
// la pantalla, el reloj ni el almacenamiento, así que se prueban solas.
//
// Los valores esperados están calculados aparte, no copiados del código que
// se reemplaza. Si coincidieran con un error, el error quedaría congelado
// como si fuera correcto (ver DD-1 del plan).

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    esBisiesto,
    diasDelMes,
    columnaDelDiaUno,
    existeFecha
} = require('../js/logica/fechas.js');

// ---------- esBisiesto ----------

test('un año divisible por 4 es bisiesto', () => {
    assert.equal(esBisiesto(2024), true);
});

test('un año común no es bisiesto', () => {
    assert.equal(esBisiesto(2026), false);
});

test('un año divisible por 100 pero no por 400 NO es bisiesto', () => {
    // El caso que rompe la regla simple de "divisible por 4".
    assert.equal(esBisiesto(1900), false);
    assert.equal(esBisiesto(2100), false);
});

test('un año divisible por 400 sí es bisiesto', () => {
    assert.equal(esBisiesto(2000), true);
    assert.equal(esBisiesto(1600), true);
});

test('un año que no es un número no es bisiesto', () => {
    for (const valor of [null, undefined, '2026', {}, NaN, -2026]) {
        assert.equal(esBisiesto(valor), false);
    }
});

// ---------- diasDelMes ----------

test('febrero tiene 28 días en un año común', () => {
    assert.equal(diasDelMes(2026, 2), 28);
});

test('febrero tiene 29 días en un año bisiesto', () => {
    assert.equal(diasDelMes(2024, 2), 29);
});

test('febrero de 1900 tiene 28 días: divisible por 100 pero no por 400', () => {
    assert.equal(diasDelMes(1900, 2), 28);
});

test('febrero de 2000 tiene 29 días: divisible por 400', () => {
    assert.equal(diasDelMes(2000, 2), 29);
});

test('los meses de 30 días devuelven 30', () => {
    for (const mes of [4, 6, 9, 11]) {
        assert.equal(diasDelMes(2026, mes), 30, 'mes ' + mes);
    }
});

test('los meses de 31 días devuelven 31', () => {
    for (const mes of [1, 3, 5, 7, 8, 10, 12]) {
        assert.equal(diasDelMes(2026, mes), 31, 'mes ' + mes);
    }
});

test('los doce meses del año devuelven un número entre 28 y 31', () => {
    for (let mes = 1; mes <= 12; mes++) {
        const d = diasDelMes(2026, mes);
        assert.ok(d >= 28 && d <= 31, 'mes ' + mes + ' devolvió ' + d);
    }
});

test('un mes imposible devuelve 0 en vez de inventar una cantidad', () => {
    assert.equal(diasDelMes(2026, 0), 0);
    assert.equal(diasDelMes(2026, 13), 0);
    assert.equal(diasDelMes(2026, -1), 0);
    assert.equal(diasDelMes(2026, 'octubre'), 0);
    assert.equal(diasDelMes(2026, null), 0);
});

// ---------- columnaDelDiaUno ----------

// Aquí estaba el test de `DIAS_EN_LA_SEMANA`, que comprobaba que la lista
// arrancara en lunes y terminara en domingo. La lista se fue en T6: no la usaba
// nada, y los nombres de los días que ve el usuario salen de `diasDeSemana()`,
// en `js/logica/mapa-calor.js`, que tiene sus tests.

test('junio de 2026 arranca en lunes, o sea columna 0', () => {
    assert.equal(columnaDelDiaUno(2026, 6), 0);
});

test('enero de 2026 arranca en jueves, o sea columna 3', () => {
    assert.equal(columnaDelDiaUno(2026, 1), 3);
});

test('febrero de 2026 arranca en domingo, o sea la última columna', () => {
    assert.equal(columnaDelDiaUno(2026, 2), 6);
});

test('septiembre de 2026 arranca en martes, o sea columna 1', () => {
    assert.equal(columnaDelDiaUno(2026, 9), 1);
});

test('la columna siempre cae entre 0 y 6', () => {
    for (let mes = 1; mes <= 12; mes++) {
        for (const anio of [2024, 2025, 2026, 2027]) {
            const c = columnaDelDiaUno(anio, mes);
            assert.ok(c >= 0 && c <= 6, anio + '/' + mes + ' devolvió ' + c);
        }
    }
});

test('un mes imposible devuelve 0', () => {
    assert.equal(columnaDelDiaUno(2026, 13), 0);
    assert.equal(columnaDelDiaUno(2026, 0), 0);
});

// ---------- existeFecha ----------

test('una fecha real existe', () => {
    assert.equal(existeFecha(1, 1, 2026), true);
    assert.equal(existeFecha(31, 12, 2026), true);
    assert.equal(existeFecha(15, 10, 2026), true);
});

test('el 31 de febrero no existe', () => {
    assert.equal(existeFecha(31, 2, 2026), false);
});

test('el 30 de febrero no existe', () => {
    assert.equal(existeFecha(30, 2, 2026), false);
});

test('el 29 de febrero solo existe en año bisiesto', () => {
    assert.equal(existeFecha(29, 2, 2024), true);
    assert.equal(existeFecha(29, 2, 2026), false);
});

test('el 31 no existe en los meses de 30 días', () => {
    for (const mes of [4, 6, 9, 11]) {
        assert.equal(existeFecha(31, mes, 2026), false, 'mes ' + mes);
    }
});

test('un día cero o negativo no existe', () => {
    assert.equal(existeFecha(0, 1, 2026), false);
    assert.equal(existeFecha(-5, 1, 2026), false);
});

test('una fecha imposible devuelve false en vez de fallar', () => {
    assert.equal(existeFecha(1, 13, 2026), false);
    assert.equal(existeFecha(1, 0, 2026), false);
    assert.equal(existeFecha('quince', 3, 2026), false);
    assert.equal(existeFecha(15, 'marzo', 2026), false);
});

// ---------- Coherencia entre las funciones ----------

test('un día existe si y solo si no supera los días del mes', () => {
    for (let mes = 1; mes <= 12; mes++) {
        for (const anio of [2024, 2026]) {
            const total = diasDelMes(anio, mes);
            assert.equal(existeFecha(total, mes, anio), true, 'el último día debe existir');
            assert.equal(existeFecha(total + 1, mes, anio), false, 'el día siguiente no');
        }
    }
});

test('recorriendo los doce meses, los días contados coinciden', () => {
    // Ningún mes puede perder días ni inventar uno.
    for (const anio of [2024, 2025, 2026]) {
        let total = 0;
        for (let mes = 1; mes <= 12; mes++) total += diasDelMes(anio, mes);
        assert.equal(total, anio % 4 === 0 && anio % 100 !== 0 || anio % 400 === 0 ? 366 : 365);
    }
});
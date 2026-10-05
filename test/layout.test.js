// ============================================
// TESTS — Qué elementos se muestran en cada vista
// Ejecutar: node --test
// Cubre: RF-5, RNF-3, RNF-4
// Ver: specs/002-layout-calendario/spec.md
// ============================================
//
// Estos tests comprueban una función pura. Corre en Node sin DOM, sin
// ventana y sin reloj del sistema, que es justamente lo que exige RNF-3:
// que la decisión de qué se muestra se pueda verificar sin abrir Chrome.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    elementosVisibles
} = require('../js/logica/layout.js');

// ---------- La vista del mapa de calor ----------

test('RF-5 · en la vista mapa no se muestra la navegación de mes', () => {
    assert.equal(elementosVisibles('mapa').navMes, false);
});

test('RF-5 · en la vista mapa no se muestra la leyenda de anotaciones', () => {
    assert.equal(elementosVisibles('mapa').leyendaAnotaciones, false);
});

test('RF-5 · en la vista mapa no se muestra el panel de anotaciones', () => {
    // El mapa no tiene anotaciones: las muestra el calendario mensual
    assert.equal(elementosVisibles('mapa').panelAnotaciones, false);
});

// ---------- La vista del calendario mensual ----------

test('RF-5 · en la vista calendario se muestra la navegación de mes', () => {
    assert.equal(elementosVisibles('calendario').navMes, true);
});

test('RF-5 · en la vista calendario se muestra la leyenda de anotaciones', () => {
    assert.equal(elementosVisibles('calendario').leyendaAnotaciones, true);
});

test('RF-5 · en la vista calendario se muestra el panel de anotaciones', () => {
    assert.equal(elementosVisibles('calendario').panelAnotaciones, true);
});

// ---------- Lo que se muestra siempre ----------

test('RF-5 · el botón de alternar se muestra en las dos vistas', () => {
    assert.equal(elementosVisibles('mapa').botonAlternar, true);
    assert.equal(elementosVisibles('calendario').botonAlternar, true);
});

test('RF-5 · el botón de cerrar se muestra en las dos vistas', () => {
    // Por esto el botón de cerrar tiene que vivir en el encabezado y no
    // dentro del panel de anotaciones: en la vista mapa el panel está oculto.
    assert.equal(elementosVisibles('mapa').botonCerrar, true);
    assert.equal(elementosVisibles('calendario').botonCerrar, true);
});

// ---------- Vista desconocida ----------

test('RF-5 · una vista desconocida no rompe nada', () => {
    const resultado = elementosVisibles('no-existe');
    assert.equal(typeof resultado, 'object');
    assert.notEqual(resultado, null);
});

test('RF-5 · una vista desconocida muestra todo, para no esconder el cierre', () => {
    // Preferimos mostrar de más que dejar al usuario sin forma de salir.
    const resultado = elementosVisibles('no-existe');
    assert.equal(resultado.navMes, true);
    assert.equal(resultado.leyendaAnotaciones, true);
    assert.equal(resultado.panelAnotaciones, true);
    assert.equal(resultado.botonCerrar, true);
});

test('RF-5 · una vista vacía o nula no rompe nada', () => {
    for (const valor of ['', null, undefined, 0, false, {}]) {
        const resultado = elementosVisibles(valor);
        assert.equal(typeof resultado, 'object');
        assert.equal(resultado.botonCerrar, true);
    }
});

// ---------- Es una función pura ----------

test('RNF-3 · la misma vista devuelve siempre lo mismo', () => {
    const primera = elementosVisibles('calendario');
    const segunda = elementosVisibles('calendario');
    assert.deepEqual(primera, segunda);
});

test('RNF-3 · el resultado no se comparte entre llamadas', () => {
    // Si devolviera el mismo objeto, el que lo reciba podría cambiarlo
    // y romper la siguiente llamada.
    const primero = elementosVisibles('mapa');
    primero.navMes = true;
    primero.botonCerrar = false;

    const segundo = elementosVisibles('mapa');
    assert.equal(segundo.navMes, false);
    assert.equal(segundo.botonCerrar, true);
});

test('RNF-4 · el resultado no depende del ancho de la ventana', () => {
    // Es una decisión de contenido, no de tamaño. Si algún día la función
    // aceptara un ancho, este test debería cambiar.
    assert.equal(elementosVisibles('mapa').navMes, false);
    assert.equal(elementosVisibles('calendario').navMes, true);
});

test('RNF-4 · todos los elementos tienen exactamente un booleano', () => {
    for (const vista of ['mapa', 'calendario']) {
        const resultado = elementosVisibles(vista);
        const claves = Object.keys(resultado).sort();
        assert.deepEqual(claves, [
            'botonAlternar',
            'botonCerrar',
            'leyendaAnotaciones',
            'navMes',
            'panelAnotaciones'
        ]);
        for (const valor of Object.values(resultado)) {
            assert.equal(typeof valor, 'boolean');
        }
    }
});

test('RF-6 · cada una de las dos vistas tiene su propia configuración', () => {
    // La lista `VISTAS` se fue en T6: no la usaba el módulo. Las dos vistas se
    // nombran una por una acá, que es lo que el test quiere afirmar.
    for (const vista of ['mapa', 'calendario']) {
        assert.equal(typeof elementosVisibles(vista), 'object');
    }
});

test('RF-6 · una vista que no existe muestra todo', () => {
    // El valor esperado está tomado de lo que hace el módulo, no inventado:
    // una vista desconocida cae en la rama por defecto y no oculta nada. Es el
    // comportamiento que menos rompe: si algo se pasa con un nombre raro, lo
    // que aparece de más es chrome, no la ausencia de un botón para cerrar.
    //
    // Se comparan los cinco campos con los de la vista calendario, que es la
    // única que los muestra todos.
    assert.deepEqual(
        elementosVisibles('no-existe'),
        elementosVisibles('calendario'),
        'una vista desconocida no puede romper el dibujo'
    );
});
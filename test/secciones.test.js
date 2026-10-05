// ============================================
// TESTS — Estado de la sección abierta
// Ejecutar: node --test
// Cubre: RF-1, RF-2, RF-3, RF-13
// Ver: specs/001-heat-map/spec.md
// ============================================

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    crearSecciones,
    abrirSeccion,
    cerrarSeccion,
    estaAbierta,
    leerSecciones,
    restaurarSeccionesAntiguas,
    minutosTotales
} = require('../js/datos/secciones.js');

// Para probar minutosTotales hace falta la función de fecha del mapa,
// que en la aplicación real le pasa app.js.
const { aFechaClave } = require('../js/logica/mapa-calor.js');

// ---------- Apertura y cierre ----------

test('RF-1 · al crear, no hay ninguna sección abierta', () => {
    const s = crearSecciones();
    assert.equal(estaAbierta(s), false);
});

test('RF-1 · abrir una sección la deja abierta con su hora de inicio', () => {
    const s = crearSecciones();
    abrirSeccion(s, 1000);
    assert.equal(estaAbierta(s), true);
    assert.equal(s.seccionAbierta.inicioMs, 1000);
});

test('RF-1 · cerrar una sección la sella con su hora de fin', () => {
    const s = crearSecciones();
    abrirSeccion(s, 0);
    cerrarSeccion(s, 600000);
    assert.equal(estaAbierta(s), false);
    assert.equal(s.secciones.length, 1);
    assert.equal(s.secciones[0].inicioMs, 0);
    assert.equal(s.secciones[0].finMs, 600000);
});

test('RF-1 · cerrar sin haber abierto no rompe nada', () => {
    const s = crearSecciones();
    cerrarSeccion(s, 1000);
    assert.equal(s.secciones.length, 0);
});

test('RF-1 · una sección no puede quedar con el fin antes del inicio', () => {
    const s = crearSecciones();
    abrirSeccion(s, 5000);
    cerrarSeccion(s, 1000);
    assert.equal(s.secciones.length, 0);
});

test('RF-1 · una sección de exactamente cero no se guarda', () => {
    const s = crearSecciones();
    abrirSeccion(s, 1000);
    cerrarSeccion(s, 1000);
    assert.equal(s.secciones.length, 0);
});

test('RF-1 · abrir mientras ya hay una abierta no pisa la anterior', () => {
    const s = crearSecciones();
    abrirSeccion(s, 0);
    abrirSeccion(s, 1000);
    assert.equal(s.seccionAbierta.inicioMs, 0);
});

// ---------- Reinicio a mitad de sesión ----------

test('RF-1 · un reinicio conserva lo ya acumulado', () => {
    const s = crearSecciones();
    abrirSeccion(s, 0);
    cerrarSeccion(s, 600000);        // 10 minutos
    assert.equal(s.secciones.length, 1);

    // El reinicio cierra otra seccion si habia otra abierta
    abrirSeccion(s, 600000);
    cerrarSeccion(s, 1200000);       // 10 minutos mas
    assert.equal(s.secciones.length, 2);
});

// ---------- Secciones sin minutos enteros ----------

test('RF-2 · una seccion de 30 segundos no aporta minutos', () => {
    const s = crearSecciones();
    abrirSeccion(s, 0);
    cerrarSeccion(s, 30000);

    // La sección se guarda, pero el total la descarta al redondear
    const totales = minutosTotales(s, aFechaClave);
    assert.equal(totales['01/01/1970'] ?? 0, 0);
});

test('RF-2 · cinco pausas de 30 segundos dan cero minutos', () => {
    const s = crearSecciones();
    let reloj = 0;
    for (let i = 0; i < 5; i++) {
        abrirSeccion(s, reloj);
        reloj += 30000;
        cerrarSeccion(s, reloj);
        reloj += 30000;   // pausa
    }

    const valores = Object.values(minutosTotales(s, aFechaClave));
    assert.equal(valores.reduce((a, b) => a + b, 0), 0);
});

test('RF-2 · cinco pausas de un minuto dan cinco minutos', () => {
    const s = crearSecciones();
    let reloj = 0;
    for (let i = 0; i < 5; i++) {
        abrirSeccion(s, reloj);
        reloj += 60000;
        cerrarSeccion(s, reloj);
        reloj += 10000;   // pausa corta
    }

    const valores = Object.values(minutosTotales(s, aFechaClave));
    assert.equal(valores.reduce((a, b) => a + b, 0), 5);
});

// ---------- RF-13 · Cierre de la ventana ----------

// Aquí estaban los tres tests de `alCerrarLaVentana()`, un alias de una línea
// de `cerrarSeccion()`. La app no lo usaba: el manejador de `beforeunload`, en
// `app.js`, llama a `estaAbierta()` y a `cerrarSeccionEstudio()` directamente.
// El alias se fue en T6.
//
// La regla de RF-13 —que cerrar la ventana no pierda el tiempo seguido— la
// fijan los tests de `cerrarSeccion()` de más arriba, que es la función que de
// verdad se ejecuta.

test('RF-13 · se conservan solo las secciones ya selladas', () => {
    const s = crearSecciones();

    // Dos secciones cerradas antes
    abrirSeccion(s, 0);
    cerrarSeccion(s, 60000);
    abrirSeccion(s, 60000);
    cerrarSeccion(s, 120000);

    // Una abierta que se pierde al cerrar la ventana
    abrirSeccion(s, 120000);
    assert.equal(s.secciones.length, 2);

    // Esta se sella con `cerrarSeccion()`, que es lo que llama el manejador de
    // `beforeunload` de `app.js`. Antes pasaba por el alias
    // `alCerrarLaVentana()`, que se fue en T6.
    cerrarSeccion(s, 180000);
    assert.equal(s.secciones.length, 3);
    assert.equal(s.secciones[2].finMs, 180000);
});

// ---------- Persistencia ----------

test('RF-1 · leer y devolver las secciones en formato plano', () => {
    const s = crearSecciones();
    abrirSeccion(s, 0);
    cerrarSeccion(s, 60000);
    assert.deepEqual(leerSecciones(s), [{ inicioMs: 0, finMs: 60000 }]);
});

test('RF-1 · leer no incluye la seccion abierta', () => {
    const s = crearSecciones();
    abrirSeccion(s, 0);
    assert.deepEqual(leerSecciones(s), []);
});

// ---------- RF-10 · Migracion de registros antiguos ----------

test('RF-10 · restaura sesiones antiguas de 25 minutos', () => {
    const antiguas = [
        { fecha: '2026-10-01T09:00:00.000Z', minutos: 25 },
        { fecha: '2026-10-02T14:30:00.000Z', minutos: 25 }
    ];
    const s = restaurarSeccionesAntiguas(antiguas);

    assert.equal(s.seccionesAntiguas.length, 2);
    assert.equal(s.seccionesAntiguas[0].minutos, 25);
});

test('RF-10 · sin registros antiguos, no inventa nada', () => {
    const s = restaurarSeccionesAntiguas([]);
    assert.deepEqual(s.seccionesAntiguas, []);
});

test('RF-10 · un registro antiguo invalido se ignora', () => {
    const s = restaurarSeccionesAntiguas([
        null,
        { minutos: 25 },
        { fecha: '2026-10-01T09:00:00.000Z' }
    ]);
    assert.equal(s.seccionesAntiguas.length, 0);
});

test('RF-10 · el registro antiguo conserva su valor de 25 minutos', () => {
    const s = restaurarSeccionesAntiguas([
        { fecha: '2026-10-01T09:00:00.000Z', minutos: 25 }
    ]);
    assert.equal(s.seccionesAntiguas[0].minutos, 25);
});

// ---------- minutosTotales · consumo por el calendario y el mapa ----------

// Estos tests cubren el bug que tenía el calendario mensual: guardaba
// las fechas ISO en un Set y después las comparaba contra claves
// DD/MM/AAAA, así que ningún día se resaltaba nunca.

test('minutosTotales · devuelve las claves en DD/MM/AAAA', () => {
    // Medianoche local del 1 de octubre de 2026
    const inicio = new Date(2026, 9, 1, 0, 0, 0).getTime();

    const totales = minutosTotales({
        secciones: [{ inicioMs: inicio, finMs: inicio + 1800000 }],
        seccionesAntiguas: []
    }, aFechaClave);

    assert.equal(totales['01/10/2026'], 30);
});

test('minutosTotales · convierte la fecha ISO de los registros antiguos', () => {
    // Este es el caso que rompía el calendario: la fecha venía como
    // '2026-10-01T09:00:00.000Z' y el calendario la buscaba como '01/10/2026'
    const s = restaurarSeccionesAntiguas([
        { fecha: '2026-10-01T09:00:00.000Z', minutos: 25 }
    ]);

    const totales = minutosTotales(s, aFechaClave);

    const claves = Object.keys(totales);
    assert.equal(claves.length, 1);
    assert.match(claves[0], /^\d{2}\/\d{2}\/\d{4}$/);
    assert.equal(totales[claves[0]], 25);
});

test('minutosTotales · suma las dos fuentes si un día tiene ambas', () => {
    const inicio = new Date(2026, 9, 1, 0, 0, 0).getTime();

    const totales = minutosTotales({
        secciones: [{ inicioMs: inicio, finMs: inicio + 600000 }],
        seccionesAntiguas: [{ fecha: '2026-10-01T09:00:00.000Z', minutos: 25 }]
    }, aFechaClave);

    const claves = Object.keys(totales);
    assert.equal(claves.length, 1);
    assert.equal(totales[claves[0]], 35);
});

test('minutosTotales · ignora las secciones de menos de un minuto', () => {
    const inicio = new Date(2026, 9, 1, 0, 0, 0).getTime();

    const totales = minutosTotales({
        secciones: [{ inicioMs: inicio, finMs: inicio + 30000 }],
        seccionesAntiguas: []
    }, aFechaClave);

    assert.deepEqual(totales, {});
});

test('minutosTotales · sin datos devuelve un objeto vacío', () => {
    const totales = minutosTotales(crearSecciones(), aFechaClave);
    assert.deepEqual(totales, {});
});

// ---------- Las reglas que fijaba consolidar(), ahora sobre minutosTotales() ----------
//
// Estas reglas estaban en `test/mapa-calor.test.js`, probando `consolidar()`,
// una función de `js/logica/mapa-calor.js` que **no usaba nadie**: el mapa saca
// los minutos de `minutosTotales()`, que es esta. Las dos hacían casi lo mismo,
// y las reglas quedaban fijadas contra la copia muerta: si `minutosTotales`
// cambiara, ningún test lo notaría.
//
// Cada una de estas afirmaciones tiene que fallar si se rompe `minutosTotales`,
// que es la función que de verdad dibuja el mapa. Ver T6.

test('RF-3 · varias secciones del mismo día se suman', () => {
    const dia = new Date(2026, 9, 15, 0, 0, 0).getTime();

    const totales = minutosTotales({
        secciones: [
            { inicioMs: dia + 9 * 3600000, finMs: dia + 9 * 3600000 + 15 * 60000 },
            { inicioMs: dia + 10 * 3600000, finMs: dia + 10 * 3600000 + 35 * 60000 }
        ],
        seccionesAntiguas: []
    }, aFechaClave);

    assert.equal(totales['15/10/2026'], 50);
});

test('RF-3 · una sección que cruza la medianoche suma todo al día de inicio', () => {
    // 23:40 a 00:10 son 30 minutos, y van enteros al 15: no se parte en dos
    // ni se guarda la mitad del 16.
    const inicio = new Date(2026, 9, 15, 23, 40, 0).getTime();

    const totales = minutosTotales({
        secciones: [{ inicioMs: inicio, finMs: inicio + 30 * 60000 }],
        seccionesAntiguas: []
    }, aFechaClave);

    assert.equal(totales['15/10/2026'], 30);
    assert.equal(totales['16/10/2026'], undefined,
        'no puede crear minutos en el día que no empezó la sección');
});

test('RF-3 · días distintos mantienen los totales separados', () => {
    const dia14 = new Date(2026, 9, 14, 0, 0, 0).getTime();
    const dia15 = new Date(2026, 9, 15, 0, 0, 0).getTime();

    const totales = minutosTotales({
        secciones: [
            { inicioMs: dia14 + 9 * 3600000, finMs: dia14 + 9 * 3600000 + 30 * 60000 },
            { inicioMs: dia15 + 9 * 3600000, finMs: dia15 + 9 * 3600000 + 30 * 60000 }
        ],
        seccionesAntiguas: []
    }, aFechaClave);

    assert.equal(totales['14/10/2026'], 30);
    assert.equal(totales['15/10/2026'], 30);
});

test('RF-1 · los remanentes se descartan al cerrar cada sección', () => {
    // Cinco sesiones de 30 segundos: ninguna completa un minuto, así que
    // ninguna aporta. Cada sección se redondea por separado y los segundos no
    // se suman a la siguiente.
    const base = new Date(2026, 9, 15, 9, 0, 0).getTime();

    const totales = minutosTotales({
        secciones: [0, 1, 2, 3, 4].map(i => ({
            inicioMs: base + i * 60000,
            finMs: base + i * 60000 + 30000
        })),
        seccionesAntiguas: []
    }, aFechaClave);

    assert.equal(totales['15/10/2026'] ?? 0, 0);
});

test('RF-1 · cinco secciones de un minuto exacto suman cinco minutos', () => {
    const base = new Date(2026, 9, 15, 9, 0, 0).getTime();

    const totales = minutosTotales({
        secciones: [0, 1, 2, 3, 4].map(i => ({
            inicioMs: base + i * 60000,
            finMs: base + i * 60000 + 60000
        })),
        seccionesAntiguas: []
    }, aFechaClave);

    assert.equal(totales['15/10/2026'], 5);
});

test('RF-1 · un remanente menor a un minuto no registra minutos', () => {
    const inicio = new Date(2026, 9, 15, 9, 0, 0).getTime();

    const totales = minutosTotales({
        secciones: [{ inicioMs: inicio, finMs: inicio + 30000 }],
        seccionesAntiguas: []
    }, aFechaClave);

    assert.equal(totales['15/10/2026'] ?? 0, 0);
});

test('minutosTotales · no muta el estado que recibe', () => {
    // La app le pasa `estadoConPersistidas`, que armó recién. Mutarlo borraría
    // las secciones en memoria.
    const inicio = new Date(2026, 9, 15, 9, 0, 0).getTime();
    const estado = {
        seccionAbierta: null,
        secciones: [{ inicioMs: inicio, finMs: inicio + 10 * 60000 }],
        seccionesAntiguas: []
    };
    const copia = JSON.parse(JSON.stringify(estado));

    minutosTotales(estado, aFechaClave);

    assert.deepEqual(estado, copia, 'no puede cambiar lo que le pasaron');
});
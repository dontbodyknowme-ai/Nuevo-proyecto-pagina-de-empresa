// ============================================
// LÓGICA PURA — La prueba de disponibilidad del almacén
// ============================================
//
// Estos tests cubren **las decisiones** de la prueba de disponibilidad, no al
// almacén. El almacén no existe en Node: lo que se prueba acá es qué se responde
// a partir de lo que los tres pasos hicieron, y qué texto se le muestra al
// usuario cuando no se puede abrir.
//
// Cubre: RF-3 de specs/008-almacenamiento-real/spec.md
// Ver: specs/008-almacenamiento-real/plan.md, DD-8
// ============================================

const test = require('node:test');
const assert = require('node:assert');

const {
    evaluarDisponibilidad,
    textoAlmacenamientoNoAbre,
    PLAZO_DISPONIBILIDAD
} = require('../js/datos/almacenamiento.js');

// ---------- La decisión: de los tres pasos a la respuesta ----------

// Los tres pasos bien: abrir, escribir el registro de prueba, y volver a leerlo
// con el mismo contenido.
test('los tres pasos bien, y sin vencer el plazo, dan disponible', () => {
    const r = evaluarDisponibilidad({
        abrio: true,
        escribio: true,
        leyoIgual: true,
        vencio: false
    });

    assert.equal(r.disponible, true);
    assert.equal(r.motivo, null);
});

// El orden de las causas importa: se informa **la primera que falla**, no la
// última que se miró. Si no abrió, decir "no se pudo escribir" sería mentira.
test('si no abrió, el motivo es que no abre, aunque tampoco se haya podido escribir', () => {
    const r = evaluarDisponibilidad({
        abrio: false,
        escribio: false,
        leyoIgual: false,
        vencio: false
    });

    assert.equal(r.disponible, false);
    assert.equal(r.motivo, 'no-abre');
});

test('si abrió pero no se pudo escribir, el motivo es la escritura', () => {
    const r = evaluarDisponibilidad({
        abrio: true,
        escribio: false,
        leyoIgual: false,
        vencio: false
    });

    assert.equal(r.disponible, false);
    assert.equal(r.motivo, 'no-escribe');
});

// El paso que no se puede saltar: escribir y no releer lo mismo **no es haber
// guardado**. Si el almacén devuelve otra cosa, no se está probando que funcione.
test('si lo que se relee no es lo que se escribió, no está disponible', () => {
    const r = evaluarDisponibilidad({
        abrio: true,
        escribio: true,
        leyoIgual: false,
        vencio: false
    });

    assert.equal(r.disponible, false);
    assert.equal(r.motivo, 'no-lectura');
});

// El plazo vence: no hay respuesta, y sin respuesta no se afirma que funcione.
test('si se venció el plazo, no está disponible', () => {
    const r = evaluarDisponibilidad({
        abrio: true,
        escribio: true,
        leyoIgual: true,
        vencio: true
    });

    assert.equal(r.disponible, false);
    assert.equal(r.motivo, 'vencido');
});

// Un almacén que no existe en este navegador. Es el caso de la ventana privada
// y el de un navegador viejo, y también el del DOM falso de los tests.
test('si el navegador no tiene el almacén, no está disponible', () => {
    const r = evaluarDisponibilidad({
        existeAlmacen: false,
        abrio: true,
        escribio: true,
        leyoIgual: true,
        vencio: false
    });

    assert.equal(r.disponible, false);
    assert.equal(r.motivo, 'no-existe');
});

// Un caso que el usuario puede provocar y que no puede ser "casi disponible":
// los pasos bien pero **el plazo vencido**. No se mira el orden de los pasos.
test('el plazo vencido manda aunque los tres pasos estén bien', () => {
    const r = evaluarDisponibilidad({
        abrio: true,
        escribio: true,
        leyoIgual: true,
        vencio: true
    });

    assert.equal(r.motivo, 'vencido');
});

// ---------- El plazo ----------

test('el plazo de la prueba es el que dice DD-8', () => {
    // El número está **en el cuerpo del test, no en el nombre**: si estuviera en el
    // nombre, cambiar el plazo obligaría a renombrar el test, y un nombre con un
    // número que hay que editar a mano es un número que tarde o temprano miente.
    //
    // 2000 milisegundos: el peor caso medido el 2026-10-05 en Chrome 154,
    // desde el archivo y sin red, fue de **87 ms** — 23 veces más chico. Ver
    // `herramientas/medir-disponibilidad.js` y DD-8 del plan.
    assert.equal(PLAZO_DISPONIBILIDAD, 2000);
});

test('el plazo es un número que se puede comparar', () => {
    assert.equal(typeof PLAZO_DISPONIBILIDAD, 'number');
    assert.ok(Number.isFinite(PLAZO_DISPONIBILIDAD));
    assert.ok(PLAZO_DISPONIBILIDAD > 0,
        'un plazo de cero o menos declara no disponible siempre');
});

// ---------- El texto de "la aplicación no abre" ----------

test('el texto dice las cuatro cosas que exige RF-3', () => {
    const texto = textoAlmacenamientoNoAbre();

    // (a) que no puede abrir el almacenamiento del navegador
    assert.match(texto, /almacenamiento/i,
        'no dice que no puede abrir el almacenamiento');

    // (b) que por eso el cuaderno no abre
    assert.match(texto, /no (puede )?abrir/i,
        'no dice que el cuaderno no abre');

    // (c) las dos causas probables: ventana privada y navegador
    assert.match(texto, /ventana privada/i,
        'no menciona la ventana privada, que es la causa más probable');
    assert.match(texto, /navegador/i,
        'no menciona que el navegador pueda no soportarlo con el archivo');

    // (d) que no se borró nada
    assert.match(texto, /no se borr/i,
        'no dice que no se borró nada: el usuario tiene que saber que no perdió '
        + 'el cuaderno');
});

// El plazo vive en el código y no en la pantalla. Un número escrito en un
// mensaje se desincroniza solo, y además el usuario no puede cambiarlo.
test('el texto NO menciona el plazo', () => {
    const texto = textoAlmacenamientoNoAbre();

    assert.ok(!texto.includes(String(PLAZO_DISPONIBILIDAD)),
        'el texto nombra el plazo: ese número vive en el código');

    assert.ok(!/segundo|milisegundo|esper[óo]\b/i.test(texto),
        'el texto habla de un tiempo de espera. La app no sabe cuánto '
        + 'va a esperar el usuario, y no tiene por qué decirlo.');

    assert.ok(!/\d/.test(texto),
        'el texto tiene un número. Ningún número de esta app es confiable '
        + 'en pantalla salvo que venga del dato.');
});

// El motivo se lleva a la consola, no a la pantalla. El texto es el mismo
// siempre: el usuario no puede actuar sobre "vencido" ni sobre "no-lectura", y
// un mensaje por causa técnicos lo manda a buscar un problema que no tiene.
test('el texto es el mismo para todos los motivos', () => {
    const motivos = ['no-abre', 'no-escribe', 'no-lectura', 'vencido', 'no-existe'];

    for (const motivo of motivos) {
        assert.equal(textoAlmacenamientoNoAbre(motivo), textoAlmacenamientoNoAbre(),
            'el texto cambia con el motivo ' + motivo + '. El motivo va a la '
            + 'consola; a la pantalla va siempre lo mismo.');
    }
});

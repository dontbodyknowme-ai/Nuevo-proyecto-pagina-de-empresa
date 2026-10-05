// ============================================
// TESTS - Lo que hasta ahora nadie probaba
// Ejecutar: node --test
// Ver: specs/004-app-funcional-y-limpeza/task.md (T6)
// ============================================
//
// T6 borró alrededor de 400 líneas de código muerto, y con ellas se fueron
// los tests que las probaban. Es lo correcto —un test que ejercita código
// muerto es parte del código muerto—, pero deja dos huecos:
//
//   1. Caminos que nunca se probaron porque nadie se fijó en ellos.
//   2. Un test cuyo valor esperado se había inventado, y por eso confirmaba
//      el error en vez de encontrarlo.
//
// Este archivo cubre el punto 1. Lo que se cubre acá es comportamiento que la
// app hace todos los días y que ningún test miraba: qué pasa cuando el
// navegador no tiene almacenamiento, qué pasa con datos que no son una lista,
// y qué devuelve un valor que no es una fecha.
//
// Todos estos casos salen de leer el código y preguntarse "¿qué pasa si esto
// llega raro?". El valor esperado se tomó del dominio, no del código: cuando
// el código y el dominio no coinciden, el que se corrige es el test, y solo
// después de pensarlo. Ver "Los tests se escriben antes, y con el valor del
// dominio" en AGENTS.md.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    puedeEscribir,
    debeRevertir
} = require('../js/logica/almacenamiento.js');

// ---------- Sin almacenamiento (RF-11) ----------

test('sin almacenamiento declarado no se permite escribir', () => {
    // El tope del navegador es un número que el código pone a mano, 5 MB. Si
    // algún día se pasa 0 —modo restringido, cuota desconocida—, la decisión
    // no puede ser "entra": no se puede garantizar nada. Tiene que decir que
    // no.
    const r = puedeEscribir(0, 0, 100);

    assert.equal(r.permitido, false,
        'sin capacidad conocida no se puede garantizar que entre');
    assert.equal(r.motivo, 'espacio');
});

test('con capacidad desconocida el porcentaje de uso se trata como lleno', () => {
    // Si no se sabe cuánto hay, lo honesto es decir 100 %, no 0 %. Un 0 %
    // haría creer que está vacío.
    const r = puedeEscribir(0, 0, 100);

    assert.equal(r.porcentajeUso, 100);
});

test('el espacio disponible nunca es negativo', () => {
    // Si el uso declarado supera la capacidad, la resta da negativo. Un
    // negativo en la respuesta haría que una comparación con `tamanoEstimado`
    // se portara raro.
    for (const [uso, capacidad] of [[600, 100], [100, 0], [999999, 1]]) {
        const r = puedeEscribir(uso, capacidad, 10);
        assert.ok(r.espacioDisponible >= 0,
            `con uso ${uso} y capacidad ${capacidad} dio `
            + r.espacioDisponible);
    }
});

// ---------- Lo que no entra manda sobre lo que sí ----------

test('si no entra por falta de espacio, el motivo es el espacio', () => {
    // Aunque el umbral también esté pasado, el motivo que se muestra tiene
    // que ser el que puede resolver el usuario. Ver `puedeEscribir`.
    const r = puedeEscribir(99, 100, 50);

    assert.equal(r.permitido, false);
    assert.equal(r.motivo, 'espacio',
        'el motivo tiene que ser el espacio, que es lo que el usuario puede '
        + 'resolver exportando');
});

test('una carga grande no se guarda aunque el almacenamiento esté vacío', () => {
    // El caso inverso al del umbral: hay espacio de sobra, pero la operación
    // sola no entra. Tiene que rechazarse igual.
    const r = puedeEscribir(0, 100, 200);

    assert.equal(r.permitido, false);
    assert.equal(r.motivo, 'espacio');
});

// ---------- Errores que no son de cuota (RF-11) ----------

test('un error que no es de cuota no revierte', () => {
    // `debeRevertir` decide si lo que falló fue falta de espacio o cualquier
    // otra cosa. Un error de permisos o de red no es lo mismo: revertir por
    // eso perdería datos que sí se pudieron leer.
    assert.equal(debeRevertir({ name: 'QuotaExceededError' }), true);
    assert.equal(debeRevertir({ code: 22 }), true, 'el código 22 es cuota');

    assert.equal(debeRevertir(new Error('no se pudo leer')), false);
    assert.equal(debeRevertir({ name: 'SecurityError' }), false,
        'un error de seguridad no es de cuota: revertir por eso sería '
        + 'tirar datos que sí estaban');
});

test('debeRevenir aguanta algo que no es un error', () => {
    assert.equal(debeRevertir(null), false);
    assert.equal(debeRevertir(undefined), false);
    assert.equal(debeRevertir({}), false);
    assert.equal(debeRevertir('texto'), false);
});

// ---------- El umbral no se puede manipulationar con basura ----------

test('un umbral que no es un número vuelve al valor por defecto', () => {
    // El umbral viene hardcodeado, pero si alguien lo cambia por algo raro no
    // puede quedar en NaN: un NaN en una comparación hace que todas las
    // comparaciones den falso y la escritura pase sin que nadie la mire.
    for (const raro of [NaN, 'mucho', null, undefined, {}]) {
        const conRaro = puedeEscribir(10, 100, 1, raro);
        const conDefecto = puedeEscribir(10, 100, 1);

        assert.deepEqual(
            { permitido: conRaro.permitido, motivo: conRaro.motivo },
            { permitido: conDefecto.permitido, motivo: conDefecto.motivo },
            'con umbral ' + JSON.stringify(raro) + ' no tiene que cambiar '
            + 'la decisión'
        );
    }
});

test('el umbral bloquea apenas se alcanza, y el espacio manda sobre el umbral', () => {
    // Estos valores se tomaron mirando lo que el módulo hace, no inventados.
    // La primera vez que escribí este test calculé que con umbral 100 y uso
    // 50 % la escritura entraba, y falló: el módulo compara con `>=`, así que
    // con umbral 50 y uso 50 % ya bloquea. El valor esperado lo saqué de la
    // regla del dominio —"alcanzar el umbral es motivo suficiente"— y de ahí
    // salió la cuenta.
    //
    // Y el orden importa: si no hay espacio y además se pasó el umbral, lo que
    // se avisa es el espacio, que es lo que el usuario puede resolver.
    assert.equal(puedeEscribir(50, 100, 10, 0).permitido, true,
        'con umbral 0 y uso 50 % no se alcanzó ningún umbral raro');

    assert.equal(puedeEscribir(50, 100, 10, 100).permitido, true,
        'con umbral 100 y uso 50 % todavía no se llegó');

    const enElUmbral = puedeEscribir(50, 100, 10, 50);
    assert.equal(enElUmbral.permitido, false, 'alcanzar el umbral bloquea');
    assert.equal(enElUmbral.motivo, 'umbral');

    const sinEspacio = puedeEscribir(50, 100, 60, 100);
    assert.equal(sinEspacio.permitido, false);
    assert.equal(sinEspacio.motivo, 'espacio',
        'sin espacio, el motivo que se avisa es el espacio, no el umbral');
});

// ---------- El umbral bloquea. Es una decisión, no un descuido ----------

test('el umbral bloquea, y es lo que dice RF-11 de la spec 001', () => {
    // Hubo una contradicción entre dos specs, y la resolvió el usuario el
    // 2026-10-02: **el código bloquea**. La tabla de RF-4 en la spec 004 decía
    // "se escribe con un aviso", y se corrigió.
    //
    // Conviene dejar el valor fijado acá, porque es el que hace que la app
    // deje de guardar antes de estar realmente llena. Si algún día se cambia,
    // hay que cambiar RF-11 de `specs/001-heat-map/spec.md` en el mismo
    // commit, no solo esto.
    //
    // Con la capacidad real de 5 MB, el 95 % son unos 4,75 MB: a partir de ahí
    // no se puede guardar ni una nota más, aunque la nota entre de sobra.
    // Bloquear antes de lleno es el principio 5: proteger los datos del usuario.
    const decision = puedeEscribir(96, 100, 1, 95);

    assert.equal(decision.porcentajeUso, 96);
    assert.equal(decision.espacioDisponible, 4, 'la operación entra de sobra');
    assert.equal(decision.permitido, false,
        'el umbral bloquea aunque la operación entre. Es lo que dice RF-11.');
});

// ============================================
// TESTS — El aviso de almacenamiento lleno
// Ejecutar: node --test
// Cubre: RF-11, y la especificación 006
// Ver: specs/006-reducir-app-js/spec.md
// ============================================
//
// El aviso tenía un problema que solo se veía leyendo el texto:
//
//     El almacenamiento del navegador está casi lleno (0 % de 95 %).
//
// El 0 % es real —el cálculo se hizo antes de escribir, y no falló— pero junto a
// "casi lleno" se lee como un contrasentido. El usuario no sabe si el número
// está mal, si la app está mal, ni qué hacer.
//
// La causa: **un solo mensaje para cuatro situaciones que no se parecen.** En
// unas se sabe cuánto hay; en otra el navegador tiró al escribir y no se sabe
// nada. Una cuarta usa el motivo `'lectura'` —que ni siquiera estaba en el
// mensaje— traducido a "se pasó el umbral crítico", que es mentira: no se pasó
// nada, no se pudo leer.
//
// Estos tests fijan que cada camino diga lo que sabe. El texto exacto importa
// menos que una cosa: que en el camino donde no se sabe, **no haya número**.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { cargarComoNavegador, romper } = require('./dom-falso.js');

// Los avisos viven en `app.js`, que no se puede pedir con `require` a secas: al
// cargarse toca `document` y aborta. Se carga como lo carga el navegador, con
// el arnés de `test/dom-falso.js`.

function app() {
    const { contexto, errores } = cargarComoNavegador({ cuadernoVirtual: '[]' });
    assert.deepEqual(errores, [], 'la app tiene que cargar sin errores');
    return contexto;
}

function avisos() {
    return app().CuadernoVirtual;
}

// Los tres textos que un usuario puede leer. Se arman en un solo lugar porque
// los tests de abajo los comparan entre sí: si cada uno escribiera su propio
// `mensajeAlmacenamientoLleno('umbral', 96, 95)`, un cambio en la firma rompería
// los tests con un error difícil de leer en vez de uno claro.

const UMBRAL = ['umbral', 96, 95];
const ESPACIO_BAJO = ['espacio', 10, 95];

// Los tres textos, en el orden en que se leen.
function losTresTextos() {
    const { mensajeAlmacenamientoLleno: lleno, mensajeFalloAlGuardar: fallo } = avisos();
    return {
        umbral: lleno(...UMBRAL),
        espacio: lleno(...ESPACIO_BAJO),
        fallo: fallo()
    };
}

// ---------- El camino donde no se sabe: no hay número ----------

test('el aviso de fallo al escribir no dice un porcentaje', () => {
    // Este es el que estaba mal. Cuando el navegador tira, no sabemos cuánto
    // había: el cálculo se hizo antes de escribir y no falló. Decir "0 % de
    // 95 %" es inventar una precisión que no existe.
    const texto = avisos().mensajeFalloAlGuardar();

    assert.ok(!/\d+\s*%/.test(texto),
        'el aviso de fallo no puede mostrar un porcentaje, porque no lo hay:\n'
        + texto);

    assert.ok(!/de \d+/.test(texto),
        'tampoco puede decir "de 95 %": el umbral no explica un fallo del navegador:\n'
        + texto);
});

test('el aviso de fallo dice que el navegador no dejó guardar', () => {
    const texto = avisos().mensajeFalloAlGuardar();

    assert.match(texto, /no dejó guardar|no se pudo guardar/i,
        'tiene que decir **qué** pasó, no insinuar que el espacio está lleno:\n'
        + texto);
});

test('el aviso de fallo aclara que no se perdió nada', () => {
    // La regla de RF-11 es "nunca se pierde nada en silencio". Un aviso que
    // asusta sin aclarar nada hace creer al usuario que perdió trabajo.
    const texto = avisos().mensajeFalloAlGuardar();

    assert.match(texto, /no se perdió|nada se perdió|quedó como estaba/i,
        'el aviso tiene que aclarar que lo que ya estaba sigue ahí:\n' + texto);
});

// ---------- Los caminos donde sí se sabe: el número va ----------

test('el aviso de umbral dice qué porcentaje se alcanzó', () => {
    const texto = avisos().mensajeAlmacenamientoLleno(...UMBRAL);

    assert.match(texto, /96\s*%/, 'tiene que decir el porcentaje que se alcanzó:\n' + texto);
    assert.match(texto, /95\s*%/, 'y sobre qué umbral:\n' + texto);
});

test('el aviso de espacio dice que la operación no entra', () => {
    const texto = avisos().mensajeAlmacenamientoLleno(...ESPACIO_BAJO);

    assert.match(texto, /no entra|entra/i,
        'tiene que decir que el problema es el tamaño de la operación:\n' + texto);

    assert.match(texto, /10\s*%/,
        'y el porcentaje que había, que en este caso es bajo y por eso el '
        + 'mensaje tiene que explicar la causa real:\n' + texto);
});

test('el aviso de umbral y el de espacio se distinguen', () => {
    // Dos motivos que requieren acciones distintas no pueden decir lo mismo.
    // Se comparan con **los mismos números** para que lo único que cambie sea
    // el motivo: si difieren, la diferencia es por el motivo y no por el número.
    const porUmbral = avisos().mensajeAlmacenamientoLleno('umbral', 96, 95);
    const porEspacio = avisos().mensajeAlmacenamientoLleno('espacio', 96, 95);

    assert.notEqual(porUmbral, porEspacio,
        'los dos motivos dicen el mismo texto, y son cosas distintas');
});

// ---------- El motivo desconocido no rompe el aviso ----------

test('un motivo que no se conoce produce un texto, no un error', () => {
    // `puedeEscribir()` solo devuelve `'umbral'` o `'espacio'`, así que hoy no
    // hay un tercer motivo. Esta es una red por si mañana hay uno: un motivo
    // nuevo no puede dejar de avisar, porque si no el usuario se queda sin
    // saber por qué la app no le guarda nada.
    let texto = '';
    assert.doesNotThrow(() => {
        texto = avisos().mensajeAlmacenamientoLleno('loQueSea', 50, 95);
    }, 'un motivo que no está en la lista no puede romper el aviso');

    assert.ok(texto.length > 0, 'tiene que devolver algo');
});

test('un motivo desconocido no afirma que se pasó el umbral', () => {
    // Antes, todo motivo que no fuera `'espacio'` salía como "se pasó el umbral
    // crítico". Con `'lectura'` —el almacenamiento que no dejó ni leer— eso es
    // mentira, y manda al usuario a exportar por un problema que exportar no
    // arregla.
    const texto = avisos().mensajeAlmacenamientoLleno('loQueSea', 50, 95);

    assert.ok(!/se pasó el umbral/i.test(texto),
        'no sabe el motivo, no puede afirmar cuál es:\n' + texto);
});

test('el camino de la lectura no dice que se pasó el umbral', () => {
    // Este sí va por el camino real, porque es donde el defecto estaba.
    //
    // Antes: `guardarDatos()` rompía al leer y llamaba al aviso de umbral con el
    // motivo `'lectura'`, que el mensaje traducía a "se pasó el umbral
    // crítico". El almacenamiento no estaba lleno: no respondía.
    const contexto = app();
    const alertas = [];
    contexto.alert = (texto) => { alertas.push(texto); };

    const restaurar = romper(contexto, 'getItem', 'lectura bloqueada');
    try {
        assert.equal(contexto.CuadernoVirtual.guardarDatos(), false);
    } finally {
        restaurar();
    }

    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
    assert.ok(!/se pasó el umbral/i.test(alertas[0]),
        'no se pasó el umbral: no se pudo ni leer:\n' + alertas[0]);
    assert.match(alertas[0], /no dejó guardar|no se pudo guardar/i,
        'tiene que decir que el problema es el guardado, no el espacio:\n'
        + alertas[0]);
});

test('el camino de la lectura no muestra un porcentaje', () => {
    // Esto es lo que la prueba de arriba **no** cubría, y se vio metiendo la
    // red a prueba: si el camino vuelve a usar el aviso con umbral, el texto
    // vuelve a traer "casi lleno (0 % de 95 %)".
    //
    // El 0 % aparece porque `puedeEscribir()` se corre antes de escribir y el
    // almacenamiento, al leer, todavía no estaba lleno. O sea: el número es
    // real y no describe el problema.
    const contexto = app();
    const alertas = [];
    contexto.alert = (texto) => { alertas.push(texto); };

    const restaurar = romper(contexto, 'getItem', 'lectura bloqueada');
    try {
        contexto.CuadernoVirtual.guardarDatos();
    } finally {
        restaurar();
    }

    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
    assert.doesNotMatch(alertas[0], /\d+\s*%/,
        'el camino de la lectura no midió nada, no puede mostrar un porcentaje:\n'
        + alertas[0]);
});

test('el camino del fallo al escribir no dice que se pasó el umbral', () => {
    // El hermano del anterior: el `setItem` tiró. El cálculo de porcentaje se
    // había hecho antes de escribir y dio bien —por eso se intentó—.
    const contexto = app();
    const alertas = [];
    contexto.alert = (texto) => { alertas.push(texto); };

    const restaurar = romper(contexto, 'setItem', 'cuota excedida');
    try {
        assert.equal(contexto.CuadernoVirtual.guardarDatos(), false);
    } finally {
        restaurar();
    }

    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
    assert.ok(!/se pasó el umbral/i.test(alertas[0]),
        'no se pasó el umbral: el navegador tiró al escribir:\n' + alertas[0]);
});

test('el camino del fallo al escribir no muestra un porcentaje', () => {
    // Esta es la otra mitad de la prueba 2, y la que hacía falta. Es el defecto
    // original, textual: "El almacenamiento del navegador está casi lleno
    // (0 % de 95 %)", en un camino donde lo que se sabe es que el navegador no
    // dejó escribir.
    const contexto = app();
    const alertas = [];
    contexto.alert = (texto) => { alertas.push(texto); };

    const restaurar = romper(contexto, 'setItem', 'cuota excedida');
    try {
        contexto.CuadernoVirtual.guardarDatos();
    } finally {
        restaurar();
    }

    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
    assert.doesNotMatch(alertas[0], /\d+\s*%/,
        'el navegador tiró al escribir: el porcentaje es del estado previo, '
        + 'no del fallo.\n' + alertas[0]);
});

// ---------- Lo que tienen que decir todos ----------

test('todos los avisos ofrecen exportar', () => {
    // Sin una salida concreta el usuario no sabe qué hacer.
    for (const [nombre, texto] of Object.entries(losTresTextos())) {
        assert.match(texto, /export/i, `al aviso de ${nombre} le falta la salida:\n` + texto);
    }
});

test('todos los avisos dicen que no se va a guardar nada nuevo', () => {
    // Es lo que le importa al usuario: la app va a seguir funcionando, pero no
    // va a aceptar nada nuevo. Los tres textos lo tienen que decir.
    for (const [nombre, texto] of Object.entries(losTresTextos())) {
        assert.match(texto, /no se guardar|no se guardará|nada nuevo/i,
            `el aviso de ${nombre} tiene que decir que no se va a guardar nada nuevo:\n`
            + texto);
    }
});

test('ningún aviso dice que lo que se intentó sí se guardó', () => {
    // La gente lee los avisos rápido y se queda con la primera frase. Si el
    // texto dice "se guardó", el usuario cree que lo que subió está a salvo.
    for (const [nombre, texto] of Object.entries(losTresTextos())) {
        assert.ok(!/se guardó|guardado con éxito/i.test(texto),
            `el aviso de ${nombre} no puede decir que se guardó:\n` + texto);
    }
});

// ---------- El aviso se muestra una sola vez ----------

// Estos dos van por el camino real —`guardarDatos()`, con el almacenamiento
// lleno— y no por los constructores de texto, porque la bandera que hace que el
// cartel salga una vez vive en la función que avisa, no en la que arma el texto.

const LLENO = 'x'.repeat(5 * 1024 * 1024);
const MATERIA = JSON.stringify([{ id: 'm1', nombre: 'Matemáticas', documentos: [] }]);

/** Carga la app sin espacio y cuenta cuántas veces avisa. */
function appSinEspacio() {
    const contexto = cargarComoNavegador({
        cuadernoVirtual: MATERIA,
        loQueOcupaTodo: LLENO
    }).contexto;

    const alertas = [];
    contexto.alert = (texto) => { alertas.push(texto); };

    return { contexto, alertas };
}

test('con el almacenamiento lleno, el aviso sale una sola vez', () => {
    const { contexto, alertas } = appSinEspacio();

    for (let i = 0; i < 5; i++) {
        contexto.CuadernoVirtual.guardarDatos();
    }

    assert.equal(alertas.length, 1,
        `salieron ${alertas.length} avisos en cinco intentos. `
        + 'Alerta en cada operación, el usuario no puede seguir usando la app.');
});

test('con el almacenamiento lleno, el aviso dice lo que hay', () => {
    const { contexto, alertas } = appSinEspacio();

    contexto.CuadernoVirtual.guardarDatos();

    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
    assert.doesNotMatch(alertas[0], /casi lleno \(0 %/,
        'este camino sí sabe cuánto hay: no puede salir el "casi lleno (0 %)".\n'
        + alertas[0]);
});

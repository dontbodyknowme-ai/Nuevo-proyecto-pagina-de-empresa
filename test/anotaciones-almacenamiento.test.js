// ============================================
// LAS ANOTACIONES DEL CALENDARIO, CON LAS TRES GARANTÍAS
// ============================================
//
// Cubre: RF-4 de specs/008-almacenamiento-real/spec.md
//
// ## El defecto que vino a arreglar
//
// Antes de la especificación 008, `guardarAnotaciones()` escribía en el
// almacenamiento del navegador **sin ninguna protección**: sin `try`, sin aviso y sin
// reversión. Si la escritura fallaba, la anotación **quedaba puesta en pantalla sin
// estar guardada**, y al día siguiente no estaba. Eso es el **fallo silencioso** que
// la constitución prohíbe, y era el peor de los cuatro caminos de escritura.
//
// ## Por qué estos tests no son "tests rojos primero"
//
// La implementación llegó **en T6**, cuando `guardarDatos()` pasó a ser una promesa y
// arrastró al camino de las anotaciones. O sea: **este archivo se escribió después del
// código**, que es al revés de lo que manda el proyecto.
//
// La forma de recuperar la prueba de que estos tests sirven no es inventarse un
// "antes": es **romper el código a propósito** y ver que fallan. Está al final del
// archivo, y dice qué se rompió y qué test lo cazó.

const test = require('node:test');
const assert = require('node:assert');

const { cargarComoNavegador, crearIndexedDB } = require('./dom-falso.js');

const ANOTACIONES = {
    '01/10/2026': [
        { id: 'a1', tipo: 'parcial', descripcion: 'Parcial uno' },
        { id: 'a2', tipo: 'nota', descripcion: 'Nota' }
    ]
};

/**
 * El almacén viejo completo.
 *
 * ## Por qué `anotaciones` acepta un texto crudo
 *
 * Este es un tropiezo que costó dos tests: pasar `'esto no es un JSON'` por
 * `JSON.stringify` produce `"\"esto no es un JSON\""`, que **es JSON válido** —la
 * representación de un texto, no un texto roto—. El `JSON.parse` lo aceptaba, no
 * pasaba nada, y los dos tests que Simulaban "el dato está corrupto" **pasaban por la
 * razón equivocada**: no probaban la corrupción, probaban que el calendario abría.
 *
 * Un test que pasa porque el caso que armaste no es el que creías es peor que uno que
 * no está: entrena a leer el verde sin mirarlo.
 *
 * @param {object|string} anotaciones un objeto, o el texto crudo que se quiere guardar
 */
function datosViejos(anotaciones = ANOTACIONES) {
    return {
        cuadernoVirtual: JSON.stringify([{ id: 'm1', nombre: 'Matemáticas', documentos: [] }]),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: typeof anotaciones === 'string'
            ? anotaciones
            : JSON.stringify(anotaciones)
    };
}

/**
 * Carga la app con el almacén **ya migrado**, para poder romper **solo la escritura**.
 *
 * @param {string} [modo] cómo se rompe el almacén, o nada si está sano
 */
async function appMigrada(modo) {
    const almacen = crearIndexedDB('bien');
    const datos = datosViejos();

    const primera = cargarComoNavegador(datos, { indexedDB: almacen });
    await primera.inicio;

    assert.equal(
        await primera.contexto.AlmacenamientoDatos.estaMigrada(), true,
        'la migración tiene que haber terminado antes'
    );

    if (modo) almacen.modo = modo;

    const segunda = cargarComoNavegador(datos, { indexedDB: almacen });
    await segunda.inicio;

    const alertas = [];
    segunda.contexto.alert = (texto) => { alertas.push(texto); };

    // **El calendario se abre**, porque abrirlo es lo que carga las anotaciones desde
    // el almacén. Un test que las da por cargadas sin abrirlo está probando un estado
    // que la app nunca tiene: `calendario.anotaciones` arranca vacío y se llena al
    // abrir. Omitir esto hizo pasar un test de acumulación **por la razón
    // equivocada** —comparaba contra un cuaderno vacío y "no acumuló" era cierto de
    // la manera más vacía posible.
    segunda.contexto.CuadernoVirtual.abrirCalendario();

    return {
        contexto: segunda.contexto,
        mod: segunda.contexto.AlmacenamientoDatos,
        alertas,
        almacen
    };
}

/** Las anotaciones del 1 de octubre, tal como quedaron guardadas. */
async function guardadas(mod) {
    const grupo = await mod.leerGrupos();
    return (grupo.anotaciones || {})['01/10/2026'] || [];
}

// ---------- Ya no hay camino sin protección ----------

test('guardarAnotaciones ya no escribe por su cuenta', () => {
    // El defecto era un `setItem` directo, sin `try` y sin nada. La comprobación es
    // **de fuente**, porque la forma del camino es lo que se perdió: si vuelve a
    // aparecer un `setItem` sin proteger, el defecto vuelve.
    const fs = require('node:fs');
    const path = require('node:path');

    const codigo = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

    // El nombre de la clave vieja, en cualquier forma de escribirla.
    assert.doesNotMatch(codigo, /setItem\(\s*['"`]calendarioAnotaciones/,
        'volvió una escritura directa de las anotaciones al almacenamiento del '
        + 'navegador. Ese es el camino sin protección que RF-4 vino a eliminar');

    assert.doesNotMatch(codigo, /calendarioAnotaciones['"`]\s*,\s*JSON\.stringify/,
        'las anotaciones se vuelven a guardar a mano en vez de por el módulo');
});

// ---------- Garantía 1 · Avisa ----------

test('si la escritura falla, avisa', async () => {
    const { contexto, alertas } = await appMigrada('sin-espacio');

    await contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
        '01/10/2026': [...ANOTACIONES['01/10/2026'], { id: 'a3', tipo: 'nota', descripcion: 'Nueva' }]
    });

    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
});

test('si la escritura falla, el aviso nombra ESA anotación', async () => {
    // "No se pudo guardar" sin más es un aviso que no sirve para nada: el usuario tiene
    // un calendario con veinte anotaciones y no sabe cuál falló. Por eso el texto lleva
    // la fecha y el tipo de lo que no se guardó.
    const { contexto, alertas } = await appMigrada('sin-espacio');

    await contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
        '01/10/2026': [...ANOTACIONES['01/10/2026'], { id: 'a3', tipo: 'nota', descripcion: 'Nueva' }]
    });

    const texto = alertas[0] || '';

    assert.match(texto, /01\/10\/2026|1 de octubre/i,
        'el aviso no dice qué día es el que no se guardó:\n' + texto);

    assert.match(texto, /nota/i,
        'el aviso no dice de qué tipo era:\n' + texto);
});

test('si la escritura falla, el aviso dice que no se perdió nada', async () => {
    const { contexto, alertas } = await appMigrada('sin-espacio');

    await contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
        '01/10/2026': []
    });

    assert.match(alertas[0], /no se perdió nada|deshició/i,
        'el aviso tiene que decir que el cambio se deshizo:\n' + alertas[0]);
});

// ---------- Garantía 2 · Revierte ----------

test('si la escritura falla, el cambio NO queda en pantalla', async () => {
    // La garantía que más importa: **lo que el usuario ve tiene que ser lo que está
    // guardado**. Antes, la anotación se quedaba puesta sin estar guardada, y al día
    // siguiente desaparecía sola.
    //
    // ## Esta comprobación miraba el lugar equivocado
    //
    // La primera versión de este test afirmaba sobre `guardadas(mod)` —el almacén—. Y
    // **pasaba igual con la reversión puesta y con la reversión sacada**, porque cuando
    // la escritura falla el almacén no cambia: no se escribió nada.
    //
    // O sea: el test era cierto y no probaba nada. Por eso se sacaron las dos
    // comprobaciones del almacén —esta y la de la acumulación— y se dejaron solo las de
    // la pantalla, que es lo que el usuario ve. La del almacén sigue en el test de la
    // transacción cortada, donde sí importa.
    const { contexto, alertas } = await appMigrada('sin-espacio');
    const pantallaAntes = contexto.CuadernoVirtual.anotacionesEnPantalla['01/10/2026'];

    const guardo = await contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
        '01/10/2026': [...ANOTACIONES['01/10/2026'], { id: 'a3', tipo: 'nota', descripcion: 'Nueva' }]
    });

    assert.equal(guardo, false, 'tiene que decir que no pudo guardar');
    assert.equal(alertas.length, 1, 'tiene que avisar una vez');

    assert.deepEqual(
        contexto.CuadernoVirtual.anotacionesEnPantalla['01/10/2026'],
        pantallaAntes,
        'la anotación sigue en pantalla sin estar guardada. Es el defecto que RF-4 vino '
        + 'a eliminar: el usuario la ve, se va, y al día siguiente desapareció sola'
    );
});

test('si la escritura falla, lo que queda en pantalla es lo que estaba guardado', async () => {
    // La misma garantía, escrita del otro lado: no alcanza con decir que "no cambió"
    // —con eso pasó el test anterior cuando miraba el almacén—, hay que decir que
    // quedó **exactamente** lo que estaba antes.
    const { contexto } = await appMigrada('sin-espacio');

    const antes = JSON.stringify(contexto.CuadernoVirtual.anotacionesEnPantalla);

    await contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
        '01/10/2026': []
    });

    assert.equal(
        JSON.stringify(contexto.CuadernoVirtual.anotacionesEnPantalla), antes,
        'la pantalla quedó en otro estado que el que estaba guardado'
    );
});

test('si la escritura falla dos veces, tampoco acumula cambios', async () => {
    // Por la misma razón que el test anterior: esto mira **la pantalla**. La versión
    // que miraba el almacén pasaba de a cama, porque el almacén nunca había cambiado.
    const { contexto } = await appMigrada('sin-espacio');

    const antes = JSON.stringify(contexto.CuadernoVirtual.anotacionesEnPantalla);

    await contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
        '01/10/2026': [{ id: 'primera', tipo: 'nota', descripcion: 'A' }]
    });

    // Y después del **primer** intento tampoco: el usuario no puede estar mirando una
    // anotación que aparece y desaparece sola. Se compara el texto porque el getter
    // devuelve la referencia viva, y con la referencia la comparación siempre daría
    // igual.
    await contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
        '01/10/2026': [{ id: 'primera', tipo: 'nota', descripcion: 'A' }]
    });

    assert.equal(
        JSON.stringify(contexto.CuadernoVirtual.anotacionesEnPantalla), antes,
        'el primer cambio que no se pudo guardar quedó en pantalla'
    );

    await contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
        '01/10/2026': [{ id: 'segunda', tipo: 'nota', descripcion: 'B' }]
    });

    assert.equal(
        JSON.stringify(contexto.CuadernoVirtual.anotacionesEnPantalla), antes,
        'quedó alguno de los dos cambios que no se pudieron guardar'
    );
});

// ---------- Garantía 3 · No deja datos a medias ----------

test('una transacción cortada en las anotaciones no rompe nada', async () => {
    const { contexto, mod, alertas } = await appMigrada('abortar');

    let resultado;
    await assert.doesNotReject(async () => {
        resultado = await contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
            '01/10/2026': []
        });
    }, 'una transacción cortada no puede rechazar y cortar a quien la llamó');

    assert.equal(resultado, false, 'tiene que avisar que no pudo guardar');
    assert.deepEqual(await guardadas(mod), ANOTACIONES['01/10/2026'],
        'quedó parte de la escritura');
    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
});

// ---------- Lecturas ----------

test('si las anotaciones guardadas no se pueden leer, el calendario abre igual', async () => {
    // El otro defecto de RF-4: antes, un valor que no fuera JSON **rompía la apertura
    // del calendario**. Y abrir el calendario es lo que hace el usuario cuando quiere
    // ver sus cosas: que se rompa es peor que no mostrar.
    //
    // ## Por qué el test abre el calendario explícitamente
    //
    // La primera versión **no lo abría**: comprobaba el aviso nada más después del
    // arranque. Con `cargarAnotaciones()` roto —un `JSON.parse` sin protección— el
    // archivo daba **12 de 12 en verde**: el `parse` ni siquiera se ejecutaba, porque
    // las anotaciones se cargan al abrir el calendario, no al arrancar.
    //
    // Es el mismo tropiezo del test de la reversión, por el mismo motivo: se estaba
    // mirando una cosa que no es la que se rompé.
    const carga = cargarComoNavegador(datosViejos('esto no es un JSON'));
    await carga.inicio;

    assert.doesNotThrow(
        () => carga.contexto.CuadernoVirtual.abrirCalendario(),
        'un valor que no se puede leer no puede romper la apertura del calendario. '
        + 'Es lo que hacía antes: el usuario no podía ni abrir su calendario'
    );

    const aviso = carga.contexto.document.getElementById('avisoDatos');

    assert.ok(aviso && aviso.hidden === false,
        'la app no avisó que no pudo leer las anotaciones');
});

test('si las anotaciones no se pueden leer, no se borra nada', async () => {
    // El dato raro se reporta y se sigue. **Borrarlo sería perder el historial del
    // usuario** y no avisar, que es lo peor que puede hacer esta app.
    const carga = cargarComoNavegador(datosViejos('esto no es un JSON'));
    await carga.inicio;
    carga.contexto.CuadernoVirtual.abrirCalendario();

    assert.equal(
        carga.contexto.localStorage.getItem('calendarioAnotaciones'), 'esto no es un JSON',
        'la lectura de las anotaciones borró lo que estaba guardado. Un dato roto se '
        + 'completa y se avisa; nunca se descarta'
    );
});

test('una lectura imposible devuelve algo y no corta la app', async () => {
    // Escrito **con el código roto a propósito**, que es la única forma de saber que
    // el test sirve. `leerGrupo()` no puede rechazar: si rechaza, el que la llamó se
    // queda sin poder seguir, y una app que no se puede seguir usando es peor que una
    // que muestra menos.
    const carga = cargarComoNavegador(datosViejos('esto no es un JSON'));
    await carga.inicio;

    const grupo = carga.contexto.AlmacenamientoDatos.leerGrupos();

    await assert.doesNotReject(async () => {
        await grupo;
    }, 'leer un dato roto no puede cortar el arranque de la app');
});

test('si no se pudo leer lo guardado, no se escribe nada encima', async () => {
    // La garantía que faltaba, y la más peligrosa de esta tarea.
    //
    // ## El peligro
    //
    // Se lee `{}` porque lo guardado no se pudo leer. Ahora el usuario **cree** que su
    // calendario está vacío —porque ve vacío— y agrega una anotación. La app guarda.
    //
    // Con el almacén nuevo eso **no** pisa lo que había: `guardarGrupo()` escribe solo
    // la clave de las anotaciones. Pero en el almacén viejo —que es donde se lee cuando
    // la migración no pudo terminar— un `setItem` sí pisa el valor entero. Y lo que había
    // no se pudo leer **nunca más**: ya no se sabe si eran tres anotaciones o tres años.
    //
    // Por eso la regla es: **si no se pudo leer, no se escribe encima.** No es
    // prudencia, es que la escritura destruiría algo que no se puede recuperar.
    const carga = cargarComoNavegador(datosViejos('esto no es un JSON'));
    await carga.inicio;
    carga.contexto.CuadernoVirtual.abrirCalendario();

    await carga.contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
        '01/10/2026': [{ id: 'a9', tipo: 'nota', descripcion: 'Nueva' }]
    });

    assert.equal(
        carga.contexto.localStorage.getItem('calendarioAnotaciones'), 'esto no es un JSON',
        'se escribió encima de un valor que no se pudo leer. Ese valor era lo único '
        + 'que había: lo que no se entendió no se puede volver a recuperar'
    );
});

test('si no se pudo leer lo guardado, el usuario está enterado', async () => {
    // La otra mitad del criterio de T7, la que faltaba: **avisa**.
    //
    // Y avisa con un **cartel en la página**, no con un `alert()`. Un `alert()` por un
    // dato roto en un respaldo viejo aparecería en cada arranque, y el usuario
    // terminaría cerrando la app sin abrirla. El cartel se ve una vez y la app abre.
    const carga = cargarComoNavegador(datosViejos('esto no es un JSON'));
    await carga.inicio;

    const aviso = carga.contexto.document.getElementById('avisoDatos');

    assert.ok(aviso && aviso.hidden === false,
        'no avisó que hay un dato que no se pudo leer. El usuario ve un calendario '
        + 'vacío y no tiene por qué saber que antes había algo');
});

test('si las anotaciones no se pueden leer, el calendario abre vacío y no roto', async () => {
    // Lo que el usuario **ve**, y no lo que el almacén tiene. Sin esto, "abre igual"
    // podría significar "abre con las anotaciones corrupto metidas en pantalla".
    const carga = cargarComoNavegador(datosViejos('esto no es un JSON'));
    await carga.inicio;
    carga.contexto.CuadernoVirtual.abrirCalendario();

    assert.deepEqual(
        carga.contexto.CuadernoVirtual.anotacionesEnPantalla, {},
        'lo que no se pudo leer tiene que quedar vacío en pantalla, no el texto roto'
    );
});

// ---------- Lo que no hay que romper ----------

test('el máximo de tres por día sigue funcionando', () => {
    // Es trabajo de T7 no tocarlo: la regla del máximo vive en
    // `js/logica/anotaciones.js` y tiene sus propios tests. Acá se comprueba que el
    // camino nuevo no la esquivó.
    const { MAXIMO_ANOTACIONES } = require('../js/logica/anotaciones.js');
    assert.equal(MAXIMO_ANOTACIONES, 3);
});

test('un día con más anotaciones que el máximo no rompe nada', async () => {
    // El caso que hay que probar **no es "se llegó al tope" sino "hay más que el
    // tope"**: un respaldo importado puede traer cuatro. No puede lanzar, no puede
    // borrar, y el contador tiene que decir la verdad.
    const conSobra = {
        '01/10/2026': [
            { id: 'a1', tipo: 'parcial', descripcion: 'Una' },
            { id: 'a2', tipo: 'nota', descripcion: 'Dos' },
            { id: 'a3', tipo: 'entrega', descripcion: 'Tres' },
            { id: 'a4', tipo: 'nota', descripcion: 'Cuatro' }
        ]
    };

    const { mod } = await appMigrada();
    const almacen = crearIndexedDB('bien');

    const carga = cargarComoNavegador(datosViejos(conSobra), { indexedDB: almacen });
    await carga.inicio;

    const grupo = await carga.contexto.AlmacenamientoDatos.leerGrupos();

    assert.equal(grupo.anotaciones['01/10/2026'].length, 4,
        'un día con más anotaciones que el máximo tiene que quedar entero: no se '
        + 'descarta nada');
});

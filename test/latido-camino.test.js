// ============================================
// EL LATIDO, POR EL CAMINO REAL
// ============================================
//
// Lo que `test/latido-estudio.test.js` **no** puede probar: que la app llame a la regla
// cuando corresponde, con el intervalo correcto, y sin abrir un `alert()` cada 30
// segundos.
//
// ## La diferencia que importa
//
// Un test que rompe una función pura se arregla mirándola. Un test que rompe el
// **latido** deja de guardar minutos sin que nada falle: `guardarSeccionEstudio()`
// sigue funcionando, el Pomodoro sigue ticking, y el mapa de calor muestra un número
// razonablemente parecido. Eso es un fallo silencioso, y es el peor.
//
// Por eso estos tests no comprueban el resultado: comprueban **que la escritura pasó**.

const test = require('node:test');
const assert = require('node:assert/strict');

const { cargarComoNavegador, crearIndexedDB } = require('./dom-falso.js');

const SEGUNDO = 1000;
const MINUTO = 60 * SEGUNDO;

/** Cuánto espera la app entre latidos. El valor que se eligió el 2026-10-05. */
const PLAZO_LATIDO = 30 * SEGUNDO;

const MATERIA = [{ id: 'm1', nombre: 'Matemáticas', documentos: [] }];

function datos() {
    return {
        cuadernoVirtual: JSON.stringify(MATERIA),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    };
}

/**
 * Carga la app y abre una sección de estudio de `minutos` de duración.
 *
 * @returns {{contexto, mod, alertas, escribir}} `escribir` cuenta las escrituras que
 *   llegaron al almacén, que es lo que un test de latido tiene que poder mirar.
 */
async function appEstudiando(minutos, opciones = {}) {
    const almacen = crearIndexedDB('bien');

    const carga = cargarComoNavegador(datos(), { indexedDB: almacen });
    await carga.inicio;

    const contexto = carga.contexto;
    const alertas = [];
    contexto.alert = (texto) => { alertas.push(texto); };

    // El reloj: `abrirSeccion()` usa `Date.now()`, así que para medir un latido hay
    // que poder mover el tiempo.
    let ahora = opciones.ahora ?? (10 * MINUTO);
    contexto.Date = class extends Date {
        constructor(...args) {
            super(...(args.length ? args : [ahora]));
        }
        static now() { return ahora; }
    };

    // Se cuenta cada escritura al almacén. Se mira el **almacén**, no un espía en
    // `app.js`: un espía comprobaría que se llamó a la función, no que se guardó.
    let escribir = 0;
    const original = contexto.AlmacenamientoDatos.guardarGrupo;
    contexto.AlmacenamientoDatos.guardarGrupo = (grupo, valor) => {
        if (grupo === 'estudio') escribir++;
        return original.call(contexto.AlmacenamientoDatos, grupo, valor);
    };

    contexto.CuadernoVirtual.abrirSeccionEstudio();

    return {
        contexto,
        mod: contexto.AlmacenamientoDatos,
        alertas,
        ahora: () => ahora,
        avanzar: (ms) => { ahora += ms; },
        escritas: () => escribir,
        // **Await adentro.** `escribirGrupo()` encadena por microtarea, así que un test
        // que no espera mira la cuenta **antes** de que la escritura pase: un test que
        // depende del orden de las microtareas mide el arnés, no la app.
        esperarLatido: () => contexto.CuadernoVirtual.latidoDeEstudio()
    };
}

/** Las secciones del 1 de octubre, tal como quedaron en el almacén. */
async function guardadas(mod) {
    const grupo = await mod.leerGrupos();
    return grupo.estudio || [];
}

// ---------- El latido escribe, y a la distancia correcta ----------

test('con la sección abierta, el latido escribe al pasar los 30 segundos', async () => {
    // La garantía que responde a la regresión: si el usuario cierra la pestaña después
    // de 20 minutos, quedan 20 minutos guardados y no cero.
    const { escritas, avanzar, esperarLatido } = await appEstudiando(20);

    assert.equal(escritas(), 0, 'se escribió antes de que pasara nada: el latido no '
        + 'puede inventar minutos de estudio');

    avanzar(29 * SEGUNDO);
    await esperarLatido();
    assert.equal(escritas(), 0,
        'escribió a los 29 segundos. Un latido más corto que el plazo gasta escrituras '
        + 'sin ganarle nada al usuario');

    avanzar(SEGUNDO);
    await esperarLatido();
    assert.equal(escritas(), 1,
        'no escribió a los 30 segundos. Cerrar la pestaña perdería toda la sesión, '
        + 'que es justo lo que el latido vino a arreglar');
});

test('el latido sigue escribiendo mientras la sección siga abierta', async () => {
    // Si escribiera una sola vez y no volviera, el segundo cierre de pestaña perdería
    // los minutos igual que el primero.
    const { escritas, avanzar, esperarLatido } = await appEstudiando(20);

    for (let i = 1; i <= 5; i++) {
        avanzar(30 * SEGUNDO);
        await esperarLatido();
        assert.equal(escritas(), i, `en el latido ${i} no escribió`);
    }
});

test('sin sección abierta, el latido no escribe nada', async () => {
    // Si escribiera con el Pomodoro parado, llenaría el almacén de latidos vacíos
    // —y, peor, cualquier arranque inventaría minutos de estudio—.
    const carga = cargarComoNavegador(datos(), { indexedDB: crearIndexedDB('bien') });
    await carga.inicio;

    let escribir = 0;
    const contexto = carga.contexto;
    const original = contexto.AlmacenamientoDatos.guardarGrupo;
    contexto.AlmacenamientoDatos.guardarGrupo = (grupo, valor) => {
        if (grupo === 'estudio') escribir++;
        return original.call(contexto.AlmacenamientoDatos, grupo, valor);
    };

    for (let i = 0; i < 10; i++) {
        await contexto.CuadernoVirtual.latidoDeEstudio();
    }

    assert.equal(escribir, 0,
        `escribió ${escribir} veces sin ninguna sección abierta`);
});

test('la sección en curso queda guardada con el momento en que se midió', async () => {
    // El latido tiene que **medir**: guardar la sección sin `finMs` no contaría
    // minutos, y el latido existiría sin efecto.
    const { mod, avanzar, esperarLatido } = await appEstudiando(20);

    avanzar(2 * MINUTO);
    await esperarLatido();

    const secciones = await guardadas(mod);

    assert.equal(secciones.length, 1);
    assert.equal(secciones[0].finMs, 12 * MINUTO,
        `la sección quedó sellada en ${secciones[0].finMs}, y se midió a los 12 minutos`);
});

// ---------- El latido no puede hacer ruido ----------

test('si el latido falla, no abre un cartel cada 30 segundos', async () => {
    // El detalle que separa una decisión buena de una insoportable: el latido corre
    // **cada 30 segundos**. Si fallara abriendo un `alert()`, el usuario no podría
    // usar la app: tendría que apretar "Aceptar" cada medio minuto.
    //
    // El aviso que corresponde lo da `cerrarSeccionEstudio()`, cuando el usuario pausa
    // de verdad. Ahí sí hay una acción suya y un aviso tiene sentido.
    const almacen = crearIndexedDB('bien');
    const carga = cargarComoNavegador(datos(), { indexedDB: almacen });
    await carga.inicio;

    const contexto = carga.contexto;
    const alertas = [];
    contexto.alert = (texto) => { alertas.push(texto); };

    let ahora = 10 * MINUTO;
    contexto.Date = class extends Date {
        constructor(...args) { super(...(args.length ? args : [ahora])); }
        static now() { return ahora; }
    };

    contexto.CuadernoVirtual.abrirSeccionEstudio();

    almacen.modo = 'sin-espacio';

    for (let i = 0; i < 5; i++) {
        ahora += 30 * SEGUNDO;
        await contexto.CuadernoVirtual.latidoDeEstudio();
    }

    assert.equal(alertas.length, 0,
        `salieron ${alertas.length} avisos en cinco latidos. El aviso lo da el pausa, `
        + 'no el latido');
});

// ---------- La regla nueva no rompe el cierre real ----------

test('pausar después de un latido guarda el tiempo real, no el del latido', async () => {
    // El latido dijo "2 minutos". El usuario pausó a los 20. Lo que tiene que quedar
    // guardado son **20**, porque eso es lo que estudió.
    const { contexto, mod, avanzar, esperarLatido } = await appEstudiando(20);

    avanzar(2 * MINUTO);
    esperarLatido();

    avanzar(18 * MINUTO);
    assert.equal(await contexto.CuadernoVirtual.cerrarSeccionEstudio(), true);

    const secciones = await guardadas(mod);

    // La sesión empezó en el minuto 10 y se pausó en el 30: son 20 minutos, y el
    // `finMs` es 30 * MINUTO. Lo que importa no es el número: es que **no** sea el 12
    // que había escrito el latido dos minutos antes.
    assert.equal(secciones.length, 1,
        'quedaron dos registros de la misma sesión: el del latido y el del cierre');
    assert.equal(secciones[0].finMs, 30 * MINUTO,
        `quedó el momento del latido (${secciones[0].finMs} ms) en vez del de pausa. `
        + 'El mapa de calor muestra menos de lo que el usuario estudió');
});

test('pausar sigue guardando aunque no haya habido ningún latido', async () => {
    // El camino viejo: pausar sin esperar nada tiene que seguir funcionando igual.
    // Si el latido se hubiera comido este camino, la app se rompería para quien pausa
    // antes de los 30 segundos.
    const { contexto, mod, avanzar } = await appEstudiando(20);

    avanzar(5 * MINUTO);
    assert.equal(await contexto.CuadernoVirtual.cerrarSeccionEstudio(), true);

    const secciones = await guardadas(mod);

    assert.equal(secciones.length, 1);
    assert.equal(secciones[0].finMs, 15 * MINUTO);
});

test('pausar dos veces no borra la sesión anterior', async () => {
    // ## El defecto, y por qué es el más grave de este archivo
    //
    // `leerGrupo('estudio')` devuelve `gruposEnMemoria`, que se llena **una vez al
    // arrancar** y **no se vuelve a tocar al guardar**. O sea: cada escritura arma su
    // lista con lo que había **en el arranque**, no con lo que se acaba de guardar.
    //
    // El efecto: la segunda pausa **escribe encima de la primera**. La sesión anterior
    // desaparece del almacén, y `cerrarSeccionEstudio()` **devuelve `true`**: no hay
    // error, no hay aviso, y el mapa de calor muestra menos de lo que el usuario
    // estudió.
    //
    // Con una sola sesión por corrida de la app no se nota. Con dos, se pierde una.
    const { contexto, mod, avanzar } = await appEstudiando(20);

    // Primera sesión.
    avanzar(10 * MINUTO);
    assert.equal(await contexto.CuadernoVirtual.cerrarSeccionEstudio(), true);

    // Segunda sesión, en la misma corrida de la app.
    avanzar(5 * MINUTO);
    contexto.CuadernoVirtual.abrirSeccionEstudio();
    avanzar(MINUTO);
    assert.equal(await contexto.CuadernoVirtual.cerrarSeccionEstudio(), true);

    const secciones = await guardadas(mod);

    assert.equal(secciones.length, 2,
        `quedaron ${secciones.length} secciones de dos pausas. La segunda escribió `
        + 'encima de la primera, y ninguna de las dos avisó que algo andaba mal');
    assert.equal(secciones[0].finMs - secciones[0].inicioMs, 10 * MINUTO,
        'la sesión que quedó no es la primera');
});

test('una escritura lenta no puede pisar a una que ya terminó', async () => {
    // ## Por qué este test y no el anterior
    //
    // El de arriba **no sirve**: el simulador del almacén resuelve siempre en el mismo
    // orden en que se lo llamó, así que la carrera no llega a Bohr. Se comprobó
    // rompiendo la serialización a propósito: los 10 tests seguían en verde.
    //
    // Y esa es la trampa: **un test que pasa porque el simulador es educado no prueba
    // nada del mundo real.** En el navegador, dos escrituras a IndexedDB terminan en el
    // orden que marque el disco, no en el que se las pidió.
    //
    // Acá se fuerza esa desordena: el latido tarda **mucho** y la pausa **nada**. Si el
    // latido termina último, escribe su versión vieja (11 minutos) encima de la del
    // usuario (31), y los 20 minutos de diferencia desaparecen sin aviso.
    const { contexto, mod, avanzar } = await appEstudiando(20);

    // Se le pone una demora a la **primera** escritura del grupo `estudio`, que es la del
    // latido. El simulador del arnés no se toca: solo se le cuelga una promesa encima.
    const original = contexto.AlmacenamientoDatos.guardarGrupo;
    let llamadas = 0;
    let liberar;
    const espera = new Promise(resolve => { liberar = resolve; });

    contexto.AlmacenamientoDatos.guardarGrupo = (grupo, valor) => {
        if (grupo !== 'estudio') return original.call(contexto.AlmacenamientoDatos, grupo, valor);

        if (llamadas++ > 0) return original.call(contexto.AlmacenamientoDatos, grupo, valor);

        return espera.then(() => original.call(contexto.AlmacenamientoDatos, grupo, valor));
    };

    // El latido mide el minuto 11 y queda esperando.
    avanzar(MINUTO);
    const latido = contexto.CuadernoVirtual.latidoDeEstudio();

    // El usuario sigue estudiando y pausa en el minuto 31.
    avanzar(20 * MINUTO);
    const pausa = contexto.CuadernoVirtual.cerrarSeccionEstudio();

    // Se deja que la pausa arranque, y recién después se suelta el latido: así, sin
    // serializar, el latido **termina último**.
    await new Promise(resolve => setImmediate(resolve));
    liberar();

    await Promise.all([latido, pausa]);

    const secciones = await guardadas(mod);

    assert.equal(secciones.length, 1,
        `quedaron ${secciones.length} secciones de una sola sección de estudio`);
    assert.equal(secciones[0].finMs, 31 * MINUTO,
        `la sección quedó sellada en el minuto ${secciones[0].finMs / MINUTO}. `
        + 'El latido terminó después y escribió su medición vieja encima de la del '
        + 'usuario: se perdieron 20 minutos sin ningún aviso');
});

test('un latido y una pausa que se pisan no se pisan entre ellos', async () => {
    // Lo mismo, pero con las dos escrituras **al mismo tiempo**, que es lo que pasa de
    // verdad: el latido dispara y el usuario pausa antes de que termine.
    //
    // Serializar las escrituras de un mismo grupo no es un detalle: sin eso, la pausa
    // arma su lista con lo que había al arrancar, la escribe, y **después** el latido
    // —que venía en vuelo— escribe su versión y la pisa. La pausa del usuario se
    // pierde.
    const { contexto, mod, avanzar } = await appEstudiando(20);

    // El latido mide el minuto 11 y queda en vuelo.
    avanzar(MINUTO);
    const latido = contexto.CuadernoVirtual.latidoDeEstudio();

    // El usuario sigue estudiando y pausa en el minuto 31. La pausa **no espera** a que
    // termine el latido, que es lo que pasa de verdad.
    avanzar(20 * MINUTO);
    const pausa = contexto.CuadernoVirtual.cerrarSeccionEstudio();

    await Promise.all([latido, pausa]);

    const secciones = await guardadas(mod);

    assert.equal(secciones.length, 1,
        `quedaron ${secciones.length} secciones de una sola sección de estudio`);
    assert.equal(secciones[0].finMs, 31 * MINUTO,
        `la sección quedó sellada en el minuto ${secciones[0].finMs / MINUTO}, y el `
        + 'usuario pausó en el 31. Gana la última medición, no la del latido');
});

test('varias sesiones del mismo día siguen todas guardadas', async () => {
    // El latido no puede colapsar las sesiones: son `{inicioMs, finMs}` y cada una
    // tiene su propio inicio.
    const { contexto, mod, avanzar, esperarLatido } = await appEstudiando(20);

    // Primera sesión: tres latidos y pausa.
    avanzar(2 * MINUTO); await esperarLatido();
    avanzar(30 * SEGUNDO); await esperarLatido();
    avanzar(MINUTO);
    await contexto.CuadernoVirtual.cerrarSeccionEstudio();

    // Segunda sesión, una hora después.
    avanzar(60 * MINUTO);
    contexto.CuadernoVirtual.abrirSeccionEstudio();
    avanzar(MINUTO);
    await contexto.CuadernoVirtual.cerrarSeccionEstudio();

    const secciones = await guardadas(mod);

    assert.equal(secciones.length, 2,
        `quedaron ${secciones.length} secciones de dos sesiones`);
});
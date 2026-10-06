// ============================================
// LAS CINCO PROTECCIONES DE ESCRITURA, CONTRA EL ALMACÉN NUEVO
// ============================================
//
// Cubre: RF-1 y RNF-4 de specs/008-almacenamiento-real/spec.md
//
// ## Por qué este archivo existe entero
//
// Antes las cinco protecciones vivían en `test/navegador.test.js` y **rompían
// `localStorage.setItem`**. Con los datos en el almacén del navegador, esos tests
// apuntaban a un lugar donde ya no se escribe: pasaban en verde **sin probar nada**.
//
// Este archivo las vuelve a escribir contra `indexedDB`, y **cada una con su propia
// comprobación**. RNF-4 dice que reescribir, agrupar o renombrar comprobaciones puede
// cambiar la cuenta y no es un problema; lo que **no** puede pasar es que falte una.

const test = require('node:test');
const assert = require('node:assert');

const { cargarComoNavegador, crearIndexedDB } = require('./dom-falso.js');

const MATERIAS = [{ id: 'm1', nombre: 'Matemáticas', documentos: [] }];

function datosViejos() {
    return {
        cuadernoVirtual: JSON.stringify(MATERIAS),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    };
}

/**
 * Carga la app con el almacén **ya migrado**, y devuelve lo necesario para romper
 * **solo la escritura**.
 *
 * Se migra primero con un almacén sano y **después** se cambia el modo. Si el almacén
 * ya estuviera roto en la primera carga, la migración fallaría y estaríamos probando
 * el fallo de la migración, no el de la escritura.
 *
 * @param {string} [modo] cómo se rompe el almacén, o nada si está sano
 * @returns {Promise<object>} contexto, módulo, alertas, y el almacén para cambiarlo
 */
async function appMigrada(modo) {
    const almacen = crearIndexedDB('bien');
    const datos = datosViejos();

    const primera = cargarComoNavegador(datos, { indexedDB: almacen });
    await primera.inicio;

    assert.equal(
        await primera.contexto.AlmacenamientoDatos.estaMigrada(), true,
        'la migración tiene que haber terminado antes de probar las escrituras'
    );

    if (modo) almacen.modo = modo;

    const segunda = cargarComoNavegador(datos, { indexedDB: almacen });
    await segunda.inicio;

    const alertas = [];
    segunda.contexto.alert = (texto) => { alertas.push(texto); };

    return {
        contexto: segunda.contexto,
        mod: segunda.contexto.AlmacenamientoDatos,
        alertas,
        almacen
    };
}

/** Lo que hay guardado en el almacén nuevo, como el menú lo vería. */
async function guardados(mod) {
    return (await mod.leerGrupos()).materias.map(m => m.nombre);
}

// ---------- 1 · Espacio: sin espacio no se escribe ----------

test('protección 1 · sin espacio, no se escribe nada y se avisa', async () => {
    const { contexto, mod, alertas } = await appMigrada('sin-espacio');

    const antes = await guardados(mod);

    const ok = await contexto.CuadernoVirtual.guardarDatos();

    assert.equal(ok, false, 'tiene que decir que no pudo guardar');
    assert.deepEqual(await guardados(mod), antes,
        'lo que estaba guardado cambió. Una escritura que no entra tiene que no dejar '
        + 'nada escrito');
    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
    assert.match(alertas[0], /no pudo guardar|no dejó guardar|no se pudo guardar/i,
        'el aviso tiene que decir que no se pudo guardar:\n' + alertas[0]);
});

// La versión vieja de esta protección mostraba el porcentaje de ocupación. Ese muro ya
// no existe, y un aviso que lo anuncia es peor que no avisar.
test('protección 1 · el aviso de sin espacio NO habla de un muro que no existe', async () => {
    const { contexto, alertas } = await appMigrada('sin-espacio');

    await contexto.CuadernoVirtual.guardarDatos();

    const texto = alertas[0] || '';

    assert.doesNotMatch(texto, /5\s*MB|95\s*%|casi lleno/i,
        'el aviso nombra un muro que este almacén no tiene:\n' + texto);
});

// ---------- 2 · Transacción a medias: no rompe la pantalla ----------

test('protección 2 · una transacción que se corta no rompe la pantalla', async () => {
    const { contexto, mod, alertas } = await appMigrada('abortar');

    const antes = await guardados(mod);

    let resultado;
    // `doesNotReject` y **no** `doesNotThrow`: este último solo mira lo que el test
    // hace de forma **síncrona**, así que una excepción dentro de una promesa se le
    // escapa y el test falla por el motivo equivocado —o, peor, no falla.
    await assert.doesNotReject(async () => {
        resultado = await contexto.CuadernoVirtual.guardarDatos();
    }, 'una transacción a medias no puede rechazar: el error saldría de guardarDatos '
    + 'y cortaría a quien la llamó');

    assert.equal(resultado, false, 'y tiene que avisar que no pudo guardar');
    assert.deepEqual(await guardados(mod), antes,
        'quedó parte de la escritura. Una transacción cortada no deja datos a medias');
    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
});

// ---------- 3 · Deshacer: lo que no se guardó no queda en memoria ----------

test('protección 3 · si el guardado falla, el cambio NO queda en memoria', async () => {
    const { contexto, mod, almacen, alertas } = await appMigrada('sin-espacio');

    const ok = await contexto.CuadernoVirtual.guardarRevirtiendoSiFalla([
        { id: 'nueva', nombre: 'No deberia existir', documentos: [] }
    ]);

    assert.equal(ok, false, 'tiene que decir que no pudo guardar');
    assert.equal(alertas.length, 1, 'tiene que avisar una vez');

    // Lo que el usuario ve tiene que volver a ser lo que está guardado. Se comprueba
    // con un guardado que sí funciona.
    almacen.modo = 'bien';
    await contexto.CuadernoVirtual.guardarDatos();

    assert.deepEqual(await guardados(mod), ['Matemáticas'],
        'el cambio que no se pudo guardar quedó en memoria. Es lo que RF-1 prohíbe: que '
        + 'el usuario vea algo que no está guardado');
});

// ---------- 4 · Acumulación: dos fallos seguidos no acumulan ----------

test('protección 4 · si falla dos veces, tampoco acumula cambios', async () => {
    const { contexto, mod, almacen } = await appMigrada('sin-espacio');

    await contexto.CuadernoVirtual.guardarRevirtiendoSiFalla([
        { id: 'a', nombre: 'Primera', documentos: [] }
    ]);
    await contexto.CuadernoVirtual.guardarRevirtiendoSiFalla([
        { id: 'b', nombre: 'Segunda', documentos: [] }
    ]);

    almacen.modo = 'bien';
    await contexto.CuadernoVirtual.guardarDatos();

    assert.deepEqual(await guardados(mod), ['Matemáticas'],
        'quedó alguno de los dos cambios que no se pudieron guardar');
});

// ---------- 5 · Lectura que falla: no se escribe encima ----------

test('protección 5 · si no se puede leer el cuaderno, la app NO pasa al almacén nuevo', async () => {
    // Esta protección **cambió de forma**, y hay que decirlo en voz alta: antes era
    // "si falla la lectura, no se escribe nada", porque `guardarDatos()` leía lo
    // anterior para poder revertir. Con el almacén nuevo **`guardarDatos()` no lee**:
    // escribe el índice entero.
    //
    // El riesgo sigue existiendo, pero en otro lado: si el cuaderno no se puede leer,
    // la app tiene que **quedarse en el almacén viejo**, no pasar al nuevo y escribir
    // encima de un índice que no llegó a leer.
    const almacen = crearIndexedDB('bien');
    const datos = datosViejos();

    const primera = cargarComoNavegador(datos, { indexedDB: almacen });
    await primera.inicio;
    assert.equal(await primera.contexto.AlmacenamientoDatos.estaMigrada(), true);

    // Ahora se rompe la lectura. La segunda carga ya está migrada, así que leer los
    // grupos **es** leer del almacén nuevo.
    almacen.modo = 'lectura-falla';

    const segunda = cargarComoNavegador(datos, { indexedDB: almacen });
    await segunda.inicio;

    const aviso = segunda.contexto.document.getElementById('avisoDatos');

    assert.ok(aviso && aviso.hidden === false,
        'la app no avisó que no pudo leer el cuaderno del almacenamiento nuevo');

    // Y lo que importa: **sigue viendo el cuaderno del viejo**, que está entero.
    // Si hubiera pasado al nuevo con el índice sin leer, el cuaderno aparecería vacío
    // y no habría forma de saber por qué.
    const arbol = segunda.contexto.document.getElementById('arbolNavegacion');
    const texto = JSON.stringify(arbol.hijos);

    assert.ok(texto.includes('Matem'),
        'el cuaderno desapareció. No se pudo leer del almacén nuevo y la app no se '
        + 'quedó con el anterior: el usuario se encuentra con un cuaderno vacío');
});

// ---------- La red que vigila que estas cinco sigan existiendo ----------

test('las cinco protecciones tienen su comprobación, y hay cinco', () => {
    // La cuenta no es el requisito —RNF-4 lo dice— pero **que falte una** sí lo es. Y
    // un número escrito a mano se desincroniza solo, así que se cuenta.
    //
    // Se cuentan los **números distintos**, no los tests: la protección 1 tiene dos
    // comprobaciones —una del comportamiento y otra del texto—, y contar los tests
    // daría "6" y una alarma falsa. Esa alarma falsa es justo lo que vuelve ignorante
    // a un control: un rojo que aparece cuando no hay nada que arreglar.
    const fs = require('node:fs');
    const path = require('node:path');

    const codigo = fs.readFileSync(
        path.join(__dirname, 'red-protecciones.test.js'), 'utf8'
    );

    const numeros = [...codigo.matchAll(/^test\('protección (\d)/gm)].map(m => m[1]);
    const distintas = [...new Set(numeros)].sort();

    assert.deepEqual(distintas, ['1', '2', '3', '4', '5'],
        'faltan protecciones, o hay una repetida. Las cinco tienen que seguir '
        + 'existiendo, cada una con su comprobación');
});

// ============================================
// MIGRACIÓN — los cuatro grupos, y la marca al final
// ============================================
//
// Cubre: RF-2 de specs/008-almacenamiento-real/spec.md
// Ver: specs/008-almacenamiento-real/plan.md, DD-6
// ============================================

const test = require('node:test');
const assert = require('node:assert');

const { cargarComoNavegador, crearIndexedDB } = require('./dom-falso.js');

// Los cuatro grupos, con la forma que tienen hoy en el almacén viejo.
const MATERIAS = [{ id: 'm1', nombre: 'Matemáticas', documentos: [] }];
const HEREDADOS = [
    { fecha: '2026-09-01', minutos: 25, materia: 'Matemáticas' }
];
const ESTUDIO = [
    { fecha: '2026-10-01', minutos: 47, seccion: 'm1' }
];
const ANOTACIONES = {
    '01/10/2026': [{ tipo: 'parcial', descripcion: 'Primera' }]
};

/** El almacén viejo completo, como lo dejaría la app después de un año de uso. */
function datosViejos() {
    return {
        cuadernoVirtual: JSON.stringify(MATERIAS),
        pomodoroSesiones: JSON.stringify(HEREDADOS),
        mapaCalorSecciones: JSON.stringify(ESTUDIO),
        calendarioAnotaciones: JSON.stringify(ANOTACIONES)
    };
}

/** Carga la app, espera el arranque, y devuelve el módulo del almacén. */
async function app(datos = datosViejos(), opciones = {}) {
    const carga = cargarComoNavegador(datos, opciones);
    await carga.inicio;
    return { contexto: carga.contexto, mod: carga.contexto.AlmacenamientoDatos, carga };
}

// ---------- La copia ----------

test('la migración copia los cuatro grupos al almacén nuevo', async () => {
    const { mod } = await app();

    const grupos = await mod.leerGrupos();

    assert.deepEqual(grupos.materias, MATERIAS, 'faltan las materias');
    assert.deepEqual(grupos.heredados, HEREDADOS, 'faltan los minutos heredados');
    assert.deepEqual(grupos.estudio, ESTUDIO, 'faltan los minutos de estudio');
    assert.deepEqual(grupos.anotaciones, ANOTACIONES, 'faltan las anotaciones');
});

// La migración **copia, no transforma**. Los minutos heredados son del formato viejo y
// esta especificación no empieza a escribir de nuevo el registro heredado, así que
// convertirlos sería inventar un requisito que nadie pidió.
test('los minutos heredados van tal cual, sin transformar', async () => {
    const { mod } = await app();

    const grupos = await mod.leerGrupos();

    assert.deepEqual(
        grupos.heredados, HEREDADOS,
        'los minutos heredados llegaron cambiados. La migración copia, no transforma'
    );
});

// ---------- Lo que NO tiene que pasar ----------

test('el almacén viejo queda entero: la migración no borra nada', async () => {
    const { contexto } = await app();

    assert.equal(contexto.localStorage.getItem('cuadernoVirtual'), JSON.stringify(MATERIAS));
    assert.equal(contexto.localStorage.getItem('pomodoroSesiones'), JSON.stringify(HEREDADOS));
    assert.equal(contexto.localStorage.getItem('mapaCalorSecciones'), JSON.stringify(ESTUDIO));
    assert.equal(
        contexto.localStorage.getItem('calendarioAnotaciones'), JSON.stringify(ANOTACIONES),
        'el almacén viejo es la red. Si la migración lo borra, no hay red'
    );
});

// ---------- La marca, que es lo que decide si se vuelve a migrar ----------

test('después de migrar, la marca queda escrita', async () => {
    const { mod } = await app();

    assert.equal(await mod.estaMigrada(), true,
        'la copia terminó pero no quedó marcada: en el próximo arranque se '
        + 'volvería a migrar para siempre');
});

test('si la escritura de la marca falla, la migración NO se dio por terminada', async () => {
    // El caso límite de RF-2. La copia de los datos entra bien, y lo que falla es
    // **la marca**. Si la app lo tomara por bueno, la siguiente apertura diría
    // "ya está migrado" sobre un cuaderno a medias, y el reintento no ocurriría
    // nunca.
    const { mod } = await app(datosViejos(), { almacen: 'sin-marca' });

    assert.equal(await mod.estaMigrada(), false,
        'la marca se escribió aunque su escritura falló. Con la marca puesta, '
        + 'una copia a medias quedaría declarada completa y nadie la repararía');
});

test('si la copia se corta, en la siguiente apertura se reintenta entera', async () => {
    // El almacén se comparte entre las dos cargas: es lo único que hace falta para
    // que "la siguiente apertura" sea de verdad la siguiente y no una base nueva.
    // Y el modo **se cambia en el medio**: la primera carga no puede dejar la marca y
    // la segunda sí. Con un modo fijo por instancia, esto no se puede representar.
    const compartido = crearIndexedDB('sin-marca');

    // Primera apertura: la copia entra, la marca no.
    const primera = await app(datosViejos(), { indexedDB: compartido });
    assert.equal(await primera.mod.estaMigrada(), false,
        'la primera apertura no debería haber dejado la marca');

    // Los datos **sí** entraron. Si no hubieran entrado, este test probaría que no se
    // copia nada, y no que lo único que faltaba era la marca.
    assert.deepEqual((await primera.mod.leerGrupos()).materias, MATERIAS,
        'la copia de los datos no entró: entonces el test no está probando lo que dice');

    // Ahora la escritura de la marca funciona.
    compartido.modo = 'bien';

    // Segunda apertura, mismo almacén.
    const segunda = cargarComoNavegador(datosViejos(), { indexedDB: compartido });
    await segunda.inicio;

    assert.equal(await segunda.contexto.AlmacenamientoDatos.estaMigrada(), true,
        'la segunda apertura no terminó la migración. Sin la marca, el reintento '
        + 'no existe');
});

test('si no hay datos en el almacén viejo, no dice que migró nada', async () => {
    const { mod, contexto } = await app({});

    assert.equal(await mod.estaMigrada(), false,
        'sin datos no hay nada que migrar: no se puede marcar como migrado');

    // Y lo más importante para el usuario: no se le dice que migró nada.
    const migro = contexto.CuadernoVirtual.ultimaMigracion;
    assert.ok(!migro.copiado,
        'sin datos, la app no puede decir que copió algo');
});

// ---------- Después de migrar ----------

test('los grupos se leen del almacén nuevo, no del viejo', async () => {
    // Lo que este test comprueba, y lo que **no** comprueba.
    //
    // Comprueba que `leerGrupos()` sale del almacén nuevo: se carga dos veces sobre el
    // mismo almacén, y en la segunda el almacén viejo tiene **otra materia**. Si los
    // grupos vinieran del viejo, saldrían los de la segunda carga.
    //
    // **No** comprueba que la aplicación deje de leer el almacén viejo: hasta que las
    // lecturas cambien, el cuaderno que se ve sigue armándose con lo que hay en el
    // viejo, que está entero. Ese es el otro criterio de RF-2, y es **de T5**.
    //
    // Hace falta decirlo porque un test que pasa tiene que estar probando lo que su
    // nombre dice: si este se llamara "no se lee del almacén viejo" sin aclaración,
    // estaría afirmando más de lo que mide.
    const compartido = crearIndexedDB('bien');

    const primera = await app(datosViejos(), { indexedDB: compartido });
    assert.equal(await primera.mod.estaMigrada(), true, 'la migración tiene que estar');

    const segunda = cargarComoNavegador({
        cuadernoVirtual: JSON.stringify([{ id: 'otra', nombre: 'Fisica', documentos: [] }]),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    }, { indexedDB: compartido });

    await segunda.inicio;

    const grupos = await segunda.contexto.AlmacenamientoDatos.leerGrupos();

    assert.deepEqual(grupos.materias, MATERIAS,
        'los grupos salieron del almacén viejo, no del nuevo');
});

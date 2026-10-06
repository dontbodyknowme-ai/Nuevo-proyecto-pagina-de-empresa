// ============================================
// EL LATIDO: QUE LOS MINUTOS NO SE PIERDAN AL CERRAR LA PESTAÑA
// ============================================
//
// Cubre: RF-13 y la regresión de specs/008-almacenamiento-real, T6.
//
// ## El problema
//
// `guardarSeccionEstudio()` cerraba la sección y la guardaba con un `setItem`, que era
// **sin cronía**: cuando la función terminaba, los minutos ya estaban en el disco.
// Cerrar la pestaña no podía perder nada.
//
// Al pasar el almacén a IndexedDB, la escritura pasó a ser una **promesa**. Y en
// `beforeunload` **no hay a quién esperarle**: la pestaña se está yendo. Así que esos
// minutos **se pueden perder al cerrar**, y antes no. Es una regresión real, causada
// por hacer el almacén asíncrono.
//
// ## La solución que se eligió: el latido
//
// Mientras una sección está abierta, cada **30 segundos** se escribe al almacén la sección
// en curso, sellada al momento. Cerrar la pestaña pierde, como máximo, medio minuto.
//
// No pide confirmación al usuario y no agrega un store: usa el `setInterval` de un
// segundo que el Pomodoro ya tiene corriendo.
//
// ## La regla que hace que esto no cueste datos
//
// El latido escribe la misma sección muchas veces, y cada escritura tiene un `finMs`
// distinto. Si la lista final se armara **agregando**, una sesión de 25 minutos
// contaría 50 veces: **los minutos se multiplican**.
//
// Por eso una sección se identifica por su **`inicioMs`**, y guardar la misma sección
// dos veces **la reemplaza, no la suma**. Esa regla vive en `seccionesParaGuardar()` y
// está probada acá abajo con los números del dominio, no inventados.

const test = require('node:test');
const assert = require('node:assert/strict');

const Secciones = require('../js/datos/secciones.js');

// Un minuto, en milisegundos. Los números del dominio: un Pomodoro son 25 de estos.
const MINUTO = 60 * 1000;

/** Una sección de `desdeMin` a `hastaMin`, con el cero de referencia en el minuto 0. */
function seccion(desdeMin, hastaMin) {
    return { inicioMs: desdeMin * MINUTO, finMs: hastaMin * MINUTO };
}

/**
 * Un estado con una sección abierta desde hace `desdeMin` minutos.
 */
function conSeccionAbierta(desdeMin) {
    const estado = Secciones.crearSecciones();
    estado.seccionAbierta = { inicioMs: desdeMin * MINUTO };
    return estado;
}

// ---------- La regla de reemplazo: lo que impide que los minutos se multipliquen ----------

test('guardar la misma sección dos veces no la cuenta dos veces', () => {
    // Este es EL test de la tarea. El latido escribe la sección en curso cada 30
    // segundos; si la lista se armara agregando, una sesión de 25 minutos valdría 50.
    const guardado = [seccion(0, 10)];
    const estado = Secciones.crearSecciones();
    estado.secciones = [seccion(0, 25)];

    const lista = Secciones.seccionesParaGuardar(estado, guardado, 25 * MINUTO);

    const deEsaSesion = lista.filter(s => s.inicioMs === 0);

    assert.equal(deEsaSesion.length, 1,
        `la sección se contó ${deEsaSesion.length} veces. El latido escribe la misma `
        + 'sección cada 30 segundos: si eso suma, los minutos se multiplican');
});

test('la versión que gana es la más nueva, no la primera', () => {
    // El latido escribe la sección en curso a los 10 minutos; después el usuario pausa
    // a los 25. Lo que tiene que quedar es **la de 25**, que es la real.
    // Si quedara la primera, el mapa de calor mostraría 10 minutos de 25.
    const guardado = [seccion(0, 10)];
    const estado = Secciones.crearSecciones();
    estado.secciones = [seccion(0, 25)];

    const lista = Secciones.seccionesParaGuardar(estado, guardado, 25 * MINUTO);

    assert.equal(lista.length, 1);
    assert.equal(lista[0].finMs, 25 * MINUTO,
        'quedó la versión vieja del latido, no la del cierre real');
});

test('las secciones distintas no se pisan entre sí', () => {
    // El reemplazo es **por `inicioMs`**, no "la última de todas". Dos sesiones
    // distintas del mismo día tienen que quedar las dos.
    const guardado = [seccion(0, 25), seccion(60, 75)];
    const estado = Secciones.crearSecciones();
    estado.secciones = [seccion(60, 80)];

    const lista = Secciones.seccionesParaGuardar(estado, guardado, 80 * MINUTO);

    assert.equal(lista.length, 2, 'se perdió una sesión del mismo día');
    assert.deepEqual(lista.map(s => s.inicioMs).sort((a, b) => a - b),
        [0, 60 * MINUTO]);
});

test('la sección abierta se guarda sellada al momento, no sin final', () => {
    // El latido escribe **mientras** la sección sigue abierta. Si se guardara sin
    // `finMs`, `minutosTotales()` no leería un número y los minutos no contarían: la
    // escritura serviría de nada.
    const estado = conSeccionAbierta(10);

    const lista = Secciones.seccionesParaGuardar(estado, [], 10 * MINUTO + 30 * 1000);

    assert.equal(lista.length, 1);
    assert.equal(lista[0].inicioMs, 10 * MINUTO);
    assert.equal(lista[0].finMs, 10 * MINUTO + 30 * 1000,
        'la sección en curso se guardó sin el momento en que se midió');
});

test('sin sección abierta, la lista es la que estaba guardada', () => {
    // El latido no puede **inventar** secciones: si no hay ninguna abierta, no escribe
    // nada nuevo. Si lo hiciera, cualquier arranque inventaría un rato de estudio.
    const estado = Secciones.crearSecciones();
    const guardado = [seccion(0, 25)];

    const lista = Secciones.seccionesParaGuardar(estado, guardado, 999 * MINUTO);

    assert.deepEqual(lista, guardado);
});

// ---------- Que no rompa lo que ya funciona ----------

test('los minutos totales no cambian por usar el latido', () => {
    // La regla más importante de todas: **el total tiene que ser el mismo** con y sin
    // latido. Si el latido cambia lo que el mapa de calor muestra, no es una mejora del
    // guardado: es un defecto nuevo.
    const aFechaClave = () => '01/10/2026';

    // Sin latido: la sección se selló una vez, a los 25 minutos.
    const sinLatido = {
        seccionAbierta: null,
        secciones: [seccion(0, 25)],
        seccionesAntiguas: []
    };

    // Con latido: hubo cuatro latidos (10, 20, 25, 25) y después el sello.
    const guardado = [
        seccion(0, 10),
        seccion(0, 20),
        seccion(0, 25)
    ];
    const conLatido = Secciones.crearSecciones();
    conLatido.secciones = [seccion(0, 25)];

    const lista = Secciones.seccionesParaGuardar(conLatido, guardado, 25 * MINUTO);

    assert.deepEqual(
        Secciones.minutosTotales({ ...sinLatido, secciones: lista }, aFechaClave),
        Secciones.minutosTotales(sinLatido, aFechaClave),
        'el latido cambió los minutos que ve el usuario'
    );
    assert.equal(
        Secciones.minutosTotales({ ...sinLatido, secciones: lista }, aFechaClave)['01/10/2026'],
        25,
        'una sesión de 25 minutos tiene que contar 25, ni 25 ni 100'
    );
});

test('una sesión corta no cuenta minutos de más por el latido', () => {
    // Un segundo de estudio no cuenta ni un minuto. Con el latido, una sección que se
    // midió cuatro veces en un minuto sigue siendo menos de un minuto.
    const estado = conSeccionAbierta(0);
    const lista = Secciones.seccionesParaGuardar(estado, [], 45 * 1000);

    const totales = Secciones.minutosTotales(
        { seccionAbierta: null, secciones: lista, seccionesAntiguas: [] },
        () => '01/10/2026'
    );

    assert.equal(totales['01/10/2026'], undefined,
        `contó ${totales['01/10/2026']} minutos de una sección de 45 segundos`);
});

test('la lista sale en orden cronológico', () => {
    // El archivo exportado muestra estas secciones. Si el orden dependiera de cómo se
    // mezclaron las dos fuentes, dos exportaciones del mismo dato darían archivos
    // distintos y no se podrían comparar.
    const guardado = [seccion(120, 130), seccion(0, 25)];
    const estado = Secciones.crearSecciones();
    estado.secciones = [seccion(60, 70)];

    const lista = Secciones.seccionesParaGuardar(estado, guardado, 130 * MINUTO);

    assert.deepEqual(lista.map(s => s.inicioMs), [0, 60 * MINUTO, 120 * MINUTO]);
});

test('una sección sin números se ignora en vez de romper', () => {
    // Un respaldo importado puede traer basura. Tirar acá sería romper el guardado de
    // minutos, que es lo último que debería caer por un dato raro.
    const guardado = [null, { inicioMs: 'no soy un número' }, seccion(0, 25)];

    const lista = Secciones.seccionesParaGuardar(
        Secciones.crearSecciones(), guardado, 25 * MINUTO
    );

    assert.deepEqual(lista, [seccion(0, 25)],
        'un registro raro no puede tirar, y tampoco puede quedar guardado');
});
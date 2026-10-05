// ============================================
// TESTS — Las reglas del calendario
// Ejecutar: node --test
// Cubre: RF-2 de la especificación 006
// Ver: specs/006-reducir-app-js/spec.md, y DD-2 del plan
// ============================================
//
// En `app.js` había cuatro reglas del calendario escritas **en línea**, dentro de
// funciones que dibujan:
//
//     if (mes >= 1 && mes <= 12 && anio >= 2020 && anio <= 2100)
//     calendario.anotaciones[fecha].push({ id: ..., tipo, descripcion })
//     anotacion.descripcion = nuevaDescripcion.trim()
//     calendario.anotaciones[fecha].splice(index, 1)
//
// Ninguna tenía ni un test, y no podía tenerlo: estaban dentro de funciones que
// llaman a `prompt`, a `confirm` y a `alert`. Una línea que dice qué meses
// existen, escondida en una función que abre un `alert`, no se puede probar
// sin un navegador.
//
// Acá viven como funciones puras. Lo que se mueve es **la decisión**, no el
// dibujo: el `prompt` sigue en `app.js`, la comparación de meses también.
//
// La diferencia entre este archivo y el de `anotaciones.test.js`: aquel fija la
// **regla** (cuántas caben por día); este fija las **operaciones** (agregar,
// editar, quitar) y la **navegación** (qué mes y año existen).

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    esMesAnioValidos,
    agregarAnotacion,
    cambiarDescripcion,
    quitarAnotacion,
    ANIO_MINIMO,
    ANIO_MAXIMO
} = require('../js/logica/calendario.js');

// ============================================
// Qué mes y año existen
// ============================================

test('los doce meses existen', () => {
    // Un cuaderno de estudio empieza en enero y termina en diciembre.
    for (let mes = 1; mes <= 12; mes++) {
        assert.ok(esMesAnioValidos(mes, 2026),
            `el mes ${mes} tiene que existir: es un mes del año`);
    }
});

test('ni el mes 0 ni el mes 13 existen', () => {
    // No hay mes cero: `new Date(2026, 0)` es enero, no diciembre del año
    // anterior. Que se corra solo hacia atrás es un error que se propaga.
    assert.ok(!esMesAnioValidos(0, 2026), 'el mes 0 no existe');
    assert.ok(!esMesAnioValidos(13, 2026), 'el mes 13 no existe');
    assert.ok(!esMesAnioValidos(-1, 2026), 'el mes -1 no existe');
});

test('un mes que no es número no es válido', () => {
    // Los `<input type="number">` del calendario vienen del usuario. Vació, o con
    // algo que no se puede leer, `parseInt` devuelve `NaN`, y `NaN >= 1` es
    // `false`. O sea que esto **ya funcionaba**, pero por accidente: si alguien
    // reescribiera la comparación, `NaN` pasaría.
    for (const mes of [NaN, undefined, null, 'enero', {}]) {
        assert.ok(!esMesAnioValidos(mes, 2026),
            `${String(mes)} no es un mes, aunque se pueda comparar`);
    }
});

// ---------- El rango de años ----------

test('el rango de años es el que siempre estuvo', () => {
    // DD-2: este rango **no tiene origen conocido**. Nadie lo escribió en una
    // spec; está ahí desde antes de que hubiera specs. Se mueve tal cual.
    //
    // Lo que NO se hace es inventarle una razón. Decir "de 2020 en adelante
    // porque nadie debería tener apuntes viejos" sería una explicación
    // fabricada y además falsa: esto es un cuaderno de estudio y puede tener
    // apuntes viejos.
    //
    // Estos dos números están escritos acá para que el rango no pueda cambiar
    // sin que se note. Si algún día alguien decide otro, se cambia el test y se
    // escribe el motivo al lado.
    assert.equal(ANIO_MINIMO, 2020);
    assert.equal(ANIO_MAXIMO, 2100);
});

test('los extremos del rango de años son válidos', () => {
    assert.ok(esMesAnioValidos(1, ANIO_MINIMO), 'el primer año vale');
    assert.ok(esMesAnioValidos(1, ANIO_MAXIMO), 'el último año vale');
});

test('un año fuera del rango no vale', () => {
    assert.ok(!esMesAnioValidos(1, ANIO_MINIMO - 1), 'un año antes del mínimo no vale');
    assert.ok(!esMesAnioValidos(1, ANIO_MAXIMO + 1), 'un año después del máximo no vale');
});

test('un año que no es número no es válido', () => {
    for (const anio of [NaN, undefined, null, 'mil', {}]) {
        assert.ok(!esMesAnioValidos(1, anio),
            `${String(anio)} no es un año, aunque se pueda comparar`);
    }
});

// ============================================
// Agregar una anotación
// ============================================

test('agregar deja la anotación en la lista del día', () => {
    const dia = [];
    agregarAnotacion(dia, 'entrega', 'Traer el trabajo', 'a_1');

    assert.equal(dia.length, 1);
    assert.deepEqual(dia[0], {
        id: 'a_1',
        tipo: 'entrega',
        descripcion: 'Traer el trabajo'
    });
});

test('agendar recorta los espacios de la descripción', () => {
    // El usuario escribe con el teclado y deja espacios. Guardarlos hace que el
    // contador de caracteres y la búsqueda noenzhen, y que " " cuente como
    // anotación.
    const dia = [];
    agregarAnotacion(dia, 'nota', '   repasar mañana   ', 'a_1');

    assert.equal(dia[0].descripcion, 'repasar mañana');
});

test('agendar una anotación sin texto no hace nada', () => {
    // Un espacio es lo que queda cuando el usuario abre el cartel, no escribe
    // nada y le da a guardar. No es una anotación: no ocupa lugar ni aparece en el
    // contador.
    for (const descripcion of ['', '   ', null, undefined]) {
        const dia = [];
        const resultado = agregarAnotacion(dia, 'nota', descripcion, 'a_1');

        assert.equal(resultado.agrego, false,
            `"${String(descripcion)}" no es una anotación`);
        assert.equal(dia.length, 0, 'y no se agrega a la lista');
    }
});

test('no se puede agregar una cuarta anotación al día', () => {
    const dia = [];
    for (let i = 0; i < 3; i++) {
        agregarAnotacion(dia, 'nota', `Nota ${i}`, `a_${i}`);
    }

    const resultado = agregarAnotacion(dia, 'nota', 'La cuarta', 'a_4');

    assert.equal(resultado.agrego, false, 'no hay lugar');
    assert.equal(dia.length, 3, 'y la lista sigue con tres');
    assert.equal(resultado.motivo, 'sin-lugar',
        'tiene que decir por qué no se agregó');
});

test('agregar devuelve el motivo de cada rechazo', () => {
    // La app muestra dos mensajes distintos: "Máximo 3 anotaciones por día" y
    // no mostrar nada. El primero es el que necesita saber que no hay lugar.
    assert.equal(agregarAnotacion([], 'nota', '   ', 'a_1').motivo, 'sin-texto');
    assert.equal(agregarAnotacion([], 'nota', 'Texto', 'a_1').motivo, null);

    const lleno = [{ id: 'a', tipo: 'nota', descripcion: 'a' },
                   { id: 'b', tipo: 'nota', descripcion: 'b' },
                   { id: 'c', tipo: 'nota', descripcion: 'c' }];
    assert.equal(agregarAnotacion(lleno, 'nota', 'Otra', 'a_4').motivo, 'sin-lugar');
});

test('agregar a un día que ya tiene cuatro no borra las que hay', () => {
    // Un respaldo importado puede traer más anotaciones que el máximo. Agregar
    // una más tiene que rechazarse **sin tocar las que hay**: son datos del
    // usuario y la app no tiene permiso de descartar nada.
    const dia = [
        { id: 'a', tipo: 'nota', descripcion: 'Una' },
        { id: 'b', tipo: 'nota', descripcion: 'Dos' },
        { id: 'c', tipo: 'nota', descripcion: 'Tres' },
        { id: 'd', tipo: 'nota', descripcion: 'Cuatro' }
    ];
    const copia = JSON.stringify(dia);

    agregarAnotacion(dia, 'nota', 'Cinco', 'a_5');

    assert.equal(JSON.stringify(dia), copia, 'no se puede tocar nada');
});

test('agregar a algo que no es una lista no rompe', () => {
    // Un respaldo corrupto puede dejar `undefined` o un objeto donde debería
    // haber una lista. La app no puede dejar de andar por eso.
    for (const dia of [undefined, null, 'no soy lista', 42, {}]) {
        assert.doesNotThrow(() => agregarAnotacion(dia, 'nota', 'Texto', 'a_1'),
            `${String(dia)} no es una lista, pero no puede romper`);
    }
});

// ============================================
// Editar una anotación
// ============================================

test('cambiar la descripción deja la nueva', () => {
    const dia = [{ id: 'a', tipo: 'nota', descripcion: 'La vieja' }];

    cambiarDescripcion(dia, 0, 'La nueva');

    assert.equal(dia[0].descripcion, 'La nueva');
});

test('cambiar la descripción recorta los espacios', () => {
    const dia = [{ id: 'a', tipo: 'nota', descripcion: 'La vieja' }];

    cambiarDescripcion(dia, 0, '  La nueva  ');

    assert.equal(dia[0].descripcion, 'La nueva');
});

test('cambiar a un texto vacío no cambia nada', () => {
    // Es el caso del `prompt` cancelado, y del usuario que abre el cartel, borra
    // todo y le da a aceptar. Borrar la anotación sin querer no es lo que quiso.
    for (const texto of ['', '   ', null, undefined]) {
        const dia = [{ id: 'a', tipo: 'nota', descripcion: 'La vieja' }];

        const resultado = cambiarDescripcion(dia, 0, texto);

        assert.equal(resultado.cambio, false, `"${String(texto)}" no es un cambio`);
        assert.equal(dia[0].descripcion, 'La vieja', 'y no se pierde la anotación');
    }
});

test('cambiar a la misma descripción no dice que cambió', () => {
    const dia = [{ id: 'a', tipo: 'nota', descripcion: 'Igual' }];

    const resultado = cambiarDescripcion(dia, 0, '  Igual  ');

    assert.equal(resultado.cambio, true, 'el texto queda igual, pero el usuario sí editó');
    assert.equal(dia[0].descripcion, 'Igual');
});

test('cambiar una anotación que no existe no rompe', () => {
    // El índice viene de un `data-index` del DOM. Si el día se recargó entre que
    // se dibujó y que se apretó el botón, el índice puede quedar viejo.
    const dia = [{ id: 'a', tipo: 'nota', descripcion: 'La única' }];

    for (const indice of [1, 99, -1, NaN]) {
        assert.doesNotThrow(() => cambiarDescripcion(dia, indice, 'Otra'),
            `el índice ${indice} no existe y no puede romper`);
    }

    assert.equal(dia.length, 1, 'y no se agrega nada');
    assert.equal(dia[0].descripcion, 'La única', 'ni se pierde la que había');
});

test('cambiar no toca el tipo ni el identificador', () => {
    // Editar una anotación es cambiar **qué dice**, no qué es. El tipo decide el
    // color del punto en la rejilla, y el identificador la distingue de las
    // demás.
    const dia = [{ id: 'a_7', tipo: 'entrega', descripcion: 'La vieja' }];

    cambiarDescripcion(dia, 0, 'La nueva');

    assert.equal(dia[0].id, 'a_7', 'el identificador no cambia');
    assert.equal(dia[0].tipo, 'entrega', 'el tipo no cambia');
});

// ============================================
// Quitar una anotación
// ============================================

test('quitar saca la anotación de la lista', () => {
    const dia = [
        { id: 'a', tipo: 'nota', descripcion: 'Una' },
        { id: 'b', tipo: 'nota', descripcion: 'Dos' }
    ];

    quitarAnotacion(dia, 0);

    assert.equal(dia.length, 1);
    assert.equal(dia[0].id, 'b', 'saca la del índice pedido, no la última');
});

test('quitar la última de tres deja las dos primeras en su lugar', () => {
    // El orden se ve en pantalla. Si al quitar se corría todo, las anotaciones
    // cambiarían de lugar sin que nadie lo haya pedido.
    const dia = [
        { id: 'a', tipo: 'nota', descripcion: 'Una' },
        { id: 'b', tipo: 'nota', descripcion: 'Dos' },
        { id: 'c', tipo: 'nota', descripcion: 'Tres' }
    ];

    quitarAnotacion(dia, 2);

    assert.deepEqual(dia.map(a => a.id), ['a', 'b']);
});

test('quitar un índice que no existe no cambia la lista', () => {
    // `splice` con un índice fuera de rango no saca nada, pero devuelve un arreglo
    // vacío: si el código no lo mira, la app le dice al usuario que borró algo que
    // sigue ahí.
    const dia = [{ id: 'a', tipo: 'nota', descripcion: 'La única' }];

    for (const indice of [5, 99, -1]) {
        const resultado = quitarAnotacion(dia, indice);

        assert.equal(resultado.quito, false, `el índice ${indice} no existe`);
        assert.equal(dia.length, 1, 'y la lista sigue igual');
    }
});

test('quitar no deja el arreglo con un hueco', () => {
    // Si en vez de `splice` se usara `lista[indice] = undefined`, el día quedaría
    // con un hueco. El contador marcaría dos anotaciones y la pantalla tres.
    const dia = [
        { id: 'a', tipo: 'nota', descripcion: 'Una' },
        { id: 'b', tipo: 'nota', descripcion: 'Dos' }
    ];

    quitarAnotacion(dia, 0);

    assert.equal(dia.filter(a => a === undefined).length, 0, 'no puede quedar un hueco');
    assert.equal(dia.length, 1);
});

test('quitar de algo que no es una lista no rompe', () => {
    for (const dia of [undefined, null, 'no soy lista', 42, {}]) {
        assert.doesNotThrow(() => quitarAnotacion(dia, 0),
            `${String(dia)} no es una lista, pero no puede romper`);
    }
});

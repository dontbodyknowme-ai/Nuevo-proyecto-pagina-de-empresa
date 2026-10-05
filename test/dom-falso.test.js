// ============================================
// TESTS — El navegador falso
// Ejecutar: node --test
// Ver: specs/006-reducir-app-js/task.md, T3
// ============================================
//
// `test/dom-falso.js` es el DOM mínimo que permite cargar `js/app.js` en Node.
// Estos tests le preguntan si todavía sirve.
//
// No son "!". Si el arnés dejara de cargar la app —porque `app.js` empiece a
// usar un método del DOM que el mock no tiene— los tests que lo usan **no
// fallarían: no correrían nada**. El error aparecería como un test que pasa sin
// comprobar nada, que es la peor forma de pasar: no dice que falta el método,
// dice que todo está bien.
//
// Estos tests están en un archivo aparte, y no al final de `dom-falso.js`, por
// una razón concreta: `test()` se registra en el `require`. Si estuvieran en el
// módulo, correrían **una vez por cada archivo que lo pida** —tres veces— y el
// total de la suite subiría con copias del mismo test.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    cargarComoNavegador,
    crearAlmacenamiento,
    romper,
    crearElemento
} = require('./dom-falso.js');

test('el arnés carga la app entera sin errores', () => {
    const { errores } = cargarComoNavegador({ cuadernoVirtual: '[]' });

    assert.deepEqual(errores, [],
        'el arnés tiene que cargar los scripts como el navegador. Si falla, los '
        + 'tests que lo usan están comprobando nada.');
});

test('`classList.add` suma, no reemplaza', () => {
    // Este bug **existió** y nadie lo notó. `classList` llevaba un `Set` propio
    // que empezaba vacío, así que:
    //
    //     celda.className = 'celda-dia';
    //     celda.classList.add('hoy');
    //
    // dejaba `className === 'hoy'`. En el navegador queda `'celda-dia hoy'`.
    //
    // Apareció al probar el calendario con este arnés: la rejilla tenía 32 celdas
    // en vez de 34, y las dos que faltaban eran justo las que tenían clases
    // agregadas —el día de hoy y el día con anotaciones. Los días que nadie
    // marcaba aparecían; los marcados, no.
    //
    // Un arnés que miente hace que los tests midan otra cosa. Y como acá se
    // perdían elementos, no daba error: daba **menos** de lo que hay.
    const el = crearElemento('div');
    el.className = 'celda-dia';

    el.classList.add('hoy');

    assert.equal(el.className, 'celda-dia hoy',
        'agregar una clase no puede borrar las que ya estaban');
    assert.ok(el.classList.contains('celda-dia'),
        'el elemento tiene que seguir matcheando por su clase original');
});

test('`classList.remove` saca solo lo que se nombra', () => {
    const el = crearElemento('div');
    el.className = 'celda-dia hoy tiene-nota';

    el.classList.remove('hoy');

    assert.equal(el.className, 'celda-dia tiene-nota');
    assert.equal(el.classList.contains('hoy'), false);
    assert.equal(el.classList.contains('celda-dia'), true);
});

test('`classList.toggle` sin argumento alterna, y con argumento manda', () => {
    const el = crearElemento('div');
    el.className = 'a b';

    el.classList.toggle('c');
    assert.equal(el.className, 'a b c', 'sin argumento, agrega');

    el.classList.toggle('c');
    assert.equal(el.className, 'a b', 'sin argumento, saca');

    el.classList.toggle('d', true);
    assert.equal(el.className, 'a b d', 'con argumento, pone');

    el.classList.toggle('d', false);
    assert.equal(el.className, 'a b', 'con argumento, saca');
});

test('`getElementById` devuelve siempre el mismo elemento', () => {
    // También **existió** y también en silencio: devolvía un elemento nuevo en
    // cada llamada. `app.js` guarda `btnGuardarAnotacion` al arrancar; si el test
    // lo busca después recibía **otro objeto**, y lo que la app cambió no se veía.
    // No daba error: daba `false` siempre, que es un resultado plausible.
    const { contexto } = cargarComoNavegador({ cuadernoVirtual: '[]' });

    const primera = contexto.document.getElementById('btnGuardarAnotacion');
    const segunda = contexto.document.getElementById('btnGuardarAnotacion');

    assert.equal(primera, segunda,
        'el mismo id tiene que devolver el mismo nodo, como en el navegador');

    // Y el estado que se le pone se ve desde los dos lados.
    primera.disabled = true;
    assert.equal(contexto.document.getElementById('btnGuardarAnotacion').disabled, true,
        'lo que le pasa a un nodo se ve al buscarlo otra vez');
});

test('vaciar con innerHTML borra los hijos, como en el navegador', () => {
    // El tercer bug del arnés, y el más traicionero de los tres.
    //
    // `generarCalendario()` empieza con `calendarioGrid.innerHTML = ''` para
    // limpiar antes de dibujar. En el mock eso era asignar una propiedad: no
    // borraba nada, así que **cada llamada agregaba las celdas encima de las
    // anteriores**.
    //
    // No daba error: daba el doble. Con el calendario abierto y luego
    // navegado, la rejilla tenía 62 celdas en vez de 31, y el test leía 62.
    const padre = crearElemento('div');
    for (let i = 0; i < 5; i++) padre.appendChild(crearElemento('span'));
    assert.equal(padre.hijos.length, 5);

    padre.innerHTML = '';

    assert.equal(padre.hijos.length, 0,
        `quedaron ${padre.hijos.length} hijos. Vaciar por innerHTML tiene que `
        + 'borrar, o todo lo que se dibuja se suma encima de lo anterior.');
    assert.equal(padre.querySelectorAll('span').length, 0);
});

test('asignar innerHTML con contenido guarda el texto pero no lo dibuja', () => {
    // El arnés no es un navegador: no sabe interpretar marcado. Solo vacía.
    // El proyecto usa `innerHTML` para markup estático y, sobre todo, para
    // vaciar. Esto deja claro hasta dónde llega el fake.
    const el = crearElemento('div');

    el.innerHTML = '<p>hola</p>';

    assert.equal(el.innerHTML, '<p>hola</p>', 'el texto se guarda');
    assert.equal(el.hijos.length, 0, 'pero no se construye ningún nodo');
});

test('un id que no existe devuelve null, no un elemento', () => {
    const { contexto } = cargarComoNavegador({ cuadernoVirtual: '[]' });

    assert.equal(contexto.document.getElementById('noExisteEnNingunSitio'), null,
        'así se distingue "no está" de "está vacío"');
});

test('el arnés publica `window` como ámbito global', () => {
    // Si `window` fuera un objeto aparte del ámbito global, los módulos
    // publicarían sus exports en un lado y `app.js` los buscaría en el otro. La
    // carga se cortaría sin error visible, que es la forma más difícil de
    // encontrar.
    const { contexto } = cargarComoNavegador({ cuadernoVirtual: '[]' });

    assert.equal(contexto.window, contexto,
        'en el navegador `window` ES el ámbito global, no un objeto aparte');
    assert.ok(contexto.CuadernoVirtual,
        'la API de app.js tiene que quedar alcanzable desde el contexto');
});

test('el almacenamiento falso cuenta como datos, no como métodos', () => {
    // El defecto que ya se cometió una vez: las claves estaban adentro de un
    // `_d`, y `guardarDatos()` mide con `for (const llave in localStorage)`, que
    // en el mock no veía ninguna. El uso daba 0 siempre, y **la comprobación de
    // capacidad nunca se ejecutaba**. Todos los tests de almacenamiento pasaban
    // sin haber pasado por el camino que dicen probar.
    const almacen = crearAlmacenamiento({ cuadernoVirtual: '[]', otra: 'x' });

    const claves = [];
    for (const llave in almacen) claves.push(llave);

    assert.deepEqual(claves.sort(), ['cuadernoVirtual', 'otra'],
        'las claves tienen que verse con `for...in`');
    assert.equal(almacen.getItem('cuadernoVirtual'), '[]');
    assert.equal(almacen.getItem('noExiste'), null, 'lo que no está devuelve null');
});

test('romper un método lo deja como estaba cuando se restaura', () => {
    // Los tests de almacenamiento roto dependen de poder volver atrás. Sin esto,
    // el método roto se queda y el test siguiente falla sin que se sepa por qué.
    const { contexto } = cargarComoNavegador({ cuadernoVirtual: '[]' });
    const original = contexto.localStorage.setItem;

    const restaurar = romper(contexto, 'setItem', 'cuota excedida');
    assert.throws(() => contexto.localStorage.setItem('a', 'b'), /cuota excedida/);

    restaurar();
    assert.equal(contexto.localStorage.setItem, original,
        'restaurar tiene que devolver el método, no una copia');
});

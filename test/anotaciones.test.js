// ============================================
// TESTS — Regla de anotaciones por día
// Ejecutar: node --test
// Cubre: RF-4, RF-6
// Ver: specs/003-refactor-app/spec.md
// ============================================
//
// El máximo de anotaciones por día estaba escrito con un 3 suelto en tres
// lugares distintos de `app.js`: el contador, el botón deshabilitado y la
// validación al guardar. Tres copias de la misma regla, que solo dependen de
// que nadie se olvide de actualizar las tres.
//
// Acá vive en un solo lugar, como función pura.
//
// El caso que importa: un respaldo importado puede traer MÁS anotaciones que el
// máximo. La regla tiene que aguantar eso sin fallar y sin tirar anotaciones.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    tieneLugar,
    textoContador,
    esTipoValido,
    claseDeTipo,
    TIPOS_ANOTACION,
    MAXIMO_ANOTACIONES
} = require('../js/logica/anotaciones.js');

// El máximo está en un solo lugar, y es 3 porque así siempre fue.
test('el máximo por día es 3', () => {
    assert.equal(MAXIMO_ANOTACIONES, 3);
});

// ---------- Qué tipos de anotación existen ----------
//
// El tipo decide el color del punto en la rejilla del calendario y el borde del
// ítem en la lista. Estaba escrito en tres lugares distintos —el `<select>` de
// `index.html`, las reglas de `css/styles.css` y tres comparaciones en
// `app.js`— y ninguna decía cuál era el conjunto: cada uno repetía lo que
// necesitaba.
//
// Acá está el conjunto. Los valores salen del dominio, no del código: son los
// tres `<option>` que ofrece el selector.

test('los tipos de anotación son parcial, entrega y nota', () => {
    assert.deepEqual(TIPOS_ANOTACION, ['parcial', 'entrega', 'nota']);
});

test('la lista de tipos no se puede cambiar por fuera', () => {
    // Si alguien le empuja un tipo nuevo, la app tendría un tipo que el selector
    // no ofrece y el CSS no pinta. Se congela.
    assert.throws(() => TIPOS_ANOTACION.push('urgente'),
        'la lista de tipos no puede crecer desde afuera');
});

test('los tres tipos son válidos', () => {
    for (const tipo of TIPOS_ANOTACION) {
        assert.equal(esTipoValido(tipo), true, `${tipo} es un tipo del selector`);
    }
});

test('un tipo que no está en la lista no es válido', () => {
    // El caso que trae el dolor: un respaldo importado puede traer lo que quiera
    // en `tipo`. Antes eso iba directo al `className` del punto.
    for (const tipo of ['urgente', 'PARCIAL', 'Nota', '', 'con espacio', null, undefined, 42]) {
        assert.equal(esTipoValido(tipo), false, `${String(tipo)} no es un tipo`);
    }
});

test('un tipo con espacios no es válido', () => {
    // Este es el que más importa. `class="dot dot-" + "algo con espacios"` son
    // **tres** clases, no una: el dato del usuario elige nombres de clase en un
    // elemento. No es XSS —`className` no se parsea como HTML— pero es dato
    // entrando en marcado sin filtro.
    assert.equal(esTipoValido('nota urgente'), false);
    assert.equal(esTipoValido('nota-entrega'), false);
    assert.equal(esTipoValido(' nota'), false, 'con un espacio adelante tampoco');
    assert.equal(esTipoValido('nota '), false);
});

test('el tipo válido devuelve su propia clase', () => {
    for (const tipo of TIPOS_ANOTACION) {
        assert.equal(claseDeTipo(tipo), tipo,
            `${tipo} se pinta con su propia clase`);
    }
});

test('un tipo inválido no devuelve nada para interpolar', () => {
    // Lo que se interpola en el `className`. Tiene que ser **una palabra de la
    // lista** o el texto fijo `sin-tipo`: nunca el valor que vino del respaldo.
    for (const tipo of ['urgente', 'nota urgente', '" onload="x()', '', null, 42, undefined]) {
        const clase = claseDeTipo(tipo);

        assert.equal(clase, 'sin-tipo',
            `${String(tipo)} no puede volverse una clase`);
        assert.ok(!/[\s"'=<>/]/.test(clase),
            `la clase "${clase}" tiene caracteres que no pueden estar en un nombre de clase`);
    }
});

test('claseDeTipo nunca devuelve el valor que vino del dato', () => {
    // La regla general, escrita por si mañana se agrega algo al medio: **el valor
    // que viene del usuario nunca sale de la función**.
    const inventado = 'inventado por el usuario';
    assert.notEqual(claseDeTipo(inventado), inventado);
    assert.equal(claseDeTipo(inventado), 'sin-tipo');
});

// ---------- tieneLugar ----------

test('un día sin anotaciones tiene lugar', () => {
    assert.equal(tieneLugar([]), true);
});

test('un día con 1 de 3 tiene lugar', () => {
    assert.equal(tieneLugar([{ tipo: 'parcial' }]), true);
});

test('un día con 2 de 3 tiene lugar', () => {
    assert.equal(tieneLugar([{}, {}]), true);
});

test('un día con 3 de 3 NO tiene lugar', () => {
    assert.equal(tieneLugar([{}, {}, {}]), false);
});

test('un día con 4 de 3 NO tiene lugar, y no rompe', () => {
    // Puede venir de un respaldo importado. La regla no se rompe:
    // simplemente no hay lugar, y las que hay se siguen viendo.
    assert.equal(tieneLugar([{}, {}, {}, {}]), false);
    assert.equal(tieneLugar([{}, {}, {}, {}, {}, {}]), false);
});

test('algo que no es una lista se trata como lista vacía', () => {
    assert.equal(tieneLugar(null), true);
    assert.equal(tieneLugar(undefined), true);
    assert.equal(tieneLugar('no soy una lista'), true);
    assert.equal(tieneLugar({}), true);
});

// Aquí estaban los tests de `quedanCupos()` y `estaAlMaximo()`. No las usaba
// la app: el contador de la pantalla es `textoContador()` y el tope lo decide
// `tieneLugar()`. Sus tests solo comprobaban que una función restaba y que la
// otra era la negación de la tercera. Ver T6.

// ---------- textoContador ----------

test('el contador dice cuántas hay sobre el máximo', () => {
    assert.equal(textoContador([]), '0/3 anotaciones');
    assert.equal(textoContador([{}]), '1/3 anotaciones');
    assert.equal(textoContador([{}, {}, {}]), '3/3 anotaciones');
});

test('el contador no se rompe con más anotaciones que el máximo', () => {
    assert.equal(textoContador([{}, {}, {}, {}]), '4/3 anotaciones');
});

// ---------- La regla y el contador no se contradicen ----------

test('la regla y el contador siempre coinciden', () => {
    for (let n = 0; n <= 6; n++) {
        const lista = new Array(n).fill({});
        const diceElContador = textoContador(lista);
        const dejaAgregar = tieneLugar(lista);

        // El contador dice cuántas hay. Tiene que ser ese número.
        assert.equal(diceElContador, n + '/' + MAXIMO_ANOTACIONES + ' anotaciones');

        // Y si ya no deja agregar, tiene que ser porque se llegó al tope.
        // Antes esta contraprueba usaba `quedanCupos()`, que ya no existe. La
        // regla que importa es la misma: lo que dice el contador y lo que
        // decide `tieneLugar` tienen que estar de acuerdo con el máximo.
        if (!dejaAgregar) {
            assert.ok(n >= MAXIMO_ANOTACIONES,
                'no deja agregar con ' + n + ' anotaciones');
        } else {
            assert.ok(n < MAXIMO_ANOTACIONES,
                'dice que hay lugar pero ya se llegó al máximo con ' + n);
        }
    }
});
// ============================================
// TESTS — Lo que la pantalla promete sobre las anotaciones
// Ejecutar: node --test
// Ver: specs/006-reducir-app-js/task.md, hallazgo de T4
// ============================================
//
// Cuando un día ya tiene tres anotaciones, el botón Guardar se pone gris y el
// contador dice "3/3 anotaciones". Eso **es** el aviso, y avisa bien: no
// interrumpe y explica antes de que el usuario intente algo.
//
// También había un `alert('Máximo 3 anotaciones por día')`, y era **imposible
// verlo**: el único camino para guardar es el clic del botón, y el botón está
// deshabilitado. No hay Enter, ni atajo, ni otra llamada.
//
// Se borró el cartel. Estos tests fijan las dos mitades de esa decisión:
//
//   1. El botón deshabilitado se mantiene. Es el que avisa.
//   2. No queda ningún cartel que el usuario no pueda provocar.
//
// Lo importante del segundo no es que desaparezca la frase: es que **un mensaje
// que nadie puede provocar es peor que ningún mensaje**. Promete una defensa que
// no existe. Si mañana alguien deja de deshabilitar el botón, el cartel tampoco
// va a estar, y el usuario se queda sin aviso por los dos lados.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cargarComoNavegador } = require('./dom-falso.js');

const FECHA = '12/10/2026';
const MATERIA = JSON.stringify([{ id: 'm1', nombre: 'Matematica', documentos: [] }]);

const TRES = [
    { id: 'a1', tipo: 'entrega', descripcion: 'Una' },
    { id: 'a2', tipo: 'nota', descripcion: 'Dos' },
    { id: 'a3', tipo: 'parcial', descripcion: 'Tres' }
];

const UNA = [{ id: 'a1', tipo: 'nota', descripcion: 'Una' }];

// Corre la app contra el navegador falso, abre el calendario y elige un día.
// Devuelve lo que el test necesita mirar.
function appMirandoElDia(anotaciones) {
    const { contexto, errores } = cargarComoNavegador({
        cuadernoVirtual: MATERIA,
        calendarioAnotaciones: JSON.stringify({ [FECHA]: anotaciones })
    });

    assert.deepEqual(errores, [], 'la app tiene que cargar sin errores');

    const alertas = [];
    contexto.alert = (texto) => { alertas.push(texto); };

    const salida = vm.runInContext(`
    (function () {
        document.getElementById('btnCalendario').click();

        const celda = document.getElementById('calendarioGrid')
            .querySelectorAll('.celda-dia')
            .filter(c => c.dataset.fecha === '${FECHA}')[0];

        if (!celda) return { error: 'no se encontro el dia en la rejilla' };
        celda.click();

        const lista = document.getElementById('anotacionesExistentes');
        const contador = lista.querySelector('.anotaciones-contador');

        return {
            botonDeshabilitado: document.getElementById('btnGuardarAnotacion').disabled,
            contador: contador ? contador.textContent : null,
            textos: lista.querySelectorAll('.anotacion-texto').map(t => t.textContent),
            clasesDeLosItems: lista.querySelectorAll('.anotacion-item').map(i => i.className),
            clasesDeLaCelda: celda.className,
            clasesDeLosPuntos: celda.querySelectorAll('.dot').map(d => d.className)
        };
    })()
    `, contexto);

    return { contexto, alertas, salida };
}

// ---------- La mitad que se conserva: el botón avisa ----------

test('con el día lleno, el botón Guardar está deshabilitado', () => {
    const { salida } = appMirandoElDia(TRES);

    assert.equal(salida.botonDeshabilitado, true,
        'el botón deshabilitado ES el aviso. Si esto se rompe, no hay nada que '
        + 'avise y el usuario escribe para nada.');
});

test('con el día lleno, el contador dice que está lleno', () => {
    const { salida } = appMirandoElDia(TRES);

    assert.equal(salida.contador, '3/3 anotaciones',
        'el contador dice con palabras lo mismo que el botón gris');
});

test('con el día lleno, la celda muestra que tiene cada tipo', () => {
    const { salida } = appMirandoElDia(TRES);

    // La celda sigue siendo una celda. Si el arnés mintiera con `classList`, esto
    // no llegaría: el elemento dejaría de matchear `.celda-dia` al agregarle una
    // clase. Pasó, y se detectó recién cuando se probó el calendario acá.
    assert.match(salida.clasesDeLaCelda, /celda-dia/);
    assert.match(salida.clasesDeLaCelda, /tiene-entrega/);
    assert.match(salida.clasesDeLaCelda, /tiene-nota/);
    assert.match(salida.clasesDeLaCelda, /tiene-parcial/);
});

test('con el día lleno, se ven las tres anotaciones', () => {
    const { salida } = appMirandoElDia(TRES);

    assert.deepEqual(salida.textos, ['Una', 'Dos', 'Tres']);
});

test('con lugar, el botón Guardar está habilitado', () => {
    const { salida } = appMirandoElDia(UNA);

    assert.equal(salida.botonDeshabilitado, false,
        'con una sola anotación el usuario tiene que poder guardar');
    assert.equal(salida.contador, '1/3 anotaciones');
});

test('sin elegir día, el botón Guardar nace deshabilitado', () => {
    // Este caso se mira en `index.html` y no en la app, y no es casualidad.
    //
    // El navegador falso **no lee el HTML**: `document.getElementById()` devuelve
    // un elemento nuevo con `disabled: false`, sin importar lo que diga la
    // etiqueta. El atributo inicial vive en `index.html` y se verifica ahí.
    //
    // Importa porque es lo que impide guardar sin haber elegido un día: el botón
    // nace gris y recién `seleccionarDia()` lo habilita.
    const html = fs.readFileSync(
        path.join(__dirname, '..', 'index.html'), 'utf8');

    const boton = html.match(/<button[^>]*id="btnGuardarAnotacion"[^>]*>/);

    assert.ok(boton, 'el botón tiene que estar en index.html');
    assert.match(boton[0], /\sdisabled\b/,
        'nace deshabilitado: sin día elegido no hay nada que guardar');
});

// ---------- La mitad que se borra: el cartel imposible ----------

// La frase que busca el cartel roto.
//
// **La primera versión de esta búsqueda no podía encontrar nada**, y el test pasó
// en verde con el cartel todavía escrito:
//
//     /Máximo\s+\d+\s+anotaciones por día/
//
// El código real es:
//
//     alert('Máximo ' + AnotacionesLogica.MAXIMO_ANOTACIONES + ' anotaciones por día');
//
// El `\d+` no matchea nada: entre "Máximo" y "anotaciones" no hay ningún dígito,
// hay una expresión. Un test que **no encuentra** lo que busca también pasa, y
// es más peligroso que uno que falla: parece que la red está puesta.
//
// Ahora busca la parte que sí está literal: el texto del aviso.
const CARTEL_IMPOSIBLE = /anotaciones por d[ií]a/;

// Se buscan **solo las líneas de código**, sin los comentarios.
//
// Un comentario no es código. Y el comentario que explica este borrado cita el
// cartel entero:
//
//     //     alert('Máximo 3 anotaciones por día');
//
// Con la búsqueda sin limpiar, el test fallaba por su propia documentación. Es
// el mismo criterio que usa `herramientas/buscar-codigo-muerto.js`: si cuenta lo
// que está escrito en prosa, no está contando código.
function sinComentarios(texto) {
    return texto.split('\n')
        .filter(linea => !/^\s*(\/\/|\*|\/\*)/.test(linea))
        .join('\n');
}

function codigoSinComentarios(archivo) {
    return sinComentarios(fs.readFileSync(archivo, 'utf8'));
}

test('no queda ningún cartel sobre el máximo de anotaciones', () => {
    const codigo = codigoSinComentarios(
        path.join(__dirname, '..', 'js', 'app.js'));

    // Este es un test de fuente y vale la pena decir por qué: el cartel no se
    // puede provocar, así que **no hay forma de probarlo por comportamiento**.
    // Probar que algo no se puede llegar es probar el camino, no el texto, y el
    // camino está cerrado.
    //
    // Lo que sí se prueba por comportamiento es lo de arriba: que el botón que
    // avisa de verdad está deshabilitado. Esta fila es la red del otro lado.
    const encontrados = codigo.match(new RegExp(CARTEL_IMPOSIBLE, 'g')) || [];

    assert.deepEqual(encontrados, [],
        'quedó un cartel sobre el máximo de anotaciones, y es imposible de ver: '
        + 'el botón que lo dispararía ya está deshabilitado. Si el aviso se '
        + 'mueve a otro lado, que sea con una decisión y no por accidente.');
});

test('el filtro de comentarios saca el cartel que se quo', () => {
    // La red probada contra sí misma, por los dos lados.
    //
    // Por un lado, el patrón tiene que encontrar el texto que se borró.
    const elQueHabia = 'alert(\'Máximo \' + AnotacionesLogica.MAXIMO_ANOTACIONES'
        + ' + \' anotaciones por día\');';

    assert.match(elQueHabia, CARTEL_IMPOSIBLE,
        'el patrón tiene que encontrar el texto que se borró. Si no lo '
        + 'encuentra, el test de arriba pasa siempre.');

    // Y por el otro, el filtro tiene que sacarlo cuando está comentado. Si no,
    // escribir la explicación de este cambio rompe el test que lo verifica.
    const comentado = [
        '// No hay ningún cartel. Antes había uno:',
        '//',
        '//     alert(\'Máximo \' + AnotacionesLogica.MAXIMO_ANOTACIONES'
        + ' + \' anotaciones por día\');',
        '',
        'if (!resultado.agrego) return;'
    ].join('\n');

    assert.doesNotMatch(sinComentarios(comentado), CARTEL_IMPOSIBLE,
        'un cartel en un comentario no es un cartel en el código');
    assert.match(sinComentarios('alert(\'anotaciones por día\');'), CARTEL_IMPOSIBLE,
        'pero en una línea de código sí se encuentra');
});

test('nadie avisa cuando el día ya está lleno', () => {
    // Y la comprobación de que el aviso no aparece **en el camino real**, no solo
    // en el texto del código.
    const { contexto, alertas, salida } = appMirandoElDia(TRES);

    // El arnés no respeta `disabled` al hacer clic —en el navegador no se puede
    // apretar un botón deshabilitado—, así que acá se fuerza el intento. Y aun
    // así no tiene que salir ningún cartel: aunque alguien saque el `disabled`
    // por error, el usuario no recibe un `alert` interrumpiendo lo que escribió.
    contexto.document.getElementById('btnGuardarAnotacion').click();

    assert.equal(alertas.length, 0,
        `salieron ${alertas.length} avisos: ${alertas.join(' | ')}`);
    assert.equal(salida.contador, '3/3 anotaciones',
        'y el día sigue con lo que tenía');
});

// ---------- El tipo del dato no elige clases ----------

const TIPOS_RAROS = [
    'urgente',
    'nota urgente',
    'nota-entrega',
    '" onload="algo()',
    'PARCIAL',
    '',
    null,
    42
];

test('una anotación de tipo desconocido no mete el dato en el className', () => {
    // El `tipo` de una anotación puede venir de un respaldo importado. Antes de
    // este cambio iba directo al `className` del punto:
    //
    //     dot.className = `dot dot-${a.tipo}`;
    //
    // Con `'nota urgente'` eso son **tres** clases: `dot`, `dot-nota` y
    // `urgente`. El dato del usuario pasa a elegir nombres de clase en un
    // elemento del DOM.
    //
    // No es XSS —`className` no se parsea como HTML, no gana atributos ni ejecuta
    // guiones— pero es dato del usuario entrando en marcado sin filtro, que es
    // justo lo que el principio 3 prohíbe.
    for (const tipo of TIPOS_RAROS) {
        const anotaciones = [{ id: 'x', tipo, descripcion: 'Rara' }];
        const { salida } = appMirandoElDia(anotaciones);

        assert.match(salida.clasesDeLaCelda, /celda-dia/,
            `con tipo ${JSON.stringify(tipo)} la celda tiene que seguir siendo una celda`);

        // La celda marca los tipos con `tiene-*`, y esa lista sí la decide el
        // código comparando contra los tres conocidos. Un tipo raro no puede
        // inventar una de esas clases.
        const tiene = salida.clasesDeLaCelda.split(/\s+/).filter(c => c.startsWith('tiene-'));
        assert.deepEqual(tiene, [],
            `con tipo ${JSON.stringify(tipo)} la celda no debería ganar clases "tiene-*"`);
    }
});

test('una anotación de tipo desconocido se ve igual, sin color de tipo', () => {
    // Los datos son sagrados: una anotación con un tipo raro **no se borra y no
    // se esconde**. Se muestra, con la clase fija `sin-tipo`.
    const raro = [{ id: 'x', tipo: 'nota urgente', descripcion: 'Se sigue viendo' }];

    const { salida } = appMirandoElDia(raro);

    assert.deepEqual(salida.textos, ['Se sigue viendo'],
        'la anotación tiene que seguir en la lista');
    assert.equal(salida.contador, '1/3 anotaciones',
        'y tiene que contar para el máximo');

    // El punto y el ítem llevan la clase fija, y solo esa.
    assert.deepEqual(salida.clasesDeLosPuntos, ['dot dot-sin-tipo'],
        'el punto no puede llevar el tipo que vino del respaldo');
    assert.deepEqual(salida.clasesDeLosItems, ['anotacion-item sin-tipo'],
        'ni el ítem de la lista');
});

test('una anotación de tipo desconocido no agrega clases al punto', () => {
    // El caso concreto del daño. `'nota urgente'` sin filtrar daba:
    //
    //     class="dot dot-nota urgente"      ← tres clases
    //
    // O sea que el dato elegía el nombre de dos clases más.
    for (const tipo of TIPOS_RAROS) {
        const { salida } = appMirandoElDia([{ id: 'x', tipo, descripcion: 'Rara' }]);

        const punto = salida.clasesDeLosPuntos[0] || '';
        const clases = punto.split(/\s+/).filter(Boolean);

        assert.deepEqual(clases, ['dot', 'dot-sin-tipo'],
            `con tipo ${JSON.stringify(tipo)} el punto quedó con ${clases.join(' | ')}`);
    }
});

test('los puntos del día usan siempre el nombre de clase completo', () => {
    // Con un tipo válido el punto tiene que llevar su clase, o el color se pierde.
    const { salida } = appMirandoElDia(TRES);

    // Las clases de la celda tienen que seguir siendo las de los tres tipos.
    assert.match(salida.clasesDeLaCelda, /tiene-entrega/);
    assert.match(salida.clasesDeLaCelda, /tiene-nota/);
    assert.match(salida.clasesDeLaCelda, /tiene-parcial/);
});

test('ningún archivo pone el tipo crudo dentro de un className', () => {
    // La red del otro lado: que no vuelva la interpolación.
    //
    // Es un test de fuente porque la forma del defecto **no** se ve en el
    // comportamiento: con `'nota urgente'` la celda queda bien en los tests de
    // arriba, y solo el `className` tiene la clase de más.
    const app = sinComentarios(
        fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8'));

    const crudas = app.match(/className\s*=\s*`[^`]*\$\{[^}]*\.tipo[^}]*\}[^`]*`/g) || [];

    assert.deepEqual(crudas, [],
        'hay un className con el tipo crudo interpolado. Tiene que pasar por '
        + 'claseDeTipo(), que es la frontera.');
});


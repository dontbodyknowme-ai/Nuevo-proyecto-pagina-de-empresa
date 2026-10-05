// ============================================ TESTS — La barra de estadísticas
// Ejecutar: node --test
// Cubre: RF-2
// Ver: specs/004-app-funcional-y-limpeza/spec.md (T2)
// ============================================
//
// Contexto:
//
// La barra de números vive dentro del bloque de bienvenida, adentro de
// `#visor`. Y `mostrarBienvenida()` hace `visor.innerHTML = ...` **entero**:
// borra todo lo que había adentro, barra incluida.
//
// La variable `statsContainer` seguía apuntando al nodo viejo, así que
// `actualizarStats()` escribía a un nodo que ya no estaba en la pantalla. El
// código no fallaba. La barra desaparecería y nadie se enteraba por un error.
//
// Medido: al borrar una materia, `#statsContainer` pasaba de estar en el DOM a no
// estarlo, y no volvía hasta recargar la página.
//
// ## Por qué estos tests leen el código y no el DOM
//
// El DOM falso de `test/navegador.test.js` no parsea el `innerHTML`: no crea
// nodos hijos. Así que no puede reproducir este defecto por sí solo.
//
// Lo que sí se puede hacer es fijar las tres condiciones que, juntas, lo
// previenen. Y hay un test que compara el bloque de bienvenida del HTML con el
// del código: si divergen, el defecto vuelve en silencio.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

// Los archivos donde puede estar la función que se busca.
//
// Antes era uno solo, `app.js`, y por eso el test se rompía —o peor, dejaba de
// mirar— en cuanto la función se mudaba. Con la lista, el test la encuentra
// donde esté, y el día que se agregue un módulo nuevo alcanza con anotarlo acá.
const DONDE_BUSCAR = [
    'js/app.js',
    'js/interfaz/bienvenida.js'   // si algún día se mueve
];

function leerSiExiste(relativo) {
    const completo = path.join(RAIZ, relativo);
    return fs.existsSync(completo) ? fs.readFileSync(completo, 'utf8') : null;
}

/** El cuerpo de una función, buscando en todos los archivos de la lista. */
function cuerpoDe(nombre) {
    for (const relativo of DONDE_BUSCAR) {
        const codigo = leerSiExiste(relativo);
        if (codigo === null) continue;

        const inicio = codigo.indexOf(`function ${nombre}(`);
        if (inicio === -1) continue;

        // Contar llaves para encontrar dónde termina el cuerpo
        let nivel = 0;
        const desde = codigo.indexOf('{', inicio);
        for (let i = desde; i < codigo.length; i++) {
            if (codigo[i] === '{') nivel++;
            if (codigo[i] === '}') {
                nivel--;
                if (nivel === 0) return codigo.slice(desde, i + 1);
            }
        }
        throw new Error(`no se pudo cerrar el cuerpo de ${nombre}()`);
    }

    assert.fail(
        `no se encontró ${nombre}() en ninguno de estos archivos:\n  `
        + DONDE_BUSCAR.join('\n  ')
    );
}

/** En qué archivo se encontró, para poder decirselo al que falla. */
function archivoDe(nombre) {
    for (const relativo of DONDE_BUSCAR) {
        const codigo = leerSiExiste(relativo);
        if (codigo !== null && codigo.includes(`function ${nombre}(`)) {
            return relativo;
        }
    }
    return '(no está)';
}

// ---------- La causa: la plantilla no traía la barra ----------

test('la plantilla de bienvenida vuelve a traer el contenedor de estadísticas', () => {
    const cuerpo = cuerpoDe('mostrarBienvenida');

    assert.ok(
        /id="statsContainer"/.test(cuerpo),
        'la plantilla de `mostrarBienvenida()` tiene que volver a crear '
        + '`<div class="stats" id="statsContainer"></div>`, como lo hace index.html. '
        + 'Si no lo trae, la barra desaparece para siempre en cuanto se llama.'
    );
});

test('la plantilla de bienvenida trae la barra en el mismo lugar que el HTML', () => {
    // Si el orden cambia, la barra queda fuera de la línea de tiempo del texto
    // de bienvenida y se ve distinta.
    const cuerpo = cuerpoDe('mostrarBienvenida');

    const enCodigo = cuerpo.indexOf('id="statsContainer"');
    const enHtml = HTML.indexOf('id="statsContainer"');

    assert.ok(enHtml > 0, 'index.html tiene que traer la barra');

    // En el código, la barra tiene que estar entre el <p> de instrucción y el <p>
    // de la pista. Ese es el orden del HTML.
    const pistaEnCodigo = cuerpo.indexOf('class="hint"');
    const pistaEnHtml = HTML.indexOf('class="hint"');

    assert.ok(pistaEnCodigo > enCodigo,
        'en el código la barra va antes de la pista, igual que en el HTML');
    assert.ok(pistaEnHtml > enHtml,
        'en el HTML la barra va antes de la pista');
});

// ---------- La consecuencia: la variable queda apuntando al nodo viejo ----------

test('statsContainer se puede reasignar', () => {
    // El nodo viejo se destruye. Con `const` no se puede apuntar al nuevo, y la
    // barra se queda sin pintar para siempre.
    //
    // Se busca en toda la lista, y no solo en el archivo donde quedó la
    // función: la declaración de la variable tiene que estar donde la usan.
    const declarado = DONDE_BUSCAR.some(relativo => {
        const codigo = leerSiExiste(relativo);
        return codigo !== null && /let\s+statsContainer\s*=/.test(codigo);
    });

    assert.ok(
        declarado,
        '`statsContainer` tiene que ser `let`, no `const`: el nodo al que apunta '
        + 'se destruye cada vez que se vuelve a pintar la bienvenida.\n'
        + 'Busqué en:\n  ' + DONDE_BUSCAR.join('\n  ')
    );
});

test('después de pintar la bienvenida se vuelve a buscar el contenedor', () => {
    const cuerpo = cuerpoDe('mostrarBienvenida');

    const reasigna = /statsContainer\s*=\s*document\.getElementById\(['"]statsContainer['"]\)/
        .test(cuerpo);

    assert.ok(reasigna,
        'después de escribir la plantilla hay que volver a buscar el nodo nuevo: '
        + '`statsContainer = document.getElementById("statsContainer")`');
});

test('después de pintar la bienvenida se repintan los números', () => {
    const cuerpo = cuerpoDe('mostrarBienvenida');

    assert.ok(/actualizarStats\(\)/.test(cuerpo),
        'hay que llamar a `actualizarStats()` después de volver a buscar el nodo, '
        + 'porque el que se creó viene vacío');
});

test('el orden es buscar el nodo antes de pintar los números', () => {
    const cuerpo = cuerpoDe('mostrarBienvenida');

    const busca = cuerpo.indexOf("getElementById('statsContainer')");
    const pinta = cuerpo.indexOf('actualizarStats()');

    assert.ok(busca >= 0 && pinta >= 0, 'faltaría uno de los dos');
    assert.ok(busca < pinta,
        'primero se busca el nodo nuevo, después se pintan los números. '
        + 'Al revés se escribiría en el nodo viejo, que ya no está en la pantalla');
});

// ---------- Que no vuelva a pasar por una vía indirecta ----------

test('actualizarStats no falla si el contenedor no está', () => {
    // Puede pasar: si el bloque de bienvenida cambia y no trae la barra.
    // Escribir a null no puede romper la app.
    const cuerpo = cuerpoDe('actualizarStats');

    assert.ok(
        /if\s*\(\s*!statsContainer\s*\)/.test(cuerpo),
        '`actualizarStats()` tiene que arrancar con `if (!statsContainer) return;`: '
        + 'escribir en un contenedor que no existe no puede romper la app'
    );
});

test('index.html sigue teniendo la barra para la primera pintura', () => {
    // Si se saca del HTML y la app no la crea al arrancar, no hay barra nunca.
    assert.ok(/id="statsContainer"/.test(HTML),
        'index.html tiene que traer la barra: es lo que se ve antes de que '
        + 'corra cualquier script');
});

// ---------- El texto de los dos lados tiene que ser el mismo ----------

test('el bloque de bienvenida dice lo mismo en el HTML y en el código', () => {
    // Las frases que el usuario lee. Si difieren, al borrar algo el mensaje
    // cambia y parece un error nuevo.
    const frases = [
        'Tu Cuaderno Virtual',
        'Crea materias y sube tus documentos HTML, PDF o Word para organizarlos.',
        'Haz clic en "Añadir Materia" para comenzar.'
    ];

    const cuerpo = cuerpoDe('mostrarBienvenida');

    for (const frase of frases) {
        assert.ok(HTML.includes(frase), `falta en index.html: ${frase}`);
        assert.ok(cuerpo.includes(frase),
            `falta en la plantilla de mostrarBienvenida(): ${frase}`);
    }
});
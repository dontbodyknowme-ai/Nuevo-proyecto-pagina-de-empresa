// ============================================
// TESTS — Distribución del calendario según el ancho
// Ejecutar: node --test
// Cubre: RF-3, RF-4, RF-9, RNF-1, RNF-2
// Ver: specs/002-layout-calendario/spec.md
// ============================================
//
// Estos tests NO pueden probar el CSS. Un archivo de Node no sabe nada de
// anchos de pantalla ni de hojas de estilo: el DOM falso de los tests
// anteriores no aplica ninguna regla.
//
// Lo que sí se puede probar aquí es lo que sí es código: que la hoja de
// estilos contenga las reglas que hacen que el modal se adapte, y que las
// que ya existían no se contradigan entre sí.
//
// El comportamiento real se verifica en Chrome. Eso es el segundo camino
// del Principio 4, y no es opcional: en T4 el atributo `hidden` se aplicaba
// pero no ocultaba nada, y ningún test de Node lo detectó.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(
    path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');

// Extrae el texto de un bloque @media por su condición
function bloqueMedia(condicion) {
    const inicio = CSS.indexOf('@media ' + condicion);
    if (inicio === -1) return null;

    let profundidad = 0;
    let desde = CSS.indexOf('{', inicio);

    for (let i = desde; i < CSS.length; i++) {
        if (CSS[i] === '{') profundidad++;
        if (CSS[i] === '}') {
            profundidad--;
            if (profundidad === 0) return CSS.slice(desde, i + 1);
        }
    }
    return null;
}

// Todos los bloques @media que mencionan algo del calendario
function mediaDelCalendario() {
    const encontrados = [];
    const re = /@media[^{]+\{/g;
    let m;
    while ((m = re.exec(CSS)) !== null) {
        let profundidad = 0, desde = m.index + m[0].length - 1;
        for (let i = desde; i < CSS.length; i++) {
            if (CSS[i] === '{') profundidad++;
            if (CSS[i] === '}') { profundidad--; if (profundidad === 0) {
                const cuerpo = CSS.slice(desde, i + 1);
                if (/calendario|mapa|celda-dia|panel-dia/.test(cuerpo)) {
                    encontrados.push({ condicion: m[0].trim(), cuerpo });
                }
                break;
            } }
        }
        re.lastIndex = desde;
    }
    return encontrados;
}

// ---------- RF-4 · una columna cuando el ancho no alcanza ----------

test('RF-4 · hay una regla que apila el panel de anotaciones debajo', () => {
    // Con dos zonas de scroll y una caja que recorta, en el telefono hay
    // que deslizar dentro de la rejilla y despues dentro del panel.
    const angosto = bloqueMedia('(max-width: 900px)');
    assert.ok(angosto, 'falta el bloque @media (max-width: 900px)');

    assert.match(angosto, /\.calendario-body[^{]*\{[^}]*flex-direction:\s*column/,
        'el cuerpo del modal debe pasar a columna cuando el ancho no alcanza');
});

test('RF-4 · el scroll vertical vive en un solo lugar', () => {
    const angosto = bloqueMedia('(max-width: 900px)');
    assert.ok(angosto);

    // El desplazamiento pasa al conjunto; las partes dejan de desplazarse.
    assert.match(angosto, /\.calendario-body[^{]*\{[^}]*overflow-y:\s*auto/,
        'el conjunto debe ser lo que se desplaza en vertical');
    assert.match(angosto, /\.calendario-grid[^{]*\{[^}]*overflow-y:\s*visible/,
        'la rejilla no debe desplazarse por su cuenta');
    assert.match(angosto, /\.calendario-panel[^{]*\{[^}]*overflow-y:\s*visible/,
        'el panel no debe desplazarse por su cuenta');
});

test('RF-4 · apiladas, las dos partes dejan de competir por el ancho', () => {
    const angosto = bloqueMedia('(max-width: 900px)');
    assert.match(angosto, /\.calendario-panel[^{]*\{[^}]*width:\s*100%/,
        'el panel ocupa todo el ancho en vez de 320 px fijos');
});

// ---------- RF-9 / RNF-1 · nada se sale de la ventana ----------

test('RF-9 · el panel no excede el ancho de la ventana', () => {
    const angosto = bloqueMedia('(max-width: 900px)');
    assert.ok(angosto);
    assert.match(angosto, /\.calendario-container[^{]*\{[^}]*max-width:\s*100%/,
        'el panel no puede ser mas ancho que la ventana');
});

test('RNF-1 · el alto del panel se limita contra la altura de la ventana', () => {
    const angosto = bloqueMedia('(max-width: 900px)');
    assert.match(angosto, /\.calendario-container[^{]*\{[^}]*max-height:\s*9\d vh|max-height:\s*9\dvh/,
        'el alto maximo va contra la altura de la ventana, no en pixeles fijos');
});

// ---------- RNF-4 · la geometria esta en el CSS, no en el codigo ----------

test('RNF-4 · el codigo del calendario no decide anchos por su cuenta', () => {
    // Solo los archivos que son del calendario.
    //
    // `app.js` queda afuera a propósito: ahí está el visor de PDF, que sí
    // necesita medir el ancho del contenedor porque renderiza a un canvas.
    // Eso es inevitable y no es la geometría de la que habla RNF-4.
    //
    // **La lista es de los que se vigilan.** Los que se excluyen van aparte,
    // abajo, con el motivo. Si esa lista de excluidos tiene un archivo que ya
    // no mide nada, hay que sacarlo: una exclusión sin motivo es un agujero por
    // el que puede volver la geometría al código.
    const archivos = [
        'js/inicio-calendario.js',
        'js/interfaz/mapa-calor.js',
        'js/interfaz/visibilidad.js',
        'js/logica/calendario.js',
        'js/logica/layout.js',
        'js/logica/mapa-calor.js'
    ];

    for (const relativo of archivos) {
        const codigo = fs.readFileSync(
            path.join(__dirname, '..', relativo), 'utf8');

        const usaAncho = /innerWidth|clientWidth|offsetWidth|matchMedia|getBoundingClientRect/
            .test(codigo);

        assert.equal(usaAncho, false,
            relativo + ' lee medidas de la pantalla; la geometría del '
            + 'calendario debe resolverse en la hoja de estilos (RNF-4)');
    }
});

test('RNF-4 · la excepción de app.js sigue teniendo motivo', () => {
    // `app.js` no se vigila con el test de arriba. Eso es correcto **mientras**
    // lo que mide sea solo el visor de PDF.
    //
    // El día que el visor se mude, o que app.js empiece a medir otra cosa, esta
    // exclusión se convierte en un agujero silencioso: el archivo más grande del
    // proyecto quedaría sin vigilar, y el test de arriba pasaría sin mirarlo.
    //
    // Este test no puede adivinar por qué se excluye, pero sí comprobar que la
    // exclusión está **escrita** y que el motivo sigue siendo cierto: si nadie
    // mide en app.js, la excepción sobra y hay que borrarla.
    const app = fs.readFileSync(
        path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

    const mide = /innerWidth|clientWidth|offsetWidth|matchMedia|getBoundingClientRect/;

    if (mide.test(app)) {
        assert.ok(
            /clientWidth/.test(app),
            'app.js mide, y este test lo exceptúa sin verificar por qué. '
            + 'Se esperaba que la única medida sea el `clientWidth` del visor de '
            + 'PDF. Si es otra, hay que revisar la excepción a mano.'
        );
        return;
    }

    // No mide nada: la excepción quedó vieja y app.js debería entrar en la lista
    // de los que se vigilan.
    assert.fail(
        'app.js ya no mide la pantalla, así que la excepción quedó vieja.\n'
        + 'Agregá "js/app.js" a la lista de archivos del test de arriba y '
        + 'borrá el comentario que lo excluía.'
    );
});

// ---------- Coherencia interna de la hoja ----------

test('coherencia · el atributo hidden gana a los display flex', () => {
    // Sin esto, ocultar el chrome de la vista mapa no hace nada:
    // display: flex le gana al atributo hidden del navegador.
    assert.match(CSS, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/,
        'falta [hidden] { display: none !important }');
});

test('coherencia · la rejilla del calendario esta definida una sola vez', () => {
    const definiciones = CSS.match(/^\.calendario-grid\s*\{/gm) || [];
    assert.equal(definiciones.length, 1,
        'esta definida ' + definiciones.length + ' veces; la segunda gana por cascada');
});

test('coherencia · el panel tiene ancho flexible y no fijo', () => {
    const base = CSS.match(/\.calendario-container\s*\{[^}]*\}/);
    assert.ok(base, 'falta la regla .calendario-container');
    assert.match(base[0], /width:\s*min\(/,
        'el ancho deberia ser flexible; un max-width fijo desperdicia pantallas grandes');
});

test('coherencia · existe al menos un bloque responsive del calendario', () => {
    const bloques = mediaDelCalendario();
    assert.ok(bloques.length > 0, 'no hay ninguna regla @media para el calendario');
});

// ---------- El Pomodoro no puede tapar el modal ----------

test('el widget del Pomodoro se oculta mientras el modal esta abierto', () => {
    // El Pomodoro y el modal compiten por el mismo z-index (1000). El widget
    // se dibuja despues, asi que gana y tapa los controles del calendario:
    // medido 213x40 px encima del encabezado en 375 px.
    //
    // El modal aparece antes que el widget en el HTML, asi que el selector
    // de hermano general alcanza y no hace falta tocar JavaScript.
    assert.match(CSS, /\.modal-calendario\.visible\s*~\s*\.pomodoro-widget\s*\{[^}]*display:\s*none/,
        'falta la regla que oculta el Pomodoro mientras el modal esta abierto');
});

test('el Pomodoro se ve normalmente cuando el modal no esta visible', () => {
    // La regla tiene que ser condicional: no puede ocultar el widget
    // siempre, porque vive siempre en pantalla.
    const regla = CSS.match(/\.modal-calendario\.visible\s*~\s*\.pomodoro-widget\s*\{[^}]*\}/);
    assert.ok(regla);
    assert.doesNotMatch(regla[0], /^\s*\.pomodoro-widget\s*\{/,
        'no debe redefining el widget de forma incondicional');
});
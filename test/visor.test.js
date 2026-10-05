// ============================================
// TESTS — Cómo se dibuja un documento HTML en el visor
// Ejecutar: node --test
// Cubre: Principio 3 y Principio 5
// Ver: docs/constitucion.md
// ============================================
//
// Contexto: se encontró que `js/app.js` metía el nombre del documento crudo
// en un `innerHTML`:
//
//     <iframe srcdoc="${escapeHtml(doc.contenido)}" title="${doc.nombre}">
//
// `doc.contenido` pasaba por `escapeHtml`, `doc.nombre` no. Un nombre como
// `informe" onload="codigoMalicioso()"` inyectaba un manejador que se
// ejecutaba al cargar el iframe. Verificado en Chrome.
//
// Estos tests comprueban que el nombre del documento **nunca** pase por
// `innerHTML`, y que el `srcdoc` reciba el HTML crudo: el atributo `srcdoc`
// está hecho para eso, y escaparlo solo se cancela a sí mismo.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { mostrarHtml } = require('../js/interfaz/visor.js');

// ---------- Un DOM mínimo que registra lo que se le hace ----------

function crearElemento(tag = 'div') {
    const el = {
        tagName: String(tag).toUpperCase(),
        id: '',
        className: '',
        title: '',
        hidden: false,
        style: {},
        dataset: {},
        atributos: {},
        hijos: [],
        // Registra cualquier intento de escribir innerHTML
        _innerHTML: '',
        _toquesInnerHTML: 0,
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) {
            this._toquesInnerHTML++;
            this._innerHTML = v;
            this.hijos = [];
        },
        textContent: '',
        appendChild(h) { this.hijos.push(h); return h; },
        removeChild(h) { const i = this.hijos.indexOf(h); if (i >= 0) this.hijos.splice(i, 1); },
        setAttribute(k, v) { this.atributos[k] = v; },
        getAttribute(k) { return this.atributos[k] ?? null; },
        removeAttribute(k) { delete this.atributos[k]; },
        hasAttribute(k) { return k in this.atributos; },
        addEventListener() {},
        removeEventListener() {}
    };
    return el;
}

const NOMBRE_MALICIOSO = 'informe" onload="window.__inyectado=true" data-x="';

// El documento que se le pasa al módulo: el mismo DOM falso
const docFalso = { createElement: tag => crearElemento(tag) };

// ---------- Principio 5 · el nombre nunca pasa por innerHTML ----------

test('Principio 5 · el nombre del documento no se escribe con innerHTML', () => {
    const visor = crearElemento();
    mostrarHtml(visor, { nombre: NOMBRE_MALICIOSO, contenido: '<p>hola</p>' }, docFalso);

    assert.equal(visor._toquesInnerHTML, 0,
        'no debe usar innerHTML para mostrar un documento');
});

test('Principio 5 · el nombre malicioso no crea ningún manejador', () => {
    const visor = crearElemento();
    mostrarHtml(visor, { nombre: NOMBRE_MALICIOSO, contenido: '<p>hola</p>' }, docFalso);

    const iframe = visor.hijos[0];
    assert.equal(iframe.tagName, 'IFRAME');

    // Ningún atributo que parezca un manejador de eventos
    for (const clave of Object.keys(iframe.atributos)) {
        assert.ok(!clave.toLowerCase().startsWith('on'),
            'se inyectó el atributo ' + clave);
    }

    // Y el contenido no contiene la carga útil suelta
    assert.ok(!iframe.atributos.srcdoc.includes('onload'),
        'la carga útil no debe aparecer en el srcdoc');
});

// ---------- El iframe se construye bien ----------

test('el visor queda con un solo iframe', () => {
    const visor = crearElemento();
    mostrarHtml(visor, { nombre: 'Informe', contenido: '<p>hola</p>' }, docFalso);

    assert.equal(visor.hijos.length, 1);
    assert.equal(visor.hijos[0].tagName, 'IFRAME');
});

test('el nombre va como propiedad title, no como atributo armado', () => {
    const visor = crearElemento();
    mostrarHtml(visor, { nombre: NOMBRE_MALICIOSO, contenido: '<p>hola</p>' }, docFalso);

    const iframe = visor.hijos[0];
    assert.equal(iframe.title, NOMBRE_MALICIOSO,
        'el título debe ser el nombre completo, sin recortar');
});

test('el srcdoc recibe el HTML crudo, sin escapar', () => {
    // srcdoc está hecho para recibir HTML. Escaparlo y que el navegador lo
    // decode es un doble trabajo que se cancela solo.
    const visor = crearElemento();
    const html = '<p class="nota">hola <b>mundo</b></p>';
    mostrarHtml(visor, { nombre: 'Informe', contenido: html }, docFalso);

    assert.equal(visor.hijos[0].atributos.srcdoc, html);
});

test('el iframe queda con sandbox para que el contenido no sea la página', () => {
    const visor = crearElemento();
    mostrarHtml(visor, { nombre: 'Informe', contenido: '<p>hola</p>' }, docFalso);

    const sandbox = visor.hijos[0].atributos.sandbox;
    assert.ok(sandbox, 'falta el atributo sandbox');
    assert.ok(sandbox.includes('allow-scripts'),
        'un HTML subido por el usuario puede llevar scripts propios');
});

// ---------- Robustez ----------

test('no rompe si el documento no tiene contenido', () => {
    const visor = crearElemento();
    assert.doesNotThrow(() =>
        mostrarHtml(visor, { nombre: 'Informe', contenido: '' }, docFalso));
});

test('no rompe si el visor es null', () => {
    assert.doesNotThrow(() => mostrarHtml(null, { nombre: 'x', contenido: 'y' }, docFalso));
});

// ---------- Ningún archivo de la app puede repetir el error ----------
//
// Esto antes miraba **un** archivo: `js/app.js`. Y el problema de eso solo se ve
// el día que algo se muda: el test sigue en verde, mirando un archivo donde ya
// no vive el código.
//
// Es un modo de fallo silencioso, y es el peor. La red se corre, pasa, y no
// está vigilando. Para que eso no pueda pasar, los archivos se listan, y la
// lista se declara acá, junto a los tests.
//
// Los archivos que todavía no existen están en la lista a propósito: cuando se
// creen en la spec 006, la red ya los está mirando. Si se olvidaran, el XSS
// vuelve sin que nadie lo note.

const ARCHIVOS_DE_LA_APP = [
    'js/app.js',
    'js/interfaz/pdf.js',            // spec 006, todavía no existe
    'js/interfaz/documento.js'       // spec 006, todavía no existe
];

function leerSiExiste(relativo) {
    const completo = path.join(__dirname, '..', relativo);
    if (!fs.existsSync(completo)) return null;
    return fs.readFileSync(completo, 'utf8');
}

test('ningún archivo de la app interpola el nombre del documento en un innerHTML', () => {
    for (const relativo of ARCHIVOS_DE_LA_APP) {
        const codigo = leerSiExiste(relativo);
        if (codigo === null) continue;   // todavía no se creó

        // La forma peligrosa: un innerHTML con ${...nombre} adentro.
        const innerHTML = [...codigo.matchAll(/innerHTML\s*=\s*`([\s\S]*?)`/g)]
            .map(m => m[1]);

        for (const bloque of innerHTML) {
            assert.ok(!/\$\{[^}]*nombre[^}]*\}/i.test(bloque),
                relativo + ' tiene un nombre interpolado dentro de un '
                + 'innerHTML:\n' + bloque.slice(0, 160));
        }
    }
});

test('ningún archivo de la app crea iframes escribiendo el title a mano', () => {
    for (const relativo of ARCHIVOS_DE_LA_APP) {
        const codigo = leerSiExiste(relativo);
        if (codigo === null) continue;

        assert.ok(!/title="\$\{/.test(codigo),
            relativo + ' arma el atributo title con una plantilla');
    }
});

// ---------- La red tiene que ver lo que dice vigilar ----------

test('la red de arriba mira los archivos que dice mirar', () => {
    // Si esta lista pudiera crecer sin que las redes la miren, ampliar la
    // vigilancia sería de mentira. Este test lee la lista del archivo y
    // comprueba que, por lo menos, hay archivos además de `app.js`.
    const codigo = fs.readFileSync(path.join(__dirname, 'visor.test.js'), 'utf8');
    const bloque = codigo.match(/const ARCHIVOS_DE_LA_APP = \[([\s\S]*?)\]/);

    assert.ok(bloque, 'no se encontró la lista de archivos');

    const entradas = [...bloque[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

    assert.ok(entradas.length >= 2,
        'la lista tiene un solo archivo: ampliar la red no serviría de nada');

    for (const relativo of entradas) {
        assert.ok(/^js\//.test(relativo),
            relativo + ' no es un archivo de la aplicación');
    }
});

test('un XSS en un archivo de la lista se detecta', () => {
    // La prueba de que la red sirve. Se crea un archivo de la lista con el
    // error que la red busca, y tiene que saltar.
    //
    // Sin esto, "amplié la red a tres archivos" es una afirmación sin respaldo:
    // nadie sabe si la red realmente mira los archivos nuevos.
    const relativo = 'js/interfaz/pdf.js';
    const completo = path.join(__dirname, '..', relativo);

    if (fs.existsSync(completo)) {
        assert.fail(relativo + ' ya existe: esta prueba necesita un archivo '
            + 'que todavía no esté creado. Elegí otro nombre para la lista.');
    }

    fs.mkdirSync(path.dirname(completo), { recursive: true });
    fs.writeFileSync(completo,
        'const d = { nombre: "x" };\n'
        + 'el.innerHTML = `<p>${d.nombre}</p>`;\n', 'utf8');

    try {
        const codigo = fs.readFileSync(completo, 'utf8');
        const innerHTML = [...codigo.matchAll(/innerHTML\s*=\s*`([\s\S]*?)`/g)]
            .map(m => m[1]);
        const peligroso = innerHTML.some(bloque =>
            /\$\{[^}]*nombre[^}]*\}/i.test(bloque));

        assert.ok(peligroso,
            'la red NO detectó el XSS que se acaba de escribir. Si esto falla, '
            + 'la red está mal y no sirve de nada.');
    } finally {
        fs.unlinkSync(completo);
    }
});
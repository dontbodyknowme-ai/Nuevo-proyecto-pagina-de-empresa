// ============================================ TESTS — El aviso de datos con problemas
// Ejecutar: node --test
// Cubre: principio 5 (los datos son sagrados)
// Ver: specs/003-refactor-app/task.md (T6)
// ============================================
//
// Cuando un respaldo importado trae datos raros, el usuario tiene que enterarse
// sin que la app se caiga y sin que se le pida permiso para nada.
//
// Decisiones que se fijan acá:
//
//   - El aviso **no bloquea**. Nada de `alert()`: la app arranca igual.
//   - El aviso **no borra**. Solo informa qué encontró.
//   - El aviso **se puede cerrar** y no vuelve a aparecer en esa sesión.
//
// Por eso existe `reconstruirAviso`: el módulo no decide qué decir. Eso es de
// `js/logica/datos.js`, que ya está probado por su cuenta.

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Un DOM mínimo, como el de test/navegador.test.js pero más chico.
function crearElemento(tag) {
    const el = {
        tagName: String(tag).toUpperCase(),
        className: '',
        textContent: '',
        title: '',
        hidden: false,
        dataset: {},
        hijos: [],
        atributos: {},
        oyentes: {},
        setAttribute(k, v) {
            this.atributos[k] = v;
            if (k === 'hidden') this.hidden = true;
        },
        getAttribute(k) { return this.atributos[k] ?? null; },
        removeAttribute(k) {
            delete this.atributos[k];
            if (k === 'hidden') this.hidden = false;
        },
        hasAttribute(k) { return k in this.atributos; },
        appendChild(h) { this.hijos.push(h); return h; },
        removeChild(h) {
            const i = this.hijos.indexOf(h);
            if (i >= 0) this.hijos.splice(i, 1);
        },
        addEventListener(ev, fn) { (this.oyentes[ev] ||= []).push(fn); },
        removeEventListener() {},
        click() { (this.oyentes.click || []).forEach(fn => fn({ type: 'click' })); },
        querySelectorAll() { return []; }
    };

    // En el navegador todo elemento tiene `ownerDocument`, y es de ahí de donde
    // salen los hijos. Sin esto, el módulo caería a `globalThis.document`, que
    // en Node no existe.
    el.ownerDocument = { createElement: crearElemento };

    return el;
}

const { mostrarAviso, ocultarAviso, reconstruirAviso } =
    require('../js/interfaz/aviso.js');

/**
 * Si el elemento tiene el atributo `hidden` o el `hidden` de HTML5.
 *
 * Vivía en `js/interfaz/aviso.js` y la app no la llamaba nunca: solo la usaba
 * este archivo, diecisiete veces. Código de producción que la producción no
 * usa son tests en el lugar equivocado, así que se mudó acá, que es donde
 * hace falta. Ver T6.
 */
function estaOculto(aviso) {
    if (!aviso) return true;
    return aviso.hidden === true || aviso.hasAttribute?.('hidden') === true;
}

function hacerAviso() {
    return crearElemento('div');
}

/** Los botones del aviso, estén donde estén (van como hijos directos). */
function botonesDe(aviso) {
    const buscar = elemento => {
        const encontrados = (elemento.hijos || []).filter(h => h.tagName === 'BUTTON');
        for (const h of elemento.hijos || []) {
            encontrados.push(...buscar(h));
        }
        return encontrados;
    };
    return buscar(aviso);
}

/** Todos los textos pintados, en cualquier nivel. */
function textosDe(aviso) {
    const juntar = elemento => {
        let texto = elemento.textContent || '';
        for (const h of elemento.hijos || []) texto += ' ' + juntar(h);
        return texto;
    };
    return juntar(aviso);
}

// ---------- El texto del resumen lo decide reconstruirAviso ----------
//
// Estas reglas antes se probaban en `test/datos.test.js`, contra
// `resumenDeProblemas()`, una función de `js/logica/datos.js` que armaba
// **exactamente las mismas cadenas** y que no usaba nadie. El cartel real lo
// arma `reconstruirAviso()`.
//
// O sea que las reglas estaban fijadas contra el código muerto y no contra el
// vivo: si `reconstruirAviso` escribía otra cosa, ningún test se enteraba.
// `test/aviso.test.js` solo comprobaba que el resumen que se le pasaba en mano
// se mostrara, no que el resumen se armara bien. Ver T6.

test('el resumen cuenta cuántos problemas encontró', () => {
    const problemas = [
        { tipo: 'x', mensaje: 'el primero' },
        { tipo: 'y', mensaje: 'el segundo' }
    ];

    const r = reconstruirAviso(problemas);

    assert.ok(r.resumen.includes('2'),
        'tiene que decir cuántos encontró: ' + r.resumen);
    assert.ok(r.resumen.includes('problemas'),
        'con dos, la palabra va en plural: ' + r.resumen);
});

test('con un solo problema la palabra va en singular', () => {
    const r = reconstruirAviso([{ tipo: 'x', mensaje: 'uno solo' }]);

    assert.ok(r.resumen.includes('1 problema'), r.resumen);
    assert.ok(!r.resumen.includes('1 problemas'),
        'no puede decir "1 problemas": ' + r.resumen);
});

test('el resumen aclara siempre que no se borró nada', () => {
    // La regla más importante del cartel: el usuario tiene que poder decidir
    // con la información completa, y esa información incluye que sus datos
    // siguen ahí. Si alguien lee "se encontraron 3 problemas" y no entiende
    // que no se perdió nada, va a exportar y borrar todo.
    const conProblemas = reconstruirAviso([
        { tipo: 'x', mensaje: 'a' }, { tipo: 'y', mensaje: 'b' }
    ]);
    const conUno = reconstruirAviso([{ tipo: 'x', mensaje: 'a' }]);

    for (const r of [conProblemas, conUno]) {
        assert.ok(r.resumen.toLowerCase().includes('no se borr'),
            'no aclara que no se borró nada: ' + r.resumen);
    }
});

test('sin problemas el resumen lo dice', () => {
    assert.equal(reconstruirAviso([]).resumen, 'Todo está bien.');
    assert.equal(reconstruirAviso(null).resumen, 'Todo está bien.');
});

test('el resumen cuenta solo los problemas que se van a mostrar', () => {
    // Si el filtro descarta un problema porque vino roto, el número tiene que
    // ser el de los que quedan. Si no, el cartel dice "2" y lista uno.
    const r = reconstruirAviso([
        { tipo: 'x', mensaje: 'este se muestra' },
        { tipo: 'y' },
        null
    ]);

    assert.equal(r.problemas.length, 1);
    assert.ok(r.resumen.includes('1 problema'),
        'el número tiene que ser el de los problemas que se muestran: '
        + r.resumen);
});

// ---------- Sin problemas: no aparece nada ----------


test('sin problemas el aviso queda oculto', () => {
    const aviso = hacerAviso();
    mostrarAviso(aviso, { resumen: 'Todo está bien.', problemas: [] });

    assert.equal(estaOculto(aviso), true);
    assert.equal(aviso.hijos.length, 0, 'no pinta nada');
});

test('algo que no es lista de problemas tampoco rompe', () => {
    const aviso = hacerAviso();
    for (const valor of [null, undefined, 'texto', 42]) {
        assert.doesNotThrow(() => mostrarAviso(aviso, { resumen: 'x', problemas: valor }));
        assert.equal(estaOculto(aviso), true);
    }
});

// ---------- Con problemas: aparece y los lista ----------

test('con problemas el aviso se muestra', () => {
    const aviso = hacerAviso();
    mostrarAviso(aviso, {
        resumen: 'Se encontraron 2 problemas en tus datos.',
        problemas: [
            { tipo: 'materia-sin-documentos', mensaje: 'La materia "Rota" no traía lista de documentos.' },
            { tipo: 'documento-sin-contenido', mensaje: 'A "Apuntes.pdf" le falta el contenido.' }
        ]
    });

    assert.equal(estaOculto(aviso), false, 'tiene que verse');
});

test('el aviso lista un elemento por problema', () => {
    const aviso = hacerAviso();
    mostrarAviso(aviso, {
        resumen: 'r',
        problemas: [
            { tipo: 'a', mensaje: 'primero' },
            { tipo: 'b', mensaje: 'segundo' },
            { tipo: 'c', mensaje: 'tercero' }
        ]
    });

    const todo = textosDe(aviso);
    assert.ok(todo.includes('primero'), 'no listó el primero: ' + todo);
    assert.ok(todo.includes('segundo'), 'no listó el segundo');
    assert.ok(todo.includes('tercero'), 'no listó el tercero');
});

test('el resumen dice que no se borró nada', () => {
    // Es lo más importante del aviso: el usuario tiene que saber que sus
    // datos siguen ahí antes de decidir qué hacer.
    const aviso = hacerAviso();
    mostrarAviso(aviso, {
        resumen: 'Se encontraron 1 problema. Se conserva todo: no se borró nada.',
        problemas: [{ tipo: 'x', mensaje: 'algo' }]
    });

    assert.ok(textosDe(aviso).toLowerCase().includes('borr'),
        'el aviso no aclara que no se borró nada');
});

test('cada problema se pinta como texto, nunca como marcado', () => {
    // Un nombre de archivo puede traer "<script>". Va por textContent.
    const aviso = hacerAviso();
    mostrarAviso(aviso, {
        resumen: 'r',
        problemas: [{ tipo: 'x', mensaje: 'A "<img src=x onerror=alert(1)>" le falta el contenido.' }]
    });

    assert.equal(aviso.innerHTML, undefined,
        'el aviso no debe usar innerHTML en ningún momento');
});

// ---------- El botón de cerrar ----------

test('el aviso tiene un botón para cerrarlo', () => {
    const aviso = hacerAviso();
    mostrarAviso(aviso, { resumen: 'r', problemas: [{ tipo: 'x', mensaje: 'algo' }] });

    const botones = botonesDe(aviso);

    assert.ok(botones.length >= 1, 'no hay ningún botón');
    assert.ok(botones.some(b => /cerrar|entendido|ok/i.test(b.textContent)),
        'el botón no dice para qué es: ' + botones.map(b => b.textContent).join(', '));
});

test('cerrar el aviso lo oculta', () => {
    const aviso = hacerAviso();
    mostrarAviso(aviso, { resumen: 'r', problemas: [{ tipo: 'x', mensaje: 'algo' }] });
    assert.equal(estaOculto(aviso), false);

    const boton = botonesDe(aviso)[0];

    boton.click();

    assert.equal(estaOculto(aviso), true, 'el click no lo ocultó');
});

test('cerrar el aviso borra lo que estaba pintado', () => {
    // Si no se limpia, el siguiente aviso aparecería con los problemas
    // anteriores pegados arriba.
    const aviso = hacerAviso();
    mostrarAviso(aviso, { resumen: 'r', problemas: [{ tipo: 'x', mensaje: 'algo' }] });
    botonesDe(aviso)[0].click();

    assert.equal(aviso.hijos.length, 0, 'quedó contenido pintado');
});

test('después de cerrar, un aviso nuevo se puede volver a mostrar', () => {
    const aviso = hacerAviso();

    mostrarAviso(aviso, { resumen: 'r', problemas: [{ tipo: 'x', mensaje: 'algo' }] });
    botonesDe(aviso)[0].click();

    mostrarAviso(aviso, { resumen: 'r2', problemas: [{ tipo: 'y', mensaje: 'otro' }] });

    assert.equal(estaOculto(aviso), false, 'no se volvió a mostrar');
});

test('el botón de cerrar no queda acumulado entre avisos', () => {
    const aviso = hacerAviso();

    mostrarAviso(aviso, { resumen: 'r', problemas: [{ tipo: 'x', mensaje: 'a' }] });
    botonesDe(aviso)[0].click();
    mostrarAviso(aviso, { resumen: 'r', problemas: [{ tipo: 'y', mensaje: 'b' }] });

    const botones = botonesDe(aviso);
    assert.equal(botones.length, 1, 'hay ' + botones.length + ' botones; debería haber 1');
});

// ---------- Ocultar y mostrar a mano ----------

test('ocultarAviso vacía y esconde', () => {
    const aviso = hacerAviso();
    mostrarAviso(aviso, { resumen: 'r', problemas: [{ tipo: 'x', mensaje: 'algo' }] });

    ocultarAviso(aviso);

    assert.equal(estaOculto(aviso), true);
    assert.equal(aviso.hijos.length, 0);
});

// Aquí estaban los dos tests de `estaOculto`: uno por el atributo y otro por
// que no explotara con basura. Los dos probaban la función que acaba de mudarse
// a este archivo, así que ahora probarían al ayudante de acá. Un test que
// prueba código de test no dice nada: se borran. Lo que queda de verdad —que
// `mostrarAviso` y `ocultarAviso` dejen el elemento en el estado correcto— lo
// fijan los tests de más arriba, que usan el ayudante como forma de preguntar.
// Ver T6.

// ---------- La parte que calcula no se mete acá ----------

test('reconstruirAviso solo arma el texto, no toca la pantalla', () => {
    const r = reconstruirAviso([
        { tipo: 'materia-sin-documentos', mensaje: 'La materia "Rota" no traía lista.' }
    ]);

    assert.equal(typeof r.resumen, 'string');
    assert.ok(Array.isArray(r.problemas));
    assert.equal(r.problemas.length, 1);
    assert.equal(r.problemas[0].mensaje, 'La materia "Rota" no traía lista.');
});

test('reconstruirAviso con una lista vacía no rompe', () => {
    const r = reconstruirAviso([]);
    assert.equal(typeof r.resumen, 'string');
    assert.equal(r.problemas.length, 0);
});

test('reconstruirAviso aguanta basura sin inventarse problemas', () => {
    // Que no se invente mensajes: si el problema no vino bien, mejor no
    // mostrarlo que mostrar algo que el usuario no puede entender.
    const r = reconstruirAviso([null, undefined, 'texto', 42, {}]);

    for (const p of r.problemas) {
        assert.equal(typeof p.mensaje, 'string');
        assert.ok(p.mensaje.length > 0);
    }
});

// ---------- No toca nada global ----------

test('el módulo no busca cosas en el document por su cuenta', () => {
    const g = globalThis;
    const antes = { document: g.document, window: g.window };
    delete g.document;
    delete g.window;

    try {
        const aviso = crearElemento('div');
        mostrarAviso(aviso, { resumen: 'r', problemas: [{ tipo: 'x', mensaje: 'algo' }] });
        assert.equal(estaOculto(aviso), false);
    } finally {
        if (antes.document) g.document = antes.document;
        if (antes.window) g.window = antes.window;
    }
});
// ============================================
// TESTS — Qué se muestra al cambiar de vista
// Ejecutar: node --test
// Cubre: RF-5, RF-6
// Ver: specs/002-layout-calendario/spec.md
// ============================================
//
// Estos tests usan un DOM mínimo y falso: no hay navegador ni pantalla.
//
// Comprueban dos cosas:
//
//  1. Que aplicar la visibilidad muestre y oculte los elementos correctos.
//  2. Que el código NO mida nada para decidir: no lee el ancho de la
//     ventana y no pisa `display`.
//
// El punto 2 importa. La geometría la resuelven las hojas de estilo
// (RNF-4). Si esta función midiera la pantalla, habría dos fuentes de
// verdad para los umbrales y terminarían discrepando.
//
// La primera versión de este archivo definía su propia copia de la función
// y se probaba a sí misma. Noservía de nada. Ahora se carga el módulo real.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { aplicarVisibilidad } = require('../js/interfaz/visibilidad.js');
const { elementosVisibles } = require('../js/logica/layout.js');

// ---------- Un DOM mínimo, solo el que necesita el calendario ----------

function crearElemento(tag = 'div') {
    const el = {
        tagName: String(tag).toUpperCase(),
        id: '',
        className: '',
        hidden: false,
        style: {},
        dataset: {},
        hijos: [],
        atributos: {},
        oyentes: {},
        classList: {
            _c: new Set(),
            add(...c) { c.forEach(x => this._c.add(x)); el.className = [...this._c].join(' '); },
            remove(...c) { c.forEach(x => this._c.delete(x)); el.className = [...this._c].join(' '); },
            toggle(c, f) { const p = f === undefined ? !this._c.has(c) : f;
                           if (p) this._c.add(c); else this._c.delete(c);
                           el.className = [...this._c].join(' '); return p; },
            contains(c) { return this._c.has(c); }
        },
        appendChild(h) { el.hijos.push(h); return h; },
        removeChild(h) { const i = el.hijos.indexOf(h); if (i >= 0) el.hijos.splice(i, 1); },
        setAttribute(k, v) { el.atributos[k] = v; },
        getAttribute(k) { return el.atributos[k] ?? null; },
        removeAttribute(k) { delete el.atributos[k]; },
        addEventListener(ev, fn) { (el.oyentes[ev] ||= []).push(fn); },
        removeEventListener() {},
        click() { (el.oyentes.click || []).forEach(fn => fn()); }
    };
    return el;
}

// Arma un documento falso con los selectores que consulta el módulo real
function montar() {
    const nav = crearElemento();
    nav.className = 'calendario-nav';
    const leyenda = crearElemento();
    leyenda.className = 'calendario-leyenda';
    const panel = crearElemento();
    panel.className = 'calendario-panel';

    const alternar = crearElemento('button');
    alternar.id = 'btnAlternarVista';
    const cerrar = crearElemento('button');
    cerrar.id = 'btnCerrarCalendario';

    const porId = { btnAlternarVista: alternar, btnCerrarCalendario: cerrar };

    const document = {
        getElementById: id => porId[id] ?? null,
        querySelector: sel => ({
            '.calendario-nav': nav,
            '.calendario-leyenda': leyenda,
            '.calendario-panel': panel
        })[sel] ?? null,
        createElement: crearElemento,
        addEventListener() {}
    };

    return { document, nav, leyenda, panel, alternar, cerrar };
}

// ---------- RF-5 · lo que se muestra en cada vista ----------

test('RF-5 · en la vista mapa se ocultan la navegación y la leyenda', () => {
    const dom = montar();
    aplicarVisibilidad('mapa', dom.document);

    assert.equal(dom.nav.hidden, true);
    assert.equal(dom.leyenda.hidden, true);
});

test('RF-5 · en la vista calendario se muestran las dos', () => {
    const dom = montar();
    aplicarVisibilidad('calendario', dom.document);

    assert.equal(dom.nav.hidden, false);
    assert.equal(dom.leyenda.hidden, false);
});

test('RF-5 · en la vista mapa el panel de anotaciones queda oculto', () => {
    const dom = montar();
    aplicarVisibilidad('mapa', dom.document);
    assert.equal(dom.panel.hidden, true);
});

test('RF-5 · en la vista calendario el panel se muestra', () => {
    const dom = montar();
    aplicarVisibilidad('calendario', dom.document);
    assert.equal(dom.panel.hidden, false);
});

test('RF-5 · alternar ida y vuelta deja siempre el estado correcto', () => {
    const dom = montar();

    for (let i = 0; i < 6; i++) {
        aplicarVisibilidad('mapa', dom.document);
        assert.equal(dom.nav.hidden, true, 'vuelta ' + i);
        assert.equal(dom.leyenda.hidden, true, 'vuelta ' + i);
        assert.equal(dom.panel.hidden, true, 'vuelta ' + i);

        aplicarVisibilidad('calendario', dom.document);
        assert.equal(dom.nav.hidden, false, 'vuelta ' + i);
        assert.equal(dom.leyenda.hidden, false, 'vuelta ' + i);
        assert.equal(dom.panel.hidden, false, 'vuelta ' + i);
    }
});

test('RF-5 · una vista desconocida no oculta el chrome', () => {
    const dom = montar();
    aplicarVisibilidad('no-existe', dom.document);

    assert.equal(dom.nav.hidden, false);
    assert.equal(dom.leyenda.hidden, false);
    assert.equal(dom.panel.hidden, false);
});

// ---------- RNF-4 · el código no mide nada para decidir ----------

test('RNF-4 · aplicar la visibilidad no lee el ancho de la ventana', () => {
    const dom = montar();

    // Si el código midiera la pantalla para decidir, esto reventaría.
    globalThis.innerWidth = undefined;
    Object.defineProperty(globalThis, 'innerWidth', {
        configurable: true,
        get() { throw new Error('el codigo no debe leer innerWidth'); }
    });

    try {
        assert.doesNotThrow(() => aplicarVisibilidad('mapa', dom.document));
    } finally {
        delete globalThis.innerWidth;
    }
});

test('RNF-4 · oculta con el atributo hidden y no pisando display', () => {
    const dom = montar();

    // La hoja de estilos puso display: flex. Si el código lo pisara,
    // la hoja de estilos dejaría de tener el control de la presentacion.
    dom.nav.style.display = 'flex';
    dom.leyenda.style.display = 'flex';

    aplicarVisibilidad('mapa', dom.document);

    assert.equal(dom.nav.style.display, 'flex', 'no debe pisar display');
    assert.equal(dom.nav.hidden, true, 'debe usar hidden');
    assert.equal(dom.leyenda.style.display, 'flex');
    assert.equal(dom.leyenda.hidden, true);
});

test('RNF-4 · no escribe innerHTML en ningun caso', () => {
    const dom = montar();
    let intento = false;
    Object.defineProperty(dom.nav, 'innerHTML', {
        set() { intento = true; },
        get() { return ''; }
    });

    aplicarVisibilidad('mapa', dom.document);
    assert.equal(intento, false, 'el dato del usuario nunca pasa por innerHTML');
});

// ---------- RNF-3 · la decisión viene de la lógica pura ----------

test('RNF-3 · lo que se aplica coincide con lo que dice la lógica pura', () => {
    for (const vista of ['mapa', 'calendario']) {
        const dom = montar();
        const esperado = elementosVisibles(vista);

        const aplicado = aplicarVisibilidad(vista, dom.document);

        assert.deepEqual(aplicado, esperado);
        assert.equal(dom.nav.hidden, !esperado.navMes);
        assert.equal(dom.leyenda.hidden, !esperado.leyendaAnotaciones);
        assert.equal(dom.panel.hidden, !esperado.panelAnotaciones);
    }
});

// ---------- Tolerancia a un DOM incompleto ----------

test('el módulo no rompe si falta algún elemento del DOM', () => {
    const document = {
        querySelector: () => null,
        getElementById: () => null
    };

    assert.doesNotThrow(() => aplicarVisibilidad('mapa', document));
});
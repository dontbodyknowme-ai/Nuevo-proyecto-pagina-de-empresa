// ============================================
// Un navegador falso, para probar el código de la app en Node
// ============================================
//
// `js/app.js` no se puede probar con `require` a secas: al cargarse toca
// `document` y aborta. Para probarlo hay que darle un navegador que no exista.
//
// Este módulo arma ese navegador. Antes estaba metido dentro de
// `test/navegador.test.js` y no lo podía usar nadie más, así que cualquier test
// del `app.js` que no sea ese tenía dos salidas: no probar el `app.js`, o
// inventarse su propio DOM falso. Las dos son malas.
//
// No es un DOM. Es lo mínimo que la app necesita: los métodos que llama, con el
// comportamiento que espera. **Si la app empieza a usar algo que no está acá,
// el test se cae**, que es justo lo que hay que pasar.
//
// Lo que NO hace, y hay que saber:
//
//   - No aplica CSS. No hay geometría, ni cascada, ni `getComputedStyle`.
//   - `classList`, `dataset` y `style` son objetos vacíos que se comportan bien
//     pero no tienen reglas.
//   - No hay eventos reales: `addEventListener` guarda y `dispatchEvent` llama.
//
// Lo que avisa de una inadequacy: cuando algo no está y el test falla, el
// mensaje dice "no se encontró", no "es undefined". Un fallo así es más fácil
// de entender que un `TypeError`.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');

// Los scripts de la app, en el mismo orden que `index.html`.
//
// El número va en `ORDEN.length`, no acá: un número escrito en un comentario no
// se actualiza solo, y hace creer que la lista es más corta de lo que es. Ya
// pasó dos veces.
//
// El orden importa: los módulos de lógica tienen que estar cargados antes que
// `app.js`, porque él los usa al arrancar. Hay un test en `navegador.test.js`
// que compara esta lista con `index.html` y falla si se desincronizan.

const ORDEN = [
    'js/logica/mapa-calor.js',
    'js/logica/almacenamiento.js',
    'js/logica/consentimiento.js',
    'js/datos/secciones.js',
    'js/logica/layout.js',
    'js/logica/fechas.js',
    'js/logica/anotaciones.js',
    'js/logica/calendario.js',
    'js/logica/estadisticas.js',
    'js/logica/arbol.js',
    'js/logica/datos.js',
    'js/interfaz/aviso.js',
    'js/interfaz/mapa-calor.js',
    'js/interfaz/visibilidad.js',
    'js/interfaz/visor.js',
    'js/app.js',
    'js/inicio-calendario.js'
];

// Todos los ids que `index.html` define y que `app.js` busca al arrancar.
//
// Si falta uno, `app.js` aborta al tocarlo y no llega a publicar su API, que es
// justo lo que estos tests quieren comprobar.

const IDS = [
    'anotacionesExistentes', 'arbolNavegacion', 'breadcrumbs',
    'btnAddMateria', 'btnCalendario', 'btnCancelarMateria',
    'btnCerrarCalendario', 'btnConfig', 'btnCrearMateria',
    'btnExportar', 'btnGuardarAnotacion', 'btnImportar',
    'btnIniciar', 'btnIrMes', 'btnLectura', 'btnPausar',
    'btnReiniciar', 'btnToggle', 'btnAlternarVista',
    'calendarioGrid', 'calendarioMapa', 'mapaCalor', 'mapaDetalle',
    'descripcionAnotacion', 'dropZone', 'inputAnio', 'inputArchivo',
    'inputImportar', 'inputMateriaNombre', 'inputMes',
    'menuDesplegable', 'menuLateral', 'menuRespaldo',
    'modalCalendario', 'modalMateria',
    'panelFecha', 'pdfCanvas', 'pdfContainer', 'pdfNext',
    'pdfPageInfo', 'pdfPrev', 'pdfZoomIn', 'pdfZoomLevel', 'pdfZoomOut',
    'pomodoroTiempo', 'pomodoroWidget', 'statsContainer',
    'tipoAnotacion', 'visor'
];

// ---------- El DOM mínimo ----------

function crearElemento(tag) {
    const el = {
        tagName: String(tag).toUpperCase(),
        className: '',
        id: '',
        textContent: '',
        title: '',
        value: '',
        disabled: false,
        style: {},
        dataset: {},
        hijos: [],
        // `innerHTML` se vacía de verdad.
        //
        // Antes era una propiedad cualquiera: asignarle `''` no borraba nada, y
        // como `generarCalendario()` empieza con `calendarioGrid.innerHTML = ''`
        // para limpiar antes de dibujar, **cada llamada agregaba las celdas
        // encima de las anteriores**.
        //
        // No daba error: daba el doble. Un mes de 31 días con el calendario
        // abierto y navegado tenía 62 celdas, y el test leía 62. En el
        // navegador son 31.
        //
        // Asignar algo que no sea `''` se guarda pero **no se dibuja**: este no
        // es un navegador. El proyecto solo usa `innerHTML` para markup estático
        // y, sobre todo, para vaciar.
        innerHTML: '',
        atributos: {},
        oyentes: {},
        classList: null,   // se arma abajo, cuando clasesDe ya existe
        appendChild(hijo) { el.hijos.push(hijo); return hijo; },
        removeChild(hijo) {
            const i = el.hijos.indexOf(hijo);
            if (i >= 0) el.hijos.splice(i, 1);
        },
        setAttribute(k, v) { el.atributos[k] = v; },
        getAttribute(k) { return el.atributos[k] ?? null; },
        removeAttribute(k) { delete el.atributos[k]; },
        addEventListener(ev, fn) { (el.oyentes[ev] ||= []).push(fn); },
        removeEventListener() {},
        dispatchEvent(ev) {
            (el.oyentes[ev.type] || []).forEach(fn => fn(ev));
            return true;
        },
        querySelector(sel) { return el.querySelectorAll(sel)[0] ?? null; },
        querySelectorAll(sel) { return buscar(el, sel); },
        focus() {}, click() { el.dispatchEvent({ type: 'click' }); }
    };

    // classList lee el className que ya tiene el elemento, en vez de llevar
    // su propia cuenta.
    //
    // Antes llevaba un Set aparte que empezaba vacío. El resultado: si el
    // código hacía celda.className = 'celda-dia' y después
    // celda.classList.add('hoy'), el className quedaba **solo** 'hoy' y el
    // elemento dejaba de matchear .celda-dia. En el navegador eso no pasa:
    // classList.add suma.
    //
    // Apareció al probar el calendario con este arnés: faltaban dos días de la
    // rejilla, y eran justo los dos que tenían clases agregadas.
    const clasesDe = () => String(el.className || '').split(/\s+/).filter(Boolean);
    el.classList = {
        add(...cs) {
            const s = new Set(clasesDe());
            cs.forEach(c => s.add(c));
            el.className = [...s].join(' ');
        },
        remove(...cs) {
            const s = new Set(clasesDe());
            cs.forEach(c => s.delete(c));
            el.className = [...s].join(' ');
        },
        toggle(c, forzar) {
            const s = new Set(clasesDe());
            const poner = forzar === undefined ? !s.has(c) : forzar;
            if (poner) s.add(c); else s.delete(c);
            el.className = [...s].join(' ');
            return poner;
        },
        contains(c) { return clasesDe().includes(c); }
    };

    // Vaciar por `innerHTML` es lo único que este arnés sabe hacer con esa
    // propiedad. Se define después del literal, igual que `classList`, porque
    // necesita el `el` ya armado.
    let _html = '';
    Object.defineProperty(el, 'innerHTML', {
        enumerable: true,
        get() { return _html; },
        set(valor) {
            _html = valor;
            if (valor === '') el.hijos.length = 0;
        }
    });

    return el;
}

// Un nodo de texto. El navegador lo tiene, y el mock lo necesita desde que
// `construirArbol()` armó el mensaje de "no hay materias" con nodos de texto en
// vez de con un `innerHTML`: así el texto del usuario nunca pasa por marcado.
function crearNodoTexto(texto) {
    return {
        nodeType: 3,
        nodeName: '#text',
        nodeValue: String(texto),
        get textContent() { return this.nodeValue; },
        set textContent(v) { this.nodeValue = String(v); }
    };
}

// Busca por clase o por id, en profundidad
function buscar(raiz, sel) {
    const clases = sel.replace(/^\./, '').split('.');
    const resultados = [];

    (function recorrer(nodo) {
        for (const hijo of nodo.hijos || []) {
            const clasesHijo = String(hijo.className || '').split(/\s+/);
            const coincide = clases.every(c => clasesHijo.includes(c))
                || hijo.id === sel.replace(/^#/, '');
            if (coincide) resultados.push(hijo);
            recorrer(hijo);
        }
    })(raiz);
    return resultados;
}

// ---------- El almacenamiento falso ----------

// Las claves van **como propiedades del objeto**, y no adentro de un `_d`.
//
// Antes estaban en `_d`, y eso estaba mal: `guardarDatos()` mide lo que ocupa
// con `for (const llave in localStorage)`, que en el mock no veía ninguna clave
// guardada. `usoActual` daba siempre 0, así que **la comprobación de capacidad
// nunca se ejecutaba** y ningún test pasaba por el camino del almacenamiento
// lleno. Ver MEMORY.md.
//
// Los métodos van no-enumerables para que no cuenten como datos. Y
// escribibles, para que los tests puedan romperlos.

function crearAlmacenamiento(datos = {}) {
    const almacen = { ...datos };
    Object.defineProperties(almacen, {
        getItem: {
            enumerable: false, writable: true, configurable: true,
            value(k) { return this[k] === undefined ? null : this[k]; }
        },
        setItem: {
            enumerable: false, writable: true, configurable: true,
            value(k, v) { this[k] = String(v); }
        },
        removeItem: {
            enumerable: false, writable: true, configurable: true,
            value(k) { delete this[k]; }
        },
        hasOwnProperty: {
            enumerable: false, writable: true, configurable: true,
            value(k) { return Object.prototype.hasOwnProperty.call(this, k); }
        }
    });
    return almacen;
}

// Rompe un método del almacenamiento, para probar los caminos de error.
//
// Devuelve la función que **lo deja como estaba**. Todos los métodos se
// declaran como `writable` justamente para esto: el test rompe, mira, y
// devuelve el almacenamiento a su estado antes de que corra el test siguiente.

function romper(contexto, metodo, mensaje) {
    const original = contexto.localStorage[metodo];
    contexto.localStorage[metodo] = function () {
        throw new Error(mensaje || 'no se pudo escribir');
    };
    return () => { contexto.localStorage[metodo] = original; };
}

// ---------- El contexto ----------

/**
 * Monta un navegador falso y carga los scripts en orden.
 *
 * @param {object} datosAlmacenamiento - lo que hay en `localStorage` al arrancar
 * @returns {{contexto, errores}} el contexto, y los errores que se ven al cargar
 */
function cargarComoNavegador(datosAlmacenamiento = {}) {
    const almacen = crearAlmacenamiento(datosAlmacenamiento);
    const cuerpo = crearElemento('body');

    const errores = [];

    // `getElementById` tiene que devolver **siempre el mismo** elemento para un
    // id dado, como en el navegador.
    //
    // Antes devolvía uno nuevo en cada llamada, y eso rompía cualquier prueba de
    // comportamiento: `app.js` guarda `btnGuardarAnotacion` al arrancar, y si el
    // test lo busca después recibe **otro objeto**. Lo que la app cambió no se
    // veía. Con la caché, el test mira el mismo nodo que la app.
    //
    // Consecuencia: el estado ahora se comparte entre llamadas, que es lo
    // correcto.
    const porId = new Map();
    const pedirPorId = (id) => {
        if (!IDS.includes(id)) return null;
        if (!porId.has(id)) porId.set(id, crearElemento('div'));
        return porId.get(id);
    };

    const contexto = vm.createContext({
        console: { log() {}, error() {}, warn() {} },
        localStorage: almacen,
        document: {
            body: cuerpo,
            createElement: crearElemento,
            createTextNode: crearNodoTexto,
            getElementById: pedirPorId,
            querySelector: (sel) => sel === '.calendario-body' ? crearElemento('div') : null,
            querySelectorAll: () => [],
            addEventListener() {},
            removeEventListener() {}
        },
        // `setTimeout` y `setInterval` **no disparan nada**. No es un descuido:
        // es lo que hace que los tests sean deterministas. Si el temporizador
        // corriera de verdad, un `setTimeout` de `app.js` podría escribir en el
        // DOM falso después de que el test terminó, y el fallo aparecería en el
        // test siguiente, en otro archivo. Devuelven `1` y no hacen nada; para
        // probar temporizadores hay que dispararlos a mano.
        setTimeout: () => 1, clearTimeout() {},
        setInterval: () => 1, clearInterval() {},
        // `app.js` pide permiso de notificación al arrancar. Que no devuelva
        // nada es lo que espera el código: no usa el resultado.
        Notification: { permission: 'default', requestPermission() {} },
        AudioContext: null, webkitAudioContext: null,
        FileReader: function () {},
        Blob: function () {},
        File: function () {},
        fetch() { return Promise.reject(new Error('sin red en el test')); },
        alert() {}, confirm: () => true, prompt: () => null,
        Date, Math, JSON, Object, Array, Set, Map, Number, String, Boolean,
        Error, RegExp, isNaN, parseInt, parseFloat,
        encodeURIComponent, decodeURIComponent, undefined
    });

    // En el navegador **`window` ES el ámbito global**: no hay dos objetos, hay
    // uno con dos nombres. Por eso `window.MapaCalorLogica = API` deja el módulo
    // disponible para el archivo siguiente.
    //
    // Esto tiene que estar **antes** de correr los scripts. Si se hiciera
    // después, el `window` de los módulos sería otro objeto y sus exports
    // quedarían en un lado al que `app.js` no llega: la carga se cortaría en
    // silencio y ningún error lo contaría.
    contexto.window = contexto;
    contexto.addEventListener = () => {};
    contexto.removeEventListener = () => {};
    contexto.getComputedStyle = () => ({});

    // Los scripts se corren **contra el contexto**, no con `require`: sin
    // `require` ni `module`, que es como los carga el navegador.
    for (const archivo of ORDEN) {
        const codigo = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
        try {
            vm.runInContext(codigo, contexto, { filename: archivo });
        } catch (error) {
            errores.push(archivo + ': ' + error.message);
        }
    }


    return { contexto, errores, almacen };
}

module.exports = {
    cargarComoNavegador,
    crearAlmacenamiento,
    romper,
    crearElemento,
    crearNodoTexto,
    ORDEN,
    IDS,
    RAIZ
};


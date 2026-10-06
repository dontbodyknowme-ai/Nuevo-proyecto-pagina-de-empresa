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
    'js/logica/consentimiento.js',
    'js/datos/secciones.js',
    'js/datos/almacenamiento.js',
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
    'anotacionesExistentes', 'arbolNavegacion', 'avisoDatos', 'breadcrumbs',
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

// ---------- El almacén del navegador falso ----------
//
// ## Por qué está acá y no en cada test
//
// La app abre el almacenamiento del navegador antes de dibujar nada, y **si no abre
// no dibuja nada**: es la decisión de RF-3. Sin `indexedDB` en el contexto, el arnés
// era un navegador al que le falta el almacén, y los veinte tests de navegador
// recorrieron el camino de "no abre". No era un bug de la app: era un arnés que ya no
// llegaba al punto de la app.
//
// ## Qué modela y qué no — leído antes de confiar en él
//
// **Modela:** `open` con `onupgradeneeded`, `createObjectStore`, `transaction`, y en
// un almacén `get`, `put` y `delete`, con la transacción IVA y `oncomplete` al final.
//
// **NO modela, y no se debe usar para probarlo:**
//
// - **La persistencia**: los datos viven en memoria y se pierden al terminar el test.
// - **Las transacciones reales**: no hay concurrencia, ni se bloquea, ni se aborta por
//   cuota. Que una escritura sea demasiado grande **no falla acá**.
// - **La versión y las migraciones**: `open` no falla por estar bloqueado.
// - **`onblocked`**: no se dispara nunca.
//
// Eso no es un defecto del mock: es la frontera. Por eso **el comportamiento del
// almacén se prueba en Chrome**, y no acá. Este sirve para que el arnés pueda llegar
// al arranque, y para probar los caminos de fallo que uno rompe a propósito.
//
// ## Los fallos se provocan a mano
//
// `modo` permite romper el almacén de las tres formas que la app tiene que tolerar:
// que no exista, que no abra, y que abra pero no escriba. Sin eso, los caminos de
// error no se podrían recorrer nunca —y un camino que no se recorre no está probado.
//
// ## Por qué en microtareas y no con `setTimeout`
//
// Porque en este contexto `setTimeout` **no dispara nada** (está así a propósito, para
// que los tests sean deterministas). Con `setTimeout`, ninguna escritura terminaría
// nunca y la prueba se quedaría esperando hasta el plazo. Con microtareas el
// comportamiento es asíncrono —como en el navegador— y termina solo.

function crearIndexedDB(modo = 'bien') {
    const bases = new Map();

    // `sin-marca` falla **solo** la escritura del registro de migración, y nada más.
    //
    // Hace falta que sea tan preciso: si fallara toda escritura en `metadatos`,
    // también fallaría el **registro de prueba de disponibilidad**, la aplicación
    // concluiría que el almacén no abre, y no se llegaría nunca a la migración. Es
    // el caso límite de RF-2: los datos entran bien y lo único que no se escribe es
    // la marca.
    // Los otros modos existen para **reescribir las cinco protecciones de escritura
    // contra el almacén nuevo**. Antes rompían `localStorage.setItem`; ahora hay que
    // romper `indexedDB`, y cada modo representa un fallo distinto:
    //
    // | Modo | Qué rompe | Qué protección comprueba |
    // |------|-----------|--------------------------|
    // | `sin-espacio` | `put` lanza con `QuotaExceededError` | Sin espacio: no se escribe nada y se avisa |
    // | `abortar` | La transacción dispara `onabort` | Una transacción a medias no rompe la pantalla |
    // | `lectura-falla` | `get` lanza | Si no se puede leer, no se escribe encima |
    //
    // Y `sin-marca`, que es el caso límite de la migración.
    //
    // ## Por qué los tres modos tocan SOLO los almacenes de datos
    //
    // Porque los tres romperían también la **prueba de disponibilidad**, que escribe en
    // `metadatos`. Y si la disponibilidad fallara, la app no abriría: no estaríamos
    // probando una escritura que falla, sino una app que no abre, que es otra cosa.
    // El mismo error que se corrigió con `sin-marca`, un nivel más arriba.
    let modoActual = modo;

    // `metadatos` es el almacén de la cuenta de la app: la prueba de disponibilidad y
    // la marca de migración. Los fallos de los modos apuntan a lo del **usuario**.
    const esAlmacenDeDatos = nombre => nombre !== 'metadatos';

    const falloDeEspacio = (nombreAlmacen, clave) =>
        esAlmacenDeDatos(nombreAlmacen) && modoActual === 'sin-espacio'
        || (modoActual === 'sin-marca' && nombreAlmacen === 'metadatos' && clave === 'migracion');

    function baseDe(nombre, version) {
        if (!bases.has(nombre)) {
            bases.set(nombre, { almacenes: new Map(), version: 0 });
        }
        const base = bases.get(nombre);
        if (version > base.version) base.version = version;
        return base;
    }

    function conexionDe(nombre, base) {
        return {
            name: nombre,
            version: base.version,
            objectStoreNames: {
                contains: (n) => base.almacenes.has(n),
                get length() { return base.almacenes.size; },
                // `objectStoreNames` en el navegador es una lista indexable.
                item: (i) => [...base.almacenes.keys()][i]
            },
            createObjectStore(n) {
                if (!base.almacenes.has(n)) base.almacenes.set(n, new Map());
                return { name: n };
            },
            deleteObjectStore(n) { base.almacenes.delete(n); },
            transaction(nombres, modoTransaccion) {
                // Siempre un arreglo: `transaction()` acepta un nombre o una lista, y
                // el modo `abortar` necesita mirar el nombre. Con un string suelto,
                // `nombres[0]` es el **primer carácter** —`'m'` de `'materias'`— y el
                // modo no compararía nunca nada.
                const lista = Array.isArray(nombres) ? nombres : [nombres];
                const registros = [];

                const transaccion = {
                    error: null,
                    objectStore(n) {
                        if (!base.almacenes.has(n)) {
                            throw new Error('No hay un almacén llamado "' + n + '"');
                        }
                        const datos = base.almacenes.get(n);

                        return {
                            get(clave) {
                                const peticion = {
                                    onsuccess: null, onerror: null, result: undefined
                                };
                                registros.push({
                                    peticion,
                                    disparar: () => {
                                        // `lectura-falla`: la lectura no se puede hacer.
                                        // El caso real es un almacén bloqueado o un disco
                                        // que no responde; lo que importa es que la app
                                        // **no escriba encima de lo que no pudo leer**.
                                        if (modoActual === 'lectura-falla' && esAlmacenDeDatos(n)) {
                                            const error = new Error('no se pudo leer');
                                            peticion.error = error;
                                            if (peticion.onerror) peticion.onerror(error);
                                            return;
                                        }
                                        peticion.result = datos.get(clave);
                                        if (peticion.onsuccess) peticion.onsuccess();
                                    }
                                });
                                return peticion;
                            },
                            put(valor, clave) {
                                if (falloDeEspacio(n, clave)) {
                                    throw Object.assign(new Error('sin cuota'), {
                                        name: 'QuotaExceededError'
                                    });
                                }
                                const peticion = { onsuccess: null, onerror: null };
                                registros.push({
                                    peticion,
                                    disparar: () => {
                                        datos.set(clave, valor);
                                        if (peticion.onsuccess) peticion.onsuccess();
                                    }
                                });
                                return peticion;
                            },
                            delete(clave) {
                                const peticion = { onsuccess: null, onerror: null };
                                registros.push({
                                    peticion,
                                    disparar: () => {
                                        datos.delete(clave);
                                        if (peticion.onsuccess) peticion.onsuccess();
                                    }
                                });
                                return peticion;
                            }
                        };
                    },
                    abort() { registros.length = 0; },

                    // Al crear la transacción ya se programa su cierre: los `get` y
                    // los `put` se registran de forma **sincrónica** justo después, y
                    // la microtarea corre cuando ya están todos.
                    //
                    // Y se dispara **último**, como en el navegador: por eso
                    // `escribirRegistro()` puede esperar `oncomplete` en vez de
                    // conformarse con el `put`.
                    _alCerrar: true
                };

                Promise.resolve().then(() => {
                    // `abortar`: **una escritura** se corta. Solo `readwrite`: una
                    // lectura que se cortara no probaría lo que dice esta protección
                    // (que una escritura a medias no rompe la pantalla), y además
                    // rompería el `leerGrupos()` que el test usa para mirar lo que
                    // había antes.
                    if (modoActual === 'abortar' && modoTransaccion === 'readwrite'
                        && lista.some(esAlmacenDeDatos)) {
                        const error = Object.assign(
                            new Error('la transacción se cortó'),
                            { name: 'AbortError' }
                        );
                        // Las peticiones pendientes reciben `onerror`: si se las
                        // abandona en silencio, quien espera un `onsuccess` **se queda
                        // esperando para siempre** y el arranque no termina nunca.
                        for (const { peticion } of registros) {
                            peticion.error = error;
                            if (peticion.onerror) peticion.onerror(error);
                        }
                        registros.length = 0;
                        if (transaccion.onabort) transaccion.onabort(error);
                        return;
                    }

                    for (const { disparar } of registros) disparar();
                    if (transaccion.oncomplete) transaccion.oncomplete();
                });

                return transaccion;
            },
            close() {}
        };
    }

    return {
        // Para cambiar cómo se comporta **después** de crearlo. Ver arriba.
        set modo(nuevo) { modoActual = nuevo; },
        get modo() { return modoActual; },

        open(nombre, version) {
            const peticion = {
                onsuccess: null, onerror: null,
                onupgradeneeded: null, onblocked: null,
                result: null, error: null
            };

            Promise.resolve().then(() => {
                if (modoActual === 'no-abre') {
                    peticion.error = new Error('el almacén no abre');
                    if (peticion.onerror) peticion.onerror(peticion.error);
                    return;
                }

                // **Se pregunta antes de crearla.** `baseDe()` sube la versión, así
                // que mirarla después daría "ya existía" siempre, `onupgradeneeded`
                // no se dispararía nunca, y los almacenes no se crearían: la prueba
                // de disponibilidad caería en "no se pudo escribir" sin que nadie
                // supiera por qué.
                const existed = bases.has(nombre);
                const base = baseDe(nombre, version || 1);
                const conexion = conexionDe(nombre, base);
                peticion.result = conexion;

                if (!existed) {
                    if (peticion.onupgradeneeded) peticion.onupgradeneeded(peticion);
                }
                if (peticion.onsuccess) peticion.onsuccess(peticion);
            });

            return peticion;
        },

        deleteDatabase(nombre) {
            bases.delete(nombre);
            return { onsuccess: null, onerror: null };
        }
    };
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
 * @param {object} [opciones]
 * @param {'bien'|'no-abre'|'sin-espacio'|'sin-marca'} [opciones.almacen]
 *   cómo se comporta el almacén del navegador. `'no-abre'` es el camino de "la
 *   aplicación no abre". `'sin-marca'` falla **solo** las escrituras
 *   en `metadatos`, que es donde va la marca de migración: simula el caso en que la
 *   copia de los datos termina bien y la marca no llega a escribirse.
 * @param {boolean} [opciones.sinAlmacen] no poner `indexedDB` en el contexto, como
 *   un navegador que no lo soporta
 * @param {object} [opciones.indexedDB] un almacén falso ya creado, para **compartirlo
 *   entre dos cargas**. Es lo que permite probar "si la copia se corta, en la
 *   siguiente apertura se reintenta": sin esto, cada carga tendría su almacén y
 *   siempre empezaría vacío.
 * @returns {{contexto, errores, almacen, inicio}} el contexto, los errores que se ven
 *   al cargar, y **la promesa del arranque**
 */
function cargarComoNavegador(datosAlmacenamiento = {}, opciones = {}) {
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
        // `FileReader`, que la app usa para leer los archivos que el usuario sube. Estaba como
        // un `function () {}` —un stub que no hace nada—, y eso dejaba **todo el camino de
        // subida sin poder probarse**: `crearDocumento()` llegaba a `readAsDataURL` y
        // reventaba con "readAsDataURL is not a function".
        //
        // Es un global del navegador, así que va acá. Y leer un archivo es una de las dos
        // cosas que más usa la aplicación: sin esto, "subir un PDF" era código que nadie
        // podía comprobar con `node --test`.
        //
        // El archivo trae los bytes en `_bytes`. Un `File` real los trae de verdad; un
        // objeto de prueba los pone ahí, y se dice en el nombre para que nadie lo confunda
        // con el contenido del documento.
        FileReader: function () {
            this.onload = null;
            this.onerror = null;
            this.result = null;

            this.readAsDataURL = function (file) {
                const self = this;
                Promise.resolve().then(() => {
                    const bytes = file._bytes || new Uint8Array(0);
                    self.result = 'data:' + (file.type || 'application/octet-stream')
                        + ';base64,' + Buffer.from(bytes).toString('base64');
                    if (self.onload) self.onload();
                }, (error) => {
                    if (self.onerror) self.onerror(error);
                });
            };

            this.readAsText = function (file) {
                const self = this;
                Promise.resolve().then(() => {
                    self.result = Buffer.from(file._bytes || new Uint8Array(0))
                        .toString('utf8');
                    if (self.onload) self.onload();
                }, (error) => {
                    if (self.onerror) self.onerror(error);
                });
            };
        },
        Blob: function () {},
        File: function () {},

        // `atob`, que la app usa para pasar lo que está guardado —el archivo codificado
        // en base64 dentro de una URL de datos— a los bytes que pdf.js y mammoth piden.
        //
        // **Es un global del navegador, así que va acá y no en `app.js`.** Lo contrario
        // sería escribir un descodificador de base64 en la aplicación solo para que un test
        // pueda correrla.
        //
        // **La primera versión lo decodificaba a mano y estaba mal.** Tiraba los
        // caracteres que no eran de base64 en vez de fallar, así que `"esto no es una URL"`
        // salía como nueve bytes de basura y los tests no distinguían "contenido roto" de
        // "contenido válido". Un simulador que **acepta lo que el navegador rechaza** no
        // sirve para probar el camino del error.
        //
        // `atob` de verdad **lanza** con una cadena que no es base64. Esto también.
        atob(texto) {
            const cadena = String(texto);

            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cadena) || cadena.length % 4 !== 0) {
                throw new Error('InvalidCharacterError: la cadena no es base64');
            }

            return Buffer.from(cadena, 'base64').toString('binary');
        },
        // El almacén del navegador. Sin esto la app toma el camino de "no abre" —
        // que es lo correcto para un navegador sin almacén, pero no lo que hay que
        // medir en los veinte tests de comportamiento. Ver `crearIndexedDB`.
        ...(opciones.sinAlmacen
            ? {}
            : { indexedDB: opciones.indexedDB || crearIndexedDB(opciones.almacen) }),
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


    // `Promise` y `queueMicrotask` no están en la lista de arriba a propósito: son
    // los que usa el almacén falso para resolver. `Promise` es global en el
    // contexto de `vm`, así que alcanza con no shadowearlo.

    // El arranque es una promesa y vive en la API. Se devuelve para que el test la
    // **espere**: con el arranque asíncrono, un rechazo se perdería, porque acá solo
    // se juntan errores **síncronos** y la `console` no hace nada.
    const inicio = contexto.CuadernoVirtual && contexto.CuadernoVirtual.inicio
        ? contexto.CuadernoVirtual.inicio
        : Promise.resolve();

    return { contexto, errores, almacen, inicio };
}

module.exports = {
    cargarComoNavegador,
    crearAlmacenamiento,
    crearIndexedDB,
    romper,
    crearElemento,
    crearNodoTexto,
    ORDEN,
    IDS,
    RAIZ
};


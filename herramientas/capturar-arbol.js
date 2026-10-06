// ============================================ Sonda: línea base del árbol lateral
// Ejecutar: node herramientas/capturar-arbol.js [archivo.json]
// ============================================
//
// Qué hace: siembra varios juegos de datos, deja que la app se dibuje, y guarda
// el HTML real del árbol lateral de cada uno.
//
// Por qué existe: `construirArbol()` son 162 líneas y casi todas son dibujo.
// Los tests de Node no pueden decir si el menú lateral sigue viéndose igual:
// no saben de `createElement` ni de atributos. Entonces la comparación tiene que
// ser contra **lo que realmente se pintó antes**.
//
// Cómo se usa:
//
//   node herramientas/capturar-arbol.js herramientas/linea-base-arbol.json
//   ... se refactoriza ...
//   node herramientas/capturar-arbol.js herramientas/linea-base-arbol.json
//   node herramientas/comparar-arbol.js
//
// O sea: el primer archivo **es** la línea base. El segundo tiene que dar
// exactamente lo mismo, y `comparar-arbol.js` es el que dice si dio.
//
// Por qué vive acá y no en test/: `node --test` ejecuta cualquier `.js` dentro
// de un directorio llamado `test`, aunque no sea `*.test.js`. Verificado con una
// sonda. Si esto estuviera en `test/`, cada corrida de la suite abriría un
// Chrome.
//
// Herramientas: fetch y WebSocket, que ya trae Node. Sin npm install. Principio 1.

const { sembrar, comoRespaldo } = require('./sembrar.js');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
const INDICE = 'file:///' + path.join(RAIZ, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const PUERTO = 9334;
const CDP = `http://127.0.0.1:${PUERTO}`;
const DESTINO = process.argv[2] || path.join(__dirname, 'linea-base-arbol.json');

const dormir = ms => new Promise(r => setTimeout(r, ms));

// ---------- Los escenarios ----------
//
// Cada caso existe por un motivo. La lista se hizo leyendo `construirArbol()`
// y buscando dónde puede cambiar algo sin que nadie lo note.

const CASOS = [
    {
        nombre: 'vacio',
        motivo: 'Sin materias: sale el <p> de "no hay materias". Es una rama aparte.',
        materias: []
    },
    {
        nombre: 'materia-sin-documentos',
        motivo: 'Una materia con documentos: []. El <ul> de docs queda vacío.',
        materias: [{ id: 'm1', nombre: 'Matemáticas', documentos: [] }]
    },
    {
        nombre: 'varias-materias',
        motivo: 'Varias materias y varios documentos: el orden de aparición importa.',
        materias: [
            { id: 'm1', nombre: 'Matemáticas', documentos: [
                { id: 'd1', nombre: 'Ecuaciones.pdf', tipo: 'pdf' },
                { id: 'd2', nombre: 'Notas.html', tipo: 'html' }
            ]},
            { id: 'm2', nombre: 'Historia', documentos: [
                { id: 'd3', nombre: 'Guerra.docx', tipo: 'word' }
            ]},
            { id: 'm3', nombre: 'Física', documentos: [] }
        ]
    },
    {
        nombre: 'icono-por-defecto',
        motivo: 'Materia sin campo "icono": tiene que salir la carpeta 📁.',
        materias: [{ id: 'm1', nombre: 'Sin icono', documentos: [] }]
    },
    {
        nombre: 'icono-propio',
        motivo: 'Materia con "icono": tiene que salir el suyo, no la carpeta.',
        materias: [{ id: 'm1', nombre: 'Química', icono: '⚗️', documentos: [] }]
    },
    {
        nombre: 'tipos-de-documento',
        motivo: 'Un documento de cada tipo: cada uno con su ícono. Uno sin tipo.',
        materias: [{ id: 'm1', nombre: 'Varios', documentos: [
            { id: 'd1', nombre: 'a.html', tipo: 'html' },
            { id: 'd2', nombre: 'b.pdf', tipo: 'pdf' },
            { id: 'd3', nombre: 'c.word', tipo: 'word' },
            { id: 'd4', nombre: 'd.txt', tipo: 'lo-que-sea' },
            { id: 'd5', nombre: 'e.sin-tipo' }
        ]}]
    },
    {
        nombre: 'nombre-con-acentos',
        motivo: 'Acentos y ñ: si alguien mete escapeHtml de más, se ven.',
        materias: [{ id: 'm1', nombre: 'Programación Ñandú', documentos: [
            { id: 'd1', nombre: 'Árboles binarios.pdf', tipo: 'pdf' }
        ]}]
    },
    {
        nombre: 'nombre-con-html',
        motivo: 'XSS: un nombre con comillas y etiquetas. Tiene que salir como texto.',
        materias: [{ id: 'm1', nombre: 'informe" onload="alert(1)', documentos: [
            { id: 'd1', nombre: '<img src=x onerror=alert(2)>', tipo: 'html' }
        ]}]
    },
    {
        nombre: 'nombre-vacio',
        motivo: 'Nombres vacíos: el nodo se dibuja igual, sin texto.',
        materias: [{ id: 'm1', nombre: '', documentos: [
            { id: 'd1', nombre: '', tipo: 'html' }
        ]}]
    },
    {
        nombre: 'muchos-documentos',
        motivo: '10 documentos: el orden tiene que respectarse entero.',
        materias: [{ id: 'm1', nombre: 'Carga', documentos: Array.from({ length: 10 }, (_, i) => ({
            id: 'd' + i, nombre: 'Doc ' + (i + 1), tipo: 'html'
        }))}]
    },
    {
        nombre: 'materia-sin-lista-de-documentos',
        // Antes de T6 este caso tumbaba la app entera. Se conserva el escenario
        // porque sigue siendo una entrada que puede venir de un respaldo.
        materias: [{ id: 'm1', nombre: 'Rota' }]
    },
    {
        nombre: 'documento-sin-contenido',
        motivo: 'Un PDF y un Word sin contenido. El menú los tiene que mostrar igual.',
        materias: [{ id: 'm1', nombre: 'Incompleta', documentos: [
            { id: 'd1', nombre: 'bien.pdf', tipo: 'pdf', contenido: 'data:application/pdf;base64,JVBER' },
            { id: 'd2', nombre: 'roto.pdf', tipo: 'pdf' },
            { id: 'd3', nombre: 'roto.docx', tipo: 'word' }
        ]}]
    },
    {
        nombre: 'respaldo-con-basura',
        motivo: 'Entradas que no son materias ni documentos, entre datos buenos.',
        materias: [
            { id: 'm1', nombre: 'Buena', documentos: [{ id: 'd1', nombre: 'x.html', tipo: 'html', contenido: '<p>hola</p>' }] },
            'no soy una materia',
            42,
            { id: 'm2', nombre: 'Con basura', documentos: ['no soy un documento', null] }
        ]
    }
];

// ---------- Arranque de Chrome ----------

function rutaChrome() {
    const candidatos = [
        process.env.CHROME_PATH,
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
    ].filter(Boolean);

    for (const ruta of candidatos) if (fs.existsSync(ruta)) return ruta;
    return null;
}

function arrancarChrome(ruta) {
    const perfil = path.join(os.tmpdir(), `capturar-arbol-${process.pid}`);
    const hijo = spawn(ruta, [
        `--remote-debugging-port=${PUERTO}`,
        `--user-data-dir=${perfil}`,
        '--headless=new', '--disable-gpu', '--no-first-run',
        '--no-default-browser-check', '--disable-extensions',
        '--disable-background-networking', 'about:blank'
    ], { stdio: 'ignore', detached: false });
    return { hijo, perfil };
}

async function esperarChrome(intentos = 40) {
    for (let i = 0; i < intentos; i++) {
        try {
            const r = await fetch(`${CDP}/json/version`);
            if (r.ok) return await r.json();
        } catch { /* todavía no arrancó */ }
        await dormir(250);
    }
    return null;
}

function conectar(url) {
    return new Promise((resolver, rechazar) => {
        const ws = new WebSocket(url);
        let id = 0;
        const pendientes = new Map();

        // Los eventos del navegador llegan por el mismo WebSocket, pero sin
        // `id`. Se acumulan acá para poder leer qué errores tiró la página.
        const eventos = [];

        ws.addEventListener('message', ev => {
            const m = JSON.parse(ev.data);

            if (m.method) {
                eventos.push(m);
                return;
            }

            const p = pendientes.get(m.id);
            if (!p) return;
            pendientes.delete(m.id);
            if (m.error) p.rechazar(new Error(m.error.message));
            else p.resolver(m.result);
        });
        ws.addEventListener('error', () => rechazar(new Error('no se pudo conectar con Chrome')));
        ws.addEventListener('open', () => resolver({
            ws,
            enviar(metodo, params = {}) {
                return new Promise((res, rej) => {
                    const i = ++id;
                    pendientes.set(i, { resolver: res, rechazar: rej });
                    ws.send(JSON.stringify({ id: i, method: metodo, params }));
                });
            },
            alCerrar: cb => ws.addEventListener('close', cb),
            eventos
        }));
    });
}

// ---------- Capturar un escenario ----------

// La siembra **no** es de acá: vive en `herramientas/sembrar.js`, y la usa también
// `verificar-layout.js`. Escribirla dos veces garantiza que una de las dos se quede vieja
// sin que nadie lo note.
//
// Antes esta función ponía `localStorage.setItem('cuadernoVirtual', ...)`. Con la
// aplicación leyendo del almacén del navegador, eso ya no sembraba nada: el primer
// escenario migraba y dejaba la marca, y todos los siguientes quedaban midiendo una
// aplicación vacía. Por eso la línea base no daba IDÉNTICO.

function expresionListo() {
    return `(function () {
        var nav = document.getElementById('arbolNavegacion');
        return !!(nav && document.readyState === 'complete');
    })()`;
}

// Ojo con la forma: como expresión, `function () {}` a secas es un SyntaxError
// ("Function statements require a function name"). Tiene que ser una
// expresión invocada: `(function () {})()`.
function expresionLeer() {
    return `(function () {
        const nav = document.getElementById('arbolNavegacion');
        if (!nav) return { error: 'no existe #arbolNavegacion' };

        const nodos = nav.querySelectorAll('.nodo');
        return {
            html: nav.innerHTML,
            nodosMateria: nav.querySelectorAll('.nodo-materia').length,
            nodosDoc: nav.querySelectorAll('.nodo-doc').length,
            botones: nav.querySelectorAll('button').length,
            texto: nav.textContent.replace(/\\s+/g, ' ').trim(),
            // El orden importa: si el refactor reordena algo, se ve acá.
            orden: Array.from(nodos).map(n => n.dataset.id)
        };
    })()`;
}

// Los errores que lanzó la página se leen de los eventos del protocolo
// (`Runtime.exceptionThrown`), no de un centinela en la página: el centinela
// con `addEventListener` no alcanzaba a atrapar el error de `construirArbol()`,
// que ocurre durante el arranque.
function leerExcepciones(eventos) {
    const out = [];
    for (const e of eventos) {
        if (e.method === 'Runtime.exceptionThrown') {
            const d = e.params.exceptionDetails || {};
            const texto = d.exception?.description || d.text || 'excepción sin texto';
            out.push(texto.split('\n')[0]);
        }
    }
    return out;
}

// ---------- Programa ----------

(async function main() {
    const ruta = rutaChrome();
    if (!ruta) {
        console.error('No se encontró Chrome. Definí CHROME_PATH.');
        process.exit(1);
    }

    const { hijo, perfil } = arrancarChrome(ruta);
    let salida = 1;

    try {
        const info = await esperarChrome();
        if (!info) throw new Error('Chrome no arrancó');

        const nav = await fetch(`${CDP}/json/new?${encodeURIComponent(INDICE)}`, { method: 'PUT' })
            .then(r => r.json());
        const cdp = await conectar(nav.webSocketDebuggerUrl);
        let casosRotos = 0;
        const casosConError = [];

        // Sin esto no llegan los eventos de excepción.
        await cdp.enviar('Runtime.enable');

        const captura = [];

        // Los dos callbacks que `sembrar.js` necesita. Se arman acá porque cada
        // herramienta habla con el CDP distinto, y el helper no tiene por qué saberlo.
        const navegarAIndice = async () => {
            await cdp.enviar('Page.navigate', { url: INDICE });
            await dormir(1400);
        };

        const evaluarEnIndice = async (expression, esPromesa) => {
            const r = await cdp.enviar('Runtime.evaluate', {
                expression,
                awaitPromise: !!esPromesa,
                returnByValue: true
            });
            // OJO: `enviar` resuelve con `m.result`, y la respuesta de
            // `Runtime.evaluate` tiene su resultado adentro de `result`.
            return r && r.result ? r.result.value : undefined;
        };

        for (const caso of CASOS) {
            // 1. Sembrar por el camino de escritura de la aplicación y recargar, para
            //    que la app se dibuje desde cero. Ver `herramientas/sembrar.js`.
            await sembrar(navegarAIndice, evaluarEnIndice, comoRespaldo(caso.materias));

            let listo = false;
            for (let intento = 0; intento < 40 && !listo; intento++) {
                await dormir(150);
                const r = await cdp.enviar('Runtime.evaluate', {
                    expression: expresionListo(), returnByValue: true
                });
                listo = r.result.value === true;
            }
            if (!listo) throw new Error(`la página no llegó a 'complete' en el caso ${caso.nombre}`);

            // 2. Leer lo que quedó en pantalla
            const leido = await cdp.enviar('Runtime.evaluate', {
                expression: expresionLeer(),
                returnByValue: true
            });

            // Los eventos acumulados son de TODA la corrida: hay que
            // quedarse solo con los de esta navegación.
            const excepciones = leerExcepciones(cdp.eventos.splice(0));

            // OJO: `enviar` resuelve con m.result, y la respuesta de
            // Runtime.evaluate tiene su resultado adentro de `result`.
            // O sea, el valor está en leido.result.value.
            const r = leido.result.value || {};

            const fila = {
                nombre: caso.nombre,
                motivo: caso.motivo,
                // Se guarda null cuando no se pudo leer, "" cuando se leyó
                // y estaba vacío. La diferencia importa al comparar.
                html: r.html ?? null,
                nodosMateria: r.nodosMateria ?? null,
                nodosDoc: r.nodosDoc ?? null,
                botones: r.botones ?? null,
                texto: r.texto ?? null,
                orden: r.orden || [],
                errores: excepciones
            };
            captura.push(fila);

            // Tres cosas distintas, que la primera versión mezclaba en un solo "ok":
//
//   sinLeer  -> la sonda no pudo leer. Eso es un fallo de la sonda (sale 1).
//   conError -> la página lanzó un error. Eso es un defecto del producto.
//   vacio    -> se leyó bien y el árbol está vacío. Un estado válido.
//
// Solo `sinLeer` hace fallar la sonda. Un defecto del producto se registra y
// se avisa, pero no impide usar el archivo como línea base: justamente hay que
// poder comparar contra él para demostrar que un refactor no lo cambió.
            const sinLeer = !!r.error || r.html === null || r.html === undefined;
            const conError = fila.errores.length > 0;
            const vacio = !sinLeer && r.html === '';

            if (sinLeer) casosRotos++;

            let marca = 'ok   ';
            let nota = '';
            if (sinLeer) { marca = 'ROTO'; nota = r.error || 'no se pudo leer el HTML'; }
            else if (conError) { marca = 'FALLA'; nota = fila.errores[0]; }
            else if (vacio) { marca = 'VACÍO'; nota = 'se leyó, pero no se dibujó nada'; }

            if (conError) casosConError.push(caso.nombre);

            console.log(`  [${marca}] ${caso.nombre.padEnd(32)} ` +
                `${fila.nodosMateria ?? '-'} materias, ${fila.nodosDoc ?? '-'} docs, ` +
                `${fila.botones ?? '-'} botones` +
                (nota ? `  <- ${nota}` : ''));
        }

        const salidaDatos = {
            generado: new Date().toISOString(),
            nota: 'Generado por herramientas/capturar-arbol.js. No editar a mano.',
            casos: CASOS.length,
            captura
        };

        fs.writeFileSync(DESTINO, JSON.stringify(salidaDatos, null, 2), 'utf8');
        console.log('');
        console.log(`  Guardado en ${path.relative(RAIZ, DESTINO)}`);
        if (casosConError.length) {
            console.log('');
            console.log(`  ${casosConError.length} caso(s) donde la página lanzó un error:`);
            for (const n of casosConError) console.log(`    - ${n}`);
            console.log('  Son defectos del producto, no de la sonda.');
            console.log('  Quedan guardados así: un refactor NO debe cambiarlos,');
            console.log('  y tampoco debe arreglar de paso (eso va en su propia tarea).');
        }
        if (casosRotos) {
            console.log('');
            console.log(`  ${casosRotos} caso(s) sin poder leerse. Esto SÍ es un fallo de la sonda.`);
        }
        salida = casosRotos ? 1 : 0;

        cdp.ws.close();
    } catch (error) {
        console.error('  Falló la captura: ' + error.message);
    } finally {
        try { process.kill(hijo.pid); } catch { /* ya estaba muerto */ }
        await dormir(200);
        try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* dejarlo */ }
    }

    process.exit(salida);
})();
// ============================================
// VERIFICACIÓN — Layout del modal del calendario
// Ejecutar: node herramientas/verificar-layout.js
// ============================================
//
// Recorre 24 combinaciones: 2 conjuntos de datos (limpios y con problemas)
// x 4 anchos de pantalla (1920, 1280, 768, 375) x 3 vistas (modal en
// calendario, modal en mapa, y la principal sin modal). Y
// reporta lo que no entra: elementos recortados, elementos fuera de la
// ventana, y scroll horizontal.
//
// Por qué vive acá y no en test/:
//
//   `node --test` ejecuta **cualquier** archivo .js dentro de un directorio
//   llamado test, aunque no se llame *.test.js. Verificado con una sonda.
//   Si este archivo estuviera en test/, cada vez que corrieras la suite se
//   abriría un Chrome. En test/datos-un-anio.json no hay problema porque es
//   .json.
//
// Herramientas usadas: fetch y WebSocket, que ya trae Node. Sin npm install,
// sin package.json, sin dependencias. Principio 1.
//
// Salida: código 0 si todo está bien, 1 si hay algo que arreglar. Así puede
// usarse como paso de verificación.
//
// Ver: specs/002-layout-calendario/spec.md (RF-1 a RF-4, RF-9, RNF-1, RNF-2)

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
const PUERTO = 9333;
const CDP = `http://127.0.0.1:${PUERTO}`;

// Los cuatro anchos que hay que sostener. El mínimo de 375 sale de la spec:
// por debajo, las celdas del mes quedan de unos 30 px y no son usables.
const VIEWPORTS = [
    { nombre: 'escritorio grande', ancho: 1920, alto: 1080, movil: false },
    { nombre: 'escritorio',        ancho: 1280, alto: 800,  movil: false },
    { nombre: 'tablet',            ancho: 768,  alto: 1024, movil: true },
    { nombre: 'teléfono',          ancho: 375,  alto: 667,  movil: true }
];

// Qué se mide en cada vista.
const ELEMENTOS = [
    ['.calendario-container', 'el panel'],
    ['.calendario-header', 'el encabezado'],
    ['.calendario-nav', 'la navegación de mes'],
    ['.calendario-grid', 'la rejilla del mes'],
    ['.calendario-panel', 'el panel de anotaciones'],
    ['.calendario-mapa', 'el mapa de calor'],
    ['.mapa-rejilla', 'la rejilla del mapa'],
    ['.calendario-leyenda', 'la leyenda']
];

const dormir = ms => new Promise(r => setTimeout(r, ms));

// ---------- Buscar Chrome ----------

function rutaChrome() {
    const candidatos = [
        process.env.CHROME_PATH,
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome'
    ].filter(Boolean);

    for (const ruta of candidatos) {
        if (fs.existsSync(ruta)) return ruta;
    }
    return null;
}

// ---------- Arrancar Chrome para esta corrida ----------

function arrancarChrome(ruta) {
    const perfil = path.join(os.tmpdir(), `verificador-layout-${process.pid}`);

    const hijo = spawn(ruta, [
        `--remote-debugging-port=${PUERTO}`,
        `--user-data-dir=${perfil}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        'about:blank'
    ], { stdio: 'ignore', detached: false });

    return { hijo, perfil };
}

// ---------- Hablar con Chrome por el protocolo DevTools ----------

async function esperarChrome(intentos = 40) {
    for (let i = 0; i < intentos; i++) {
        try {
            const r = await fetch(`${CDP}/json/version`);
            if (r.ok) return await r.json();
        } catch {
            // todavía no arrancó
        }
        await dormir(250);
    }
    return null;
}

function conectar(url) {
    return new Promise((resolver, rechazar) => {
        const ws = new WebSocket(url);
        let id = 0;
        const pendientes = new Map();

        ws.addEventListener('message', ev => {
            const m = JSON.parse(ev.data);
            const p = pendientes.get(m.id);
            if (!p) return;
            pendientes.delete(m.id);
            if (m.error) p.rechazar(new Error(m.error.message));
            else p.resolver(m.result);
        });

        ws.addEventListener('error', () => rechazar(new Error('no se pudo conectar con Chrome')));

        ws.addEventListener('open', () => resolver({
            ws,
            enviar(metodo, params = {}, sessionId) {
                return new Promise((res, rej) => {
                    const i = ++id;
                    pendientes.set(i, { resolver: res, rechazar: rej });
                    ws.send(JSON.stringify({ id: i, method: metodo, params, sessionId }));
                });
            }
        }));
    });
}

// ---------- La medición, que corre dentro del navegador ----------

function expresionMedir() {
    return `function (nombres) {
        const q = s => document.querySelector(s);

        // Un elemento que queda por debajo del pliegue no es un problema si
        // hay algo arriba suyo que se pueda desplazar: el usuario llega
        // scrolleando. Solo es un defecto cuando nadie puede llegar.
        const sePuedeDesplazarHasta = elemento => {
            let padre = elemento.parentElement;
            while (padre) {
                const e = getComputedStyle(padre);
                if (/(auto|scroll)/.test(e.overflowY) &&
                    padre.scrollHeight > padre.clientHeight + 1) {
                    return true;
                }
                padre = padre.parentElement;
            }
            return false;
        };

        const fuera = [];
        const cortados = [];
        const medidas = [];

        for (const [selector, nombre] of nombres) {
            const el = q(selector);
            if (!el) continue;

            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;  // no se ve

            const estilo = getComputedStyle(el);
            medidas.push({
                nombre,
                ancho: Math.round(r.width),
                alto: Math.round(r.height),
                visible: true
            });

            if (r.right > window.innerWidth + 1) {
                fuera.push(nombre + ' se sale por la derecha (' +
                    Math.round(r.right) + ' de ' + window.innerWidth + ')');
            }
            if (r.left < -1) {
                fuera.push(nombre + ' se sale por la izquierda (' +
                    Math.round(r.left) + ')');
            }
            if (r.bottom > window.innerHeight + 1 && !sePuedeDesplazarHasta(el)) {
                fuera.push(nombre + ' se sale por abajo y no hay forma de llegar (' +
                    Math.round(r.bottom) + ' de ' + window.innerHeight + ')');
            }
            if (el.scrollWidth > el.clientWidth + 1) {
                cortados.push(nombre + ' recorta su contenido (' +
                    el.scrollWidth + ' de ' + el.clientWidth + ')');
            }
            if (estilo.display === 'none' && !el.closest('[hidden]')) {
                fuera.push(nombre + ' está oculto pero ocupa lugar');
            }
        }

        const grid = q('.calendario-grid');
        const panel = q('.calendario-panel');
        let distribucion = 'no aplica';
        const gridVisible = grid && grid.getBoundingClientRect().width > 0;
        const panelVisible = panel && panel.getBoundingClientRect().width > 0;
        if (gridVisible && panelVisible) {
            const g = grid.getBoundingClientRect();
            const p = panel.getBoundingClientRect();
            distribucion = p.left >= g.right - 2 ? 'al costado' : 'debajo';
            if (p.left < g.right - 2 && p.top < g.bottom - 2) {
                fuera.push('la rejilla y el panel de anotaciones se superponen');
            }
        }

        // Cuántas zonas se desplazan en vertical. Tiene que ser una sola.
        const zonas = [];
        for (const [selector, nombre] of nombres) {
            const el = q(selector);
            if (el && el.scrollHeight > el.clientHeight + 1) zonas.push(nombre);
        }

        // ---- El aviso de datos (T6) ----
        //
        // Antes esto no se medía, y por eso el aviso se armó tapando el widget
        // del Pomodoro y con 155 px de ancho en una pantalla de 375. El
        // verificador no lo veía porque con datos buenos el aviso está oculto:
        // hay que sembrar datos con problemas para que aparezca.
        const aviso = document.getElementById('avisoDatos');
        const avisoVisible = aviso && !aviso.hidden &&
            aviso.getBoundingClientRect().height > 0;

        let anchoAviso = 0;
        const choquesAviso = [];

        if (avisoVisible) {
            const a = aviso.getBoundingClientRect();
            anchoAviso = Math.round(a.width);

            if (a.left < -1 || a.right > window.innerWidth + 1) {
                fuera.push('el aviso de datos se sale de la ventana (' +
                    Math.round(a.left) + ' a ' + Math.round(a.right) +
                    ' de ' + window.innerWidth + ')');
            }
            if (a.bottom > window.innerHeight + 1 && !sePuedeDesplazarHasta(aviso)) {
                fuera.push('el aviso de datos se sale por abajo y no hay forma de llegar (' +
                    Math.round(a.bottom) + ' de ' + window.innerHeight + ')');
            }

            // Un aviso que tapa el Pomodoro o el pie del menú es un problema
            // real: no se puede hacer clic ahí.
            const seSolapan = (x, y) => !(x.right <= y.left || x.left >= y.right ||
                                           x.bottom <= y.top || x.top >= y.bottom);

            for (const [sel, nombre] of [
                ['.pomodoro-widget', 'el Pomodoro'],
                ['.menu-footer', 'el pie del menú'],
                ['.menu-lateral', 'el menú lateral']
            ]) {
                for (const el of document.querySelectorAll(sel)) {
                    const r = el.getBoundingClientRect();
                    if (r.width === 0 || r.height === 0) continue;
                    if (getComputedStyle(el).display === 'none') continue;
                    if (seSolapan(a, r)) choquesAviso.push(nombre);
                }
            }

            if (choquesAviso.length > 0) {
                fuera.push('el aviso de datos tapa ' +
                    [...new Set(choquesAviso)].join(' y '));
            }
        }

        return {
            medidas,
            fuera,
            cortados,
            distribucion,
            zonasConScroll: zonas,
            avisoVisible,
            anchoAviso,
            choquesAviso: [...new Set(choquesAviso)],
            scrollHorizontalPagina:
                document.documentElement.scrollWidth > window.innerWidth + 1
        };
    }`;
}

// ---------- Datos con los que se mide ----------

// Con datos limpios el aviso de T6 no aparece nunca: está oculto. Para
// medirlo hay que sembrar algo roto a propósito.
const DATOS_LIMP_IOS = '[]';

const DATOS_CON_PROBLEMAS = JSON.stringify([
    // Sin lista de documentos: es el defecto 1 de T6.
    { id: 'm1', nombre: 'Materia sin lista' },
    {
        id: 'm2',
        nombre: 'Materia con documentos',
        documentos: [
            { id: 'd1', nombre: 'bien.html', tipo: 'html', contenido: '<p>hola</p>' },
            // Sin contenido: es el defecto 2 de T6.
            { id: 'd2', nombre: 'sin-contenido.pdf', tipo: 'pdf' },
            { id: 'd3', nombre: 'sin-contenido.docx', tipo: 'word' }
        ]
    }
]);

// ---------- Recorrido ----------

(async function principal() {
    const ruta = rutaChrome();

    if (!ruta) {
        console.log('No se encontró Google Chrome.');
        console.log('Se puede indicar la ruta con la variable CHROME_PATH.');
        process.exit(1);
    }

    console.log('Verificando el layout del modal del calendario');
    console.log('Chrome: ' + ruta);
    console.log('');

    const { hijo, perfil } = arrancarChrome(ruta);
    const limpiar = () => {
        try { hijo.kill(); } catch { /* ya terminó */ }
        try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* no importa */ }
    };
    process.on('exit', limpiar);

    const version = await esperarChrome();
    if (!version) {
        console.log('Chrome no respondió a tiempo.');
        limpiar();
        process.exit(1);
    }
    console.log(version.Browser);
    console.log('');

    const cliente = await conectar(version.webSocketDebuggerUrl);

    const target = await cliente.enviar('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cliente.enviar('Target.attachToTarget', {
        targetId: target.targetId, flatten: true
    });

    await cliente.enviar('Page.enable', {}, sessionId);
    await cliente.enviar('Runtime.enable', {}, sessionId);

    const urlApp = 'file:///' + path.join(RAIZ, 'index.html').replace(/\\/g, '/');

    const problemas = [];
    let medicionesTotales = 0;

    // Cada combinación se mide con datos limpios y con datos rotos: el aviso de
    // T6 solo aparece en el segundo caso, y es justo lo que hay que medir.
    const CONJUNTOS = [
        { nombre: 'limpios', etiqueta: 'limpios ', datos: DATOS_LIMP_IOS, aviso: false },
        { nombre: 'con-problemas', etiqueta: 'con prob.', datos: DATOS_CON_PROBLEMAS, aviso: true }
    ];

    for (const conjunto of CONJUNTOS) {
        console.log(`  -- datos ${conjunto.nombre} --`);

        for (const vp of VIEWPORTS) {
            await cliente.enviar('Emulation.setDeviceMetricsOverride', {
                width: vp.ancho, height: vp.alto,
                deviceScaleFactor: 1, mobile: vp.movil
            }, sessionId);

            // La vista "principal" es SIN modal abierto, a propósito. Con el modal
            // abierto el Pomodoro está oculto (regla de specs/002), así que
            // medir solo con el modal nunca detectaría un aviso que lo tape.
            for (const vista of ['calendario', 'mapa', 'principal']) {
                // Empezar de cero en cada medición
                await cliente.enviar('Page.navigate', { url: urlApp }, sessionId);
                await dormir(1400);

                // Sembrar los datos y recargar, para que la app arranque con
                // ellos y no con lo que quedara de la medición anterior.
                await cliente.enviar('Runtime.evaluate', {
                    expression: `(localStorage.setItem('cuadernoVirtual', ${JSON.stringify(conjunto.datos)}), 1)`
                }, sessionId);
                await cliente.enviar('Page.navigate', { url: urlApp }, sessionId);
                await dormir(1400);

                // "principal" se queda con el modal cerrado.
                if (vista !== 'principal') {
                    await cliente.enviar('Runtime.evaluate', {
                        expression: "(document.getElementById('btnCalendario').click(), 1)"
                    }, sessionId);
                    await dormir(700);

                    // El modal arranca en la vista mapa
                    if (vista === 'calendario') {
                        await cliente.enviar('Runtime.evaluate', {
                            expression: "(document.getElementById('btnAlternarVista').click(), 1)"
                        }, sessionId);
                        await dormir(700);
                    }
                }

                const r = await cliente.enviar('Runtime.evaluate', {
                    expression: '(' + expresionMedir() + ')(' + JSON.stringify(ELEMENTOS) + ')',
                    returnByValue: true
                }, sessionId);

                if (r.exceptionDetails) {
                    problemas.push(`${vp.nombre} / ${vista} / ${conjunto.nombre}: no se pudo medir`);
                    continue;
                }

                const m = r.result.value;
                const malo = m.fuera.length + m.cortados.length +
                    (m.scrollHorizontalPagina ? 1 : 0);

                // Si se esperaba el aviso y no apareció, también es un problema:
                // significaría que la regresión sigue, pero tapada por otra cosa.
                const avisoFaltante = conjunto.aviso && !m.avisoVisible;
                if (avisoFaltante) {
                    problemas.push(`${vp.nombre} / ${vista}: el aviso de datos no apareció ` +
                        'con datos que sí tienen problemas');
                }

                medicionesTotales++;

                const marca = malo === 0 && !avisoFaltante ? 'OK  ' : 'FALLA';
                const tam = vp.ancho === 375 || vp.ancho === 768 ? 'móvil  ' : 'escrit.';
                console.log(`  ${marca} ${tam} ${String(vp.ancho).padStart(4)} px  ` +
                    `${conjunto.etiqueta} ${vista.padEnd(10)}` +
                    `  ·  ${m.distribucion.padEnd(10)}` +
                    `  ·  aviso: ${m.avisoVisible ? m.anchoAviso + ' px' : 'oculto'}`);

                for (const f of m.fuera) {
                    console.log('           ! ' + f);
                    problemas.push(`${vp.nombre} / ${vista} / ${conjunto.nombre}: ${f}`);
                }
                for (const c of m.cortados) {
                    console.log('           ! ' + c);
                    problemas.push(`${vp.nombre} / ${vista} / ${conjunto.nombre}: ${c}`);
                }
                if (m.scrollHorizontalPagina) {
                    console.log('           ! la página tiene scroll horizontal');
                    problemas.push(`${vp.nombre} / ${vista} / ${conjunto.nombre}: ` +
                        'scroll horizontal en la página');
                }
            }
        }
    }

    console.log('');
    console.log('---');
    console.log(`  ${medicionesTotales} mediciones`);

    if (problemas.length === 0) {
        console.log('  Todo entra: nada recortado, nada fuera de la ventana,');
        console.log('  sin scroll horizontal, y el aviso de datos no tapa nada.');
        limpiar();
        process.exit(0);
    }

    console.log(`  ${problemas.length} problema(s):`);
    for (const p of problemas) console.log('    - ' + p);
    console.log('');
    console.log('  Ver RF-1 a RF-4 y RF-9 de specs/002-layout-calendario/spec.md');
    limpiar();
    process.exit(1);
})().catch(e => {
    console.log('Error: ' + e.message);
    process.exit(1);
});
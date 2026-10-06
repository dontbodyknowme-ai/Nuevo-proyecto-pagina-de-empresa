// ============================================
// MEDIR LA PRUEBA DE DISPONIBILIDAD DEL ALMACÉN
// ============================================
//
// Qué mide: cuánto tarda `probarDisponibilidad()` **desde el archivo local**, que es
// como se usa la aplicación, y con la red **desconectada de verdad**.
//
// Por qué hace falta: el plazo de la prueba son 5000 ms (DD-8 del plan de la spec
// 008). Ese número se eligió por la asimetría de las consecuencias, **no medido**. Con
// el número real en la mano se puede bajar, y bajarlo sin medir es elegir un número
// que describe otra cosa.
//
// ## Lo que NO hace, y no por descuido
//
// **No toca el perfil del usuario.** Abre Chrome con un `--user-data-dir` temporal,
// como `verificar-layout.js` y `capturar-arbol.js`. La prueba crea una base de
// datos, y esa base tiene que vivir en un perfil que se pueda borrar.
//
// **No abre la aplicación con datos sembrados.** Mide el arranque en frío, que es lo
// que tarda el usuario la primera vez. Con datos cargados el tiempo es el mismo: la
// prueba no lee el cuaderno.
//
// Herramientas: `fetch` y `WebSocket`, que ya trae Node. Sin `npm install`.
//
// Salida: 0 si la medición se pudo hacer, 1 si la app no abre o algo falla.
// Ver: specs/008-almacenamiento-real/spec.md, RF-3

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const RAIZ = path.join(__dirname, '..');
const PUERTO = 9333;
const CDP = `http://127.0.0.1:${PUERTO}`;

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

// ---------- Arrancar Chrome, con perfil propio ----------

function arrancarChrome(ruta) {
    const perfil = path.join(os.tmpdir(), `medir-disponibilidad-${process.pid}`);

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
//
// Corre en la página, no en la consola: así se mide el almacén de verdad, en el
// hilo de la aplicación, y no un equivalente medido desde otro contexto.
//
// Devuelve **varios** tiempos, no uno. Un solo número no dice si los 5000 ms son
// holgados o si estamos justo: con cinco, se ve la variación. Y un número que se
// midió una vez no sirve para decidir que el plazo se puede bajar.

function expresionMedir() {
    return `function () {
        return (async () => {
            const mod = window.AlmacenamientoDatos;
            if (!mod) return { error: 'no está window.AlmacenamientoDatos' };

            const tiempos = [];
            for (let i = 0; i < 5; i++) {
                const t0 = performance.now();
                const r = await mod.probarDisponibilidad();
                tiempos.push({
                    ms: Math.round(performance.now() - t0),
                    disponible: r.disponible,
                    motivo: r.motivo
                });
            }
            return {
                tiempos,
                plazoEnElCodigo: mod.PLAZO_DISPONIBILIDAD,
                origen: location.origin,
                protocolo: location.protocol,
                hayAlmacen: typeof indexedDB !== 'undefined'
            };
        })();
    }`;
}

// Y el estado de la app, para ver si abrió o si pintó el cartel de "no abre".
function expresionEstado() {
    return `function () {
        const visor = document.getElementById('visor');
        const panel = visor && visor.firstElementChild;
        return {
            abrio: !!(panel && panel.className === 'almacenamiento-no-abre'),
            textoDelPanel: panel ? (panel.textContent || '').slice(0, 60) : null,
            arbolVacio: document.getElementById('arbolNavegacion')
                ? document.getElementById('arbolNavegacion').children.length
                : -1
        };
    }`;
}

// ---------- Corrida ----------

async function main() {
    console.log('============================================');
    console.log('Medir la prueba de disponibilidad');
    console.log('============================================');
    console.log('');

    const ruta = rutaChrome();
    if (!ruta) {
        console.log('No se encontró Google Chrome.');
        console.log('Se puede indicar con la variable CHROME_PATH.');
        return 1;
    }
    console.log('Chrome: ' + ruta);

    const { hijo, perfil } = arrancarChrome(ruta);

    try {
        const version = await esperarChrome();
        if (!version) {
            console.log('Chrome no respondió a tiempo.');
            return 1;
        }
        console.log('Versión: ' + version.Browser);
        console.log('Perfil:  TEMPORARIO (' + perfil + ') — no es el del usuario');
        console.log('');

        const objetivos = await (await fetch(`${CDP}/json/list`)).json();
        const pagina = objetivos.find(o => o.type === 'page');
        if (!pagina) {
            console.log('No se encontró una página donde medir.');
            return 1;
        }

        const cliente = await conectar(pagina.webSocketDebuggerUrl);

        // La red se desconecta **de verdad** por el protocolo, no simulando: lo que
        // se mide es el caso difícil, que es el que importa.
        await cliente.enviar('Network.enable');
        await cliente.enviar('Network.emulateNetworkConditions', {
            offline: true,
            latency: 0,
            downloadThroughput: 0,
            uploadThroughput: 0
        });
        console.log('Red: DESCONECTADA por el protocolo DevTools');
        console.log('');

        const archivo = pathToFileURL(path.join(RAIZ, 'index.html')).href;
        console.log('Página: ' + archivo);
        console.log('');

        await cliente.enviar('Page.enable');
        await cliente.enviar('Page.navigate', { url: archivo });
        await dormir(2500);

        // Que el arranque termine antes de medir.
        const arranque = await cliente.enviar('Runtime.evaluate', {
            expression: `(async () => {
                if (window.CuadernoVirtual && window.CuadernoVirtual.inicio) {
                    await window.CuadernoVirtual.inicio;
                }
                return true;
            })()`,
            awaitPromise: true,
            returnByValue: true
        });

        if (!arranque.result || arranque.result.value !== true) {
            console.log('La aplicación no llegó a publicar su arranque.');
            return 1;
        }

        const estado = await cliente.enviar('Runtime.evaluate', {
            expression: '(' + expresionEstado() + ')()',
            returnByValue: true
        });

        console.log('--- Estado de la aplicación ---');
        const e = estado.result.value;
        console.log('¿Abrió el cuaderno?          ' + (e.abrio ? 'NO — pintó el cartel' : 'sí'));
        console.log('Nodos en el menú lateral:    ' + e.arbolVacio);
        if (e.textoDelPanel) console.log('Texto del panel:             ' + e.textoDelPanel);
        console.log('');

        if (e.abrio) {
            console.log('La aplicación NO abrió con la red desconectada.');
            console.log('Eso es un defecto: la medición no sirve si no abre.');
            return 1;
        }

        const medicion = await cliente.enviar('Runtime.evaluate', {
            expression: '(' + expresionMedir() + ')()',
            awaitPromise: true,
            returnByValue: true
        });

        if (!medicion.result || medicion.result.value?.error) {
            console.log('No se pudo medir: ' + (medicion.result?.value?.error || 'error desconocido'));
            return 1;
        }

        const m = medicion.result.value;

        console.log('--- Lo que se midió ---');
        console.log('Protocolo:     ' + m.protocolo);
        console.log('Origen:        ' + m.origen);
        console.log('¿Hay almacén?  ' + m.hayAlmacen);
        console.log('Plazo en el código: ' + m.plazoEnElCodigo + ' ms');
        console.log('');
        console.log('  vuelta   tiempo   ¿disponible?   motivo');
        for (let i = 0; i < m.tiempos.length; i++) {
            const t = m.tiempos[i];
            console.log('  ' + String(i + 1).padStart(5) +
                String(t.ms).padStart(9) + ' ms' +
                String(t.disponible ? '        sí' : '         no').padStart(14) +
                '   ' + (t.motivo || '—'));
        }
        console.log('');

        const tiempos = m.tiempos.map(t => t.ms);
        const peor = Math.max(...tiempos);
        const mejor = Math.min(...tiempos);
        const todosOk = m.tiempos.every(t => t.disponible);

        console.log('Mejor: ' + mejor + ' ms');
        console.log('Peor:  ' + peor + ' ms');
        console.log('Margen sobre el plazo: ' + m.plazoEnElCodigo + ' / ' + peor +
            ' = ' + Math.round(m.plazoEnElCodigo / peor) + ' veces');
        console.log('');

        if (!todosOk) {
            console.log('La prueba NO dijo que el almacén está disponible.');
            console.log('Con la red desconectada y desde el archivo, tiene que decir que sí.');
            return 1;
        }

        console.log('La prueba dijo que el almacén está disponible en las ' +
            m.tiempos.length + ' vueltas, sin red, desde el archivo.');
        console.log('');
        console.log('Este número va a MEMORY.md. El plazo se puede bajar con el dato');
        console.log('en la mano; bajarlo sin medirlo sería elegir a ciegas.');

        return 0;
    } finally {
        try { hijo.kill(); } catch { /* ya estaba muerto */ }
        try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* nada */ }
    }
}

main().then(codigo => {
    console.log('');
    console.log('Salida ' + codigo + '.');
    process.exit(codigo);
}).catch(error => {
    console.error('');
    console.error('Falló la medición: ' + error.message);
    process.exit(1);
});

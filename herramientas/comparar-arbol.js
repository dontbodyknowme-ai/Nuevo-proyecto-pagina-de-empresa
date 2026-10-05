// ============================================ Sonda: comparar el árbol contra la línea base
// Ejecutar: node herramientas/comparar-arbol.js
// ============================================
//
// Qué hace: vuelve a capturar el árbol lateral con la misma sonda y lo
// contrasta contra `herramientas/linea-base-arbol.json`.
//
// Por qué existe: durante el refactor de `construirArbol()` no hay forma de
// demostrar que el menú lateral sigue igual. `node --test` no sabe de
// `createElement`, de atributos ni de orden de nodos. Solo comparar lo que
// realmente se pintó sirve.
//
// Cómo se usa:
//
//   1. node herramientas/capturar-arbol.js herramientas/linea-base-arbol.json
//      <- antes de tocar nada
//   2. se refactoriza
//   3. node herramientas/comparar-arbol.js
//      <- tiene que decir "idéntico"
//
// Sale con código 0 si dio lo mismo, 1 si algo cambió. Así puede ser un paso
// de verificación, igual que `verificar-layout.js`.
//
// Lo que este script NO hace: arreglar diferencias. Si algo cambió, hay que
// ir a mirarlo. Un script que "arregla" la línea base para que pase es peor que
// uno que falla.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
const BASE = path.join(__dirname, 'linea-base-arbol.json');
const CAPTURAR = path.join(__dirname, 'capturar-arbol.js');

// Los campos que tienen que ser idénticos, campo por campo.
const CAMPOS = [
    ['html', 'el HTML del árbol'],
    ['nodosMateria', 'cantidad de nodos materia'],
    ['nodosDoc', 'cantidad de nodos documento'],
    ['botones', 'cantidad de botones'],
    ['orden', 'el orden de los nodos'],
    ['errores', 'los errores de la página']
];

function cargar(archivo) {
    return JSON.parse(fs.readFileSync(archivo, 'utf8'));
}

/**
 * Muestra dónde se diferencia primera vez.
 *
 * No devuelve una ventana alrededor: devuelve **la cola desde donde dejan de
 * coincidir**. Con una ventana de ±40, el prefijo común tapaba la diferencia
 * y las dos líneas se veían iguales.
 */
function dondeSeDifieren(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return null;

    // Prefijo común.
    let i = 0;
    const n = Math.min(a.length, b.length);
    while (i < n && a[i] === b[i]) i++;

    // Sufijo común: se recorta de la cola para no repetir lo de después.
    let j = 0;
    while (j < n - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;

    const antesCola = j ? a.slice(i, a.length - j) : a.slice(i);
    const despuesCola = j ? b.slice(i, b.length - j) : b.slice(i);

    return {
        comun: i,
        antes: `${i === 0 ? '' : '…'}${antesCola}${j ? '…' : ''}`,
        despues: `${i === 0 ? '' : '…'}${despuesCola}${j ? '…' : ''}`
    };
}

/** Deja la ventana legible: una sola línea, sin cortar palabras a la mitad. */
function recortar(texto) {
    const t = String(texto).replace(/\s+/g, ' ');
    if (t.length <= 70) return t;
    return t.slice(0, 70) + '…';
}

(async function main() {
    if (!fs.existsSync(BASE)) {
        console.error(`  No existe la línea base: ${path.relative(RAIZ, BASE)}`);
        console.error('  Generala con: node herramientas/capturar-arbol.js ' +
            'herramientas/linea-base-arbol.json');
        process.exit(1);
    }

    // Se captura en un archivo aparte para no pisar la línea base. Si se
    // escribiera encima, un cambio se compararía contra sí mismo y siempre
    // daría "idéntico".
    const temporal = path.join(os.tmpdir(), `arbol-actual-${process.pid}.json`);

    console.log('  Capturando el árbol actual...');
    const corrida = spawnSync(process.execPath, [CAPTURAR, temporal], {
        encoding: 'utf8',
        cwd: RAIZ
    });

    process.stdout.write(corrida.stdout || '');
    if (corrida.stderr) process.stderr.write(corrida.stderr);

    if (!fs.existsSync(temporal)) {
        console.error('  La captura no produjo archivo. No se puede comparar.');
        process.exit(1);
    }

    const antes = cargar(BASE);
    const ahora = cargar(temporal);

    console.log('');
    console.log('  Comparando contra la línea base del ' +
        new Date(antes.generado).toLocaleString('es'));
    console.log('');

    let diferencias = 0;
    let casosAntes = new Map(antes.captura.map(c => [c.nombre, c]));
    let casosAhora = new Map(ahora.captura.map(c => [c.nombre, c]));

    // Casos que estaban en la base y ya no están, o al revés.
    for (const nombre of casosAntes.keys()) {
        if (!casosAhora.has(nombre)) {
            console.log(`  [FALTA] ${nombre} — estaba en la línea base y no se capturó`);
            diferencias++;
        }
    }
    for (const nombre of casosAhora.keys()) {
        if (!casosAntes.has(nombre)) {
            console.log(`  [NUEVO] ${nombre} — se capturó y no estaba en la línea base`);
            diferencias++;
        }
    }

    for (const [nombre, antesCaso] of casosAntes) {
        const ahoraCaso = casosAhora.get(nombre);
        if (!ahoraCaso) continue;

        const cambios = [];

        for (const [campo, que] of CAMPOS) {
            const a = antesCaso[campo];
            const b = ahoraCaso[campo];

            const igual = Array.isArray(a) && Array.isArray(b)
                ? JSON.stringify(a) === JSON.stringify(b)
                : a === b;

            if (!igual) {
                cambios.push({ campo, que, a, b });
            }
        }

        if (cambios.length === 0) {
            console.log(`  [igual] ${nombre}`);
            continue;
        }

        diferencias++;
        console.log(`  [CAMBIÓ] ${nombre}`);

        for (const c of cambios) {
            console.log(`      ${c.que}:`);

            const esTexto = typeof c.a === 'string' && typeof c.b === 'string';
            const donde = esTexto ? dondeSeDifieren(c.a, c.b) : null;

            if (donde) {
                // Solo desde donde dejan de coincidir. Volcar el HTML entero
                // (3.000 caracteres) esconde justamente lo que hay que ver.
                console.log(`        antes : ${recortar(donde.antes)}`);
                console.log(`        despues: ${recortar(donde.despues)}`);
                console.log(`        (primeros ${donde.comun} caracteres iguales)`);
            } else {
                console.log(`        antes : ${JSON.stringify(c.a)}`);
                console.log(`        después: ${JSON.stringify(c.b)}`);
            }
        }
    }

    try { fs.rmSync(temporal, { force: true }); } catch { /* dejarlo */ }

    console.log('');
    if (diferencias === 0) {
        console.log('  IDÉNTICO. El árbol lateral se ve exactamente igual.');
        console.log('  El refactor no cambió nada de lo que se ve.');
        process.exit(0);
    }

    console.log(`  ${diferencias} diferencia(s).`);
    console.log('');
    console.log('  Dos cosas que puede ser:');
    console.log('    1. El refactor cambió algo. -> corregir el código.');
    console.log('    2. La línea base quedó vieja.  -> mirar antes de regenerarla.');
    console.log('');
    console.log('  Regenerar la línea base a ciegas hace que el error se vuelva');
    console.log('  permanente, porque el siguiente refactor va a comparar contra');
    console.log('  algo que ya estaba mal.');
    process.exit(1);
})();
// ============================================
// TESTS - Los permisos de los agentes de .opencode/
// Ejecutar: node --test
// Cubre: las reglas de .opencode/agents/ del proyecto
// Ver: AGENTS.md, seccion "El flujo de trabajo real esta en .opencode/"
// ============================================
//
// Por que existe: el `permission` de un agente es una barrera, y una barrera
// que nadie vigila es una barrera de papel. Estos tests la vigilan.
//
// Dos cosas que se rompieron y que estos tests atrapan:
//
// 1. `shell` y `subagent` no son nombres de permiso que OpenCode reconozca.
//    El schema los acepta igual, porque tiene `additionalProperties`, y ahi
//    esta el problema: una clave que nadie mira no da error, da falsa
//    seguridad. Los nombres documentados son `bash` (correr comandos) y `task`
//    (lanzar subagentes). Como no se puede saber desde aca cual de los dos
//    esta vivo en cada version, cada capacidad denegada se escribe con LOS
//    DOS nombres: si uno no lo mira, lo mira el otro, y ninguno rompe nada
//    porque `additionalProperties` acepta los dos.
//
// 2. El `edit` del planner tiene que seguir siendo `specs/**` y nada mas.
//    Ese limite es lo que le permite redactar specs sin tocar codigo. Si
//    alguien lo agranda a `js/**`, o cambia el `"*": deny` por un `allow`,
//    el planner empieza a poder escribir codigo y nadie se entera hasta que
//    un cambio aparece en un archivo que no deberia.
//
// El cuarto test es de otra familia, pero estaba esperando: el comando
// `ssd-task.md` (hoy `sdd-task.md`) abria su frontmatter con `--` en vez de
// `---`. No daba error: el archivo se leia igual, pero OpenCode no parseaba
// el bloque, y el comando perdia el `agent:` que lo definia. Un delimitador
// mal escrito es indistinguible de un archivo correcto si nadie lo mira.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const CARPETA = path.join(__dirname, '..', '.opencode', 'agents');

// Los cuatro agentes del proyecto. `cordinator` sin la "o", a proposito:
// el archivo se llama asi y se carga por `mode: primary`.
const AGENTES = ['cordinator', 'planner', 'implementer', 'reviewer'];

// Cada capacidad, con los dos nombres con los que se puede escribir.
// El primero es el que documenta OpenCode; el segundo es el que estaba
// escrito en el proyecto. Se exigen los dos.
const CAPACIDADES = [
    { nombre: 'shell', aliases: ['bash', 'shell'] },
    { nombre: 'subagent', aliases: ['task', 'subagent'] },
];

// ---- Utilidades ----------------------------------------------------------

// Lee el bloque de frontmatter de un archivo de agente. Devuelve null si no
// hay frontmatter, que ya es un fallo: un agente sin `mode` no se carga.
function leerFrontmatter(nombre) {
    const ruta = path.join(CARPETA, `${nombre}.md`);
    const texto = fs.readFileSync(ruta, 'utf8');
    const lineas = texto.split(/\r?\n/);

    // El delimitador de apertura tiene que ser exactamente `---`. Con `--` el
    // archivo no tiene frontmatter, por mas que se lea bien de entrada.
    if (lineas[0].trim() !== '---') return null;

    const cierre = lineas.findIndex((linea, i) => i > 0 && linea.trim() === '---');
    if (cierre === -1) return null;

    return parsearBloque(lineas.slice(1, cierre));
}

// Parser de un subconjunto de YAML: mapas anidados por sangria y valores
// simples. No hay listas ni anclas en un frontmatter de agente, asi que no
// hace falta mas. Sin librerias: el proyecto no tiene package.json.
function parsearBloque(lineas) {
    const raiz = {};
    const pila = [{ sangria: -1, nodo: raiz }];

    for (const linea of lineas) {
        if (linea.trim() === '') continue;

        const sangria = linea.length - linea.trimStart().length;
        const cuerpo = linea.trim();

        const corte = cuerpo.indexOf(':');
        if (corte === -1) continue;

        const clave = sinComillas(cuerpo.slice(0, corte).trim());
        const valor = sinComillas(cuerpo.slice(corte + 1).trim());

        // Sube mientras la sangria no sea mas profunda que la del padre.
        while (pila.length > 1 && sangria <= pila[pila.length - 1].sangria) {
            pila.pop();
        }
        const padre = pila[pila.length - 1].nodo;

        if (valor === '') {
            const hijo = {};
            padre[clave] = hijo;
            pila.push({ sangria, nodo: hijo });
        } else {
            padre[clave] = valor;
        }
    }

    return raiz;
}

function sinComillas(texto) {
    return texto.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
}

// ---- Los permisos del planner -------------------------------------------

test('el planner solo puede escribir dentro de specs/', () => {
    const fm = leerFrontmatter('planner');
    assert.notEqual(fm, null, 'planner.md tiene que tener frontmatter');

    const edit = fm.permission && fm.permission.edit;
    assert.equal(typeof edit, 'object', 'el edit del planner tiene que ser un mapa por ruta');

    // El primero: un catch-all que niegue todo.
    assert.equal(edit['*'], 'deny', 'el planner necesita un "*": deny antes de cualquier allow');

    // El segundo: la unica escritura permitida.
    assert.equal(edit['specs/**'], 'allow', 'la unica ruta que el planner puede escribir es specs/**');
});

test('el planner no tiene ninguna otra escritura permitida', () => {
    const edit = leerFrontmatter('planner').permission.edit;

    const permitidas = Object.keys(edit).filter((clave) => edit[clave] === 'allow');
    assert.deepEqual(
        permitidas,
        ['specs/**'],
        `el planner solo puede escribir en specs/**, y estas reglas lo amplian: ${permitidas.join(', ')}`
    );
});

test('los otros tres agentes no declaran ninguna escritura permitida por ruta', () => {
    // El implementer necesita escribir en js/ y test/, y por eso no declara
    // `edit`: no le hace falta. Lo que no puede hacer es abrirse un mapa con
    // un `allow`, que es la forma de ampliar permisos sin querer.
    for (const nombre of ['cordinator', 'implementer', 'reviewer']) {
        const fm = leerFrontmatter(nombre);
        assert.notEqual(fm, null, `${nombre}.md tiene que tener frontmatter`);

        const edit = fm.permission && fm.permission.edit;
        if (edit === undefined || typeof edit === 'string') continue;

        const permitidas = Object.keys(edit).filter((clave) => edit[clave] === 'allow');
        assert.deepEqual(
            permitidas,
            [],
            `${nombre}.md no necesita ningun allow de escritura: lo tiene por omision`
        );
    }
});

// ---- Las claves que no existen -------------------------------------------

test('cada capacidad denegada esta escrita con los dos nombres', () => {
    for (const nombre of AGENTES) {
        const fm = leerFrontmatter(nombre);
        assert.notEqual(fm, null, `${nombre}.md tiene que tener frontmatter`);

        const permisos = fm.permission || {};

        for (const { nombre: capacidad, aliases } of CAPACIDADES) {
            const presentes = aliases.filter((clave) => permisos[clave] !== undefined);
            if (presentes.length === 0) continue; // no la nombra: no hay nada que parear

            assert.deepEqual(
                presentes.sort(),
                [...aliases].sort(),
                `${nombre}.md deniega "${capacidad}" con un solo nombre (${presentes.join(', ')}). ` +
                'OpenCode documenta ' + aliases[0] + ' y en el proyecto se escribia ' + aliases[1] +
                ': hace falta el par, porque una clave que no se mira no da error, da falsa seguridad.'
            );
        }
    }
});

// ---- El frontmatter en si -----------------------------------------------

test('los cuatro agentes tienen el frontmatter bien cerrado y declaran su mode', () => {
    // El coordinador es el unico `primary`: se carga solo, sin que nadie lo
    // llame, y por eso no se lo busca por nombre de archivo sino por su mode.
    // Los otros tres son `subagent`: no se activan solos.
    const ESPERADO = {
        cordinator: 'primary',
        planner: 'subagent',
        implementer: 'subagent',
        reviewer: 'subagent',
    };

    for (const nombre of AGENTES) {
        const texto = fs.readFileSync(path.join(CARPETA, `${nombre}.md`), 'utf8');
        const lineas = texto.split(/\r?\n/);

        assert.equal(lineas[0].trim(), '---', `${nombre}.md tiene que abrir con tres guiones`);
        assert.equal(
            lineas.findIndex((linea, i) => i > 0 && linea.trim() === '---') > 0,
            true,
            `${nombre}.md tiene que cerrar el frontmatter con tres guiones`
        );

        const fm = leerFrontmatter(nombre);
        assert.equal(
            fm.mode,
            ESPERADO[nombre],
            `${nombre}.md declara mode: ${ESPERADO[nombre]}`
        );
    }
});
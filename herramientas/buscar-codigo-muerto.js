// ============================================
// Encuentra código muerto en js/
// Ejecutar: node herramientas/buscar-codigo-muerto.js
// Salida:  0 si no encontró nada, 1 si encontró
// ============================================
//
// El código muerto es el más difícil de ver, porque no rompe nada: no tira
// error, no aparece en la consola, ningún test se pone rojo. La única señal es
// que un símbolo aparece **una sola vez** en todo el proyecto: en su
// declaración.
//
// Esta herramienta mira dos cosas:
//
//   1. Exportaciones sin consumidores. Cada módulo termina con un
//      `const API = { ... }` que se publica como `window.Algo`. Si nadie usa
//      esa clave, es una puerta que no lleva a ningún lado.
//
//   2. Declaraciones sueltas sin usar. Una `function` o una `const` a nivel de
//      módulo que no se exporta y que no aparece en ningún otro lugar: ni en el
//      código, ni en `index.html`, ni en los tests, ni en las herramientas.
//
// Lo que NO puede ver, y hay que saber:
//
//   - **Un nombre puede quedar tapado.** Si un módulo declara `const total` y
//     otra función declara `total` local, el conteo da 2 y la función de arriba
//     parece usada. Es un falso negativo: la herramienta calla y el código
//     muerto sigue.
//   - **No mira `js/datos.js`**, que no está cargado por `index.html`.
//   - No sabe si algo se usa desde la consola del navegador. Si alguien pega un
//     nombre a mano en la consola, esto lo sigue marcando como muerto.
//
// Por eso es un paso de verificación, no una prueba. Lo que decide es si algo
// se borra, y para eso hay que abrir el código y confirmarlo a mano.

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

// Palabras que el analizador no debe tomar por código: son identificadores que
// existen, pero no los define este proyecto.
const RESERVADAS = new Set([
    'module', 'exports', 'window', 'document', 'console', 'require',
    'function', 'return', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
    'new', 'this', 'typeof', 'null', 'true', 'false', 'undefined'
]);

function archivosCon(extension, carpeta) {
    const base = path.join(RAIZ, carpeta);
    const salida = [];
    if (!fs.existsSync(base)) return salida;

    for (const entrada of fs.readdirSync(base, { withFileTypes: true })) {
        const completo = path.join(base, entrada.name);
        if (entrada.isDirectory()) salida.push(...archivosCon(extension, path.join(carpeta, entrada.name)));
        else if (entrada.name.endsWith(extension)) salida.push(completo);
    }
    return salida;
}

function leer(ruta) {
    return fs.readFileSync(ruta, 'utf8');
}

// --- Sacar los comentarios antes de contar ---
//
// Un comentario no es un uso. `js/interfaz/visor.js` menciona `escapeHtml` dos
// veces, y las dos están en comentarios que explican el error de XSS que se
// corrigió. Contarlas hacía que la función pareciera viva: la herramienta
// reportaba que no había nada que borrar mientras `escapeHtml` llevaba años sin
// usarse.
//
// Solo se borran `/* ... */` y las líneas que arrancan con `//` o `*`. Un
// borrador ingenuo que sacara todo lo que va después de `//` rompería con las
// direcciones web: en `app.js` hay `https://cdnjs.cloudflare.com/...`, y ahí la
// barra dupla no comenta nada.
//
// Los comentarios se reemplazan por espacios, **conservando los saltos de
// línea**: si no, cada línea después de un comentario correria de número y la
// herramienta apuntaría a la línea equivocada.

function sinComentarios(codigo) {
    return codigo
        .replace(/\/\*[\s\S]*?\*\//g, bloque => bloque.replace(/[^\n]/g, ' '))
        .split('\n')
        .map(linea => (/^\s*(\/\/|\*|\/\*)/.test(linea) ? '' : linea))
        .join('\n');
}

// El código de cada módulo, sin comentarios, cacheado. Para contar.
function limpio(modulo) {
    if (modulo._limpio === undefined) modulo._limpio = sinComentarios(modulo.codigo);
    return modulo._limpio;
}

// --- Los módulos que de verdad se cargan ---

const INDEX = leer(path.join(RAIZ, 'index.html'));
const cargados = [...INDEX.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);

const modulos = archivosCon('.js', 'js')
    .map(ruta => ({
        ruta,
        nombre: path.relative(RAIZ, ruta).replace(/\\/g, '/'),
        codigo: leer(ruta)
    }))
    .filter(m => cargados.includes(m.nombre));

// `js/datos.js` no está en index.html: no se carga, no puede tener consumidores.
const noCargados = archivosCon('.js', 'js')
    .map(ruta => ({ nombre: path.relative(RAIZ, ruta).replace(/\\/g, '/') }))
    .filter(m => !cargados.includes(m.nombre))
    .map(m => m.nombre);

// --- Dónde puede aparecer un uso ---

const otros = modulos.filter(m => true);
const tests = archivosCon('.js', 'test').map(leer);
const herramientas = archivosCon('.js', 'herramientas').map(leer);
const specs = archivosCon('.md', 'specs').map(leer);

function cuentaUsos(nombre, codigo) {
    const patron = new RegExp('\\b' + nombre + '\\b', 'g');
    return (codigo.match(patron) || []).length;
}

// Cuenta solo las apariciones que son **el nombre en el código**: no cuenta la
// de `algo.nombre`, ni la de un texto entre comillas.
//
// Hace falta por dos casos que la herramienta daba por vivos sin serlo:
//
//   const calendarioMapa = document.getElementById('calendarioMapa')
//   → dos apariciones del nombre, y las dos son la declaración. Con el conteo
//     crudo, "se usa adentro" y la herramienta la daba por viva.
//
//   const existeFecha = FechasLogica.existeFecha
//   → igual: el nombre aparece en el miembro y en la declaración.
//
// La diferencia entre "el nombre" y "el nombre dicho en otro contexto" es la
// diferencia entre código y ruido.

function usosDeCodigo(nombre, codigo) {
    const patron = new RegExp('\\b' + nombre + '\\b', 'g');
    let cuenta = 0;
    let m;
    while ((m = patron.exec(codigo)) !== null) {
        const antes = codigo.slice(Math.max(0, m.index - 3), m.index);
        const despues = codigo.slice(m.index + nombre.length, m.index + nombre.length + 1);
        // `...base` es un reparto, no un acceso a miembro. Se lo saltaba como
        // si fuera `objeto.base` y por eso `base` parecía sin usar en
        // almacenamiento.js, donde se reparte en cada respuesta.
        if (antes.endsWith('...')) { cuenta++; continue; }
        if (antes.endsWith('.')) continue;                    // algo.nombre
        if (antes.endsWith("'") || despues === "'") continue; // 'nombre'
        if (antes.endsWith('"') || despues === '"') continue; // "nombre"
        cuenta++;
    }
    return cuenta;
}

// --- 1. Exportaciones ---

// Tres categorías, y la diferencia importa:
//
//   MUERTO      No la usa nadie, ni siquiera el propio módulo. Se borra la
//               función entera.
//   SOBRANTE    La usa su propio módulo, pero nadie la pide de afuera. La
//               función se queda; se le saca la línea del `API`.
//   SOLO ESCRITA Se le asigna y nunca se lee. No es un export: es una bandera
//               que nadie consulta.
//
// La diferencia entre las dos primeras es la razón por la que el plan tiene
// grupos separados: borrar una función y borrar solo su exportación son
// operaciones de riesgo distinto.

const exportsMuertos = [];
const exportsSobrantes = [];

// El HTML va sin comentarios: un `id` en `index.html` del que salió la
// variable **no es un uso de la variable**. `const calendarioMapa =
// document.getElementById('calendarioMapa')` menciona el nombre dos veces si se
// cuenta el HTML, y la herramienta lo daba por usado.
const INDEX_LIMPIO = sinComentarios(INDEX);

for (const modulo of modulos) {
    const i = limpio(modulo).indexOf('const API = {');
    if (i === -1) continue;
    const j = limpio(modulo).indexOf('};', i);
    if (j === -1) continue;

    const cuerpo = limpio(modulo).slice(i, j);

    // El último nombre del objeto no lleva coma: `{ a, b, c }`. Como el
    // `slice` corta justo antes de la `}` de cierre, ese nombre queda al final
    // de la cadena y un patrón que exige coma o llave **no lo encuentra**.
    //
    // Consecuencia: `estaOculto` y `DIAS_EN_LA_SEMANA` —los dos últimos de sus
    // objetos— desaparecían del informe. Justamente los dos que T6 iba a
    // borrar. Una herramienta que se salta el último elemento de una lista es
    // una herramienta que se salta lo que uno busca.
    //
    // Se usa una mirada hacia adelante en vez de consumir la coma.
    const nombres = [...new Set(
        [...cuerpo.matchAll(/(\w+)\s*(?=[,}]|$)/gm)].map(m => m[1])
    )].filter(n => n !== 'API' && !RESERVADAS.has(n)).sort();

    for (const nombre of nombres) {
        let enCodigo = 0;
        for (const otro of modulos) {
            if (otro.nombre === modulo.nombre) continue;
            enCodigo += cuentaUsos(nombre, limpio(otro));
        }

        const enHtml = cuentaUsos(nombre, INDEX_LIMPIO);
        const enTest = tests.reduce((a, t) => a + cuentaUsos(nombre, t), 0);

        if (enCodigo > 0 || enHtml > 0) continue;   // alguien la usa de verdad

        // ¿La usa su propio módulo? Hay que descontar dos cosas que no son uso:
        // la línea del `API` y la declaración misma. Sin descontar la
        // declaración, toda función parecería "usada adentro" por el hecho de
        // existir, y ninguna se marcaría como muerta.
        // Mismo detalle que arriba: el último nombre del objeto no tiene coma,
        // así que el patrón tiene que mirar hacia adelante también. Con la
        // versión que exigía coma, `estaOculto` salía como "usada adentro"
        // porque su línea del API no se contaba, y al final no se marcaba como
        // muerta.
        const enElApi = new RegExp(
            '(^|[,\\s])' + nombre + '\\s*(?=[,}]|$)', 'm').test(cuerpo);
        const esDeclaracion = new RegExp(
            '^(?:function\\s+' + nombre + '\\b|(?:const|let|var)\\s+' + nombre + '\\b)', 'm'
        ).test(limpio(modulo));

        const interno = cuentaUsos(nombre, limpio(modulo)) - (enElApi ? 1 : 0) - (esDeclaracion ? 1 : 0);

        if (interno > 0) {
            exportsSobrantes.push({ modulo: modulo.nombre, nombre, enTest });
        } else {
            exportsMuertos.push({ modulo: modulo.nombre, nombre, enTest });
        }
    }
}

// --- 1.b. Símbolos a nivel de módulo que solo se escriben, nunca se leen ---

// Una bandera que se pone y nadie consulta. Es el caso de
// `escriturasBloqueadas`: se escribía en cuatro lugares y no se leía en
// ninguno.
//
// Cuenta como "escrito" un uso seguido de `=` que no sea `==`, y como "leído"
// todo lo demás, incluido `obj.campo` —que es leer el objeto, no escribir en
// la variable—.

const soloEscritos = [];

function esEscritura(codigo, nombre, indice) {
    const antes = codigo.slice(Math.max(0, indice - 2), indice);
    const despues = codigo.slice(indice + nombre.length, indice + nombre.length + 2);
    if (/[.\w$]$/.test(antes)) return false;           // algo.campo: leer
    if (/^\s*=(?!=)/.test(despues)) return true;        // nombre = algo: escribir
    return false;
}

for (const modulo of modulos) {
    const patron = /^\s*(?:let|var)\s+([A-Za-z_$][\w$]*)/gm;
    const codigo = limpio(modulo);
    let m;
    while ((m = patron.exec(codigo)) !== null) {
        const nombre = m[1];
        if (RESERVADAS.has(nombre)) continue;

        const re = new RegExp('\\b' + nombre + '\\b', 'g');
        const todos = [...codigo.matchAll(re)];
        if (todos.length < 2) continue;                 // declarado y nada más

        const lecturas = todos.filter(t => !esEscritura(codigo, nombre, t.index)).length;
        const fuera = modulos
            .filter(o => o.nombre !== modulo.nombre)
            .reduce((a, o) => a + cuentaUsos(nombre, limpio(o)), 0);

        // `lecturas === 0`, no `<= 1`. La línea `let x = false` cuenta como
        // escritura —termina en `=`—, así que una lectura de verdad ya es la
        // primera. Con `<= 1` salían `avisoMostrado` y `pdfRendering`, que sí se
        // leen: un umbral mal puesto hace que la herramienta grite sobre código
        // vivo, y una herramienta que grita de más deja de escucharse.
        if (lecturas === 0 && fuera === 0) {
            const linea = codigo.slice(0, m.index).split('\n').length;
            soloEscritos.push({
                modulo: modulo.nombre,
                nombre,
                linea,
                asignaciones: todos.length - lecturas
            });
        }
    }
}

// --- 2. Declaraciones sueltas sin usar ---

// `function nombre(` o `const|let|var nombre =`, en cualquier sangría.
//
// La sangría importa: todo lo que está dentro del IIFE va indentado, y con el
// ancla en el principio de la línea la herramienta no veía **ninguna**
// declaración interna. La categoría B salía vacía y parecía que no había
// código muerto, cuando había tres funciones sin usar.
const declaracion = /^\s*(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

const declaracionesMuertas = [];

for (const modulo of modulos) {
    const codigo = limpio(modulo);
    const api = (() => {
        const i = codigo.indexOf('const API = {');
        if (i === -1) return '';
        const j = codigo.indexOf('};', i);
        return j === -1 ? '' : codigo.slice(i, j);
    })();

    const lineas = codigo.split('\n');
    let m;
    declaracion.lastIndex = 0;
    while ((m = declaracion.exec(codigo)) !== null) {
        const nombre = m[1];
        if (RESERVADAS.has(nombre)) continue;
        if (api.includes(nombre)) continue;          // exportada: la ve el grupo 1
        if (usosDeCodigo(nombre, codigo) > 1) continue;   // se usa adentro

        // ¿Lo usa alguien más? Solo el código cuenta como vida. Los tests, las
        // herramientas y las specs se anotan aparte, porque **no son
        // consumidores**: un test que ejercita código muerto es parte del
        // código muerto, y una spec que dice "esto antes llamaba a
        // `escapeHtml`" es un relato, no una llamada.
        //
        // Contarlas como vida dejaba la lista vacía: las specs mencionan casi
        // todo lo que se borró alguna vez, y la herramienta terminaba
        // diciendo que no había nada que limpiar.
        let fuera = 0;
        for (const otro of modulos) {
            if (otro.nombre === modulo.nombre) continue;
            fuera += usosDeCodigo(nombre, limpio(otro));
        }

        // Si la variable salió de un `getElementById` con su mismo nombre, el
        // `id` del HTML no cuenta: es el origen de la variable, no un uso.
        const delId = new RegExp(
            'getElementById\\(\\s*[\'"]' + nombre + '[\'"]\\s*\\)').test(codigo);
        const enHtml = delId ? 0 : cuentaUsos(nombre, INDEX_LIMPIO);

        const enTest = tests.reduce((a, t) => a + cuentaUsos(nombre, t), 0);
        const enHerramienta = herramientas.reduce((a, t) => a + cuentaUsos(nombre, t), 0);
        const enSpec = specs.reduce((a, t) => a + cuentaUsos(nombre, t), 0);

        if (fuera === 0 && enHtml === 0) {
            const linea = codigo.slice(0, m.index).split('\n').length;
            const menciones = [];
            if (enTest > 0) menciones.push(enTest + ' en tests');
            if (enHerramienta > 0) menciones.push(enHerramienta + ' en herramientas');
            if (enSpec > 0) menciones.push(enSpec + ' en specs');
            declaracionesMuertas.push({
                modulo: modulo.nombre,
                nombre,
                linea,
                enTest,
                enSpec,
                menciones,
                texto: lineas[linea - 1].trim().slice(0, 60)
            });
        }
    }
}

// --- Excepciones conocidas ---
//
// Símbolos que la herramienta reporta y que **no hay que borrar**: se decidió
// conservarlos. Sin esta lista, el informe los mezcla con lo que sí hay que
// limpiar, y el control sale con código 1 siempre. Un paso de verificación que
// se sabe que falla es ruido: la primera vez que dé rojo de verdad, que es
// cuando importa, nadie lo va a mirar.
//
// El motivo va en la misma línea, y a propósito. Una excepción sin el motivo al
// lado termina borrada: en seis meses va a quedar la lista y nadie va a
// recordar por qué.
//
// La lista se armó con lo que la herramienta **reportó**, no de memoria. Una
// excepción para algo que no aparece en el informe no tapa nada: solo esconde
// el error de haberla agregado.
//
// Y se mantiene sola: si un símbolo de acá deja de estar muerto, porque alguien
// lo conectó, la herramienta avisa que la excepción sobró. El día que se
// conecte RF-12 no hay que acordarse de sacar nada.

const EXCEPCIONES = [
    {
        simbolo: 'registrarConsentimiento',
        motivo: 'RF-12 se decidió fuera de alcance el 2026-10-02: sin identidades no hay cuaderno ajeno. Se conserva como andamiaje'
    },
    {
        simbolo: 'tieneConsentimiento',
        motivo: 'RF-12 se decidió fuera de alcance el 2026-10-02: sin identidades no hay cuaderno ajeno. Se conserva como andamiaje'
    },
    {
        simbolo: 'revocarConsentimiento',
        motivo: 'RF-12 se decidió fuera de alcance el 2026-10-02: sin identidades no hay cuaderno ajeno. Se conserva como andamiaje'
    },
    {
        simbolo: 'existeFecha',
        motivo: 'Regla de fechas correcta, con 18 tests. Borrarla sería sacar algo que el calendario podría necesitar'
    },
    {
        simbolo: 'contenidosEnMemoria',
        motivo: 'Sonda para un requisito, decidida el 2026-10-05 (spec 008, T5): el contenido de los documentos NO se carga al arrancar, se pide al abrir. Sin una forma de contar lo que hay en memoria, ese requisito no se puede comprobar —y un requisito que no se puede medir no es un requisito. Si algún día la app lo consulta, sacar la excepción: la herramienta avisa'
    }
];

function esExcepcion(simbolo) {
    return EXCEPCIONES.some(e => e.simbolo === simbolo);
}

function motivoDe(simbolo) {
    const e = EXCEPCIONES.find(x => x.simbolo === simbolo);
    return e ? e.motivo : null;
}

// --- Informe ---

const titulo = 'Buscar código muerto';
console.log('='.repeat(60));
console.log(titulo);
console.log('='.repeat(60));
console.log('');
console.log('  Módulos cargados por index.html: ' + modulos.length);
if (noCargados.length) {
    console.log('  NO cargados (no pueden tener consumidores): ' + noCargados.join(', '));
}
console.log('');

if (exportsMuertos.length) {
    console.log('  A · FUNCIONES SIN CONSUMIDOR (' + exportsMuertos.length + ')');
    console.log('    Se usan ni adentro ni afuera. Se borra la función entera.');
    console.log('  ────────────────────────────────────────────────────────');
    for (const e of exportsMuertos) {
        const exc = esExcepcion(e.nombre);
        console.log('  ' + e.modulo + '  →  ' + e.nombre
            + (e.enTest > 0 ? '   (' + e.enTest + ' menciones en tests)' : '')
            + (exc ? '   [excepción: no borrar]' : ''));
        if (exc) console.log('      ' + motivoDe(e.nombre));
    }
    console.log('');
}

if (declaracionesMuertas.length) {
    console.log('  B · DECLARACIONES SIN USAR (' + declaracionesMuertas.length + ')');
    console.log('    No se exportan y no se usan. Se borran enteras.');
    console.log('  ────────────────────────────────────────────────────────');
    for (const d of declaracionesMuertas) {
        const exc = esExcepcion(d.nombre);
        console.log('  ' + d.modulo + ':' + d.linea + '  →  ' + d.nombre
            + (exc ? '   [excepción: no borrar]' : ''));
        console.log('      ' + d.texto);
        if (exc) console.log('      ' + motivoDe(d.nombre));
        if (!exc && d.menciones && d.menciones.length) {
            console.log('      mencionada en: ' + d.menciones.join(', '));
            console.log('      (esas menciones no la mantienen viva: hay que decidir');
            console.log('       qué se actualiza cuando se borre)');
        }
    }
    console.log('');
}

if (soloEscritos.length) {
    console.log('  C · ASIGNADAS Y NUNCA LEÍDAS (' + soloEscritos.length + ')');
    console.log('    Se les pone valor y nadie las consulta. Se borran.');
    console.log('  ────────────────────────────────────────────────────────');
    for (const s of soloEscritos) {
        console.log('  ' + s.modulo + ':' + s.linea + '  →  ' + s.nombre
            + '   (' + s.asignaciones + ' asignaciones, 0 lecturas)');
    }
    console.log('');
}

if (exportsSobrantes.length) {
    // De las exports sobrantes, algunas se exportan **a propósito** para que un
    // test las pueda llamar. Esas no son un problema: son la puerta de entrada
    // de la prueba. Solo son sobrantes de verdad las que no tienen ni código
    // ni test detrás.
    const deVerdad = exportsSobrantes.filter(e => e.enTest === 0);
    const paraProbar = exportsSobrantes.filter(e => e.enTest > 0);

    if (deVerdad.length) {
        console.log('  D · EXPORTACIONES QUE SOBRAN DE VERDAD (' + deVerdad.length + ')');
        console.log('    La función se usa adentro, pero ni el código ni ningún');
        console.log('    test la piden de afuera. Se saca la línea del API.');
        console.log('  ────────────────────────────────────────────────────────');
        for (const e of deVerdad) {
            console.log('  ' + e.modulo + '  →  ' + e.nombre);
        }
        console.log('');
    }

    if (paraProbar.length) {
        console.log('  E · EXPORTADAS PARA PODER PROBARLAS (' + paraProbar.length + ')');
        console.log('    Nadie las usa en la app, pero un test las importa. No son');
        console.log('    un problema: son la puerta de entrada de la prueba.');
        console.log('    >>> NO CUENTAN para el código de salida.');
        console.log('  ────────────────────────────────────────────────────────');
        for (const e of paraProbar) {
            console.log('  ' + e.modulo + '  →  ' + e.nombre);
        }
        console.log('');
    }
}

// --- Las excepciones conocidas ---

// Se muestran aunque no queden pendientes: el que corre el control tiene que
// poder ver que existen y por qué, sin abrir este archivo.

if (EXCEPCIONES.length) {
    console.log('  F · EXCEPCIONES CONOCIDAS (' + EXCEPCIONES.length + ')');
    console.log('    Decidido conservarlas. No son un problema y no cuentan para');
    console.log('    el código de salida. Los motivos están en EXCEPCIONES.');
    console.log('  ────────────────────────────────────────────────────────');
    for (const e of EXCEPCIONES) {
        console.log('  ' + e.simbolo);
        console.log('      ' + e.motivo);
    }
    console.log('');
}

// Si una excepción dejó de estar justificada —porque su símbolo se conectó y
// ya no aparece en el informe— hay que decirlo. Una lista que se pudre en
// silencio es peor que no tener lista: silencia la señal justo cuando deja de
// servir.

const reportados = new Set([
    ...exportsMuertos, ...declaracionesMuertas, ...soloEscritos,
    ...exportsSobrantes
].map(x => x.nombre));

const sobrantes = EXCEPCIONES.filter(e => !reportados.has(e.simbolo));

if (sobrantes.length) {
    console.log('  ¡ATENCIÓN! Excepciones que ya no aplican (' + sobrantes.length + ')');
    console.log('  ────────────────────────────────────────────────────────');
    for (const e of sobrantes) {
        console.log('  ' + e.simbolo + ' ya no aparece en el informe.');
        console.log('      Se conectó, o se borró. La excepción quedó vieja:');
        console.log('      hay que sacarla de EXCEPCIONES.');
    }
    console.log('');
}

// Las categorías A, B y C y la parte de D son código muerto de verdad. La E —
// "exportadas para poder probar"— no lo es: son la puerta de entrada de los
// tests, y sacarlas desarmaría la suite. Las excepciones tampoco: son
// decisiones tomadas, no pendientes.

const esPendiente = lista => lista.filter(x => !esExcepcion(x.nombre));
const pendientes = {
    a: esPendiente(exportsMuertos),
    b: esPendiente(declaracionesMuertas),
    c: esPendiente(soloEscritos),
    d: esPendiente(exportsSobrantes.filter(e => e.enTest === 0))
};

const total = pendientes.a.length + pendientes.b.length
    + pendientes.c.length + pendientes.d.length;

if (total === 0) {
    console.log('  Nada que limpiar: lo que queda son excepciones conocidas.');
    console.log('');
    console.log('  Ojo: esto no ve un nombre tapado por otro del mismo nombre.');
    console.log('  Salida 0.');
    process.exit(0);
}

console.log('  Total a limpiar: ' + total);
console.log('  Salida 1: hay código muerto.');
process.exit(1);

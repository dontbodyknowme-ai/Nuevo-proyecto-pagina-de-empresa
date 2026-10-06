// ============================================
// LÓGICA PURA — Datos que no respetan las invariantes
// ============================================
//
// Qué hace: revisa las materias que vienen del almacenamiento o de un respaldo
// importado, completa lo que falta y anota qué estaba raro.
//
// ## Por qué existe
//
// Un respaldo importado puede traer datos que no son los que el código espera.
// Antes de este módulo no había nada que los revisara, y el resultado era que
// **un solo dato raro tumbaba la app entera**:
//
//     Uncaught TypeError: Cannot read properties of undefined (reading 'forEach')
//     Uncaught TypeError: Cannot read properties of undefined (reading 'minutosDeEstudioPorDia')
//
// El segundo error es consecuencia del primero: `construirArbol()` se llama
// durante el arranque, así que al fallar ahí se corta toda la inicialización y
// el mapa de calor nunca se dibuja. El efecto no era "esa materia no se ve":
// era que **desaparecía el menú lateral entero**.
//
// ## Las dos reglas
//
// 1. **Nunca se borra nada.** Un dato raro se completa, no se descarta. Un
//    documento sin contenido sigue en el menú, con su nombre, para que el
//    usuario lo vea y decida. Perderlo en silencio sería peor que mostrarlo roto.
//
// 2. **Un dato roto no tira la app.** Se anota como problema y se sigue. La
//    función no lanza nunca, por muy roto que venga el dato.
//
// ## Qué NO hace
//
// No corrige el contenido de un documento, no adivina un tipo de archivo, no
// repara un respaldo. Solo completa lo estructural para que la app pueda
// dibujarse, y dice qué encontró.
//
// Ver: specs/003-refactor-app/task.md (T6), principio 5 (los datos son sagrados)
//
// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo con
// `<script>` sus nombres chocarían con los de los demás archivos.
(function () {

// El estado de las secciones de estudio. Se usa para **no reimplementar** sus reglas: qué
// es un registro de minutos heredados válido y qué es una sección válida ya está decidido y
// probado allá. Si este módulo decidiera otra vez, las dos copias dirían cosas distintas.
//
// Ojo con el **orden de carga**: `js/datos/secciones.js` tiene que estar antes que este
// archivo. Está en `index.html` y en la lista `ORDEN` de `test/dom-falso.js`, y hay un test
// que compara las dos.
const SeccionesDatos = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('../datos/secciones.js')
    : window.SeccionesDatos;

// ---------- Generar ids para lo que no los tiene ----------

/**
 * Un id para lo que venga sin él.
 *
 * El menú lateral usa el id como `data-id`, y sin un id dos nodos no se
 * distinguen. Es lo único que se inventa, y solo cuando falta: si hay id, se
 * respeta el que vino.
 */
let contador = 0;

function idTemporal(prefijo) {
    contador++;
    return `${prefijo}_${Date.now().toString(36)}_${contador}`;
}

// ---------- Problemas ----------

/**
 * Anota un problema con un texto para mostrar.
 *
 * El mensaje va escrito para que el usuario lo entienda: dice qué pasó y
 * dónde. No dice "undefined" ni "error".
 */
function problema(tipo, mensaje, extra) {
    return { tipo, mensaje, ...(extra || {}) };
}

// ---------- Documentos ----------

/**
 * ¿Este documento se puede abrir?
 *
 * Un HTML vacío **sí** se puede abrir: sale un iframe en blanco, que es
 * honesto. Un PDF o un Word sin contenido no: no hay nada que cargar, y
 * antes de este módulo la app incluso intentaba una petición de red con
 * `fetch(undefined)`.
 */
function documentoSinContenido(doc) {
    if (!doc || typeof doc !== 'object') return true;
    if (doc.tipo === 'html') return false;
    return !doc.contenido;
}

function normalizarDocumento(doc, materia, problemas) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        problemas.push(problema(
            'documento-invalido',
            `En la materia "${materia.nombre}" hay un elemento que no es un documento y se omitió.`
        ));
        return null;
    }

    // Se copia, no se reescribe el original: los datos del usuario no se tocan.
    const salida = { ...doc };

    if (salida.id === undefined || salida.id === null || salida.id === '') {
        salida.id = idTemporal('d');
        problemas.push(problema(
            'documento-sin-id',
            `El documento "${nombreDe(salida)}" no tenía identificador y se le dio uno.`
        ));
    }

    if (salida.nombre === undefined || salida.nombre === null) {
        salida.nombre = '';
    }

    // El contenido ausente NO se borra ni se inventa: se deja como está y se
    // avisa. El documento sigue en el menú.
    if (documentoSinContenido(salida)) {
        problemas.push(problema(
            'documento-sin-contenido',
            `A "${nombreDe(salida)}" (${materia.nombre}) le falta el contenido del archivo.`,
            { materia: materia.nombre, documento: nombreDe(salida) }
        ));
    }

    return salida;
}

function nombreDe(doc) {
    const n = doc && doc.nombre;
    return (typeof n === 'string' && n.trim()) ? n : 'sin nombre';
}

// ---------- Materias ----------

function normalizarMateria(materia, problemas) {
    if (!materia || typeof materia !== 'object' || Array.isArray(materia)) {
        problemas.push(problema(
            'materia-invalida',
            'Hay un elemento en la lista que no es una materia y se omitió.'
        ));
        return null;
    }

    const salida = { ...materia };

    if (salida.id === undefined || salida.id === null || salida.id === '') {
        salida.id = idTemporal('m');
        problemas.push(problema(
            'materia-sin-id',
            `La materia "${nombreDeMateria(salida)}" no tenía identificador y se le dio uno.`
        ));
    }

    if (salida.nombre === undefined || salida.nombre === null) {
        salida.nombre = '';
    }

    // ---- Acá estaba el defecto 1 ----
    // Antes: `materia.documentos.forEach` reventaba con la lista ausente, y al
    // ser durante el arranque, se caía toda la app.
    if (salida.documentos === undefined || salida.documentos === null) {
        salida.documentos = [];
        problemas.push(problema(
            'materia-sin-documentos',
            `La materia "${salida.nombre}" no traía lista de documentos. Se creó una vacía.`
        ));
    } else if (!Array.isArray(salida.documentos)) {
        salida.documentos = [];
        problemas.push(problema(
            'documentos-invalidos',
            `La lista de documentos de "${salida.nombre}" no era una lista. Se creó una vacía.`
        ));
    } else {
        const documentos = [];
        for (const doc of salida.documentos) {
            const normalizado = normalizarDocumento(doc, salida, problemas);
            if (normalizado) documentos.push(normalizado);
        }
        salida.documentos = documentos;
    }

    return salida;
}

function nombreDeMateria(m) {
    const n = m && m.nombre;
    return (typeof n === 'string' && n.trim()) ? n : 'sin nombre';
}

// ---------- La entrada ----------

/**
 * Revisa las materias y devuelve las usables, con lo que le faltaba anotado.
 *
 * Acepta las dos formas que hay en el proyecto:
 *   - un arreglo pelado, como lo guarda `localStorage`
 *   - `{ materias: [...] }`, como lo produce la exportación
 *
 * @param {*} entrada
 * @returns {{materias: Array, problemas: Array}}
 */
function normalizarMaterias(entrada) {
    const problemas = [];

    let lista = entrada;

    if (lista && typeof lista === 'object' && !Array.isArray(lista)) {
        // Formato de importación.
        lista = lista.materias;
    }

    if (!Array.isArray(lista)) {
        problemas.push(problema(
            'lista-invalida',
            'No se encontró una lista de materias. Se empezó de cero.'
        ));
        return { materias: [], problemas };
    }

    const materias = [];
    for (const materia of lista) {
        const normalizada = normalizarMateria(materia, problemas);
        if (normalizada) materias.push(normalizada);
    }

    return { materias, problemas };
}

// ---------- El respaldo: qué entra y qué se reemplaza ----------

// Los cuatro grupos del cuaderno. Se escriben en un solo lugar porque aparecen en tres
// sitios —el respaldo, la lectura del respaldo y el aviso de importación— y una lista
// escrita tres veces es una lista que se desincroniza.
const GRUPOS = ['materias', 'heredados', 'estudio', 'anotaciones'];

/**
 * Arma el objeto que se descarga como respaldo.
 *
 * ## Qué devuelve cuando algo falta
 *
 * Un respaldo al que le falta un archivo **es peor que no tener respaldo**. El usuario lo
 * descubre cuando ya lo necesitaba, y para entonces puede haber pisado lo que sí tenía.
 *
 * Y el caso es real: desde que el índice y los archivos están en almacenes distintos, el
 * contenido de un documento **solo se llena cuando el usuario lo abre**. Un respaldo armado
 * con el índice solo produce esto:
 *
 *     { "nombre": "Parcial.pdf", "tipo": "pdf", "contenido": null }
 *
 * Que al importarlo deja cada documento con *"A este archivo le falta el contenido"*. Es
 * decir: **el respaldo funcionaba, y no respaldaba nada.**
 *
 * ## Lo que hace con lo que falta
 *
 * Con un documento **sin contenido**, devuelve **el nombre del documento** en vez de un
 * respaldo. Es un texto y no un objeto, y esa es la señal de "no se armó nada".
 *
 * El nombre y no un `null` porque **`null` no le dice al usuario qué archivo falta**. Sin
 * eso no puede ir a buscarlo ni decidir qué hacer; con el nombre puede.
 *
 * Y al armar el índice **no se borra ningún documento**: siguen todos con su nombre.
 * Perderlo en silencio sería peor que mostrarlo roto —el usuario no sabría ni qué tenía—.
 *
 * Un **HTML vacío no cuenta**: se puede abrir, sale un iframe en blanco, y es la misma
 * regla de `documentoSinContenido()`.
 *
 * @param {object} entrada  `{materias, heredados, estudio, anotaciones, contenidos}`
 * @returns {object|string} el respaldo, o el nombre del documento que no se pudo leer
 */
function armarRespaldo(entrada) {
    const problemas = [];
    const incompletos = [];

    const salida = { fechaExportacion: new Date().toISOString() };

    // Un grupo que no vino se guarda como lista vacía: en el respaldo tiene que estar **la
    // clave**, aunque esté vacía. Un respaldo del que hay que adivinar qué grupos tiene
    // es un respaldo que no se puede leer.
    for (const grupo of GRUPOS) {
        salida[grupo] = entrada[grupo] ?? (grupo === 'anotaciones' ? {} : []);
    }

    // Los contenidos van dentro de los documentos, que es donde los espera el importador.
    // Se arma una **copia**: los datos del usuario no se tocan (regla del módulo).
    salida.materias = (Array.isArray(salida.materias) ? salida.materias : []).map(materia => {
        if (!materia || typeof materia !== 'object') return materia;

        return {
            ...materia,
            documentos: (Array.isArray(materia.documentos) ? materia.documentos : [])
                .map(doc => {
                    if (!doc || typeof doc !== 'object') return doc;

                    // El contenido viene del almacén, no del índice: el del índice está
                    // en `null` hasta que el usuario abre el documento.
                    const contenido = entrada.contenidos
                        ? entrada.contenidos[doc.id]
                        : undefined;

                    if (contenido === undefined || contenido === null) {
                        // Un HTML vacío no es una pérdida: se puede abrir.
                        if (doc.tipo !== 'html' && !doc.contenido) {
                            incompletos.push(nombreDe(doc));
                        }
                        return { ...doc };
                    }

                    return { ...doc, contenido };
                })
        };
    });

    if (incompletos.length > 0) {
        // Se devuelve **un solo nombre**, el primero que aparece: alcanza para que el
        // usuario sepa que falta algo y vaya a buscarlo. Meter todos en el texto lo haría
        // ilegible, y el que avisara no sería quien decide qué hacer.
        return incompletos[0];
    }

    return salida;
}

/**
 * Lee un respaldo importado y dice qué trae, qué falta y qué se reemplaza.
 *
 * ## Lo que devuelve
 *
 * - `trae`: qué grupos vienen en el archivo. Un respaldo viejo solo trae `materias`.
 * - `faltantes`: los que no vienen. **No se puede saber si estaban vacíos**: el archivo
 *   no lo dice. El aviso tiene que decir *"no trae"*, y nunca *"están vacíos"* — esa
 *   diferencia es la diferencia entre un hecho y una afirmación que puede ser falsa.
 * - `reemplazar`: qué grupos se van a pisar. Y acá está **la regla que protege al
 *   usuario**: un grupo que el archivo no trae **no se reemplaza**. Importar un respaldo
 *   viejo no puede vaciarle el mapa de calor a quien lo importa.
 *
 * @param {object} datos el archivo ya interpretado
 * @returns {{importable, materias, heredados, estudio, anotaciones, trae, faltantes,
 *   reemplazar, problemas}}
 */
function leerRespaldo(datos) {
    const problemas = [];
    const objeto = (datos && typeof datos === 'object') ? datos : {};

    const { materias, problemas: raros } = normalizarMaterias(objeto);
    problemas.push(...raros);

    // `trae` decide con lo que hay, no con lo que se pudo normalizar: si el archivo trae
    // la clave pero su valor es basura, el grupo **viene**, y lo raro se anota aparte.
    const trae = {};
    for (const grupo of GRUPOS) {
        trae[grupo] = grupo === 'anotaciones'
            ? objeto.anotaciones !== undefined && objeto.anotaciones !== null
            : Array.isArray(objeto[grupo]) || (grupo !== 'materias' && objeto[grupo] !== undefined);
    }

    // `materias` es distinto a propósito: sin lista de materias **no hay cuaderno**, y
    // no se puede importar. Importarlo "empezando de cero" vaciaría lo del usuario.
    const hayMaterias = Array.isArray(objeto.materias);

    const reemplazables = hayMaterias ? GRUPOS : [];
    const reemplazar = {};
    for (const grupo of GRUPOS) {
        reemplazar[grupo] = reemplazables.includes(grupo) && trae[grupo];
    }

    return {
        importable: hayMaterias,
        materias,
        heredados: normalizarHeredados(objeto.heredados, problemas),
        estudio: normalizarSecciones(objeto.estudio, problemas),
        anotaciones: objeto.anotaciones && typeof objeto.anotaciones === 'object'
            ? objeto.anotaciones
            : {},
        trae,
        faltantes: GRUPOS.filter(grupo => !trae[grupo]),
        reemplazar,
        problemas
    };
}

/**
 * Los minutos heredados que sí se pueden usar.
 *
 * `restaurarSeccionesAntiguas()` de `js/datos/secciones.js` ya sabe qué es un registro
 * viejo válido, y tiene sus tests. Acá no se reimplementa esa regla: **se usa la misma**,
 * que es lo que evita que las dos digan cosas distintas.
 */
function normalizarHeredados(valor, problemas) {
    if (valor === undefined || valor === null) return [];

    if (!Array.isArray(valor)) {
        problemas.push(problema(
            'heredados-invalidos',
            'El historial de minutos antiguos no era una lista. Se empezó de cero para ese grupo.'
        ));
        return [];
    }

    return SeccionesDatos.restaurarSeccionesAntiguas(valor).seccionesAntiguas;
}

/**
 * Las secciones de estudio que sí se pueden usar.
 *
 * Misma idea: la regla de qué es una sección válida está en `leerSecciones()` y en
 * `minutosTotales()`. Acá se filtra lo que no tiene los dos números, porque un `finMs` en
 * `undefined` hace que el mapa de calor calcule `NaN` en lugar de fallar.
 */
function normalizarSecciones(valor, problemas) {
    if (valor === undefined || valor === null) return [];

    if (!Array.isArray(valor)) {
        problemas.push(problema(
            'estudio-invalido',
            'El historial de estudio no era una lista. Se empezó de cero para ese grupo.'
        ));
        return [];
    }

    const salida = [];
    for (const seccion of valor) {
        if (!seccion || typeof seccion !== 'object') continue;
        if (typeof seccion.inicioMs !== 'number' || typeof seccion.finMs !== 'number') {
            continue;
        }
        salida.push({ inicioMs: seccion.inicioMs, finMs: seccion.finMs });
    }

    return salida;
}

// ---------- El texto para el aviso ----------
//
// Aquí estaba `resumenDeProblemas()`, que armaba una frase para el banner. No
// la usaba nadie: el cartel lo arma `reconstruirAviso()`, en
// `js/interfaz/aviso.js`, que ya dice todo esto y además muestra el detalle.
//
// Dos funciones para el mismo cartel es una de las dos formas de que se
// desincronicen: el día que una cambie su texto, la otra sigue diciendo la
// versión vieja y nadie se entera. Se borró la que no se usaba, no la que sí.
// Ver T6.

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    normalizarMaterias,
    documentoSinContenido,
    armarRespaldo,
    leerRespaldo
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.DatosLogica = API;
}

})();
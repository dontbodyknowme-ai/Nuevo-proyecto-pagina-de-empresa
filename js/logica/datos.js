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
    documentoSinContenido
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.DatosLogica = API;
}

})();
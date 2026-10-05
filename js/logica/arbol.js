// ============================================
// LÓGICA PURA — Estructura del menú lateral
// ============================================
//
// Qué nodos existen en el menú de la izquierda y con qué datos.
//
// Antes esto estaba metido en `construirArbol()`, que son 162 líneas de las que
// casi todas son `createElement` y `appendChild`. Lo que se saca a este archivo
// es la **decisión de qué hay**; el dibujado y los manejadores de clic se
// quedan en `app.js`.
//
// ## Por qué los manejadores NO se mueven
//
// Once `addEventListener` de las 162 líneas, cada uno cerrando sobre su
// `materia` o su `doc`. Un manejador es comportamiento, no estructura. Moverlos
// es exactamente lo que haría que un click empiece a abrir el documento
// equivocado, y eso no lo detecta ningún test.
//
// ## Cómo se conecta con el dibujado
//
// Cada botón sale de acá con una `clave` que dice **qué hace**, nunca con una
// función. El dibujo busca la clave y decide el comportamiento:
//
//     for (const boton of modelo.acciones) {
//         const el = crearBoton(boton);
//         if (boton.clave === 'agregar') el.addEventListener('click', ...);
//     }
//
// Así la lógica pura no depende de nada que ejecutar, y se puede probar en Node.
//
// ## Un defecto que se conserva a propósito
//
// `modeloArbol` accede a `materia.documentos` sin guardia, igual que el código
// anterior. Si una materia llega sin esa lista —un respaldo importado puede
// traerla así— revienta con un TypeError, y al reventar durante el arranque se
// corta toda la inicialización de la app.
//
// **No se corrige en esta tarea.** Esta tarea mueve; corregir es T6. Si se le
// agrega el guardia, `herramientas/comparar-arbol.js` va a avisar que el árbol
// cambió: eso es una buena noticia, no una regresión.
//
// Ver: specs/003-refactor-app/spec.md (RF-3, RF-6)
//
// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo con
// `<script>` sus nombres chocarían con los de los demás archivos.
(function () {

// ---------- Íconos ----------

const ICONO_MATERIA_POR_DEFECTO = '📁';
const ICONO_DOCUMENTO_POR_DEFECTO = '📄';

/**
 * Los íconos por tipo de documento.
 *
 * Ojo: son dos listas distintas. El ícono de una materia (la carpeta) nunca
 * es el de un documento, aunque los dos sean "un emoji".
 */
const ICONOS_DOCUMENTO = {
    'html': '🌐',
    'pdf': '📕',
    'word': '📘'
};

/**
 * El ícono de una materia. Sin ícono propio, la carpeta.
 */
function iconoMateria(materia) {
    if (!materia) return ICONO_MATERIA_POR_DEFECTO;
    return materia.icono || ICONO_MATERIA_POR_DEFECTO;
}

/**
 * El ícono de un documento según su tipo. Sin tipo conocido, la hoja.
 */
function iconoDocumento(tipo) {
    return ICONOS_DOCUMENTO[tipo] || ICONO_DOCUMENTO_POR_DEFECTO;
}

// ---------- Los botones ----------

/**
 * Qué botones tiene una materia, en orden.
 *
 * El orden importa: es el orden en que salen en pantalla, y cambiarlo mueve
 * botones que el usuario ya conoce de memoria.
 */
const ACCIONES_MATERIA = [
    { clave: 'agregar',  clase: 'btn-icono-small', titulo: 'Añadir documento', icono: '📄' },
    { clave: 'eliminar', clase: 'btn-icono-small peligro', titulo: 'Eliminar materia', icono: '🗑️' }
];

/**
 * Qué botones tiene un documento, en orden.
 *
 * El botón de eliminar es el único con la clase "peligro". Si aparece en otro
 * lado, todos los botones de esa fila se ponen rojos.
 */
const ACCIONES_DOCUMENTO = [
    { clave: 'ver',       clase: 'btn-icono-small', titulo: 'Ver documento',       icono: '👁️' },
    { clave: 'renombrar', clase: 'btn-icono-small', titulo: 'Renombrar documento', icono: '✏️' },
    { clave: 'eliminar',  clase: 'btn-icono-small peligro', titulo: 'Eliminar documento', icono: '🗑️' }
];

/**
 * Una copia de los botones. El dibujo recibe su propia copia para poder
 * modificarla sin tocar la constante.
 */
function accionesMateria() {
    return ACCIONES_MATERIA.map(a => ({ ...a }));
}

function accionesDocumento() {
    return ACCIONES_DOCUMENTO.map(a => ({ ...a }));
}

// ---------- El mensaje de árbol vacío ----------

/**
 * El texto cuando todavía no hay materias.
 *
 * Son **dos** frases, no una: antes era un `innerHTML` con un `<br>` en el
 * medio. El salto de línea es una decisión de dibujado, no de contenido, así
 * que el módulo de lógica devuelve las dos frases por separado y el dibujo las
 * une con un `<br>`.
 */
const MENSAJE_SIN_MATERIAS = {
    principal: 'No hay materias aún.',
    secundario: 'Crea una para comenzar.'
};

function mensajeSinMaterias() {
    return { ...MENSAJE_SIN_MATERIAS };
}

// ---------- El modelo ----------

/**
 * Arma el modelo del árbol.
 *
 * @param {Array} materias
 * @returns {Array|null} null si no hay materias; si hay, un objeto por materia.
 *
 * Cada materia:
 *   { id, nombre, icono, acciones: [...], documentos: [...] }
 *
 * Cada documento:
 *   { id, nombre, icono, acciones: [...] }
 *
 * Devuelve `null` y no una lista vacía a propósito: "no hay materias" y "hay
 * materias pero sin documentos" son dos cosas distintas, y el dibujo las
 * trata distinto (un texto vs. una lista).
 */
function modeloArbol(materias) {
    const lista = Array.isArray(materias) ? materias : [];

    if (lista.length === 0) return null;

    return lista.map(materia => {
        // Guardia. `normalizarMaterias()` ya deja esta lista completa, pero una
        // función que revienta con un `undefined` es una bomba: si algún camino
        // futuro la llama con datos sin normalizar, mejor un nodo vacío que la
        // app entera caída durante el arranque.
        const listaDocs = Array.isArray(materia.documentos) ? materia.documentos : [];

        const documentos = [];
        listaDocs.forEach(doc => {
            documentos.push({
                id: doc.id,
                nombre: doc.nombre,
                icono: iconoDocumento(doc.tipo),
                acciones: accionesDocumento()
            });
        });

        return {
            id: materia.id,
            nombre: materia.nombre,
            icono: iconoMateria(materia),
            acciones: accionesMateria(),
            documentos
        };
    });
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    modeloArbol,
    iconoMateria,
    iconoDocumento,
    accionesMateria,
    accionesDocumento,
    mensajeSinMaterias,
    ICONO_MATERIA_POR_DEFECTO,
    ICONO_DOCUMENTO_POR_DEFECTO,
    ACCIONES_MATERIA,
    ACCIONES_DOCUMENTO
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.ArbolLogica = API;
}

})();
// ============================================
// LÓGICA PURA — Cálculo de las estadísticas
// ============================================
//
// Los tres números que se muestran arriba: cuántas materias hay, cuántos
// documentos y cuántas palabras.
//
// Antes esto estaba dentro de `actualizarStats()`, que además de calcular
// armaba el HTML con una plantilla. Ahora el cálculo vive acá y el dibujo se
// quedó donde estaba.
//
// Función pura: recibe las materias, devuelve números. No toca la pantalla, no
// lee el almacenamiento y no cuenta el reloj.
//
// ## Un defecto que se conserva a propósito
//
// Hoy una "palabra" es lo que queda al partir el texto por espacios:
//
//     contenido.split(/\s+/).length
//
// Eso cuenta de más cuando el texto tiene espacio al principio o al final, y
// cuenta 2 palabras para un texto que solo tiene espacios. Está declarado como
// **CP-2** en la spec y NO se corrige acá: cambiarlo haría bajar las
// estadísticas del usuario, y eso es una decisión suya, no un refactor.
//
// Los tests de `test/estadisticas.test.js` fijan este comportamiento tal como
// está, con el nombre CP-2, para que quede visible.
//
// Ver: specs/003-refactor-app/spec.md (RF-5)
//
// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo con
// `<script>` sus nombres chocarían con los de los demás archivos.
(function () {

/**
 * Calcula las tres estadísticas.
 *
 * @param {Array} materias  las materias con sus documentos
 * @returns {{totalMaterias: number, totalDocumentos: number, totalPalabras: number}}
 */
function calcularEstadisticas(materias) {
    const lista = comoLista(materias);

    let totalDocumentos = 0;
    let totalPalabras = 0;

    for (const materia of lista) {
        const documentos = comoLista(materia && materia.documentos);

        for (const documento of documentos) {
            totalDocumentos++;

            // Solo los documentos HTML aportan palabras.
            // Un PDF o un Word no son texto, no se pueden contar.
            if (!documento || documento.tipo !== 'html') continue;
            if (!documento.contenido) continue;

            totalPalabras += contarPalabras(documento.contenido);
        }
    }

    return {
        totalMaterias: lista.length,
        totalDocumentos,
        totalPalabras
    };
}

/**
 * Cuenta palabras partiendo por espacios.
 *
 * Es el conteo que siempre se usó. Ver la nota sobre CP-2 arriba: contar
 * correctamente exige decidir qué es una palabra, y eso está pendiente.
 */
function contarPalabras(contenido) {
    return contenido.split(/\s+/).length;
}

/** Normaliza lo que llega a una lista. */
function comoLista(valor) {
    return Array.isArray(valor) ? valor : [];
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    calcularEstadisticas
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.EstadisticasLogica = API;
}

})();
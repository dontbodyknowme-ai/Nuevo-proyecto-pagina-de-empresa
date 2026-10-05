// ============================================
// LÓGICA PURA — Qué se muestra en cada vista del calendario
// ============================================
//
// El modal del calendario tiene dos vistas: el calendario mensual y el
// mapa de calor. No usan el mismo contenido.
//
// La navegación de mes y año, y la leyenda de tipos de anotación, son
// cosas del calendario mensual. En el mapa no tienen sentido: el mapa
// muestra las últimas cuatro semanas y no se navega por mes. Mostrarlas
// ahí hace pensar que el botón de "Ir" mueve el mapa, y no lo mueve.
//
// Esta función decide eso. Y solo eso: la geometría —qué tan ancho es
// cada bloque, si va en fila o en columna— la resuelven las hojas de
// estilo, no el código (RNF-4).
//
// No toca el DOM, no lee el ancho de la ventana, no lee el reloj y no
// toca el almacenamiento. Por eso se puede probar con Node (RNF-3).
//
// Cubre: RF-5
// Ver: specs/002-layout-calendario/spec.md
// ============================================

// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo
// con <script> sus nombres chocarían con los de los demás archivos,
// porque todos comparten el mismo ámbito global de la página.
(function () {

// Aquí estaba `VISTAS`, la lista con las dos vistas. No la usaba el módulo:
// cada función delega en la suya, y los tests nombran las vistas una por una.
// Ver T6.

// Lo que se muestra siempre, en las dos vistas.
//
// El botón de cerrar está acá a propósito: vive en el encabezado del
// modal, no dentro del panel de anotaciones. Si estuviera dentro, en la
// vista mapa quedaría invisible, porque el panel se oculta entero.
const SIEMPRE = {
    botonAlternar: true,
    botonCerrar: true
};

/**
 * Dice qué elementos del modal se muestran en una vista.
 *
 * @param {string} vista  'mapa' o 'calendario'
 * @returns {object}  un booleano por elemento
 *
 * Si la vista no se reconoce, muestra todo. Preferimos mostrar de más a
 * dejar al usuario sin forma de cerrar el calendario.
 */
function elementosVisibles(vista) {
    const esMapa = vista === 'mapa';

    return {
        navMes: !esMapa,
        leyendaAnotaciones: !esMapa,
        panelAnotaciones: !esMapa,
        botonAlternar: SIEMPRE.botonAlternar,
        botonCerrar: SIEMPRE.botonCerrar
    };
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    elementosVisibles,
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.LayoutLogica = API;
}

})();
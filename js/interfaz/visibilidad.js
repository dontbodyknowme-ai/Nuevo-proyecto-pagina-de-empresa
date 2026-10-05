// ============================================
// INTERFAZ — Mostrar y ocultar según la vista
// ============================================
//
// La decisión de qué se muestra la toma una función pura, en
// js/logica/layout.js. Acá solo se aplica: se le pone `hidden` a los
// elementos correspondientes.
//
// El ancho de la ventana no se mira acá. La geometría la resuelven las
// hojas de estilo; si esta función midiera la pantalla para decidir,
// habría dos fuentes de verdad para los umbrales y terminarían
// discrepando (RNF-4).
//
// Se oculta con el atributo `hidden`, no pisando `display`: así la hoja de
// estilos sigue teniendo el control de cómo se ve cada elemento.
//
// Cubre: RF-5
// Ver: specs/002-layout-calendario/spec.md
// ============================================

// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo
// con <script> sus nombres chocarían con los de los demás archivos,
// porque todos comparten el mismo ámbito global de la página.
(function () {

// Puente de carga: en Node usa require, en el navegador usa el global
// que dejó js/logica/layout.js.
const LayoutLogica = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('../logica/layout.js')
    : window.LayoutLogica;

/**
 * Muestra u oculta el chrome del calendario según la vista activa.
 *
 * @param {string} vista  'mapa' o 'calendario'
 * @param {object} document  el documento, para poder probarlo sin navegador
 * @returns {object}  la decisión que se aplicó, por si hay que inspeccionarla
 */
function aplicarVisibilidad(vista, document = window.document) {
    const decision = LayoutLogica.elementosVisibles(vista);

    // La navegación de mes y la leyenda son del calendario mensual.
    // En el mapa no aplican, y mostrarlas hace pensar que el botón
    // de "Ir" mueve el mapa, cuando no lo mueve.
    ocultarSi('.calendario-nav', decision.navMes, document);
    ocultarSi('.calendario-leyenda', decision.leyendaAnotaciones, document);

    // El panel de anotaciones se oculta por la hoja de estilos cuando la
    // vista es el mapa. Se marca igual, para que el atributo y el estilo
    // no se contradigan.
    ocultarSi('.calendario-panel', decision.panelAnotaciones, document);

    return decision;
}

/**
 * Pone `hidden` en un elemento si corresponde.
 * No toca `display`: ese lo decide la hoja de estilos.
 */
function ocultarSi(selector, visible, document) {
    const elemento = document.querySelector(selector);
    if (!elemento) return;

    elemento.hidden = !visible;
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    aplicarVisibilidad
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.VisibilidadInterfaz = API;
}

})();
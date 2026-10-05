// ============================================
// INTERFAZ — Mostrar un documento HTML en el visor
// ============================================
//
// Dibuja el `iframe` donde se ve un documento HTML.
//
// **Por qué existe:** antes esto se hacía con un `innerHTML` y una plantilla:
//
//     visor.innerHTML =
//         `<iframe srcdoc="${escapeHtml(doc.contenido)}"
//                   title="${doc.nombre}"></iframe>`;
//
// `doc.contenido` pasaba por `escapeHtml`, **`doc.nombre` no**. Un documento
// llamado `informe" onload="codigoMalicioso()"` inyectaba un manejador que se
// ejecutaba al cargar el iframe. Comprobado en Chrome.
//
// Acá no hay plantillas ni `innerHTML`. El elemento se crea con
// `createElement` y los valores van como propiedad o como atributo, que es
// donde el navegador los escapa solo (Principio 3 y Principio 5).
//
// Un detalle sobre `srcdoc`: **no hay que escapar el contenido**. Ese atributo
// está hecho para recibir HTML. Escaparlo y dejar que el navegador lo
// decodifique es un doble trabajo que se cancela a sí mismo, y da una falsa
// sensación de protección.
//
// Ver: docs/constitucion.md, Principios 3 y 5

// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo
// con <script> sus nombres chocarían con los de los demás archivos,
// porque todos comparten el mismo ámbito global de la página.
(function () {

/**
 * Muestra un documento HTML en el visor.
 *
 * @param {HTMLElement} visor  dónde se dibuja
 * @param {object} doc  debe traer `nombre` y `contenido`
 * @param {object} documento  el documento, para poder probarlo sin navegador
 */
function mostrarHtml(visor, doc, documento = document) {
    if (!visor) return;

    const iframe = documento.createElement('iframe');
    iframe.className = 'visor-documento';

    // El contenido va crudo: srcdoc espera HTML.
    iframe.setAttribute('srcdoc', doc.contenido ?? '');

    // El título va como propiedad. Si fuera un atributo armado con una
    // plantilla, un nombre con comillas rompería la etiqueta.
    iframe.title = doc.nombre ?? '';

    // El contenido viene de un archivo que subió el usuario. Se le permite
    // ejecutar sus propios scripts, pero no acceder a esta página: sin
    // `allow-same-origin` corre en un origen separado.
    iframe.setAttribute('sandbox', 'allow-scripts');

    visor.textContent = '';
    visor.appendChild(iframe);
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    mostrarHtml
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.VisorInterfaz = API;
}

})();
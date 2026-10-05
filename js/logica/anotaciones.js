// ============================================
// LÓGICA PURA — Regla de anotaciones por día
// ============================================
//
// Cuántas anotaciones se pueden guardar en un mismo día.
//
// El número estaba escrito con un 3 suelto en tres lugares de `app.js`: el
// contador, el botón deshabilitado y la validación al guardar. Tres copias de
// la misma regla, que solo se mantienen juntas si nadie se olvida de cambiar
// las tres. Acá vive en un solo lugar.
//
// Función pura: recibe las anotaciones del día, devuelve una respuesta. No toca
// la pantalla, no lee el almacenamiento y no avisa por su cuenta.
//
// Un detalle importante: la regla **aguanta** los respaldos importados que
// traen más anotaciones que el máximo. No lanza, no borra nada, y simplemente
// dice que no hay lugar.
//
// Ver: specs/003-refactor-app/spec.md (RF-4)
//
// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo con
// `<script>` sus nombres chocarían con los de los demás archivos.
(function () {

// Cuántas anotaciones se permiten por día.
const MAXIMO_ANOTACIONES = 3;

// Qué tipos de anotación existen.
//
// El conjunto estaba escrito en tres lugares y ninguno lo decía: el `<select>`
// de `index.html` ofrece tres `<option>`, `css/styles.css` tiene una regla por
// tipo, y `app.js` comparaba contra tres literales. Los tres coincidian, y
// coincidirían mañana solo si nadie se olvida de los tres.
//
// Los valores salen del dominio: son los tipos que el selector ofrece. No hay un
// cuarto, y agregar uno es un cambio de la interfaz, no del dato.
const TIPOS_ANOTACION = Object.freeze(['parcial', 'entrega', 'nota']);

// La clase que se le pone a una anotación de tipo desconocido.
//
// No es nada: es un nombre **fijo**, escrito acá. El valor que vino del respaldo
// no sale nunca de esta función. Con un tipo inválido la anotación se sigue
// viendo —los datos son sagrados— pero sin el color de un tipo que no existe.
const SIN_TIPO = 'sin-tipo';

/**
 * Dice si un tipo de anotación es uno de los que la interfaz conoce.
 *
 * @param {*} tipo  el valor que llegó, que puede ser cualquier cosa
 * @returns {boolean}
 */
function esTipoValido(tipo) {
    return typeof tipo === 'string' && TIPOS_ANOTACION.includes(tipo);
}

/**
 * La clase de CSS que le corresponde a un tipo, o la de tipo desconocido.
 *
 * **Esta función es la frontera.** Es lo único que se interpola en un
 * `className`, así que lo que sale de acá no puede contener espacios, comillas ni
 * nada que rompa el atributo.
 *
 * Que no sea XSS —`className` no se parsea como HTML— no lo vuelve correcto: un
 * tipo con espacios se convierte en varias clases, y el dato del usuario pasa a
 * elegir nombres de clase en un elemento. Con un respaldo importado, cualquiera.
 *
 * @param {*} tipo  el valor que llegó
 * @returns {string} un tipo de la lista, o `'sin-tipo'`
 */
function claseDeTipo(tipo) {
    return esTipoValido(tipo) ? tipo : SIN_TIPO;
}

/**
 * Normaliza lo que llega a una lista de anotaciones.
 * Si no es una lista, se trata como vacía.
 */
function comoLista(anotaciones) {
    return Array.isArray(anotaciones) ? anotaciones : [];
}

/**
 * Dice si todavía hay lugar para otra anotación en ese día.
 *
 * @param {Array} anotaciones  las que ya tiene ese día
 * @returns {boolean}
 */
function tieneLugar(anotaciones) {
    return comoLista(anotaciones).length < MAXIMO_ANOTACIONES;
}

/**
 * El texto del contador "N/M anotaciones".
 *
 * @param {Array} anotaciones
 * @returns {string}
 */
function textoContador(anotaciones) {
    const usadas = comoLista(anotaciones).length;
    return `${usadas}/${MAXIMO_ANOTACIONES} anotaciones`;
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

// Aquí estaban `quedanCupos()` y `estaAlMaximo()`. La segunda era
// `!tieneLugar()`, y la primera, `MAXIMO_ANOTACIONES - usadas`. Ninguna la
// usaba la app: el contador de la pantalla es `textoContador()` y el tope lo
// decide `tieneLugar()`. Ver T6.

const API = {
    tieneLugar,
    textoContador,
    esTipoValido,
    claseDeTipo,
    TIPOS_ANOTACION,
    MAXIMO_ANOTACIONES
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.AnotacionesLogica = API;
}

})();
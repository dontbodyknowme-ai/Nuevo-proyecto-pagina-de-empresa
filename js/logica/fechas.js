// ============================================
// LÓGICA PURA — Aritmética de fechas del calendario
// ============================================
//
// Funciones puras: reciben año y mes, devuelven números. No tocan la pantalla,
// no leen el reloj del sistema y no leen el almacenamiento.
//
// Antes esto estaba escrito en línea dentro de `generarCalendario()`, con un
// detalle que producía un defecto: el bucle de días siempre corría hasta 31.
// En febrero se dibujaban el 29, el 30 y el 31, y como esas celdas eran
// clicables se podían guardar anotaciones en fechas que no existen.
//
// Ver: specs/003-refactor-app/spec.md (RF-1 y RF-2)
//
// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo con
// `<script>` sus nombres chocarían con los de los demás archivos, porque todos
// comparten el mismo ámbito global de la página.
(function () {

// Aquí estaba `DIAS_EN_LA_SEMANA`, la lista con los siete días en español. No
// la usaba nada: la interfaz dibuja las abreviaturas que trae
// `js/logica/mapa-calor.js`, con `diasDeSemana()`. Un solo lugar con los
// nombres. Ver T6.

const DIAS_POR_MES_COMUN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Dice si un año tiene 29 días en febrero.
 *
 * La regla completa: divisible por 4, salvo los que son divisibles por 100
 * sin ser divisibles por 400. Sin esa excepción, 1900 sería bisiesto.
 */
function esBisiesto(anio) {
    if (!Number.isInteger(anio)) return false;
    if (anio % 4 !== 0) return false;
    if (anio % 100 !== 0) return true;
    return anio % 400 === 0;
}

/**
 * Cuántos días tiene un mes.
 *
 * @param {number} anio
 * @param {number} mes  del 1 al 12
 * @returns {number} 28, 29, 30 o 31. Cero si el mes no existe.
 */
function diasDelMes(anio, mes) {
    if (!Number.isInteger(anio) || !Number.isInteger(mes)) return 0;
    if (mes < 1 || mes > 12) return 0;

    if (mes === 2 && esBisiesto(anio)) return 29;
    return DIAS_POR_MES_COMUN[mes - 1];
}

/**
 * En qué columna cae el día 1 de un mes.
 *
 * @param {number} anio
 * @param {number} mes  del 1 al 12
 * @returns {number} de 0 (lunes) a 6 (domingo). Cero si el mes no existe.
 */
function columnaDelDiaUno(anio, mes) {
    if (!Number.isInteger(anio) || !Number.isInteger(mes)) return 0;
    if (mes < 1 || mes > 12) return 0;

    // El 1 del mes, a medianoche local.
    const primero = new Date(anio, mes - 1, 1);

    // `getDay()` da 0 para domingo y 1 para lunes. Se rota para que el 0 sea
    // el lunes, que es como está Armada la rejilla.
    return (primero.getDay() + 6) % 7;
}

/**
 * Dice si una fecha existe de verdad.
 *
 * @param {number} dia
 * @param {number} mes  del 1 al 12
 * @param {number} anio
 * @returns {boolean}
 */
function existeFecha(dia, mes, anio) {
    if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(anio)) {
        return false;
    }
    if (dia < 1) return false;

    return dia <= diasDelMes(anio, mes);
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    esBisiesto,
    diasDelMes,
    columnaDelDiaUno,
    existeFecha,
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.FechasLogica = API;
}

})();
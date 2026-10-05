// ============================================
// LÓGICA PURA — Prevención por capacidad de almacenamiento
// ============================================
//
// Estas funciones NO tocan el almacenamiento real. Solo deciden,
// con números que entran por parámetro, si una escritura es segura.
//
// Así quedan testeables sin navegador y sin arriesgar datos reales.
//
// Cubre: RF-11
// Ver: specs/001-heat-map/spec.md
// ============================================

// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo
// con <script> sus nombres chocarían con los de los demás archivos,
// porque todos comparten el mismo ámbito global de la página.
(function () {

// El umbral a partir del cual se bloquean las escrituras,
// salvo que la operación pequeña quepan igual.
const PORCENTAJE_UMBRAL_POR_DEFECTO = 95;

// El código que usan algunos navegadores cuando el
// almacenamiento se llena.
const CODIGO_SIN_CUOTA = 22;

/**
 * Devuelve el umbral a usar. Si el que se pasa no sirve,
 * vuelve al valor por defecto.
 */
function umbralDe(porcentaje) {
    const esNumero = typeof porcentaje === 'number'
        && Number.isFinite(porcentaje)
        && porcentaje > 0
        && porcentaje <= 100;

    return esNumero ? porcentaje : PORCENTAJE_UMBRAL_POR_DEFECTO;
}

/**
 * Devuelve cuánto espacio queda, en las mismas unidades
 * en que se miden el uso y la capacidad.
 */
function estimarEspacioDisponible(usoActual, capacidadTotal) {
    return Math.max(0, capacidadTotal - usoActual);
}

/**
 * Decide si una escritura es segura.
 *
 * Bloquea por dos motivos, en este orden:
 *   1. "espacio": la operación no entra, aunque falte mucho
 *      para llegar al umbral. Es el motivo más urgente.
 *   2. "umbral": se pasó el porcentaje crítico y no conviene
 *      seguir escribiendo sin que el usuario libere espacio.
 *
 * Devuelve un objeto porque el llamador necesita saber
 * POR QUÉ se bloqueó, para poder explicárselo al usuario.
 */
function puedeEscribir(usoActual, capacidadTotal, tamanoEstimado, umbral) {
    const limite = umbralDe(umbral);
    const disponible = estimarEspacioDisponible(usoActual, capacidadTotal);

    const porcentajeUso = capacidadTotal > 0
        ? Math.floor((usoActual / capacidadTotal) * 100)
        : 100;

    const base = {
        porcentajeUso,
        porcentajeUmbral: limite,
        espacioDisponible: disponible
    };

    // Sin capacidad declarada no se puede garantizar nada: no se escribe
    if (capacidadTotal <= 0) {
        return { ...base, permitido: false, motivo: 'espacio' };
    }

    // Lo que no entra es el motivo más urgente
    if (tamanoEstimado > disponible) {
        return { ...base, permitido: false, motivo: 'espacio' };
    }

    // Ya se pasó el umbral crítico
    if (porcentajeUso >= limite) {
        return { ...base, permitido: false, motivo: 'umbral' };
    }

    return { ...base, permitido: true, motivo: null };
}

/**
 * Indica si un error corresponde a falta de cuota y,
 * por lo tanto, hay que revertir lo que se estaba escribiendo.
 *
 * Se miran varias formas porque cada navegador informa
 * el error de manera distinta.
 */
function debeRevertir(error) {
    if (!error || typeof error !== 'object') return false;

    const porNombre = typeof error.name === 'string'
        && (error.name === 'QuotaExceededError'
            || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

    const porCodigo = error.code === CODIGO_SIN_CUOTA;

    const porMensaje = typeof error.message === 'string'
        && /cuota|quota|almacenamiento/i.test(error.message);

    return porNombre || porCodigo || porMensaje;
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    umbralDe,
    estimarEspacioDisponible,
    puedeEscribir,
    debeRevertir,
    PORCENTAJE_UMBRAL_POR_DEFECTO
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.AlmacenamientoLogica = API;
}

})();
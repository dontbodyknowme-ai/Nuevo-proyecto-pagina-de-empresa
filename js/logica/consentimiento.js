// ============================================
// LÓGICA PURA — Consentimiento para cuadernos ajenos
// ============================================
//
// Un cuaderno ajeno solo se puede consultar si su dueño
// registraron consentimiento explícito.
//
// Cubre: RF-12
// Ver: specs/001-heat-map/spec.md
// ============================================

// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo
// con <script> sus nombres chocarían con los de los demás archivos,
// porque todos comparten el mismo ámbito global de la página.
(function () {

/**
 * Indica si un cuaderno ajeno tiene consentimiento vigente.
 *
 * Se exige que el registro:
 *   - exista y tenga la forma correcta
 *   - sea del cuaderno consultado
 *   - tenga fecha de otorgamiento
 *   - no esté revocado
 *
 * La fecha de hoy entra por parámetro: esta función no lee el reloj.
 */
function tieneConsentimiento(registros, cuadernoId, hoy) {
    if (!Array.isArray(registros)) return false;
    if (typeof cuadernoId !== 'string' || cuadernoId === '') return false;

    return registros.some((registro) => {
        if (!registro || typeof registro !== 'object') return false;
        if (registro.cuadernoId !== cuadernoId) return false;
        if (typeof registro.fechaOtorgamiento !== 'string') return false;
        if (registro.fechaOtorgamiento === '') return false;
        if (registro.revocado === true) return false;

        return true;
    });
}

/**
 * Registra el consentimiento de un cuaderno.
 * Si ya existe, lo actualiza en lugar de duplicarlo.
 */
function registrarConsentimiento(registros, cuadernoId, fechaOtorgamiento) {
    const lista = Array.isArray(registros) ? registros : [];

    const otros = lista.filter(
        (registro) => !registro || registro.cuadernoId !== cuadernoId
    );

    const registro = {
        cuadernoId,
        fechaOtorgamiento,
        revocado: false
    };

    return [...otros, registro];
}

/**
 * Revoca el consentimiento de un cuaderno.
 * No borra el registro: queda la constancia de que existió,
 * que es lo que un cuaderno de consentimiento debe guardar.
 */
function revocarConsentimiento(registros, cuadernoId) {
    if (!Array.isArray(registros)) return [];

    return registros.map((registro) => {
        if (!registro || registro.cuadernoId !== cuadernoId) return registro;
        return { ...registro, revocado: true };
    });
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    tieneConsentimiento,
    registrarConsentimiento,
    revocarConsentimiento
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.ConsentimientoLogica = API;
}

})();
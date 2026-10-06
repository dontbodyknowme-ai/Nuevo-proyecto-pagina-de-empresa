// ============================================
// ESTADO — Secciones de estudio abiertas
// ============================================
//
// Lleva el control de en qué momento está el temporizador, para
// poder decir exactamente cuánto tiempo real se estudió.
//
// Este archivo NO guarda nada y NO dibuja nada. Solo lleva el
// estado en memoria y calcula. Quien guarda es app.js, y quien
// dibuja es la interfaz del mapa.
//
// Cubre: RF-1, RF-2, RF-3, RF-10, RF-13
// Ver: specs/001-heat-map/spec.md
// ============================================

// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo
// con <script> sus nombres chocarían con los de los demás archivos,
// porque todos comparten el mismo ámbito global de la página.
(function () {

/**
 * Crea el estado inicial: ninguna sección abierta,
 * ninguna sección registrada, ningún registro antiguo.
 */
function crearSecciones() {
    return {
        seccionAbierta: null,
        secciones: [],
        seccionesAntiguas: []
    };
}

/**
 * Dice si hay una sección abierta ahora mismo.
 */
function estaAbierta(estado) {
    return estado.seccionAbierta !== null;
}

/**
 * Abre una sección nueva. Si ya había una abierta, esta llamada
 * no la pisa: se espera a que se cierre antes de abrir otra.
 */
function abrirSeccion(estado, ahoraMs) {
    if (estado.seccionAbierta !== null) return estado;
    estado.seccionAbierta = { inicioMs: ahoraMs };
    return estado;
}

/**
 * Cierra la sección abierta sellándola con su hora de fin.
 *
 * Una sección de menos de un minuto sí se guarda acá: el
 * redondeo a minutos enteros lo hace `minutosTotales()`, que es
 * donde se decide si aporta algo al día.
 *
 * Si la hora de fin es anterior a la de inicio, la sección
 * se descarta: sería una duración negativa.
 */
function cerrarSeccion(estado, ahoraMs) {
    if (estado.seccionAbierta === null) return estado;

    const inicioMs = estado.seccionAbierta.inicioMs;
    estado.seccionAbierta = null;

    if (ahoraMs <= inicioMs) return estado;

    estado.secciones.push({ inicioMs, finMs: ahoraMs });
    return estado;
}

/**
 * Devuelve las secciones ya cerradas, en formato plano.
 * La sección abierta no se incluye: todavía no terminó.
 */
function leerSecciones(estado) {
    return estado.secciones.map((s) => ({
        inicioMs: s.inicioMs,
        finMs: s.finMs
    }));
}

/**
 * Lee los registros del formato viejo, donde cada sesión
 * completada valía 25 minutos fijos (RF-10).
 *
 * Se conservan tal cual. No se recalculan, porque el tiempo
 * real de esas sesiones nunca se registró y no hay forma de
 * recuperarlo.
 *
 * Los registros que no tengan fecha y minutos se ignoran.
 */
function restaurarSeccionesAntiguas(registros) {
    const estado = crearSecciones();

    if (!Array.isArray(registros)) return estado;

    estado.seccionesAntiguas = registros.filter((registro) => {
        if (!registro || typeof registro !== 'object') return false;
        if (typeof registro.fecha !== 'string' || registro.fecha === '') return false;
        if (typeof registro.minutos !== 'number' || registro.minutos <= 0) return false;
        return true;
    }).map((registro) => ({
        fecha: registro.fecha,
        minutos: registro.minutos
    }));

    return estado;
}

/**
 * La lista de secciones que hay que dejar guardada: las que ya estaban, más las que
 * hay en memoria, **sin repetir ninguna**.
 *
 * ## Por qué existe
 *
 * Mientras una sección está abierta, el latido escribe esa sección cada 30 segundos,
 * y cada escritura tiene un `finMs` distinto. Si la lista se armara **agregando**, una
 * sesión de 25 minutos se contaría 50 veces y los minutos **se multiplicarían**.
 *
 * Por eso una sección se identifica por su **`inicioMs`**, y guardar la misma sección
 * otra vez **la reemplaza, no la suma**. Lo que gana es lo de memoria, porque es
 * siempre más nuevo: el último latido dice "10 minutos", y el cierre real dice 25.
 *
 * ## El orden de la mezcla
 *
 * Primero lo de memoria, después lo guardado. No es arbitrario: así, cuando una
 * sección está en las dos, gana la de memoria. Y al final se ordena por `inicioMs`,
 * porque el archivo exportado muestra esta lista y dos exportaciones del mismo dato
 * tienen que dar el mismo archivo.
 *
 * ## Lo que se descarta
 *
 * Un registro sin `inicioMs` numérico no se guarda. **No se tira**: se ignora. Un
 * respaldo importado puede traer basura, y tirar acá sería romper el guardado de
 * minutos, que es lo último que debería caer por un dato raro.
 *
 * @param {object} estado       el estado de secciones
 * @param {Array}  guardadas    las secciones que ya estaban en el almacén
 * @param {number} ahoraMs      el momento en que se mide la sección abierta
 * @returns {Array} secciones sin repeticiones, en orden cronológico
 */
function seccionesParaGuardar(estado, guardadas, ahoraMs) {
    const salida = [];
    const yaPuestas = new Set();

    const agregar = (inicioMs, finMs) => {
        if (yaPuestas.has(inicioMs)) return;
        yaPuestas.add(inicioMs);
        salida.push({ inicioMs, finMs });
    };

    // Lo de memoria primero, que es lo más nuevo. La abierta va también, sellada al
    // momento: si se guardara sin `finMs`, `minutosTotales()` no leería un número y
    // el latido no serviría de nada.
    for (const seccion of leerSecciones(estado)) {
        agregar(seccion.inicioMs, seccion.finMs);
    }
    if (estado.seccionAbierta !== null) {
        agregar(estado.seccionAbierta.inicioMs, ahoraMs);
    }

    for (const seccion of Array.isArray(guardadas) ? guardadas : []) {
        if (!seccion || typeof seccion.inicioMs !== 'number') continue;
        agregar(seccion.inicioMs, seccion.finMs);
    }

    return salida.sort((a, b) => a.inicioMs - b.inicioMs);
}

/**
 * Devuelve todos los minutos registrados, de los dos formatos:
 * las secciones nuevas y los registros antiguos conservados.
 *
 * Las secciones van por su clave DD/MM/AAAA; los registros
 * antiguos se convierten desde su fecha ISO.
 */
function minutosTotales(estado, aFechaClave) {
    const totales = {};

    for (const seccion of estado.secciones) {
        const clave = aFechaClave(new Date(seccion.inicioMs));
        const minutos = Math.floor((seccion.finMs - seccion.inicioMs) / 60000);
        if (minutos === 0) continue;
        totales[clave] = (totales[clave] ?? 0) + minutos;
    }

    for (const registro of estado.seccionesAntiguas) {
        const clave = aFechaClave(new Date(registro.fecha));
        totales[clave] = (totales[clave] ?? 0) + registro.minutos;
    }

    return totales;
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    crearSecciones,
    estaAbierta,
    abrirSeccion,
    cerrarSeccion,
    leerSecciones,
    seccionesParaGuardar,
    restaurarSeccionesAntiguas,
    minutosTotales
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.SeccionesDatos = API;
}

})();
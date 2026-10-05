// ============================================
// LÓGICA PURA — Mapa de calor de estudio
// ============================================
//
// Estas funciones NO tocan el DOM, NO leen el almacenamiento
// y NO miran el reloj del sistema. Todo lo que necesitan entra
// por parámetro, incluido "hoy". Eso permite probarlas con Node.
//
// Cubre: RF-2, RF-3, RF-4, RF-5, RF-6, RF-9, RF-14, RNF-7
// Ver: specs/001-heat-map/spec.md
// ============================================

// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo
// con <script> sus nombres chocarían con los de los demás archivos,
// porque todos comparten el mismo ámbito global de la página.
(function () {

// --- Constantes de la escala de intensidad (RF-4) ---

// Los límites superiores de cada nivel. El nivel 5 no tiene tope:
// un día de 800 minutos se ve igual que uno de 100, pero se cuenta entero.
const LIMITES_NIVEL = [24, 49, 74, 99];

// Las etiquetas legibles de cada nivel (RF-14)
const ETIQUETAS_NIVEL = [
    'sin estudio',
    'nivel bajo',
    'nivel moderado',
    'nivel alto',
    'nivel muy alto',
    'nivel máximo'
];

// La cantidad de semanas que representa el mapa (RF-9)
const SEMANAS_MAPA = 4;

const DIAS_POR_SEMANA = 7;

// --- Conversión de fechas ---

/**
 * Convierte cualquier fecha a clave en formato DD/MM/AAAA.
 * Es la ÚNICA puerta de entrada al formato, para que el mapa
 * nunca compare contra dos criterios distintos.
 */
function aFechaClave(fecha) {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

// Aquí estaban `aIso()` y `minutosDe()`, que ningún código usaba. `aIso` no
// tenía ni un test; `minutosDe` tenía cinco, pero probaban una función muerta.
// Ver T6.

/**
 * Convierte una clave DD/MM/AAAA a una fecha local.
 * Se usa solo para cálculos internos, nunca para mostrar.
 */
function desdeClave(clave) {
    const partes = clave.split('/');
    return new Date(
        Number(partes[2]),
        Number(partes[1]) - 1,
        Number(partes[0])
    );
}

// --- Cálculo de minutos (RF-2) ---
//
// Aquí estaba `minutosDe()`, que separaba los minutos completos de una
// duración y devolvía el remanente en milisegundos. No la usaba nada: el
// redondeo a minutos enteros lo hace `minutosTotales()`, en
// `js/datos/secciones.js`, y el remanente no lo muestra nadie. Sus cinco tests
// probaban una función muerta. Ver T6.

// --- Escala de intensidad (RF-4) ---

/**
 * Devuelve el nivel de intensidad de un día según sus minutos.
 * El nivel 5 no tiene tope: el exceso se sigue contando pero
 * no se distingue visualmente.
 */
function nivelDe(minutos) {
    const total = Math.max(0, minutos);

    // Sin minutos no hay intensidad: el día queda sin relleno (RF-3, RF-5)
    if (total === 0) return 0;

    for (let i = 0; i < LIMITES_NIVEL.length; i++) {
        if (total <= LIMITES_NIVEL[i]) {
            return i + 1;
        }
    }
    return 5;
}

/**
 * Devuelve el texto legible de un nivel, para el cursor
 * y para los lectores de pantalla.
 */
function etiquetaDeNivel(nivel) {
    return ETIQUETAS_NIVEL[nivel] ?? ETIQUETAS_NIVEL[0];
}

// --- Clasificación del día (RF-5) ---

/**
 * Dice si una fecha es el día de hoy, ya pasó, o todavía no ocurrió.
 */
function clasificarDia(fechaClave, hoyClave) {
    if (fechaClave === hoyClave) return 'hoy';

    // Compara las fechas reales, NO el texto. El formato DD/MM/AAAA no
    // sirve para ordenar: como texto "18/09/2026" resulta mayor que
    // "15/10/2026" aunque setiembre viene antes que octubre.
    const fecha = desdeClave(fechaClave).getTime();
    const hoy = desdeClave(hoyClave).getTime();

    return fecha > hoy ? 'futuro' : 'pasado';
}

// --- Período del mapa (RF-9) ---

/**
 * Devuelve los encabezados de los días de la semana, empezando por lunes.
 */
function diasDeSemana() {
    return ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
}

/**
 * Devuelve las claves de las últimas cuatro semanas,
 * terminando en el día indicado y sin incluir días futuros.
 */
function periodoDe(hoyClave) {
    const hoy = desdeClave(hoyClave);
    const cantidadDias = SEMANAS_MAPA * DIAS_POR_SEMANA;
    const claves = [];

    for (let i = cantidadDias - 1; i >= 0; i--) {
        const fecha = new Date(hoy);
        fecha.setDate(fecha.getDate() - i);
        claves.push(aFechaClave(fecha));
    }

    return claves;
}

// --- Consolidación de secciones (RF-1, RF-3) ---
//
// Aquí vivía `consolidar()`, que sumaba los minutos de las secciones por día.
// No la usaba nadie: eso lo hace `minutosTotales()`, en
// `js/datos/secciones.js`, que es la que llama `minutosDeEstudioPorDia()` y
// termina dibujando el mapa.
//
// Las dos hacen casi lo mismo, y eso era un riesgo: dos funciones para la misma
// regla pueden divergir solas, y el día que una cambie, la otra sigue con la
// versión vieja sin que nada lo note. Se borró la que no se usaba. Las reglas
// que fijaban sus tests —la medianoche, los días separados, el redondeo por
// sección— están ahora en `test/secciones.test.js`, contra `minutosTotales()`.
// Ver T6.

// --- Construcción de la grilla (RF-4, RF-5, RF-9) ---

/**
 * Arma la grilla del mapa: cuatro filas de siete columnas.
 * Cada celda lleva su clave, minutos, nivel y estado.
 *
 * Regla de la spec: los días futuros nunca llevan color.
 */
function construirGrilla(hoyClave, totales = {}) {
    const claves = periodoDe(hoyClave);
    const filas = [];

    for (let i = 0; i < claves.length; i += DIAS_POR_SEMANA) {
        filas.push(
            claves.slice(i, i + DIAS_POR_SEMANA).map((clave) => {
                const estado = clasificarDia(clave, hoyClave);
                const minutos = totales[clave] ?? 0;
                const futuro = estado === 'futuro';

                const celda = {
                    clave,
                    minutos,
                    estado,
                    // El futuro nunca se pinta, aunque haya minutos cargados
                    nivel: futuro ? 0 : nivelDe(minutos)
                };

                celda.descripcion = describir(celda);
                return celda;
            })
        );
    }

    return filas;
}

// --- Descripción para el cursor (RF-6) ---

/**
 * Devuelve el texto que se muestra al pasar el cursor por una celda.
 */
function describir(celda) {
    const dia = celda.clave;

    if (celda.estado === 'futuro') {
        return `${dia} — ese día todavía no ocurrió`;
    }

    if (celda.minutos === 0) {
        return `${dia} — no registra estudio`;
    }

    const unidad = celda.minutos === 1 ? 'minuto' : 'minutos';
    return `${dia} — ${celda.minutos} ${unidad} — ${etiquetaDeNivel(celda.nivel)}`;
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    aFechaClave,
    nivelDe,
    etiquetaDeNivel,
    clasificarDia,
    diasDeSemana,
    periodoDe,
    construirGrilla,
    describir
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.MapaCalorLogica = API;
}

})();
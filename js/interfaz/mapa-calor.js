// ============================================
// INTERFAZ — Dibujado del mapa de calor
// ============================================
//
// Solo dibuja. No calcula nada: recibe la grilla ya armada desde
// js/logica/mapa-calor.js y la pinta.
//
// Todo el texto entra con textContent, nunca con innerHTML
// (Principio 3 y Principio 5 del proyecto).
//
// Cubre: RF-5, RF-6, RF-8, RF-14
// Ver: specs/001-heat-map/spec.md
// ============================================

// Puente de carga: en Node usa require, en el navegador usa el
// global que dejó js/logica/mapa-calor.js.
// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo
// con <script> sus nombres chocarían con los de los demás archivos.
(function () {

const MapaCalorLogica = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('../logica/mapa-calor.js')
    : window.MapaCalorLogica;

const diasDeSemana = MapaCalorLogica.diasDeSemana;

/**
 * Pinta el mapa completo dentro del contenedor dado.
 *
 * @param {object} opciones
 * @param {HTMLElement} opciones.contenedor  dónde se dibuja
 * @param {Array}      opciones.grilla      filas de celdas ya calculadas
 * @param {string}     opciones.claveSeleccionada  día marcado, o null
 * @param {Function}   opciones.alSeleccionar      se llama con la clave
 * @param {Function}   opciones.alPasarElCursor    se llama con la celda o null
 */
function pintarMapa(opciones) {
    const {
        contenedor,
        grilla,
        claveSeleccionada = null,
        alSeleccionar,
        alPasarElCursor
    } = opciones;

    contenedor.textContent = '';

    const rejilla = document.createElement('div');
    rejilla.className = 'mapa-rejilla';
    rejilla.setAttribute('role', 'grid');
    rejilla.setAttribute('aria-label', 'Mapa de calor de estudio de las últimas cuatro semanas');

    // Encabezados de los días de la semana
    for (const dia of diasDeSemana()) {
        const encabezado = document.createElement('div');
        encabezado.className = 'mapa-encabezado';
        encabezado.setAttribute('role', 'columnheader');
        encabezado.textContent = dia;
        rejilla.appendChild(encabezado);
    }

    // Celdas
    for (const fila of grilla) {
        for (const celda of fila) {
            rejilla.appendChild(pintarCelda(celda, claveSeleccionada, alSeleccionar, alPasarElCursor));
        }
    }

    contenedor.appendChild(rejilla);
    contenedor.appendChild(pintarLeyenda());
}

/**
 * Dibuja una celda del mapa.
 */
function pintarCelda(celda, claveSeleccionada, alSeleccionar, alPasarElCursor) {
    const elemento = document.createElement('div');
    elemento.className = `celda-mapa nivel-${celda.nivel}`;
    elemento.dataset.fecha = celda.clave;

    if (celda.estado === 'futuro') {
        elemento.classList.add('futura');
    }

    if (celda.clave === claveSeleccionada) {
        elemento.classList.add('seleccionada');
    }

    // El marcador cambia de tamaño según el nivel (RF-14)
    if (celda.nivel > 0) {
        const marcador = document.createElement('span');
        marcador.className = 'marcador-nivel';
        marcador.setAttribute('aria-hidden', 'true');
        elemento.appendChild(marcador);
    }

    // Lectores de pantalla: fecha y minutos (RF-14)
    elemento.setAttribute('role', 'gridcell');
    elemento.setAttribute('aria-label', celda.descripcion);
    elemento.title = celda.descripcion;

    // Días futuros no se consultan
    if (celda.estado !== 'futuro') {
        elemento.addEventListener('click', () => {
            if (alSeleccionar) alSeleccionar(celda.clave);
        });

        elemento.addEventListener('mouseenter', () => {
            if (alPasarElCursor) alPasarElCursor(celda);
        });

        elemento.addEventListener('mouseleave', () => {
            if (alPasarElCursor) alPasarElCursor(null);
        });
    }

    return elemento;
}

/**
 * Dibuja la leyenda de intensidad.
 */
function pintarLeyenda() {
    const leyenda = document.createElement('div');
    leyenda.className = 'mapa-leyenda';

    const menos = document.createElement('span');
    menos.textContent = 'Menos';

    const niveles = document.createElement('div');
    niveles.className = 'niveles';

    const nombres = ['Sin estudio', 'Bajo', 'Moderado', 'Alto', 'Muy alto', 'Máximo'];

    for (let i = 0; i <= 5; i++) {
        const muestra = document.createElement('div');
        muestra.className = `muestra celda-mapa nivel-${i}`;
        muestra.style.width = '12px';
        muestra.style.height = '12px';
        muestra.title = nombres[i];
        niveles.appendChild(muestra);
    }

    const mas = document.createElement('span');
    mas.textContent = 'Más';

    leyenda.appendChild(menos);
    leyenda.appendChild(niveles);
    leyenda.appendChild(mas);

    return leyenda;
}

/**
 * Muestra el detalle de un día en el panel de texto.
 * Todo con textContent (Principio 3).
 */
function pintarDetalle(contenedor, celda) {
    if (!contenedor) return;

    contenedor.textContent = '';

    if (!celda) {
        const mensaje = document.createElement('span');
        mensaje.textContent = 'Pasá el cursor por un día para ver cuánto estudiaste.';
        contenedor.appendChild(mensaje);
        return;
    }

    const texto = document.createElement('span');
    texto.textContent = celda.descripcion;
    contenedor.appendChild(texto);
}

// --- Exportación: funciona en Node y en el navegador ---

const API = {
    pintarMapa,
    pintarDetalle
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.MapaCalorInterfaz = API;
}

})();

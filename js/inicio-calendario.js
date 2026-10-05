// ============================================
// INICIO — Mapa de calor dentro del calendario
// ============================================
//
// Conecta la lógica con la interfaz: arma la grilla, la pinta,
// y maneja el botón que alterna entre mapa y calendario mensual.
//
// Las dos vistas son independientes. El mapa no muestra anotaciones
// y el calendario mensual no muestra minutos (RF-7).
//
// Cubre: RF-7, RF-8, RF-9
// Ver: specs/001-heat-map/spec.md
// ============================================

// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo
// con <script> sus nombres chocarían con los de app.js y los módulos.
(function () {

// Puente de carga: en Node usa require, en el navegador usa los
// globales que dejaron los demás archivos.
const MapaCalorLogica = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./logica/mapa-calor.js')
    : window.MapaCalorLogica;

const MapaCalorInterfaz = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./interfaz/mapa-calor.js')
    : window.MapaCalorInterfaz;

const claveFecha = MapaCalorLogica.aFechaClave;
const armarGrilla = MapaCalorLogica.construirGrilla;
const dibujarMapaGrilla = MapaCalorInterfaz.pintarMapa;
const dibujarDetalle = MapaCalorInterfaz.pintarDetalle;

// Puente de carga: en Node usa require, en el navegador usa el global
// que dejó js/app.js.
//
// Esto pasa porque los minutos por día se calculan en app.js, que es
// quien tiene el estado de las secciones. app.js vive dentro de un
// IIFE, así que sin esta puerta la función no existiría desde acá.
// Ver la API pública al final de js/app.js.
const CuadernoVirtual = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./app.js')
    : window.CuadernoVirtual;

const minutosDeEstudioPorDia = CuadernoVirtual.minutosDeEstudioPorDia;

// Puente de carga: en Node usa require, en el navegador usa el global
// que dejó js/interfaz/visibilidad.js.
const VisibilidadInterfaz = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./interfaz/visibilidad.js')
    : window.VisibilidadInterfaz;

const aplicarVisibilidad = VisibilidadInterfaz.aplicarVisibilidad;

const mapaCalor = document.getElementById('mapaCalor');
const mapaDetalle = document.getElementById('mapaDetalle');
const btnAlternarVista = document.getElementById('btnAlternarVista');
// `calendarioMapa` estaba en esta lista y no se usaba: el mapa lo dibuja
// `js/interfaz/mapa-calor.js`, que lo busca por su cuenta. Ver T6.

// Qué vista está activa: 'mapa' o 'calendario'
let vistaActiva = 'mapa';
let claveSeleccionada = null;

// El mapa arranca siempre en modo mapa (RF-7)
const cuerpoCalendario = document.querySelector('.calendario-body');
if (cuerpoCalendario) {
    cuerpoCalendario.classList.add('mostrando-mapa');
}

// Y arranca con el chrome que corresponde a esa vista (RF-5)
aplicarVisibilidad(vistaActiva);

btnAlternarVista.addEventListener('click', alternarVista);

/**
 * Cambia entre mapa y calendario mensual.
 */
function alternarVista() {
    vistaActiva = vistaActiva === 'mapa' ? 'calendario' : 'mapa';

    const mostrarMapa = vistaActiva === 'mapa';

    // Las dos vistas se muestran y ocultan por completo (RF-7)
    if (cuerpoCalendario) {
        cuerpoCalendario.classList.toggle('mostrando-mapa', mostrarMapa);
    }

    btnAlternarVista.classList.toggle('activo', mostrarMapa);
    btnAlternarVista.textContent = mostrarMapa ? '📅 Calendario' : '🔥 Mapa';

    // El chrome acompaña a la vista: en el mapa no tiene sentido la
    // navegación de mes ni la leyenda de anotaciones (RF-5).
    aplicarVisibilidad(vistaActiva);

    if (mostrarMapa) {
        dibujarMapa();
    }
}

/**
 * Arma la grilla con los minutos reales y la pinta.
 */
function dibujarMapa() {
    if (!mapaCalor) return;

    const hoy = new Date();
    const hoyClave = claveFecha(hoy);
    const totales = minutosDeEstudioPorDia();
    const grilla = armarGrilla(hoyClave, totales);

    dibujarMapaGrilla({
        contenedor: mapaCalor,
        grilla,
        claveSeleccionada,
        alSeleccionar: (clave) => {
            claveSeleccionada = clave;
            dibujarMapa();
        },
        alPasarElCursor: (celda) => {
            dibujarDetalle(mapaDetalle, celda);
        }
    });

    dibujarDetalle(mapaDetalle, null);
}

// Cuando se abre el calendario, el mapa se dibuja con los datos frescos
const botonCalendario = document.getElementById('btnCalendario');
if (botonCalendario) {
    botonCalendario.addEventListener('click', () => {
        if (vistaActiva === 'mapa') dibujarMapa();
    });
}

})();

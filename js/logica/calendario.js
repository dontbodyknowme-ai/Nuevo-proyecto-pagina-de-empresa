// ============================================
// LÓGICA PURA — Las reglas del calendario
// ============================================
//
// En `app.js` había cuatro reglas del calendario escritas **en línea**, dentro de
// funciones que dibujan:
//
//     if (mes >= 1 && mes <= 12 && anio >= 2020 && anio <= 2100)
//     calendario.anotaciones[fecha].push({ id, tipo, descripcion })
//     anotacion.descripcion = nuevaDescripcion.trim()
//     calendario.anotaciones[fecha].splice(index, 1)
//
// Ninguna tenía ni un test, y no podía tenerlo: estaban escondidas dentro de
// funciones que llaman a `prompt`, a `confirm` y a `alert`. Una línea que dice
// qué meses existen, metida en una función que abre un `alert`, no se puede
// probar sin un navegador.
//
// Acá viven como funciones puras: reciben datos, devuelven una respuesta, no
// tocan la pantalla ni el almacenamiento. Lo que se movió es **la decisión**;
// el `prompt` y el `confirm` siguen en `app.js`.
//
// Dónde está el límite con `js/logica/anotaciones.js`: aquel módulo tiene la
// **regla** (cuántas caben por día, que es 3). Este tiene las **operaciones**
// sobre la lista de un día. La regla se pregunta, no se reescribe: las funciones
// de acá la usan en vez de volver a mirar el 3.
//
// Ver: specs/006-reducir-app-js/spec.md (RF-2), y DD-2 del plan.
//
// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo con
// `<script>` sus nombres chocarían con los de los demás archivos.
(function () {

const Anotaciones = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./anotaciones.js')
    : window.AnotacionesLogica;

// ============================================
// Qué mes y año se pueden mostrar
// ============================================

// El rango de años **no tiene origen conocido**. Nadie lo escribió en una spec:
// está ahí desde antes de que hubiera specs.
//
// Se mueve tal cual, y se deja escrito que no se sabe por qué. Lo que NO se hace
// es inventarle una razón: decir "de 2020 en adelante porque nadie debería tener
// apuntes viejos" sería una explicación fabricada, y además falsa —esto es un
// cuaderno de estudio y puede tener apuntes viejos—.
//
// Si algún día alguien decide otro rango, se cambian estos dos números y se
// escribe el motivo al lado. Ver DD-2 de specs/006-reducir-app-js/plan.md.
const ANIO_MINIMO = 2020;
const ANIO_MAXIMO = 2100;

/**
 * Dice si el mes y el año se pueden mostrar en el calendario.
 *
 * @param {number} mes   del 1 al 12
 * @param {number} anio  entre ANIO_MINIMO y ANIO_MAXIMO
 * @returns {boolean}
 */
function esMesAnioValidos(mes, anio) {
    // Que no haya mes cero ni mes trece es lo mismo que dice `Date`: no existe
    // mes cero. Si alguna vez lo hubiera, el día 1 caería en el mes anterior.
    //
    // Lo de los meses es una comparación, así que `NaN` y los textos dan `false`
    // sin querer. Está explícito para que no dependa de eso: los `<input>` del
    // calendario los escribe el usuario, y llegan vacíos.
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) return false;
    if (!Number.isInteger(anio) || anio < ANIO_MINIMO || anio > ANIO_MAXIMO) return false;

    return true;
}

// ============================================
// Agregar una anotación al día
// ============================================

// Lo que se la puede rechazar a una anotación que se quiere agregar.
// Lo devuelve `agregarAnotacion()` como `motivo`, y `app.js` lo traduce a un
// mensaje. `null` significa que se agregó.
const SIN_TEXTO = 'sin-texto';
const SIN_LUGAR = 'sin-lugar';

/**
 * Agrega una anotación a la lista de un día.
 *
 * Muta la lista que recibe. Es lo que hacía el código antes, y cambiarlo
 * obligaría a reescribir los tres llamadores para algo que no aporta: la lista
 * del día es del `calendario` de `app.js` y nadie más la tiene.
 *
 * @param {Array} anotaciones  las que ya tiene ese día. Se agrega a esta lista
 * @param {string} tipo        'parcial', 'entrega' o 'nota'
 * @param {string} descripcion  lo que escribió el usuario
 * @param {string} id          lo genera `app.js`, que es donde vive `Date.now()`
 * @returns {{agrego: boolean, motivo: string|null}}
 */
function agregarAnotacion(anotaciones, tipo, descripcion, id) {
    // Si lo que llegó no es una lista —un respaldo corrupto puede dejar
    // cualquier cosa— se crea una nueva en vez de romperse. Lo que el llamador
    // tiene que guardar después es lo que devuelve `agregarAnotacion()`.
    const lista = Array.isArray(anotaciones) ? anotaciones : [];

    const texto = typeof descripcion === 'string' ? descripcion.trim() : '';
    if (!texto) {
        return { agrego: false, motivo: SIN_TEXTO, lista };
    }

    // La pregunta "¿queda lugar?" la responde `anotaciones.js`, que es donde vive
    // el 3. Acá no se vuelve a mirar el número.
    if (!Anotaciones.tieneLugar(lista)) {
        return { agrego: false, motivo: SIN_LUGAR, lista };
    }

    lista.push({ id, tipo, descripcion: texto });
    return { agrego: true, motivo: null, lista };
}

// ============================================
// Editar una anotación
// ============================================

/**
 * Cambia **qué dice** una anotación. No su tipo ni su identificador.
 *
 * El tipo decide el color del punto en la rejilla y el identificador la
 * distingue de las demás: editar no puede convertirlas en otra anotación.
 *
 * @param {Array} anotaciones  la lista del día. Se modifica en el lugar
 * @param {number} indice      cuál de las de la lista
 * @param {string} descripcion  el texto nuevo
 * @returns {{cambio: boolean}}
 */
function cambiarDescripcion(anotaciones, indice, descripcion) {
    // El índice viene de un `data-index` del DOM. Si el día se recargó entre que
    // se dibujó y que se apretó el botón, puede quedar viejo. Antes esto tiraba
    // `TypeError` al leer `.descripcion` de `undefined`.
    if (!Array.isArray(anotaciones)) return { cambio: false };
    if (!Number.isInteger(indice) || indice < 0 || indice >= anotaciones.length) {
        return { cambio: false };
    }

    const texto = typeof descripcion === 'string' ? descripcion.trim() : '';

    // Texto vacío no es un cambio. Es lo que pasa cuando el usuario abre el
    // `prompt`, borra todo y le da a aceptar: no quiere dejar la anotación en
    // blanco, quiere deshacer la edición.
    if (!texto) return { cambio: false };

    anotaciones[indice].descripcion = texto;
    return { cambio: true };
}

// ============================================
// Quitar una anotación
// ============================================

/**
 * Saca una anotación de la lista del día.
 *
 * @param {Array} anotaciones  la lista del día. Se modifica en el lugar
 * @param {number} indice      cuál de las de la lista
 * @returns {{quito: boolean}}
 */
function quitarAnotacion(anotaciones, indice) {
    // `splice` con un índice fuera de rango no saca nada y devuelve un arreglo
    // vacío. Si el código no mira eso, la app le dice al usuario que borró algo
    // que sigue ahí.
    if (!Array.isArray(anotaciones)) return { quito: false };
    if (!Number.isInteger(indice) || indice < 0 || indice >= anotaciones.length) {
        return { quito: false };
    }

    anotaciones.splice(indice, 1);
    return { quito: true };
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    esMesAnioValidos,
    agregarAnotacion,
    cambiarDescripcion,
    quitarAnotacion,
    ANIO_MINIMO,
    ANIO_MAXIMO
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.CalendarioLogica = API;
}

})();

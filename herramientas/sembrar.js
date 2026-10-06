// ============================================
// SEMBRAR LO QUE LA APLICACIÓN REALMENTE LEE
// ============================================
//
// Lo usan `capturar-arbol.js` y `verificar-layout.js`. Por qué viven acá y no
// duplicados en cada uno: **dos copias de una siembra se desincronizan**, y la que
// queda vieja es la que nadie recuerda actualizar. Es el mismo motivo por el que
// `test/dom-falso.js` es único.
//
// Herramientas: nada de npm. Solo lo que ya trae Node y el navegador.

/**
 * El prefijo que se evalúa antes de tocar nada: **silencia `alert()` y `confirm()`**.
 *
 * ## Por qué es obligatorio, y no una comodidad
 *
 * `importarRespaldo()` termina con un `alert()`. Un `alert()` en Chrome **detiene la
 * página**: el `Runtime.evaluate` con `awaitPromise` no resuelve nunca, la sonda se queda
 * esperando y hay que matarla a mano.
 *
 * No es que el aviso incomode: es que **la sonda no puede seguir**. Y una sonda que hay
 * que interrumpir a mano es una sonda que un día se interrumpe en el lugar equivocado y
 * deja un número guardado.
 *
 * Los avisos de verdad están probados en `test/avisos-almacenamiento.test.js`. Acá no se
 * está probando qué avisa: se está preparando un escenario.
 */
const SILENCIAR = `
    window.alert = function () { return undefined; };
    window.confirm = function () { return true; };
    return 'listo';
`;

/**
 * ## Por qué `return 'listo'` explícito y no la última sentencia
 *
 * Porque la primera versión terminaba con `'listo';`, apoyándose en el valor de la última
 * sentencia. **`Runtime.evaluate` devolvió `undefined`**, y el error que salió fue *"la
 * aplicación no llegó a cargar"*, que apunta a la aplicación.
 *
 * Se aisló evaluando cuatro expresiones por CDP: las que tenían `return` devolvieron su
 * valor, y la que se apoyaba en la última sentencia no. Es un detalle de una línea que
 * costó una hora y un diagnóstico que mentía sobre dónde estaba el problema.
 *
 * La regla: **en una sonda, el valor se devuelve explícitamente.** El valor implícito es
 * un supuesto sobre el evaluador, y los evaluadores no están obligados a cumplirlo.
 */

/**
 * Escribe un respaldo por el camino de escritura de la aplicación y recarga.
 *
 * ## Por qué recibe callbacks y no el cliente CDP
 *
 * Porque **las dos herramientas llaman al CDP distinto**: `capturar-arbol.js` trabaja
 * sobre el target del primer plano y su `enviar` toma dos argumentos; `verificar-layout.js`
 * se adjunta a una sesión y el suyo toma tres. Un helper que supusiera una de las dos
 * formas fallaría en la otra, y el fallo sería "la página no cargó" — que apunta a la
 * aplicación y no al helper.
 *
 * ## Por qué `importarRespaldo()` y no escribir el almacén a mano
 *
 * Porque es lo que hace la persona usuaria. `importarRespaldo()` pasa por
 * `escribirGrupo()` —que ordena las escrituras y deja la memoria al día— y además
 * **marca la migración**.
 *
 * Y la marca es justamente lo que faltaba: sin ella, en la recarga la aplicación lee el
 * almacén viejo y **no ve lo que se acaba de escribir**. Ese defecto apareció al
 * arreglar estas herramientas; está en `test/respaldo-camino.test.js`, *"un respaldo
 * importado se ve después de recargar, aunque el perfil estuviera vacío"*.
 *
 * Escribir `window.AlmacenamientoDatos.guardarGrupo()` a mano se parecería más al
 * almacenamiento y menos a la aplicación: dejaría la marca sin poner, y la sonda volvería
 * a medir una aplicación vacía con un paso más.
 *
 * ## Por qué no se borra la base con `indexedDB.deleteDatabase()`
 *
 * Porque con la aplicación **abierta la base está bloqueada** y la llamada queda esperando
 * un `blocked` que no llega: la sonda se cuelga. Vaciar los cuatro grupos con un respaldo
 * vacío cumple el mismo papel, porque **importar reemplaza los cuatro** y el escenario
 * arranca de cero.
 *
 * @param {() => Promise<void>} navegar      va a la aplicación y la deja lista
 * @param {(expr:string, esPromesa?:boolean) => Promise<string>} evaluar
 * @param {object} respaldo  como lo entiende `importarRespaldo()`
 */
async function sembrar(navegar, evaluar, respaldo) {
    // 1 · La aplicación tiene que estar **abierta y arrancada**: `importarRespaldo()`
    // rechaza mientras el arranque no terminó, y en ese caso el escenario mediría otra
    // cosa —o nada— en vez de lo que se quiere medir.
    await navegar();

    const preparado = await evaluar(`(function () { ${SILENCIAR} })()`);

    if (preparado !== 'listo') {
        throw new Error(
            'la página no respondió al preparar la siembra (' + preparado + '). Si esto '
            + 'aparece, la aplicación no llegó a cargar, y medirla daría una pantalla '
            + 'vacía. Ojo: el error parece de la aplicación y es de la sonda.'
            + '\nDetalle de la respuesta: ' + JSON.stringify(preparado)
        );
    }

    // 2 · Escribir por el camino de la aplicación.
    const resultado = await evaluar(`(function () {
        const app = window.CuadernoVirtual;
        if (!app) return Promise.resolve('sin-aplicacion');

        return app.importarRespaldo(${JSON.stringify(respaldo)})
            .then(function (ok) { return ok ? 'ok' : 'rechazado'; },
                  function (e) { return 'error: ' + e; });
    })()`, true);

    if (resultado !== 'ok') {
        throw new Error(
            'no se pudo sembrar el respaldo por el camino de la aplicación: ' + resultado
            + '. Medir con la siembra a medias es peor que no medir: daría números de '
            + 'una aplicación que el usuario no tiene.'
        );
    }

    // 3 · Recargar, para que la aplicación arranque desde el almacén.
    await navegar();
}

/**
 * Deja los cuatro grupos vacíos, para que un escenario arranque de cero.
 *
 * @param {() => Promise<void>} navegar
 * @param {(expr:string, esPromesa?:boolean) => Promise<string>} evaluar
 */
async function vaciar(navegar, evaluar) {
    await sembrar(navegar, evaluar, {
        materias: [], heredados: [], estudio: [], anotaciones: {}
    });
}

/**
 * Convierte los datos que las herramientas tenían como el valor crudo de
 * `cuadernoVirtual` en un respaldo con la forma que la aplicación espera.
 *
 * La diferencia es la clave de adentro: antes era *la lista*; ahora es *un objeto con la
 * lista dentro*. Es el mismo dato con la forma del respaldo.
 *
 * @param {string|Array} datos
 * @returns {object}
 */
function comoRespaldo(datos) {
    return {
        materias: typeof datos === 'string' ? JSON.parse(datos) : datos,
        heredados: [],
        estudio: [],
        anotaciones: {}
    };
}

module.exports = { sembrar, vaciar, comoRespaldo };
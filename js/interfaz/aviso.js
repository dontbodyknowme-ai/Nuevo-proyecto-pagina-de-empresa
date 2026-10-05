// ============================================
// INTERFAZ — El aviso de datos con problemas
// ============================================
//
// Un cartel arriba de todo que dice qué encontró al revisar los datos, y que
// se cierra con un botón.
//
// ## Por qué no un `alert()`
//
// Un `alert()` bloquea la app, corta lo que el usuario estaba haciendo, y hay
// que apretar un botón para seguir. Con un problema que viene de un respaldo
// viejo, eso pasa en **cada arranque**: el usuario no abre más la app.
//
// Este aviso no bloquea nada. La app carga normal y el cartel queda ahí.
//
// ## Por qué no dice "arreglalo"
//
// No sabe qué quería el usuario. Solo puede informar. La decisión es de él, y
// para decidir bien tiene que saber dos cosas: qué está mal, y que **no se
// perdió nada**.
//
// ## Lo que NO hace
//
// No calcula qué está mal: eso lo hace `js/logica/datos.js`, que ya tiene sus
// tests. Acá solo se pinta lo que le pasaron.
//
// Ver: specs/003-refactor-app/task.md (T6)

(function () {

// ---------- Lo visible ----------

// Aquí estaba `estaOculto()`, que decía si el elemento tenía `hidden` —el
// atributo o la propiedad de HTML5—. La app no la llamaba nunca: solo la
// usaban sus tests, diecisiete veces, como forma cómoda de preguntar si el
// cartel estaba escondido.
//
// Estar en el código de producción sin que la producción la use es tests en el
// lugar equivocado. Se movió al archivo de test, donde sí hace falta. Ver T6.

/** Lo esconde y limpia lo que tenía pintado. */
function ocultarAviso(aviso) {
    if (!aviso) return;

    while (aviso.hijos && aviso.hijos.length > 0) {
        aviso.removeChild?.(aviso.hijos[0]);
        aviso.hijos.shift();
    }

    aviso.hidden = true;
    aviso.setAttribute?.('hidden', '');
}

// ---------- Pintar ----------

/**
 * Muestra el cartel con la lista de problemas.
 *
 * @param {Element} aviso    el contenedor del aviso
 * @param {{resumen: string, problemas: Array}} datos
 */
function mostrarAviso(aviso, datos) {
    if (!aviso) return;

    const problemas = Array.isArray(datos && datos.problemas) ? datos.problemas : [];

    // Sin problemas no hay nada que decir. Y lo que se hubiera pintado antes
    // se borra, para que no queden avisos viejos pegados.
    ocultarAviso(aviso);
    if (problemas.length === 0) return;

    aviso.hidden = false;
    aviso.removeAttribute?.('hidden');

    const doc = aviso.ownerDocument || globalThis.document;

    // Un <div> con el texto del resumen.
    const resumen = doc.createElement('div');
    resumen.className = 'aviso-datos-resumen';
    // Texto del módulo de lógica, por `textContent`: nunca marcado.
    resumen.textContent = datos.resumen || '';
    aviso.appendChild(resumen);

    // Una línea por problema.
    const lista = doc.createElement('ul');
    lista.className = 'aviso-datos-lista';

    for (const problema of problemas) {
        const item = doc.createElement('li');
        item.textContent = problema.mensaje || '';
        lista.appendChild(item);
    }

    aviso.appendChild(lista);

    // El botón de cerrar.
    const boton = doc.createElement('button');
    boton.className = 'aviso-datos-cerrar';
    boton.type = 'button';
    boton.textContent = 'Entendido';
    boton.addEventListener('click', () => ocultarAviso(aviso));
    aviso.appendChild(boton);
}

// ---------- La parte que arma el texto ----------

/**
 * Arma lo que hay que mostrar a partir de la lista de problemas.
 *
 * No toca la pantalla: es un paso intermedio para que la función de pintar
 * quede con una sola responsabilidad.
 */
function reconstruirAviso(problemas) {
    const lista = (Array.isArray(problemas) ? problemas : []).filter(p =>
        p && typeof p === 'object' && typeof p.mensaje === 'string' && p.mensaje.length > 0
    );

    const n = lista.length;
    const plural = n === 1 ? 'problema' : 'problemas';

    return {
        resumen: n === 0
            ? 'Todo está bien.'
            : `Se encontraron ${n} ${plural} en tus datos. ` +
              'Se conserva todo lo que se pudo leer: no se borró nada.',
        problemas: lista
    };
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

const API = {
    mostrarAviso,
    ocultarAviso,
    reconstruirAviso
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.AvisoInterfaz = API;
}

})();
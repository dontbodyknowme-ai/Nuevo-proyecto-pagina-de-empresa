// ============================================
// CUADERNO VIRTUAL — LÓGICA COMPLETA
// ============================================

// El IIFE aísla las variables de este archivo. Sin esto, al cargarlo
// con <script> sus nombres chocarían con los de los demás archivos,
// porque todos comparten el mismo ámbito global de la página.
(function () {

// La lógica del mapa de calor vive aparte, en funciones puras.
// Ver: specs/001-heat-map/spec.md
//
// Puente de carga: en Node usa require, en el navegador usa los
// globales que dejaron los archivos de lógica.
const LogicaMapa = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./logica/mapa-calor.js')
    : window.MapaCalorLogica;

const LogicaAlmacen = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./logica/almacenamiento.js')
    : window.AlmacenamientoLogica;

// Las reglas del calendario: qué meses existen, y agregar, editar y quitar
// anotaciones. Ver specs/006-reducir-app-js/spec.md (RF-2).
const LogicaCalendario = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./logica/calendario.js')
    : window.CalendarioLogica;

const DatosSecciones = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./datos/secciones.js')
    : window.SeccionesDatos;

// Puente de carga: en Node usa require, en el navegador usa el global
// que dejo js/interfaz/visor.js.
const VisorInterfaz = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./interfaz/visor.js')
    : window.VisorInterfaz;

const mostrarHtml = VisorInterfaz.mostrarHtml;

// Puente de carga: en Node usa require, en el navegador usa el global
// que dejó js/logica/fechas.js.
const FechasLogica = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./logica/fechas.js')
    : window.FechasLogica;

const diasDelMes = FechasLogica.diasDelMes;
const columnaDelDiaUno = FechasLogica.columnaDelDiaUno;
// `existeFecha` también estaba aquí y no se usaba en app.js. La función sigue
// en `js/logica/fechas.js`, que es donde pertenece; lo que no hacía falta era
// el alias. Ver T6.

// Puente de carga: en Node usa require, en el navegador usa el global
// que dejó js/logica/anotaciones.js.
const AnotacionesLogica = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./logica/anotaciones.js')
    : window.AnotacionesLogica;

const tieneLugar = AnotacionesLogica.tieneLugar;
const textoContador = AnotacionesLogica.textoContador;

// Puente de carga: en Node usa require, en el navegador usa el global
// que dejó js/logica/estadisticas.js.
const EstadisticasLogica = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./logica/estadisticas.js')
    : window.EstadisticasLogica;

const calcularEstadisticas = EstadisticasLogica.calcularEstadisticas;

// Puente de carga: en Node usa require, en el navegador usa el global
// que dejó js/logica/arbol.js.
const ArbolLogica = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./logica/arbol.js')
    : window.ArbolLogica;

// Puente de carga: en Node usa require, en el navegador usa el global
// que dejó js/logica/datos.js.
const DatosLogica = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./logica/datos.js')
    : window.DatosLogica;

// Puente de carga: en Node usa require, en el navegador usa el global
// que dejó js/interfaz/aviso.js.
const AvisoInterfaz = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./interfaz/aviso.js')
    : window.AvisoInterfaz;

const aFechaClave = LogicaMapa.aFechaClave;
const debeRevertir = LogicaAlmacen.debeRevertir;
const puedeEscribir = LogicaAlmacen.puedeEscribir;
const crearSecciones = DatosSecciones.crearSecciones;
const estaAbierta = DatosSecciones.estaAbierta;
const abrirSeccion = DatosSecciones.abrirSeccion;
const cerrarSeccion = DatosSecciones.cerrarSeccion;
const leerSecciones = DatosSecciones.leerSecciones;
const restaurarSeccionesAntiguas = DatosSecciones.restaurarSeccionesAntiguas;
const minutosTotales = DatosSecciones.minutosTotales;

// ===== DOM =====
const arbolNav = document.getElementById('arbolNavegacion');
const avisoDatos = document.getElementById('avisoDatos');
const visor = document.getElementById('visor');
const breadcrumbs = document.getElementById('breadcrumbs');
const menuLateral = document.getElementById('menuLateral');
const btnToggle = document.getElementById('btnToggle');
const menuRespaldo = document.getElementById('menuRespaldo');
const btnAddMateria = document.getElementById('btnAddMateria');
const modalMateria = document.getElementById('modalMateria');
const inputMateriaNombre = document.getElementById('inputMateriaNombre');
const btnCancelarMateria = document.getElementById('btnCancelarMateria');
const btnCrearMateria = document.getElementById('btnCrearMateria');
const inputArchivo = document.getElementById('inputArchivo');

const btnLectura = document.getElementById('btnLectura');
// `let`, no `const`: el nodo al que apunta se destruye cada vez que se vuelve a
// pintar la bienvenida, porque la barra vive dentro de `#visor` y
// `mostrarBienvenida()` reescribe `#visor` entero. Ver T2 de
// specs/004-app-funcional-y-limpeza/spec.md
let statsContainer = document.getElementById('statsContainer');
const btnConfig = document.getElementById('btnConfig');
const menuDesplegable = document.getElementById('menuDesplegable');
const btnExportar = document.getElementById('btnExportar');
const btnImportar = document.getElementById('btnImportar');
const inputImportar = document.getElementById('inputImportar');

// ===== Estado =====
let materias = [];
let materiaActual = null;

// ===== Inicializar =====
cargarDatos();
construirArbol();
actualizarStats();
inicializarDragDrop();
inicializarModoLectura();

// ===== Persistencia =====

// Aquí estaba `escriturasBloqueadas`, que se ponía en `true` cuando el
// almacenamiento no daba y en `false` cuando sí, y que **nadie leía nunca**.
//
// No hacía falta. `puedeEscribir()` se vuelve a decidir en cada llamada, así
// que si una escritura entra ahora, entra; y si el usuario exporta y libera
// espacio, entra en la siguiente. Una bandera que nadie consulta no bloquea
// nada: solo ocupa un nombre y hace creer que hay un estado que nadie
// controla. Se fue en T6.
let avisoMostrado = false;

/**
 * Arma el texto del aviso de almacenamiento lleno, para los caminos en los que
 * **sí se sabe cuánto hay**: se pasó el umbral, o la operación no entra.
 *
 * Son dos motivos distintos y por eso el texto los distingue. Los dos requieren
 * acciones distintas —liberar espacio ya, o hacer el archivo más chico— y un
 * usuario al que no se le dice cuál está frente a él no puede elegir.
 *
 * Con un motivo que no está en la lista devuelve un texto honesto en vez de
 * mentir: antes todo motivo que no fuera `'espacio'` salía como "se pasó el
 * umbral crítico", incluso `'lectura'`, que es un almacenamiento que no dejó ni
 * leer. Mandar a exportar por un problema de lectura hace que el usuario gaste
 * trabajo al pedo.
 */
function mensajeAlmacenamientoLleno(motivo, porcentajeUso, porcentajeUmbral) {
    const causas = {
        umbral: 'se pasó el umbral crítico',
        espacio: 'la operación no entra: el documento es más grande que el hueco que queda'
    };

    // Un motivo que no se conoce no se anuncia como otro. Se dice lo único que
    // se sabe con seguridad.
    const causa = causas[motivo]
        || 'el navegador no dejó seguir guardando';

    return 'El almacenamiento del navegador está casi lleno.\n\n'
        + `Motivo: ${causa}.\n`
        + `Ocupación: ${porcentajeUso} %. El umbral de alarma está en ${porcentajeUmbral} %.\n\n`
        + 'Exportá tus documentos para liberar espacio antes de seguir subiendo.\n\n'
        + 'Mientras tanto, no se guardará nada nuevo para no perder lo que ya tenés.';
}

/**
 * Arma el texto del aviso para el camino en el que **no se sabe cuánto hay**: el
 * navegador tiró al escribir y no se puede leer el motivo.
 *
 * Este texto **no lleva porcentaje**, y no por descuido. El cálculo se hizo antes
 * de escribir y dio bien —por eso se intentó—; lo que falló fue el `setItem`. El
 * número que hay a mano describe una situación que no es la que se está
 * avisando, y puesto junto a "casi lleno" se vuelve un contrasentido: salió
 * "casi lleno (0 % de 95 %)", con el 0 % porque el uso era bajo.
 *
 * Un número que no explica nada es peor que ningún número: hace dudar de si la
 * app está mal. Ver RF-11 y specs/006-reducir-app-js/spec.md.
 */
function mensajeFalloAlGuardar() {
    return 'El navegador no dejó guardar.\n\n'
        + 'Puede ser que el almacenamiento esté lleno. Exportá tus documentos '
        + 'para liberar espacio.\n\n'
        + 'Lo que ya tenías quedó como estaba: no se perdió nada.\n\n'
        + 'Mientras tanto, no se guardará nada nuevo.';
}

/**
 * Avisa al usuario que el almacenamiento se está llenando y le
 * ofrece la salida: exportar. Nunca se pierde nada en silencio.
 */
function avisarAlmacenamientoLleno(motivo, porcentajeUso, porcentajeUmbral) {
    if (avisoMostrado) return;
    avisoMostrado = true;

    alert(mensajeAlmacenamientoLleno(motivo, porcentajeUso, porcentajeUmbral));
}

/**
 * El mismo aviso, para el camino en el que el navegador tiró al escribir.
 *
 * Es una función aparte y no un cuarto valor de `motivo` a propósito: el
 * mensaje es distinto porque lo que se sabe es distinto. Si se metiera en
 * `mensajeAlmacenamientoLleno`, el camino que no sabe el porcentaje terminaría
 * mostrando un porcentaje, que es justo el defecto que se está corrigiendo.
 */
function avisarFalloAlGuardar() {
    if (avisoMostrado) return;
    avisoMostrado = true;

    alert(mensajeFalloAlGuardar());
}

/**
 * Cambia las materias y las guarda. Si no se puede guardar, **deshace el
 * cambio en memoria** (RF-3).
 *
 * Por qué hace falta: los llamadores de `guardarDatos()` no miraban el retorno.
 * Con el almacenamiento lleno, `eliminarMateria()` sacaba la materia del
 * arreglo, `guardarDatos()` devolvía `false`, y la pantalla se redibujaba igual:
 * el usuario veía un borrado que no se había guardado, y al recargar la página
 * la materia volvía a aparecer.
 *
 * Que la app diga que algo pasó es una promesa. Si no se pudo guardar, no se
 * dibuja el cambio.
 *
 * @param {Array} nuevasMaterias
 * @returns {boolean} true si se guardó
 */
function guardarRevirtiendoSiFalla(nuevasMaterias) {
    const anteriores = materias;
    materias = nuevasMaterias;

    if (guardarDatos()) return true;

    // Solo se deshace lo que hay en memoria. Lo que está en `localStorage` ya
    // lo revirtió `guardarDatos()` por su cuenta.
    materias = anteriores;
    return false;
}

/**
 * Lee las materias guardadas y revisa que estén enteras.
 *
 * Antes no había revisión: `JSON.parse` y listo. Un respaldo viejo con una
 * materia a la que le faltaba la lista de documentos rompía la app durante el
 * arranque, y al romperse ahí el mapa de calor nunca se dibujaba.
 *
 * Ahora los datos raro se completan y se anotan. **No se borra nada**: un
 * documento sin contenido sigue en el menú, con su nombre, para que el usuario
 * lo vea y decida.
 */
function cargarDatos() {
    const datos = localStorage.getItem('cuadernoVirtual');
    if (!datos) {
        materias = [];
        return;
    }

    let leidos;
    try {
        leidos = JSON.parse(datos);
    } catch (error) {
        // Ni siquiera es JSON. No se pisa lo que hay: se avisa y se sigue vacía.
        materias = [];
        mostrarAvisoDatos([{
            tipo: 'json-invalido',
            mensaje: 'Lo que había guardado no se pudo leer. Se empezó de cero, ' +
                     'pero el contenido anterior no se tocó.'
        }]);
        return;
    }

    const { materias: limpias, problemas } = DatosLogica.normalizarMaterias(leidos);
    materias = limpias;

    if (problemas.length > 0) {
        mostrarAvisoDatos(problemas);
    }
}

/**
 * Muestra el cartel de arriba con lo que se encontró.
 *
 * No bloquea: si fuera un `alert()` y el problema viene de un respaldo viejo,
 * el usuario vería el cartel en cada arranque y dejaría de abrir la app.
 */
function mostrarAvisoDatos(problemas) {
    AvisoInterfaz.mostrarAviso(
        avisoDatos,
        AvisoInterfaz.reconstruirAviso(problemas)
    );
}

/**
 * Guarda los datos protegiendo lo que ya está guardado (RF-11).
 *
 * Antes de escribir revisa si hay espacio. Si no hay, avisa y
 * no escribe: perder parte de los datos sería peor que no guardar.
 * Si la escritura falla a mitad, vuelve a dejar lo anterior.
 */
function guardarDatos() {
    const clave = 'cuadernoVirtual';
    const contenido = JSON.stringify(materias);

    // Se mide lo que ya ocupa el almacenamiento del navegador
    let usoActual = 0;
    try {
        for (const llave in localStorage) {
            if (localStorage.hasOwnProperty(llave)) {
                usoActual += (localStorage.getItem(llave) || '').length + llave.length;
            }
        }
    } catch (error) {
        // Si no se puede medir, se escribe igual y se protege con el try
        usoActual = 0;
    }

    const capacidadTotal = 5 * 1024 * 1024;   // el tope habitual del navegador
    const decision = puedeEscribir(usoActual, capacidadTotal, contenido.length);

    if (!decision.permitido) {
        avisarAlmacenamientoLleno(decision.motivo, decision.porcentajeUso, decision.porcentajeUmbral);
        return false;
    }

    // Copia de seguridad para poder volver atrás si algo falla.
    //
    // Va protegida porque algunos navegadores en modo privado lanzan al leer.
    // Y si no se puede leer, NO se escribe: el camino de reversión usa `null`
    // para significar "no había datos guardados", así que confundir "no había"
    // con "no pude leer" haría que un fallo de escritura borrara lo que el
    // usuario tenía. No guardar es menos malo que perder.
    let copiaAnterior;
    try {
        copiaAnterior = localStorage.getItem(clave);
    } catch (error) {
        // Tampoco acá se sabe cuánto hay: lo que falló fue la lectura, y no se
        // midió nada. Por eso usa el aviso sin porcentaje.
        avisarFalloAlGuardar();
        return false;
    }

    try {
        localStorage.setItem(clave, contenido);
        return true;
    } catch (error) {
        // Se revierte por completo: nunca queda la mitad de los datos
        try {
            if (copiaAnterior === null) {
                localStorage.removeItem(clave);
            } else {
                localStorage.setItem(clave, copiaAnterior);
            }
        } catch (errorReversion) {
            // No hay más que hacer: el aviso ya le dice al usuario que exporte
        }

        // `debeRevertir`, el binding de la línea 81. Antes decía
        // `LogicaCapacidad.debeRevertir`, un identificador que no existe en
        // ninguna parte del proyecto: tiraba ReferenceError y la excepción
        // salía de guardarDatos(), dejando a quien la llamó a medias.
        if (debeRevertir(error)) {
            // Ojo: acá se pasaba `decision.porcentajeUso`, que se calculó
            // **antes** de escribir y por eso dio bien —si no, no se habría
            // llegado a escribir—. El número describe el estado previo, no el
            // fallo. Con poco uso, el aviso salía "casi lleno (0 % de 95 %)".
            // Ver `mensajeFalloAlGuardar()`.
            avisarFalloAlGuardar();
        }

        return false;
    }
}

// ===== Construir árbol =====
//
// Qué nodos hay y con qué datos se decide en `js/logica/arbol.js`. Acá solo se
// pinta y se enganchan los clics.
//
// Los manejadores se quedan acá a propósito: cada uno cierra sobre su
// `materia` o su `doc` reales, y eso no se puede probar desde un módulo puro.
// Lo que se mueve es la estructura, no el comportamiento.

/**
 * Un botón del modelo, pintado.
 *
 * Se usa `textContent` y no `innerHTML`: el ícono viene del modelo, pero mejor
 * no depender de que siga siendo un emoji.
 */
function crearBotonNodo(boton) {
    const el = document.createElement('button');
    el.className = boton.clase;
    el.title = boton.titulo;
    el.textContent = boton.icono;
    return el;
}

function construirArbol() {
    arbolNav.innerHTML = '';

    const modelo = ArbolLogica.modeloArbol(materias);

    // Sin materias: un texto, no una lista.
    if (modelo === null) {
        const vacio = document.createElement('p');
        vacio.className = 'arbol-vacio';

        const texto = ArbolLogica.mensajeSinMaterias();
        vacio.appendChild(document.createTextNode(texto.principal));
        vacio.appendChild(document.createElement('br'));
        vacio.appendChild(document.createTextNode(texto.secundario));

        arbolNav.appendChild(vacio);
        return;
    }

    const ul = document.createElement('ul');

    // El modelo sale de `materias` en el mismo orden y con la misma cantidad,
    // así que el índice i del modelo es el objeto `materias[i]`. Esa
    // correspondencia es lo que permite usar los objetos reales en los
    // manejadores, que necesitan la referencia y no solo el id.
    modelo.forEach((nodo, i) => {
        const materia = materias[i];
        const li = document.createElement('li');

        // --- Nodo materia ---
        const nodoMateria = document.createElement('div');
        nodoMateria.className = 'nodo nodo-materia';
        nodoMateria.dataset.id = nodo.id;

        const flecha = document.createElement('span');
        flecha.className = 'flecha abierta';
        flecha.textContent = '▶';

        const icono = document.createElement('span');
        icono.className = 'icono';
        icono.textContent = nodo.icono;

        const nombre = document.createElement('span');
        nombre.className = 'nombre';
        nombre.textContent = nodo.nombre;

        const acciones = document.createElement('div');
        acciones.className = 'acciones-nodo';

        for (const boton of nodo.acciones) {
            const el = crearBotonNodo(boton);

            if (boton.clave === 'agregar') {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    materiaActual = materia;
                    inputArchivo.click();
                });
            } else if (boton.clave === 'eliminar') {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    eliminarMateria(materia.id);
                });
            }

            acciones.appendChild(el);
        }

        nodoMateria.appendChild(flecha);
        nodoMateria.appendChild(icono);
        nodoMateria.appendChild(nombre);
        nodoMateria.appendChild(acciones);

        // --- Lista de documentos ---
        const ulDocs = document.createElement('ul');

        nodo.documentos.forEach((nodoDocModelo, j) => {
            const doc = materia.documentos[j];

            const liDoc = document.createElement('li');
            const nodoDoc = document.createElement('div');
            nodoDoc.className = 'nodo nodo-doc';
            nodoDoc.dataset.id = nodoDocModelo.id;

            const iconoDoc = document.createElement('span');
            iconoDoc.className = 'icono';
            iconoDoc.textContent = nodoDocModelo.icono;

            const nombreDoc = document.createElement('span');
            nombreDoc.className = 'nombre';
            nombreDoc.textContent = nodoDocModelo.nombre;

            const accionesDoc = document.createElement('div');
            accionesDoc.className = 'acciones-nodo';

            for (const boton of nodoDocModelo.acciones) {
                const el = crearBotonNodo(boton);

                if (boton.clave === 'ver') {
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        verDocumento(materia, doc);
                    });
                } else if (boton.clave === 'renombrar') {
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        renombrarDocumento(materia, doc);
                    });
                } else if (boton.clave === 'eliminar') {
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        eliminarDocumento(materia.id, doc.id);
                    });
                }

                accionesDoc.appendChild(el);
            }

            nodoDoc.appendChild(iconoDoc);
            nodoDoc.appendChild(nombreDoc);
            nodoDoc.appendChild(accionesDoc);

            nodoDoc.addEventListener('click', () => {
                verDocumento(materia, doc);
            });

            // Ordenar documentos arrastrando
            nodoDoc.draggable = true;
            nodoDoc.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', doc.id);
                nodoDoc.style.opacity = '0.5';
            });
            nodoDoc.addEventListener('dragend', () => {
                nodoDoc.style.opacity = '1';
            });
            nodoDoc.addEventListener('dragover', (e) => {
                e.preventDefault();
            });
            nodoDoc.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                const targetId = doc.id;
                if (draggedId === targetId) return;

                const draggedIndex = materia.documentos.findIndex(d => d.id === draggedId);
                const targetIndex = materia.documentos.findIndex(d => d.id === targetId);
                if (draggedIndex === -1 || targetIndex === -1) return;

                // Se arma la lista nueva en vez de mover en el sitio: si el
                // almacenamiento está lleno, el orden de pantalla vuelve a ser
                // el que estaba guardado (RF-11).
                const reordenados = [...materia.documentos];
                const [dragged] = reordenados.splice(draggedIndex, 1);
                reordenados.splice(targetIndex, 0, dragged);

                const nuevas = materias.map(m => (m.id === materia.id
                    ? { ...m, documentos: reordenados }
                    : m));

                if (!guardarRevirtiendoSiFalla(nuevas)) return;

                construirArbol();
            });

            liDoc.appendChild(nodoDoc);
            ulDocs.appendChild(liDoc);
        });

        nodoMateria.addEventListener('click', () => {
            toggleNodo(nodoMateria, ulDocs);
        });

        li.appendChild(nodoMateria);
        li.appendChild(ulDocs);
        ul.appendChild(li);
    });

    arbolNav.appendChild(ul);
}

// ===== Toggle nodos =====
function toggleNodo(nodo, ul) {
    const flecha = nodo.querySelector('.flecha');
    const estaVisible = ul.style.display !== 'none';

    ul.style.display = estaVisible ? 'none' : 'block';
    flecha.classList.toggle('abierta', !estaVisible);
}

// ===== Modal materia =====
btnAddMateria.addEventListener('click', () => {
    modalMateria.classList.add('visible');
    inputMateriaNombre.value = '';
    inputMateriaNombre.focus();
});

btnCancelarMateria.addEventListener('click', () => {
    modalMateria.classList.remove('visible');
});

btnCrearMateria.addEventListener('click', () => {
    const nombre = inputMateriaNombre.value.trim();
    if (!nombre) return;

    const materia = {
        id: 'm_' + Date.now(),
        nombre: nombre,
        icono: '📁',
        documentos: []
    };

    // Si no se puede guardar, la materia no aparece: antes se veía en el menú y
    // desaparecía al recargar (RF-11).
    if (!guardarRevirtiendoSiFalla([...materias, materia])) return;

    construirArbol();
    actualizarStats();
    modalMateria.classList.remove('visible');
});

inputMateriaNombre.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnCrearMateria.click();
    }
});

// ===== Subida de archivos =====
inputArchivo.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length || !materiaActual) return;

    await agregarArchivosAMateria(materiaActual.id, files);

    inputArchivo.value = '';
});

/**
 * Arma el documento a partir de un archivo, **sin agregarlo** a ninguna materia.
 *
 * Antes esta función hacía `materia.documentos.push(doc)`: mutaba los datos y
 * dejaba que el llamador guardara. Si el almacenamiento estaba lleno, el archivo
 * se veía en pantalla y **no existía**: desaparecía al recargar.
 *
 * Ahora solo devuelve el documento. Quien lo llama arma el arreglo nuevo y lo
 * guarda con `guardarRevirtiendoSiFalla`, que deshace si no entra (RF-11).
 *
 * @returns {Promise<object|null>}
 */
async function crearDocumento(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    let tipo = 'desconocido';

    if (extension === 'html' || extension === 'htm') tipo = 'html';
    else if (extension === 'pdf') tipo = 'pdf';
    else if (extension === 'docx' || extension === 'doc') tipo = 'word';

    const doc = {
        id: 'd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        nombre: file.name,
        tipo: tipo,
        contenido: null
    };

    if (tipo === 'html') {
        doc.contenido = await file.text();
    } else if (tipo === 'pdf' || tipo === 'word') {
        doc.contenido = await fileToBase64(file);
    }

    return doc;
}

/**
 * Agrega archivos a una materia y los guarda.
 *
 * @returns {Promise<boolean>} si se pudieron guardar
 */
async function agregarArchivosAMateria(materiaId, files) {
    const nuevos = [];
    for (const file of files) {
        nuevos.push(await crearDocumento(file));
    }
    if (nuevos.length === 0) return true;

    const materiasNuevas = materias.map(m => (m.id === materiaId
        ? { ...m, documentos: [...m.documentos, ...nuevos] }
        : m));

    // Si no entra, `guardarRevirtiendoSiFalla` deja las materias como estaban:
    // el archivo no aparece en el menú y no se pierde nada.
    if (!guardarRevirtiendoSiFalla(materiasNuevas)) return false;

    construirArbol();
    actualizarStats();
    return true;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== Ver documento =====
async function verDocumento(materia, doc) {
    // Actualizar breadcrumbs
    actualizarBreadcrumbs([materia.nombre, doc.nombre]);

    // Marcar nodo activo
    document.querySelectorAll('.arbol .nodo.activo').forEach(n => n.classList.remove('activo'));
    document.querySelectorAll(`.nodo-doc[data-id="${doc.id}"]`).forEach(n => n.classList.add('activo'));

    // Un PDF o un Word sin contenido no tiene nada que cargar. Antes se
    // intentaba igual, y la app llegaba a hacer `fetch(undefined)`: una petición
    // a la nada que además se veía en la consola.
    if (DatosLogica.documentoSinContenido(doc)) {
        mostrarDocumentoSinContenido(doc);
        return;
    }

    // Mostrar contenido
    if (doc.tipo === 'html') {
        mostrarHtml(visor, doc);
    } else if (doc.tipo === 'pdf') {
        visor.innerHTML = `
            <div class="pdf-viewer">
                <div class="pdf-toolbar">
                    <button class="pdf-btn" id="pdfZoomOut">−</button>
                    <span class="pdf-zoom-level" id="pdfZoomLevel">100%</span>
                    <button class="pdf-btn" id="pdfZoomIn">+</button>
                    <span class="pdf-separator">|</span>
                    <button class="pdf-btn" id="pdfPrev">←</button>
                    <span class="pdf-page-info" id="pdfPageInfo">Página 1 de 1</span>
                    <button class="pdf-btn" id="pdfNext">→</button>
                </div>
                <div class="pdf-container" id="pdfContainer">
                    <canvas id="pdfCanvas"></canvas>
                </div>
            </div>
        `;
        cargarPDF(doc.contenido);
    } else if (doc.tipo === 'word') {
        try {
            const arrayBuffer = await fetch(doc.contenido).then(r => r.arrayBuffer());
            const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
            mostrarHtml(visor, { nombre: doc.nombre, contenido: result.value });
        } catch (error) {
            visor.innerHTML = `
                <div class="bienvenida">
                    <div class="bienvenida-icono">⚠️</div>
                    <h2>Error al convertir</h2>
                    <p>No se pudo convertir el archivo Word. Intenta con otro archivo.</p>
                </div>
            `;
        }
    }
}

/**
 * Qué se ve cuando a un documento le falta el contenido.
 *
 * Es un dato del usuario que está en el menú pero no se puede mostrar. **No se
 * borra**: se explica, para que la persona decida si lo vuelve a subir o si lo
 * saca.
 *
 * El texto va por `textContent` porque el nombre del archivo es dato del
 * usuario: un archivo llamado `<script>` no puede entrar como marcado.
 */
function mostrarDocumentoSinContenido(doc) {
    const panel = document.createElement('div');
    panel.className = 'documento-sin-contenido';

    const icono = document.createElement('div');
    icono.className = 'bienvenida-icono';
    icono.textContent = '⚠️';
    panel.appendChild(icono);

    const titulo = document.createElement('h2');
    titulo.textContent = 'A este archivo le falta el contenido';
    panel.appendChild(titulo);

    const nombre = document.createElement('p');
    nombre.className = 'documento-sin-contenido-nombre';
    nombre.textContent = doc.nombre || 'Sin nombre';
    panel.appendChild(nombre);

    const explicacion = document.createElement('p');
    explicacion.textContent =
        'Su nombre está en el cuaderno, pero el archivo en sí no está guardado. ' +
        'Puede pasar cuando un respaldo quedó incompleto.';
    panel.appendChild(explicacion);

    const queHacer = document.createElement('p');
    queHacer.textContent =
        'Podés volver a subirlo con el botón de arriba, o eliminarlo con la 🗑️. ' +
        'No se borró nada por sí solo.';
    panel.appendChild(queHacer);

    visor.innerHTML = '';
    visor.appendChild(panel);
}

// ===== Eliminar materia =====
function eliminarMateria(id) {
    if (!confirm('¿Eliminar esta materia y todos sus documentos?')) return;

    const restantes = materias.filter(m => m.id !== id);

    // `guardarRevirtiendoSiFalla` deja `materias` como estaba si no se puede
    // guardar. Por eso la limpieza de `materiaActual` va después: si se guardó,
    // ya no existe la materia que estaba seleccionada.
    const seGuardo = guardarRevirtiendoSiFalla(restantes);
    if (!seGuardo) return;

    // Evitar referencia obsoleta: si la materia seleccionada ya no existe, limpiar
    if (materiaActual && !materias.some(m => m.id === materiaActual.id)) {
        materiaActual = null;
    }

    construirArbol();
    actualizarStats();
    mostrarBienvenida();
}

// ===== Eliminar documento =====
function eliminarDocumento(materiaId, docId) {
    if (!confirm('¿Eliminar este documento?')) return;

    const materia = materias.find(m => m.id === materiaId);
    if (!materia) return;

    // Se arma el arreglo nuevo en vez de mutar el que existe: si no se puede
    // guardar, `guardarRevirtiendoSiFalla` devuelve la lista anterior y no
    // quedó a medias.
    const nuevas = materias.map(m => (m.id === materiaId
        ? { ...m, documentos: m.documentos.filter(d => d.id !== docId) }
        : m));

    if (!guardarRevirtiendoSiFalla(nuevas)) return;

    construirArbol();
    actualizarStats();
    mostrarBienvenida();
}

// ===== Utilidades =====
// `obtenerIconoDoc` se fue a `js/logica/arbol.js` como `iconoDocumento()`:
// el mapa de íconos por tipo es una decisión de contenido, no de dibujado.
// La copia de la tabla quedó también en `test/arbol.test.js`, porque lo que
// importa es que los íconos no cambien.
//
// Y `escapeHtml` se fue con el XSS de T3: los datos del usuario ya no entran
// en ningún `innerHTML`, así que no hay nada que escapar. Ver T6.

function actualizarBreadcrumbs(partes) {
    breadcrumbs.innerHTML = '';
    partes.forEach((p, i) => {
        const esUltimo = i === partes.length - 1;

        if (i > 0) {
            const sep = document.createElement('span');
            sep.className = 'sep';
            sep.textContent = '/';
            breadcrumbs.appendChild(sep);
        }

        const parte = document.createElement('span');
        if (esUltimo) parte.className = 'actual';
        // textContent en lugar de innerHTML: evita inyección de HTML
        parte.textContent = p;
        breadcrumbs.appendChild(parte);
    });
}

/**
 * Vuelve a pintar la pantalla de bienvenida.
 *
 * Ojo: esto reescribe `#visor` **entero**, y la barra de estadísticas vive
 * adentro. Antes esta plantilla no la traía, así que la barra se borraba del
 * documento y la variable `statsContainer` quedaba apuntando a un nodo suelto:
 * `actualizarStats()` escribía ahí y la barra **no volvía a aparecer** hasta
 * recargar la página.
 *
 * El bloque tiene que quedar igual que el de `index.html`. Hay un test que
 * compara las frases de los dos y falla si divergen.
 */
function mostrarBienvenida() {
    visor.innerHTML = `
        <div class="bienvenida">
            <div class="bienvenida-icono">📚</div>
            <h2>Tu Cuaderno Virtual</h2>
            <p>Crea materias y sube tus documentos HTML, PDF o Word para organizarlos.</p>
            <div class="stats" id="statsContainer"></div>
            <p class="hint">Haz clic en "Añadir Materia" para comenzar.</p>
        </div>
    `;

    // El nodo anterior se destruyó con el innerHTML. Hay que apuntar al nuevo
    // ANTES de pintar los números: al revés se escribiría en el nodo viejo.
    statsContainer = document.getElementById('statsContainer');
    if (statsContainer) actualizarStats();

    breadcrumbs.innerHTML = '';
}

// ===== Menú lateral =====
//
// Un clic, dos clases, y que cada ancho las lea a su manera.
//
// El botón hace lo mismo en un teléfono y en un escritorio, pero lo que
// significa es distinto: en uno ancho pliega el panel a 60 px, en uno angosto
// (≤640 px) abre el cajón. El código **no sabe en qué ancho está**, y no debe
// saberlo: medir la pantalla desde JavaScript está prohibido, y duplicar en el
// código una decisión que la hoja de estilos ya tomó es cómo se desincronizan
// las dos. La constitución lo dice así:
//
//   Decisión          Dónde vive
//   Qué se muestra    lógica pura + visibilidad.js
//   Cómo se acomoda   la hoja de estilos
//
// Así que el clic pone "visible" y "colapsado" juntas y se termina. Abajo de
// 640 px, la hoja anula lo que "colapsado" hace, porque el cajón tiene que
// entrar completo; arriba de 640 px, "visible" no tiene ninguna regla y no
// molesta.
//
// La flecha del botón también la gira la hoja de estilos, y en los dos anchos
// al revés. Por eso el title del botón no dice "colapsar" ni "abrir": con el
// mismo clic, cualquiera de las dos palabras estaría mintiendo en un ancho.

// `menuLateral` necesita tabindex para recibir el foco: un <aside> no es
// tabulable por su cuenta, y sin esto al abrir el cajón el foco se queda
// atrás y el tabulador sigue recorriendo la página de fondo.
menuLateral.setAttribute('tabindex', '-1');

/**
 * ¿El menú está alternado? Misma respuesta en cualquier ancho: la clase se
 * puso o no se puso.
 */
function menuEstaAlternado() {
    return menuLateral.classList.contains('visible');
}

/**
 * Pone las dos clases, o ninguna de las dos. Nunca una sola: ver la nota de
 * arriba.
 */
function ponerMenu(abierto) {
    menuLateral.classList.toggle('visible', abierto);
    menuLateral.classList.toggle('colapsado', abierto);
    btnToggle.classList.toggle('colapsado', abierto);
}

/**
 * Cierra el menú y devuelve el foco al botón.
 *
 * Si ya estaba cerrado no hace nada. Eso es lo que permite usar la misma
 * función para cerrar "porque el usuario tocó un ítem" sin tener que preguntar
 * en qué ancho está: en el escritorio el menú solo se puede tocar cuando ya
 * está desplegado —plegado, el contenido tiene `pointer-events: none`—, y
 * ahí las dos clases ya están ausentes, así que cerrar no cambia nada.
 */
function cerrarMenu() {
    if (!menuEstaAlternado()) return;
    ponerMenu(false);
    btnToggle.focus();
}

/**
 * El clic del botón: pliega en un ancho ancho, abre en uno angosto.
 */
function alternarMenu() {
    const abierto = !menuEstaAlternado();

    ponerMenu(abierto);

    if (abierto) {
        // El foco entra al menú: si se queda en el botón, el tabulador sigue
        // recorriendo la página que está detrás del cajón.
        menuLateral.focus();
    } else {
        // Y al cerrar vuelve al botón. Si se quedara en un elemento que ya no
        // está, el usuario quedaría perdido y el tabulador arrancar de nuevo
        // desde el principio de la página.
        btnToggle.focus();
    }
}

btnToggle.addEventListener('click', alternarMenu);

// Tocar el respaldo cierra el menú. Es la salida más natural en un teléfono:
// el cajón tapa la pantalla, y lo que queda al costado es "tocá afuera".
// El respaldo solo existe por debajo de 640 px —arriba está apagado por
// reglas de la hoja—, así que en el escritorio este manejador nunca corre.
menuRespaldo.addEventListener('click', alternarMenu);

// Escape es la tercera salida. Sin ella, en un teléfono sin teclado, un menú
// abierto sin salida visible deja al usuario encerrado.
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!menuEstaAlternado()) return;

    alternarMenu();
});

// Cuarta salida, y la que se usa sola: tocar un ítem del menú lo cierra.
//
// Abajo de 640 px, porque el cajón tapa la pantalla y el usuario quiere ver lo
// que tocó. Arriba de 640 px no cambia nada, y no por una condición: en el
// escritorio el menú solo se puede tocar cuando ya está desplegado, y
// desplegado significa que las dos clases están ausentes, así que `cerrarMenu`
// sale sin hacer nada. Por eso no hace falta preguntar el ancho.
//
// Va después de la acción, no antes: el clic primero lo atiende el manejador
// del ítem —que abre el documento, la materia o el modal— y recién después
// cierra el menú. Cada manejador hace su cosa y este no lo interrumpe.
menuLateral.addEventListener('click', (e) => {
    const accionable = e.target.closest(
        '.nodo-materia, .nodo-doc, .btn-calendario, .btn-add-materia');

    if (accionable) cerrarMenu();
});

// ===== PDF.js =====
let pdfDoc = null;
let pdfPageNum = 1;
let pdfScale = 1.0;
let pdfRendering = false;
let pdfPendingPage = null;

async function cargarPDF(dataUrl) {
    try {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const loadingTask = pdfjsLib.getDocument({ data: dataUrl });
        pdfDoc = await loadingTask.promise;
        pdfPageNum = 1;
        pdfScale = 1.0;

        document.getElementById('pdfPageInfo').textContent = `Página 1 de ${pdfDoc.numPages}`;
        document.getElementById('pdfZoomLevel').textContent = '100%';

        renderPDFPage();

        // Eventos de controles
        document.getElementById('pdfZoomIn').addEventListener('click', () => {
            pdfScale = Math.min(pdfScale + 0.25, 3.0);
            document.getElementById('pdfZoomLevel').textContent = Math.round(pdfScale * 100) + '%';
            renderPDFPage();
        });

        document.getElementById('pdfZoomOut').addEventListener('click', () => {
            pdfScale = Math.max(pdfScale - 0.25, 0.5);
            document.getElementById('pdfZoomLevel').textContent = Math.round(pdfScale * 100) + '%';
            renderPDFPage();
        });

        document.getElementById('pdfPrev').addEventListener('click', () => {
            if (pdfPageNum > 1) {
                pdfPageNum--;
                document.getElementById('pdfPageInfo').textContent = `Página ${pdfPageNum} de ${pdfDoc.numPages}`;
                renderPDFPage();
            }
        });

        document.getElementById('pdfNext').addEventListener('click', () => {
            if (pdfPageNum < pdfDoc.numPages) {
                pdfPageNum++;
                document.getElementById('pdfPageInfo').textContent = `Página ${pdfPageNum} de ${pdfDoc.numPages}`;
                renderPDFPage();
            }
        });

    } catch (error) {
        visor.innerHTML = `
            <div class="bienvenida">
                <div class="bienvenida-icono">⚠️</div>
                <h2>Error al cargar PDF</h2>
                <p>No se pudo cargar el archivo PDF.</p>
            </div>
        `;
    }
}

async function renderPDFPage() {
    if (pdfRendering) {
        pdfPendingPage = pdfPageNum;
        return;
    }

    pdfRendering = true;

    try {
        const page = await pdfDoc.getPage(pdfPageNum);
        const canvas = document.getElementById('pdfCanvas');
        const context = canvas.getContext('2d');

        const container = document.getElementById('pdfContainer');
        const containerWidth = container.clientWidth - 40;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(pdfScale, containerWidth / baseViewport.width);
        const viewport = page.getViewport({ scale: scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        if (pdfPendingPage !== null) {
            pdfPageNum = pdfPendingPage;
            pdfPendingPage = null;
            pdfRendering = false;
            renderPDFPage();
            return;
        }

    } catch (error) {
        console.error('Error renderizando PDF:', error);
    }

    pdfRendering = false;
}

// ===== Estadísticas =====
// El cálculo vive en js/logica/estadisticas.js. Acá solo se pinta.
function actualizarStats() {
    // Puede no estar: si el bloque de bienvenida cambia y no trae la barra, o
    // si se llama antes de que exista. Escribir en un contenedor que no está no
    // puede romper la app.
    if (!statsContainer) return;

    const { totalMaterias, totalDocumentos, totalPalabras } =
        calcularEstadisticas(materias);

    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-numero">${totalMaterias}</span>
            <span class="stat-label">Materias</span>
        </div>
        <div class="stat-item">
            <span class="stat-numero">${totalDocumentos}</span>
            <span class="stat-label">Documentos</span>
        </div>
        <div class="stat-item">
            <span class="stat-numero">${totalPalabras.toLocaleString()}</span>
            <span class="stat-label">Palabras</span>
        </div>
    `;
}

// ===== Renombrar documento =====
function renombrarDocumento(materia, doc) {
    const nuevoNombre = prompt('Nuevo nombre:', doc.nombre);
    if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre.trim() === doc.nombre) return;

    const limpio = nuevoNombre.trim();

    // Se arma el arreglo nuevo: si no entra, el nombre viejo sigue ahí y en
    // pantalla (RF-11).
    const nuevas = materias.map(m => (m.id !== materia.id ? m : {
        ...m,
        documentos: m.documentos.map(d => (d.id === doc.id ? { ...d, nombre: limpio } : d))
    }));

    if (!guardarRevirtiendoSiFalla(nuevas)) return;

    construirArbol();
}

// ===== Modo lectura =====
function inicializarModoLectura() {
    btnLectura.addEventListener('click', () => {
        menuLateral.classList.toggle('oculto');
        btnLectura.classList.toggle('activo');
        document.body.classList.toggle('modo-lectura');
    });

    // Salir del modo lectura con tecla Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('modo-lectura')) {
            menuLateral.classList.remove('oculto');
            btnLectura.classList.remove('activo');
            document.body.classList.remove('modo-lectura');
        }
    });
}

// ===== Arrastrar y soltar =====
function inicializarDragDrop() {
    const dropZone = document.getElementById('dropZone');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        // Usar la materia seleccionada solo si sigue viva en el array
        const materiaDestino = (materiaActual && materias.includes(materiaActual))
            ? materiaActual
            : materias[0];

        if (!materiaDestino) {
            alert('Crea una materia primero para subir archivos.');
            return;
        }

        await agregarArchivosAMateria(materiaDestino.id, files);
    });
}

// ===== Exportar/Importar =====
btnConfig.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDesplegable.classList.toggle('visible');
});

document.addEventListener('click', () => {
    menuDesplegable.classList.remove('visible');
});

btnExportar.addEventListener('click', () => {
    const datos = {
        materias: materias,
        fechaExportacion: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuaderno-virtual-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    menuDesplegable.classList.remove('visible');
});

btnImportar.addEventListener('click', () => {
    inputImportar.click();
    menuDesplegable.classList.remove('visible');
});

inputImportar.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        let datos;
        try {
            datos = JSON.parse(e.target.result);
        } catch (error) {
            alert('Error al importar: el archivo no es un JSON válido.');
            return;
        }

        if (!datos || !datos.materias || !Array.isArray(datos.materias)) {
            alert('Error al importar: el archivo no tiene la lista de materias.');
            return;
        }

        if (!confirm('Esto sobrescribirá tus datos actuales. ¿Continuar?')) return;

        // Se revisa ANTES de sobrescribir. Si el respaldo trae algo raro, se
        // completa lo que falta y se avisa: no se descarta nada del archivo, y
        // tampoco se pisa lo que hay sin avisar.
        const { materias: limpias, problemas } = DatosLogica.normalizarMaterias(datos);

        // Importar pisa TODO. Si no se puede guardar, el usuario tiene que
        // seguir con sus datos, no con los del respaldo a medias.
        if (!guardarRevirtiendoSiFalla(limpias)) {
            alert('No se pudo guardar lo importado. Tus datos siguen como estaban.');
            return;
        }

        construirArbol();
        actualizarStats();

        if (problemas.length > 0) {
            mostrarAvisoDatos(problemas);
        }

        alert(problemas.length === 0
            ? 'Datos importados correctamente'
            : `Datos importados, pero ${problemas.length} ` +
              `${problemas.length === 1 ? 'problema' : 'problemas'} ` +
              'fueron encontrados. Mirá el aviso de arriba.');
    };
    reader.readAsText(file);
    inputImportar.value = '';
});

// ===== Pomodoro =====
// `sesionesCompletadas` estaba acá y se le sumaba 1 cada vez que terminaba una
// sesión. Nadie lo leía nunca: no se guardaba, no se mostraba, no servía para
// nada. Se fue en T6. Si alguna vez se quiere un "hoy: N sesiones", ese
// contador se construye con la pantalla que lo muestra, no antes.
let pomodoro = {
    estado: 'inactivo',
    tiempoRestante: 25 * 60,
    intervalo: null
};

const btnIniciar = document.getElementById('btnIniciar');
const btnPausar = document.getElementById('btnPausar');
const btnReiniciar = document.getElementById('btnReiniciar');
const pomodoroTiempo = document.getElementById('pomodoroTiempo');
const pomodoroWidget = document.getElementById('pomodoroWidget');

btnIniciar.addEventListener('click', iniciarPomodoro);
btnPausar.addEventListener('click', pausarPomodoro);
btnReiniciar.addEventListener('click', reiniciarPomodoro);

function iniciarPomodoro() {
    if (pomodoro.estado === 'inactivo' || pomodoro.estado === 'pausado') {
        pomodoro.estado = 'estudio';
        btnIniciar.disabled = true;
        btnPausar.disabled = false;
        pomodoroWidget.classList.add('activo');
        abrirSeccionEstudio();

        pomodoro.intervalo = setInterval(() => {
            pomodoro.tiempoRestante--;
            actualizarDisplayPomodoro();

            if (pomodoro.tiempoRestante <= 0) {
                finalizarPomodoro();
            }
        }, 1000);
    }
}

function pausarPomodoro() {
    if (pomodoro.estado === 'estudio' || pomodoro.estado === 'descanso') {
        clearInterval(pomodoro.intervalo);
        pomodoro.estado = 'pausado';
        btnIniciar.disabled = false;
        btnPausar.disabled = true;
        pomodoroWidget.classList.remove('activo');
        cerrarSeccionEstudio();
    }
}

function reiniciarPomodoro() {
    clearInterval(pomodoro.intervalo);
    cerrarSeccionEstudio();
    pomodoro.estado = 'inactivo';
    pomodoro.tiempoRestante = 25 * 60;
    btnIniciar.disabled = false;
    btnPausar.disabled = true;
    pomodoroWidget.classList.remove('activo');
    actualizarDisplayPomodoro();
}

function finalizarPomodoro() {
    clearInterval(pomodoro.intervalo);

    // Cerrar la sección y guardar los minutos reales (RF-1)
    cerrarSeccionEstudio();

    // Notificación
    if (Notification.permission === 'granted') {
        new Notification('¡Pomodoro completado!', {
            body: 'Hora de descansar 5 minutos'
        });
    }

    // Sonido
    reproducirSonido();

    // Cambiar a descanso
    pomodoro.estado = 'descanso';
    pomodoro.tiempoRestante = 5 * 60;
    btnIniciar.disabled = true;
    btnPausar.disabled = false;
    pomodoroWidget.classList.remove('activo');
    actualizarDisplayPomodoro();

    // Iniciar descanso
    pomodoro.intervalo = setInterval(() => {
        pomodoro.tiempoRestante--;
        actualizarDisplayPomodoro();

        if (pomodoro.tiempoRestante <= 0) {
            clearInterval(pomodoro.intervalo);
            pomodoro.estado = 'inactivo';
            pomodoro.tiempoRestante = 25 * 60;
            btnIniciar.disabled = false;
            btnPausar.disabled = true;
            actualizarDisplayPomodoro();
            if (Notification.permission === 'granted') {
                new Notification('¡Descanso terminado!', {
                    body: 'Hora de estudiar de nuevo'
                });
            }
        }
    }, 1000);
}

function actualizarDisplayPomodoro() {
    const minutos = Math.floor(pomodoro.tiempoRestante / 60);
    const segundos = pomodoro.tiempoRestante % 60;
    pomodoroTiempo.textContent = `${minutos}:${String(segundos).padStart(2, '0')}`;
}

// ===== Registro de minutos reales (RF-1, RF-2, RF-10, RF-13) =====

// Estado de las secciones de estudio. La lógica vive en
// js/datos/secciones.js y js/logica/mapa-calor.js; acá solo
// se conecta con el temporizador y con el almacenamiento.
const seccionesEstado = crearSecciones();

// Seonelegan los registros del formato viejo (25 minutos fijos).
// Se conservan tal cual: RF-10 dice no descartar nada.
seccionesEstado.seccionesAntiguas = restaurarSeccionesAntiguas(
    JSON.parse(localStorage.getItem('pomodoroSesiones') || '[]')
).seccionesAntiguas;

/**
 * Abre una sección de estudio. Se llama al iniciar el Pomodoro.
 */
function abrirSeccionEstudio() {
    abrirSeccion(seccionesEstado, Date.now());
}

/**
 * Cierra la sección de estudio y guarda los minutos.
 * Se llama al pausar, reiniciar, completar o cerrar la ventana.
 */
function cerrarSeccionEstudio() {
    cerrarSeccion(seccionesEstado, Date.now());

    if (seccionesEstado.secciones.length === 0) return;

    const seccionesGuardadas = JSON.parse(
        localStorage.getItem('mapaCalorSecciones') || '[]'
    );

    for (const seccion of leerSecciones(seccionesEstado)) {
        seccionesGuardadas.push(seccion);
    }

    try {
        localStorage.setItem('mapaCalorSecciones', JSON.stringify(seccionesGuardadas));
    } catch (error) {
        // RF-11: nunca se pierde nada en silencio
        if (debeRevertir(error)) {
            alert('No se pudieron guardar los minutos de estudio. '
                + 'Exportá tus documentos para liberar espacio.');
        }
        return;
    }

    // Ya quedaron guardadas, se limpia el estado en memoria
    seccionesEstado.secciones = [];
}

/**
 * Devuelve los minutos de estudio por día, sumando las secciones
 * nuevas y los registros antiguos conservados.
 *
 * ---------- La sección abierta NO se cuenta, y es una decisión ----------
 *
 * Abajo se le pasa `seccionAbierta`, y `minutosTotales()` **no la usa**: solo
 * recorre `estado.secciones`. Se ve como un descuido y no lo es. Es CP-1 de
 * `specs/001-heat-map/spec.md`, resuelta el 2026-10-02.
 *
 * El motivo: el mapa es de consulta rápida. Si la casilla del día creciera con
 * cada minuto de Pomodoro y se ajustara al cerrar, el número dejaría de ser un
 * dato para pasar a ser una animación.
 *
 * El costo, aceptado: durante la sesión el mapa no refleja nada, y si se cierra
 * la pestaña a mitad de Pomodoro los minutos aparecen recién en la recarga
 * siguiente. Se conservan igual —la sección se sella por RF-13—, lo que se
 * decidió es que el mapa no la mire hasta que esté cerrada.
 *
 * Si algún día se cambia: revisar el CP-1 de `resolucion-cp.md` antes, porque
 * ahí está la alternativa que se descartó y el motivo.
 */
function minutosDeEstudioPorDia() {
    const seccionesGuardadas = JSON.parse(
        localStorage.getItem('mapaCalorSecciones') || '[]'
    );

    const estadoConPersistidas = {
        seccionAbierta: seccionesEstado.seccionAbierta,
        secciones: seccionesGuardadas,
        seccionesAntiguas: seccionesEstado.seccionesAntiguas
    };

    return minutosTotales(estadoConPersistidas, aFechaClave);
}

// Si el navegador se cierra o la pestaña se recarga con el
// Pomodoro corriendo, se sella la sección hasta ese momento
// para no perder el tiempo ya seguido (RF-13).
window.addEventListener('beforeunload', () => {
    if (!estaAbierta(seccionesEstado)) return;
    cerrarSeccionEstudio();
});

function reproducirSonido() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log('No se pudo reproducir sonido');
    }
}

// Solicitar permiso de notificaciones
if (Notification.permission !== 'granted') {
    Notification.requestPermission();
}

// ===== Calendario =====
let calendario = {
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
    anotaciones: {},
    diaSeleccionado: null
};

const btnCalendario = document.getElementById('btnCalendario');
const modalCalendario = document.getElementById('modalCalendario');
const btnCerrarCalendario = document.getElementById('btnCerrarCalendario');
const btnIrMes = document.getElementById('btnIrMes');
const inputMes = document.getElementById('inputMes');
const inputAnio = document.getElementById('inputAnio');
const calendarioGrid = document.getElementById('calendarioGrid');
const panelFecha = document.getElementById('panelFecha');
const anotacionesExistentes = document.getElementById('anotacionesExistentes');
const tipoAnotacion = document.getElementById('tipoAnotacion');
const descripcionAnotacion = document.getElementById('descripcionAnotacion');
const btnGuardarAnotacion = document.getElementById('btnGuardarAnotacion');

// Cargar anotaciones de localStorage
function cargarAnotaciones() {
    const datos = localStorage.getItem('calendarioAnotaciones');
    if (datos) {
        calendario.anotaciones = JSON.parse(datos);
    }
}

function guardarAnotaciones() {
    localStorage.setItem('calendarioAnotaciones', JSON.stringify(calendario.anotaciones));
}

function abrirCalendario() {
    cargarAnotaciones();
    calendario.mes = new Date().getMonth() + 1;
    calendario.anio = new Date().getFullYear();
    inputMes.value = calendario.mes;
    inputAnio.value = calendario.anio;
    generarCalendario();
    modalCalendario.classList.add('visible');
}

function cerrarCalendario() {
    modalCalendario.classList.remove('visible');
}

function generarCalendario() {
    calendarioGrid.innerHTML = '';

    // Encabezados de días
    // Encabezados de días.
    //
    // Antes esta lista estaba escrita acá y también en `js/logica/mapa-calor.js`.
    // Dos copias de lo mismo. Ahora sale del módulo, que es donde ya está y
    // donde tiene tests. Ver specs/006-reducir-app-js/spec.md
    const diasSemana = LogicaMapa.diasDeSemana();
    diasSemana.forEach(dia => {
        const th = document.createElement('div');
        th.className = 'calendario-dia-header';
        th.textContent = dia;
        calendarioGrid.appendChild(th);
    });

    // Días con estudio.
    //
    // Antes esto leía 'pomodoroSesiones' y guardaba las fechas tal
    // cual, en formato ISO. Después las comparaba contra las claves
    // DD/MM/AAAA de las celdas, así que la comparación nunca coincidía
    // y ningún día se resaltaba nunca.
    //
    // Ahora se usa minutosDeEstudioPorDia(), que ya devuelve las claves
    // en DD/MM/AAAA y además suma los minutos reales de las secciones
    // nuevas, no solo las sesiones antiguas de 25 minutos fijos.
    const minutosPorDia = minutosDeEstudioPorDia();
    const diasEstudio = new Set(Object.keys(minutosPorDia));

    // Celdas vacías antes del primer día.
    // El cálculo va en js/logica/fechas.js: qué día de la semana cae el 1º.
    const diaSemanaInicio = columnaDelDiaUno(calendario.anio, calendario.mes);
    for (let i = 0; i < diaSemanaInicio; i++) {
        const vacia = document.createElement('div');
        vacia.className = 'celda-dia vacia';
        calendarioGrid.appendChild(vacia);
    }

    // Días del mes.
    //
    // Antes el bucle llegaba siempre hasta 31. En febrero eso dibujaba el 29,
    // el 30 y el 31, y como esas celdas eran clicables se podían guardar
    // anotaciones en fechas que no existen. Ver RF-2 de
    // specs/003-refactor-app/spec.md.
    // El día de hoy, una sola vez por dibujo de la rejilla.
    //
    // Estaba **dentro** del bucle de días: `new Date()` y el formato DD/MM/AAAA
    // armados a mano, una vez por cada día del mes. Treinta y una respuestas
    // idénticas.
    //
    // Y el formato a mano era un **segundo criterio**: `aFechaClave()`, que ya
    // está importada acá y ya se usa para los minutos del Pomodoro, hace
    // exactamente lo mismo. Su comentario dice que es *"la ÚNICA puerta de
    // entrada al formato, para que el mapa nunca compare contra dos criterios
    // distintos"*.
    //
    // Acá arriba también mejora algo: "hoy" ahora es **uno solo** para toda la
    // rejilla. Antes, si el dibujo cruzaba la medianoche, la primera celda podía
    // ser de un día y las últimas de otro.
    const fechaHoy = aFechaClave(new Date());

    const totalDias = diasDelMes(calendario.anio, calendario.mes);
    for (let dia = 1; dia <= totalDias; dia++) {
        const fecha = `${String(dia).padStart(2, '0')}/${String(calendario.mes).padStart(2, '0')}/${calendario.anio}`;
        const celda = document.createElement('div');
        celda.className = 'celda-dia';
        celda.textContent = dia;
        celda.dataset.fecha = fecha;

        // Resaltar día seleccionado
        if (calendario.diaSeleccionado === fecha) {
            celda.classList.add('dia-seleccionado');
        }

        // Resaltar día actual
        if (fecha === fechaHoy) {
            celda.classList.add('hoy');
        }

        // Verificar sesión de estudio
        if (diasEstudio.has(fecha)) {
            celda.classList.add('tiene-estudio');
            const indicadores = document.createElement('div');
            indicadores.className = 'indicadores';
            const dot = document.createElement('span');
            dot.className = 'dot dot-estudio';
            indicadores.appendChild(dot);
            celda.appendChild(indicadores);
        }

        // Verificar anotaciones
        if (calendario.anotaciones[fecha] && calendario.anotaciones[fecha].length > 0) {
            const tipos = calendario.anotaciones[fecha].map(a => a.tipo);
            if (tipos.includes('parcial')) celda.classList.add('tiene-parcial');
            if (tipos.includes('entrega')) celda.classList.add('tiene-entrega');
            if (tipos.includes('nota')) celda.classList.add('tiene-nota');

            const indicadores = celda.querySelector('.indicadores') || document.createElement('div');
            indicadores.className = 'indicadores';
            if (!celda.querySelector('.indicadores')) celda.appendChild(indicadores);
            calendario.anotaciones[fecha].forEach(a => {
                const dot = document.createElement('span');
                // `claseDeTipo()` es la frontera: el `tipo` puede venir de un
                // respaldo importado, y con espacios sería **varias** clases en
                // vez de una. Acá solo sale de la lista de tipos o es `sin-tipo`.
                dot.className = 'dot dot-' + AnotacionesLogica.claseDeTipo(a.tipo);
                indicadores.appendChild(dot);
            });
        }

        celda.addEventListener('click', () => seleccionarDia(fecha));
        calendarioGrid.appendChild(celda);
    }
}

function seleccionarDia(fecha) {
    calendario.diaSeleccionado = fecha;
    panelFecha.textContent = fecha;
    btnGuardarAnotacion.disabled = false;
    mostrarAnotaciones(fecha);
    generarCalendario();
}

function cambiarMes() {
    const mes = parseInt(inputMes.value);
    const anio = parseInt(inputAnio.value);

    // La comparación se fue a `js/logica/calendario.js`. Acá solo queda qué se
    // hace con la respuesta: avançar el calendario, o avisar. El rango de años
    // que usa no tiene origen conocido y está anotado al lado de la función.
    if (LogicaCalendario.esMesAnioValidos(mes, anio)) {
        calendario.mes = mes;
        calendario.anio = anio;
        generarCalendario();
    } else {
        alert('Mes o año inválido');
    }
}

function mostrarAnotaciones(fecha) {
    anotacionesExistentes.innerHTML = '';
    const anotaciones = calendario.anotaciones[fecha] || [];

    if (anotaciones.length === 0) {
        const vacio = document.createElement('p');
        vacio.className = 'anotaciones-vacio';
        vacio.textContent = 'No hay anotaciones para este día';
        anotacionesExistentes.appendChild(vacio);
    } else {
        anotaciones.forEach((anotacion, index) => {
            const item = document.createElement('div');
            // Misma frontera que el punto de arriba: `anotacion.tipo` viene de
            // donde venga, y lo que entra al `className` sale de `claseDeTipo()`.
            item.className = 'anotacion-item ' + AnotacionesLogica.claseDeTipo(anotacion.tipo);

            // textContent en lugar de innerHTML: evita inyección de HTML
            const texto = document.createElement('span');
            texto.className = 'anotacion-texto';
            texto.textContent = anotacion.descripcion;

            const acciones = document.createElement('div');
            acciones.className = 'anotacion-acciones';

            const btnEditar = document.createElement('button');
            btnEditar.className = 'btn-editar';
            btnEditar.dataset.index = index;
            btnEditar.textContent = '✏️';

            const btnEliminar = document.createElement('button');
            btnEliminar.className = 'btn-eliminar';
            btnEliminar.dataset.index = index;
            btnEliminar.textContent = '🗑️';

            acciones.appendChild(btnEditar);
            acciones.appendChild(btnEliminar);

            item.appendChild(texto);
            item.appendChild(acciones);
            anotacionesExistentes.appendChild(item);
        });
    }

    // Eventos de editar y eliminar
    anotacionesExistentes.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            editarAnotacion(fecha, index);
        });
    });

    anotacionesExistentes.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            eliminarAnotacion(fecha, index);
        });
    });

    // Actualizar contador
    const contador = document.createElement('p');
    contador.className = 'anotaciones-contador';
    contador.textContent = textoContador(anotaciones);
    anotacionesExistentes.appendChild(contador);

    // Habilitar/deshabilitar botón guardar
    btnGuardarAnotacion.disabled = !tieneLugar(anotaciones);
}

function guardarAnotacion() {
    if (!calendario.diaSeleccionado) return;

    const fecha = calendario.diaSeleccionado;

    // Si el día todavía no tiene lista, se le crea una. `agregarAnotacion()`
    // devuelve la lista en la que trabajó, así que se guarda lo que devuelve y
    // no lo que había antes: si lo que llegó no era una lista, esto la arregla en
    // vez de romperse.
    //
    // La lista se asigna **después** de saber que se agregó algo. Antes pasaba
    // igual, y no es un detalle: si el usuario abre un día vacío y no escribe
    // nada, se creaba una lista vacía para ese día que después se guardaba.
    const resultado = LogicaCalendario.agregarAnotacion(
        calendario.anotaciones[fecha],
        tipoAnotacion.value,
        descripcionAnotacion.value,
        'a_' + Date.now()
    );

    // No hay ningún cartel. Antes acá había uno:
    //
    //     alert('Máximo 3 anotaciones por día');
    //
    // y era **imposible verlo**. El único camino para guardar es el clic del
    // botón, y con tres anotaciones el botón ya está deshabilitado, en
    // `mostrarAnotaciones()`. No hay Enter ni atajo: el `alert` era una ruta
    // muerta que prometía una defensa que no existía.
    //
    // Lo que avisa es el botón gris, y avisa mejor: no interrumpe y explica antes
    // de que el usuario escriba. El contador dice lo mismo con palabras.
    //
    // Decidido el 2026-10-02. Ver `test/anotaciones-interfaz.test.js`, que fija
    // las dos mitades: que el botón siga deshabilitándose, y que este cartel no
    // vuelva.
    if (!resultado.agrego) return;

    calendario.anotaciones[fecha] = resultado.lista;
    guardarAnotaciones();
    descripcionAnotacion.value = '';
    mostrarAnotaciones(fecha);
    generarCalendario();
}

function editarAnotacion(fecha, index) {
    const anotaciones = calendario.anotaciones[fecha];

    // La regla —qué pasa con el texto, y cuándo no es un cambio— se fue a
    // `js/logica/calendario.js`. Acá queda lo que necesita una pantalla: el
    // cartel para escribir y redibujar después.
    const actual = anotaciones && anotaciones[index];
    if (!actual) return;

    const nuevaDescripcion = prompt('Editar descripción:', actual.descripcion);
    if (nuevaDescripcion === null) return;

    if (LogicaCalendario.cambiarDescripcion(anotaciones, index, nuevaDescripcion)) {
        guardarAnotaciones();
        mostrarAnotaciones(fecha);
        generarCalendario();
    }
}

function eliminarAnotacion(fecha, index) {
    if (!confirm('¿Eliminar esta anotación?')) return;

    // Antes esto reordenaba la pantalla y guardaba aunque el índice estuviera
    // viejo y no se quitara nada: el usuario veía "eliminado" y la anotación
    // seguía ahí. Ahora se mira lo que devolvió la regla.
    if (LogicaCalendario.quitarAnotacion(calendario.anotaciones[fecha], index)) {
        guardarAnotaciones();
        mostrarAnotaciones(fecha);
        generarCalendario();
    }
}

// Eventos del calendario
btnCalendario.addEventListener('click', abrirCalendario);
btnCerrarCalendario.addEventListener('click', cerrarCalendario);
btnIrMes.addEventListener('click', cambiarMes);
btnGuardarAnotacion.addEventListener('click', guardarAnotacion);

// Cerrar con Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalCalendario.classList.contains('visible')) {
        cerrarCalendario();
    }
});

// --- API pública ---

// El IIFE esconde todo lo de arriba, y eso está bien: evita que los
// nombres de este archivo choquen con los de los demás.
//
// Pero hay una excepción. js/inicio-calendario.js necesita leer los
// minutos por día para dibujar el mapa de calor, y esa función vive
// acá porque depende del estado de las secciones. Sin esta puerta el
// mapa tiraba "minutosDeEstudioPorDia is not defined" y salía en blanco.
//
// Si agregás una función que otro archivo necesite, agregala acá.
const API = {
    minutosDeEstudioPorDia,
    // Se publica para poder probar qué pasa cuando el almacenamiento falla. Sin
    // esto, `test/navegador.test.js` no puede llegar a la función: vive dentro
    // del IIFE y no hay forma de llamarla desde afuera. Con el almacenamiento
    // roto, el error salía de acá y rompía a quien la llamó. Ver RF-3 de
    // specs/004-app-funcional-y-limpeza/spec.md
    guardarDatos,
    guardarRevirtiendoSiFalla,
    // Las dos que arman el texto de los avisos, por el mismo motivo que las dos
    // de arriba: son caminos que solo se recorren cuando algo sale mal, y no se
    // pueden probar si no hay por dónde llamarlas.
    //
    // Lo que se prueba no es la frase exacta sino una regla: **el camino que no
    // sabe cuánto hay no muestra porcentajes**. Es la que evita que vuelva el
    // "casi lleno (0 % de 95 %)". Ver `test/avisos-almacenamiento.test.js`.
    mensajeAlmacenamientoLleno,
    mensajeFalloAlGuardar
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.CuadernoVirtual = API;
}

})();

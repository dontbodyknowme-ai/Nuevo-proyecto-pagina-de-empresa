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

// `js/logica/almacenamiento.js` **ya no existe**. Describía la capacidad del
// almacenamiento del navegador y decidía si una escritura entraba bajo un umbral del
// 95 %: el muro de 5 MB del `localStorage`.
//
// Se borró en T10, con el usuario a favor, cuando al irse el aviso de "casi lleno"
// `app.js` dejó de llamarlo y la herramienta de código muerto lo marcó. Desaparecer el
// consumidor dejó al módulo entero, con sus cuarenta y pico tests, probando lógica a la
// que **ningún camino de la aplicación llega**: verde por arriba, muerto por debajo.
//
// El módulo era correcto para lo que midía. Lo que dejó de ser cierto es que midiera
// algo que esta app consultara. Es la diferencia entre un código que está viejo y uno que
// está vivo pero ya no se usa.

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
//
// El arranque es **una sola secuencia con `await`**: probar que el almacén del
// navegador abre, migrar lo que haya que migrar, y recién ahí dibujar. Antes de
// esta tarea era una lista de cinco llamadas sin cronía, y por eso un `JSON.parse`
// sin proteger en la línea 1446 tumbaba la página entera.
//
// **La llamada a `iniciar()` está al final del archivo**, no acá. El cuerpo usa
// `seccionesEstado`, que se declara más abajo: si se llamara desde este punto, el
// `await` inicial lo salvaría por una casualidad del orden de las microtareas. Eso
// es exactamente el tipo de acantilado que después nadie encuentra.
async function iniciar() {
    const disponibilidad = await AlmacenamientoDatos.probarDisponibilidad();

    if (!disponibilidad.disponible) {
        // El motivo va a la consola, no a la pantalla: el usuario no puede actuar
        // sobre "vencido" ni sobre "no-lectura". Decisión del 2026-10-05.
        console.warn('[cuaderno] el almacenamiento no abre:', disponibilidad.motivo);
        mostrarAlmacenamientoNoAbre();
        return;
    }

    await resolverMigracion();

    // La lectura de los minutos heredados va acá adentro, y no en el nivel de
    // arriba: es la que sin `try` tumbaba la aplicación entera.
    cargarMinutosHeredados();

    cargarDatos();
    construirArbol();
    actualizarStats();
    inicializarDragDrop();
    inicializarModoLectura();

    // Recién desde acá se puede guardar. Antes, cualquier cambio se rechaza.
    arranqueListo = true;
}

/**
 * Copia lo que haya en el almacén viejo al nuevo, si todavía no se copió.
 *
 * **Deja el almacén viejo entero.** Es la red, y no hay ninguna operación que lo
 * borre.
 *
 * ## Por qué volver a mirar el almacén viejo acá, y no leer solo del nuevo
 *
 * Porque hasta que la copia termine, el único cuaderno que existe **entero** está
 * en el viejo. Y si la copia falla, la app **sigue con el viejo**: es lo que dice
 * RF-2, y es la razón por la que volver a intentarla desde el principio no puede
 * perder nada.
 *
 * ## De dónde se lee
 *
 * Del almacén nuevo, siempre que la migración haya terminado. Del viejo **nunca**,
 * y el módulo del almacén es el que decide cuál de los dos: `leerGrupo()` tiene los
 * dos caminos y el resto del archivo no sabe cuál se está usando.
 *
 * Y hay un caso en que sí se lee del viejo: **mientras la migración no terminó**, o
 * si falló. Es lo que dice RF-2 —la aplicación sigue con el almacén viejo, que está
 * entero— y por eso volver a intentarla desde el principio no puede perder nada.
 */
async function resolverMigracion() {
    try {
        if (await AlmacenamientoDatos.estaMigrada()) {
            // Ya se copió en un arranque anterior: no se vuelve a copiar, y lo que
            // hay que hacer es **leer de ahí**. Sin esto, el cuaderno se armaría con
            // el almacén viejo —que ya no se actualiza— y lo guardado después de
            // migrar no se vería nunca.
            await cargarGruposEnMemoria();
            return;
        }
    } catch (error) {
        console.warn('[cuaderno] no se pudo leer la marca de migración:', error);
        return;
    }

    // Lo que hay hoy, leído por el camino protegido: un valor roto se reporta y se
    // sigue, no se corta la migración.
    const datos = {
        materias: leerAlmacenViejo(CLAVE_DEL_GRUPO.materias, null),
        heredados: leerAlmacenViejo(CLAVE_DEL_GRUPO.heredados, null),
        estudio: leerAlmacenViejo(CLAVE_DEL_GRUPO.estudio, null),
        anotaciones: leerAlmacenViejo(CLAVE_DEL_GRUPO.anotaciones, null)
    };

    // Sin datos no hay nada que copiar. No se marca y no se avisa: decir "se copió"
    // algo que no había sería mentir, y arrancaría la marca sin copia.
    const hayAlgo = Object.values(datos).some(v => v !== null && v !== undefined);
    if (!hayAlgo) {
        ultimaMigracion = { copiado: false, motivo: 'sin-datos' };
        return;
    }

    let resultado;
    try {
        resultado = await AlmacenamientoDatos.migrar(datos);
    } catch (error) {
        console.warn('[cuaderno] la migración falló:', error);
        ultimaMigracion = { copiado: false, motivo: 'error' };
        return;
    }

    ultimaMigracion = {
        copiado: resultado.copiado,
        motivo: resultado.motivo,
        grupos: Object.keys(datos).filter(n => datos[n] !== null && datos[n] !== undefined)
    };

    if (!resultado.copiado) {
        // Una vez por arranque, y por qué. La app sigue con el almacén viejo, que
        // está entero: no se perdió nada.
        console.warn('[cuaderno] no se pudieron copiar los datos al almacén nuevo:',
            resultado.motivo);
        mostrarAvisoMigracionFallida(resultado.motivo);
        return;
    }

    // A partir de acá el cuaderno vive en el almacén nuevo. `gruposEnMemoria` es lo
    // que hace que **nada** vuelva a leer del viejo.
    await cargarGruposEnMemoria();

    mostrarAvisoMigracionHecha(ultimaMigracion.grupos);
}

/**
 * Lee los cuatro grupos del almacén nuevo y los deja en memoria.
 *
 * **Los cuatro juntos y una sola vez.** Es lo que exige el criterio de RF-1 de que un
 * día con una sesión heredada muestre sus minutos una vez y no dos: si los grupos se
 * leyeran por separado, con ritmos distintos, uno podría quedar cargado antes de que
 * la copia terminara y el mismo registro se contaría dos veces.
 */
async function cargarGruposEnMemoria() {
    try {
        gruposEnMemoria = await AlmacenamientoDatos.leerGrupos();
    } catch (error) {
        // Si no se pueden leer los grupos del almacén nuevo, **no se cambia el origen**:
        // se sigue con el viejo, que está entero. Cambiar a un origen que no se pudo
        // leer dejaría el cuaderno vacío sin avisar.
        console.warn('[cuaderno] no se pudieron leer los grupos del almacén nuevo:', error);
        gruposEnMemoria = null;
        mostrarAvisoDatos([{
            tipo: 'lectura-invalida',
            mensaje: 'No se pudo leer el cuaderno del almacenamiento nuevo. Se sigue '
                + 'usando el anterior, que quedó guardado donde estaba.'
        }]);
    }
}

/**
 * El cartel de "se copiaron los datos".
 *
 * Va por el **cartel de arriba** y no por un `alert()`: es información, no un
 * problema, y un `alert()` en cada arranque por una migración que pasa una sola vez
 * enseña a cerrar la app sin leer.
 *
 * Los textos son de RNF-6 y tienen que decir **las dos cosas**: qué se copió y que lo
 * anterior quedó ahí. Lo segundo es la que importa: el usuario tiene que saber que
 * su cuaderno viejo no se reemplazó.
 *
 * @param {string[]} grupos qué grupos se copiaron
 */
function mostrarAvisoMigracionHecha(grupos) {
    const lista = grupos.length === 1 ? '1 grupo de datos' : grupos.length + ' grupos de datos';

    mostrarAvisoDatos([{
        tipo: 'migracion-hecha',
        mensaje: 'Se copiaron al almacenamiento nuevo ' + lista + ' del cuaderno ('
            + grupos.join(', ') + '). Lo anterior quedó guardado donde estaba, '
            + 'como respaldo: no se borró nada.'
    }]);
}

/**
 * El cartel de "no se pudieron copiar los datos".
 *
 * Dice **por qué**, y que nada se perdió: la app sigue con el almacén viejo, que
 * está entero. Un aviso de migración fallida sin decir eso empeora la situación,
 * porque el usuario no tiene forma de saber si su cuaderno está bien.
 *
 * @param {string|null} motivo 'copia' o 'marca'
 */
function mostrarAvisoMigracionFallida(motivo) {
    // Los dos motivos se distinguen porque son dos hechos distintos, y el usuario no
    // puede hacer nada con ninguno: no se le pide que arregle nada.
    const detalle = motivo === 'marca'
        ? 'Los datos se copiaron pero no se pudo dejar anotado que terminó, así que '
          + 'se volverá a intentar la próxima vez que abras la aplicación.'
        : 'No se pudo copiar todo al almacenamiento nuevo.';

    mostrarAvisoDatos([{
        tipo: 'migracion-fallida',
        mensaje: detalle + ' No se perdió nada: la aplicación sigue funcionando con '
            + 'los datos que ya tenías, que quedaron guardados donde estaban.'
    }]);
}

/**
 * Muestra, en la página, que la aplicación no abre y por qué.
 *
 * Va **en la página y no en un `alert()`**, y no es una excepción: si el cuaderno no
 * abre, el usuario tiene que poder leerlo y decidir, y un `alert()` que bloquea
 * impide justamente eso.
 *
 * El texto entra con `textContent`: es texto nuestro hoy, pero la regla del proyecto
 * es que al DOM nada entra por `innerHTML`, y el día que este texto venga de otro
 * lugar no debería hacer falta acordarse.
 */
function mostrarAlmacenamientoNoAbre() {
    const texto = AlmacenamientoDatos.textoAlmacenamientoNoAbre();

    const panel = document.createElement('div');
    panel.className = 'almacenamiento-no-abre';
    panel.textContent = texto;

    // El árbol y las migas quedan vacíos a propósito: la app **no abre** el cuaderno,
    // y dibujarlo y después vaciarlo sería enseñarle algo que no va a ver.
    while (arbolNav && arbolNav.firstChild) arbolNav.removeChild(arbolNav.firstChild);
    if (breadcrumbs) breadcrumbs.textContent = '';
    if (visor) {
        while (visor.firstChild) visor.removeChild(visor.firstChild);
        visor.appendChild(panel);
    }
}

// ===== Persistencia =====

// Aquí estaba `escriturasBloqueadas`, que se ponía en `true` cuando el
// almacenamiento no daba y en `false` cuando sí, y que **nadie leía nunca**.
//
// No hacía falta. `puedeEscribir()` se vuelve a decidir en cada llamada, así
// que si una escritura entra ahora, entra; y si el usuario exporta y libera
// espacio, entra en la siguiente. Una bandera que nadie consulta no bloquea
// nada: solo ocupa un nombre y hace creer que hay un estado que nadie
// controla. Se fue en T6.
// Una bandera sin lectores no es una bandera: es una intención que nadie terminó.
// Esta tiene un lector, y por eso se queda: mientras vale `false`, **ninguna escritura
// se acepta**. La secuencia de arranque todavía no sabe si el cuaderno existe.
let arranqueListo = false;

/**
 * Qué pasó con la migración en este arranque.
 *
 * Vive en la API pública para que un test pueda preguntarle. No es un estado que la
 * app consulte: **una bandera sin lectores es una intención que nadie terminó**, y
 * lo que la app necesita no es saber si migró, sino lo que ya se le avisó al usuario.
 */
let ultimaMigracion = { copiado: false, motivo: 'sin-correr' };

let avisoMostrado = false;

/**
 * Arma el texto del aviso para el camino en el que **no se sabe por qué falló**:
 * el navegador tiró al escribir y no hay forma de saber el motivo.
 *
 * ## Este texto no lleva porcentaje, y no por descuido
 *
 * Antes salía *"casi lleno (0 % de 95 %)"*. El 0 % era **real y correcto** —el uso
 * previo estaba bajo, y por eso se intentó—: lo que falló fue la escritura. Un número
 * que describe una situación distinta de la que se está avisando, puesto al lado de
 * "casi lleno", se vuelve un contrasentido. Un número que no explica nada es peor que
 * ningún número: hace dudar de si la app está mal.
 *
 * ## Y antes había un segundo texto, que ya no está (T10)
 *
 * `mensajeAlmacenamientoLleno()` decía *"El almacenamiento del navegador está casi
 * lleno"*, con su motivo y su umbral del 95 %. **Se borró**, y no se deshabilitó en un
 * caso: no queda.
 *
 * El motivo es concreto: ese muro era el de `localStorage`, **5 MB**. El almacén nuevo
 * separa cada dato, y lo que puede fallar ya no es "no entra" — es una cuota del
 * navegador, un disco lleno, una pestaña bloqueada, un permiso. **Ninguno de esos es
 * "casi lleno", y todos son cosas distintas entre sí.** El texto afirmaba una causa que
 * la app no conocía, y mandaba al usuario a hacer una exportación que, si el problema
 * no era el espacio, no arreglaba nada.
 *
 * ## El único texto que queda
 *
 * Queda uno, y dice **lo que sabe y nada más**: que no se pudo guardar, que lo que ya
 * estaba sigue ahí, que no se va a guardar nada nuevo hasta que se pueda, y que exportar
 * sigue siendo una salida. Lo que **no** dice es para qué: la app no lo sabe.
 */
function mensajeFalloAlGuardar() {
    // El texto que dice lo que sabe y nada más. RNF-6, 2026-10-05.
    //
    // Antes decía: *"Puede ser que el almacenamiento esté lleno. Exportá tus
    // documentos para liberar espacio."* Y eso era verdad cuando el cuaderno vivía en
    // `localStorage`, con un tope de 5 MB. **Hoy no hay tope**: el almacén nuevo separa
    // cada dato. Y si el motivo real no es la cuota —un disco lleno, una pestaña
    // bloqueada, un permiso— decir "puede ser el almacenamiento" **es inventar una
    // causa**, que es justo lo que la constitución prohíbe.
    //
    // Lo que sí se ofrece es **exportar**, porque sigue siendo la salida. Lo que **no**
    // se dice es **para qué**: la app no sabe por qué falló, y un motivo inventado manda
    // al usuario a buscar un problema que puede no tener.
    return 'No se pudo guardar.\n\n'
        + 'Lo que ya tenías quedó como estaba: no se perdió nada.\n\n'
        + 'Hasta que se pueda guardar otra vez, no se va a guardar nada nuevo.\n\n'
        + 'Podés exportar el cuaderno para tener una copia. Si vuelve a pasar, '
        + 'probá cerrar y volver a abrir la aplicación.';
}

/**
 * El aviso del fallo al guardar.
 *
 * ## Por qué `alert()` y no el cartel de arriba
 *
 * Decisión del usuario el 2026-10-05, y es la razón por la que existe `mostrarAvisoDatos()`
 * al lado: son dos cosas distintas y no se mezclan.
 *
 * Un fallo al guardar es **lo que el usuario acaba de hacer**. Entra en juego lo que él
 * hizo: puede exportar, puede volver a intentar, puede entender que el documento grande
 * no entró. Por eso tiene que interrumpir —con un cartel arriba, el scroll lo pasa por
 * alto, y un guardado que falló se sigue creyendo guardado—.
 *
 * El cartel de arriba es para lo contrario: un **dato raro que la app encontró al
 * arrancar**. Nadie lo pidió, así que un `alert()` saldría en cada arranque y el usuario
 * terminaría cerrando la app sin abrirla.
 *
 * Hay un test que obliga a que esto no se invierta:
 * `test/avisos-almacenamiento.test.js`, *"un fallo al guardar avisa con alert(), no con el
 * cartel de arriba"*.
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
 * ## Por qué es `async` y por qué hay que esperarla
 *
 * La escritura al almacén nuevo es **asíncrona**. Antes, `guardarDatos()` devolvía
 * `true` o `false` de forma síncrona, y el llamador podía decidir en el acto. Ahora no:
 * si un llamador no espera, la reversión cae sobre una pantalla **ya pintada** con el
 * cambio, y el usuario ve exactamente lo que RF-1 promete que no va a ver.
 *
 * Por eso los ocho llamadores hacen `await`. **Un cambio sin esperar no está guardado
 * hasta que termina**, y lo que se ve en el medio no está guardado en ninguna parte.
 *
 * @param {Array} nuevasMaterias
 * @returns {Promise<boolean>} true si se guardó
 */
async function guardarRevirtiendoSiFalla(nuevasMaterias) {
    const anteriores = materias;
    materias = nuevasMaterias;

    if (await guardarDatos()) return true;

    // Solo se deshace lo que hay en memoria. Lo que está en el almacén ya lo revirtió
    // `guardarDatos()` por su cuenta, o no llegó a escribirse.
    materias = anteriores;
    return false;
}

/**
 * Dónde vive cada grupo de datos, y cómo se lee.
 *
 * **Después de migrar, todo sale de acá y del almacén nuevo.** Del almacén viejo no se
 * lee nada: si se leyera, lo que el usuario guardara después de migrar se escribiría
 * donde nadie lo vuelve a buscar.
 *
 * Y hay un solo camino de lectura para los cuatro grupos, con **el mismo ritmo**:
 * todos en memoria, todos leídos una vez al arrancar. Es lo que impide que un grupo
 * quede cargado antes de que termine la copia y se cuente dos veces.
 *
 * ## Los dos orígenes
 *
 * `gruposEnMemoria` es `null` mientras la migración **no terminó**. En ese caso —y
 * solo en ese— se lee del almacén viejo, que está entero. Es lo que dice RF-2: si la
 * copia falla, la aplicación sigue con lo que el usuario ya tenía.
 */
let gruposEnMemoria = null;

/** De dónde se lee cada grupo cuando el cuaderno todavía está en el almacén viejo. */
const CLAVE_DEL_GRUPO = {
    materias: 'cuadernoVirtual',
    heredados: 'pomodoroSesiones',
    estudio: 'mapaCalorSecciones',
    anotaciones: 'calendarioAnotaciones'
};

function leerGrupo(nombre, porDefecto) {
    if (gruposEnMemoria) {
        const valor = gruposEnMemoria[nombre];
        return valor === undefined || valor === null ? porDefecto : valor;
    }
    return leerAlmacenViejo(CLAVE_DEL_GRUPO[nombre], porDefecto);
}

/**
 * Las escrituras en vuelo, por grupo.
 *
 * ## Por qué existe: el defecto que encontró el latido
 *
 * `gruposEnMemoria` se llenaba **una vez, al arrancar**, y no se volvía a tocar. O sea:
 * cada escritura armaba su lista con lo que había **en el arranque**, no con lo que se
 * acababa de guardar.
 *
 * El efecto era invisible y grave: **pausar dos veces en la misma corrida de la app
 * borraba la primera sesión.** La segunda escritura iba encima de la primera, las dos
 * devolvían `true`, no había error ni aviso, y el mapa de calor mostraba menos de lo
 * que el usuario estudió. Con una sola sesión por corrida no se notaba; con dos, una
 * se perdía.
 *
 * Lo arreglo `escribirGrupo()`, que hace dos cosas:
 *
 * 1. **Espera a la escritura anterior de ese grupo.** Si dos escrituras del mismo grupo
 *    salen al mismo tiempo —el latido dispara y el usuario pausa— la segunda tiene que
 *    ver lo que escribió la primera, no lo que había al arrancar.
 * 2. **Deja la memoria al día cuando sale bien**, que es lo que faltaba.
 *
 * ## Una promesa por grupo, y no una sola para todo
 *
 * Con una sola cadena, guardar las materias frenaría a los minutos de estudio. No hace
 * falta: cada grupo es una clave distinta y se estorban entre sí **exactamente en el
 * caso que importa**, que es dos escrituras del mismo grupo.
 *
 * ## Por qué la cadena no se corta al fallar
 *
 * Si una escritura fallara y la cadena quedara rechazada, **la siguiente escritura —y la
 * siguiente a esa— no arrancaría nunca**. Un fallo del almacén dejaría la app con los
 * minutos bloqueados para el resto de la sesión. Por eso se encadena con `catch`: lo que
 * se guarda en la cadena es una promesa que **siempre** se cumple, y el error se le
 * avisa a quien la llamó, que es el que puede hacer algo con él.
 *
 * @type {Object<string, Promise<void>>}
 */
const escrituraEnCurso = {};

/**
 * Escribe un grupo al almacén, en orden, y deja la memoria al día si sale bien.
 *
 * @param {string} nombre  'materias' | 'estudio' | 'anotaciones'
 * @param {*} valor
 * @returns {Promise<boolean>} si se pudo guardar
 */
function escribirGrupo(nombre, valor) {
    const anterior = escrituraEnCurso[nombre] || Promise.resolve();

    const esta = anterior.then(() => AlmacenamientoDatos.guardarGrupo(nombre, valor));

    // La cadena sigue viva pase lo que pase. Ver arriba.
    escrituraEnCurso[nombre] = esta.then(() => {}, () => {});

    return esta.then(() => {
        if (gruposEnMemoria) gruposEnMemoria[nombre] = valor;
        return true;
    });
}

/**
 * Lee una clave del almacén viejo **sin tirar nunca**.
 *
 * Hay cuatro lecturas que antes usaban `JSON.parse` a pelo, y una de ellas estaba en
 * **código de nivel superior**: un valor que no fuera un texto válido dejaba la
 * página sin abrir, sin cartel y sin aviso. Un dato roto no puede tirar.
 *
 * Lo que hace: devuelve el valor, o el valor por defecto si no se pudo interpretar,
 * y **avisa**. Lo que nunca hace: borrar. Un dato raro se completa y se dice; descartar
 * sería perder trabajo del usuario sin que nadie lo note.
 *
 * @param {string} clave
 * @param {*} porDefecto
 * @returns {*}
 */
function leerAlmacenViejo(clave, porDefecto) {
    let bruto;
    try {
        bruto = localStorage.getItem(clave);
    } catch (error) {
        // Ni siquiera se pudo leer. Puede pasar en algunos navegadores en modo privado.
        bruto = undefined;
    }

    if (bruto === null || bruto === undefined) return porDefecto;

    try {
        return JSON.parse(bruto);
    } catch (error) {
        mostrarAvisoDatos([{
            tipo: 'lectura-invalida',
            mensaje: 'No se pudo leer "' + clave + '". Se siguió funcionando y '
                + 'no se borró nada, pero lo que había ahí no se está usando.'
        }]);
        return porDefecto;
    }
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
    // Un solo camino de lectura, como los otros tres grupos. No se lee
    // `localStorage` directo en ningún lado: `leerGrupo()` decide de dónde, y si el
    // valor guardado no se puede interpretar, avisa sin romper el arranque.
    const leidos = leerGrupo('materias', null);

    if (!leidos) {
        materias = [];
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
async function guardarDatos() {
    // El candado de la secuencia de arranque. Antes de que termine, el sistema no
    // sabe todavía en qué cuaderno está, y escribir ahora sería escribir en el
    // lugar equivocado sin saberlo.
    //
    // Es un `alert()` y no el cartel de arriba porque es un aviso de **escritura**,
    // y los avisos de escritura son `alert()` desde la decisión del 2026-10-05.
    if (!arranqueListo) {
        alert('El cuaderno todavía se está cargando. Esperá un momento y volvé a '
            + 'intentar; no se guardó nada.');
        return false;
    }

    // Se separa el índice de los archivos, como en la migración. Acá importa por una
    // razón más: si el índice se guardara **con** el contenido, volvería a estar todo
    // junto y cargar el índice al arrancar cargaría el cuaderno entero.
    //
    // Y por `escribirGrupo()`, **no** por `guardarGrupo()` directo: pasar por alto la
    // escritura en orden y la actualización de memoria fue un error de T8 que T9 destapó.
    // Con la memoria desactualizada, un respaldo armado en la misma sesión salía sin las
    // anotaciones que el usuario acababa de guardar.
    const { indice, contenidos } = AlmacenamientoDatos.separarIndice(materias);
    const ids = Object.keys(contenidos);

    try {
        await AlmacenamientoDatos.conPlazo(
            (async () => {
                await escribirGrupo('materias', indice);
                for (const id of ids) {
                    await AlmacenamientoDatos.guardarContenido(id, contenidos[id]);
                }
            })(),
            PLAZO_ESCRITURA
        );
        return true;
    } catch (error) {
        // Un solo aviso para todos los fallos de escritura, y dice lo que se sabe.
        //
        // Ya **no** hay medición de espacio: el muro de 5 MB era del almacenamiento por
        // clave, y este almacén no lo tiene. Un aviso que anuncia un muro que no está
        // es peor que no avisar (RNF-6).
        if (error && error.vencido) {
            console.warn('[cuaderno] la escritura no terminó dentro del plazo');
            alert('El almacenamiento no respondió a tiempo y no se guardó nada. '
                + 'Lo que ya tenías quedó como estaba.');
            return false;
        }

        console.warn('[cuaderno] no se pudo guardar:', error);
        avisarFalloAlGuardar();
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

                // El manejador de drag and drop **no puede ser `async`**: el navegador
                // no espera una promesa. Por eso la escritura se dispara sin esperarla y el
                // redibujado va en el `.then`, que es donde ya sabemos si se guardó.
                //
                // Un `construirArbol()` acá sin esperar redibujaría el orden nuevo con
                // un guardado que todavía puede fallar.
                guardarRevirtiendoSiFalla(nuevas).then(guardado => {
                    if (!guardado) return;
                    construirArbol();
                });
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

// `async` porque adentro se espera el guardado. El manejador del botón no devuelve
// nada a nadie, así que `async` acá no cambia nada para el navegador: solo permite el
// `await` de abajo.
btnCrearMateria.addEventListener('click', async () => {
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
    //
    // El `await` es lo que hace que esa frase sea cierta: la escritura es una promesa,
    // y sin esperar, el menú se redibuja antes de saber si se guardó.
    if (!await guardarRevirtiendoSiFalla([...materias, materia])) return;

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
    // **Solo `.docx`.** El `.doc` de Word 97-2003 **no** se acepta, y antes sí: se subía,
    // se guardaba, aparecía en el menú con su nombre, y al abrirlo salía *"Error al
    // convertir"*. Porque `mammoth` solo entiende `.docx`, que es el formato moderno.
    //
    // Aceptar un formato que después no se puede abrir es lo peor de las dos opciones: el
    // usuario sube el archivo, ve que entró, y descubre la diferencia recién cuando lo
    // quiere usar.
    else if (extension === 'docx') tipo = 'word';

    // Un archivo que no se sabe abrir no se guarda. Acá no se "completa con lo que falta":
    // esto es el usuario eligiendo un archivo ahora, no un respaldo viejo con datos raros.
    // La diferencia importa: un dato raro **se conserva y se avisa**, y un archivo que no se
    // puede abrir **no entra**.
    if (tipo === 'desconocido') return null;

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
 * ## Lo que se rechaza, y lo que se avisa
 *
 * Un archivo de un formato que la aplicación no sabe abrir **no entra**, y se dice cuál
 * fue y **qué hacer**. Sin ese mensaje el usuario ve que el archivo no aparece y no sabe si
 * la aplicación está rota, si lochosen mal, o si tiene que guardarlo de otra manera.
 *
 * Y los que sí entran se agregan igual: se guarda lo que se pudo y se avisa lo que no, no
 * al revés. Si el usuario sube un `.docx` y un `.txt`, **el `.docx` queda guardado** y el
 * aviso nombra solo al `.txt`.
 *
 * @returns {Promise<boolean>} si se pudieron guardar
 */
async function agregarArchivosAMateria(materiaId, files) {
    const nuevos = [];
    const rechazados = [];

    for (const file of files) {
        const doc = await crearDocumento(file);
        if (doc) nuevos.push(doc);
        else rechazados.push(file.name);
    }

    if (nuevos.length > 0) {
        const materiasNuevas = materias.map(m => (m.id === materiaId
            ? { ...m, documentos: [...m.documentos, ...nuevos] }
            : m));

        // Si no entra, `guardarRevirtiendoSiFalla` deja las materias como estaban:
        // el archivo no aparece en el menú y no se pierde nada. El `await` es lo que
        // hace que eso sea cierto: sin él, `construirArbol()` redibujaría el archivo
        // con un guardado que todavía puede fallar.
        if (!await guardarRevirtiendoSiFalla(materiasNuevas)) return false;

        construirArbol();
        actualizarStats();
    }

    if (rechazados.length > 0) avisarArchivosNoAceptados(rechazados);

    return true;
}

/**
 * Aviso de los archivos que no se pudieron agregar.
 *
 * El texto dice **qué formatos se pueden** y **qué hay que hacer** con el que no sirve.
 * Un aviso que solo dice "no se pudo" deja al usuario sin salida, y uno que no dice qué
 * formatos son válidos lo deja adivinando.
 */
function avisarArchivosNoAceptados(nombres) {
    const lista = nombres.length === 1
        ? `"${nombres[0]}"`
        : nombres.map(n => `"${n}"`).join(', ');

    alert('No se agregó ' + lista + '.\n\n'
        + 'Solo se pueden agregar archivos HTML, PDF y Word.\n\n'
        + 'Si es un Word, tiene que ser **.docx**. Los archivos .doc son de una versión '
        + 'mucho más vieja de Word y no se pueden abrir acá: abrilo y volvé a guardarlo '
        + 'como .docx.');
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

    // ## Por qué acá NO se pregunta por `documentoSinContenido(doc)`
//
// **Este era el bug de los PDF**, y no daba ningún error: la app andaba, la consola
// limpia, los tests verdes. El usuario veía *"A este archivo le falta el contenido"* en
// cada PDF y en cada Word, y el texto lo explicaba tan bien que podía creérselo.
//
// La comprobación estaba antes de ir a buscar el archivo, y `documentoSinContenido()`
// responde *"¿este objeto trae el contenido adentro?"*. Desde que el índice y los archivos
// están en almacenes distintos, **un documento del índice nunca trae el contenido**:
// el índice tiene nombre, tipo y fecha. Así que la función contestaba que faltaba, y la
// lectura de abajo **no llegaba a ejecutarse nunca**.
//
// ## La regla
//
// La pregunta útil es **"¿el archivo está guardado?"**, y eso solo se responde preguntando
// al almacén. Se pregunta **una vez, después de leer**, y con la respuesta se decide.
//
// Y con eso el aviso sigue siendo exacto: si el archivo no está, dice que no está; si
// está, lo abre. Lo que no se hace es **inventar la ausencia a partir de un objeto que
// jamás la tuvo guardado**.

// El archivo **se pide ahora**, y no está en el índice. El índice es lo chico
// —nombres, tipos, fechas—; los archivos van aparte para que arrancar no cargue
// el cuaderno entero.
let contenido;
try {
    contenido = await AlmacenamientoDatos.leerContenido(doc.id);
} catch (error) {
    console.warn('[cuaderno] no se pudo leer el contenido de "' + doc.nombre + '"', error);
}

// Y con eso el aviso sigue siendo exacto: si el archivo no está, dice que no está; si
// está, lo abre. Lo que no se hace es **inventar la ausencia a partir de un objeto que
// jamás la tuvo guardado**.
//
// **El HTML vacío se abre.** Sale un iframe en blanco, y eso es honesto: el archivo está
// ahí, solo que está vacío. Es la misma excepción de `documentoSinContenido()`, pero
// preguntada sobre el contenido **leído**, que es donde la respuesta vale.
if ((contenido === undefined || contenido === null || contenido === '')
        && doc.tipo !== 'html') {
    mostrarDocumentoSinContenido(doc);
    return;
}

    // Para PDF y Word, lo que hace falta son **bytes**, y lo que hay guardado es un texto
    // —`data:application/pdf;base64,…`— porque así lo deja `readAsDataURL`. Se convierte
    // **una vez, acá**, y los dos caminos usan lo mismo.
    if (doc.tipo === 'pdf' || doc.tipo === 'word') {
        const bytes = bytesDeDocumento(contenido);

        if (!bytes) {
            // No se puede ni intentar: sin los bytes, la librería recibiría algo sin
            // forma de saber qué es, y el error que vería el usuario no diría que el
            // problema es el contenido.
            console.warn('[cuaderno] el contenido de "' + doc.nombre + '" no es base64');
            mostrarDocumentoSinContenido(doc);
            return;
        }

        if (doc.tipo === 'pdf') {
            abrirPDF(bytes);
            return;
        }

        try {
            const result = await window.mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
            mostrarHtml(visor, { nombre: doc.nombre, contenido: result.value });
        } catch (error) {
            visor.innerHTML = `
                <div class="bienvenida">
                    <div class="bienvenida-icono">⚠️</div>
                    <h2>Error al convertir</h2>
                    <p>No se pudo convertir el archivo Word. Intentá con otro archivo.</p>
                </div>
            `;
        }
        return;
    }

    // HTML: el contenido ya es texto, no hay nada que convertir.
    if (doc.tipo === 'html') {
        mostrarHtml(visor, { nombre: doc.nombre, contenido });
    }
}

/**
 * Los **bytes** del archivo, a partir de lo que está guardado.
 *
 * ## Por qué hace falta
 *
 * Porque lo que se guarda **no es el archivo**: es el texto que devuelve
 * `readAsDataURL`, que es el archivo codificado en base64 adentro de una URL de datos.
 *
 * Y las dos librerías que abren estos archivos quieren **bytes**, no texto. Pasarle el
 * texto a pdf.js hace que tome los caracteres de `"data:application/pdf;base64,JVBER…"`
 * como si fueran el archivo, y no abre.
 *
 * El Word pasaba por `fetch()`, que sí descodifica —y por eso funcionaba, **por
 * accidente**—. Pero `fetch` de una URL de datos es una petición de red, y no hace falta
 * ninguna para abrir un archivo que ya está en tu computadora. Sin internet, un `.docx`
 * guardado no abría.
 *
 * ## Las dos formas que acepta
 *
 * La URL de datos (lo que guarda esta versión) y el **base64 pelado**. Los respaldos
 * viejos pueden traerlo sin el prefijo, y un archivo que se podía abrir no puede dejar de
 * abrirse por un detalle de cómo se codificó.
 *
 * ## Lo que devuelve si no puede
 *
 * `null`, y no una lista vacía. Una lista vacía deja a pdf.js fallar con un error que no
 * menciona el problema real: el usuario ve que "no se pudo convertir" sin ninguna pista.
 *
 * @param {string} contenido
 * @returns {Uint8Array|null}
 */
function bytesDeDocumento(contenido) {
    if (typeof contenido !== 'string' || contenido === '') return null;

    const coma = contenido.indexOf(',');
    const base64 = (contenido.startsWith('data:') && coma !== -1)
        ? contenido.slice(coma + 1)
        : contenido;

    if (!base64) return null;

    try {
        // `atob` en el navegador, `Buffer` en Node. Los dos hacen lo mismo; lo que
        // cambia es cuál de los dos está. Con solo uno de los dos, esta función no se
        // podría probar con `node --test` —que es justo lo que pasó: el arnés no tiene
        // `atob`, y el test no podía confirmar que los bytes salían bien.
        const binario = (typeof atob === 'function')
            ? atob(base64)
            : Buffer.from(base64, 'base64').toString('binary');

        const bytes = new Uint8Array(binario.length);
        for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
        return bytes;
    } catch (error) {
        return null;
    }
}

/**
 * Dibuja el PDF en el visor, con los **bytes** ya convertidos.
 *
 * Antes esta función recibía el texto guardado y se lo pasaba a pdf.js tal cual. El
 * `catch` de abajo no lo veía, porque el error ocurre adentro de pdf.js: el `data:` de
 * `getDocument` tiene que ser un `Uint8Array`.
 *
 * @param {Uint8Array} bytes
 */
async function abrirPDF(bytes) {
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

    await cargarPDF(bytes);
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
    //
    // La función es `async` y hay que esperarla **antes** de tocar la pantalla: si se
    // deseleccionara la materia y se redibujara antes de saber, el usuario vería una
    // materia desaparecer que en realidad no se borró.
    return eliminarMateriaYDeseleccionar(id, restantes);
}

/**
 * Lo de `eliminarMateria()`, aparte para que se pueda esperar.
 *
 * No es una función "de verdad": existe para que el `await` del llamador quede en un
 * solo lugar y sea obvio que todo lo de la pantalla pasa **después** del guardado.
 */
async function eliminarMateriaYDeseleccionar(id, restantes) {
    const seGuardo = await guardarRevirtiendoSiFalla(restantes);
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
async function eliminarDocumento(materiaId, docId) {
    if (!confirm('¿Eliminar este documento?')) return;

    const materia = materias.find(m => m.id === materiaId);
    if (!materia) return;

    // Se arma el arreglo nuevo en vez de mutar el que existe: si no se puede
    // guardar, `guardarRevirtiendoSiFalla` devuelve la lista anterior y no
    // quedó a medias.
    const nuevas = materias.map(m => (m.id === materiaId
        ? { ...m, documentos: m.documentos.filter(d => d.id !== docId) }
        : m));

    // `async` y con `await`: el redibujado va después de saber si se guardó.
    if (!await guardarRevirtiendoSiFalla(nuevas)) return;

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

/**
 * Carga el PDF en el visor.
 *
 * ## `bytes`, no un texto
 *
 * El `data:` de `getDocument` tiene que ser un `Uint8Array`. Antes se le pasaba el texto
 * guardado —`"data:application/pdf;base64,JVBER…"`— y pdf.js leía los caracteres de esa
 * cadena como si fueran el archivo. No abría, y **el `catch` de abajo no lo veía**, porque
 * el error ocurre adentro de pdf.js, no en esta función.
 *
 * @param {Uint8Array} bytes
 */
async function cargarPDF(bytes) {
    try {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
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
async function renombrarDocumento(materia, doc) {
    const nuevoNombre = prompt('Nuevo nombre:', doc.nombre);
    if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre.trim() === doc.nombre) return;

    const limpio = nuevoNombre.trim();

    // Se arma el arreglo nuevo: si no entra, el nombre viejo sigue ahí y en
    // pantalla (RF-11).
    const nuevas = materias.map(m => (m.id !== materia.id ? m : {
        ...m,
        documentos: m.documentos.map(d => (d.id === doc.id ? { ...d, nombre: limpio } : d))
    }));

    // `async` y con `await`: si no entra, el nombre viejo sigue en pantalla. Ver
    // `eliminarDocumento`.
    if (!await guardarRevirtiendoSiFalla(nuevas)) return;

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

/**
 * Los cuatro grupos del cuaderno, como los lee la app.
 *
 * Van por `leerGrupo()`, no del objeto en memoria, porque el **índice y los archivos
 * están en almacenes distintos** desde T5: en memoria el contenido de un documento solo
 * existe si el usuario lo abrió alguna vez.
 */
function losCuatroGrupos() {
    return {
        materias: leerGrupo('materias', []),
        heredados: leerGrupo('heredados', []),
        estudio: leerGrupo('estudio', []),
        anotaciones: leerGrupo('anotaciones', {})
    };
}

/**
 * El contenido de cada documento del índice, leído del almacén donde vive de verdad.
 *
 * Es el paso que faltaba y el que hacía que un respaldo **no respaldara nada**: la lista
 * de archivos se exportaba con todos los contenidos en `null`.
 *
 * @returns {Promise<object>} mapa `idDocumento` → contenido
 */
async function contenidosDeTodosLosDocumentos(indice) {
    const contenidos = {};

    for (const materia of (indice || [])) {
        if (!materia || !Array.isArray(materia.documentos)) continue;

        for (const doc of materia.documentos) {
            if (!doc || doc.id === undefined || doc.id === null) continue;

            try {
                contenidos[doc.id] = await AlmacenamientoDatos.leerContenido(doc.id);
            } catch (error) {
                // Un contenido que no se pudo leer **no se inventa**: no entra en el mapa,
                // y `armarRespaldo()` va a avisar que falta ese documento.
                console.warn('[cuaderno] no se pudo leer el contenido de "' + doc.nombre
                    + '" para el respaldo:', error);
            }
        }
    }

    return contenidos;
}

/**
 * Arma el respaldo: lee los cuatro grupos y el contenido de cada documento.
 *
 * ## Por qué está aparte del manejador del botón
 *
 * Porque el manejador no se puede probar —el DOM del arnés no dispara clics— y porque
 * **la decisión de qué entra al archivo es contenido, no pantalla**. Acá queda todo lo que
 * se puede comprobar con `node --test`; en el manejador queda solo la descarga, que es un
 * mecanismo del navegador.
 *
 * ## Lo que devuelve
 *
 * Un objeto con `ok`. Nunca tira: un fallo de lectura es un resultado, no una excepción,
 * porque el que tiene que avisar es el usuario y el aviso está en el manejador.
 *
 * @returns {Promise<{ok: boolean, datos?: object, motivo?: string, documento?: string}>}
 */
async function prepararRespaldo() {
    if (!arranqueListo) {
        return { ok: false, motivo: 'cargando' };
    }

    const grupos = losCuatroGrupos();

    try {
        grupos.contenidos = await contenidosDeTodosLosDocumentos(grupos.materias);
    } catch (error) {
        console.warn('[cuaderno] no se pudieron leer los contenidos:', error);
        return { ok: false, motivo: 'lectura' };
    }

    const datos = DatosLogica.armarRespaldo(grupos);

    // Un texto acá, no un `null`: es el nombre del documento que no se pudo leer.
    if (typeof datos === 'string') {
        return { ok: false, motivo: 'incompleto', documento: datos };
    }

    return { ok: true, datos };
}

/**
 * Descarga el respaldo.
 *
 * Lo que entra en el archivo lo decide `prepararRespaldo()`. Acá queda solo la descarga, y
 * **el nombre del archivo y la forma de bajarlo no cambian**: son parte de lo que el
 * usuario ya conoce.
 */
btnExportar.addEventListener('click', async () => {
    menuDesplegable.classList.remove('visible');

    const r = await prepararRespaldo();

    if (!r.ok) {
        if (r.motivo === 'cargando') {
            alert('El cuaderno todavía se está cargando. Esperá un momento y volvé a '
                + 'intentar; no se armó ningún archivo.');
            return;
        }
        if (r.motivo === 'lectura') {
            alert('No se pudo armar el respaldo porque no se pudieron leer los archivos.\n\n'
                + 'Lo que ya tenías quedó como estaba: no se perdió nada.');
            return;
        }

        alert('No se armó el respaldo: no se pudo leer el contenido de "'
            + r.documento + '".\n\n'
            + 'Un respaldo al que le falta un archivo es peor que ningún respaldo: se '
            + 'descubriría cuando ya lo necesitaras.\n\n'
            + 'Lo que ya tenías quedó como estaba: no se perdió nada.');
        return;
    }

    const blob = new Blob([JSON.stringify(r.datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuaderno-virtual-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

btnImportar.addEventListener('click', () => {
    inputImportar.click();
    menuDesplegable.classList.remove('visible');
});

/**
 * Cómo se llama cada grupo en el texto del `confirm()`.
 *
 * Va acá y no dentro de la función porque es contenido: es lo que el usuario lee, y que
 * esté en un solo lugar evita que la confirmación y el aviso final digan cosas distintas
 * sobre lo mismo.
 */
const NOMBRE_DEL_GRUPO = {
    materias: 'las materias y sus documentos',
    heredados: 'el historial de minutos antiguos',
    estudio: 'el historial de estudio del mapa de calor',
    anotaciones: 'las anotaciones del calendario'
};

/**
 * Importa un respaldo ya interpretado.
 *
 * ## Por qué está aparte del manejador del `FileReader`
 *
 * El `FileReader` no se puede probar con el arnés: dispara un evento y sigue. Todo lo que
 * **decide** —qué se reemplaza, qué se deja, si se deshace— sí, y es lo que importa.
 *
 * ## La garantía
 *
 * Si no se puede guardar, **se devuelve lo que había**. Importar pisa a medias es peor que
 * un fallo visible: el usuario ve un respaldo importado y al recargar vuelve lo anterior.
 *
 * @param {object} datos el archivo ya interpretado
 * @returns {Promise<boolean>} si se importó
 */
async function importarRespaldo(datos) {
    // Qué trae el archivo, qué falta y qué se va a reemplazar. Todo esto se decide
    // **antes** de tocar nada: un respaldo se lee entero, o no se lee.
    const leido = DatosLogica.leerRespaldo(datos);

    if (!leido.importable) {
        alert('Error al importar: el archivo no tiene la lista de materias.');
        return false;
    }

    // El `confirm()` nombra **los cuatro grupos** y deja claro que reemplaza, no
    // agrega. Antes decía "Esto sobrescribirá tus datos actuales", que es cierto y no
    // sirve: el usuario no sabe qué se está por perder.
    //
    // Y cuando el archivo **no trae** un grupo, ese grupo no se nombra como algo que se va
    // a perder, porque no se va a perder: se deja como está.
    const aPerder = Object.keys(leido.reemplazar)
        .filter(grupo => leido.reemplazar[grupo])
        .map(grupo => NOMBRE_DEL_GRUPO[grupo]);

    if (!confirm(
        'Se va a reemplazar:\n\n'
        + aPerder.map(nombre => '· ' + nombre).join('\n')
        + '\n\nLo que no trae el archivo se deja como está. ¿Continuar?'
    )) return false;

    const { materias: limpias, problemas } = leido;

    // Importar pisa lo que el archivo trae. Si no se puede guardar, el usuario tiene que
    // seguir con sus datos, no con los del respaldo a medias.
    //
    // **Los grupos se escriben con `escribirGrupo()` y en orden**, uno después del otro:
    // cada escritura es asíncrona, y si dos correran a la vez la segunda se pisaría con la
    // primera. Con cuatro grupos hay tres pares, y el último en terminar es el que manda.
    const anteriores = {
        materias,
        heredados: leerGrupo('heredados', []),
        estudio: leerGrupo('estudio', []),
        anotaciones: calendario.anotaciones
    };

    const porEscribir = [];
    if (leido.reemplazar.materias) porEscribir.push(['materias', limpias]);
    if (leido.reemplazar.heredados) porEscribir.push(['heredados', leido.heredados]);
    if (leido.reemplazar.estudio) porEscribir.push(['estudio', leido.estudio]);
    if (leido.reemplazar.anotaciones) porEscribir.push(['anotaciones', leido.anotaciones]);

    let guardado = false;
    try {
        for (const [grupo, valor] of porEscribir) {
            await escribirGrupo(grupo, valor);
        }
        guardado = true;
    } catch (error) {
        console.warn('[cuaderno] no se pudo guardar lo importado:', error);
    }

    if (!guardado) {
        // **Se devuelve lo que había.** Sin esto, la app queda mostrando el respaldo
        // importado y al recargar vuelve lo anterior: el usuario ve una cosa y tiene otra,
        // que es peor que un fallo visible.
        try {
            await escribirGrupo('materias', anteriores.materias);
            await escribirGrupo('heredados', anteriores.heredados);
            await escribirGrupo('estudio', anteriores.estudio);
            await escribirGrupo('anotaciones', anteriores.anotaciones);
        } catch (error) {
            console.warn('[cuaderno] tampoco se pudo restaurar lo anterior:', error);
        }

        alert('No se pudo guardar lo importado.\n\n'
            + 'Tus datos siguen como estaban: no se perdió nada.');
        return false;
    }

    // **Y marcar la migración.** A partir de acá el cuaderno vive en el almacén nuevo, y
    // la marca es lo que dice que de ahí se lee. Sin esto, en un perfil que no tenía nada
    // que migrar —donde la migración nunca marcó— el respaldo se guardaba entero y al
    // recargar la aplicación leería un cuaderno vacío.
    //
    // Va **después** de escribir, nunca antes: si se marcara antes y la escritura fallara,
    // la app leería de un almacén que nunca recibió los datos.
    //
    // Que falle no se avisa al usuario: los datos **están** guardados, y la importación
    // salió bien. Solo dejaría de verse en la próxima apertura, y eso se avisa al abrir.
    await AlmacenamientoDatos.marcarMigrada();

    // Solo recién ahora que quedaron guardados se actualiza la memoria.
    materias = limpias;
    calendario.anotaciones = leido.reemplazar.anotaciones
        ? leido.anotaciones
        : anteriores.anotaciones;

    if (leido.reemplazar.heredados) {
        seccionesEstado.seccionesAntiguas = leido.heredados;
    }
    if (leido.reemplazar.estudio) {
        seccionesEstado.secciones = [];
    }

    construirArbol();
    actualizarStats();

    if (problemas.length > 0) {
        mostrarAvisoDatos(problemas);
    }

    // El texto final. Si el archivo no trae historial ni calendario, dice **que no los
    // trae**: no dice que estaban vacíos, porque eso no se sabe. Y el archivo puede no
    // traerlos aunque el usuario tenga años de historial, que es justo lo que no puede
    // perderse.
    const avisos = [];

    if (leido.faltantes.includes('estudio') || leido.faltantes.includes('anotaciones')) {
        const queFalta = [];
        if (leido.faltantes.includes('estudio')) queFalta.push(NOMBRE_DEL_GRUPO.estudio);
        if (leido.faltantes.includes('anotaciones')) queFalta.push(NOMBRE_DEL_GRUPO.anotaciones);

        avisos.push(
            'El archivo no trae ' + queFalta.join(' ni ') + '.\n\n'
            + 'Eso no significa que estuvieran vacíos: significa que el archivo no los '
            + 'tiene. Los que ya tenías quedaron como estaban.'
        );
    }

    if (problemas.length > 0) {
        avisos.push(
            `Se encontraron ${problemas.length} `
            + `${problemas.length === 1 ? 'problema' : 'problemas'} en el archivo. `
            + 'Mirá el aviso de arriba.'
        );
    }

    alert(avisos.length === 0
        ? 'Datos importados correctamente'
        : 'Datos importados.\n\n' + avisos.join('\n\n'));

    return true;
}

inputImportar.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    // `async`: el manejador de `readAsText` **no puede esperarse** —el `FileReader`
    // dispara el evento y sigue-, así que el `await` va adentro del manejador.
    reader.onload = async (e) => {
        let datos;
        try {
            datos = JSON.parse(e.target.result);
        } catch (error) {
            alert('Error al importar: el archivo no es un JSON válido.');
            return;
        }

        await importarRespaldo(datos);
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

            // El latido. Va en el intervalo de un segundo que **ya existía**, así que
            // no se crea ningún temporizador nuevo: el propio decide si toca escribir,
            // comparando con `PLAZO_LATIDO`. Un intervalo aparte sería un temporizador
            // más que mantener, apagar y no olvidar.
            latidoDeEstudio();

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
        // Sin `await` a propósito: el botón tiene que verse pausado al instante, y la
        // escritura no puede bloquearlo. Los minutos quedan en memoria hasta que
        // termine, y no se pierden si falla.
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

// Se leen los registros del formato viejo (25 minutos fijos) desde la secuencia de
// arranque, no desde acá.
//
// Antes esta línea estaba en el nivel de arriba del archivo, y por eso **una sola
// lectura mal formada tumbaba la página entera**: sin cartel, sin aviso, sin
// cuaderno. Movida adentro de `iniciar()`, un dato roto avisa y la app abre.
//
// Se conservan tal cual: RF-10 dice no descartar nada, y la migración los copia sin
// transformarlos.
function cargarMinutosHeredados() {
    seccionesEstado.seccionesAntiguas = restaurarSeccionesAntiguas(
        leerGrupo('heredados', [])
    ).seccionesAntiguas;
}

/**
 * Abre una sección de estudio. Se llama al iniciar el Pomodoro.
 */
function abrirSeccionEstudio() {
    abrirSeccion(seccionesEstado, Date.now());
    // Un latido arranca **contado desde la apertura**, no desde el último latido que
    // se haya escrito en una sesión anterior: si no, abrir y cerrar la app sin estudiar
    // escribiría un latido de una sección recién abierta, con cero minutos medidos.
    ultimoLatido = Date.now();
}

// Cuándo se midió el último latido. Vive acá y no en `seccionesEstado` a propósito:
// `js/datos/secciones.js` es estado de **estudio** —qué sección está abierta, cuánto
// duró— y un reloj de escritura es otra cosa. Meterlo ahí sería meter en el modelo
// algo que solo le importa a quien guarda.
let ultimoLatido = 0;

/** Cada cuánto se escribe la sección en curso. Elegido el 2026-10-05, usuario a favor. */
const PLAZO_LATIDO = 30 * 1000;

/**
 * El latido: escribir la sección en curso mientras sigue abierta.
 *
 * ## Por qué existe
 *
 * El almacén es asíncrono, y en `beforeunload` **no hay a quién esperar**: la pestaña
 * se está yendo. Con el almacén viejo —un `setItem` sin cronía— cerrar la pestaña no
 * perdía nada. Al pasar a IndexedDB, sí: se perdía **toda la sesión**, no medio minuto.
 *
 * Esto acota la pérdida a **lo que pasó desde el último latido**.
 *
 * ## Por qué no avisa
 *
 * Un `alert()` acá sería insoportable: el latido corre cada 30 segundos, y el usuario
 * no podría usar la app. El aviso que corresponde lo da `cerrarSeccionEstudio()`,
 * cuando pausa de verdad: ahí hubo una acción suya y un aviso tiene sentido.
 *
 * @returns {Promise<boolean>} si llegó a escribir, para que un test lo pregunte
 */
async function latidoDeEstudio() {
    if (!estaAbierta(seccionesEstado)) return false;

    const ahora = Date.now();
    if (ahora - ultimoLatido < PLAZO_LATIDO) return false;

    ultimoLatido = ahora;

    try {
        await AlmacenamientoDatos.conPlazo(
            escribirGrupo('estudio', DatosSecciones.seccionesParaGuardar(
                seccionesEstado,
                leerGrupo('estudio', []),
                ahora
            )),
            PLAZO_ESCRITURA
        );
        return true;
    } catch (error) {
        // **Sin `alert()` a propósito.** Ver arriba. Y sin marcar nada como guardado:
        // la sección sigue abierta y en memoria, y el siguiente latido reintenta.
        console.warn('[cuaderno] no se pudo escribir el latido de estudio:', error);
        return false;
    }
}

/**
 * Cierra la sección de estudio y guarda los minutos.
 * Se llama al pausar, reiniciar o completar.
 *
 * ## Dos cosas que no son detalles
 *
 * **La lista la arma `seccionesParaGuardar()`, no un `push`.** Con el latido, esta
 * sección **ya puede estar guardada** —hasta hace 30 segundos—. Si acá se agregara una
 * copia, el mismo rato de estudio quedaría dos veces y los minutos **se multiplicarían**
 * sin que nada pareciera roto. La regla es: una sección se identifica por su
 * `inicioMs`, y guardarla de nuevo **la reemplaza**.
 *
 * **Vuelve una promesa.** Y hay un llamador que **no puede esperarla**: el de cerrar la
 * pestaña. Por eso existe el latido: no para no escribir, sino para que lo que se
 * pierde al cerrar sea medio minuto y no toda la sesión.
 *
 * @returns {Promise<boolean>}
 */
async function cerrarSeccionEstudio() {
    cerrarSeccion(seccionesEstado, Date.now());

    if (seccionesEstado.secciones.length === 0) return true;

    try {
        await escribirGrupo('estudio', DatosSecciones.seccionesParaGuardar(
            seccionesEstado,
            leerGrupo('estudio', []),
            Date.now()
        ));

        // Solo recién ahora que quedaron guardadas se limpia la memoria. Si la
        // escritura falló, los minutos **siguen en memoria**: el usuario no los
        // pierde, y se vuelven a intentar al cerrar la próxima sección.
        seccionesEstado.secciones = [];
        return true;
    } catch (error) {
        console.warn('[cuaderno] no se pudieron guardar los minutos de estudio:', error);
        alert('No se pudieron guardar los minutos de estudio.\n\n'
            + 'Siguen en memoria: no se perdieron, pero pueden no aparecer en el mapa '
            + 'hasta que se guarden.');
        return false;
    }
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
    // **Sin cronía, y tiene que seguir siéndolo**: la consume
    // `js/inicio-calendario.js`, que no espera promesas. Volverla asíncrona ya dejó
    // el mapa de calor en blanco una vez, con 96 tests en verde.
    const seccionesGuardadas = leerGrupo('estudio', []);

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
//
// ## Lo que este escuchador ya NO resuelve, y por qué
//
// Con el almacenamiento por clave, `setItem` era **sin cronía**: cuando la función
// terminaba, los minutos ya estaban en el disco. Cerrar la pestaña no perdía nada. Al
// pasar a IndexedDB, la escritura pasó a ser una **promesa**, y en `beforeunload` **no
// hay a quién esperarle**: la pestaña se está yendo. Llegado a este punto se perdía
// **toda la sesión**, y no un minuto.
//
// **Eso ya está resuelto por otro lado: el latido.** `latidoDeEstudio()` escribe la
// sección en curso cada 30 segundos mientras está abierta, así que lo que se pierde al
// cerrar es **lo que pasó desde el último latido** —medio minuto, no veinticinco—.
//
// Entonces lo que queda acá es lo único que sí se puede hacer en este momento: **sellar
// la sección**, que es memoria y no se pierde mientras la pestaña siga abierta. Y
// deliberadamente **no** se intenta escribir.
//
// ## Por qué no se escribe acá, en serio
//
// Se podría, y se sugirió: `preventDefault()` para que el navegador pida confirmación.
// **Se descartó el 2026-10-05, con el usuario a favor del latido.** Un aviso en cada
// cierre de pestaña, o un diálogo del navegador que el usuario tiene que volver a
// confirmar cada vez, es un peaje por escribir medio minuto. Y ni siquiera garantiza
// nada: la escritura sigue siendo una promesa sin a quién esperar.
//
// ## Lo que no se hizo, y por qué
//
// Hubo una versión que guardaba las secciones selladas en una variable para
// "volcarlas al próximo arranque". **Se sacó porque era mentira**: esa variable vivía
// en memoria, y con la pestaña cerrada no hay próximo arranque que la lea. Era código
// muerto que parecía una solución, y `buscar-codigo-muerto.js` lo dijo: dos
// asignaciones, ninguna lectura.
//
// ## Un coste del latido que conviene saber
//
// El latido escribe cada 30 segundos **aunque el usuario no haya pausado nunca**. Si
// cierra la pestaña, quedan hasta 30 segundos de estudio que el usuario **no cuenta** en
// su lado pero que sí quedan registrados. Es el precio de acotar la pérdida, y es un
// precio de 30 segundos contra una pérdida que antes era la sesión entera.
window.addEventListener('beforeunload', () => {
    if (!estaAbierta(seccionesEstado)) return;

    // Sellar sí; escribir no.
    cerrarSeccion(seccionesEstado, Date.now());
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
    // Protegida por `leerGrupo()`: antes, un valor que no fuera JSON rompía la
    // apertura del calendario —y el `JSON.parse` tiraba hacia arriba, así que el
    // usuario se quedaba sin poder ni abrirlo.
    calendario.anotaciones = leerGrupo('anotaciones', {}) || {};
}

// El plazo de una escritura, con la misma asimetría que el de la disponibilidad: un
// plazo corto de más hace que la app **no guarde** sin avisar, y un plazo largo de
// más cuesta una espera. El valor no aparece en ningún texto de la interfaz.
const PLAZO_ESCRITURA = AlmacenamientoDatos.PLAZO_ESCRITURA;

/**
 * Guarda las anotaciones del calendario.
 *
 * Antes escribía en `localStorage` **sin ninguna protección**: si fallaba, el error
 * subía, no se avisaba, no se revertía, y la anotación desaparecía al día siguiente.
 * Es el defecto que traía la especificación, y por eso ahora pasa por el módulo y
 * **vuelve una promesa**.
 *
 * @returns {Promise<boolean>}
 */
/**
 * Guarda las anotaciones. Devuelve la promesa, y **no revierte**.
 *
 * Que no revierta es a propósito: **revertir es de quien tiene el estado anterior**, y
 * ese es `guardarAnotacionesRevirtiendoSiFalla()`. Si esta función also deshiciera, lo
 * haría con una **copia superficial** del objeto nuevo —que es justo lo que se guardó—,
 * y desharía el cambio equivocado.
 *
 * @returns {Promise<boolean>}
 */
async function guardarAnotaciones() {
    if (!arranqueListo) {
        alert('El cuaderno todavía se está cargando. Esperá un momento y volvé a '
            + 'intentar; no se guardó nada.');
        return false;
    }

    try {
        await AlmacenamientoDatos.conPlazo(
            escribirGrupo('anotaciones', calendario.anotaciones),
            PLAZO_ESCRITURA
        );
        return true;
    } catch (error) {
        console.warn('[cuaderno] no se pudo guardar la anotación:', error);
        return false;
    }
}

/**
 * El día, **en el mismo formato que el usuario ve en el calendario**.
 *
 * Se podría escribir "1 de octubre", que se lee mejor. No se hace, y el motivo es
 * concreto: `01/10/2026` es la clave que el calendario ya muestra, y un aviso que
 * inventa **otro** formato obliga a la persona a traducirlo antes de poder usarlo.
 *
 * Un aviso más cómodo que hay que descifrar es peor que uno que se lee directo.
 */
function fechaLegible(clave) {
    return String(clave);
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

async function guardarAnotacion() {
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

    // Se arma el objeto **nuevo** en vez de mutar el que está: para poder deshacer el
    // cambio hay que tener el anterior entero, y una copia superficial no alcanza
    // porque las reglas del calendario editan el array del día **en el sitio**.
    const nuevas = { ...calendario.anotaciones, [fecha]: resultado.lista };

    if (!await guardarAnotacionesRevirtiendoSiFalla(nuevas)) return;

    descripcionAnotacion.value = '';
    mostrarAnotaciones(fecha);
    generarCalendario();
}

/**
 * Cambia las anotaciones y las guarda. Si no se puede, **deshace el cambio**.
 *
 * El mismo molde que `guardarRevirtiendoSiFalla()`: por eso existe esta función y no
 * un `try` alrededor de `guardarAnotaciones()`. Un `try` no puede deshacer una
 * mutación en el sitio, y **deshacer es la mitad de la garantía**.
 *
 * @param {object} nuevas
 * @returns {Promise<boolean>}
 */
async function guardarAnotacionesRevirtiendoSiFalla(nuevas) {
    const anteriores = calendario.anotaciones;

    // Qué día y de qué tipo se está guardando, para el aviso. Se calcula **antes** de
    // guardar, porque después del fallo lo que hay en pantalla ya es lo anterior.
    const dias = Object.keys(nuevas).filter(
        dia => (nuevas[dia] || []).length !== (anteriores[dia] || []).length
    );
    const nombreDelDia = dias.length > 0 ? fechaLegible(dias[0]) : null;

    const tipos = nombreDelDia
        ? [...new Set((nuevas[dias[0]] || []).map(a => a && a.tipo).filter(Boolean))]
        : [];
    const nombreDelTipo = tipos.length > 0 ? tipos.join(', ') : null;

    calendario.anotaciones = nuevas;

    if (await guardarAnotaciones()) return true;

    calendario.anotaciones = anteriores;

    // El aviso **nombra qué no se guardó**. "No se pudo guardar" a secas es un aviso
    // que no sirve: el usuario tiene un calendario con anotaciones en muchos días y no
    // tiene forma de saber cuál falló, así que no puede reintentarla.
    const donde = nombreDelDia
        ? ' del ' + nombreDelDia
            + (nombreDelTipo ? ' (' + nombreDelTipo + ')' : '')
        : '';

    alert('No se pudo guardar la anotación' + donde
        + ' y se deshició el cambio.\n\n'
        + 'Lo que ya tenías quedó como estaba: no se perdió nada.\n\n'
        + 'Podés exportar el cuaderno para tener una copia.');

    return false;
}

async function editarAnotacion(fecha, index) {
    const anotaciones = calendario.anotaciones[fecha];

    // La regla —qué pasa con el texto, y cuándo no es un cambio— se fue a
    // `js/logica/calendario.js`. Acá queda lo que necesita una pantalla: el
    // cartel para escribir y redibujar después.
    const actual = anotaciones && anotaciones[index];
    if (!actual) return;

    const nuevaDescripcion = prompt('Editar descripción:', actual.descripcion);
    if (nuevaDescripcion === null) return;

    // La regla edita en el sitio, así que primero se copia el día: sin la copia, si la
    // escritura falla no habría cómo volver al texto anterior.
    const diaCopia = anotaciones.map((a, i) => (i === index ? { ...a } : a));

    if (LogicaCalendario.cambiarDescripcion(diaCopia, index, nuevaDescripcion)) {
        const nuevas = { ...calendario.anotaciones, [fecha]: diaCopia };
        if (!await guardarAnotacionesRevirtiendoSiFalla(nuevas)) return;

        mostrarAnotaciones(fecha);
        generarCalendario();
    }
}

async function eliminarAnotacion(fecha, index) {
    if (!confirm('¿Eliminar esta anotación?')) return;

    // Mismo motivo que en `editarAnotacion`: la regla quita **en el sitio`, así que se
    // trabaja sobre una copia del día.
    const diaOriginal = calendario.anotaciones[fecha];
    if (!diaOriginal) return;
    const diaCopia = diaOriginal.slice();

    // La regla decide, no el filtro de acá. Antes reordenaba la pantalla y guardaba
    // aunque el índice estuviera viejo: el usuario veía "eliminado" y la anotación
    // seguía ahí.
    //
    // Y va sobre la **copia**, porque la regla quita **en el sitio**: si se llamara
    // con el array del día, un guardado que fallara no podría deshacerlo.
    if (LogicaCalendario.quitarAnotacion(diaCopia, index)) {
        const nuevas = { ...calendario.anotaciones, [fecha]: diaCopia };
        if (!await guardarAnotacionesRevirtiendoSiFalla(nuevas)) return;

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
/**
 * La promesa del arranque.
 *
 * Se publica por dos motivos, y los dos son de la regla de la API pública:
 *
 * 1. `test/navegador.test.js` la **espera**. El arnés solo juntaba errores
 *    síncronos y su `console` no hacía nada, así que un rechazo dentro de una
 *    promesa se perdía sin que ningún test lo viera. Con el arranque asíncrono, ese
 *    hueco pasó de improbable a todos los días.
 * 2. La secuencia tiene que poder **preguntar si terminó** antes de dejar que
 *    alguien guarde.
 */
const inicio = iniciar().catch((error) => {
    // Un fallo del arranque no se traga: se dice en la consola, y sigue siendo un
    // fallo, no un arranque en silencio a medias.
    console.error('[cuaderno] el arranque falló:', error);
});

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
    mensajeFalloAlGuardar,

    // El camino de las anotaciones, que es el que tenía el defecto de RF-4. Se
    // publica por el mismo motivo que `guardarDatos`: son caminos que **solo se
    // recorren cuando algo sale mal**, y no se pueden probar si no hay por dónde
    // llamarlos. Ver `test/anotaciones-almacenamiento.test.js`.
    guardarAnotaciones,
    guardarAnotacionesRevirtiendoSiFalla,

    // Abrir un documento. Está acá por una razón concreta: **el bug de los PDF no se veía en
// ningún resultado**. La app andaba, la consola limpia, los tests verdes, y el usuario
// veía "A este archivo le falta el contenido" en cada PDF que abría.
//
// Ver `test/abrir-documento.test.js`.
verDocumento,

// El contenido guardado —un texto con el archivo adentro— convertido a bytes. Es lo que
// necesitan pdf.js y mammoth, y antes cada uno lo resolvía por su cuenta: pdf.js lo recibía
// mal, y mammoth lo pedía con un `fetch` que es una petición de red. Ver
// `test/abrir-pdf-word.test.js`.
bytesDeDocumento,

// Qué se puede agregar. `crearDocumento()` decide, y esa decisión **no se puede probar
// desde el selector de archivos**: `accept` es una sugerencia del navegador, y se puede
// elegir cualquier archivo igual. Ver `test/formatos-aceptados.test.js`.
crearDocumento,

// El latido de estudio y el cierre, para que un test los pueda recorrer. Ver
    // `test/latido-camino.test.js`: un fallo acá **no se ve en ningún resultado**, el
    // Pomodoro sigue corriendo y el mapa de calor muestra un número razonable. Es un
    // fallo silencioso, y por eso necesita un test que lo mire de frente.
    abrirSeccionEstudio,
    cerrarSeccionEstudio,
    latidoDeEstudio,

    // El respaldo y la importación, sin la descarga ni el `FileReader`.
    //
    // Lo que **decide** qué entra al archivo y qué se reemplaza está en estas dos, y lo
    // que se queda en los manejadores es la descarga y la lectura del archivo: las dos son
    // mecanismos del navegador, y el arnés de `dom-falso.js` no dispara clics ni
    // `FileReader`. Sin exponerlas, todo el respaldo sería código sin probar.
    prepararRespaldo,
    importarRespaldo,

    // Abrir el calendario **carga** las anotaciones desde el almacén. Está acá porque
    // sin esto no hay forma de probar el camino de escritura con las anotaciones ya en
    // pantalla: la app las carga al abrir, como siempre hizo, y un test que las dé por
    // cargadas sin abrir el calendario está probando un estado que no existe.
    abrirCalendario,

    // La promesa del arranque. Ver arriba.
    inicio,
    // Qué pasó con la migración, para que un test pueda preguntarlo. Ver arriba.
    //
    // Un **getter**, no el valor: `ultimaMigracion` se reasigna cuando la migración
    // corre, y con una copia el test leería siempre el valor inicial —el de "todavía
    // no corrió"— y no probaría nada.
    get ultimaMigracion() { return ultimaMigracion; },

    // Lo que el usuario **ve** de las anotaciones, no lo que está guardado.
    //
    // Existe por una razón concreta, y es la razón por la que dos tests de
    // `test/anotaciones-almacenamiento.test.js` pasaban **por la razón equivocada**:
    // comprobaban el almacén, y el almacén nunca cambia cuando la escritura falla. Por
    // eso pasaban igual con la reversión puesta y con la reversión sacada — es decir,
    // no probaban la garantía que T7 vino a comprobar.
    //
    // La garantía es sobre **la pantalla**: "lo que se ve tiene que ser lo que está
    // guardado". Para comprobarla hay que poder mirar la pantalla.
    //
    // Un getter, no el valor: `calendario.anotaciones` se reasigna, y con una copia el
    // test leería siempre lo que había al arrancar.
    get anotacionesEnPantalla() { return calendario.anotaciones; }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.CuadernoVirtual = API;
}

})();

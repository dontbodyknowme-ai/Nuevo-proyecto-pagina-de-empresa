// ============================================
// EL ALMACÉN DEL CUADERNO
// ============================================
//
// Acá vive el almacén nuevo: el del navegador que separa cada dato y no tiene el
// tope de 5 MB.
//
// Esta tarea (**T2**) solo hace dos cosas: **abrir** el almacén y **probar que
// sirve**. Las cuatro grupos de datos, la migración y las escrituras entran en las
// tareas siguientes. Está escrito así a propósito —mover no es corregir— para que
// el arranque con el almacén nuevo se pueda probar solo.
//
// Las funciones puras de este archivo son las **decisiones**: qué se responde a
// partir de lo que hicieron los tres pasos, y qué texto se le muestra a la
// persona. Esas se prueban con `node --test` y no necesitan navegador. Lo que
// habla con `indexedDB` no se puede probar en Node, y por eso la comprobación de
// que el almacén abre de verdad se hace en Chrome (es el criterio de T2).
//
// Cubre: RF-3 de specs/008-almacenamiento-real/spec.md
// Ver: specs/008-almacenamiento-real/plan.md, DD-1 y DD-8
// ============================================

(function () {

// El nombre del almacén. Distinto de la clave del almacenamiento por clave, así
// que nada de lo que hay hoy se pisa con lo que se escriba acá.
const NOMBRE_ALMACEN = 'cuadernoVirtual';

// Los almacenes de datos. El de metadatos es el primero: lo creó la prueba de
// disponibilidad en la versión 1.
const ALMACEN_METADATOS = 'metadatos';
const ALMACEN_MATERIAS = 'materias';
const ALMACEN_CONTENIDOS = 'contenidos';
const ALMACEN_MINUTOS = 'minutos';
const ALMACEN_ANOTACIONES = 'anotaciones';

// La versión sube a 3 para agregar `contenidos`, que es donde vive el archivo de cada
// documento.
//
// ## Por qué el contenido va aparte del índice
//
// El índice es lo chico: nombres, tipos, fechas. El contenido es lo que pesa. Si
// estuvieran juntos, cargar el índice al arrancar cargaría **todo** el cuaderno, y un
// cuaderno de 200 MB haría que abrir la app costara lo mismo después de subir el año
// entero de apuntes.
//
// ## Por qué NO hay una marca con la "forma" de los datos
//
// Porque es una trampa: si el formato cambiara y la marca quedara puesta, nadie
// volvería a migrar. Y volver a migrar **desde el almacén viejo** perdería lo que el
// usuario guardara entretanto, porque de ahí sí se quedó atrás. El formato cambió
// muchas veces acá **antes** de que migrara nadie, así que no hay nada que recuperar.
// El día que cambie con datos en el almacén nuevo, es otro diseño y otra decisión.
const VERSION = 3;

const TODOS_LOS_ALMACENES = [
    ALMACEN_METADATOS,
    ALMACEN_MATERIAS,
    ALMACEN_CONTENIDOS,
    ALMACEN_MINUTOS,
    ALMACEN_ANOTACIONES
];

// Los cuatro grupos de datos, y **dónde vive cada uno**.
//
// El orden importa y no es arbitrario: es el orden en que se copian, y la marca de
// migración se escribe **después** de los cuatro. Ver `migrar()`.
const GRUPOS = [
    { nombre: 'materias', almacen: ALMACEN_MATERIAS, clave: 'indice' },
    { nombre: 'heredados', almacen: ALMACEN_MINUTOS, clave: 'heredados' },
    { nombre: 'estudio', almacen: ALMACEN_MINUTOS, clave: 'estudio' },
    { nombre: 'anotaciones', almacen: ALMACEN_ANOTACIONES, clave: 'anotaciones' }
];

// El registro de prueba de disponibilidad. **Nombre reservado**: no lo usa ningún
// dato del usuario, y se borra al terminar si no estaba antes.
const CLAVE_PRUEBA = '__disponibilidad__';
const VALOR_PRUEBA = 'disponible';

// El registro donde vive la marca de migración terminada.
const CLAVE_MIGRACION = 'migracion';

// El plazo de una escritura, con la **misma asimetría** que el de la disponibilidad:
// un plazo corto de más hace que la app no guarde sin avisar, y un plazo largo de más
// cuesta una espera. Sin respuesta no se puede afirmar que se guardó, así que el plazo
// decides por la misma razón.
//
// Con la diferencia de que acá el valor es mucho más holgado a propósito: el peor caso
// medido de la disponibilidad fue de 87 ms, y **una escritura mueve el cuaderno
// entero**, no un registro de prueba. Con 5000, una escritura que colgara del disco
// tardaría cinco segundos en rendirse; con menos, el usuario cancela la app antes.
const PLAZO_ESCRITURA = 5000;

// El plazo de la prueba entera —abrir, escribir, releer y borrar—, no de cada
// paso.
//
// **Medido el 2026-10-05**, con `herramientas/medir-disponibilidad.js`: Chrome 154
// desde el archivo y **sin red**, la prueba tardó **87 ms en frío** y 8, 6, 4, 4 ms
// después. Peor caso, 87 ms.
//
// 2000 es unas **23 veces** el peor caso medido: una máquina 23 veces más lenta
// antes de un falso negativo. Y un falso negativo **hace que la aplicación no
// abra**, que es el único riesgo real de este número — el otro es esperar de más una
// vez, y ese es mucho más barato.
//
// Antes eran 5000 ms, elegidos por la asimetría de las consecuencias sin medir. Con
// el dato en la mano, 5000 quedó holgado. Ver DD-8 del plan, y MEMORY.md.
//
// Lo que importa: **es un número en el código y no en la pantalla**. Un plazo escrito
// en un mensaje se desincroniza solo, y el usuario no puede cambiarlo.
const PLAZO_DISPONIBILIDAD = 2000;

// ---------- Las decisiones, que son puras ----------

/**
 * Decide si el almacén sirve, a partir de lo que hicieron los tres pasos.
 *
 * El orden de las causas importa: se informa **la primera que falla**, no la
 * última que se miró. Si no abrió, decir "no se pudo escribir" sería mentira
 * sobre lo que pasó.
 *
 * `existeAlmacen` va primero porque no hay nada que esperar: si el navegador no
 * lo tiene, se sabe en el acto. `vencio` va segundo porque sin respuesta no se
 * puede afirmar que los otros pasos sirieran.
 *
 * @param {object} pasos
 * @param {boolean} [pasos.existeAlmacen]
 * @param {boolean} [pasos.abrio]
 * @param {boolean} [pasos.escribio]
 * @param {boolean} [pasos.leyoIgual]
 * @param {boolean} [pasos.vencio]
 * @returns {{disponible: boolean, motivo: string|null}}
 */
function evaluarDisponibilidad(pasos) {
    const p = pasos || {};

    if (p.existeAlmacen === false) return { disponible: false, motivo: 'no-existe' };
    if (p.vencio) return { disponible: false, motivo: 'vencido' };
    if (!p.abrio) return { disponible: false, motivo: 'no-abre' };
    if (!p.escribio) return { disponible: false, motivo: 'no-escribe' };
    if (!p.leyoIgual) return { disponible: false, motivo: 'no-lectura' };

    return { disponible: true, motivo: null };
}

/**
 * El texto de "la aplicación no abre".
 *
 * Dice **las cuatro cosas** que pide RF-3: que no puede abrir el almacenamiento,
 * que por eso el cuaderno no abre, las dos causas más probables, y que no se
 * borró nada.
 *
 * **El motivo no se muestra.** El usuario no puede actuar sobre "vencido" ni
 * sobre "no-lectura", y un mensaje por causa técnica lo manda a buscar un
 * problema que no tiene. El motivo va a la consola.
 *
 * El plazo **no aparece**: vive en el código. Y el texto no lleva ningún número,
 * porque ningún número de esta app es confiable en pantalla salvo que venga del
 * dato.
 *
 * @returns {string}
 */
function textoAlmacenamientoNoAbre() {
    return 'No se pudo abrir el almacenamiento del navegador, y por eso el cuaderno '
        + 'no puede abrir.\n\n'
        + 'Pasa sobre todo en dos casos:\n\n'
        + '- Estás en una ventana privada. Probá abriendo la aplicación fuera de ella.\n'
        + '- El navegador no lo soporta con el archivo abierto desde el disco. Probá '
        + 'con otro navegador.\n\n'
        + 'No se borró nada: el cuaderno sigue donde estaba.';
}

// ---------- Lo que habla con el navegador ----------

/** Si este navegador tiene el almacén nuevo. */
function hayAlmacen() {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/** Un error que además dice en qué paso se falló y hasta dónde se llegó. */
function fallo(motivo, pasos, causa) {
    return Object.assign(new Error(motivo), { pasos, causa });
}

/**
 * Abre el almacén, creando los almacenes que falten.
 *
 * La versión sube con las tareas que agregan almacenes. Los que ya estaban **no se
 * tocan**: `createObjectStore` sobre un nombre que ya existe tira, y un
 * `deleteObjectStore` sería empezar a perder datos.
 */
function abrir() {
    return new Promise((resolver, rechazar) => {
        let peticion;
        try {
            peticion = indexedDB.open(NOMBRE_ALMACEN, VERSION);
        } catch (error) {
            rechazar(error);
            return;
        }

        peticion.onupgradeneeded = () => {
            const base = peticion.result;
            for (const nombre of TODOS_LOS_ALMACENES) {
                if (!base.objectStoreNames.contains(nombre)) {
                    base.createObjectStore(nombre);
                }
            }
        };

        peticion.onsuccess = () => resolver(peticion.result);
        peticion.onerror = () => rechazar(peticion.error || new Error('no se pudo abrir'));
        peticion.onblocked = () => rechazar(new Error('otra pestaña tiene el almacén abierto'));
    });
}

/** Lee un registro. Devuelve `undefined` si no está, y no lanza por eso. */
function leerRegistro(almacen, nombreAlmacen, clave) {
    return new Promise((resolver, rechazar) => {
        let transaccion;
        try {
            transaccion = almacen.transaction(nombreAlmacen, 'readonly');
        } catch (error) {
            rechazar(error);
            return;
        }

        const peticion = transaccion.objectStore(nombreAlmacen).get(clave);
        peticion.onsuccess = () => resolver(peticion.result);
        peticion.onerror = () => rechazar(peticion.error || new Error('la lectura falló'));
    });
}

/**
 * Espera a que una transacción termine de verdad.
 *
 * Se espera `oncomplete` y no el `put`: el `put` termina antes de que el disco
 * confirme, y una escritura que se da por buena antes de eso es una escritura
 * que puede perder.
 */
function escribirRegistro(almacen, nombreAlmacen, clave, valor) {
    return new Promise((resolver, rechazar) => {
        let transaccion;
        try {
            transaccion = almacen.transaction(nombreAlmacen, 'readwrite');
        } catch (error) {
            rechazar(error);
            return;
        }

        transaccion.oncomplete = () => resolver();
        transaccion.onerror = () => rechazar(transaccion.error || new Error('la escritura falló'));
        transaccion.onabort = () => rechazar(transaccion.error || new Error('la escritura se abortó'));

        // El `put` va protegido porque **puede lanzar sin cronía**: cuando el almacén
        // está lleno, algunos navegadores tiran en el `put` mismo y no por el evento.
        // Sin este `try`, la excepción sale del executor de la promesa, y como nadie la
        // espera se convierte en un rechazo no manejado que **tira el proceso entero**:
        // el aviso nunca se ve y la app se cae. Ver `test/red-protecciones.test.js`.
        try {
            transaccion.objectStore(nombreAlmacen).put(valor, clave);
        } catch (error) {
            rechazar(error);
        }
    });
}

/** Borra un registro. */
function borrarRegistro(almacen, nombreAlmacen, clave) {
    return new Promise((resolver, rechazar) => {
        let transaccion;
        try {
            transaccion = almacen.transaction(nombreAlmacen, 'readwrite');
        } catch (error) {
            rechazar(error);
            return;
        }

        transaccion.oncomplete = () => resolver();
        transaccion.onerror = () => rechazar(transaccion.error || new Error('el borrado falló'));
        transaccion.onabort = () => rechazar(transaccion.error || new Error('el borrado se abortó'));

        // Protegido por lo mismo que el `put`: puede lanzar sin cronía.
        try {
            transaccion.objectStore(nombreAlmacen).delete(clave);
        } catch (error) {
            rechazar(error);
        }
    });
}

/**
 * Le pone plazo a una promesa.
 *
 * El plazo es de la **prueba entera**, no de cada paso: si cada uno tuviera el
 * suyo, el total sería el triple del que dice el número.
 */
function conPlazo(promesa, milisegundos) {
    return new Promise((resolver, rechazar) => {
        const temporizador = setTimeout(() => {
            rechazar(Object.assign(new Error('venció el plazo'), { vencido: true }));
        }, milisegundos);

        promesa.then(
            valor => { clearTimeout(temporizador); resolver(valor); },
            error => { clearTimeout(temporizador); rechazar(error); }
        );
    });
}

/**
 * Los tres pasos, con sus resultados.
 *
 * Throws con `pasos` llenados hasta donde llegó, para que el motivo que se
 * informa sea el del paso que falló y no el del último que se miró.
 */
async function secuenciaDePrueba() {
    const pasos = {
        existeAlmacen: true,
        abrio: false,
        escribio: false,
        leyoIgual: false
    };

    let almacen = null;
    try {
        almacen = await abrir();
    } catch (error) {
        throw fallo('no-abre', pasos, error);
    }
    pasos.abrio = true;

    // Si el registro de prueba ya estaba, es de otra corrida: no se borra al
    // terminar. RF-3 lo pide así.
    let existiaAntes = false;
    try {
        existiaAntes = (await leerRegistro(almacen, ALMACEN_METADATOS, CLAVE_PRUEBA)) !== undefined;
        await escribirRegistro(almacen, ALMACEN_METADATOS, CLAVE_PRUEBA, VALOR_PRUEBA);
    } catch (error) {
        throw fallo('no-escribe', pasos, error);
    }
    pasos.escribio = true;

    try {
        const releido = await leerRegistro(almacen, ALMACEN_METADATOS, CLAVE_PRUEBA);
        // Comparar, no suponer: un almacén que devuelve otra cosa no está probando
        // que sirva para guardar.
        pasos.leyoIgual = releido === VALOR_PRUEBA;
    } catch (error) {
        throw fallo('no-lectura', pasos, error);
    } finally {
        // El registro de prueba se borra **siempre** que no estuviera antes, haya
        // coincidence o no: dejarlo ahí sería dejar basura en el cuaderno.
        if (!existiaAntes) {
            try {
                await borrarRegistro(almacen, ALMACEN_METADATOS, CLAVE_PRUEBA);
            } catch (error) {
                console.warn('[almacenamiento] no se pudo borrar el registro de prueba');
            }
        }
        try { almacen.close(); } catch (error) { /* nada que hacer */ }
    }

    if (!pasos.leyoIgual) throw fallo('no-lectura', pasos);

    return pasos;
}

/**
 * La prueba de disponibilidad. Una sola vez al arrancar.
 *
 * **Nunca lanza.** Devuelve siempre `{ disponible, motivo }`, y el motivo va a la
 * consola. Lo que decide si la aplicación abre es `disponible`.
 *
 * @returns {Promise<{disponible: boolean, motivo: string|null}>}
 */
async function probarDisponibilidad() {
    if (!hayAlmacen()) {
        return evaluarDisponibilidad({ existeAlmacen: false });
    }

    try {
        const pasos = await conPlazo(secuenciaDePrueba(), PLAZO_DISPONIBILIDAD);
        return evaluarDisponibilidad(pasos);
    } catch (error) {
        if (error && error.vencido) {
            console.warn('[almacenamiento] la prueba no terminó dentro de',
                PLAZO_DISPONIBILIDAD, 'ms');
            return evaluarDisponibilidad({ existeAlmacen: true, vencio: true });
        }

        console.warn('[almacenamiento] no está disponible:', error && error.message);
        return evaluarDisponibilidad(
            Object.assign({ existeAlmacen: true }, error && error.pasos)
        );
    }
}

// --- Exportación: funciona en Node (tests) y en el navegador ---

/**
 * ¿Está la marca de migración terminada?
 *
 * Es lo único que decide si se vuelve a migrar. Si no está, se migra —y si la
 * migración termina bien, se escribe.
 */
async function estaMigrada() {
    const base = await abrir();
    try {
        const marca = await leerRegistro(base, ALMACEN_METADATOS, CLAVE_MIGRACION);
        return !!(marca && marca.terminada);
    } finally {
        try { base.close(); } catch (error) { /* nada que hacer */ }
    }
}

/**
 * Copia los cuatro grupos al almacén nuevo.
 *
 * ## Por qué la marca se escribe AL FINAL
 *
 * Si se escribiera primero, una copia cortada dejaría el almacén marcado como
 * terminado **con datos a medias**, y eso nadie lo repara: la regla ya diría que no
 * hay nada que hacer. Escribiéndola al final, una migración incompleta es
 * indistinguible de una que no empezó, y se repite entera.
 *
 * ## Lo que NO hace, y no es un olvido
 *
 * **No borra el almacén viejo.** Queda entero como red. No hay ninguna operación en
 * todo este archivo que lo borre, y por eso hay un test que falla si alguna aparece.
 *
 * ## Copia, no transforma
 *
 * Los minutos heredados van tal cual. Convertir el formato viejo es otro requisito,
 * con su propia verificación, y hacerlo acá sería inventarlo.
 *
 * @param {object} datos los cuatro grupos, por nombre
 * @returns {Promise<{copiado: boolean, motivo: string|null}>}
 */
async function migrar(datos) {
    const base = await abrir();

    try {
        for (const grupo of GRUPOS) {
            const valor = datos ? datos[grupo.nombre] : undefined;

            // Un grupo que no está guardado no se copia: no se inventa un valor
            // vacío donde el usuario nunca tuvo nada.
            if (valor === undefined || valor === null) continue;

            if (grupo.nombre === 'materias') {
                // Acá es donde se separa el índice de los archivos. El índice va sin
                // contenido, y cada contenido va a su propio registro.
                const { indice, contenidos } = separarIndice(valor);

                await escribirRegistro(base, grupo.almacen, grupo.clave, indice);

                for (const idDocumento of Object.keys(contenidos)) {
                    await escribirRegistro(
                        base, ALMACEN_CONTENIDOS, idDocumento, contenidos[idDocumento]
                    );
                }
                continue;
            }

            await escribirRegistro(base, grupo.almacen, grupo.clave, valor);
        }
    } catch (error) {
        // **La marca no se escribe.** Es lo que hace que la próxima apertura vuelva a
        // intentarlo desde el principio.
        return { copiado: false, motivo: 'copia' };
    } finally {
        try { base.close(); } catch (error) { /* nada que hacer */ }
    }

    try {
        await escribirRegistro(
            await abrir(), ALMACEN_METADATOS, CLAVE_MIGRACION, { terminada: true }
        );
    } catch (error) {
        // Los datos entraron y la marca no. La migración **no se dio por terminada**:
        // en el próximo arranque se vuelve a copiar entera.
        return { copiado: false, motivo: 'marca' };
    }

    return { copiado: true, motivo: null };
}

/**
 * Deja escrita la marca de migración, sin copiar nada.
 *
 * ## Por qué existe: un respaldo importado se perdía al recargar
 *
 * La marca responde a una sola pregunta: **¿de dónde lee la aplicación?** Y la respuesta
 * que significa *"del almacén viejo"* no se puede sostener cuando **el almacén viejo está
 * vacío y el nuevo está lleno**.
 *
 * El caso: un perfil nuevo no tiene nada que migrar, así que la migración no marca —bien
 * hecho, no hay nada que copiar—. El usuario importa un respaldo: los cuatro grupos se
 * escriben en el almacén nuevo y la importación dice que salió bien. Al recargar, la app
 * ve que no hay marca, busca en el almacén viejo, no encuentra nada, y **muestra un cuaderno
 * vacío**. Los datos están enteros en el almacén nuevo y nadie los mira.
 *
 * Escribirlos, entonces, **obliga a marcar**. Si el cuaderno está en el almacén nuevo,
 * tiene que estar marcado.
 *
 * ## Por qué no se llama a `migrar()`
 *
 * Porque no hay nada que copiar. `migrar()` lee el almacén viejo y lo vuelca; con el
 * viejo vacío copiaría `null` sobre lo recién importado. Esta función solo pone la marca.
 *
 * @returns {Promise<boolean>} si la marca quedó escrita
 */
async function marcarMigrada() {
    try {
        await escribirRegistro(
            await abrir(), ALMACEN_METADATOS, CLAVE_MIGRACION, { terminada: true }
        );
        return true;
    } catch (error) {
        console.warn('[almacenamiento] no se pudo escribir la marca de migración:', error);
        return false;
    }
}

/**
 * Lee los cuatro grupos del almacén nuevo.
 *
 * Es la única fuente después de migrar: **del almacén viejo no se lee nada**. Un
 * registro vive en un solo lugar, y por eso los mismos minutos no se cuentan dos
 * veces.
 */
async function leerGrupos() {
    const base = await abrir();
    const grupos = {};

    try {
        for (const grupo of GRUPOS) {
            grupos[grupo.nombre] = await leerRegistro(
                base, grupo.almacen, grupo.clave
            );
        }
    } finally {
        try { base.close(); } catch (error) { /* nada que hacer */ }
    }

    return grupos;
}

/**
 * Separa el contenido de cada documento del índice del cuaderno.
 *
 * Es **puro**: no toca el almacén, solo parte una estructura. Por eso va en el módulo
 * y no suelto dentro de la migración, y por eso se puede probar en Node.
 *
 * Lo que hace y lo que no:
 *
 * - El índice conserva **id, nombre y tipo** de cada documento. Es lo que el menú
 *   necesita para dibujarse.
 * - El contenido va al diccionario que se devuelve aparte, y sale del índice.
 * - **No se descarta nada**: un documento sin contenido sigue en el índice, con su
 *   nombre, para que el usuario lo vea y decida. Marcarlo como roto sería mentir
 *   sobre lo que tiene.
 * - **No muta lo que recibe**: el llamador conserva su objeto.
 *
 * @param {Array} materias
 * @returns {{indice: Array, contenidos: object}}
 */
function separarIndice(materias) {
    const contenidos = {};

    const indice = (Array.isArray(materias) ? materias : []).map(materia => {
        const documentos = Array.isArray(materia.documentos) ? materia.documentos : [];

        return Object.assign({}, materia, {
            documentos: documentos.map(documento => {
                if (documento && documento.contenido !== undefined) {
                    contenidos[documento.id] = documento.contenido;
                    // El `contenido` sale del índice con un rest sin él: mutar el
                    // documento original dejaría al llamador con un objeto que ya no
                    // tiene contenido, y no podría volver atrás.
                    const { contenido, ...resto } = documento;
                    return resto;
                }
                return documento;
            })
        });
    });

    return { indice, contenidos };
}

/**
 * Los contenidos que se pidieron desde el arranque.
 *
 * No es un caché con política de expulsión: es lo que el usuario abrió. Vive en
 * memoria porque el visor **ya lo tiene cargado** —un PDF está renderizado, un HTML
 * está en el `iframe`—, así que volver a pedirlo sería tirar trabajo para elegirlo de
 * nuevo.
 */
const contenidosPedidos = new Map();

/**
 * Cuántos contenidos hay en memoria ahora.
 *
 * Lo consulta un test, y hay una razón de fondo: **si esto creciera al arrancar, la
 * separación entre índice y archivos estaría rota**. Es la única forma de comprobar
 * que los archivos no se cargan solos.
 *
 * @returns {number}
 */
function contenidosEnMemoria() {
    return contenidosPedidos.size;
}

/**
 * El contenido de un documento, pedido **en el momento de abrirlo**.
 *
 * @param {string} idDocumento
 * @returns {Promise<string|undefined>}
 */
async function leerContenido(idDocumento) {
    if (contenidosPedidos.has(idDocumento)) {
        return contenidosPedidos.get(idDocumento);
    }

    const base = await abrir();
    let contenido;
    try {
        contenido = await leerRegistro(base, ALMACEN_CONTENIDOS, idDocumento);
    } finally {
        try { base.close(); } catch (error) { /* nada que hacer */ }
    }

    // Un documento **vacío** y un documento **roto** no son lo mismo: el vacío se
    // guarda como cadena vacía, y `undefined` es "no hay". Guardar el `undefined`
    // convertiría un documento vacío en uno al que le falta el contenido, y el
    // visor mentiría sobre lo que el usuario tiene.
    if (contenido !== undefined) contenidosPedidos.set(idDocumento, contenido);

    return contenido;
}

/**
 * Escribe un grupo de datos en el almacén nuevo.
 *
 * `undefined` y `null` **no** se escriben: no se inventa un valor vacío donde el
 * usuario nunca tuvo nada, y borrarlo sería perder lo que tenía.
 *
 * Se espera `oncomplete` de la transacción, no el `put`: el `put` termina antes de
 * que el disco confirme, y dar por buena una escritura antes de eso es una
 * escritura que puede perderse sin avisar.
 *
 * @param {string} nombre el grupo, como en `GRUPOS`
 * @param {*} valor
 * @returns {Promise<void>}
 */
async function guardarGrupo(nombre, valor) {
    if (valor === undefined || valor === null) return;

    const grupo = GRUPOS.find(g => g.nombre === nombre);
    if (!grupo) throw new Error('grupo desconocido: ' + nombre);

    const base = await abrir();
    try {
        await escribirRegistro(base, grupo.almacen, grupo.clave, valor);
    } finally {
        try { base.close(); } catch (error) { /* nada que hacer */ }
    }
}

/**
 * Escribe el archivo de un documento.
 *
 * @param {string} idDocumento
 * @param {string} contenido
 * @returns {Promise<void>}
 */
async function guardarContenido(idDocumento, contenido) {
    if (contenido === undefined) return;

    const base = await abrir();
    try {
        await escribirRegistro(base, ALMACEN_CONTENIDOS, idDocumento, contenido);
    } finally {
        try { base.close(); } catch (error) { /* nada que hacer */ }
    }

    // La memoria tiene que saber lo que hay en el almacén. Si no, abrir el mismo
    // documento dos veces lo pediría dos veces, y peor: si se guardara un contenido
    // nuevo, la memoria seguiría con el viejo y el visor abriría lo que ya no está.
    contenidosPedidos.set(idDocumento, contenido);
}

const API = {
    // Puras: se prueban sin navegador
    evaluarDisponibilidad,
    textoAlmacenamientoNoAbre,
    PLAZO_DISPONIBILIDAD,
    PLAZO_ESCRITURA,

    // Hablan con el navegador. Acá van **solo las que alguien pide de afuera**.
    // Lo que hoy no tiene consumidor —`leerRegistro`, `escribirRegistro`,
    // `borrarRegistro`, `conPlazo`, `NOMBRE_ALMACEN`, `ALMACEN_METADATOS` y
    // `CLAVE_PRUEBA`— se usa adentro pero **no sale en el `API`**: una exportación
    // sin nadie que la pida es código muerto que espera, y `buscar-codigo-muerto.js`
    // lo señala. Las tareas siguientes las vuelven a agregar el día que tengan un
    // llamador, no antes.
    abrir,
    probarDisponibilidad,

    // La migración y sus lectores. Son lo que `app.js` necesita para, después de
    // migrar, no volver a mirar el almacén viejo.
    migrar,
    estaMigrada,
    marcarMigrada,
    leerGrupos,

    // El archivo de un documento, pedido a pedido.
    leerContenido,
    contenidosEnMemoria,

    // Las escrituras. Van por el mismo módulo que las lecturas, y por eso no puede
    // pasar que se lea de un almacén y se escriba en el otro.
    guardarGrupo,
    guardarContenido,

    // El plazo lo usa `app.js` para no dejar una escritura colgada para siempre. Sin
    // esto salía como `undefined` y la promesa interna de la escritura quedaba
    // **huérfana**: su rechazo no lo escuchaba nadie y **tiraba el proceso entero**,
    // con el aviso sin verse nunca.
    conPlazo,

    // Puras: se prueban sin navegador
    separarIndice
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
} else {
    window.AlmacenamientoDatos = API;
}

})();

// ============================================
// EL RESPALDO, POR EL CAMINO REAL
// ============================================
//
// Lo que `test/respaldo-cuatro-grupos.test.js` **no** puede probar: que la app lea el
// contenido de los documentos del almacén donde vive de verdad, y no del índice.
//
// ## Por qué esto es lo importante
//
// El defecto de T9 no estaba en las reglas puras: estaba en que **nadie leía los
// archivos**. Desde que el índice y los archivos están en almacenes distintos, el contenido
// de un documento en memoria solo existe si el usuario lo abrió alguna vez. Un respaldo
// armado desde el índice sale con todos los contenidos en `null`.
//
// Y eso **no se ve en ningún resultado**: la descarga anda, el archivo abre, el `JSON` es
// válido. Solo se descubre cuando el usuario necesita respaldar de verdad.
//
// ## Un simulador no puede probar esto
//
// El almacén falso devuelve el contenido al instante. Un simulador que responde siempre
// bien es justo el que esconde esta clase de defecto. Lo que hay que mirar es **qué se
// pide y de dónde**, no que la respuesta llegue.

const test = require('node:test');
const assert = require('node:assert/strict');

const { cargarComoNavegador, crearIndexedDB } = require('./dom-falso.js');

// ## Esto es una **lista**, no una materia suelta
//
// Y tiene que serlo. La primera versión de este archivo declaraba la materia como un
// objeto y la envolvía al sembrar: `cuadernoVirtual: JSON.stringify([MATERIA])`. Después
// cargaba los archivos con `JSON.parse(JSON.stringify(MATERIA))`, **sin** envolverla, y
// `guardarRevirtiendoSiFalla()` recibía un objeto donde esperaba una lista.
//
// El resultado fue desconcertante y muy informativo: `separarIndice()` devolvía `[]` y
// `leerGrupos()` después venía vacío. Parecía un defecto del almacén, y durante un rato
// lo fue —busqué en el módulo, en el orden de las escrituras y en la promesa del
// respaldo—.
//
// La respuesta era que **`separarIndice()` hace `[]` con un objeto suelto, a propósito**:
// no lanza. Y está bien que así sea. El defecto estaba en el test, que armaba un estado
// que la app nunca tiene.
//
// La moraleja, y es la segunda vez que aparece en esta spec: **un `[]` o un `undefined`
// inesperado en un punto medio del recorrido es el dato de prueba, no el defecto.**
// `separarIndice()` no tira nunca, y por eso el error se corrió tres pasos hacia abajo.
const MATERIA = [{
    id: 'm1',
    nombre: 'Matemáticas',
    documentos: [
        { id: 'd1', nombre: 'Parcial.pdf', tipo: 'pdf', contenido: null },
        { id: 'd2', nombre: 'nota.html', tipo: 'html', contenido: null }
    ]
}];

/**
 * Carga la app con el almacén ya migrado y los archivos cargados a mano.
 *
 * Los archivos se cargan **por el camino de escritura de la app** (`guardarDatos()`), que
 * es el mismo que usa el usuario al subir un documento. Sembrarlos por otro lado sería
 * probar un estado que la app nunca tiene.
 */
async function appConArchivo(modo, sinContenido = []) {
    const almacen = crearIndexedDB('bien');

    const carga = cargarComoNavegador({
        cuadernoVirtual: JSON.stringify(MATERIA),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    }, { indexedDB: almacen });

    await carga.inicio;

    const contexto = carga.contexto;
    const alertas = [];
    const confirmaciones = [];
    contexto.alert = (texto) => { alertas.push(texto); };
    contexto.confirm = (texto) => { confirmaciones.push(texto); return true; };

    // Se suben los archivos como lo haría el usuario: con su contenido en memoria, para
    // que al guardar se manden al almacén de contenidos.
    //
    // Se usa `guardarRevirtiendoSiFalla()`, que es el camino de escritura de la app: pone
    // las materias y las guarda. Inventar una forma de "cargar archivos de prueba" sería
    // probar un estado que la app nunca tiene.
    const conArchivos = JSON.parse(JSON.stringify(MATERIA));
    conArchivos[0].documentos[0].contenido = 'BASE64-DEL-PDF';
    conArchivos[0].documentos[1].contenido = '<p>hola</p>';

    // Un documento "sin contenido guardado" se arma **sin** su contenido: así nunca entra
    // al almacén de contenidos, y al leerlo no aparece nada. Es el caso real de un archivo
    // que seGuardó pero cuyo contenido no se pudo leer.
    //
    // La primera versión de este arnés probaba eso con `guardarContenido(id, undefined)`, y
    // **no funcionaba**: el almacén falso guarda `undefined` como si fuera un valor más y
    // el contenido viejo sigue ahí. Un simulador que no sabe borrar esconde justo el
    // defecto que se quiere probar.
    for (const id of sinContenido) {
        const doc = conArchivos[0].documentos.find(d => d.id === id);
        if (doc) delete doc.contenido;
    }

    assert.equal(await contexto.CuadernoVirtual.guardarRevirtiendoSiFalla(conArchivos), true,
        'no se pudieron cargar los archivos de prueba');
    // Y no hace falta **borrar** nada del almacén de contenidos: un documento al que nunca
    // se le puso contenido nunca se escribe ahí, así que al leerlo no aparece. Así se
    // armó el caso.

    // **Y ahora se recarga**, que es lo que importa: en una sesión nueva los documentos
    // vuelven a tener el contenido en `null`, porque nadie los abrió.
    const segunda = cargarComoNavegador({
        cuadernoVirtual: JSON.stringify(MATERIA),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    }, { indexedDB: almacen });

    await segunda.inicio;

    const alertas2 = [];
    const confirmaciones2 = [];
    segunda.contexto.alert = (texto) => { alertas2.push(texto); };
    segunda.contexto.confirm = (texto) => { confirmaciones2.push(texto); return true; };

    if (modo) almacen.modo = modo;

    return {
        contexto: segunda.contexto,
        mod: segunda.contexto.AlmacenamientoDatos,
        almacen,
        alertas: alertas2,
        confirmaciones: confirmaciones2,
       // Lo que quedó en el almacén, para comparar.
        grupos: async () => segunda.contexto.AlmacenamientoDatos.leerGrupos()
    };
}

// ---------- El defecto que destapó sembrar "bien" ----------

test('un respaldo importado se ve después de recargar, aunque el perfil estuviera vacío', async () => {
    // ## El peor defecto de T9, y no lo buscaba
    //
    // En un perfil **nuevo** —sin nada en `localStorage`— la migración no encuentra nada
    // que copiar, así que **no deja la marca**. Y sin la marca, `leerGrupo()` lee del
    // almacén viejo, que está vacío.
    //
    // El usuario importa un respaldo. Le dicen que salió bien. Recarga. **El respaldo no
    // está.** Los datos están en el almacén nuevo, enteros, y la aplicación no los mira.
    //
    // ## Por qué no se vio antes
    //
    // Porque **toda** la verificación sembraba `localStorage`. Con al menos una clave
    // puesta, la migración marcaba, y todo andaba. Recién cuando la herramienta siembra
    // por el camino de escritura —que es lo que pedía T11— aparece el perfil vacío, y con
    // él este defecto.
    //
    // O sea: **arreglar la herramienta encontró un defecto de la aplicación.** La
    // herramienta no estaba mal; estaba midiendo el caso fácil.
    const almacen = crearIndexedDB('bien');

    // Perfil nuevo: **sin ninguna clave**, ni una vacía.
    const primera = cargarComoNavegador({}, { indexedDB: almacen });
    await primera.inicio;

    assert.equal(
        await primera.contexto.AlmacenamientoDatos.estaMigrada(), false,
        'el perfil vacío tiene que quedar sin marcar, o esta prueba no prueba el caso '
        + 'que dice probar'
    );

    primera.contexto.confirm = () => true;
    primera.contexto.alert = () => {};

    assert.equal(await primera.contexto.CuadernoVirtual.importarRespaldo({
        materias: [{ id: 'x1', nombre: 'Física', documentos: [] }],
        estudio: [],
        anotaciones: {}
    }), true);

    // Recarga: el usuario cierra y abre la aplicación.
    const segunda = cargarComoNavegador({}, { indexedDB: almacen });
    await segunda.inicio;

    const r = await segunda.contexto.CuadernoVirtual.prepararRespaldo();

    assert.equal(r.ok, true,
        'tras recargar, la app no puede ni armar un respaldo: está leyendo el almacén '
        + 'viejo, que está vacío, y no el nuevo donde está todo');

    // **Como texto, no con `deepStrictEqual`.** El arnés carga los scripts en su propio
    // contexto, así que los arrays que salen de ahí tienen **otro `Array.prototype`**, y la
    // comparación estricta falla por el prototipo con los valores idénticos. Una roja que
    // dice "son iguales" y no es, enseña a desconfiar de todas las demás.
    assert.equal(r.datos.materias.map(m => m.nombre).join(','), 'Física',
        'el respaldo importado desapareció al recargar. Los datos están en el almacén '
        + 'nuevo, enteros, y la aplicación no los mira porque no hay marca de migración');
});

// ---------- La red que evita que esto vuelva a pasar ----------

test('toda escritura de un grupo pasa por la escritura en orden', () => {
    // ## El defecto que T9 destapó
    //
    // `escribirGrupo()` —el camino que **espera a la escritura anterior** y **deja la
    // memoria al día**— lo usan dos de los cuatro caminos. `guardarDatos()` y
    // `guardarAnotaciones()` llamaban a `guardarGrupo()` directo, y se lo saltaban.
    //
    // Con la memoria desactualizada, un respaldo armado en la misma sesión salía **sin las
    // anotaciones que el usuario acababa de guardar**. Y un respaldo es justamente para lo
    // que se acaba de hacer algo.
    //
    // ## Por qué un test de fuente y no de comportamiento
    //
    // Porque el síntoma depende de una coincidencia —que el respaldo se arme en la misma
    // sesión, y solo de un grupo— y una coincidencia no es una regla. La regla es: **un
    // grupo se escribe por un solo camino**. Eso sí se puede comprobar siempre.
    const fs = require('node:fs');
    const path = require('node:path');

    const codigo = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

    // Se cuentan los usos, y se descuenta el que está **dentro** de `escribirGrupo()`: ese
    // es el que tiene que llamar directo, o no serializa nada.
    const todos = [...codigo.matchAll(/AlmacenamientoDatos\.guardarGrupo\(/g)].length;

    assert.equal(todos, 1,
        `hay ${todos} llamadas a guardarGrupo() directo. Solo puede haber una: la que `
        + 'está dentro de escribirGrupo(). Las demás se saltan el orden y la memoria, y '
        + 'el síntoma —un respaldo sin lo recién guardado— no aparece siempre');
});

// ---------- Exportar ----------

test('el respaldo se arma con el contenido de los archivos, no con el del índice', async () => {
    // **El criterio, por el camino real.** En una sesión recién abierta, los documentos
    // tienen el contenido en `null`. Si el respaldo saliera de ahí, sería un archivo que
    // no restaura nada.
    const { contexto } = await appConArchivo();

    const r = await contexto.CuadernoVirtual.prepararRespaldo();

    assert.equal(r.ok, true,
        `no se armó el respaldo: ${r.motivo || ''} ${r.documento || ''}`);

    const pdf = r.datos.materias[0].documentos.find(d => d.id === 'd1');

    assert.equal(pdf.contenido, 'BASE64-DEL-PDF',
        'el respaldo salió con el contenido en null. Importarlo deja cada documento '
        + 'con "a este archivo le falta el contenido", y el usuario descubre que su '
        + 'respaldo no tenía los archivos recién cuando los necesitaba');

    const html = r.datos.materias[0].documentos.find(d => d.id === 'd2');

    assert.equal(html.contenido, '<p>hola</p>');
});

test('el respaldo incluye el historial de estudio y el calendario', async () => {
    // Los otros dos grupos. Un respaldo sin ellos, para el mapa de calor y el calendario,
    // **es borrar el historial** sin avisar.
    const { contexto } = await appConArchivo();

    await contexto.CuadernoVirtual.guardarAnotacionesRevirtiendoSiFalla({
        '01/10/2026': [{ id: 'a1', tipo: 'nota', descripcion: 'Parcial' }]
    });

    const r = await contexto.CuadernoVirtual.prepararRespaldo();

    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.datos.estudio), 'el respaldo no trae historial de estudio');
    assert.ok(r.datos.anotaciones['01/10/2026'],
        'el respaldo no trae las anotaciones del calendario');
});

test('si no se puede leer un archivo, no se arma el respaldo', async () => {
    // Un respaldo al que le falta un archivo es **peor que no tener respaldo**: el usuario
    // lo descubre cuando ya lo necesitaba, y para entonces puede haber pisado lo que sí
    // tenía. Por eso no se baja ni a medias.
    const { contexto, alertas } = await appConArchivo(null, ['d1']);

    const r = await contexto.CuadernoVirtual.prepararRespaldo();

    assert.equal(r.ok, false, 'se armó el respaldo sin poder leer un archivo');
    assert.equal(r.motivo, 'incompleto');
    assert.equal(r.documento, 'Parcial.pdf',
        'el aviso tiene que decir QUÉ archivo no se pudo leer, o el usuario no puede ir '
        + 'a buscarlo');
    assert.equal(alertas.length, 0,
        'prepararRespaldo() no avisa: avisa el manejador del botón. Si avisa acá también, '
        + 'el usuario ve el aviso dos veces');
});

test('un HTML vacío no impide armar el respaldo', async () => {
    // Un HTML vacío **se puede abrir**: sale un iframe en blanco. Es la misma regla que
    // aplica a la lectura, y tiene que aplicar acá: si no, un documento vacío de verdad
    // bloquearía todos los respaldos para siempre.
    const { contexto } = await appConArchivo();

    const r = await contexto.CuadernoVirtual.prepararRespaldo();

    assert.equal(r.ok, true,
        `un HTML vacío no impide armar el respaldo: ${r.documento}`);
});

// ---------- Importar ----------

test('importar un respaldo con los cuatro grupos los restaura', async () => {
    const { contexto, grupos } = await appConArchivo();

    const respaldo = {
        materias: [{ id: 'n1', nombre: 'Física', documentos: [{ id: 'n2', nombre: 'a.pdf', tipo: 'pdf', contenido: 'X' }] }],
        heredados: [{ fecha: '2026-10-01T00:00:00.000Z', minutos: 25 }],
        estudio: [{ inicioMs: 0, finMs: 1500000 }],
        anotaciones: { '01/10/2026': [{ id: 'n3', tipo: 'nota', descripcion: 'Traída' }] }
    };

    assert.equal(await contexto.CuadernoVirtual.importarRespaldo(respaldo), true);

    const g = await grupos();

    assert.equal(g.materias[0].nombre, 'Física', 'no restauró las materias');
    assert.equal(g.heredados.length, 1, 'no restauró los minutos heredados');
    assert.equal(g.estudio.length, 1, 'no restauró el historial de estudio');
    assert.ok(g.anotaciones['01/10/2026'], 'no restauró las anotaciones');
});

test('el confirm de importar nombra los cuatro grupos', async () => {
    // "Esto sobrescribirá tus datos actuales" es cierto y **no sirve**: el usuario no sabe
    // qué se está por perder. Y ahora hay tres grupos más que antes.
    const { contexto, confirmaciones } = await appConArchivo();

    await contexto.CuadernoVirtual.importarRespaldo({
        materias: [],
        heredados: [],
        estudio: [],
        anotaciones: {}
    });

    const texto = confirmaciones[0] || '';

    for (const grupo of ['materias', 'minutos', 'estudio', 'calendario']) {
        assert.ok(texto.includes(grupo),
            `el confirm no menciona "${grupo}". Dice:\n${texto}`);
    }
});

test('el confirm deja claro que se reemplaza, no que se agrega', async () => {
    const { contexto, confirmaciones } = await appConArchivo();

    await contexto.CuadernoVirtual.importarRespaldo({ materias: [], estudio: [], anotaciones: {} });

    const texto = confirmaciones[0] || '';

    assert.match(texto, /reemplaza/i,
        `el confirm no dice que lo importado reemplaza lo que hay:\n${texto}`);
});

test('un respaldo viejo no borra el historial de estudio del usuario', async () => {
    // **El caso que hace esta tarea necesaria.** Un respaldo de la versión anterior solo
    // trae materias. Importarlo no puede vaciarle el mapa de calor: el archivo no trae
    // historial, y eso **no significa que el usuario no tenga**.
    const { contexto, grupos } = await appConArchivo();

    // Primero, historial real del usuario.
    contexto.CuadernoVirtual.abrirSeccionEstudio();
    await contexto.CuadernoVirtual.cerrarSeccionEstudio();

    const antes = await grupos();

    assert.equal(await contexto.CuadernoVirtual.importarRespaldo({
        materias: [{ id: 'n1', nombre: 'Física', documentos: [] }]
    }), true);

    const despues = await grupos();

    assert.equal(despues.estudio.length, antes.estudio.length,
        'importar un respaldo viejo vació el historial de estudio');
});

test('importar un respaldo viejo avisa que el archivo NO trae el historial', async () => {
    // Y el matiz que hace el texto: dice **que el archivo no lo trae**, no que estaba
    // vacío. La diferencia es entre un hecho y una afirmación que puede ser falsa — y si
    // es falsa, significa que hay historial que se acaba de perder.
    const { contexto, alertas } = await appConArchivo();

    await contexto.CuadernoVirtual.importarRespaldo({
        materias: [{ id: 'n1', nombre: 'Física', documentos: [] }]
    });

    const texto = alertas.join('\n');

    assert.match(texto, /no trae/i,
        `el aviso no dice que el archivo no trae el historial:\n${texto}`);

    // Y se comprueba que **niega** la vaciedad, no que no mencione la palabra.
    // *"eso no significa que estuvieran vacíos"*, que contiene "vacíos" y es exactamente
    // lo contrario de lo que no puede afirmarse.
    assert.match(texto, /no significa que estuvieran vacíos/i,
        `el aviso tiene que negar explícitamente que estuvieran vacíos, porque es lo `
        + `único que no se sabe:\n${texto}`);

    assert.doesNotMatch(texto, /no tenías|perdiste|se perdieron/i,
        `el aviso afirma una pérdida que no sabe:\n${texto}`);
});

test('si no se puede guardar lo importado, no se pisa nada', async () => {
    // Importar a medias es peor que un fallo visible: el usuario ve un respaldo importado
    // y al recargar vuelve lo anterior. Se ve una cosa y se tiene otra.
    const { contexto, grupos, alertas, almacen } = await appConArchivo();

    // **El estado de "antes" se lee con el almacén sano**, y solo después se lo rompe. La
    // primera versión rompía el almacén primero y no podía ni leer con qué comparar: el
    // modo de fallo también rompe las lecturas de los grupos de datos, así que `antes`
    // salía vacío y la comparación no comprobaba nada.
    const antes = await grupos();

    assert.ok(antes.materias.length > 0,
        'el almacén de partida no tiene materias: la comparación de abajo no probaría nada');

    almacen.modo = 'sin-espacio';

    const ok = await contexto.CuadernoVirtual.importarRespaldo({
        materias: [{ id: 'n1', nombre: 'Física', documentos: [] }],
        estudio: [],
        anotaciones: {}
    });

    assert.equal(ok, false, 'dijo que importó lo que no se pudo guardar');

    assert.match(alertas.join('\n'), /siguen como estaban|no se perdió nada/i,
        'el aviso tiene que decir que los datos siguen como estaban');

    almacen.modo = 'bien';

    const despues = await grupos();

    assert.equal(despues.materias[0].nombre, antes.materias[0].nombre,
        'las materias quedaron pisadas por un respaldo que no se pudo guardar');
});

test('un archivo sin lista de materias no se importa', async () => {
    const { contexto, alertas } = await appConArchivo();

    assert.equal(await contexto.CuadernoVirtual.importarRespaldo({}), false);

    assert.match(alertas.join('\n'), /no tiene la lista de materias/i);
});
// ============================================
// TESTS — El aviso de almacenamiento lleno
// Ejecutar: node --test
// Cubre: RF-11, y la especificación 006
// Ver: specs/006-reducir-app-js/spec.md
// ============================================
//
// El aviso tenía un problema que solo se veía leyendo el texto:
//
//     El almacenamiento del navegador está casi lleno (0 % de 95 %).
//
// El 0 % es real —el cálculo se hizo antes de escribir, y no falló— pero junto a
// "casi lleno" se lee como un contrasentido. El usuario no sabe si el número
// está mal, si la app está mal, ni qué hacer.
//
// La causa: **un solo mensaje para cuatro situaciones que no se parecen.** En
// unas se sabe cuánto hay; en otra el navegador tiró al escribir y no se sabe
// nada. Una cuarta usa el motivo `'lectura'` —que ni siquiera estaba en el
// mensaje— traducido a "se pasó el umbral crítico", que es mentira: no se pasó
// nada, no se pudo leer.
//
// Estos tests fijan que cada camino diga lo que sabe. El texto exacto importa
// menos que una cosa: que en el camino donde no se sabe, **no haya número**.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { cargarComoNavegador, crearIndexedDB } = require('./dom-falso.js');

// Los avisos viven en `app.js`, que no se puede pedir con `require` a secas: al
// cargarse toca `document` y aborta. Se carga como lo carga el navegador, con
// el arnés de `test/dom-falso.js`.

/**
 * Carga la app y **espera a que el arranque termine**.
 *
 * El `await` no es un detalle: desde que el arranque es una secuencia con `await`,
 * `guardarDatos()` rechaza mientras no termine. Un test de avisos que lo llamara
 * sin esperar estaría leyendo **el mensaje del candado** y creyendo que es el del
 * almacenamiento: el test pasa o falla por el motivo equivocado, que es peor que no
 * estar.
 */
async function app() {
    const carga = cargarComoNavegador({ cuadernoVirtual: '[]' });
    assert.deepEqual(carga.errores, [], 'la app tiene que cargar sin errores');
    await carga.inicio;
    return carga.contexto;
}

/**
 * Los textos de los avisos, **sin esperar el arranque**.
 *
 * A diferencia de `app()`, esta no espera: los tests que la usan llaman a
 * `mensajeFalloAlGuardar()` directo, que arma texto y no toca el cuaderno. Pedirle el
 * arranque sería hacerlos depender de algo que no están probando.
 */
function avisos() {
    return cargarComoNavegador({ cuadernoVirtual: '[]' }).contexto.CuadernoVirtual;
}

/**
 * Los textos que un usuario puede leer, en el orden en que los lee.
 *
 * ## Antes eran tres
 *
 * Eran el de umbral, el de espacio bajo y el de fallo. Los dos primeros **ya no
 * existen**: describían el muro de 5 MB de `localStorage`, y ese almacén se fue (T10).
 *
 * Se cuentan los que hay y no los que había: un helper que prometiera tres y devolviera
 * uno daría `undefined` en los otros dos, y los tests comparando `undefined` con
 * `undefined` pasarían sin comprobar nada. Un helper que miente sobre su propia cantidad
 * es peor que uno que devuelve una lista.
 */
function losTextos() {
    return {
        fallo: avisos().mensajeFalloAlGuardar()
    };
}

// ---------- El texto de "casi lleno" no existe (T10) ----------

test('el aviso de "casi lleno" ya no está en el código', () => {
    // RNF-6 dice que ese texto **desaparece**. No que se deshabilite en un caso: no
    // queda.
    //
    // Por qué desaparece: el texto decía *"El almacenamiento del navegador está casi
    // lleno"* y mostraba un **umbral del 95 %**. Ese muro era el de `localStorage`,
    // 5 MB. El almacén nuevo separa cada dato, y lo que puede fallar ya no es "no
    // entra": es una cuota del navegador, un disco lleno, una pestaña bloqueada o un
    // permiso. Ninguno de esos es "casi lleno", y todos son cosas distintas entre sí.
    assert.equal(
        avisos().mensajeAlmacenamientoLleno, undefined,
        'el aviso de "casi lleno" sigue en la API. Con este almacén no hay tope de '
        + '5 MB, así que el texto afirma un muro que no existe'
    );
});

test('ningún texto que el usuario lea dice "lleno" ni "liberar espacio"', () => {
    // La red del criterio, sobre el texto **real** que arma la función viva.
    //
    // No es que el texto no pueda *describirse*: es que **no sabe** la causa. Si el
    // motivo real fue un disco lleno, un permiso o una pestaña bloqueada, decir "el
    // almacenamiento está lleno" manda al usuario a buscar un problema que puede no
    // tener, y a hacer una exportación que no arregla nada.
    const texto = avisos().mensajeFalloAlGuardar();

    for (const palabra of ['lleno', 'liberar espacio', 'casi lleno', 'umbral']) {
        assert.ok(
            !new RegExp(palabra, 'i').test(texto),
            `el aviso dice "${palabra}" y no puede saberlo:\n${texto}`
        );
    }
});

test('ningún texto que el usuario lea muestra un porcentaje', () => {
    // Antes salía "casi lleno (0 % de 95 %)". El 0 % era **real y correcto** —el uso
    // previo estaba bajo—, y aun así era una contrasentido al lado de "casi lleno": un
    // número que no describe lo que está pasando hace dudar de si la app está mal.
    //
    // Con el almacén nuevo no hay medición que mostrar, así que **no puede haber
    // porcentaje**. Si volviera, tendría que ser un número que corresponda.
    const texto = avisos().mensajeFalloAlGuardar();

    assert.doesNotMatch(texto, /\d+\s*%/,
        `el aviso muestra un porcentaje de algo que no midió:\n${texto}`);
});

// ---------- Los avisos de guardar siguen siendo alert(); el cartel, solo de lectura ----------

test('un fallo al guardar avisa con alert(), no con el cartel de arriba', async () => {
    // Decisión del usuario el 2026-10-05, y está anotada en `task.md` de la spec 008.
    //
    // Un fallo al guardar es **lo que el usuario acaba de hacer**, y entra en juego lo
    // que hizo: puede exportar, puede volver a intentar, puede entender que el
    // documento grande no entró. Por eso tiene que interrumpir.
    //
    // Migrar esto al cartel rompería el uso diario: un cartel arriba se pasa por alto
    // con el scroll, y un guardado que falló se sigue creyendo guardado.
    const { contexto, alertas } = await appSinPoderEscribir('sin-espacio');

    await contexto.CuadernoVirtual.guardarDatos();

    assert.equal(alertas.length, 1,
        'un fallo al guardar no abrió ningún alert(): el usuario no se entera de que '
        + 'lo que intentó guardar no está guardado');

    const aviso = contexto.document.getElementById('avisoDatos');

    // `notEqual`, no `equal`: el DOM del arnés **solo tiene `hidden` una vez que se
    // lo usó alguien**. Un cartel que nunca se mostró da `undefined`, y compararlo con
    // `true` daría una roja que no describe el defecto.
    assert.notEqual(aviso && aviso.hidden, false,
        'el fallo al guardar se escribió en el cartel de arriba, y ahí no interrumpe');
});

test('una lectura imposible avisa con el cartel de arriba, no con alert()', async () => {
    // El otro lado de la regla, y el motivo por el que la regla existe.
    //
    // Un dato raro **no fue pedido por el usuario**: la app lo encontró al arrancar. Un
    // `alert()` por eso saldría en cada arranque, y el usuario terminaría cerrando la
    // app sin abrirla. El cartel se ve una vez, dice qué encontró, y deja trabajar.
    const carga = cargarComoNavegador({
        cuadernoVirtual: JSON.stringify([{ id: 'm1', nombre: 'M', documentos: [] }]),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: 'esto no es un JSON'
    });

    const alertas = [];
    carga.contexto.alert = (texto) => { alertas.push(texto); };

    await carga.inicio;

    assert.equal(alertas.length, 0,
        `salieron ${alertas.length} alertas por un dato raro del arranque. `
        + 'Aparecerían en cada arranque, y el usuario dejaría de abrir la app');

    const aviso = carga.contexto.document.getElementById('avisoDatos');

    assert.ok(aviso && aviso.hidden === false,
        'el dato raro no salió en el cartel de arriba: el usuario abre la app, ve un '
        + 'calendario vacío y no tiene por qué saber que antes había algo');
});

// ---------- El camino donde no se sabe: no hay número ----------

test('el aviso de fallo al escribir no dice un porcentaje', () => {
    // Este es el que estaba mal. Cuando el navegador tira, no sabemos cuánto
    // había: el cálculo se hizo antes de escribir y no falló. Decir "0 % de
    // 95 %" es inventar una precisión que no existe.
    const texto = avisos().mensajeFalloAlGuardar();

    assert.ok(!/\d+\s*%/.test(texto),
        'el aviso de fallo no puede mostrar un porcentaje, porque no lo hay:\n'
        + texto);

    assert.ok(!/de \d+/.test(texto),
        'tampoco puede decir "de 95 %": el umbral no explica un fallo del navegador:\n'
        + texto);
});

test('el aviso de fallo dice que el navegador no dejó guardar', () => {
    const texto = avisos().mensajeFalloAlGuardar();

    assert.match(texto, /no dejó guardar|no se pudo guardar/i,
        'tiene que decir **qué** pasó, no insinuar que el espacio está lleno:\n'
        + texto);
});

test('el aviso de fallo aclara que no se perdió nada', () => {
    // La regla de RF-11 es "nunca se pierde nada en silencio". Un aviso que
    // asusta sin aclarar nada hace creer al usuario que perdió trabajo.
    const texto = avisos().mensajeFalloAlGuardar();

    assert.match(texto, /no se perdió|nada se perdió|quedó como estaba/i,
        'el aviso tiene que aclarar que lo que ya estaba sigue ahí:\n' + texto);
});

// ---------- Lo que se borró y por qué no se reemplaza (T10) ----------
//
// Estos cinco tests vivían acá y probaban cosas que **ya no existen**:
// `mensajeAlmacenamientoLleno()`, sus dos motivos —"se pasó el umbral" y "la operación no
// entra"—, y sus porcentajes.
//
// No se reescribieron apuntando a otro lado: **se borraron**, porque las propiedades que
// comprobaban eran de un almacén que ya no está. Y lo que las reemplazaba no es una
// versión reescrita de lo mismo: es que **el muro no existe**, así que no hay nada que
// distinguir.
//
// Lo que sí quedó, y es lo que hay que mirar si alguien agrega un texto nuevo de guardado:
//
//  - *"el aviso de 'casi lleno' ya no está en el código"* — que la función no vuelva.
//  - *"ningún texto que el usuario lea dice 'lleno' ni 'liberar espacio'"* — que ningún
//    texto afirme una causa que no se conoce.
//  - *"ningún texto que el usuario lea muestra un porcentaje"* — que no haya números que
//    describan otra situación.
//
// Los tres son la red. Esta nota es para que no se lea "borré cinco tests" y se piense que
// era una pérdida.

// ---------- Los caminos que fallan, contra el almacén nuevo ----------
//
// Los seis tests que estaban acá rompían `localStorage.setItem`. Con los datos en el
// almacén del navegador **eso no hace que `guardarDatos()` falle**: rompían un lugar
// donde la aplicación ya no escribe, así que pasaban por probarlo sin probarlo.
//
// Ahora rompen **`indexedDB`**, que es donde se escribe de verdad.
//
// **Y las preguntas cambiaron.** Antes preguntaban "el camino no dice que se pasó el
// umbral", porque había un umbral del 95 %. **Ya no hay umbral**: este almacén no tiene
// el tope de 5 MB. La pregunta honesta es más fuerte: **el aviso no puede inventar
// ninguna causa**, porque no sabe cuál fue.

/** Carga la app con el almacén ya migrado y con las escrituras rotas. */
async function appSinPoderEscribir(modo) {
    const almacen = crearIndexedDB('bien');
    const datos = {
        cuadernoVirtual: JSON.stringify([{ id: 'm1', nombre: 'Matemáticas', documentos: [] }]),
        pomodoroSesiones: '[]',
        mapaCalorSecciones: '[]',
        calendarioAnotaciones: '{}'
    };

    const primera = cargarComoNavegador(datos, { indexedDB: almacen });
    await primera.inicio;

    almacen.modo = modo;

    const segunda = cargarComoNavegador(datos, { indexedDB: almacen });
    await segunda.inicio;

    const alertas = [];
    segunda.contexto.alert = (texto) => { alertas.push(texto); };

    return { contexto: segunda.contexto, alertas, almacen };
}

test('sin espacio, el aviso NO dice que se pasó un umbral', async () => {
    // El defecto original, textual: el camino que no sabe el motivo terminaba
    // diciendo "se pasó el umbral crítico". Hoy no hay umbral, y el aviso tiene que
    // seguir sin afirmar ninguna causa.
    const { contexto, alertas } = await appSinPoderEscribir('sin-espacio');

    assert.equal(await contexto.CuadernoVirtual.guardarDatos(), false);
    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
    assert.doesNotMatch(alertas[0], /umbral/i,
        'el aviso afirma un umbral. Este almacén no tiene tope de 5 MB:\n' + alertas[0]);
});

test('sin espacio, el aviso NO nombra el almacenamiento del navegador como lleno', async () => {
    // La causa real puede ser la cuota, un disco lleno, una pestaña bloqueada o un
    // permiso. El aviso **no sabe** cuál. Decir "el almacenamiento está lleno" es
    // inventar una causa, y manda al usuario a buscar un problema que puede no tener.
    const { contexto, alertas } = await appSinPoderEscribir('sin-espacio');

    await contexto.CuadernoVirtual.guardarDatos();

    const texto = alertas[0] || '';

    assert.doesNotMatch(texto, /casi lleno|está lleno|liberar espacio/i,
        'el aviso nombra un muro que este almacén no tiene:\n' + texto);
});

test('sin espacio, el aviso NO muestra ningún porcentaje', async () => {
    // El número que se veía antes ("casi lleno, 0 % de 95 %") describía el estado
    // **previo** a la escritura, no el fallo. Con este almacén no hay medición que
    // mostrar, así que no puede haber porcentaje.
    const { contexto, alertas } = await appSinPoderEscribir('sin-espacio');

    await contexto.CuadernoVirtual.guardarDatos();

    assert.doesNotMatch(alertas[0], /\d+\s*%/,
        'el aviso muestra un porcentaje de algo que no midió:\n' + alertas[0]);
});

test('si la transacción se corta, el aviso tampoco nombra una causa', async () => {
    // El otro modo de fallo, y la misma regla: un corte no es una cuota.
    const { contexto, alertas } = await appSinPoderEscribir('abortar');

    await contexto.CuadernoVirtual.guardarDatos();

    assert.equal(alertas.length, 1, 'tiene que avisar una vez');
    assert.doesNotMatch(alertas[0], /umbral|casi lleno|liberar espacio/i,
        'una transacción cortada no es un muro lleno:\n' + alertas[0]);
});

test('si la escritura falla, el aviso dice que no se perdió nada', async () => {
    // Lo único que el usuario tiene que leer para no entrar en pánico. Y es la
    // razón por la que la mitad de la garantía —revertir— importa.
    const { contexto, alertas } = await appSinPoderEscribir('sin-espacio');

    await contexto.CuadernoVirtual.guardarDatos();

    assert.match(alertas[0], /no se perdió nada|quedó como estaba/i,
        'el aviso tiene que decir que nada se perdió:\n' + alertas[0]);
});

// ---------- El aviso se muestra una sola vez ----------

// Va por el camino real —`guardarDatos()` con la escritura rota— y no por los
// constructores de texto, porque la bandera que hace que el aviso salga una vez vive
// en la función que **avisa**, no en la que arma el texto.

test('con la escritura rota, el aviso sale una sola vez', async () => {
    // La bandera `avisoMostrado`. Sin ella, cada operación abre un `alert()` y el
    // usuario no puede seguir usando la app: tiene que apretar "Aceptar" cinco veces
    // para volver al trabajo.
    const { contexto, alertas } = await appSinPoderEscribir('sin-espacio');

    for (let i = 0; i < 5; i++) {
        await contexto.CuadernoVirtual.guardarDatos();
    }

    assert.equal(alertas.length, 1,
        `salieron ${alertas.length} avisos en cinco intentos. `
        + 'Alerta en cada operación, el usuario no puede seguir usando la app.');
});

test('ningún texto que el usuario lea menciona un plazo', () => {
    // La otra mitad del criterio de RNF-6, y la que no tenía cobertura.
    //
    // La app tiene dos plazos internos —el de escritura y el del latido— y los dos son
    // **decisiones de implementación**, no cosas que el usuario pueda actuar. Si un texto
    // dijera "se guardará en 5 segundos", el usuario contaría con algo que no es una
    // promesa: el plazo es un tope para que la app no se quede esperando, y si se
    // superara, lo que hay que hacer es exportar, no esperar.
    //
    // ## Qué mira y qué no
    //
    // Mira **cómo se escribiría un plazo en castellano** —"N segundos", "N milisegundos"—,
    // que es la forma en que se colaría de verdad.
    //
    // La primera versión buscaba además los números crudos (`5000`, `30000`, `30 * 1000`)
    // y dio un **falso positivo**: `30 * 1000` no es un texto, es la expresión de la
    // constante, y el regex la encontró igual. Buscar dígitos sueltos en el código fuente
    // mide el código, no lo que el usuario lee.
    //
    // Y no mira los textos ya armados: eso lo hacen los tests de arriba, sobre lo que las
    // funciones devuelven hoy. Este cubre lo que esos no alcanzan —un texto **nuevo** que
    // se escriba mañana con un plazo adentro—.
    const fs = require('node:fs');
    const path = require('node:path');

    const codigo = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

    // ## Los comentarios se sacan antes de mirar
    //
    // La primera versión escaneaba el archivo entero y falló por sus **propios
    // comentarios**: la documentación de `latidoDeEstudio()` dice "corre cada 30 segundos",
    // y eso no lo lee nadie. Un escaneo de fuente que incluye los comentarios no mide lo
    // que el usuario ve: mide a quien escribió la documentación.
    //
    // Es una aproximación: si someday un texto tuviera un `//` adentro, se comería el
    // resto de la línea. Para buscar "N segundos" no importa, y queda dicho acá.
    const soloCodigo = codigo
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

    const plazos = [/\d+\s*segundos?\b/i, /\d+\s*milisegundos?\b/i, /\d+\s*ms\b/i];

    for (const plazo of plazos) {
        assert.doesNotMatch(soloCodigo, plazo,
            'un texto de la aplicación menciona un plazo. Un plazo es una decisión de la '
            + 'app, no una promesa que el usuario pueda usar');
    }
});

// ---------- Lo que tienen que decir todos ----------

test('los avisos ofrecen exportar', async () => {
    // Sin una salida concreta el usuario no sabe qué hacer.
    for (const [nombre, texto] of Object.entries(losTextos())) {
        assert.match(texto, /export/i, `al aviso de ${nombre} le falta la salida:\n` + texto);
    }
});

test('los avisos dicen que no se va a guardar nada nuevo', async () => {
    // Es lo que le importa al usuario: la app va a seguir funcionando, pero no
    // va a aceptar nada nuevo.
    for (const [nombre, texto] of Object.entries(losTextos())) {
        assert.match(texto, /no se guardar|no se guardará|nada nuevo/i,
            `el aviso de ${nombre} tiene que decir que no se va a guardar nada nuevo:\n`
            + texto);
    }
});

test('ningún aviso dice que lo que se intentó sí se guardó', async () => {
    // La gente lee los avisos rápido y se queda con la primera frase. Si el
    // texto dice "se guardó", el usuario cree que lo que subió está a salvo.
    for (const [nombre, texto] of Object.entries(losTextos())) {
        assert.ok(!/se guardó|guardado con éxito/i.test(texto),
            `el aviso de ${nombre} no puede decir que se guardó:\n` + texto);
    }
});

// `LLENO` y `MATERIA` ya no se usan: sembrar casi 5 MB en `localStorage` era la
// forma de provocar el rechazo por espacio **cuando ese era el tope**. Con el
// almacén nuevo no hay tope, y el rechazo se provoca con `crearIndexedDB('sin-espacio')`.

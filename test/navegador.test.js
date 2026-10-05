// ============================================
// TESTS — La app carga y funciona en el navegador
// Ejecutar: node --test
// ============================================
//
// Por qué existe este archivo: los tests de la lógica pura corren cada
// módulo aislado, así que NO detectan si un archivo llama a una función
// que quedó escondida dentro del IIFE de otro.
//
// Ya pasó: al envolver js/app.js en un IIFE, minutosDeEstudioPorDia()
// dejó de ser global, js/inicio-calendario.js siguió llamándola y el mapa
// de calor quedó en blanco. Los 96 tests daban verde mientras tanto.
//
// Estos tests reproducen la carga del navegador de verdad: sin require,
// sin module, con window como ámbito global compartido.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');

// El navegador falso vive en 	est/dom-falso.js, no acá.
//
// Estuvo dentro de este archivo hasta T3 de la especificación 006, cuando hizo
// falta un segundo test de `app.js` y no había forma de llegar a este arnés:
// `test/dom-falso.js` no existía. Copiarlo era la salida fácil y era la mala —
// dos DOM falsos se desincronizan, y el que se queda viejo es el que nadie
// recuerda actualizar.
const {
    cargarComoNavegador,
    romper,
    ORDEN,
    RAIZ: RAIZ_DEL_HARNES
} = require('./dom-falso.js');

// ---------- Carga ----------

// El nombre sale de la lista, no de un número escrito a mano: si alguien agrega
// un script a `index.html` y lo agrega a `ORDEN`, el nombre se actualiza solo.
test(`navegador · los ${ORDEN.length} scripts cargan sin errores`, () => {
    const { errores } = cargarComoNavegador();
    assert.deepEqual(
        errores.map(e => `${e.archivo}: ${e.mensaje}`),
        []
    );
});

// ---------- RF-6 · Los números de los controles no mientan ----------

test('navegador · la lista de scripts coincide con index.html', () => {
    // Este es el guard de verdad. Si `ORDEN` y `index.html` se corresponden,
    // el nombre del test —que se arma con `ORDEN.length`— no puede mentir.
    const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    const enHtml = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);

    assert.equal(
        enHtml.length, ORDEN.length,
        `index.html carga ${enHtml.length} scripts y la lista del test tiene ${ORDEN.length}. `
        + 'Alguien agregó o sacó un script de una de las dos.'
    );

    for (let i = 0; i < ORDEN.length; i++) {
        assert.equal(
            ORDEN[i], enHtml[i],
            `en la posición ${i}: el test carga "${ORDEN[i]}" y index.html carga "${enHtml[i]}". `
            + 'El orden importa: los módulos tienen que estar antes de app.js.'
        );
    }
});

test('navegador · el nombre del test dice el número que carga', () => {
    // El nombre se arma con `ORDEN.length`, así que no puede desincronizarse.
    // Este test solo avisa si alguien lo cambia a mano.
    const codigo = fs.readFileSync(path.join(__dirname, 'navegador.test.js'), 'utf8');

    const conNumeroFijo = codigo.match(/test\('navegador · los \d+ scripts cargan/);

    assert.equal(
        conNumeroFijo, null,
        conNumeroFijo
            ? 'el nombre del test tiene un número fijo: ' + conNumeroFijo[0] + '. '
              + 'Tiene que salir de ORDEN.length para que no pueda desincronizarse.'
            : ''
    );
});

test('navegador · no queda un número viejo escrito en un comentario', () => {
    // Salió un número fijo en un comentario cuando la lista ya tenía trece. Un
    // número en un comentario no se actualiza solo y hace creer que la lista es
    // más corta de lo que es.
    //
    // Ojo: este test busca el mismo patrón que busca. Si escribiera el ejemplo
    // con su número, se detectaría a sí mismo y fallaría siempre. Por eso la
    // búsqueda va sobre las líneas que NO son de esta función.
    const codigo = fs.readFileSync(path.join(__dirname, 'navegador.test.js'), 'utf8');
    const patron = new RegExp('los ' + '\\d+' + ' scripts', 'gi');
    const comentarios = codigo
        .split('\n')
        .filter(line => line.trim().startsWith('//') || line.trim().startsWith('*'))
        .filter(line => !/salió un número fijo|busca el mismo patrón|que busca\. Por eso/.test(line))
        .join('\n');

    const numeros = comentarios.match(/los (\d+) scripts/gi) || [];

    assert.deepEqual(
        numeros, [],
        `quedan números fijos en comentarios: ${numeros.join(', ')}. `
        + 'Que digan "los scripts", sin número.'
    );
});

// Los globales que este archivo vigila. Está **escrito acá y no derivado**, y
// por eso necesita el test de al lado: una lista escrita a mano se queda vieja
// sola.
const GLOBALES_VIGILADOS = [
    'MapaCalorLogica', 'AlmacenamientoLogica',
    'ConsentimientoLogica', 'SeccionesDatos',
    'MapaCalorInterfaz', 'LayoutLogica', 'VisibilidadInterfaz',
    'VisorInterfaz', 'FechasLogica', 'AnotacionesLogica',
    'CalendarioLogica',
    'EstadisticasLogica', 'ArbolLogica', 'DatosLogica', 'AvisoInterfaz',
    // estaba exercising en otros tests —que leen `contexto.CuadernoVirtual`— pero
    // nunca estuvo anotado acá. Lo que un test hace y lo que una lista vigila no
    // es lo mismo.
    'CuadernoVirtual'
];

test('navegador · cada script publica su global', () => {
    const { contexto } = cargarComoNavegador();
    for (const nombre of GLOBALES_VIGILADOS) {
        assert.ok(contexto[nombre], `falta el global ${nombre}`);
    }
});

test('navegador · ningún script publica un global que no esté en la lista', () => {
    // El test de arriba mira los globales que están escritos en la lista. Si un
    // módulo nuevo publica `window.CosaLogica` y nadie lo agrega a la lista, el
    // test de arriba **pasa igual**: no sabe que ese global existe.
    //
    // El hueco no es que falte un global, es que sobre uno. Este test lo cierra
    // al revés: lee del código qué globales publica cada archivo, y exige que
    // todos estén vigilados.
    //
    // Se lee del **código**, no del contexto, porque en el contexto también hay
    // `CuadernoVirtual`, `window`, `document` y el resto de lo que da el
    // navegador. Lo que se busca es la línea que publica el módulo: la forma
    // del patrón de exportación doble que usa todo el proyecto.
    const publicados = [];

    for (const relativo of ORDEN) {
        const codigo = fs.readFileSync(path.join(RAIZ, relativo), 'utf8');
        for (const encontrado of codigo.matchAll(/window\.(\w+)\s*=\s*API\b/g)) {
            publicados.push({ archivo: relativo, global: encontrado[1] });
        }
    }

    const sinVigilar = publicados.filter(p => !GLOBALES_VIGILADOS.includes(p.global));

    assert.deepEqual(
        sinVigilar.map(p => `${p.archivo} publica ${p.global}`),
        [],
        'hay globales que publica el código y que ningún test mira. Agregalos a '
        + 'GLOBALES_VIGILADOS o sacales el patrón de exportación doble.'
    );
});

// ---------- El bug: funciones que quedaron escondidas en el IIFE ----------

test('navegador · inicio-calendario puede leer los minutos por día', () => {
    // Esta es la regresión: minutosDeEstudioPorDia() quedó dentro del
    // IIFE de app.js, así que inicio-calendario.js la veía como
    // indefinida y el mapa salía en blanco.
    const { contexto } = cargarComoNavegador();

    const existe = typeof contexto.CuadernoVirtual?.minutosDeEstudioPorDia;
    assert.equal(
        existe, 'function',
        'app.js debe publicar minutosDeEstudioPorDia en window.CuadernoVirtual, '
        + 'porque inicio-calendario.js la necesita y no puede verla dentro del IIFE'
    );
});

// ---------- RF-3 · El almacenamiento roto no puede cortar la app ----------
//
// Estos tests van acá, y no en un archivo aparte, porque el arnés que simula el
// navegador ya está en este archivo. Y porque esta clase de defecto —una
// excepción que sale de la app en el camino real— es exactamente la que
// `navegador.test.js` existe para cazar.
//
// Contexto: `guardarDatos()` tenía `LogicaCapacidad.debeRevertir(error)`, y ese
// identificador no existe en ninguna parte del proyecto. Cuando `setItem` fallaba
// —por cuota, por ejemplo— esa línea tiraba `ReferenceError` y la excepción salía
// de `guardarDatos()`, cortando a quien la había llamado.
//
// Lo que pasaba en la app: al borrar una materia, la materia se quitaba de la
// memoria, `guardarDatos()` tiraba, `construirArbol()` nunca corría. El nodo se
// quedaba en pantalla y el menú mostraba algo que ya no estaba guardado.

const MATERIAS_SEMBRADAS = JSON.stringify([
    { id: 'm1', nombre: 'Matemáticas', documentos: [] }
]);

/** Carga la app con datos y devuelve el contexto listo para romper el almacenamiento. */
function appConDatos() {
    return cargarComoNavegador({ cuadernoVirtual: MATERIAS_SEMBRADAS }).contexto;
}

/** Hace que un método del almacenamiento falle, y lo devuelve para restaurarlo. */

test('navegador · guardarDatos está en la API para poder probarla', () => {
    // Sin esto los tests de abajo no podrían ni intentarlo. Se publica por el
    // mismo motivo que minutosDeEstudioPorDia: una función que hay que poder
    // verificar tiene que ser alcanzable desde afuera del IIFE.
    const contexto = appConDatos();
    assert.equal(
        typeof contexto.CuadernoVirtual?.guardarDatos, 'function',
        'app.js debe publicar guardarDatos en window.CuadernoVirtual para que se '
        + 'pueda probar con el almacenamiento roto'
    );
});

test('navegador · si falla setItem, guardarDatos no lanza', () => {
    const contexto = appConDatos();
    const restaurar = romper(contexto, 'setItem', 'cuota excedida');

    let resultado;
    try {
        assert.doesNotThrow(() => { resultado = contexto.CuadernoVirtual.guardarDatos(); },
            'una excepción dentro del catch no puede salir de guardarDatos');
    } finally {
        restaurar();
    }

    assert.equal(resultado, false, 'y tiene que avisar que no pudo guardar');
});

test('navegador · si falla setItem, los datos anteriores siguen intactos', () => {
    const contexto = appConDatos();
    const restaurar = romper(contexto, 'setItem', 'cuota excedida');

    try {
        contexto.CuadernoVirtual.guardarDatos();
    } finally {
        restaurar();
    }

    assert.equal(
        contexto.localStorage.getItem('cuadernoVirtual'),
        MATERIAS_SEMBRADAS,
        'los datos que ya estaban tienen que seguir ahí, byte por byte'
    );
});

test('navegador · si falla setItem y no había datos, no queda nada a medias', () => {
    // Distinto del anterior: sin datos previos, el camino de reversión es
    // removeItem, no setItem. Los dos tienen que funcionar.
    const contexto = appConDatos();
    contexto.localStorage.removeItem('cuadernoVirtual');

    const restaurar = romper(contexto, 'setItem', 'cuota excedida');
    try {
        contexto.CuadernoVirtual.guardarDatos();
    } finally {
        restaurar();
    }

    assert.equal(contexto.localStorage.getItem('cuadernoVirtual'), null,
        'no puede quedar un escritura a medias');
});

test('navegador · si falla getItem, no se escribe nada', () => {
    // `getItem` para hacer la copia de seguridad está FUERA del try hoy.
    // Algunos navegadores en modo privado lanzan al leer.
    //
    // Lo importante no es solo que no lance: es que NO ESCRIBA. Parece lo
    // contrario —"si no sé qué había, escribo igual"— pero el camino de
    // reversión usa `null` para significar "no había datos". Confundir "no
    // había" con "no pude leer" haría que un fallo de escritura **borrara** lo
    // que el usuario tenía. No escribir nunca es menos malo.
    const contexto = appConDatos();
    const restaurar = romper(contexto, 'getItem', 'lectura bloqueada');

    let resultado;
    try {
        assert.doesNotThrow(() => { resultado = contexto.CuadernoVirtual.guardarDatos(); },
            'leer el almacenamiento anterior no puede romper el guardado');
    } finally {
        restaurar();
    }

    assert.equal(resultado, false, 'tiene que decir que no pudo guardar');
    assert.equal(
        contexto.localStorage.getItem('cuadernoVirtual'),
        MATERIAS_SEMBRADAS,
        'sin copia del anterior no se puede revertir con seguridad, así que no se escribe'
    );
});

test('navegador · si falla la reversión, guardarDatos no lanza igual', () => {
    // El peor caso: no se puede escribir ni para guardar ni para volver atrás.
    const contexto = appConDatos();
    const restaurarSet = romper(contexto, 'setItem', 'no se puede escribir');

    try {
        assert.doesNotThrow(
            () => contexto.CuadernoVirtual.guardarDatos(),
            'cuando no se puede ni escribir ni revertir, guardarDatos tiene que '
            + 'devolver false y seguir'
        );
    } finally {
        restaurarSet();
    }
});

test('navegador · con el almacenamiento sano, guardarDatos no cambia nada', () => {
    // El camino normal no puede haber sido roto por los arreglos anteriores.
    const contexto = appConDatos();

    assert.equal(contexto.CuadernoVirtual.guardarDatos(), true);

    const guardado = JSON.parse(contexto.localStorage.getItem('cuadernoVirtual'));
    assert.equal(guardado.length, 1);
    assert.equal(guardado[0].nombre, 'Matemáticas');
});

test('navegador · guardarDatos aguanta que no haya datos guardados', () => {
    const contexto = appConDatos();
    contexto.localStorage.removeItem('cuadernoVirtual');

    assert.equal(contexto.CuadernoVirtual.guardarDatos(), true);
});

// ---------- RF-11 · Con el almacenamiento lleno no se escribe nada ----------

// `guardarDatos()` mide lo que ya ocupa el almacenamiento y, si la operación no
// entra, avisa y devuelve `false` **antes** de llamar a `setItem`. El bloqueo ya
// existe.
//
// Lo que faltaba era que los llamadores lo obedecieran: los cinco que cambian
// datos mutaban el arreglo y seguían dibujando, sin mirar el retorno. Con el
// almacenamiento lleno, una materia nueva o un archivo subido se veían en
// pantalla y no existían: desaparecían al recargar.

test('navegador · con el almacenamiento lleno no se escribe', () => {
    // Sembrar casi 5 MB hace que `guardarDatos()` mida que no entra.
    const enorme = 'x'.repeat(5 * 1024 * 1024);
    const { contexto } = cargarComoNavegador({
        cuadernoVirtual: MATERIAS_SEMBRADAS,
        loQueOcupaTodoElEspacio: enorme
    });

    const antes = contexto.localStorage.getItem('cuadernoVirtual');

    assert.equal(contexto.CuadernoVirtual.guardarDatos(), false,
        'tiene que decir que no pudo guardar');

    assert.equal(contexto.localStorage.getItem('cuadernoVirtual'), antes,
        'lo que estaba guardado no puede cambiar');
});

test('navegador · con el almacenamiento lleno, el cambio se deshace', () => {
    const { contexto } = cargarComoNavegador({
        cuadernoVirtual: MATERIAS_SEMBRADAS,
        loQueOcupaTodoElEspacio: 'x'.repeat(5 * 1024 * 1024)
    });

    const ok = contexto.CuadernoVirtual.guardarRevirtiendoSiFalla([
        { id: 'nueva', nombre: 'No deberia existir', documentos: [] }
    ]);

    assert.equal(ok, false);
    assert.equal(contexto.localStorage.getItem('cuadernoVirtual'), MATERIAS_SEMBRADAS);

    // Y con espacio otra vez, tampoco quedó en memoria
    contexto.localStorage.removeItem('loQueOcupaTodoElEspacio');
    contexto.CuadernoVirtual.guardarDatos();
    const guardado = JSON.parse(contexto.localStorage.getItem('cuadernoVirtual'));
    assert.deepEqual(guardado.map(m => m.nombre), ['Matemáticas']);
});

test('navegador · liberado el espacio, se puede volver a escribir', () => {
    const { contexto } = cargarComoNavegador({
        cuadernoVirtual: MATERIAS_SEMBRADAS,
        loQueOcupaTodoElEspacio: 'x'.repeat(5 * 1024 * 1024)
    });

    assert.equal(contexto.CuadernoVirtual.guardarDatos(), false, 'bloqueado');

    // El usuario exporta y libera espacio
    contexto.localStorage.removeItem('loQueOcupaTodoElEspacio');

    assert.equal(contexto.CuadernoVirtual.guardarDatos(), true,
        'con espacio libre tiene que volver a andar');
});

// ---------- Que los que cambian datos obedezcan el bloqueo ----------
//
// Estos son tests de fuente. El DOM falso de este archivo no ejecuta el
// manejador de un botón real, así que no se puede comprobar por comportamiento
// qué pasa después de un click. Lo que sí se puede fijar es que el código use
// la función que deshace el cambio, y no la que solo avisa.

const CODIGO_APP = fs.readFileSync(path.join(RAIZ, 'js', 'app.js'), 'utf8');

test('navegador · los que cambian datos usan la versión que deshace', () => {
    // Cuántas veces se llama a guardarDatos() "pelada", sin la protección.
    const desnudos = CODIGO_APP.match(/(?<![a-zA-Z0-9_])guardarDatos\(\)\s*;/g) || [];

    assert.equal(
        desnudos.length, 0,
        `quedan ${desnudos.length} llamadas a guardarDatos() que no miran el retorno. `
        + 'Toda llamada suelta puede dejar la pantalla mintiendo. Ver RF-11.'
    );
});

test('navegador · las que sí mudan datos van por guardarRevirtiendoSiFalla', () => {
    const usos = (CODIGO_APP.match(/guardarRevirtiendoSiFalla\(/g) || []).length;

    // Los cinco que cambian datos: crear materia, subir por botón, subir por
    // arrastre, renombrar, reordenar. Más los tres de T1.
    assert.ok(usos >= 8,
        `se usa ${usos} veces; se esperaba al menos 8 (cinco de T4 y tres de T1)`);
});
//
// Antes de esto: `eliminarMateria()` saca la materia del arreglo en memoria,
// llama a `guardarDatos()`, y **no mira el retorno**. Si el guardado falla, la
// pantalla se redibuja igual y muestra un borrado que no se guardó. Recargar la
// página lo trae de vuelta.
//
// O sea: la app le dice al usuario que borró algo, y no lo borró.
//
// Lo que se arregla: que el cambio en memoria se deshaga cuando el guardado
// falla, y avise.

test('navegador · guardarRevirtiendoSiFalla está en la API', () => {
    const contexto = appConDatos();
    assert.equal(
        typeof contexto.CuadernoVirtual?.guardarRevirtiendoSiFalla, 'function',
        'tiene que estar en la API para poder probar que deshace el cambio'
    );
});

test('navegador · si el guardado anda, el cambio se aplica y se guarda', () => {
    const contexto = appConDatos();

    const ok = contexto.CuadernoVirtual.guardarRevirtiendoSiFalla([
        { id: 'm9', nombre: 'Nueva', documentos: [] }
    ]);

    assert.equal(ok, true);
    const guardado = JSON.parse(contexto.localStorage.getItem('cuadernoVirtual'));
    assert.equal(guardado.length, 1);
    assert.equal(guardado[0].nombre, 'Nueva', 'el cambio nuevo es el que se guarda');
});

test('navegador · si el guardado falla, el cambio se deshace', () => {
    const contexto = appConDatos();
    const restaurar = romper(contexto, 'setItem', 'cuota excedida');

    let ok;
    try {
        ok = contexto.CuadernoVirtual.guardarRevirtiendoSiFalla([
            { id: 'm9', nombre: 'Esta no deberia quedar', documentos: [] }
        ]);
    } finally {
        restaurar();
    }

    assert.equal(ok, false, 'tiene que avisar que no pudo guardar');

    // Lo importante: lo que estaba antes tiene que volver a estar en memoria.
    // Se comprueba con un guardado que sí funciona.
    assert.equal(contexto.CuadernoVirtual.guardarDatos(), true);
    const guardado = JSON.parse(contexto.localStorage.getItem('cuadernoVirtual'));
    assert.deepEqual(
        guardado.map(m => m.nombre),
        ['Matemáticas'],
        'el cambio que no se pudo guardar no puede quedar en memoria'
    );
});

test('navegador · si el guardado falla dos veces, tampoco acumula cambios', () => {
    const contexto = appConDatos();
    const restaurar = romper(contexto, 'setItem', 'cuota excedida');

    try {
        contexto.CuadernoVirtual.guardarRevirtiendoSiFalla([{ id: 'x', nombre: 'A', documentos: [] }]);
        contexto.CuadernoVirtual.guardarRevirtiendoSiFalla([{ id: 'y', nombre: 'B', documentos: [] }]);
    } finally {
        restaurar();
    }

    contexto.CuadernoVirtual.guardarDatos();
    const guardado = JSON.parse(contexto.localStorage.getItem('cuadernoVirtual'));
    assert.deepEqual(guardado.map(m => m.nombre), ['Matemáticas']);
});

test('navegador · deshacer no borra la copia de seguridad del almacenamiento', () => {
    // Revertir es solo cambiar lo que hay en memoria. Lo que está guardado en
    // localStorage lo manejaba `guardarDatos()`, con su propia reversión.
    const contexto = appConDatos();
    const restaurar = romper(contexto, 'setItem', 'cuota excedida');

    try {
        contexto.CuadernoVirtual.guardarRevirtiendoSiFalla([]);
    } finally {
        restaurar();
    }

    assert.equal(contexto.localStorage.getItem('cuadernoVirtual'), MATERIAS_SEMBRADAS,
        'lo que estaba guardado tiene que seguir guardado');
});

test('navegador · pintarMapa no lanza al dibujarse', () => {
    const { contexto, errores } = cargarComoNavegador({
        mapaCalorSecciones: JSON.stringify([])
    });

    // Si minutosDeEstudioPorDia no existiera, esto tiraría
    // ReferenceError, que el contexto dejaría registrado.
    const resultado = vm.runInContext(
        '(function(){ try { window.MapaCalorInterfaz.pintarMapa({'
        + 'contenedor: document.createElement("div"),'
        + 'grilla: window.MapaCalorLogica.construirGrilla("01/10/2026", {})'
        + '}); return "ok"; } catch (e) { return e.message; } })()',
        contexto
    );

    assert.equal(resultado, 'ok');
    assert.deepEqual(errores, []);
});

test('navegador · el mapa se dibuja con 28 celdas para 4 semanas', () => {
    const { contexto } = cargarComoNavegador();

    const total = vm.runInContext(
        'window.MapaCalorLogica.construirGrilla("01/10/2026", {}).flat().length',
        contexto
    );

    assert.equal(total, 28);
});

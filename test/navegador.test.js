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
    'MapaCalorLogica',
    'ConsentimientoLogica', 'SeccionesDatos', 'AlmacenamientoDatos',
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

// ---------- RF-4 · Una lectura que no se puede interpretar no tumba la app ----------

test('navegador · unos minutos heredados que no son JSON no tumban la aplicación', () => {
    // **Este test fallaba antes de que nada se tocara**, y esa es la prueba de que
    // el defecto existe: `js/app.js` leía `pomodoroSesiones` con un `JSON.parse` en
    // **código de nivel superior**, sin `try`. Con un valor guardado que no es un
    // texto válido, el `JSON.parse` tiraba y **la página entera no abría**: sin
    // cartel, sin aviso, sin cuaderno.
    //
    // No es un dato que falta. Es la aplicación.
    const { errores } = cargarComoNavegador({ pomodoroSesiones: 'esto no es un JSON' });

    const delArranque = errores.filter(mensaje => /JSON|token|Unexpected/i.test(mensaje));

    assert.deepEqual(
        delArranque, [],
        'la aplicación no abrió porque una lectura sin proteger tiró:\n'
        + delArranque.join('\n')
    );
});

test('navegador · el cuaderno abre igual con unos minutos heredados rotos', () => {
    // Lo que tiene que pasar ahora: la app abre, avisa por el cartel de arriba, y
    // **no borra nada**. Borrar sería peor que no avisar: el usuario perdería su
    // historial sin enterarse.
    const { contexto } = cargarComoNavegador({ pomodoroSesiones: 'esto no es un JSON' });

    // Si la lectura hubiera tirado, la API no estaría publicada.
    assert.equal(
        typeof contexto.CuadernoVirtual?.minutosDeEstudioPorDia, 'function',
        'la app no llegó a publicarse: la lectura sin proteger cortó el arranque'
    );

    // Y no se perdió nada: la clave sigue ahí, con el mismo valor.
    assert.equal(
        contexto.localStorage.getItem('pomodoroSesiones'), 'esto no es un JSON',
        'la lectura borró lo que estaba guardado. Un dato roto se '
        + 'completa y se avisa; nunca se descarta.'
    );
});

// ---------- RF-3 · Si el almacén no abre, la aplicación no abre ----------

test('navegador · si el navegador no tiene el almacén, la aplicación no abre', async () => {
    // Un camino que no se recorre no está probado. Los caminos de fallo se
    // provocan a propósito: sin esto, "avisa cuando el almacenamiento falla" sería
    // una afirmación sin respaldo.
    const carga = cargarComoNavegador({}, { sinAlmacen: true });
    await carga.inicio;

    // No se dibuja el cuaderno: lo que se pinta es el texto de "no abre".
    const panel = carga.contexto.document.getElementById('visor') && carga.contexto.document.getElementById('visor').hijos.length > 0
        ? carga.contexto.document.getElementById('visor').hijos[0] : null;

    assert.ok(panel, 'con el almacén ausente no se dibujó nada');
    assert.equal(
        panel.className, 'almacenamiento-no-abre',
        'lo que se dibujó no es el panel de "no abre"'
    );
});

test('navegador · si el almacén no abre, la aplicación no abre', async () => {
    const carga = cargarComoNavegador({}, { almacen: 'no-abre' });
    await carga.inicio;

    const panel = carga.contexto.document.getElementById('visor') && carga.contexto.document.getElementById('visor').hijos.length > 0
        ? carga.contexto.document.getElementById('visor').hijos[0] : null;

    assert.ok(panel, 'con el almacén roto no se dibujó nada');
    assert.equal(panel.className, 'almacenamiento-no-abre');
});

test('navegador · el texto de "no abre" no tiene ni un número', async () => {
    // La misma regla que en el módulo: el plazo vive en el código. Un número
    // escrito en un mensaje se desincroniza solo y el usuario no lo puede cambiar.
    const carga = cargarComoNavegador({}, { sinAlmacen: true });
    await carga.inicio;

    const panel = carga.contexto.document.getElementById('visor').hijos[0];

    assert.ok(!/\d/.test(panel.textContent || ''),
        'el texto que ve el usuario tiene un número:\n' + panel.textContent);

    assert.match(panel.textContent || '', /No se borr/i,
        'el usuario tiene que leer que no perdió el cuaderno');
});

test('navegador · con el almacén ausente no se escribe nada', async () => {
    // Lo que RF-3 prohíbe: mostrar el cuaderno viejo y dejar guardar. Acá no hay
    // nada que guardar porque la app no abrió, y `guardarDatos()` lo dice.
    const carga = cargarComoNavegador({}, { sinAlmacen: true });
    await carga.inicio;

    assert.equal(
        await carga.contexto.CuadernoVirtual.guardarDatos(), false,
        'con la aplicación sin abrir, guardar tiene que rechazarse'
    );
});

test('navegador · el arranque se puede esperar y no tira', async () => {
    // El hueco que T3 cerró. `cargarComoNavegador()` solo juntaba errores
    // **síncronos** y su `console` no hacía nada: con el arranque asíncrono, un
    // rechazo se perdía y ningún test lo veía. Con la promesa publicada, el arnés
    // la espera y un fallo del arranque sale acá.
    const carga = cargarComoNavegador({});
    await assert.doesNotReject(carga.inicio, 'el arranque se rechazó');
});

test('navegador · el arranque publica su promesa en la API', async () => {
    // Sin esto, el arnés no puede esperar y el hueco del punto anterior vuelve.
    const { contexto } = cargarComoNavegador({});

    assert.equal(
        typeof contexto.CuadernoVirtual?.inicio?.then, 'function',
        'app.js debe publicar `inicio` en window.CuadernoVirtual, o el arnés no '
        + 'puede esperar al arranque y un fallo se pierde'
    );
});

// ---------- Las protecciones de escritura se fueron a otro archivo ----------
//
// Los tests que estaban acá rompían `localStorage.setItem` para comprobar que
// guardarDatos() no dejaba datos a medias. Con los datos en el almacén del
// navegador, **apuntaban a un lugar donde la aplicación ya no escribe**: pasaban
// en verde sin probar nada.
//
// Ahora están en `test/red-protecciones.test.js`, escritas contra `indexedDB`, y
// cada una con su comprobación. Ese archivo tiene además un test que cuenta que
// **sigan siendo cinco**: RNF-4 dice que la cuenta deja de ser el requisito, pero
// que falte una no puede pasar.
//
// Lo que **no** se fueron, y siguen Importantes: los dos tests de arriba que
// comprueban que los datos raros no tumban la aplicación, y los de que el
// almacén que no abre no deja escribir.

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

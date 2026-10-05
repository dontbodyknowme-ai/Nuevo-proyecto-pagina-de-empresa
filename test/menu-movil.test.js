// ============================================
// TESTS - El menú lateral en el teléfono
// Ejecutar: node --test
// Cubre: RF-1 de specs/004
// Ver: specs/004-app-funcional-y-limpeza/spec.md
// ============================================
//
// Por debajo de 640 px el menú lateral es un cajón: está en `left: 0` con
// `transform: translateX(-100%)`, o sea,**fuera de la pantalla**. La regla
// `.menu-lateral.visible` lo mete de vuelta. Esa regla estaba escrita en la
// hoja de estilos desde el principio y **nadie la usaba**: el botón solo
// alternaba `colapsado`, que en un cajón fuera de pantalla no cambia nada
// visible. El botón de la barra se quedaba en 316 px, o sea 60 px más a la
// izquierda de donde debía, sobre el contenido.
//
// Estos tests NO pueden probar el comportamiento: un archivo de Node no sabe
// de anchos ni de cascada. Lo que sí se puede comprobar es que la hoja
// declare las reglas necesarias, que el HTML traiga el elemento de respaldo, y
// que el código de JavaScript conecte las dos puntas. La prueba real, con el
// menú abriéndose y cerrándose, va en Chrome: eso es el segundo camino del
// Principio 4, y no es opcional.
//
// Igual que en T4 del calendario, donde el atributo `hidden` se aplicaba pero no
// ocultaba nada y ningún test de Node lo notó.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(
    path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');
const HTML = fs.readFileSync(
    path.join(__dirname, '..', 'index.html'), 'utf8');
const APP = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

// Extrae el texto de TODOS los bloques @media con esa condición, contando las
// llaves para no cortar en el primer } que haya adentro. Los devuelve pegados.
//
// Ojo: no sirve con `indexOf`, que devuelve la primera coincidencia y nada
// más. Hay dos bloques de `@media (max-width: 640px)` en la hoja: uno es del
// mapa de calor y otro el general. Con `indexOf` se agarraba el del mapa y los
// tests del menú fallaban por un motivo que no tenía nada que ver con el menú:
// el error decía "el menú tiene que salir de la pantalla" en un bloque que no
// mencionaba el menú.
//
// Un test que falla por el motivo equivocado es peor que uno que no existe:
// hace cambiar algo que no estaba roto.
function mediaDe(condicion) {
    const patron = '@media ' + condicion;
    const bloques = [];
    let desde = 0;

    while (true) {
        const inicio = CSS.indexOf(patron, desde);
        if (inicio === -1) break;

        let profundidad = 0;
        const apertura = CSS.indexOf('{', inicio);
        for (let i = apertura; i < CSS.length; i++) {
            if (CSS[i] === '{') profundidad++;
            if (CSS[i] === '}') {
                profundidad--;
                if (profundidad === 0) { bloques.push(CSS.slice(apertura, i + 1)); break; }
            }
        }
        desde = inicio + patron.length;
    }

    return bloques.join('\n');
}

// Lo mismo, para un bloque de función o de cualquier otra cosa.
function bloqueLlaves(texto, desde) {
    let profundidad = 0;
    const apertura = texto.indexOf('{', desde);
    if (apertura === -1) return null;

    for (let i = apertura; i < texto.length; i++) {
        if (texto[i] === '{') profundidad++;
        if (texto[i] === '}') {
            profundidad--;
            if (profundidad === 0) return texto.slice(apertura, i + 1);
        }
    }
    return null;
}

// La sección del menú, entre dos marcas de sección.
//
// Antes se recortaba de **un** archivo. Si la sección se muda, la función
// devolvía cadena vacía y los tests de abajo fallaban —que es mejor que pasar
// en silencio, pero tira hacia abajo por un motivo equivocado—. Con la lista, se
// busca en todos los archivos y se dice cuál se usó.

const DONDE_BUSCAR_MENU = [
    'js/app.js',
    'js/interfaz/menu.js'   // si algún día se mueve
];

function seccionMenu() {
    for (const relativo of DONDE_BUSCAR_MENU) {
        const completo = path.join(__dirname, '..', relativo);
        if (!fs.existsSync(completo)) continue;

        const codigo = fs.readFileSync(completo, 'utf8');
        const inicio = codigo.indexOf('// ===== Menú lateral =====');
        if (inicio === -1) continue;

        const fin = codigo.indexOf('// =====', inicio + 10);
        return codigo.slice(inicio, fin === -1 ? codigo.length : fin);
    }

    return '';
}

// Las funciones declaradas dentro de la sección del menú.
function funcionesDelMenu() {
    const seccion = seccionMenu();
    const bodies = [];
    const patron = /function\s+\w+\s*\(/g;
    let m;
    while ((m = patron.exec(seccion)) !== null) {
        const cuerpo = bloqueLlaves(seccion, m.index);
        if (cuerpo) bodies.push(cuerpo);
    }
    return bodies;
}

const ANGOSO = mediaDe('(max-width: 640px)');
const ANCHO = mediaDe('(max-width: 768px)');

// ---------- El defecto: el cajón no tenía puerta ----------

test('el menú lateral existe y es un cajón en pantallas angostas', () => {
    assert.match(HTML, /<aside[^>]*id="menuLateral"/,
        'index.html no tiene el <aside> del menú');

    assert.ok(ANGOSO, 'no hay bloque @media de 640 px');

    assert.match(ANGOSO, /\.menu-lateral\s*\{[^}]*transform:\s*translateX\(-100%\)/,
        'el menú tiene que salir de la pantalla en pantallas angostas');

    assert.match(ANGOSO, /\.menu-lateral\.visible\s*\{[^}]*transform:\s*translateX\(0\)/,
        'falta la regla que trae el menú de vuelta');
});

test('el mismo clic que pliega en anchas abre en angostas', () => {
    // La decisión clave de T3: un clic pone las DOS clases, y la hoja de
    // estilos dice qué significa cada una en cada ancho. El código no mide la
    // pantalla, porque medirla en JavaScript es justamente lo que la
    // constitución prohíbe.
    //
    // Si el mismo manejador no pusiera las dos, haría falta saber el ancho, y
    // saber el ancho en JavaScript es medir: prohibido.
    //
    // Se miran solo las llamadas que **cambian** una clase
    // (toggle/add/remove), no las que la leen (contains). Una función que solo
    // consulta si el menú está alternado tiene que poder leer una clase sin
    // poner la otra; lo que no puede pasar es que en un mismo lugar se ponga
    // una y no la otra, porque ahí el comportamiento pasa a depender del ancho.
    let revisoAlguna = false;

    for (const cuerpo of funcionesDelMenu()) {
        const muta = /classList\.(toggle|add|remove)\s*\(\s*'visible'/.test(cuerpo);
        if (!muta) continue;
        revisoAlguna = true;

        assert.match(
            cuerpo,
            /classList\.(toggle|add|remove)\s*\(\s*'colapsado'/,
            'una función pone "visible" pero no "colapsado". Ahí el resultado '
            + 'depende del ancho de la pantalla, y el código no lo sabe ni debe '
            + 'saberlo: tiene que poner las dos juntas.'
        );
    }

    assert.ok(revisoAlguna,
        'no se encontró ninguna función que ponga "visible". Sin eso el menú '
        + 'no tiene forma de abrirse en el teléfono.');

    // Y que la clase no se pueda cambiar por su cuenta en ninguna parte de la
    // sección del menú.
    const sueltas = seccionMenu().split('\n').filter(linea =>
        /classList\.(toggle|add|remove)\s*\(/.test(linea)
        && !/colapsado|visible/.test(linea));

    assert.deepEqual(
        sueltas.map(l => l.trim()), [],
        'hay llamadas que cambian clases sin tocar ni "visible" ni "colapsado". '
        + 'Si una de las dos se puede cambiar sola, el comportamiento pasa a '
        + 'depender del ancho.'
    );
});

test('el código del menú no mide la pantalla', () => {
    // La regla de la constitución: la geometría se resuelve en la hoja de
    // estilos. app.js sí mide en un lugar —el visor de PDF, que dibuja en un
    // canvas—, pero no puede medir para decidir si el menú está abierto.
    const seccion = seccionMenu();

    assert.ok(seccion.length > 0,
        'no se encontró la sección "// ===== Menú lateral =====" en app.js. '
        + 'Si se movió, este test hay que actualizarlo: no puede pasar en silencio.');

    const mide = /innerWidth|clientWidth|offsetWidth|matchMedia|getBoundingClientRect/
        .test(seccion);

    assert.equal(mide, false,
        'la sección del menú lee medidas de la pantalla. El ancho lo decide '
        + 'la hoja de estilos: un clic pone las dos clases y cada ancho las '
        + 'interpreta a su manera.');
});

// ---------- El respaldo: un elemento de verdad ----------

test('el respaldo del menú es un elemento, no un pseudo-elemento', () => {
    // Un ::before no sirve: no se le puede poner un manejador de clic, ni
    // recibe el foco, ni se lo puede ocultar con una regla de estado.
    const hayElemento = /<div[^>]*id="menuRespaldo"/.test(HTML);

    assert.ok(hayElemento,
        'index.html no tiene el elemento de respaldo del menú. Sin él no hay '
        + 'forma de cerrar el cajón tocando fuera.');

    assert.match(HTML, /id="menuRespaldo"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*id="menuRespaldo"/,
        'el respaldo es decorativo: es una zona de toque, no un control, y '
        + 'tiene que estar marcado como tal para los lectores de pantalla');

    const comoPseudo = /\.menu-respaldo::(before|after)/.test(CSS);
    assert.equal(comoPseudo, false,
        'el respaldo aparece como pseudo-elemento, que no admite manejadores');
});

test('el respaldo no molesta en pantallas anchas', () => {
    // Si el respaldo fuera visible en el escritorio, cada clic fuera del menú
    // cerraría el menú. Por eso tiene que estar apagado por defecto y solo
    // prenderse dentro del bloque de 640 px.
    const base = CSS.match(/^\.menu-respaldo\s*\{[^}]*\}/m);
    assert.ok(base, 'falta la regla base .menu-respaldo');

    assert.match(base[0], /display:\s*none/,
        '.menu-respaldo tiene que estar apagado por defecto; si no, tapa el '
        + 'escritorio entero');

    const enAnchos = ANCHO ? ANCHO.includes('.menu-respaldo') : false;
    assert.equal(enAnchos, false,
        'el respaldo se declara dentro del bloque de 768 px; solo corresponde '
        + 'al de 640 px');
});

test('el respaldo aparece con el menú abierto, y solo ahí', () => {
    // El test anterior comprueba que el respaldo **no** molesta en el
    // escritorio. Este comprueba lo otro: que aparezca cuando tiene que
    // aparecer. Sin los dos, un `display: none` perpetuo pasaría toda la
    // batería: el respaldo no molestaría en ningún lado, y tampoco se
    // cerraría el menú en ninguno.
    assert.match(
        ANGOSO,
        /\.menu-lateral\.visible\s*~\s*\.menu-respaldo\s*\{[^}]*display:\s*(block|flex)/,
        'con el menú abierto, el respaldo tiene que prenderse dentro del bloque '
        + 'angosto. Como el de arriba lo deja apagado siempre, esta es la única '
        + 'regla que lo enciende.'
    );

    // Y el respaldo tiene que estar detrás del menú, no encima: si no, el
    // menú no se puede tocar.
    const respaldo = ANGOSO.match(/\.menu-lateral\.visible\s*~\s*\.menu-respaldo\s*\{[^}]*\}/);
    const z = respaldo[0].match(/z-index:\s*(\d+)/);
    assert.ok(z, 'falta el z-index del respaldo');

    const zMenu = ANGOSO.match(/\.menu-lateral\s*\{[^}]*z-index:\s*(\d+)/);
    assert.ok(zMenu, 'falta el z-index del menú en el bloque angosto');

    assert.ok(Number(z[1]) < Number(zMenu[1]),
        `el respaldo tiene z-index ${z[1]} y el menú ${zMenu[1]}. Si son iguales, `
        + 'el respaldo tapa el menú y el menú deja de poder tocarse.');
});

test('el respaldo cubre la pantalla y se nota que está ahí', () => {
    // Un respaldo invisible al toque y sin color no cumple: el usuario no
    // sabe que puede cerrar tocando afuera.
    const regla = CSS.match(/^\.menu-respaldo\s*\{([^}]*)\}/m);
    assert.ok(regla, 'falta la regla base .menu-respaldo');

    assert.match(regla[1], /position:\s*(fixed|absolute)/,
        'el respaldo tiene que cubrir la pantalla, no ocupar el sitio del flujo');
    assert.match(regla[1], /background/,
        'el respaldo necesita un fondo: si es invisible, nadie adivina que '
        + 'tocando afuera se cierra');
});

// ---------- En angostas, "colapsado" no puede dejar el cajón vacío ----------

test('en pantallas angostas, colapsado no puede vaciar el cajón', () => {
    // Este es el detalle que hace que la cosa funcione. El mismo clic pone
    // "visible" y "colapsado". En una pantalla angosta, "colapsado" pone el
    // panel en 60 px y le baja la opacidad al contenido: el cajón entraría
    // vacío, con una franja de 60 px sin nada adentro.
    //
    // Medido antes de decidir el diseño: 60 px de ancho y opacidad 0.
    // Por eso, dentro del bloque angosto, hay que anular las dos cosas.
    assert.ok(ANGOSO, 'no hay bloque @media de 640 px');

    assert.match(
        ANGOSO,
        /\.menu-lateral\.colapsado\s*\{[^}]*width:\s*260px/,
        'dentro del bloque angosto, "colapsado" tiene que volver a poner el '
        + 'ancho completo. Sin esto, el cajón abre vacío.'
    );

    assert.match(
        ANGOSO,
        /\.menu-lateral\.colapsado\s+\.logo-texto[\s\S]*?\.menu-lateral\.colapsado\s+\.menu-footer\s*\{[^}]*opacity:\s*1/,
        'dentro del bloque angosto, "colapsado" tiene que devolver la opacidad '
        + 'del contenido. Sin esto, el cajón entra con el texto invisible.'
    );
});

test('el cajón cerrado no queda en el recorrido del tabulador', () => {
    // `transform: translateX(-100%)` saca el menú de la vista pero **no** lo
    // saca del recorrido del teclado ni del árbol de accesibilidad. Con el
    // cajón cerrado, el tabulador todavía entra al botón de "Añadir Materia" y
    // el lector de pantalla todavía lee el árbol entero.
    assert.match(
        ANGOSO,
        /\.menu-lateral\s*\{[^}]*visibility:\s*hidden/,
        'el cajón cerrado tiene que quedar con visibility: hidden; '
        + 'translateX(-100%) no lo saca del tabulador'
    );

    assert.match(
        ANGOSO,
        /\.menu-lateral\.visible\s*\{[^}]*visibility:\s*visible/,
        'el cajón abierto tiene que volver a ser visible'
    );
});

// ---------- Las tres formas de cerrar ----------

test('el menú se cierra con el botón, con el respaldo y con Escape', () => {
    // CP-2: tres salidas, porque en un teléfono un solo camino deja al usuario
    // encerrado.
    const seccion = seccionMenu();

    assert.match(seccion, /btnToggle\.addEventListener\(\s*'click'/,
        'el botón tiene que abrir y cerrar');

    assert.match(seccion, /menuRespaldo\.addEventListener\(\s*'click'/,
        'el respaldo tiene que cerrar');

    assert.match(seccion, /document\.addEventListener\(\s*'keydown'/,
        'falta el manejador de teclado para Escape');

    assert.match(seccion, /['"]Escape['"]/,
        'el manejador de teclado no escucha la tecla Escape');
});

test('al cerrar, el foco vuelve al botón', () => {
    // El teclado se maneja con el foco, no con la pantalla. Si al cerrar el
    // foco queda en un elemento que ya no está, el usuario queda perdido: el
    // tabulador arranca de nuevo desde el principio de la página.
    const seccion = seccionMenu();

    assert.match(seccion, /btnToggle\.focus\(\)/,
        'cerrar el menú tiene que devolver el foco al botón');
});

test('al abrir, el foco entra al menú', () => {
    // Al revés también: si el foco se queda en el botón, el tabulador sigue
    // recorriendo la página de fondo en vez de entrar al menú que acaba de
    // aparecer encima.
    const seccion = seccionMenu();

    assert.match(seccion, /menuLateral\.focus\(\)/,
        'abrir el menú tiene que llevar el foco adentro, no dejarlo atrás');
});

test('el botón se posiciona distinto según el ancho', () => {
    // El botón flotante vive en `left: 316px`, pensado para un menú de 300 px.
    // En un teléfono de 375 px eso lo deja encima del contenido, y con el
    // cajón abierto queda tapando el logo.
    assert.match(
        ANGOSO,
        /\.btn-toggle-flotante\s*\{[^}]*left:\s*16px/,
        'en pantallas angostas el botón tiene que ir al borde izquierdo, '
        + 'no a 316 px'
    );

    assert.match(
        ANGOSO,
        /\.menu-lateral\.visible\s*~\s*\.btn-toggle-flotante\s*\{[^}]*left:\s*auto[^}]*right:/,
        'con el cajón abierto el botón tiene que pasar al lado libre, '
        + 'si no tapa el logo del menú'
    );
});

test('al abrir, el foco puede entrar: la visibilidad no se demora', () => {
    // Este detalle salió de mirar Chrome, no de pensar el diseño.
    //
    // El menú cerrado tiene `visibility: hidden`, para que el tabulador no
    // entre. Al abrirlo, la clase `visible` pone `visibility: visible`. Si esa
    // propiedad estuviera en la transición **con duración**, durante los 350 ms
    // de la animación el valor animado seguiría siendo `hidden` —y un elemento
    // con visibility: hidden no puede recibir el foco—, así que
    // `menuLateral.focus()` no haría nada y el foco se quedaría en el botón.
    //
    // Se comprobó en Chrome: con `visibility` en la transición, después de
    // abrir el menú el foco seguía en `btnToggle`.
    //
    // El arreglo es el patrón conocido: la visibilidad cambia sin duración y
    // con retardo al cerrar, y sin retardo al abrir.
    const bloqueVisible = ANGOSO.match(/\.menu-lateral\.visible\s*\{([^}]*)\}/);
    assert.ok(bloqueVisible, 'falta el bloque .menu-lateral.visible');

    assert.match(bloqueVisible[1], /visibility:\s*visible/,
        'el menú abierto tiene que ser visible');

    assert.match(
        bloqueVisible[1],
        /visibility\s+0s\s+0s/,
        'al abrir, la visibilidad no puede tener retardo: mientras dure el '
        + 'retardo el menú sigue oculto y no puede recibir el foco. Tiene que '
        + 'ser "visibility 0s 0s".'
    );
});

test('tocar un ítem del menú lo cierra, sin romper el escritorio', () => {
    // Abajo de 640 px, porque el cajón tapa la pantalla y el usuario quiere ver
    // lo que tocó. Es la salida que se usa sola, sin pensar.
    //
    // Lo interesante es cómo NO se pregunta el ancho. En el escritorio el menú
    // solo se puede tocar cuando ya está desplegado —plegado, el contenido
    // tiene `pointer-events: none`—, y desplegado significa que las dos clases
    // están ausentes. Así que "cerrar" no tiene nada que cerrar y sale sin
    // hacer nada. La función se llama siempre y decide sola.
    const seccion = seccionMenu();

    assert.match(
        seccion,
        /menuLateral\.addEventListener\(\s*'click'/,
        'tocar un ítem del menú tiene que cerrar el menú'
    );

    assert.match(
        seccion,
        /menuLateral\.addEventListener\(\s*'click'[\s\S]{0,400}?cerrarMenu\(\)/,
        'el manejador de los ítems tiene que llamar a cerrarMenu'
    );

    assert.match(
        seccion,
        /nodo-materia[\s\S]{0,200}?nodo-doc/,
        'el manejador tiene que reconocer los nodos del árbol, no cerrarse con '
        + 'cualquier clic dentro del panel'
    );

    // Y `cerrarMenu` tiene que salir temprano si ya estaba cerrado. Si no,
    // en el escritorio cada clic en un documento movería el foco de golpe al
    // botón del menú: un salto visible en una acción que no lo pidió.
    const cuerpo = (() => {
        const i = seccion.indexOf('function cerrarMenu');
        return i === -1 ? '' : bloqueLlaves(seccion, i) || '';
    })();

    assert.ok(cuerpo, 'no se encontró la función cerrarMenu');
    assert.match(cuerpo, /if\s*\(\s*!\s*menuEstaAlternado\(\)\s*\)\s*return/,
        'cerrarMenu tiene que salir sin hacer nada si el menú ya estaba cerrado');
    assert.match(cuerpo, /btnToggle\.focus\(\)/,
        'cerrarMenu tiene que devolver el foco al botón');
});

test('el botón no dice una cosa y hace otra', () => {
    // El mismo clic pliega en el escritorio y abre en el teléfono. Un texto
    // que prometiera una sola de las dos cosas estaría mintiendo en la otra.
    // El `title` tiene que valer para los dos anchos, y el título del
    // documento dice por qué.
    const titulo = HTML.match(/id="btnToggle"[^>]*title="([^"]*)"/);

    assert.ok(titulo, 'el botón del menú no tiene title');

    const prometeUnaSolaCosa = /colapsar|plegar|abrir|expandir/i;
    assert.equal(prometeUnaSolaCosa.test(titulo[1]), false,
        `el title dice "${titulo[1]}", que solo es cierto en un ancho. `
        + 'Con el mismo clic, el texto tiene que valer para los dos.');
});

test('el botón se puede usar con el teclado', () => {
    // Si el manejador está en un `click` de un <button>, el teclado ya lo
    // dispara: el Enter y el Espacio mandan un click a un botón nativo. Lo que
    // no puede ser es un <div> con role, porque ahí el navegador no lo hace.
    const boton = HTML.match(/<button[^>]*id="btnToggle"/);
    assert.ok(boton, 'el control del menú tiene que ser un <button>, no un div con role');
    assert.doesNotMatch(boton[0], /tabindex="-1"/,
        'el botón del menú no puede quedar fuera del recorrido del teclado');
});

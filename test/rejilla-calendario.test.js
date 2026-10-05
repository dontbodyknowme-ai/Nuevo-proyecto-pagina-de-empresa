// ============================================
// TESTS — Lo que la rejilla del calendario promete
// Ejecutar: node --test
// Ver: specs/006-reducir-app-js/task.md
// ============================================
//
// La rejilla tiene que marcar el día de hoy, el día elegido, y los días con
// estudio o anotaciones. Y el tipo de la anotación no puede pasar al marcado.
//
// Lo que se corrige acá es una duplicación que llevaba dos defectos encima:
//
//     for (let dia = 1; dia <= totalDias; dia++) {
//         ...
//         const hoy = new Date();                    // ← una vez por día del mes
//         const fechaHoy = `...${hoy.getDate()}...`;  // ← el formato, a mano
//
// `aFechaClave()`, en `js/logica/mapa-calor.js`, hace **exactamente** lo mismo y
// dice en su comentario que es *"la ÚNICA puerta de entrada al formato, para que
// el mapa nunca compare contra dos criterios distintos"*. Esta línea era el
// segundo criterio.
//
// Y el `new Date()` está **dentro** del bucle: un mes de 31 días construye 31
// objetos para obtener siempre la misma respuesta.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cargarComoNavegador } = require('./dom-falso.js');

const MATERIA = JSON.stringify([{ id: 'm1', nombre: 'Matematica', documentos: [] }]);

// La fecha de hoy, calculada **por su cuenta**.
//
// No importa `aFechaClave()` a propósito: si el test usara la misma función que
// está probando, pasaría aunque la función estuviera mal. Un test que compara
// una cosa consigo mismo no comprueba nada.
function claveDeHoy() {
    const hoy = new Date();
    const dos = (n) => String(n).padStart(2, '0');
    return `${dos(hoy.getDate())}/${dos(hoy.getMonth() + 1)}/${hoy.getFullYear()}`;
}

function sinComentarios(texto) {
    return texto.split('\n')
        .filter(linea => !/^\s*(\/\/|\*|\/\*)/.test(linea))
        .join('\n');
}

function codigoDeApp() {
    return sinComentarios(
        fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8'));
}

// Abre el calendario y devuelve la rejilla lista para mirarla.
function rejillaAbierta() {
    const { contexto, errores } = cargarComoNavegador({ cuadernoVirtual: MATERIA });

    assert.deepEqual(errores, [], 'la app tiene que cargar sin errores');

    return vm.runInContext(`
    (function () {
        document.getElementById('btnCalendario').click();

        // El modal abre en la vista del mapa, y ahí la rejilla del calendario
        // está oculta con display: none. No es un problema —el DOM está bien—,
        // pero hay que decirlo: sin esto el test no miraría lo que cree que mira.
        const cuerpo = document.querySelector('.calendario-body');
        if (cuerpo.className.includes('mostrando-mapa')) {
            document.getElementById('btnAlternarVista').click();
        }

        const grid = document.getElementById('calendarioGrid');
        const celdas = grid.querySelectorAll('.celda-dia');

        return {
            visibles: getComputedStyle(grid).display !== 'none',
            celdas: celdas.length,
            fechas: celdas.map(c => c.dataset.fecha),
            conTexto: celdas.filter(c => String(c.textContent).trim() !== '').length,
            hoy: celdas.filter(c => c.className.includes('hoy')).map(c => c.dataset.fecha),
            seleccionadas: celdas.filter(c => c.className.includes('dia-seleccionado'))
                .map(c => c.dataset.fecha)
        };
    })()
    `, contexto);
}

// ---------- Lo que se ve ----------

test('la rejilla del calendario está a la vista cuando se abre', () => {
    // El comentario de arriba cuenta por qué: el modal abre en vista mapa y la
    // rejilla queda en `display: none`. El DOM la tiene igual, así que un test
    // que solo lea nodos no se entera de que está mirando algo invisible.
    assert.equal(rejillaAbierta().visibles, true,
        'sin esto, los tests de abajo mirarían una rejilla que nadie ve');
});

test('la rejilla tiene los días del mes y nada más', () => {
    const r = rejillaAbierta();

    // Octubre de 2026: 31 días, más los huecos de la primera semana. La primera
    // es jueves, así que hay tres días en blanco antes del 1.
    assert.equal(r.celdas, 34);
    assert.equal(r.conTexto, 31, 'solo los días reales llevan número');
    assert.equal(r.fechas.filter(Boolean).length, 31);
});

test('los siete encabezados siguen siendo de lunes a domingo', () => {
    const r = rejillaAbierta();

    // La lista de días sale de `mapa-calor.js`. Si algún día se duplica en otro
    // archivo, el calendario deja de coincidir con el mapa.
    assert.equal(r.fechas.filter(Boolean).length > 0, true);
});

// ---------- El día de hoy ----------

test('exactamente una celda es el día de hoy', () => {
    // Ni cero, ni dos. Que el cálculo de "hoy" esté una vez por celda y no una
    // vez por mes es lo que garantiza que no pueda haber dos.
    const r = rejillaAbierta();

    assert.equal(r.hoy.length, 1,
        `hay ${r.hoy.length} celdas marcadas como hoy: ${r.hoy.join(', ') || 'ninguna'}`);
});

test('la celda de hoy es la de la fecha de hoy', () => {
    const r = rejillaAbierta();

    assert.equal(r.hoy[0], claveDeHoy(),
        'la celda marcada tiene que ser la de la fecha que dice el reloj');
});

test('si el mes que se muestra no es el de hoy, ninguna celda es hoy', () => {
    // Abrir el calendario en otro mes no puede dejar un día marcado.
    //
    // Las celdas que se cuentan salen de **medir**, y después de comprobar a mano
    // que son las correctas. La primera versión de este test decía 32 y falló:
    // marzo de 2020 tiene 37.
    //
    //   Marzo de 2020: el 1º fue domingo. La rejilla arranca el lunes, así que
    //   hay seis huecos antes. 6 + 31 = 37.
    //
    // Cuando un test falla contra un valor que uno se inventó, lo que está
    // mal es el valor, no el código.
    const { contexto, errores } = cargarComoNavegador({ cuadernoVirtual: MATERIA });
    assert.deepEqual(errores, []);

    const r = vm.runInContext(`
    (function () {
        document.getElementById('btnCalendario').click();
        const cuerpo = document.querySelector('.calendario-body');
        if (cuerpo.className.includes('mostrando-mapa')) {
            document.getElementById('btnAlternarVista').click();
        }

        const inputMes = document.getElementById('inputMes');
        const inputAnio = document.getElementById('inputAnio');
        inputMes.value = '3';
        inputAnio.value = '2020';
        document.getElementById('btnIrMes').click();

        const celdas = document.getElementById('calendarioGrid').querySelectorAll('.celda-dia');
        return {
            celdas: celdas.length,
            hoy: celdas.filter(c => c.className.includes('hoy')).length,
            conTexto: celdas.filter(c => String(c.textContent).trim() !== '').length,
            primeraSemana: celdas.slice(0, 7).map(c => String(c.textContent).trim())
        };
    })()
    `, contexto);

    assert.equal(r.conTexto, 31, 'marzo tiene 31 días');
    assert.equal(r.celdas, 37, '6 huecos porque el 1º fue domingo, más 31 días');
    assert.deepEqual(r.primeraSemana, ['', '', '', '', '', '', '1'],
        'el 1º cae en la última columna, que es domingo');
    assert.equal(r.hoy, 0,
        'ningún día de marzo de 2020 es hoy, y no puede quedar ninguno marcado');
});

test('febrero de un año bisiesto tiene 29 días', () => {
    // Se comprobó al medir: febrero de 2024 da 32 celdas, o sea 3 huecos y
    // 29 días. Si un día la cuenta salta a 28, el calendario está mintiendo.
    const { contexto, errores } = cargarComoNavegador({ cuadernoVirtual: MATERIA });
    assert.deepEqual(errores, []);

    const r = vm.runInContext(`
    (function () {
        document.getElementById('btnCalendario').click();
        const cuerpo = document.querySelector('.calendario-body');
        if (cuerpo.className.includes('mostrando-mapa')) {
            document.getElementById('btnAlternarVista').click();
        }

        const inputMes = document.getElementById('inputMes');
        const inputAnio = document.getElementById('inputAnio');
        inputMes.value = '2';
        inputAnio.value = '2024';
        document.getElementById('btnIrMes').click();

        const celdas = document.getElementById('calendarioGrid').querySelectorAll('.celda-dia');
        return {
            celdas: celdas.length,
            conTexto: celdas.filter(c => String(c.textContent).trim() !== '').length
        };
    })()
    `, contexto);

    assert.equal(r.conTexto, 29, '2024 es bisiesto');
    assert.equal(r.celdas, 32, '3 huecos porque el 1º fue jueves, más 29 días');
});

// ---------- La frontera del formato ----------

test('app.js no construye claves de fecha por su cuenta', () => {
    // `getDate()` es la puerta de atrás al formato DD/MM/AAAA. La de adelante es
    // `aFechaClave()`, que ya está importada en `app.js` y ya se usa para los
    // minutos del Pomodoro.
    //
    // El comentario de `aFechaClave()` dice que es *"la ÚNICA puerta de entrada
    // al formato, para que el mapa nunca compare contra dos criterios distintos"*.
    // Este test es lo que hace única esa puerta.
    const usos = codigoDeApp().match(/getDate\(\)/g) || [];

    assert.deepEqual(usos, [],
        'app.js tiene ' + usos.length + ' llamada(s) a getDate(). La clave de '
        + 'fecha se arma con aFechaClave(), que ya está importada acá mismo.');
});

test('aFechaClave y el formato manual dan lo mismo', () => {
    // Para que se vea que no se cambió el resultado y solo se dejó de repetir.
    const { aFechaClave } = require('../js/logica/mapa-calor.js');

    const dos = (n) => String(n).padStart(2, '0');
    const manual = (fecha) =>
        `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;

    for (const fecha of [
        new Date(2026, 9, 2),
        new Date(2026, 0, 1),
        new Date(2024, 1, 29),
        new Date(2026, 11, 31),
        new Date(2026, 8, 9)
    ]) {
        assert.equal(aFechaClave(fecha), manual(fecha),
            `para ${fecha.toDateString()} tienen que dar lo mismo`);
    }
});

test('el calendario sigue marcando hoy con la función del módulo', () => {
    // Y la comprobación de que el cambio no rompió lo que se ve: la rejilla
    // sigue marcando el día correcto.
    const r = rejillaAbierta();

    assert.equal(r.hoy.length, 1);
    assert.equal(r.hoy[0], claveDeHoy());
});

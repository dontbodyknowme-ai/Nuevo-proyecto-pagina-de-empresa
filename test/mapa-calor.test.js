// ============================================
// TESTS — Funciones puras del mapa de calor
// Ejecutar: node --test test/
// Cubre: RF-2, RF-3, RF-4, RF-5, RF-6, RF-9, RF-14, RNF-7
// ============================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    nivelDe,
    clasificarDia,
    periodoDe,
    diasDeSemana,
    construirGrilla,
    describir,
    etiquetaDeNivel
} = require('../js/logica/mapa-calor.js');

// Fecha de referencia para todos los tests: 15/10/2026
const HOY_CLAVE = '15/10/2026';
const HOY_MS = Date.UTC(2026, 9, 15, 12, 0, 0);

// Aquí estaban los cinco tests de `minutosDe()` y los siete de `consolidar()`.
// Ninguna de las dos funciones la usaba la app: los minutos del mapa salen de
// `minutosTotales()`, en `js/datos/secciones.js`.
//
// La regla de RF-2 que fijaban —una sección se redondea por separado y los
// segundos sueltos no cuentan— está ahora en `test/secciones.test.js`, contra
// `minutosTotales()`, con el caso de las cinco pausas de 30 segundos, que antes
// no estaba. Ver T6.

// ---------- RF-4 · Escala de intensidad fija ----------

test('RF-4 · cero minutos es nivel 0', () => {
    assert.equal(nivelDe(0), 0);
});

test('RF-4 · los límites inferiores de cada nivel', () => {
    assert.equal(nivelDe(1), 1);
    assert.equal(nivelDe(25), 2);
    assert.equal(nivelDe(50), 3);
    assert.equal(nivelDe(75), 4);
    assert.equal(nivelDe(100), 5);
});

test('RF-4 · los límites superiores de cada nivel', () => {
    assert.equal(nivelDe(24), 1);
    assert.equal(nivelDe(49), 2);
    assert.equal(nivelDe(74), 3);
    assert.equal(nivelDe(99), 4);
});

test('RF-4 · el exceso no crea un nivel nuevo', () => {
    assert.equal(nivelDe(800), 5);
    assert.equal(nivelDe(800), nivelDe(100));
});

// ---------- RF-5 · Clasificación del día ----------

test('RF-5 · reconoce el día actual', () => {
    assert.equal(clasificarDia(HOY_CLAVE, HOY_CLAVE), 'hoy');
});

test('RF-5 · reconoce un día pasado', () => {
    assert.equal(clasificarDia('14/10/2026', HOY_CLAVE), 'pasado');
});

test('RF-5 · reconoce un día futuro', () => {
    assert.equal(clasificarDia('16/10/2026', HOY_CLAVE), 'futuro');
});

// ---------- RF-9 · Período de cuatro semanas ----------

test('RF-9 · devuelve exactamente 28 claves', () => {
    assert.equal(periodoDe(HOY_CLAVE).length, 28);
});

test('RF-9 · termina en el día actual', () => {
    const periodo = periodoDe(HOY_CLAVE);
    assert.equal(periodo[periodo.length - 1], HOY_CLAVE);
});

test('RF-9 · no incluye días futuros', () => {
    const periodo = periodoDe(HOY_CLAVE);
    assert.equal(periodo.includes('16/10/2026'), false);
});

test('RF-9 · las claves son únicas y van en orden cronológico', () => {
    const periodo = periodoDe(HOY_CLAVE);
    assert.equal(new Set(periodo).size, 28);

    // El orden se verifica con las fechas reales, no ordenando el texto:
    // como cadenas, "18/09/2026" queda después de "15/10/2026".
    const tiempos = periodo.map((c) => new Date(c.split('/').reverse().join('/')).getTime());
    for (let i = 1; i < tiempos.length; i++) {
        assert.ok(tiempos[i] > tiempos[i - 1], `posición ${i} no está en orden`);
    }
});

test('RF-9 · devuelve los siete días de la semana empezando por lunes', () => {
    assert.deepEqual(diasDeSemana(), ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']);
});

// ---------- La lista está en un solo lugar ----------

test('ningún otro archivo escribe la lista de días otra vez', () => {
    // La lista estaba escrita en `app.js` y en este módulo, y nadie lo notaba:
    // los dos tests de arriba pasaban igual, porque probaban la función, no
    // que hubiera una sola copia.
    //
    // Dos copias de lo mismo divergen solas: un día alguien agrega un día y
    // repara el mapa, y el calendario sigue con los siete viejos. Este test
    // es lo que hace imposible olvidarse.
    const RAIZ = path.join(__dirname, '..');
    const CARPETA = path.join(RAIZ, 'js');

    // La lista completa, como aparece en el código.
    const lista = "'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'";

    const libremente = [];
    const recorrer = (carpeta) => {
        for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
            const completo = path.join(carpeta, entrada.name);
            if (entrada.isDirectory()) { recorrer(completo); continue; }
            if (!entrada.name.endsWith('.js')) continue;

            const codigo = fs.readFileSync(completo, 'utf8');
            if (codigo.includes(lista)) {
                libremente.push(path.relative(RAIZ, completo).replace(/\\/g, '/'));
            }
        }
    };
    recorrer(CARPETA);

    assert.deepEqual(libremente, ['js/logica/mapa-calor.js'],
        'la lista de días está escrita en más de un archivo. Tiene que estar '
        + 'solo en js/logica/mapa-calor.js, y el resto la toma de ahí.');
});

test('app.js toma los encabezados del módulo, no los escribe', () => {
    // La forma concreta de que la lista se duplique: alguien la escribe en vez
    // de pedirla. Se comprueba que `app.js` la pida.
    const app = fs.readFileSync(
        path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

    assert.match(app, /LogicaMapa\.diasDeSemana\(\)/,
        'el calendario tiene que pedir los encabezados con diasDeSemana()');
});

// ---------- RF-1 y RF-3 · Consolidación por día ----------
//
// Aquí estaban siete tests de `consolidar()`: sumar secciones del mismo día, el
// cruce de medianoche, los días separados, el objeto vacío, el redondeo por
// sección y el minuto exacto. La función no la usaba nadie —los minutos del
// mapa salen de `minutosTotales()`, en `js/datos/secciones.js`— así que las
// reglas estaban fijadas contra una copia muerta. Están ahora en
// `test/secciones.test.js`, contra la función viva. Ver T6.

// Y un caso NO se pudo migrar, y hay que dejarlo escrito:
//
//   'RF-1 · una sección abierta cuenta con la referencia dada'
//
// `consolidar()` miraba `seccion.finMs ?? ahoraMs`, así que una sesión de
// Pomodoro **en curso** contaba en el mapa. `minutosTotales()` recorre solo
// `estado.secciones`, y la sesión abierta vive en `estado.seccionAbierta`: no la
// cuenta. O sea que el mapa no muestra minutos hasta que la sesión termina.
//
// No se arregla acá porque no es un borrado, es un cambio de comportamiento, y
// la constitución pide que no se mezclen. Queda anotado en
// specs/004-app-funcional-y-limpeza/task.md como decisión pendiente del usuario:
// ¿el mapa tiene que mostrar la sesión en curso, o solo las terminadas?

// ---------- RF-9 y RF-4 · Construcción de la grilla ----------

test('RF-9 · la grilla tiene 4 filas de 7 columnas', () => {
    const grilla = construirGrilla(HOY_CLAVE, {});
    assert.equal(grilla.length, 4);
    grilla.forEach((fila) => {
        assert.equal(fila.length, 7);
    });
});

test('RF-9 · cada celda tiene clave, minutos, nivel y estado', () => {
    const grilla = construirGrilla(HOY_CLAVE, {});
    const celda = grilla[0][0];
    assert.ok(celda.clave);
    assert.equal(typeof celda.minutos, 'number');
    assert.equal(typeof celda.nivel, 'number');
    assert.ok(['futuro', 'hoy', 'pasado'].includes(celda.estado));
});

test('RF-4 · la celda refleja el nivel de sus minutos', () => {
    const grilla = construirGrilla(HOY_CLAVE, { '14/10/2026': 52 });
    const celda = grilla.find((f) => f.some((c) => c.clave === '14/10/2026'))
        .find((c) => c.clave === '14/10/2026');
    assert.equal(celda.minutos, 52);
    assert.equal(celda.nivel, 3);
});

test('RF-5 · sin datos, todas las celdas quedan vacías', () => {
    const grilla = construirGrilla(HOY_CLAVE, {});
    const todas = grilla.flat();
    todas.forEach((celda) => {
        assert.equal(celda.minutos, 0);
        assert.equal(celda.nivel, 0);
    });
});

test('RF-5 · no hay días futuros en la grilla', () => {
    const grilla = construirGrilla(HOY_CLAVE, {});
    const todas = grilla.flat();
    assert.equal(todas.filter((c) => c.estado === 'futuro').length, 0);
});

// ---------- RF-6 y RF-14 · Descripción y etiquetas ----------

test('RF-6 · la descripción incluye los minutos y el nivel', () => {
    const grilla = construirGrilla(HOY_CLAVE, { '14/10/2026': 52 });
    const celda = grilla.flat().find((c) => c.clave === '14/10/2026');
    const texto = describir(celda);
    assert.ok(texto.includes('52'));
    assert.ok(texto.includes('14/10/2026'));
});

test('RF-6 · un día sin estudio dice que no registra estudio', () => {
    const grilla = construirGrilla(HOY_CLAVE, {});
    const celda = grilla.flat()[0];
    const texto = describir(celda);
    assert.ok(texto.includes('no registra estudio'));
});

test('RF-14 · la etiqueta de cada nivel es un texto legible', () => {
    const etiquetas = [0, 1, 2, 3, 4, 5].map(etiquetaDeNivel);
    etiquetas.forEach((e) => {
        assert.equal(typeof e, 'string');
        assert.ok(e.length > 0);
    });
    assert.notEqual(etiquetas[0], etiquetas[5]);
});

// ---------- RNF-7 · Purity: hoy es un parámetro ----------

test('RNF-7 · cambiar hoy cambia el período devuelto', () => {
    const otro = periodoDe('01/03/2026');
    assert.equal(otro.length, 28);
    assert.equal(otro[otro.length - 1], '01/03/2026');
});

test('RNF-7 · cambiar hoy cambia la clasificación de una fecha', () => {
    assert.equal(clasificarDia('20/10/2026', HOY_CLAVE), 'futuro');
    assert.equal(clasificarDia('20/10/2026', '25/10/2026'), 'pasado');
});

test('RNF-7 · el módulo no depende del reloj del sistema', () => {
    // Dos llamadas seguidas sin cambiar parámetros deben dar el mismo resultado
    const primera = construirGrilla(HOY_CLAVE, { '14/10/2026': 30 });
    const segunda = construirGrilla(HOY_CLAVE, { '14/10/2026': 30 });
    assert.deepEqual(primera, segunda);
});

// El test de RNF-7 que estaba acá —"consolidar no muta el arreglo de entrada"—
// también se mudó: ahora es "minutosTotales · no muta el estado que recibe", en
// `test/secciones.test.js`. Ver T6.
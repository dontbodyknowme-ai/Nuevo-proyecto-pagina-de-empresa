// ============================================ Sonda: caracteres fuera de lugar
// Ejecutar: node herramientas/buscar-caracteres-raros.js
// ============================================
//
// Un proyecto en español no debería tener ni una letra china, cirílica, árabe
// ni de otro alfabeto. Este script las busca y dice en qué archivo y línea.
//
// Por qué existe: el 2026-10-01 había dos caracteres chinos (los dos primers
// caracteres de la palabra china para "debería", U+5E94 y U+8BE5) donde tenía
// que estar la palabra española, en `specs/003-refactor-app/spec.md`.
//
// Ojo: este archivo NO los escribe, ni los cita. Si los escribiera, se
// reportaría a sí mismo, y una herramienta que se culpa a sí misma deja de
// ser creíble. Los caracteres se nombran por su código, no se copian.
//
// Los chequeos de encoding de siempre NO lo detectaron:
//
//   - `U+FFFD`        -> 0. El mojibake no es U+FFFD.
//   - patrón de mojibake -> 0. Son caracteres válidos, mal traducidos.
//   - sin BOM         -> correcto, el archivo estaba bien guardado.
//
// Los tres chequeos buscaban corrupción *dentro* de los caracteres que uno
// espera. Este busca lo que **no debería estar**.
//
// Por qué vive acá y no en test/: `node --test` ejecuta cualquier `.js` dentro
// de un directorio llamado `test`. Verificado con una sonda.
//
// Herramientas: solo Node. Sin npm install. Principio 1.

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const EXTENSIONES = ['.js', '.css', '.html', '.md', '.json'];
const IGNORAR = /node_modules|[\\/]\.(opencode|agents)[\\/]/;

// Rangos que sí pueden aparecer: control de línea, latin, símbolos, y emojis.
const PERMITIDOS = [
  [0x0009, 0x000d],  // tab, salto de línea, retorno de carro
  [0x0020, 0x007e],  // ASCII imprimible
  [0x00a0, 0x024f],  // latin extendido: acentos, ñ, ¿, ¡
  [0x1e00, 0x1eff],  // latin con signos diacríticos adicionales
  [0x2000, 0x27bf],  // flechas, Quotes, simbolos geometricos, dingbats
  [0x2b00, 0x2bff],  // flechas grandes, formas
  [0xfe00, 0xfe0f],  // selectores de variación: los que hacen ⚙ en vez de ⚙
  [0x1f000, 0x10ffff] // emojis y planos suplementarios
];

// Alfabetos que no tienen nada que hacer aqui.
const ALFABETOS = [
  [0x2e80, 0x9fff, 'chino'],
  [0xf900, 0xfaff, 'chino (compatibilidad)'],
  [0xac00, 0xd7af, 'coreano'],
  [0x3040, 0x30ff, 'japonés (kana y kanji)'],
  [0x0400, 0x04ff, 'cirílico'],
  [0x0590, 0x05ff, 'hebreo'],
  [0x0600, 0x06ff, 'árabe'],
  [0x0900, 0x097f, 'devanagari'],
  [0x0e00, 0x0e7f, 'tailandés'],
  [0xff01, 0xff60, 'cJK de ancho completo'],
  [0x3000, 0x303f, 'cJK (puntuación y símbolos)']
];

function permitido(cp) {
  return PERMITIDOS.some(([desde, hasta]) => cp >= desde && cp <= hasta);
}

function alfabetoDe(cp) {
  for (const [desde, hasta, nombre] of ALFABETOS) {
    if (cp >= desde && cp <= hasta) return nombre;
  }
  return 'otro alfabeto';
}

/** La línea en la que cae un índice, contando desde 0. */
function lineaDe(texto, indice) {
  let linea = 1;
  for (let i = 0; i < indice; i++) if (texto[i] === '\n') linea++;
  return linea;
}

function archivosDelProyecto() {
  const encontrados = [];

  const recorrer = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      const relativo = path.relative(RAIZ, completo);

      if (IGNORAR.test(relativo)) continue;

      if (entrada.isDirectory()) {
        recorrer(completo);
      } else if (EXTENSIONES.includes(path.extname(entrada.name).toLowerCase())) {
        encontrados.push(completo);
      }
    }
  };

  recorrer(RAIZ);
  return encontrados;
}

const problemas = [];
let archivosRevisados = 0;

// Archivos donde un carácter sospechoso está a propósito.
const PERMITIDOS_ESTE_ARCHIVO = new Set([
  // Línea 158: el archivo usa a propósito un texto con dos caracteres de
  // reemplazo (U+FFFD) como ejemplo de lo que se ve cuando algo se guarda en
  // la codificación equivocada. Es el ejemplo del bug, no el bug.
  'docs\\constitucion.md'
]);

for (const archivo of archivosDelProyecto()) {
  const texto = fs.readFileSync(archivo, 'utf8');
  archivosRevisados++;

  const permitidosEsteArchivo = new Set(
    [...PERMITIDOS_ESTE_ARCHIVO].filter(p => archivo.endsWith(p))
  );

  for (let i = 0; i < texto.length; i++) {
    const cp = texto.codePointAt(i);

    // Un emoji ocupa dos unidades de código. Hay que saltar la segunda
    // ANTES de decidir nada, o el surrogate suelto se reporta como raro.
    // Ojo: esto va antes del `continue`, no después.
    if (cp > 0xffff) i++;

    if (permitido(cp)) continue;

    // El carácter de reemplazo SÍ se reporta: es corrupción. La excepción es
    // `docs/constitucion.md`, que lo tiene a propósito como ejemplo de lo
    // que pasa cuando un archivo se guarda mal. Ver ARCHIVOS_PERMITIDOS.
    if (cp === 0xfffd && permitidosEsteArchivo.size > 0) continue;

    problemas.push({
      archivo: path.relative(RAIZ, archivo),
      linea: lineaDe(texto, i),
      codigo: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
      alfabeto: alfabetoDe(cp),
      contexto: texto.slice(Math.max(0, i - 40), i + 40).replace(/\n/g, ' ')
    });
  }
}

console.log(`  ${archivosRevisados} archivos revisados`);
console.log('');

if (problemas.length === 0) {
  console.log('  Nada fuera de lugar: solo latin, símbolos y emojis.');
  console.log('  Un proyecto en español no debería tener otros alfabetos.');
  process.exit(0);
}

console.log(`  ${problemas.length} caracter(es) fuera de lugar:`);
console.log('');
for (const p of problemas) {
  console.log(`  ${p.archivo}  L${p.linea}  ${p.codigo}  ${p.alfabeto}`);
  console.log(`      ...${p.contexto}...`);
  console.log('');
}
console.log('  Estos caracteres no tienen nada que ver con un proyecto en español.');
console.log('  Casi siempre es una traducción accidental al escribir.');
process.exit(1);
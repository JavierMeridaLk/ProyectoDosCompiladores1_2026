'use strict';

const fs   = require('fs');
const path = require('path');

// ── Traductores ──
const TraductorCSS         = require('./traductorCSS');
const TraductorComponentes = require('./traductorComponentes');
const TraductorDB          = require('./traductorDB');
const TraductorPrincipal   = require('./traductorPrincipal');

class Motor {

    /**
     * Ejecuta la traducción de un archivo según su extensión.
     * @param {string} rutaEntrada  Ruta absoluta o relativa al archivo fuente
     * @returns {{ salida: string, errores: ErrorLSS[] } | null}
     */
    static async ejecutar(rutaEntrada) {
        const rutaAbs = path.resolve(__dirname, rutaEntrada);

        console.log('\n' + '═'.repeat(60));
        console.log(`  Procesando: ${path.basename(rutaAbs)}`);
        console.log('═'.repeat(60));

        // ── Verificar existencia ──
        if (!fs.existsSync(rutaAbs)) {
            console.error(`❌  Archivo no encontrado: ${rutaAbs}`);
            return null;
        }

        const contenido = fs.readFileSync(rutaAbs, 'utf-8');
        const ext       = path.extname(rutaAbs).toLowerCase();

        let resultado    = null;
        let codigoSalida = '';
        let nombreSalida = '';

        try {
            // ── Selección del traductor ──
            switch (ext) {

                case '.styles':
                    resultado    = TraductorCSS.analizar(contenido);
                    codigoSalida = resultado.css ?? '';
                    nombreSalida = path.basename(rutaAbs, '.styles') + '.css';
                    break;

                case '.comp':
                    resultado    = TraductorComponentes.analizar(contenido);
                    codigoSalida = resultado.js ?? '';
                    nombreSalida = path.basename(rutaAbs, '.comp') + '.js';
                    break;

                case '.db':
                    // TraductorDB.analizar es async
                    resultado    = await TraductorDB.analizar(contenido, false);
                    codigoSalida = resultado.sql ?? '';
                    nombreSalida = path.basename(rutaAbs, '.db') + '.sql';
                    break;

                case '.y':
                    resultado    = TraductorPrincipal.analizar(contenido, rutaAbs);
                    codigoSalida = resultado.js ?? '';
                    nombreSalida = path.basename(rutaAbs, '.y') + '.js';
                    break;

                default:
                    console.error(`❌  Extensión no soportada: ${ext}`);
                    return null;
            }

        } catch (err) {
            console.error(`❌  Error crítico durante la traducción: ${err.message}`);
            console.error(err.stack);
            return null;
        }

        // ── Reporte de errores ──
        const errores = resultado?.errores ?? [];
        console.log(`\n📋  ERRORES ENCONTRADOS: ${errores.length}`);

        if (errores.length === 0) {
            console.log('  ✅  Sin errores.');
        } else {
            // Agrupar por tipo
            const grupos = {};
            errores.forEach(e => {
                const tipo = e.tipo ?? 'Desconocido';
                grupos[tipo] = grupos[tipo] || [];
                grupos[tipo].push(e);
            });

            Object.entries(grupos).forEach(([tipo, lista]) => {
                console.log(`\n  ── ${tipo} (${lista.length}) ${'─'.repeat(35)}`);
                lista.forEach((e, idx) => {
                    const desc = e.descripcion ?? e.mensaje ?? String(e);
                    const loc  = (e.linea || e.columna)
                        ? ` [Línea ${e.linea}, Col ${e.columna}]`
                        : '';
                    console.log(`  ${idx + 1}. ${desc}${loc}`);
                });
            });
        }

        // ── Guardar archivo de salida ──
        if (typeof codigoSalida !== 'string') {
            codigoSalida = JSON.stringify(codigoSalida, null, 2);
        }

        const carpetaSalida = path.join(__dirname, 'output');
        if (!fs.existsSync(carpetaSalida)) {
            fs.mkdirSync(carpetaSalida, { recursive: true });
        }

        const rutaSalida = path.join(carpetaSalida, nombreSalida);
        fs.writeFileSync(rutaSalida, codigoSalida, 'utf-8');

        console.log(`\n💾  Salida guardada en: ${rutaSalida}`);

        return { salida: rutaSalida, errores };
    }

    /**
     * Procesa un archivo desde su contenido en memoria (para uso del servidor web).
     */
    static async ejecutarDesdeContenido(nombreArchivo, contenido) {
        const ext  = path.extname(nombreArchivo).toLowerCase();
        const tipo = ext.slice(1); // 'y', 'comp', 'styles', 'db'

        let resultado    = null;
        let codigoSalida = '';

        try {
            switch (ext) {

                case '.styles':
                    resultado    = TraductorCSS.analizar(contenido);
                    codigoSalida = resultado.css ?? '';
                    break;

                case '.comp':
                    resultado    = TraductorComponentes.analizar(contenido);
                    codigoSalida = resultado.js ?? '';
                    break;

                case '.db': {
                    resultado    = await TraductorDB.analizar(contenido, false);
                    codigoSalida = resultado.sql ?? '';

                    // Ejecutar el SQL generado en la base de datos real
                    let dbResultado = null;
                    if (codigoSalida.trim()) {
                        try {
                            const DBExecutor = require('./dbExecutor');
                            dbResultado = await DBExecutor.ejecutar(codigoSalida);
                        } catch (dbErr) {
                            resultado.errores = resultado.errores ?? [];
                            resultado.errores.push({
                                tipo: 'Ejecución',
                                descripcion: `Error al ejecutar SQL: ${dbErr.message}`,
                                linea: 0,
                                columna: 0
                            });
                        }
                    }

                    return {
                        salida:      codigoSalida,
                        errores:     resultado.errores ?? [],
                        tipo,
                        dbResultado
                    };
                }

                case '.y':
                    resultado    = TraductorPrincipal.analizar(contenido, nombreArchivo);
                    codigoSalida = resultado.js ?? '';
                    break;

                default:
                    return { salida: null, errores: [], tipo, ignorado: true };
            }

        } catch (err) {
            return {
                salida:  null,
                errores: [{ tipo: 'Fatal', descripcion: err.message, linea: 0, columna: 0 }],
                tipo
            };
        }

        return {
            salida:        codigoSalida,
            errores:       resultado?.errores ?? [],
            tipo,
            tablaSimbolos: resultado?.tablaSimbolos ?? null
        };
    }

    /** Runtime JS que toda app LSS necesita para ejecutar queries desde el navegador. */
    static _runtimeSQL() {
        return `// ── Runtime SQL ──
async function ejecutarSQL(query) {
  const res = await fetch('http://localhost:3000/execute-y', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  if (!data.ok) { console.error('[SQL]', data.error ?? 'Error', '|', data.sql ?? query); return []; }
  const rows = data.rows ?? [];
  if (!rows.length) return [];
  const row = rows[0];
  if (row.tipo === 'select') {
    const resultado = row.resultado ?? [];
    if (!resultado.length) return [];
    const cols = Object.keys(resultado[0]);
    if (cols.length === 1) return resultado.map(r => r[cols[0]]);
    return resultado;
  }
  return row.changes ?? 0;
}`;
    }

    /**
     * Ensambla el index.html para PREVIEW (todo embebido, abre con Blob URL).
     */
    static ensamblarHTML(resultados, titulo = 'Proyecto LSS') {
        const css         = resultados.filter(r => r.tipo === 'styles' && r.salida).map(r => r.salida).join('\n');
        const compJS      = resultados.filter(r => r.tipo === 'comp'   && r.salida).map(r => r.salida).join('\n');
        const principalJS = resultados.filter(r => r.tipo === 'y'      && r.salida).map(r => r.salida).join('\n');

        return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>
${css}
  </style>
</head>
<body>
<script>
${Motor._runtimeSQL()}

// ── Componentes ──
${compJS}

// ── Principal ──
${principalJS}
</script>
</body>
</html>`;
    }

    /**
     * Construye los artefactos de producción.
     */
    /**
     * Construye los artefactos de producción.
     */
    static generarArtefactos(resultados, nombreProyecto = 'proyecto') {
        const archivos     = [];
        const tablaGlobal  = { proyecto: nombreProyecto, archivos: [] };

        // ── CSS (todos los .styles concatenados) ──
        const cssTotal = resultados
            .filter(r => r.tipo === 'styles' && r.salida)
            .map(r => r.salida)
            .join('\n\n');

        if (cssTotal.trim()) {
            archivos.push({ nombre: 'styles.css', contenido: cssTotal });
        }

        // ── Componentes (todos los .comp concatenados) ──
        const compTotal = resultados
            .filter(r => r.tipo === 'comp' && r.salida)
            .map(r => r.salida)
            .join('\n\n');

        if (compTotal.trim()) {
            archivos.push({ nombre: 'components.js', contenido: compTotal });
        }

        // ── Programa principal (.y) con runtime SQL incluido ──
        const principalTotal = resultados
            .filter(r => r.tipo === 'y' && r.salida)
            .map(r => r.salida)
            .join('\n\n');

        const tieneSQL = resultados.some(r => r.tipo === 'db' && r.salida);
        const mainJS   = [
            tieneSQL || principalTotal.includes('ejecutarSQL') ? Motor._runtimeSQL() : '',
            principalTotal
        ].filter(Boolean).join('\n\n');

        if (mainJS.trim()) {
            archivos.push({ nombre: 'main.js', contenido: mainJS });
        }

        // ── Base de datos (.db → SQL) ──
        const sqlTotal = resultados
            .filter(r => r.tipo === 'db' && r.salida)
            .map(r => r.salida)
            .join('\n\n');

        if (sqlTotal.trim()) {
            archivos.push({ nombre: 'database.sql', contenido: sqlTotal });
        }

        // ── Registrar en tabla global ──
        for (const r of resultados) {
            if (r.ignorado || !r.salida) continue;
            tablaGlobal.archivos.push({
                archivo:       path.basename(r.file || r.nombreArchivo || 'desconocido'),
                tipo:          r.tipo,
                tablaSimbolos: r.tablaSimbolos ?? null
            });
        }

        // ── index.html — app web que enlaza los archivos ──
        const tieneStyles = cssTotal.trim().length > 0;
        const tieneComp   = compTotal.trim().length > 0;
        const tieneMain   = mainJS.trim().length > 0;

        // Se inyecta la etiqueta link solo si el proyecto generó CSS
        const htmlLinks = tieneStyles 
            ? '  <link rel="stylesheet" href="styles.css">' 
            : '';

        const scriptTags = [
            tieneComp  ? '  <script src="components.js"></script>' : '',
            tieneMain  ? '  <script src="main.js"></script>'       : '',
        ].filter(Boolean).join('\n');

    const indexHTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${nombreProyecto}</title>
${htmlLinks}
</head>
<body>
${scriptTags}
</body>
</html>`;

        archivos.push({ nombre: 'index.html', contenido: indexHTML });

        // ── Tabla de símbolos (HTML) ──
        archivos.push({
            nombre:    'tabla-simbolos.html',
            contenido: Motor._generarHTMLTablaSimbolos(tablaGlobal)
        });

        return archivos;
    }

    static _generarHTMLTablaSimbolos(tablaGlobal) {
        const { proyecto, archivos } = tablaGlobal;

        const filas = archivos.map(entry => {
            const { archivo, tipo, tablaSimbolos: ts } = entry;
            if (!ts) return '';

            let bloques = '';

            // .y — variables y funciones
            if (ts.variables || ts.funciones) {
                if (ts.variables?.length) {
                    const vars = ts.variables.map(v =>
                        `<tr><td>${v.id}</td><td>${v.tipoDato}${v.isArray ? '[]' : ''}</td><td>variable</td></tr>`
                    ).join('');
                    bloques += `
                    <h4>Variables</h4>
                    <table class="ts-table">
                        <thead><tr><th>Identificador</th><th>Tipo</th><th>Clase</th></tr></thead>
                        <tbody>${vars}</tbody>
                    </table>`;
                }
                if (ts.funciones?.length) {
                    const fns = ts.funciones.map(f =>
                        `<tr><td>${f.id}</td><td>${f.paramsCount} parámetro(s)</td><td>función</td></tr>`
                    ).join('');
                    bloques += `
                    <h4>Funciones</h4>
                    <table class="ts-table">
                        <thead><tr><th>Identificador</th><th>Parámetros</th><th>Clase</th></tr></thead>
                        <tbody>${fns}</tbody>
                    </table>`;
                }
            }

            // .comp — componentes
            if (ts.componentes?.length) {
                const comps = ts.componentes.map(c => {
                    const params = (c.params ?? []).map(p => `${p.tipo} ${p.id}`).join(', ') || '—';
                    return `<tr><td>${c.id}</td><td>${params}</td><td>componente</td></tr>`;
                }).join('');
                bloques += `
                    <h4>Componentes</h4>
                    <table class="ts-table">
                        <thead><tr><th>Identificador</th><th>Parámetros</th><th>Clase</th></tr></thead>
                        <tbody>${comps}</tbody>
                    </table>`;
            }

            // .styles — estilos
            if (ts.estilos?.length) {
                const sts = ts.estilos.map(s =>
                    `<tr><td>.${s.id}</td><td>${s.propiedades}</td><td>clase CSS</td></tr>`
                ).join('');
                bloques += `
                    <h4>Estilos</h4>
                    <table class="ts-table">
                        <thead><tr><th>Selector</th><th>Propiedades</th><th>Clase</th></tr></thead>
                        <tbody>${sts}</tbody>
                    </table>`;
            }

            // .db — tablas
            if (ts.tablas?.length) {
                const tabs = ts.tablas.map(t => {
                    const cols = (t.columnas ?? []).map(c => `${c.col}: ${c.tipo}`).join(', ');
                    return `<tr><td>${t.nombre}</td><td>${cols}</td><td>tabla SQL</td></tr>`;
                }).join('');
                bloques += `
                    <h4>Tablas DB</h4>
                    <table class="ts-table">
                        <thead><tr><th>Tabla</th><th>Columnas</th><th>Clase</th></tr></thead>
                        <tbody>${tabs}</tbody>
                    </table>`;
            }

            if (!bloques) return '';

            const badge = { y: 'badge-y', comp: 'badge-comp', styles: 'badge-styles', db: 'badge-db' }[tipo] ?? 'badge-y';
            return `
            <section class="archivo-section">
                <h3><span class="badge ${badge}">.${tipo}</span> ${archivo}</h3>
                ${bloques}
            </section>`;
        }).filter(Boolean).join('\n');

        return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tabla de Símbolos — ${proyecto}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #1e1e2e; color: #cdd6f4; padding: 24px; }
    h1 { font-size: 1.5rem; margin-bottom: 4px; color: #cba6f7; }
    .subtitle { color: #6c7086; font-size: 0.85rem; margin-bottom: 24px; }
    .archivo-section { background: #181825; border: 1px solid #313244; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .archivo-section h3 { font-size: 1rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    h4 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: .05em; color: #6c7086; margin: 12px 0 6px; }
    .badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 99px; font-weight: 700; }
    .badge-y      { background: #89b4fa22; color: #89b4fa; }
    .badge-comp   { background: #a6e3a122; color: #a6e3a1; }
    .badge-styles { background: #f38ba822; color: #f38ba8; }
    .badge-db     { background: #fab38722; color: #fab387; }
    .ts-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .ts-table th { background: #313244; color: #89b4fa; padding: 6px 10px; text-align: left; border-bottom: 1px solid #45475a; }
    .ts-table td { padding: 5px 10px; border-bottom: 1px solid #2a2a3a; color: #cdd6f4; }
    .ts-table tr:last-child td { border-bottom: none; }
    .ts-table tr:hover td { background: #1e1e2e; }
    .empty { color: #6c7086; font-style: italic; font-size: 0.85rem; padding: 12px 0; }
  </style>
</head>
<body>
  <h1>Tabla de Símbolos</h1>
  <p class="subtitle">Proyecto: <strong>${proyecto}</strong> &nbsp;·&nbsp; ${archivos.length} archivo(s) compilado(s)</p>
  ${filas || '<p class="empty">No se encontraron símbolos.</p>'}
</body>
</html>`;
    }

    /**
     * Ejecuta todos los archivos de prueba en secuencia.
     */
    static async ejecutarPruebas() {
        console.log('\n' + '█'.repeat(60));
        console.log('  MOTOR LSS — EJECUCIÓN DE PRUEBAS');
        console.log('█'.repeat(60));

        // Rutas relativas a la ubicación de motor.js
        const archivos = [
            './entrada.styles',
            './entrada.comp',
            './entrada.db',
            './entrada.y',
        ];

        const resumen = [];

        for (const archivo of archivos) {
            const res = await Motor.ejecutar(archivo);
            resumen.push({
                archivo,
                ok:      res !== null,
                errores: res?.errores?.length ?? '—',
            });
        }

        // ── Resumen final ──
        console.log('\n' + '═'.repeat(60));
        console.log('  RESUMEN DE PRUEBAS');
        console.log('═'.repeat(60));
        resumen.forEach(r => {
            const estado = r.ok ? '✅' : '❌';
            console.log(`  ${estado}  ${r.archivo.padEnd(22)} errores: ${r.errores}`);
        });
        console.log('');
    }
}

module.exports = Motor;

// ── Ejecución directa: node motor.js ──
if (require.main === module) {
    Motor.ejecutarPruebas().catch(err => {
        console.error('Error inesperado en el motor:', err);
        process.exit(1);
    });
}
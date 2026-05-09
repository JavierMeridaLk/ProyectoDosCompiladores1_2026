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
     * @param {string} nombreArchivo  Nombre o ruta del archivo (se usa solo la extensión)
     * @param {string} contenido      Contenido del archivo como string
     * @returns {{ salida: string, errores: object[], tipo: string, dbResultado?: any }}
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
            salida:  codigoSalida,
            errores: resultado?.errores ?? [],
            tipo
        };
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
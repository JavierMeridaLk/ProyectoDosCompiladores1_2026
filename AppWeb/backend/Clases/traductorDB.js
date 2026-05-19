'use strict';

/**
 * Traductor del lenguaje .db → SQL (SQLite)
 */

const ParserDB = require('../Analizadores/DBJison');
const ErrorLSS = require('./Errores');

// tabla de simbolso para db
class EntornoDB {
    constructor() {
        this.tablas    = new Map();
        this._preloaded = new Set();
    }

    //precarasd e tablas y columans existentes
    precargarTabla(nombre) {
        if (!this.tablas.has(nombre)) {
            const columnas = new Map();
            columnas.set('id', 'INTEGER');
            this.tablas.set(nombre, columnas);
        }
        this._preloaded.add(nombre);
    }

    precargarColumna(tabla, columna, tipoSQL) {
        if (this.tablas.has(tabla) && columna !== 'id') {
            this.tablas.get(tabla).set(columna, tipoSQL || 'TEXT');
        }
    }

    /**
     * Registra una tabla nueva en la sesión actual.
     * @returns {boolean} 
     */
    registrarTabla(nombre) {
        // Si ya existe y no vino de la BD
        if (this.tablas.has(nombre) && !this._preloaded.has(nombre)) return false;
        if (!this.tablas.has(nombre)) {
            const columnas = new Map();
            columnas.set('id', 'INTEGER');
            this.tablas.set(nombre, columnas);
        }
        // Deja de estar marcada como pre-cargada 
        this._preloaded.delete(nombre);
        return true;
    }

    registrarColumna(tabla, columna, tipoSQL) {
        if (!this.tablas.has(tabla)) return false;
        this.tablas.get(tabla).set(columna, tipoSQL);
        return true;
    }

    existeTabla(nombre) {
        return this.tablas.has(nombre);
    }

    existeColumna(tabla, columna) {
        return this.tablas.has(tabla) && this.tablas.get(tabla).has(columna);
    }

    obtenerTipoColumna(tabla, columna) {
        return this.tablas.get(tabla)?.get(columna) ?? null;
    }
}

// clase princiala
class TraductorDB {

    // craga de esquema de la BD para validación semántica
    static _cargarEsquemaDB(entorno, db) {
        return new Promise((resolve) => {
            db.all(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                [],
                (err, tables) => {
                    if (err || !tables || tables.length === 0) { resolve(); return; }
                    let pendiente = tables.length;
                    tables.forEach(t => {
                        entorno.precargarTabla(t.name);
                        db.all(`PRAGMA table_info("${t.name}")`, [], (err2, cols) => {
                            if (!err2 && cols) {
                                cols.forEach(c => {
                                    entorno.precargarColumna(t.name, c.name, c.type);
                                });
                            }
                            if (--pendiente === 0) resolve();
                        });
                    });
                }
            );
        });
    }

    /**
     * Punto de entrada principal.
     * @param {string}  entrada
     * @param {boolean} ejecutar
     * @param {object|null} db  
     * @returns {{ sql: string, errores: ErrorLSS[], resultado?: any }}
     */
    static async analizar(entrada, ejecutar = false, db = null) {
        const parserObj = ParserDB.parser;
        parserObj.yy = { errores: [] };
        parserObj.yy.parseError = function(msg, hash) {
            parserObj.yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: msg,
                linea: hash?.loc?.first_line ?? 0,
                columna: hash?.loc?.first_column ?? 0
            });
        };

        let ast    = [];
        const errores = [];

        // parseo
        try {

            const entradaNorm = entrada.trim().endsWith(';') ? entrada : entrada.trim() + ';';
            const resultado = ParserDB.parse(entradaNorm);
            ast             = resultado?.ast ?? [];
            const rawErrs   = parserObj.yy.errores ?? [];

            rawErrs.forEach(e => {
                errores.push(new ErrorLSS(
                    e.tipo        ?? 'Desconocido',
                    e.descripcion ?? e.mensaje ?? String(e),
                    e.linea       ?? 0,
                    e.columna     ?? 0
                ));
            });

        } catch (e) {
            errores.push(new ErrorLSS(
                'Fatal',
                `Error crítico de parseo: ${e.message}`,
                e.hash?.loc?.first_line   ?? 0,
                e.hash?.loc?.first_column ?? 0
            ));
            return { sql: '-- Error crítico: no se pudo parsear el archivo .db', errores };
        }

        //Fase 2: Traducción y validación semántica
        const entorno    = new EntornoDB();

        if (db) {
            await this._cargarEsquemaDB(entorno, db);
        }

        const erroresSem = [];

        const instrucciones = ast
            .filter(Boolean)
            .map(nodo => this._traducirInstruccion(nodo, entorno, erroresSem))
            .filter(sql => sql !== null);

        erroresSem.forEach(e => errores.push(e));

        const sql = instrucciones.join('\n\n');

        //Ejecución
        if (ejecutar) {
            try {
                console.warn('[TraductorDB] Ejecución habilitada pero dbExecutor no está conectado.');
            } catch (e) {
                errores.push(new ErrorLSS(
                    'Ejecución',
                    `Error al ejecutar SQL: ${e.message}`,
                    0, 0
                ));
            }
        }

        const tablaSimbolos = {
            tablas: [...entorno.tablas.entries()].map(([nombre, cols]) => ({
                nombre,
                columnas: [...cols.entries()].map(([col, tipo]) => ({ col, tipo }))
            }))
        };

        return { sql, errores, tablaSimbolos };
    }

    //traduccion por nodos con switch
    static _traducirInstruccion(nodo, entorno, erroresSem) {
        switch (nodo.tipo) {
            case 'CREATE':     return this._traducirCreate(nodo, entorno, erroresSem);
            case 'SELECT_COL': return this._traducirSelectCol(nodo, entorno, erroresSem);
            case 'INSERT':     return this._traducirInsert(nodo, entorno, erroresSem);
            case 'UPDATE':     return this._traducirUpdate(nodo, entorno, erroresSem);
            case 'DELETE':     return this._traducirDelete(nodo, entorno, erroresSem);
            default:
                erroresSem.push(new ErrorLSS(
                    'Semántico',
                    `Instrucción desconocida: "${nodo.tipo}"`,
                    nodo.linea ?? 0, 0
                ));
                return null;
        }
    }

    // creacion de tabla
    static _traducirCreate(nodo, entorno, erroresSem) {
        if (!entorno.registrarTabla(nodo.tabla)) {
            erroresSem.push(new ErrorLSS(
                'Semántico',
                `La tabla "${nodo.tabla}" ya está definida`,
                nodo.linea ?? 0, 0
            ));
            return null;
        }

        const defs = ['id INTEGER PRIMARY KEY AUTOINCREMENT'];

        (nodo.cols ?? []).forEach(col => {
            const tipoSQL = this._mapearTipo(col.tipo);
            entorno.registrarColumna(nodo.tabla, col.id, tipoSQL);
            defs.push(`${col.id} ${tipoSQL}`);
        });

        return (
`CREATE TABLE IF NOT EXISTS ${nodo.tabla} (
    ${defs.join(',\n    ')}
);`
        );
    }

    //sdeleccion de tablas y columnas
    static _traducirSelectCol(nodo, entorno, erroresSem) {
        if (!entorno.existeTabla(nodo.tabla)) {
            erroresSem.push(new ErrorLSS(
                'Semántico',
                `Tabla "${nodo.tabla}" no definida (SELECT)`,
                nodo.linea ?? 0, 0
            ));
            return null;
        }
        if (!entorno.existeColumna(nodo.tabla, nodo.col)) {
            erroresSem.push(new ErrorLSS(
                'Semántico',
                `Columna "${nodo.col}" no existe en tabla "${nodo.tabla}" (SELECT)`,
                nodo.linea ?? 0, 0
            ));
            return null;
        }
        return `SELECT ${nodo.col} FROM ${nodo.tabla} ORDER BY id;`;
    }

    //insetr en tabla
    static _traducirInsert(nodo, entorno, erroresSem) {
        if (!entorno.existeTabla(nodo.tabla)) {
            erroresSem.push(new ErrorLSS(
                'Semántico',
                `Tabla "${nodo.tabla}" no definida (INSERT)`,
                nodo.linea ?? 0, 0
            ));
            return null;
        }

        const cols = [];
        const vals = [];

        (nodo.data ?? []).forEach(d => {
            if (!entorno.existeColumna(nodo.tabla, d.col)) {
                erroresSem.push(new ErrorLSS(
                    'Semántico',
                    `Columna "${d.col}" no existe en tabla "${nodo.tabla}" (INSERT)`,
                    d.linea ?? nodo.linea ?? 0, 0
                ));
                return;
            }

            const valorEval = this._evaluarExpresion(d.val, erroresSem);
            const tipoCol   = entorno.obtenerTipoColumna(nodo.tabla, d.col);
            this._validarTipoValor(valorEval, tipoCol, d.col, nodo.tabla, d.linea ?? 0, erroresSem);

            cols.push(d.col);
            vals.push(this._formatearValor(valorEval));
        });

        if (cols.length === 0) return null;

        return `INSERT INTO ${nodo.tabla} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
    }

    //update en tabla
    static _traducirUpdate(nodo, entorno, erroresSem) {
        if (!entorno.existeTabla(nodo.tabla)) {
            erroresSem.push(new ErrorLSS(
                'Semántico',
                `Tabla "${nodo.tabla}" no definida (UPDATE)`,
                nodo.linea ?? 0, 0
            ));
            return null;
        }

        const asigs = [];

        (nodo.data ?? []).forEach(d => {
            if (!entorno.existeColumna(nodo.tabla, d.col)) {
                erroresSem.push(new ErrorLSS(
                    'Semántico',
                    `Columna "${d.col}" no existe en tabla "${nodo.tabla}" (UPDATE)`,
                    d.linea ?? nodo.linea ?? 0, 0
                ));
                return;
            }

            const valorEval = this._evaluarExpresion(d.val, erroresSem);
            const tipoCol   = entorno.obtenerTipoColumna(nodo.tabla, d.col);
            this._validarTipoValor(valorEval, tipoCol, d.col, nodo.tabla, d.linea ?? 0, erroresSem);

            asigs.push(`${d.col} = ${this._formatearValor(valorEval)}`);
        });

        if (asigs.length === 0) return null;

        const idVal = this._evaluarExpresion(nodo.id, erroresSem);
        return `UPDATE ${nodo.tabla} SET ${asigs.join(', ')} WHERE id = ${idVal};`;
    }

    // delete en ytabla
    static _traducirDelete(nodo, entorno, erroresSem) {
        if (!entorno.existeTabla(nodo.tabla)) {
            erroresSem.push(new ErrorLSS(
                'Semántico',
                `Tabla "${nodo.tabla}" no definida (DELETE)`,
                nodo.linea ?? 0, 0
            ));
            return null;
        }
        const idVal = this._evaluarExpresion(nodo.id, erroresSem);
        return `DELETE FROM ${nodo.tabla} WHERE id = ${idVal};`;
    }

    // Evalúa una expresión del AST a un valor primitivo
    static _evaluarExpresion(nodo, erroresSem) {
        if (nodo === null || nodo === undefined) return null;

        // Literales
        if (nodo.tipo === 'NUM')  return nodo.val;
        if (nodo.tipo === 'STR')  return nodo.val.replace(/^"|"$/g, '');
        if (nodo.tipo === 'BOOL') return nodo.val;
        if (nodo.tipo === 'ID')   return nodo.val;  

        // Negación unaria
        if (nodo.op === 'neg') {
            const val = this._evaluarExpresion(nodo.val, erroresSem);
            return typeof val === 'number' ? -val : val;
        }

        // Operaciones binarias
        if (nodo.op) {
            const izq = this._evaluarExpresion(nodo.izq, erroresSem);
            const der = this._evaluarExpresion(nodo.der, erroresSem);

            // Validar que ambos operandos sean numéricos
            if (typeof izq !== 'number' || typeof der !== 'number') {
                erroresSem.push(new ErrorLSS(
                    'Semántico',
                    `Operación aritmética "${nodo.op}" requiere operandos numéricos (obtenido: ${typeof izq}, ${typeof der})`,
                    nodo.linea ?? 0, 0
                ));
                return 0;
            }

            // División por cero
            if (nodo.op === '/' && der === 0) {
                erroresSem.push(new ErrorLSS(
                    'Semántico',
                    `División por cero en expresión`,
                    nodo.linea ?? 0, 0
                ));
                return 0;
            }

            switch (nodo.op) {
                case '+': return izq + der;
                case '-': return izq - der;
                case '*': return izq * der;
                case '/': return izq / der;
                default:  return 0;
            }
        }

        return nodo;
    }

    // validacion por tipś
    static _validarTipoValor(valor, tipoSQL, columna, tabla, linea, erroresSem) {
        if (valor === null || valor === undefined) return;
        if (tipoSQL === null) return; 

        const esNumero  = typeof valor === 'number';
        const esString  = typeof valor === 'string';
        const esBoolean = typeof valor === 'boolean';

        let ok = true;
        switch (tipoSQL) {
            case 'INTEGER': ok = esNumero || esBoolean; break;
            case 'REAL':    ok = esNumero;              break;
            case 'TEXT':    ok = esString;              break;
        }

        if (!ok) {
            erroresSem.push(new ErrorLSS(
                'Semántico',
                `Tipo incompatible en columna "${columna}" de tabla "${tabla}": se esperaba ${tipoSQL}, se obtuvo ${typeof valor}`,
                linea, 0
            ));
        }
    }

    //helpers

    static _mapearTipo(token) {
        switch (token) {
            case 'TYPE_INT':     return 'INTEGER';
            case 'TYPE_STRING':  return 'TEXT';
            case 'TYPE_NUMBER':  return 'REAL';
            case 'TYPE_FLOAT':   return 'REAL';
            case 'TYPE_DOUBLE':  return 'REAL';
            case 'TYPE_BOOLEAN': return 'INTEGER';
            default:             return 'TEXT';
        }
    }

    /** Formatea un valor JS evaluado para uso en SQL */
    static _formatearValor(valor) {
        if (valor === null || valor === undefined) return 'NULL';
        if (typeof valor === 'boolean') return valor ? 1 : 0;
        if (typeof valor === 'number')  return valor;
        if (typeof valor === 'string') {
            const limpio = valor.replace(/^"|"$/g, '');
            return `'${limpio.replace(/'/g, "''")}'`;
        }
        return String(valor);
    }
}

module.exports = TraductorDB;
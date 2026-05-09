'use strict';

/**
 * TraductorPrincipal.js
 * Traductor del lenguaje .y → JavaScript ejecutable en navegador
 */

const fs      = require('fs');
const path    = require('path');
const Parser  = require('../Analizadores/PrincipalJison');
const ErrorLSS = require('./Errores');

/* ════════════════════════════════════════════════════════════
   TABLA DE SÍMBOLOS
   ════════════════════════════════════════════════════════════ */
class EntornoPrincipal {
    constructor(padre = null) {
        this.variables = new Map();
        this.funciones = new Map(); 
        this.padre     = padre;
    }

    registrarVariable(id, tipoDato, isArray = false) {
        if (this.variables.has(id)) return false;
        this.variables.set(id, { tipoDato, isArray });
        return true;
    }

    existeVariable(id) {
        if (this.variables.has(id)) return true;
        if (this.padre)             return this.padre.existeVariable(id);
        return false;
    }

    registrarFuncion(id, paramsCount) {
        const raiz = this._raiz();
        if (raiz.funciones.has(id)) return false;
        raiz.funciones.set(id, { paramsCount });
        return true;
    }

    existeFuncion(id) {
        return this._raiz().funciones.has(id);
    }

    _raiz() {
        let e = this;
        while (e.padre) e = e.padre;
        return e;
    }
}

/* ════════════════════════════════════════════════════════════
   CLASE PRINCIPAL
   ════════════════════════════════════════════════════════════ */
class TraductorPrincipal {

    /**
     * Punto de entrada.
     * @param {string} entrada      Código fuente .y
     * @param {string} rutaActual   Ruta absoluta del archivo .y (para resolver imports)
     * @returns {{ js: string, errores: ErrorLSS[] }}
     */
    static analizar(entrada, rutaActual = process.cwd()) {

        const parserObj = Parser.parser;

        // 1. Inicializar yy con errores vacío en el parser REAL
        parserObj.yy = { errores: [] };

        // 2. Parchear performAction del lexer para garantizar yy.errores en
        const _lexerPA = parserObj.lexer.performAction;
        parserObj.lexer.performAction = function(yy, yy_, idx, YY_START) {
            if (!yy.errores) yy.errores = [];
            return _lexerPA.call(this, yy, yy_, idx, YY_START);
        };

        // 3. Sobreescribir parseError para acumular en vez de lanzar excepción
        parserObj.yy.parseError = function(msg, hash) {
            if (!parserObj.yy.errores) parserObj.yy.errores = [];
            parserObj.yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: msg,
                linea: hash?.loc?.first_line ?? 0,
                columna: hash?.loc?.first_column ?? 0
            });
        };

        let ast    = null;
        const errores = [];

        /* ── Fase 1: Parseo ── */
        try {
            const resultado = Parser.parse(entrada);
            ast             = resultado?.ast ?? null;
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
            return { js: '// Error crítico: no se pudo parsear el archivo .y', errores };
        }

        if (!ast) {
            errores.push(new ErrorLSS('Fatal', 'AST vacío — la traducción fue abortada', 0, 0));
            return { js: '// Error: AST no generado', errores };
        }

        /* ── Fase 2: Traducción + semántica ── */
        const entorno    = new EntornoPrincipal();
        const erroresSem = [];

        const js = this._generarJS(ast, rutaActual, entorno, erroresSem);

        erroresSem.forEach(e => errores.push(e));

        const tablaSimbolos = {
            variables: [...entorno._raiz().variables.entries()].map(([id, v]) => ({ id, ...v })),
            funciones: [...entorno._raiz().funciones.entries()].map(([id, v]) => ({ id, ...v }))
        };

        return { js, errores, tablaSimbolos };
    }

    /* ── Genera el JS completo ── */
    static _generarJS(ast, rutaActual, entorno, erroresSem) {
        const lineas = [];

        lineas.push('// -- ARCHIVO PRINCIPAL GENERADO --\n');

        /* Imports */
        lineas.push(this._procesarImports(ast.imports, rutaActual, erroresSem));

        // Todo va dentro de un async DOMContentLoaded para que:
        // 1) los `await ejecutarSQL(...)` globales sean válidos
        // 2) las funciones puedan acceder a las variables globales
        lineas.push('document.addEventListener("DOMContentLoaded", async () => {');

        /* Variables globales (dentro del callback async) */
        lineas.push('    // Variables Globales');
        (ast.globales ?? []).filter(Boolean).forEach(g => {
            const linea = this._traducirDeclaracion(g, entorno, erroresSem, false);
            if (linea) lineas.push('    ' + linea);
        });
        lineas.push('');

        /* Funciones (dentro del callback para acceder a variables globales) */
        lineas.push('    // Funciones');
        (ast.funciones ?? []).filter(Boolean).forEach(f => {
            const bloque = this._traducirFuncion(f, entorno, erroresSem);
            if (bloque) {
                bloque.split('\n').forEach(l => lineas.push('    ' + l));
                lineas.push('');
            }
        });

        /* Main */
        lineas.push('    // -- Bloque Principal --');
        lineas.push('    let __html = "";');
        lineas.push('');

        (ast.main ?? []).filter(Boolean).forEach(inst => {
            const linea = this._traducirInstruccionMain(inst, entorno, erroresSem, 1);
            if (linea) lineas.push(linea);
        });

        lineas.push('');
        lineas.push('    document.body.innerHTML = __html;');
        lineas.push('});')

        return lineas.join('\n');
    }

    /* ══════════════════════════════════════════════════════════
       IMPORTS
       ══════════════════════════════════════════════════════════ */
    static _procesarImports(imports, rutaActual, erroresSem) {
        if (!imports || imports.length === 0) return '';
        const lineas = ['// Imports'];

        imports.forEach(imp => {
            if (!imp) return;
            const rutaRel = imp.path.trim().replace(/\\/g, '/');
            const rutaAbs = path.resolve(path.dirname(rutaActual), rutaRel);

            if (!fs.existsSync(rutaAbs)) {
                erroresSem.push(new ErrorLSS(
                    'Semántico',
                    `Archivo importado no encontrado: "${rutaRel}"`,
                    imp.linea ?? 0, 0
                ));
                lineas.push(`// [!] IMPORT NO ENCONTRADO: ${rutaRel}`);
            } else {
                lineas.push(`// [OK] import "${rutaRel}"`);
            }
        });

        lineas.push('');
        return lineas.join('\n');
    }

    /* ══════════════════════════════════════════════════════════
       UTILIDAD DE BASE DE DATOS
       ══════════════════════════════════════════════════════════ */
    static _prepararQuery(query) {
        if (!query) return '';
        return query.replace(/\$([a-zA-Z0-9_]+)/g, '${$1}');
    }

    /* ══════════════════════════════════════════════════════════
       FUNCIONES
       ══════════════════════════════════════════════════════════ */
    static _traducirFuncion(f, entornoGlobal, erroresSem) {
        if (!f) return null;

        const paramsCount = f.params?.length ?? 0;
        if (!entornoGlobal.registrarFuncion(f.id, paramsCount)) {
            erroresSem.push(new ErrorLSS(
                'Semántico',
                `La función "${f.id}" ya está definida`,
                f.linea ?? 0, 0
            ));
            return null;
        }

        const entornoLocal = new EntornoPrincipal(entornoGlobal);
        (f.params ?? []).forEach(p => {
            entornoLocal.registrarVariable(p.id, p.tipo);
        });

        const params = (f.params ?? []).map(p => p.id).join(', ');

        const cuerpo = (f.body ?? [])
            .filter(Boolean)
            .map(inst => this._traducirInstruccionFuncion(inst, erroresSem))
            .filter(Boolean)
            .map(l => `    ${l}`)
            .join('\n');

        return `async function ${f.id}(${params}) {\n${cuerpo}\n}`;
    }

    static _traducirInstruccionFuncion(inst, erroresSem) {
        switch (inst.tipo) {
            case 'EXECUTE': {
                const queryFuncion = this._prepararQuery(inst.query);
                return (
`try {
        await ejecutarSQL(\`${queryFuncion}\`);
    } catch (__err) {
        alert("Error DB: " + __err.message);
        return;
    }`
                );
            }
            case 'LOAD':
                return `window.location.href = ${this._traducirExpresion(inst.path)};`;
            default:
                erroresSem.push(new ErrorLSS(
                    'Semántico',
                    `Instrucción "${inst.tipo}" no permitida dentro de función`,
                    inst.linea ?? 0, 0
                ));
                return null;
        }
    }

    /* ══════════════════════════════════════════════════════════
       INSTRUCCIONES MAIN / BLOQUES
       ══════════════════════════════════════════════════════════ */
    static _traducirInstruccionMain(inst, entorno, erroresSem, nivel = 1) {
        if (!inst) return null;
        const ind = '    '.repeat(nivel);
        let codigo = '';

        switch (inst.tipo) {
            case 'DECLARACION':
            case 'DECLARACION_ARR_VACIO':
            case 'DECLARACION_ARR_VALORES':
            case 'DECLARACION_ARR_DB':
                codigo = this._traducirDeclaracion(inst, entorno, erroresSem, true);
                break;

            case 'ASIGNACION':
                if (!entorno.existeVariable(inst.id)) {
                    erroresSem.push(new ErrorLSS(
                        'Semántico',
                        `Asignación a variable no declarada: "${inst.id}"`,
                        inst.linea ?? 0, 0
                    ));
                }
                codigo = `${inst.id} = ${this._traducirExpresion(inst.exp)};`;
                break;

            case 'ASIGNACION_ARR':
                if (!entorno.existeVariable(inst.id)) {
                    erroresSem.push(new ErrorLSS(
                        'Semántico',
                        `Asignación a arreglo no declarado: "${inst.id}"`,
                        inst.linea ?? 0, 0
                    ));
                }
                codigo = `${inst.id}[${this._traducirExpresion(inst.index)}] = ${this._traducirExpresion(inst.exp)};`;
                break;

            case 'COMP_CALL': {
                const args = (inst.args ?? [])
                    .map(a => this._traducirExpresion(a))
                    .join(', ');
                codigo = `__html += (typeof ${inst.id} === "function") ? ${inst.id}(${args}) : "";`;
                break;
            }

            case 'EXECUTE': {
                const queryMain = this._prepararQuery(inst.query);
                codigo = (
`try {
${ind}    await ejecutarSQL(\`${queryMain}\`);
${ind}} catch (__err) {
${ind}    alert("Error DB: " + __err.message);
${ind}}`
                );
                return `${ind}${codigo}`;
            }

            case 'IF':       return this._traducirIf(inst, entorno, erroresSem, nivel);
            case 'SWITCH':   return this._traducirSwitch(inst, entorno, erroresSem, nivel);
            case 'WHILE':    return this._traducirWhile(inst, entorno, erroresSem, nivel);
            case 'DO_WHILE': return this._traducirDoWhile(inst, entorno, erroresSem, nivel);
            case 'FOR':      return this._traducirFor(inst, entorno, erroresSem, nivel);
            case 'BREAK':    return `${ind}break;`;
            case 'CONTINUE': return `${ind}continue;`;

            default:
                erroresSem.push(new ErrorLSS(
                    'Semántico',
                    `Instrucción desconocida: "${inst.tipo}"`,
                    inst.linea ?? 0, 0
                ));
                return null;
        }

        return codigo ? `${ind}${codigo}` : null;
    }

    /* ── Declaraciones ── */
    static _traducirDeclaracion(inst, entorno, erroresSem, esLocal) {
        const kw = 'let';

        switch (inst.tipo) {
            case 'DECLARACION': {
                if (!entorno.registrarVariable(inst.id, inst.tipoDato)) {
                    erroresSem.push(new ErrorLSS(
                        'Semántico',
                        `Variable "${inst.id}" ya declarada`,
                        inst.linea ?? 0, 0
                    ));
                    return `/* variable duplicada: ${inst.id} */`;
                }
                const val = inst.exp ? this._traducirExpresion(inst.exp) : 'null';
                return `${kw} ${inst.id} = ${val};`;
            }

            case 'DECLARACION_ARR_VACIO': {
                if (!entorno.registrarVariable(inst.id, inst.tipoDato, true)) {
                    erroresSem.push(new ErrorLSS(
                        'Semántico',
                        `Arreglo "${inst.id}" ya declarado`,
                        inst.linea ?? 0, 0
                    ));
                    return `/* arreglo duplicado: ${inst.id} */`;
                }
                return `${kw} ${inst.id} = new Array(${this._traducirExpresion(inst.size)});`;
            }

            case 'DECLARACION_ARR_VALORES': {
                if (!entorno.registrarVariable(inst.id, inst.tipoDato, true)) {
                    erroresSem.push(new ErrorLSS(
                        'Semántico',
                        `Arreglo "${inst.id}" ya declarado`,
                        inst.linea ?? 0, 0
                    ));
                    return `/* arreglo duplicado: ${inst.id} */`;
                }
                const vals = (inst.vals ?? []).map(v => this._traducirExpresion(v)).join(', ');
                return `${kw} ${inst.id} = [${vals}];`;
            }

            case 'DECLARACION_ARR_DB': {
                const queryArr = this._prepararQuery(inst.query);
                if (!entorno.registrarVariable(inst.id, inst.tipoDato, true)) {
                    erroresSem.push(new ErrorLSS(
                        'Semántico',
                        `Arreglo "${inst.id}" ya declarado`,
                        inst.linea ?? 0, 0
                    ));
                    return `/* arreglo duplicado: ${inst.id} */`;
                }
                return `${kw} ${inst.id} = await ejecutarSQL(\`${queryArr}\`);`;
            }

            default: return null;
        }
    }

    /* ── If / else if / else ── */
    static _traducirIf(nodo, entorno, erroresSem, nivel) {
        const ind    = '    '.repeat(nivel);
        const cond   = this._traducirExpresion(nodo.cond);
        const cuerpo = this._traducirBloque(nodo.body, entorno, erroresSem, nivel + 1);

        let codigo = `${ind}if (${cond}) {\n${cuerpo}\n${ind}}`;

        (nodo.elseifs ?? []).forEach(ei => {
            const eiCond   = this._traducirExpresion(ei.cond);
            const eiCuerpo = this._traducirBloque(ei.body, entorno, erroresSem, nivel + 1);
            codigo += ` else if (${eiCond}) {\n${eiCuerpo}\n${ind}}`;
        });

        if (nodo.elseBody) {
            const elseCuerpo = this._traducirBloque(nodo.elseBody, entorno, erroresSem, nivel + 1);
            codigo += ` else {\n${elseCuerpo}\n${ind}}`;
        }

        return codigo;
    }

    /* ── Switch ── */
    static _traducirSwitch(nodo, entorno, erroresSem, nivel) {
        const ind  = '    '.repeat(nivel);
        const ind1 = '    '.repeat(nivel + 1);
        const ind2 = '    '.repeat(nivel + 2);

        const expr = this._traducirExpresion(nodo.exp);
        let codigo = `${ind}switch (${expr}) {\n`;

        const cases = nodo.cases ?? [];
        for (let i = 0; i < cases.length; i++) {
            const c   = cases[i];
            const val = this._traducirExpresion(c.val);
            codigo   += `${ind1}case ${val}:\n`;

            if (!c.fallThrough) {
                const body = this._traducirBloque(c.body, entorno, erroresSem, nivel + 2);
                if (body) codigo += `${body}\n`;
                codigo += `${ind2}break;\n`;
            }
        }

        if (nodo.def) {
            const defBody = this._traducirBloque(nodo.def, entorno, erroresSem, nivel + 2);
            codigo += `${ind1}default:\n${defBody}\n${ind2}break;\n`;
        }

        codigo += `${ind}}`;
        return codigo;
    }

    /* ── While ── */
    static _traducirWhile(nodo, entorno, erroresSem, nivel) {
        const ind    = '    '.repeat(nivel);
        const cond   = this._traducirExpresion(nodo.cond);
        const cuerpo = this._traducirBloque(nodo.body, entorno, erroresSem, nivel + 1);
        return `${ind}while (${cond}) {\n${cuerpo}\n${ind}}`;
    }

    /* ── Do-While ── */
    static _traducirDoWhile(nodo, entorno, erroresSem, nivel) {
        const ind    = '    '.repeat(nivel);
        const cond   = this._traducirExpresion(nodo.cond);
        const cuerpo = this._traducirBloque(nodo.body, entorno, erroresSem, nivel + 1);
        return `${ind}do {\n${cuerpo}\n${ind}} while (${cond});`;
    }

    /* ── For ── */
    static _traducirFor(nodo, entorno, erroresSem, nivel) {
        const ind        = '    '.repeat(nivel);
        const entornoFor = new EntornoPrincipal(entorno);

        let init = '';
        if (nodo.init) {
            if (nodo.init.tipo === 'DECLARACION') {
                entornoFor.registrarVariable(nodo.init.id, nodo.init.tipoDato);
                init = `let ${nodo.init.id} = ${this._traducirExpresion(nodo.init.exp)}`;
            } else {
                init = `${nodo.init.id} = ${this._traducirExpresion(nodo.init.exp)}`;
            }
        }

        const cond = this._traducirExpresion(nodo.cond);

        let inc = '';
        if (nodo.inc) {
            inc = `${nodo.inc.id} = ${this._traducirExpresion(nodo.inc.exp)}`;
        }

        const cuerpo = this._traducirBloque(nodo.body, entornoFor, erroresSem, nivel + 1);
        return `${ind}for (${init}; ${cond}; ${inc}) {\n${cuerpo}\n${ind}}`;
    }

    /* ── Bloque de instrucciones ── */
    static _traducirBloque(instrucciones, entorno, erroresSem, nivel) {
        return (instrucciones ?? [])
            .filter(Boolean)
            .map(i => this._traducirInstruccionMain(i, entorno, erroresSem, nivel))
            .filter(Boolean)
            .join('\n');
    }

    /* ══════════════════════════════════════════════════════════
       EXPRESIONES
       ══════════════════════════════════════════════════════════ */
    static _traducirExpresion(e) {
        if (!e && e !== 0 && e !== false) return '';
        if (typeof e === 'string' || typeof e === 'number') return String(e);

        switch (e.tipo) {
            case 'ID':             return e.val;
            case 'NUM':            return String(e.val);
            case 'CADENA':         return `"${e.val}"`;
            case 'CHAR':           return `'${e.val}'`;
            case 'BOOL':           return e.val ? 'true' : 'false';
            case 'ARREGLO_ACCESO': return `${e.id}[${this._traducirExpresion(e.index)}]`;
            case 'BINARIA':
                return `(${this._traducirExpresion(e.izq)} ${e.op} ${this._traducirExpresion(e.der)})`;
            case 'UNARIA':
                return `${e.op}(${this._traducirExpresion(e.der)})`;
            default:
                return '';
        }
    }
}

module.exports = TraductorPrincipal;
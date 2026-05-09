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
        // Las funciones siempre se registran en el entorno raíz
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
        Parser.yy = { errores: [] };
        Parser.yy.parseError = function(msg, hash) {
            Parser.yy.errores.push({
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
            const rawErrs   = Parser.yy.errores ?? [];

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
        return { js, errores };
    }

    /* ── Genera el JS completo ── */
    static _generarJS(ast, rutaActual, entorno, erroresSem) {
        const lineas = [];

        lineas.push('// ── ARCHIVO PRINCIPAL GENERADO ──\n');

        /* Imports */
        lineas.push(this._procesarImports(ast.imports, rutaActual, erroresSem));

        /* Variables globales */
        lineas.push('// Variables Globales');
        (ast.globales ?? []).filter(Boolean).forEach(g => {
            const linea = this._traducirDeclaracion(g, entorno, erroresSem, false);
            if (linea) lineas.push(linea);
        });
        lineas.push('');

        /* Funciones */
        lineas.push('// Funciones');
        (ast.funciones ?? []).filter(Boolean).forEach(f => {
            const bloque = this._traducirFuncion(f, entorno, erroresSem);
            if (bloque) lineas.push(bloque);
        });
        lineas.push('');

        /* Main */
        lineas.push('// ── Función Principal ──');
        lineas.push('document.addEventListener("DOMContentLoaded", () => {');
        lineas.push('    let __html = "";');
        lineas.push('');

        (ast.main ?? []).filter(Boolean).forEach(inst => {
            const linea = this._traducirInstruccionMain(inst, entorno, erroresSem, 1);
            if (linea) lineas.push(linea);
        });

        lineas.push('');
        lineas.push('    document.body.innerHTML = __html;');
        lineas.push('});');

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
                lineas.push(`// ⚠ IMPORT NO ENCONTRADO: ${rutaRel}`);
            } else {
                lineas.push(`// ✔ import "${rutaRel}"`);
            }
        });

        lineas.push('');
        return lineas.join('\n');
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

        /* Entorno local de la función: registrar parámetros */
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

        return `function ${f.id}(${params}) {\n${cuerpo}\n}`;
    }

    static _traducirInstruccionFuncion(inst, erroresSem) {
        switch (inst.tipo) {
            case 'EXECUTE':
                return (
`try {
        ejecutarSQL(\`${inst.query}\`);
    } catch (__err) {
        alert("Error DB: " + __err.message);
        return;
    }`
                );
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

    /**
     * Traduce una instrucción y la indenta n niveles.
     * @param {object} inst   Nodo AST
     * @param {EntornoPrincipal} entorno
     * @param {ErrorLSS[]} erroresSem
     * @param {number} nivel  Niveles de indentación (1 = 4 espacios)
     */
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

            /* FIX: COMP_CALL con args posicionales correctos */
            case 'COMP_CALL': {
                const args = (inst.args ?? [])
                    .map(a => this._traducirExpresion(a))
                    .join(', ');
                codigo = `__html += (typeof ${inst.id} === "function") ? ${inst.id}(${args}) : "";`;
                break;
            }

            case 'EXECUTE':
                codigo = (
`try {
${ind}    ejecutarSQL(\`${inst.query}\`);
${ind}} catch (__err) {
${ind}    alert("Error DB: " + __err.message);
${ind}}`
                );
                return `${ind}${codigo}`;

            case 'IF':      codigo = this._traducirIf(inst, entorno, erroresSem, nivel);      return codigo;
            case 'SWITCH':  codigo = this._traducirSwitch(inst, entorno, erroresSem, nivel);   return codigo;
            case 'WHILE':   codigo = this._traducirWhile(inst, entorno, erroresSem, nivel);    return codigo;
            case 'DO_WHILE':codigo = this._traducirDoWhile(inst, entorno, erroresSem, nivel);  return codigo;
            case 'FOR':     codigo = this._traducirFor(inst, entorno, erroresSem, nivel);      return codigo;
            case 'BREAK':   return `${ind}break;`;
            case 'CONTINUE':return `${ind}continue;`;

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
        const kw = esLocal ? 'let' : 'let';

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
                if (!entorno.registrarVariable(inst.id, inst.tipoDato, true)) {
                    erroresSem.push(new ErrorLSS(
                        'Semántico',
                        `Arreglo "${inst.id}" ya declarado`,
                        inst.linea ?? 0, 0
                    ));
                    return `/* arreglo duplicado: ${inst.id} */`;
                }
                return `${kw} ${inst.id} = ejecutarSQL(\`${inst.query}\`);`;
            }

            default: return null;
        }
    }

    /* ── If / else if / else ── */
    static _traducirIf(nodo, entorno, erroresSem, nivel) {
        const ind    = '    '.repeat(nivel);
        const indIn  = '    '.repeat(nivel + 1);

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
        const ind   = '    '.repeat(nivel);
        const ind1  = '    '.repeat(nivel + 1);
        const ind2  = '    '.repeat(nivel + 2);

        const expr  = this._traducirExpresion(nodo.exp);
        let codigo  = `${ind}switch (${expr}) {\n`;

        /* FIX: manejo de fall-through entre cases */
        const cases = nodo.cases ?? [];
        for (let i = 0; i < cases.length; i++) {
            const c    = cases[i];
            const val  = this._traducirExpresion(c.val);
            codigo    += `${ind1}case ${val}:\n`;

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
        const ind     = '    '.repeat(nivel);
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

        /* Condición */
        const cond = this._traducirExpresion(nodo.cond);

        /* Incremento*/
        let inc = '';
        if (nodo.inc) {
            inc = `${nodo.inc.id} = ${this._traducirExpresion(nodo.inc.exp)}`;
        }

        const cuerpo = this._traducirBloque(nodo.body, entornoFor, erroresSem, nivel + 1);
        return `${ind}for (${init}; ${cond}; ${inc}) {\n${cuerpo}\n${ind}}`;
    }

    /* ── Traduce un bloque de instrucciones ── */
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
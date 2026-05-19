'use strict';

/**
 * Traductor del lenguaje .y → JavaScript ejecutable en navegador
 */

const fs      = require('fs');
const path    = require('path');
const Parser  = require('../Analizadores/PrincipalJison');
const ErrorLSS = require('./Errores');

//tabla de simpbolos para le lenguaje principal
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

// cvlase pricipal
class TraductorPrincipal {

    /**
     * Punto de entrada.
     * @param {string} entrada      Código fuente .y
     * @param {string} rutaActual   Ruta absoluta del archivo .y
     * @returns {{ js: string, errores: ErrorLSS[] }}
     */
    static analizar(entrada, rutaActual = process.cwd(), archivosEnMemoria = null) {

        const parserObj = Parser.parser;

        // Inicializar yy con errores vacío en el parser
        parserObj.yy = { errores: [] };

        //Parchear performAction del lexer para garantizar yy.errores 
        const _lexerPA = parserObj.lexer.performAction;
        parserObj.lexer.performAction = function(yy, yy_, idx, YY_START) {
            if (!yy.errores) yy.errores = [];
            return _lexerPA.call(this, yy, yy_, idx, YY_START);
        };

        // Sobreescribir parseError para acumular 
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

        //parseo
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

        //Traducción y revision semántica
        const entorno    = new EntornoPrincipal();
        const erroresSem = [];

        const js = this._generarJS(ast, rutaActual, entorno, erroresSem, archivosEnMemoria);

        erroresSem.forEach(e => errores.push(e));

        const tablaSimbolos = {
            variables: [...entorno._raiz().variables.entries()].map(([id, v]) => ({ id, ...v })),
            funciones: [...entorno._raiz().funciones.entries()].map(([id, v]) => ({ id, ...v }))
        };

        return { js, errores, tablaSimbolos };
    }

    //genera el js completo
    static _generarJS(ast, rutaActual, entorno, erroresSem, archivosEnMemoria = null) {
        const lineas = [];

        lineas.push('// -- ARCHIVO PRINCIPAL GENERADO --\n');

        //reguisra el componente de lso immports
        lineas.push(this._procesarImports(ast.imports, rutaActual, erroresSem, entorno, archivosEnMemoria));

        // Todo va dentro de un async DOMContentLoaded
        lineas.push('document.addEventListener("DOMContentLoaded", async () => {');

        //Variables globales
        lineas.push('    // Variables Globales');
        (ast.globales ?? []).filter(Boolean).forEach(g => {
            const linea = this._traducirDeclaracion(g, entorno, erroresSem, false);
            if (linea) lineas.push('    ' + linea);
        });
        lineas.push('');

        //Funciones 
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

    //Manejo de los importa
    static _procesarImports(imports, rutaActual, erroresSem, entorno, archivosEnMemoria = null) {
        if (!imports || imports.length === 0) return '';
        const lineas = ['// Imports'];

        imports.forEach(imp => {
            if (!imp) return;
            const rutaRel = imp.path.trim().replace(/\\/g, '/');

            // Primero intentar resolución en memoria (IDE/navegador)
            const rutaNorm = this._resolverRuta(rutaActual, rutaRel);
            const enMemoria = archivosEnMemoria?.has(rutaNorm);

            // Fallback: disco (ejecución directa con node)
            const rutaAbs  = path.resolve(path.dirname(rutaActual), rutaRel);
            const enDisco  = !enMemoria && fs.existsSync(rutaAbs);

            if (!enMemoria && !enDisco) {
                erroresSem.push(new ErrorLSS(
                    'Semántico',
                    `Archivo importado no encontrado: "${rutaRel}"`,
                    imp.linea ?? 0, 0
                ));
                lineas.push(`// [!] IMPORT NO ENCONTRADO: ${rutaRel}`);
                return;
            }

            lineas.push(`// [OK] import "${rutaRel}"`);

            const ext = rutaRel.split('.').pop()?.toLowerCase();
            if (ext === 'comp' && entorno) {
                if (enMemoria) {
                    // Usar el contenido que ya está en memoria
                    const contenido = archivosEnMemoria.get(rutaNorm);
                    this._registrarComponentesDeContenido(contenido, entorno);
                } else {
                    // Leer del disco 
                    this._registrarComponentesDeImport(rutaAbs, entorno, erroresSem);
                }
            }
        });

        lineas.push('');
        return lineas.join('\n');
    }

    //Resuelve una ruta relativa 
    static _resolverRuta(rutaActual, rutaRel) {
        const dir    = rutaActual.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
        const joined = dir ? `${dir}/${rutaRel.replace(/^\.\//, '')}` : rutaRel.replace(/^\.\//, '');
        // Normalizar /, .. y .
        const partes  = joined.split('/');
        const result  = [];
        for (const p of partes) {
            if (p === '..') result.pop();
            else if (p !== '.')  result.push(p);
        }
        return result.join('/');
    }

    //registra componentes desde contenido en memoria
    static _registrarComponentesDeContenido(contenido, entorno) {
        try {
            const CompParser = require('../Analizadores/ComponentsJison');
            CompParser.parser.yy = { errores: [], componentesDefinidos: new Set() };
            CompParser.parser.yy.parseError = () => {};
            const resultado = CompParser.parse(contenido);
            (resultado?.ast ?? []).filter(Boolean).forEach(comp => {
                if (comp.id) entorno.registrarFuncion(comp.id, comp.params?.length ?? 0);
            });
        } catch (_e) {}
    }

    //Registra componentes desde disco 
    static _registrarComponentesDeImport(rutaAbs, entorno, erroresSem) {
        try {
            const CompParser = require('../Analizadores/ComponentsJison');
            CompParser.parser.yy = { errores: [], componentesDefinidos: new Set() };
            CompParser.parser.yy.parseError = () => {};
            const contenido = fs.readFileSync(rutaAbs, 'utf-8');
            const resultado = CompParser.parse(contenido);
            (resultado?.ast ?? []).filter(Boolean).forEach(comp => {
                if (comp.id) entorno.registrarFuncion(comp.id, comp.params?.length ?? 0);
            });
        } catch (_e) {}
    }

    // Base de datos
    static _prepararQuery(query) {
        if (!query) return '';
        // __q() wraps strings in quotes and leaves numbers bare — see motor._runtimeSQL
        return query.replace(/\$([a-zA-Z0-9_]+)/g, '${__q($1)}');
    }

    //funciones
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

        return `window.${f.id} = async function(${params}) {\n${cuerpo}\n};`;
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

    //instruccion manin
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

                //  el componente debe estar importado
                if (!entorno.existeFuncion(inst.id)) {
                    erroresSem.push(new ErrorLSS(
                        'Semántico',
                        `Componente "@${inst.id}" no definido. Asegúrate de importar el archivo .comp que lo contiene.`,
                        inst.linea ?? 0, 0
                    ));
                }

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

    //Declaraciones 
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

    //manejos de los if
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

    //manejo de switch
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

    // While
    static _traducirWhile(nodo, entorno, erroresSem, nivel) {
        const ind    = '    '.repeat(nivel);
        const cond   = this._traducirExpresion(nodo.cond);
        const cuerpo = this._traducirBloque(nodo.body, entorno, erroresSem, nivel + 1);
        return `${ind}while (${cond}) {\n${cuerpo}\n${ind}}`;
    }

    // Do-While
    static _traducirDoWhile(nodo, entorno, erroresSem, nivel) {
        const ind    = '    '.repeat(nivel);
        const cond   = this._traducirExpresion(nodo.cond);
        const cuerpo = this._traducirBloque(nodo.body, entorno, erroresSem, nivel + 1);
        return `${ind}do {\n${cuerpo}\n${ind}} while (${cond});`;
    }

    //for
    static _traducirFor(nodo, entorno, erroresSem, nivel) {
        const ind        = '    '.repeat(nivel);
        const entornoFor = new EntornoPrincipal(entorno);

        let init = '';
        if (nodo.init) {
            if (nodo.init.tipo === 'DECLARACION') {
                entornoFor.registrarVariable(nodo.init.id, nodo.init.tipoDato);
                init = `let ${nodo.init.id} = ${this._traducirExpresion(nodo.init.exp)}`;
            } else {
                // Si la variable no estaba declarada, declararla en el scope del for
                if (!entorno.existeVariable(nodo.init.id)) {
                    entornoFor.registrarVariable(nodo.init.id, 'int');
                    init = `let ${nodo.init.id} = ${this._traducirExpresion(nodo.init.exp)}`;
                } else {
                    init = `${nodo.init.id} = ${this._traducirExpresion(nodo.init.exp)}`;
                }
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

    // bloque d einstrucciones
    static _traducirBloque(instrucciones, entorno, erroresSem, nivel) {
        return (instrucciones ?? [])
            .filter(Boolean)
            .map(i => this._traducirInstruccionMain(i, entorno, erroresSem, nivel))
            .filter(Boolean)
            .join('\n');
    }

    //expresiones
    static _traducirExpresion(e) {
        if (!e && e !== 0 && e !== false) return '';
        if (typeof e === 'string' || typeof e === 'number') return String(e);

        switch (e.tipo) {
            case 'ID':             return e.val;
            case 'NUM':            return String(e.val);
            case 'CADENA': {
                const raw = e.val;

                const hasVar  = /\$[a-zA-Z0-9_]+/.test(raw);
                const hasExpr = /`[^`]+`/.test(raw);
                if (hasVar || hasExpr) {

                    let body = raw
                        .replace(/\\/g, '\\\\')
                        .replace(/`/g,  '\\`');

                    body = body.replace(/\\`([^\\`]+)\\`/g, (_, inner) => `\${${inner.replace(/\$/g, '')}}`);

                    body = body.replace(/\$([a-zA-Z0-9_]+(?:\[[^\]]*\])?)/g, '${$1}');
                    return `\`${body}\``;
                }

                const safe = raw
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g,  '\\"')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r');
                return `"${safe}"`;
            }
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
'use strict';

/**
 * traductorComponentes.js
 * Traductor del lenguaje .comp → JavaScript (template literals HTML)
 */

const Parser   = require('../Analizadores/ComponentsJison');
const ErrorLSS = require('./Errores');

/* ════════════════════════════════════════════════════════════
   TABLA DE SÍMBOLOS
   ════════════════════════════════════════════════════════════ */
class Simbolo {
    constructor(id, tipo, linea = 0) {
        this.id    = id;
        this.tipo  = tipo;
        this.linea = linea;
    }
}

class Entorno {
    constructor(padre = null) {
        this.tabla = new Map();
        this.padre = padre;
    }

    guardar(id, tipo, linea = 0) {
        this.tabla.set(id, new Simbolo(id, tipo, linea));
    }

    obtener(id) {
        let env = this;
        while (env) {
            if (env.tabla.has(id)) return env.tabla.get(id);
            env = env.padre;
        }
        return null;
    }
}

/* ════════════════════════════════════════════════════════════
   CLASE PRINCIPAL
   ════════════════════════════════════════════════════════════ */
class TraductorComponentes {

    /**
     * Punto de entrada.
     * @param {string} entrada  Código fuente .comp
     * @returns {{ js: string, errores: ErrorLSS[] }}
     */
    static analizar(entrada) {
        const parserObj = Parser.parser;
        parserObj.yy = { errores: [], componentesDefinidos: new Set() };
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

        /* ── Fase 1: Parseo ── */
        try {
            const resultado = Parser.parse(entrada);
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
            return { js: '// Error crítico: no se pudo parsear el archivo .comp', errores };
        }

        /* ── Fase 2: Traducción + análisis semántico ── */
        const entornoGlobal = new Entorno();
        const erroresSem    = [];

        const bloques = ast
            .filter(Boolean)
            .map(c => TraductorComponentes._generarComponente(c, entornoGlobal, erroresSem));

        erroresSem.forEach(e => errores.push(e));

        const tablaSimbolos = {
            componentes: ast.filter(Boolean).map(c => ({
                id:     c.id,
                params: (c.params ?? []).map(p => ({ id: p.id, tipo: p.tipo ?? 'any' }))
            }))
        };

        const js = bloques.join('\n');
        return { js, errores, tablaSimbolos };
    }

    /* ── Genera la función JS de un componente ── */
    static _generarComponente(comp, entornoPadre, erroresSem) {
        const nombre      = comp.id;
        const entorno     = new Entorno(entornoPadre);

        // Registrar parámetros en el entorno local
        comp.params.forEach(p => {
            const id = TraductorComponentes._limpiarVar(p.id);
            entorno.guardar(id, p.tipo, p.linea);
        });

        const params = comp.params
            .map(p => TraductorComponentes._limpiarVar(p.id))
            .join(', ');

        const body = TraductorComponentes._generarElementos(comp.body, entorno, erroresSem);

        return (
`// ── Componente: ${nombre} ──
function ${nombre}(${params}) {
    return \`
${TraductorComponentes._indentar(body, 2)}
    \`;
}
`
        );
    }

    /* ── Genera HTML de una lista de elementos ── */
    static _generarElementos(elementos, entorno, erroresSem) {
        // 1. Si es nulo o indefinido, usamos un arreglo vacío
        let arregloSeguro = elementos ?? [];
        
        // 2. Si es un objeto individual (no un arreglo), lo metemos en uno
        if (!Array.isArray(arregloSeguro)) {
            arregloSeguro = [arregloSeguro];
        }

        // 3. Ahora podemos filtrar y mapear sin miedo a que explote
        return arregloSeguro
            .filter(Boolean)
            .map(el => TraductorComponentes._generarElemento(el, entorno, erroresSem))
            .join('\n');
    }

    /* ── Despacho por tipo de nodo ── */
    static _generarElemento(el, entorno, erroresSem) {
        switch (el.tipo) {
            case 'SECTION':      return TraductorComponentes._generarSection(el, entorno, erroresSem);
            case 'TABLA':        return TraductorComponentes._generarTabla(el, entorno, erroresSem);
            case 'TEXTO':        return TraductorComponentes._generarTexto(el, entorno, erroresSem);
            case 'IMG':          return TraductorComponentes._generarIMG(el, entorno, erroresSem);
            case 'FORM':         return TraductorComponentes._generarForm(el, entorno, erroresSem);
            case 'INPUT_TEXT':
            case 'INPUT_NUMBER':
            case 'INPUT_BOOL':   return TraductorComponentes._generarInput(el, entorno, erroresSem);
            case 'IF':           return TraductorComponentes._generarIf(el, entorno, erroresSem);
            case 'FOR_EACH':     return TraductorComponentes._generarForEach(el, entorno, erroresSem);
            case 'FOR_TRACK':    return TraductorComponentes._generarForTrack(el, entorno, erroresSem);
            case 'SWITCH':       return TraductorComponentes._generarSwitch(el, entorno, erroresSem);
            case 'LLAMADA_COMPONENTE': return TraductorComponentes._generarLlamada(el, entorno, erroresSem);
            default:
                erroresSem.push(new ErrorLSS(
                    'Semántico',
                    `Tipo de elemento desconocido: "${el.tipo}"`,
                    el.linea ?? 0, 0
                ));
                return '';
        }
    }

    /* ══════════════════════════════════════════════════
       ELEMENTOS VISUALES
       ══════════════════════════════════════════════════ */

    static _generarSection(el, entorno, erroresSem) {
        const cls     = TraductorComponentes._claseAttr(el.estilos);
        const cuerpo  = TraductorComponentes._generarElementos(el.contenido, entorno, erroresSem);
        return `<div${cls}>\n${TraductorComponentes._indentar(cuerpo, 1)}\n</div>`;
    }

    static _generarTabla(el, entorno, erroresSem) {
        const cls  = TraductorComponentes._claseAttr(el.estilos);
        const fils = (el.filas ?? []).map(fila => {
            const celdas = fila.map(celda => {
                const cont = TraductorComponentes._generarElementos(celda.contenido, entorno, erroresSem);
                return `    <td>\n${TraductorComponentes._indentar(cont, 3)}\n    </td>`;
            }).join('\n');
            return `  <tr>\n${celdas}\n  </tr>`;
        }).join('\n');
        return `<table${cls}>\n${fils}\n</table>`;
    }

    static _generarTexto(el, entorno, erroresSem) {
        const cls  = TraductorComponentes._claseAttr(el.estilos);
        const texto = TraductorComponentes._procesarTexto(el.val, entorno, erroresSem);
        return `<p${cls}>${texto}</p>`;
    }

    static _generarIMG(el, entorno, erroresSem) {
        const cls  = TraductorComponentes._claseAttr(el.estilos);
        const urls = el.urls ?? [];

        if (urls.length === 1) {
            const src = TraductorComponentes._resolverUrl(urls[0], entorno, erroresSem);
            return `<img${cls} src="${src}" alt="" />`;
        }

        // Carrusel
        const imgs = urls.map(u => {
            const src = TraductorComponentes._resolverUrl(u, entorno, erroresSem);
            return `    <img src="${src}" alt="" />`;
        }).join('\n');
        return `<div${cls} class="carousel">\n${imgs}\n</div>`;
    }

    static _resolverUrl(urlNodo, entorno, erroresSem) {
        if (urlNodo.tipo === 'VAR') {
            const id = TraductorComponentes._limpiarVar(urlNodo.val);
            TraductorComponentes._validarVar(id, entorno, erroresSem, urlNodo.val, 0);
            return `\${${id}}`;
        }
        // STRING
        return urlNodo.val.replace(/^"|"$/g, '');
    }

    /* ══════════════════════════════════════════════════
       FORMULARIOS
       ══════════════════════════════════════════════════ */

    static _generarForm(el, entorno, erroresSem) {
        const cls    = TraductorComponentes._claseAttr(el.estilos);
        const cuerpo = TraductorComponentes._generarElementos(el.body, entorno, erroresSem);
        const submit = el.submit ? TraductorComponentes._generarSubmit(el.submit, entorno, erroresSem) : '';
        return `<form${cls}>\n${TraductorComponentes._indentar(cuerpo, 1)}\n${submit}\n</form>`;
    }

    static _generarSubmit(sub, entorno, erroresSem) {
        const cls   = TraductorComponentes._claseAttr(sub.estilos);
        const props = TraductorComponentes._propsSubmitMap(sub.props);

        const labelVal = props.get('label');
        const label    = labelVal ? TraductorComponentes._resolverValor(labelVal, entorno, erroresSem) : 'Enviar';

        let onClick = '';
        const funcProp = props.get('function');
        if (funcProp) {
            const funcId = TraductorComponentes._limpiarVar(funcProp.func);
            TraductorComponentes._validarVar(funcId, entorno, erroresSem, funcProp.func, sub.linea ?? 0);
            const refs = (funcProp.refs ?? [])
                .map(r => `document.getElementById('${r.substring(1)}')?.value`)
                .join(', ');
            onClick = ` onclick="${funcId}(${refs})"`;
        }

        return `    <button type="button"${cls}${onClick}>${label}</button>`;
    }

    static _generarInput(el, entorno, erroresSem) {
        const cls   = TraductorComponentes._claseAttr(el.estilos);
        const props = TraductorComponentes._propsInputMap(el.props, entorno, erroresSem);

        const idVal    = props.get('id');
        const labelVal = props.get('label');
        const valVal   = props.get('value');

        const idStr    = idVal    ? ` id="${idVal}"`       : '';
        const nameStr  = idVal    ? ` name="${idVal}"`     : '';
        const labelHtml = labelVal
            ? `<label${idVal ? ` for="${idVal}"` : ''}>${labelVal}</label>\n`
            : '';

        let type  = 'text';
        let extra = '';

        if (el.tipo === 'INPUT_NUMBER') {
            type  = 'number';
            extra = valVal !== undefined ? ` value="${valVal}"` : '';
        } else if (el.tipo === 'INPUT_BOOL') {
            type  = 'checkbox';
            extra = (String(valVal) === 'true') ? ' checked' : '';
        } else {
            // INPUT_TEXT
            const textoVal = valVal !== undefined
                ? TraductorComponentes._procesarTexto(`"${valVal}"`, entorno, erroresSem)
                : '';
            extra = textoVal ? ` value="${textoVal}"` : '';
        }

        return `${labelHtml}<input type="${type}"${idStr}${nameStr}${cls}${extra} />`;
    }

    /* ══════════════════════════════════════════════════
       LÓGICA
       ══════════════════════════════════════════════════ */

    static _generarIf(el, entorno, erroresSem) {
        const cond     = TraductorComponentes._expr(el.cond, entorno, erroresSem);
        const then     = TraductorComponentes._generarElementos(el.body, entorno, erroresSem);
        const elseHtml = TraductorComponentes._generarElse(el.sino, entorno, erroresSem);

        return `\${ (${cond}) ? \`\n${then}\n\` : \`\n${elseHtml}\n\` }`;
    }

    static _generarElse(nodo, entorno, erroresSem) {
        if (!nodo) return '';
        if (nodo.tipo === 'ELSE_IF') {
            return TraductorComponentes._generarIf(
                { tipo: 'IF', cond: nodo.cond, body: nodo.body, sino: nodo.sino },
                entorno, erroresSem
            );
        }
        if (nodo.tipo === 'ELSE') {
            return TraductorComponentes._generarElementos(nodo.body, entorno, erroresSem);
        }
        return '';
    }

    static _generarForEach(el, entorno, erroresSem) {
        const item   = TraductorComponentes._limpiarVar(el.iterador);
        const colId  = TraductorComponentes._limpiarVar(el.coleccion);

        // Validar que la colección esté declarada
        TraductorComponentes._validarVar(colId, entorno, erroresSem, el.coleccion, el.linea ?? 0);

        const entornoLocal = new Entorno(entorno);
        entornoLocal.guardar(item, 'any', el.linea);

        const body = TraductorComponentes._generarElementos(el.body, entornoLocal, erroresSem);
        return `\${ (${colId} ?? []).map(${item} => \`\n${body}\n\`).join('') }`;
    }

    static _generarForTrack(el, entorno, erroresSem) {
        const trackId = TraductorComponentes._limpiarVar(el.trackVar); 
        const pares   = el.vars ?? [];
        if (pares.length === 0) return '';

        const principal = pares[0];
        const colId     = TraductorComponentes._limpiarVar(principal.coleccion);
        const itemId    = TraductorComponentes._limpiarVar(principal.iterador);

        TraductorComponentes._validarVar(colId, entorno, erroresSem, principal.coleccion, el.linea ?? 0);

        const entornoLocal = new Entorno(entorno);
        entornoLocal.guardar(itemId,  'any', el.linea);
        entornoLocal.guardar(trackId, 'int', el.linea); 

        pares.slice(1).forEach(p => {
            const secId  = TraductorComponentes._limpiarVar(p.coleccion);
            const secItem = TraductorComponentes._limpiarVar(p.iterador);
            TraductorComponentes._validarVar(secId, entorno, erroresSem, p.coleccion, el.linea ?? 0);
            entornoLocal.guardar(secItem, 'any', el.linea);
        });

        const secAcceso = pares.slice(1).map(p => {
            const secId   = TraductorComponentes._limpiarVar(p.coleccion);
            const secItem = TraductorComponentes._limpiarVar(p.iterador);
            return `const ${secItem} = ${secId}?.[${trackId}];`;
        }).join('\n');

        const body   = TraductorComponentes._generarElementos(el.body, entornoLocal, erroresSem);
        const empty  = el.empty
            ? `\n\${ (${colId} ?? []).length === 0 ? \`\n${TraductorComponentes._generarElementos(el.empty, entorno, erroresSem)}\n\` : '' }`
            : '';

        return (
`\${ (${colId} ?? []).map((${itemId}, ${trackId}) => {
    ${secAcceso}
    return \`\n${body}\n\`;
}).join('') }${empty}`
        );
    }

    static _generarSwitch(el, entorno, erroresSem) {
        const expr = TraductorComponentes._exprSwitch(el.cond ?? el.expr, entorno, erroresSem);

        const casos = (el.cases ?? el.casos ?? []).map(c => {
            const val  = TraductorComponentes._resolverValorLiteral(c.valor ?? c.val, entorno, erroresSem);
            const body = TraductorComponentes._generarElementos(c.body, entorno, erroresSem);
            return `        case ${val}:\n            return \`\n${body}\n\`;`;
        }).join('\n');

        const defBody = el.def
            ? TraductorComponentes._generarElementos(el.def.body ?? el.def, entorno, erroresSem)
            : '';
        const defCase = el.def
            ? `        default:\n            return \`\n${defBody}\n\`;`
            : '';

        return (
`\${ (() => {
    switch (${expr}) {
${casos}
${defCase}
    }
})() }`
        );
    }

    static _generarLlamada(el, entorno, erroresSem) {
        const argsResueltos = (el.args ?? []).map(arg => {
            if (arg.tipo === 'VAR') {
                const id = TraductorComponentes._limpiarVar(arg.val);
                TraductorComponentes._validarVar(id, entorno, erroresSem, arg.val, el.linea);
                return id; // Pasamos la variable JS tal cual
            }
            if (arg.tipo === 'STRING') return `"${arg.val.replace(/^"|"$/g, '')}"`;
            if (arg.tipo === 'NUM' || arg.tipo === 'BOOL') return String(arg.val);
            return 'null';
        });

        return `\${${el.id}(${argsResueltos.join(', ')})}`;
    }

    /* ══════════════════════════════════════════════════
       PROCESAMIENTO DE TEXTO E INTERPOLACIÓN
       ══════════════════════════════════════════════════ */
    static _procesarTexto(rawVal, entorno, erroresSem) {
        if (!rawVal) return '';

        // Quitar comillas externas 
        let txt = String(rawVal).replace(/^["` ]|["` ]$/g, '');

        // 1. Reemplazar expresiones entre backticks
        txt = txt.replace(/`([^`]+)`/g, (_, expr) => {
            const exprLimpia = expr.replace(/\$([a-zA-Z0-9_]+)/g, (__, v) => {
                TraductorComponentes._validarVar(v, entorno, erroresSem, `$${v}`, 0);
                return v;
            });
            return `\${${exprLimpia}}`;
        });

        // 2. Reemplazar variables simples $var → ${var}
        txt = txt.replace(/\$([a-zA-Z0-9_]+)/g, (_, v) => {
            TraductorComponentes._validarVar(v, entorno, erroresSem, `$${v}`, 0);
            return `\${${v}}`;
        });

        return txt;
    }

    /* ══════════════════════════════════════════════════
       EXPRESIONES
       ══════════════════════════════════════════════════ */

    static _expr(nodo, entorno, erroresSem) {
        if (!nodo) return 'false';

        switch (nodo.tipo) {
            case 'VAR': {
                const id = TraductorComponentes._limpiarVar(nodo.val);
                TraductorComponentes._validarVar(id, entorno, erroresSem, nodo.val, nodo.linea ?? 0);
                return id;
            }
            case 'NUM':    return String(nodo.val);
            case 'BOOL':   return String(nodo.val);
            case 'STRING': return `"${nodo.val.replace(/^"|"$/g, '')}"`;
        }

        if (nodo.op === '!')   return `!(${TraductorComponentes._expr(nodo.der, entorno, erroresSem)})`;
        if (nodo.op === 'neg') return `-(${TraductorComponentes._expr(nodo.der, entorno, erroresSem)})`;

        const izq = TraductorComponentes._expr(nodo.izq, entorno, erroresSem);
        const der = TraductorComponentes._expr(nodo.der, entorno, erroresSem);
        return `(${izq} ${nodo.op} ${der})`;
    }

    static _exprSwitch(nodo, entorno, erroresSem) {
        if (!nodo) return 'undefined';
        if (nodo.tipo === 'VAR') {
            const id = TraductorComponentes._limpiarVar(nodo.val);
            TraductorComponentes._validarVar(id, entorno, erroresSem, nodo.val, 0);
            return id;
        }
        if (nodo.tipo === 'VAR_IDX') {
            const id = TraductorComponentes._limpiarVar(nodo.val);
            TraductorComponentes._validarVar(id, entorno, erroresSem, nodo.val, 0);
            const idx = typeof nodo.index === 'string'
                ? `"${nodo.index.replace(/^"|"$/g, '')}"`
                : nodo.index;
            return `${id}[${idx}]`;
        }
        return TraductorComponentes._expr(nodo, entorno, erroresSem);
    }

    /* ══════════════════════════════════════════════════
       RESOLUCIÓN DE VALORES
       ══════════════════════════════════════════════════ */

    static _resolverValor(nodo, entorno, erroresSem) {
        if (!nodo) return '';
        switch (nodo.tipo) {
            case 'STRING': return nodo.val.replace(/^"|"$/g, '');
            case 'NUM':    return String(nodo.val);
            case 'BOOL':   return String(nodo.val);
            case 'VAR': {
                const id = TraductorComponentes._limpiarVar(nodo.val);
                TraductorComponentes._validarVar(id, entorno, erroresSem, nodo.val, nodo.linea ?? 0);
                return `\${${id}}`;
            }
            case 'EXPR':
            case 'CADENA_EXPR':
                return TraductorComponentes._procesarTexto(nodo.val, entorno, erroresSem);
            default:
                return String(nodo.val ?? '');
        }
    }

    /** Para valores literales usados como case en switch */
    static _resolverValorLiteral(nodo, entorno, erroresSem) {
        if (!nodo) return 'undefined';
        switch (nodo.tipo) {
            case 'STRING': return `"${nodo.val.replace(/^"|"$/g, '')}"`;
            case 'NUM':    return String(nodo.val);
            case 'BOOL':   return String(nodo.val);
            case 'VAR': {
                const id = TraductorComponentes._limpiarVar(nodo.val);
                TraductorComponentes._validarVar(id, entorno, erroresSem, nodo.val, nodo.linea ?? 0);
                return id;
            }
            default: return `"${nodo.val}"`;
        }
    }

    /* ══════════════════════════════════════════════════
       HELPERS
       ══════════════════════════════════════════════════ */

    /** Quita el prefijo $ de una variable */
    static _limpiarVar(id) {
        return String(id ?? '').replace(/^\$/, '');
    }

    /** Genera atributo class="" si hay estilos */
    static _claseAttr(estilos) {
        return estilos && estilos.length > 0
            ? ` class="${estilos.join(' ')}"`
            : '';
    }

    /** Indenta cada línea n espacios */
    static _indentar(texto, n) {
        const sp = '  '.repeat(n);
        return texto.split('\n').map(l => l ? `${sp}${l}` : l).join('\n');
    }

    /** Valida que una variable esté declarada en el entorno */
    static _validarVar(id, entorno, erroresSem, rawToken, linea) {
        if (!entorno.obtener(id)) {
            erroresSem.push(new ErrorLSS(
                'Semántico',
                `Variable "${rawToken}" usada pero no declarada como parámetro`,
                linea,
                0
            ));
        }
    }

    /** Convierte la lista de props del submit a Map<clave, nodo> */
    static _propsSubmitMap(props) {
        const m = new Map();
        (props ?? []).forEach(p => m.set(p.clave, p));
        return m;
    }

    /** Convierte la lista de props de un input a Map<clave, valor_resuelto> */
    static _propsInputMap(props, entorno, erroresSem) {
        const m = new Map();
        (props ?? []).forEach(p => {
            if (p.clave === 'value') {
                m.set('value', TraductorComponentes._resolverValor(p.valor, entorno, erroresSem));
            } else {
                m.set(p.clave, TraductorComponentes._resolverValor(p.valor, entorno, erroresSem));
            }
        });
        return m;
    }
}

module.exports = TraductorComponentes;
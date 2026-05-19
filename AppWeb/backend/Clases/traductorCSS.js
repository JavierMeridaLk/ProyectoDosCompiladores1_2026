'use strict';

/**
 * Traductor del lenguaje .styles → CSS válido
 */

const StylesParser = require('../Analizadores/StylesJison');
const ErrorLSS     = require('./Errores');

//Tabla de símbolos para el for
class TablaSimbolosCSS {
    constructor(padre = null) {
        this.simbolos = new Map();
        this.padre    = padre;
    }
    set(id, valor) { this.simbolos.set(id, valor); }
    get(id) {
        if (this.simbolos.has(id)) return this.simbolos.get(id);
        if (this.padre)            return this.padre.get(id);
        return null;
    }
}

//propoieedades sin valores o px 
const PROPS_SIN_UNIDAD = new Set([
    'color', 'background-color',
    'font-family', 'text-align',
    'border-style',
    'border-top-style', 'border-right-style',
    'border-bottom-style', 'border-left-style',
    'border-color',
    'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color',
]);

//mapeado de propiedades para css
const MAPA_PROPIEDADES = {
    // Dimensiones
    'height'          : 'height',
    'width'           : 'width',
    'min-width'       : 'min-width',
    'max-width'       : 'max-width',
    'min-height'      : 'min-height',
    'max-height'      : 'max-height',
    // Texto
    'text size'       : 'font-size',
    'text font'       : 'font-family',
    'text align'      : 'text-align',
    // Fondo y color
    'background color': 'background-color',
    'color'           : 'color',
    // Padding
    'padding'         : 'padding',
    'padding-left'    : 'padding-left',
    'padding-right'   : 'padding-right',
    'padding-top'     : 'padding-top',
    'padding-bottom'  : 'padding-bottom',
    // Margin
    'margin'          : 'margin',
    'margin-left'     : 'margin-left',
    'margin-right'    : 'margin-right',
    'margin-top'      : 'margin-top',
    'margin-bottom'   : 'margin-bottom',
    // Border genérico
    'border'          : 'border',
    'border-radius'   : 'border-radius',
    'border-width'    : 'border-width',
    'border-style'    : 'border-style',
    'border-color'    : 'border-color',
    // Border por lado — shorthand
    'border-top'      : 'border-top',
    'border-right'    : 'border-right',
    'border-bottom'   : 'border-bottom',
    'border-left'     : 'border-left',
    // Border por lado — style
    'border-top-style'    : 'border-top-style',
    'border-right-style'  : 'border-right-style',
    'border-bottom-style' : 'border-bottom-style',
    'border-left-style'   : 'border-left-style',
    // Border por lado — color
    'border-top-color'    : 'border-top-color',
    'border-right-color'  : 'border-right-color',
    'border-bottom-color' : 'border-bottom-color',
    'border-left-color'   : 'border-left-color',
    // Border por lado — width
    'border-top-width'    : 'border-top-width',
    'border-right-width'  : 'border-right-width',
    'border-bottom-width' : 'border-bottom-width',
    'border-left-width'   : 'border-left-width',
};

//clase principal del traductor
class TraductorCSS {

    /**
     * Punto de entrada principal.
     * @param {string} entrada  Código fuente .styles
     * @returns {{ css: string, errores: ErrorLSS[] }}
     */
    static analizar(entrada) {
        const parserObj = StylesParser.parser;
        parserObj.yy = { errores: [] };

        parserObj.yy.parseError = function(msg, hash) {
            parserObj.yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: msg,
                linea: hash?.loc?.first_line ?? 0,
                columna: hash?.loc?.first_column ?? 0
            });
        };

        let ast       = null;
        const errores = [];

        //parseo
        try {
            const resultado = StylesParser.parse(entrada);
            ast             = resultado?.ast ?? null;
            const rawErrs   = parserObj.yy.errores ?? [];

            //manejo de errorwes
            rawErrs.forEach(e => {
                errores.push(new ErrorLSS(
                    e.tipo        ?? 'Desconocido',
                    e.descripcion ?? e.mensaje ?? String(e),
                    e.linea       ?? 0,
                    e.columna     ?? 0
                ));
            });

        } catch (e) {
            // Error fatal 
            errores.push(new ErrorLSS(
                'Fatal',
                `Error crítico de parseo: ${e.message}`,
                e.hash?.loc?.first_line  ?? 0,
                e.hash?.loc?.first_column ?? 0
            ));
        }

        if (!ast) {
            errores.push(new ErrorLSS(
                'Fatal',
                'No se pudo generar el AST. La traducción fue abortada.',
                0, 0
            ));
            return {
                css: '/* Error Crítico: no se pudo traducir el archivo .styles */',
                errores
            };
        }

        //Traducción 
        const estilosBase = {};
        const globalTS    = new TablaSimbolosCSS();

        const { css, erroresSem } = this._generarCSS(ast, globalTS, estilosBase);

        // Agregar errores semánticos detectados en traducción
        erroresSem.forEach(e => errores.push(e));

        const tablaSimbolos = {
            variables: [...globalTS.simbolos.entries()].map(([id, valor]) => ({ id, valor })),
            estilos:   Object.keys(estilosBase).map(id => ({
                id,
                propiedades: estilosBase[id]?.length ?? 0
            }))
        };

        return { css, errores, tablaSimbolos };
    }

    //Genera CSS a partir de una lista de nodos
    static _generarCSS(nodos, ts, estilosBase) {
        let css        = '';
        const erroresSem = [];

        for (const nodo of nodos) {
            if (!nodo) continue;
            if (nodo.tipo === 'REGLA') {
                const r = this._procesarRegla(nodo, ts, estilosBase);
                css += r.css;
                erroresSem.push(...r.errores);
            } else if (nodo.tipo === 'FOR') {
                const r = this._procesarFor(nodo, ts, estilosBase);
                css += r.css;
                erroresSem.push(...r.errores);
            }
        }

        return { css, erroresSem };
    }

    //Procesa una regla de estilo
    static _procesarRegla(regla, ts, estilosBase) {
        const errores = [];


        const nombreResuelto = this._resolverNombre(regla.selector, ts);
        const selector       = `.${nombreResuelto}`;


        const mapaProps = new Map();

        // Herencia: cargar propiedades del padre primero
        if (regla.extiende) {
            const padre = estilosBase[regla.extiende];
            if (padre) {
                padre.forEach(p => mapaProps.set(p.propiedad, p.valor));
            } else {
                errores.push(new ErrorLSS(
                    'Semántico',
                    `El estilo "${regla.extiende}" no está definido (usado en extends)`,
                    regla.linea ?? 0,
                    0
                ));
            }
        }

        //Propiedades propias 
        for (const p of regla.propiedades) {
            if (p) mapaProps.set(p.propiedad, p.valor);
        }

        // Guardar en estilosBase para que otros puedan heredar de este
        estilosBase[nombreResuelto] = Array.from(mapaProps.entries())
            .map(([prop, val]) => ({ propiedad: prop, valor: val }));

        // Generar bloque CSS
        let bloque = `${selector} {\n`;
        for (const [prop, valorRaw] of mapaProps.entries()) {
            const propCSS    = this._mapearPropiedad(prop);
            const valorFinal = this._resolverValor(valorRaw, ts, propCSS);
            bloque += `    ${propCSS}: ${valorFinal};\n`;
        }
        bloque += '}\n\n';

        return { css: bloque, errores };
    }

    // @for
    static _procesarFor(nodo, ts, estilosBase) {
        let css        = '';
        const errores  = [];

        const inicio      = this._evaluar(nodo.inicio, ts);
        const fin         = this._evaluar(nodo.fin,    ts);
        const esInclusive = nodo.modo === 'THROUGH';

        if (typeof inicio !== 'number' || typeof fin !== 'number') {
            errores.push(new ErrorLSS(
                'Semántico',
                `Los límites del @for deben ser numéricos (from ${inicio} ${nodo.modo} ${fin})`,
                nodo.linea ?? 0, 0
            ));
            return { css, errores };
        }

        for (let i = inicio; esInclusive ? i <= fin : i < fin; i++) {
            const localTS = new TablaSimbolosCSS(ts);
            localTS.set(nodo.variable, i);
            const r = this._generarCSS(nodo.cuerpo, localTS, estilosBase);
            css += r.css;
            errores.push(...r.erroresSem);
        }

        return { css, errores };
    }

    // Resuelve variables $i en nombres de selectores
    static _resolverNombre(selector, ts) {
        return selector.replace(/\$[a-zA-Z0-9_]+/g, match => {
            const val = ts.get(match);
            return val !== null && val !== undefined ? String(val) : match;
        });
    }

    // Convierte el valor AST a string CSS
    static _resolverValor(valor, ts, propCSS) {
        // Valor rgb()
        if (valor?.tipo === 'rgb') {
            const r = this._evaluar(valor.r, ts);
            const g = this._evaluar(valor.g, ts);
            const b = this._evaluar(valor.b, ts);
            return `rgb(${r}, ${g}, ${b})`;
        }

        // Shorthand border: 2 solid red
        if (valor?.shorthand) {
            const w = this._resolverValor(valor.w, ts, 'border-width');
            const s = this._traducirBorderKind(valor.s);
            const c = this._resolverValor(valor.c, ts, 'border-color');
            return `${w} ${s} ${c}`;
        }

        // Estilos de borde aislados
        if (propCSS.includes('style')) {
            return this._traducirBorderKind(valor);
        }

        // Evaluar expresion numerixa o constante
        const resultado = this._evaluar(valor, ts);

        if (typeof resultado === 'number') {
            if (PROPS_SIN_UNIDAD.has(propCSS)) return String(resultado);
            return `${resultado}px`;
        }

        return this._normalizarStringValor(String(resultado), propCSS);
    }

    //formateo de strings para CSS  
    static _normalizarStringValor(valor, propCSS) {
        if (propCSS === 'font-family') {
            const fontMap = {
                'HELVETICA'  : 'Helvetica, sans-serif',
                'SANS'       : 'sans-serif',
                'SANS SERIF' : 'sans-serif',
                'MONO'       : 'monospace',
                'CURSIVE'    : 'cursive',
            };
            return fontMap[valor.toUpperCase()] ?? valor.toLowerCase();
        }
        if (propCSS === 'text-align') {
            return valor.toLowerCase();
        }
        // Porcentajes se devuelven 
        if (valor.endsWith('%')) return valor;
        return valor.toLowerCase();
    }


    static _traducirBorderKind(kind) {
        if (typeof kind !== 'string') return String(kind);
        switch (kind.toUpperCase()) {
            case 'LINE':   return 'solid';
            case 'SOLID':  return 'solid';
            case 'solid':  return 'solid';
            case 'DOTTED': return 'dotted';
            case 'DOUBLE': return 'double';
            default:       return kind.toLowerCase();
        }
    }

    // Evalúa una expresión del AST a un valor primitivo
    static _evaluar(expr, ts) {
        if (typeof expr === 'number') return expr;

        if (typeof expr === 'string') {
            if (expr.startsWith('$')) {
                const val = ts.get(expr);
                return val !== null && val !== undefined ? val : expr;
            }
            if (expr.endsWith('%')) return expr;
            const n = Number(expr);
            return isNaN(n) ? expr : n;
        }

        // Nodo de operación binaria
        if (expr?.op) {
            if (expr.op === 'neg') {
                return -Number(this._evaluar(expr.val, ts));
            }
            const izq = Number(this._evaluar(expr.izq, ts));
            const der = Number(this._evaluar(expr.der, ts));
            switch (expr.op) {
                case '+': return izq + der;
                case '-': return izq - der;
                case '*': return izq * der;
                case '/': return der !== 0 ? izq / der : 0;
                case '%': return der !== 0 ? izq % der : 0;
                default:  return 0;
            }
        }

        return expr ?? 0;
    }

    static _mapearPropiedad(prop) {
        const clave = (prop ?? '').toLowerCase().trim();
        return MAPA_PROPIEDADES[clave] ?? clave.replace(/\s+/g, '-');
    }
}

module.exports = TraductorCSS;
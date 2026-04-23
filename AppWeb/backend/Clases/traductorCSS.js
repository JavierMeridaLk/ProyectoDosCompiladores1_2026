const StylesParser = require('../Analizadores/StylesJison');

class TraductorCSS {

    static analizar(entrada) {
        try {
            const ast = StylesParser.parse(entrada);
            return this.generarCSS(ast, {}, {});
        } catch (error) {
            console.error("Error crítico: ", error);
            return `/* Error: ${error.message} */`;
        }
    }

    static generarCSS(nodos, env, estilosBase) {
        let css = "";

        nodos.forEach(nodo => {
            if (nodo.tipo === 'REGLA') {
                css += this.procesarRegla(nodo, env, estilosBase);
            } else if (nodo.tipo === 'FOR') {
                css += this.procesarFor(nodo, env, estilosBase);
            }
        });

        return css;
    }

    static procesarRegla(regla, env, estilosBase) {
        let selector = this.reemplazarVariables(regla.selector, env);

        // 🔥 Convertir a clase CSS si no tiene prefijo
        if (!selector.startsWith('.') && !selector.startsWith('#')) {
            selector = `.${selector}`;
        }

        let mapaProps = {};

        // 🔥 HERENCIA (extends) con sobrescritura correcta
        if (regla.extends && estilosBase[regla.extends]) {
            estilosBase[regla.extends].forEach(p => {
                mapaProps[p.propiedad] = p;
            });
        }

        // 🔥 Sobrescribir con propiedades actuales
        regla.propiedades.forEach(prop => {
            mapaProps[prop.propiedad] = prop;
        });

        const propiedadesFinales = Object.values(mapaProps);

        // Guardar para futuras herencias
        estilosBase[regla.selector] = propiedadesFinales;

        let cuerpo = `${selector} {\n`;

        propiedadesFinales.forEach(prop => {
            const nombre = this.mapearPropiedad(prop.propiedad);
            const valor = this.evaluarExpresion(prop.valor, env);
            const valorFinal = this.formatearValor(valor, nombre, env);

            cuerpo += `    ${nombre}: ${valorFinal};\n`;
        });

        return cuerpo + "}\n\n";
    }

    static procesarFor(nodoFor, env, estilosBase) {
        let resultadoFor = "";

        const inicio = Number(this.evaluarExpresion(nodoFor.inicio, env));
        const fin = Number(this.evaluarExpresion(nodoFor.fin, env));
        const inclusive = nodoFor.iteracion === 'through';

        for (let i = inicio; inclusive ? i <= fin : i < fin; i++) {
            const nuevoEnv = { ...env, [nodoFor.variable]: i };
            resultadoFor += this.generarCSS(nodoFor.cuerpo, nuevoEnv, estilosBase);
        }

        return resultadoFor;
    }

    static evaluarExpresion(expr, env) {
        if (typeof expr !== 'object') {
            if (typeof expr === 'string' && expr.startsWith('$')) {
                return env[expr] || 0;
            }
            return expr;
        }

        const izq = this.evaluarExpresion(expr.izq, env);
        const der = this.evaluarExpresion(expr.der, env);

        switch (expr.op) {
            case '+': return Number(izq) + Number(der);
            case '-': return Number(izq) - Number(der);
            case '*': return Number(izq) * Number(der);
            case '/': return Number(izq) / Number(der);
            case '%': return Number(izq) % Number(der);
            case 'neg': return -Number(der);
            default: return 0;
        }
    }

    static reemplazarVariables(texto, env) {
        if (typeof texto !== 'string') return texto;

        let resultado = texto;
        for (const [variable, valor] of Object.entries(env)) {
            resultado = resultado.replaceAll(variable, valor);
        }
        return resultado;
    }

    static mapearPropiedad(clave) {
        const mapa = {
            "text font": "font-family",
            "text size": "font-size",
            "text align": "text-align",
            "background color": "background-color",
            "border radius": "border-radius",
            "padding left": "padding-left",
            "padding right": "padding-right",
            "padding top": "padding-top",
            "padding bottom": "padding-bottom",
            "margin left": "margin-left",
            "margin right": "margin-right",
            "margin top": "margin-top",
            "margin bottom": "margin-bottom",
            "border style": "border-style",
            "border width": "border-width",
            "border color": "border-color",
        };

        return mapa[clave.toLowerCase()] || clave.toLowerCase().replace(/\s+/g, '-');
    }

    static formatearValor(valor, propiedad, env) {

        // 🔥 RGB estructurado (si el parser lo soporta)
        if (typeof valor === 'object' && valor.tipo === 'rgb') {
            const r = this.evaluarExpresion(valor.r, env);
            const g = this.evaluarExpresion(valor.g, env);
            const b = this.evaluarExpresion(valor.b, env);
            return `rgb(${r}, ${g}, ${b})`;
        }

        // 🔥 SHORTHAND border: "3 solid blue"
        if (typeof valor === 'string' && propiedad.includes('border')) {
            const partes = valor.split(' ');
            if (partes.length === 3 && !isNaN(partes[0])) {
                return `${partes[0]}px ${partes[1]} ${partes[2]}`;
            }
        }

        // 🔥 Normalización de valores
        if (typeof valor === 'string') {
            valor = valor.toLowerCase();

            const mapaValores = {
                "center": "center",
                "left": "left",
                "right": "right",
                "line": "solid",
                "dotted": "dotted",
                "double": "double",
                "sans serif": "sans-serif",
                "sans": "sans-serif",
                "mono": "monospace",
                "cursive": "cursive"
            };

            if (mapaValores[valor]) return mapaValores[valor];
        }

        // ❌ No agregar px a estos
        const sinUnidad = [
            'color',
            'background-color',
            'text-align',
            'font-family',
            'border-style'
        ];

        if (sinUnidad.some(p => propiedad.includes(p))) return valor;

        // ✔ Agregar px automáticamente
        if (!isNaN(valor) && !String(valor).includes('%')) {
            return `${valor}px`;
        }

        return valor;
    }
}

module.exports = TraductorCSS;
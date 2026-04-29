const Parser = require('../Analizadores/ComponentsJison');

class TraductorComponentes {

    static analizar(input) {
        try {
            const ast = Parser.parse(input);
            return this.generarJS(ast);
        } catch (e) {
            console.error(e);
            return `/* ERROR: ${e.message} */`;
        }
    }

    static generarJS(ast) {
        return ast.map(c => this.generarComponente(c)).join('\n');
    }

    static generarComponente(comp) {
        const nombre = comp.id;
        // Limpiamos los símbolos de dólar de los parámetros del componente
        const params = comp.params.map(p => p.id.replace('$', '')).join(', ');

        const body = this.generarElementos(comp.body);

        return `
function ${nombre}({ ${params} }) {
    return \`
${body}
    \`;
}
`;
    }

    static generarElementos(elementos) {
        return elementos.map(el => this.generarElemento(el)).join('\n');
    }

    static generarElemento(el) {
        switch (el.tipo) {
            case 'SECTION': return this.generarSection(el);
            case 'TEXTO': return `<p>${this.procesarTexto(el.val)}</p>`;
            case 'IMG': return this.generarIMG(el);
            case 'TABLA': return this.generarTabla(el);
            case 'FORM': return this.generarForm(el);
            case 'INPUT_TEXT':
            case 'INPUT_NUMBER':
            case 'INPUT_BOOL': return this.generarInput(el);
            case 'IF': return this.generarIf(el);
            case 'FOR_EACH': return this.generarForEach(el);
            case 'SWITCH': return this.generarSwitch(el);
            default: return '';
        }
    }

    // ---------------- HTML ----------------

    static generarSection(el) {

        const clasesAttr = el.estilos && el.estilos.length > 0 
            ? ` class="${el.estilos.join(' ')}"` 
            : '';
            
        const contenido = this.generarElementos(el.contenido);

        return `<div${clasesAttr}>\n${contenido}\n</div>`;
    }

    static generarIMG(el) {
        if (el.vals.length === 1) {
            return `<img src="${this.valor(el.vals[0])}" />`;
        }

        return `<div class="carousel">\n${el.vals.map(v => `<img src="${this.valor(v)}"/>`).join('\n')}\n</div>`;
    }

    static generarTabla(el) {
        return `<table>
${el.filas.map(f => `
<tr>
${f.map(c => `<td>${this.generarElementos(c.contenido)}</td>`).join('\n')}
</tr>`).join('\n')}
</table>`;
    }

    static generarForm(el) {
        const body = this.generarElementos(el.body);

        let submit = '';
        if (el.submit) {
            submit = `<button type="submit">${this.valor(el.submit.label)}</button>`;
        }

        return `<form>\n${body}\n${submit}\n</form>`;
    }

    static generarInput(el) {
        const props = this.parseProps(el.props);

        let type = "text";
        // Procesar el valor del input usando procesarTexto para que interpole ${variable}
        let valorInterpolado = this.procesarTexto(props.value || '');
        let extra = `value="${valorInterpolado}"`;

        if (el.tipo === 'INPUT_NUMBER') type = "number";
        
        // Manejo correcto para inputs booleanos (checkboxes) usando el atributo 'checked'
        if (el.tipo === 'INPUT_BOOL') {
            type = "checkbox";
            extra = (props.value === 'true' || props.value === true) ? 'checked' : '';
        }

        const idAttr = props.id ? ` id="${props.id}"` : '';
        
        const labelHTML = props.label 
            ? `<label${props.id ? ` for="${props.id}"` : ''}>${props.label}</label>\n` 
            : '';

        return `${labelHTML}<input type="${type}"${idAttr} ${extra} />`;
    }

    // ---------------- LÓGICA ----------------

    static generarIf(el) {
        let elseBody = '';
        
        if (el.sino) {
            if (el.sino.tipo === 'IF') { 
                elseBody = this.generarIf(el.sino);
            } else if (el.sino.tipo === 'ELSE') { 
                elseBody = this.generarElementos(el.sino.body || []);
            } else {
                elseBody = this.generarElementos(el.sino.body || el.sino || []);
            }
        }

        return `\${ ${this.expr(el.cond)} ? \`
${this.generarElementos(el.body)}
\` : \`
${elseBody}
\` }`;
    }

    static generarForEach(el) {
        const item = el.iterador.replace('$', '');
        const arr = el.coleccion.replace('$', '');

        return `\${ ${arr}.map(${item} => \`
${this.generarElementos(el.body)}
\`).join("") }`;
    }

    static generarSwitch(el) {
        // Procesar la expresión del switch correctamente
        const expr = this.expr(el.expr);

        let casos = el.cases.map(c => {
            //Asegurar que los casos de texto lleven comillas en la salida JS
            let valorCaso = this.valor(c.val);
            if (typeof valorCaso === 'string' && isNaN(valorCaso) && !valorCaso.startsWith('"')) {
                valorCaso = `"${valorCaso}"`;
            }

            return `case ${valorCaso}:
return \`
${this.generarElementos(c.body)}
\`;`;
        }).join('\n');

        let def = '';
        if (el.def) {
            def = `default:
return \`
${this.generarElementos(el.def)}
\`;`;
        }

        return `\${ (() => {
switch(${expr}) {
${casos}
${def}
}
})() }`;
    }

    // ---------------- HELPERS ----------------

    static valor(v) {
        if (!v) return '';
        
        if (typeof v === 'string') return v.replace(/^"|"$/g, '');

        switch (v.tipo) {
            case 'STRING': return v.val.replace(/^"|"$/g, '');
            case 'NUM': return v.val;
            case 'BOOL': return v.val;
            case 'VAR': return `\${${v.val.replace('$', '')}}`;
            default: return v;
        }
    }

    static procesarTexto(texto) {
        if (!texto) return '';
        // Limpiamos las comillas literales que vienen del lexer
        let txtLimpio = texto.replace(/^"|"$/g, '');

        return txtLimpio
            // FIX 1: Interpola expresiones matemáticas quitando el símbolo $ y evaluando todo.
            .replace(/`([^`]+)`/g, (_, expr) => '${' + expr.replace(/\$/g, '') + '}')
            // Interpola variables simples ($var -> ${var})
            .replace(/\$([a-zA-Z0-9_]+)/g, '${$1}'); 
    }

    static expr(e) {
        if (!e) return '';

        if (e.tipo === 'VAR') {
            return e.val.replace('$', '');
        }

        if (e.tipo === 'NUM' || e.tipo === 'BOOL') {
            return e.val;
        }

        if (e.tipo === 'STRING') {
            return `"${e.val.replace(/^"|"$/g, '')}"`;
        }

        if (e.op === '!') {
            return `!(${this.expr(e.der)})`;
        }

        return `${this.expr(e.izq)} ${e.op} ${this.expr(e.der)}`;
    }

    static parseProps(props) {
        let obj = {};

        props.forEach(p => {
            if (p.id) obj.id = this.valor(p.id);
            if (p.label) obj.label = this.valor(p.label);
            if (p.value) obj.value = this.valor(p.value); 
        });

        return obj;
    }
}

module.exports = TraductorComponentes;
const fs = require('fs');
const path = require('path');
const ParserPrincipal = require('../Analizadores/PrincipalJison'); 

class TraductorPrincipal {

    static analizar(input, rutaActual) {
        try {
            // { imports: [], globales: [], funciones: [], main: [] }
            const ast = ParserPrincipal.parse(input);
            return this.generarJS(ast, rutaActual);
        } catch (e) {
            console.error(e);
            return `/* ERROR DE COMPILACIÓN: ${e.message} */`;
        }
    }

    static generarJS(ast, rutaActual) {
        let jsCode = `// --- ARCHIVO PRINCIPAL GENERADO ---\n\n`;

        // Validar Imports
        jsCode += this.validarImports(ast.imports, rutaActual);

        // Variables Globales
        jsCode += `// Variables Globales\n`;
        jsCode += ast.globales.map(g => this.traducirInstruccion(g)).join('\n') + '\n\n';

        // Funciones 
        jsCode += `// Funciones de Lógica y DB\n`;
        jsCode += ast.funciones.map(f => this.traducirFuncion(f)).join('\n\n') + '\n\n';

        // MAIN 
        jsCode += `// --- FUNCIÓN PRINCIPAL ---\n`;
        jsCode += `document.addEventListener("DOMContentLoaded", () => {\n`;
        jsCode += `    let htmlOutput = "";\n\n`;

        jsCode += ast.main.map(inst => this.traducirInstruccionMain(inst)).join('\n');

        jsCode += `\n    // Renderizamos todo en el contenedor principal\n`;
        jsCode += `    document.body.innerHTML = htmlOutput;\n`;
        jsCode += `});\n`;

        return jsCode;
    }

    // ---------------- TRADUCTORES DE BLOQUES ----------------

    static validarImports(imports, rutaActual) {
        if (!imports) return '';
        let comentarios = `// Imports validados:\n`;

        imports.forEach(imp => {
            // Limpiamos las comillas
            let rutaRelativa = imp.path.replace(/^"|"$/g, '').trim(); 
            let rutaAbsoluta = path.resolve(path.dirname(rutaActual), rutaRelativa);

            // Validar que el archivo exista en tiempo de compilación
            if (!fs.existsSync(rutaAbsoluta)) {
                throw new Error(`Import no encontrado: ${rutaRelativa}`);
            }
            comentarios += `// Archivo encontrado: ${rutaRelativa}\n`;
        });

        return comentarios + '\n';
    }

    static traducirFuncion(f) {
        // Si hay un error en execute, mostrar alert y detener
        const params = f.params ? f.params.map(p => p.id).join(', ') : '';
        let body = f.body.map(inst => {
            if (inst.tipo === 'EXECUTE') {
                return `    try {
        ejecutarSQL(\`${inst.query}\`); // Asume que tienes una función puente para la BD
    } catch(err) {
        alert("Error en la base de datos: " + err.message);
        return; // Detiene la ejecución
    }`;
            } else if (inst.tipo === 'LOAD') {
                return `    window.location.href = ${this.traducirExpresion(inst.path)};`;
            }
            return '';
        }).join('\n');

        return `function ${f.id}(${params}) {\n${body}\n}`;
    }

    static traducirInstruccionMain(inst) {
        // Para diferenciar si estamos concatenando HTML o haciendo lógica pura
        if (inst.tipo === 'COMP_CALL') {
            const args = inst.args ? inst.args.map(a => this.traducirExpresion(a)).join(', ') : '';
            // Los componentes devuelven strings HTML, los acumulamos
            return `    htmlOutput += ${inst.id}({ ${args} });`; 
        }

        return `    ${this.traducirInstruccion(inst)}`;
    }

    static traducirInstruccion(inst) {
        switch (inst.tipo) {
            case 'DECLARACION':
                return `let ${inst.id} = ${this.traducirExpresion(inst.exp)};`;
            case 'DECLARACION_ARR_VACIO':
                return `let ${inst.id} = new Array(${this.traducirExpresion(inst.size)});`;
            case 'DECLARACION_ARR_VALORES':
                const vals = inst.vals.map(v => this.traducirExpresion(v)).join(', ');
                return `let ${inst.id} = [${vals}];`;
            case 'DECLARACION_ARR_DB':
                return `let ${inst.id} = ejecutarSQL(\`${inst.query}\`);`;
            case 'ASIGNACION':
                return `${inst.id} = ${this.traducirExpresion(inst.exp)};`;
            case 'ASIGNACION_ARR':
                return `${inst.id}[${this.traducirExpresion(inst.index)}] = ${this.traducirExpresion(inst.exp)};`;
            case 'IF':
                return this.traducirIf(inst);
            case 'SWITCH':
                return this.traducirSwitch(inst);
            case 'WHILE':
                return `while (${this.traducirExpresion(inst.cond)}) {\n${inst.body.map(i => this.traducirInstruccionMain(i)).join('\n')}\n}`;
            case 'DO_WHILE':
                    return `do {\n${inst.body.map(i => this.traducirInstruccionMain(i)).join('\n')}\n} while (${this.traducirExpresion(inst.cond)});`;
            case 'FOR':
                let incremento = this.traducirInstruccion(inst.inc).replace(';', '');
                return `for (${this.traducirInstruccion(inst.init)} ${this.traducirExpresion(inst.cond)}; ${incremento}) {\n${inst.body.map(i => this.traducirInstruccionMain(i)).join('\n')}\n}`;
            case 'BREAK': return 'break;';
            case 'CONTINUE': return 'continue;';
            default: return '';
        }
    }

    static traducirIf(nodo) {
        let codigo = `if (${this.traducirExpresion(nodo.cond)}) {\n`;
        codigo += nodo.body.map(i => this.traducirInstruccionMain(i)).join('\n') + `\n}`;

        if (nodo.elseifs) {
            nodo.elseifs.forEach(e => {
                codigo += ` else if (${this.traducirExpresion(e.cond)}) {\n`;
                codigo += e.body.map(i => this.traducirInstruccionMain(i)).join('\n') + `\n}`;
            });
        }

        if (nodo.elseBody) {
            codigo += ` else {\n${nodo.elseBody.map(i => this.traducirInstruccionMain(i)).join('\n')}\n}`;
        }

        return codigo;
    }

    static traducirSwitch(nodo) {
        let codigo = `switch (${this.traducirExpresion(nodo.exp)}) {\n`;
        nodo.cases.forEach(c => {
            codigo += `    case ${this.traducirExpresion(c.val)}:\n`;
            codigo += c.body.map(i => `        ` + this.traducirInstruccionMain(i)).join('\n') + '\n';
        });
        if (nodo.def) {
            codigo += `    default:\n`;
            codigo += nodo.def.map(i => `        ` + this.traducirInstruccionMain(i)).join('\n') + '\n';
        }
        codigo += `}`;
        return codigo;
    }

    static traducirExpresion(e) {
        if (typeof e === 'string' || typeof e === 'number') return e;
        
        switch(e.tipo) {
            case 'ID': return e.val;
            case 'NUM': return e.val;
            case 'CADENA': return `"${e.val}"`;
            case 'CHAR': return `'${e.val}'`;
            case 'BOOL': return e.val === 'True' ? 'true' : 'false';
            case 'ARREGLO_ACCESO': return `${e.id}[${this.traducirExpresion(e.index)}]`;
            case 'BINARIA': return `${this.traducirExpresion(e.izq)} ${e.op} ${this.traducirExpresion(e.der)}`;
            case 'UNARIA': return `${e.op}${this.traducirExpresion(e.der)}`;
            default: return '';
        }
    }
}

module.exports = TraductorPrincipal;

const ParserDB = require('../Analizadores/DBJison'); 

class TraductorDB {

    static analizar(input) {
        try {
            const ast = ParserDB.parse(input);
            return this.generarSQL(ast);
        } catch (e) {
            console.error(e);
            return `/* ERROR LÉXICO/SINTÁCTICO: ${e.message} */`;
        }
    }

    static generarSQL(ast) {

        return ast.map(nodo => this.traducirInstruccion(nodo)).join('\n\n');
    }

    static traducirInstruccion(nodo) {
        switch (nodo.tipo) {
            case 'CREATE': return this.traducirCreate(nodo);
            case 'SELECT_COL': return this.traducirSelectCol(nodo);
            case 'QUERY_SIMPLE': return this.traducirQuerySimple(nodo);
            case 'INSERT': return this.traducirInsert(nodo);
            case 'UPDATE': return this.traducirUpdate(nodo);
            case 'DELETE': return this.traducirDelete(nodo);
            default: return `/* Instrucción SQL desconocida: ${nodo.tipo} */`;
        }
    }

    // ---------------- TRADUCTORES SQL ----------------

    static traducirCreate(nodo) {

        let definicionColumnas = ['id INTEGER PRIMARY KEY AUTOINCREMENT'];

        nodo.cols.forEach(col => {
            if (typeof col === 'string') {
                // Caso: TABLE usuarios { nombre, edad } -> No tienen tipo definido
                // SQLite es flexible, le asignamos TEXT por defecto para evitar errores.
                definicionColumnas.push(`${col} TEXT`); 
            } else {
                // Caso: TABLE usuarios COLUMNS nombre=string, edad=int
                const tipoSQLite = this.mapearTipo(col.tipo);
                definicionColumnas.push(`${col.id} ${tipoSQLite}`);
            }
        });

        return `CREATE TABLE IF NOT EXISTS ${nodo.tabla} (\n    ${definicionColumnas.join(',\n    ')}\n);`;
    }

    static traducirSelectCol(nodo) {
        return `SELECT ${nodo.col} FROM ${nodo.tabla};`;
    }

    static traducirQuerySimple(nodo) {
        return `SELECT * FROM ${nodo.tabla};`;
    }

    static traducirInsert(nodo) {
        // Extraemos las columnas y los valores de la lista de asignaciones
        const columnas = nodo.data.map(d => d.col).join(', ');
        const valores = nodo.data.map(d => d.val).join(', ');
        
        return `INSERT INTO ${nodo.tabla} (${columnas}) VALUES (${valores});`;
    }

    static traducirUpdate(nodo) {
        // Mapeamos las asignaciones al formato: col1 = val1, col2 = val2
        const asignaciones = nodo.data.map(d => `${d.col} = ${d.val}`).join(', ');
        
        // REQUERIMIENTO: La condición es obligatoria y siempre compara con el id
        return `UPDATE ${nodo.tabla} SET ${asignaciones} WHERE id = ${nodo.id};`;
    }

    static traducirDelete(nodo) {
        // REQUERIMIENTO: La condición es obligatoria y siempre compara con el id
        return `DELETE FROM ${nodo.tabla} WHERE id = ${nodo.id};`;
    }

    // ---------------- HELPERS ----------------

    static mapearTipo(tipoLexico) {
        // SQLite maneja tipos básicos (Afinidad de tipos). 
        // Convertimos los de tu lenguaje a los que SQLite comprende mejor.
        switch (tipoLexico) {
            case 'int': return 'INTEGER';
            case 'string': return 'TEXT';
            case 'number': 
            case 'float': return 'REAL'; // REAL es equivalente a double/float
            case 'boolean': return 'BOOLEAN'; // SQLite usa 1 y 0, pero acepta la palabra clave BOOLEAN
            default: return 'TEXT';
        }
    }
}

module.exports = TraductorDB;
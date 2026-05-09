class TablaSimbolos {
    constructor(padre = null) {
        this.variables = new Map();
        this.padre = padre;
    }

    set(nombre, valor) {
        this.variables.set(nombre, valor);
    }

    get(nombre) {
        if (this.variables.has(nombre)) return this.variables.get(nombre);
        if (this.padre) return this.padre.get(nombre);
        return null;
    }
}

module.exports = TablaSimbolos;
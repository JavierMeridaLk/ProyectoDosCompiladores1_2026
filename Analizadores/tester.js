const fs = require('fs');

class ProbadorAnalizadores {
    constructor() {
        console.log("Cargando analizadores...");
        
        this.parsers = {};
        
        // Cargando los 4 parsers generados por Jison
        this.cargarParser('estilos', './StylesJison');
        this.cargarParser('principal', './PrincipalJison');
        this.cargarParser('componentes', './ComponentsJison');
        this.cargarParser('datos', './DBJison');
    }

    cargarParser(nombre, ruta) {
        try {
            this.parsers[nombre] = require(ruta);
            console.log(`✅ Parser '${nombre}' cargado correctamente desde ${ruta}.js`);
        } catch (error) {
            console.warn(`⚠️ No se pudo cargar el parser '${nombre}'. (Asegúrate de haber ejecutado jison para generar el archivo)`);
        }
    }

    probarArchivo(tipo, rutaArchivo) {
        console.log(`\n========================================`);
        console.log(`🧪 Probando analizador: [${tipo.toUpperCase()}]`);
        console.log(`📄 Archivo: ${rutaArchivo}`);
        console.log(`========================================`);

        if (!this.parsers[tipo]) {
            console.error(`❌ Error: El parser para '${tipo}' no está cargado o disponible.`);
            return;
        }

        if (!fs.existsSync(rutaArchivo)) {
            console.error(`❌ Error: No se encontró el archivo de prueba '${rutaArchivo}'. Verifica que esté en la misma carpeta.`);
            return;
        }

        try {
            // Leer el archivo de prueba correspondiente
            const entrada = fs.readFileSync(rutaArchivo, 'utf-8');
            
            // Ejecutar el parser
            const ast = this.parsers[tipo].parse(entrada);
            
            console.log("✅ ¡Análisis Sintáctico Exitoso!");
            console.log("🌳 Resultado (AST):");
            
            // Imprimir el AST formateado
            console.log(JSON.stringify(ast, null, 2));
            
        } catch (error) {
            console.error("❌ Error durante el análisis:");
            console.error(error.message || error);
        }
    }

    ejecutarTodos() {
        // Ejecutando la lectura de los 4 archivos de prueba en la raíz de la carpeta
        this.probarArchivo('estilos', './misEstilos.styles');
        this.probarArchivo('principal', './main.y');
        this.probarArchivo('componentes', './misComponentes.comp');
        this.probarArchivo('datos', './consultas.db');
        
        console.log(`\n🏁 Pruebas finalizadas.\n`);
    }
}

// Inicializar y ejecutar todo de golpe
const probador = new ProbadorAnalizadores();
probador.ejecutarTodos();
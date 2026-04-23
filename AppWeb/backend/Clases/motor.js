const fs = require('fs');
const path = require('path');
const TraductorCSS = require('./traductorCSS'); // Ajusta la ruta según tu estructura

class Motor {
    /**
     * Ejecuta el proceso de traducción de un archivo
     * @param {string} rutaEntrada - Ruta del archivo .styles
     * @param {string} nombreSalida - Nombre del archivo .css resultante
     */
    static ejecutar(rutaEntrada, nombreSalida) {
        console.log("🚀 Iniciando proceso de traducción...");

        try {
            // 1. Verificar si el archivo existe
            if (!fs.existsSync(rutaEntrada)) {
                throw new Error(`El archivo de entrada no existe en: ${rutaEntrada}`);
            }

            // 2. Leer el contenido del archivo .styles
            const contenido = fs.readFileSync(rutaEntrada, 'utf-8');
            console.log("📄 Archivo leído correctamente.");

            // 3. Llamar al traductor (que internamente usa el parser)
            const resultadoCSS = TraductorCSS.analizar(contenido);

            // 4. Crear carpeta de salida si no existe
            const carpetaSalida = './output';
            if (!fs.existsSync(carpetaSalida)) {
                fs.mkdirSync(carpetaSalida);
            }

            // 5. Escribir el archivo final
            const rutaCompletaSalida = path.join(carpetaSalida, nombreSalida);
            fs.writeFileSync(rutaCompletaSalida, resultadoCSS);

            console.log(`✅ Traducción exitosa. Archivo generado en: ${rutaCompletaSalida}`);
            
        } catch (error) {
            console.error("❌ Error en el motor:");
            console.error(error.message);
        }
    }
}

// --- PRUEBA DE EJECUCIÓN ---
// Esto permite ejecutarlo directamente con: node Motor.js
Motor.ejecutar('./entrada.styles', 'estilosGenerados.css');
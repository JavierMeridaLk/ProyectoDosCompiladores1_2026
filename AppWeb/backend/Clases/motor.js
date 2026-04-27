const fs = require('fs');
const path = require('path');

const TraductorCSS = require('./traductorCSS');
const TraductorComponentes = require('./traductorComponentes');

class Motor {

    /**
     * Ejecuta traducción automática según extensión
     */
    static ejecutar(rutaEntrada) {
        console.log("🚀 Iniciando proceso de traducción...");

        try {
            if (!fs.existsSync(rutaEntrada)) {
                throw new Error(`El archivo no existe: ${rutaEntrada}`);
            }

            const contenido = fs.readFileSync(rutaEntrada, 'utf-8');
            console.log("📄 Archivo leído correctamente.");

            const ext = path.extname(rutaEntrada);

            let resultado = "";
            let nombreSalida = "";

            // 🔥 DETECCIÓN AUTOMÁTICA
            if (ext === '.styles') {
                resultado = TraductorCSS.analizar(contenido);
                nombreSalida = 'estilosGenerados.css';

            } else if (ext === '.comp') {
                resultado = TraductorComponentes.analizar(contenido);
                nombreSalida = 'componentesGenerados.js';

            } else {
                throw new Error(`Extensión no soportada: ${ext}`);
            }

            // Crear carpeta output
            const carpetaSalida = './output';
            if (!fs.existsSync(carpetaSalida)) {
                fs.mkdirSync(carpetaSalida);
            }

            const rutaSalida = path.join(carpetaSalida, nombreSalida);
            fs.writeFileSync(rutaSalida, resultado);

            console.log(`✅ Traducción exitosa → ${rutaSalida}`);

        } catch (error) {
            console.error("❌ Error en el motor:");
            console.error(error);
        }
    }
}

module.exports = Motor;


// ----------------------
// PRUEBAS
// ----------------------

// 🔹 CSS
Motor.ejecutar('./entrada.styles');

// 🔹 COMPONENTES
Motor.ejecutar('./entrada.comp');
const fs = require('fs');
const path = require('path');

// Importamos los traductores
const TraductorCSS = require('./traductorCSS');
const TraductorComponentes = require('./traductorComponentes');
const TraductorDB = require('./traductorDB');
const TraductorPrincipal = require('./traductorPrincipal'); // <-- NUEVO

class Motor {

    /**
     * Ejecuta traducción automática según extensión
     */
    static ejecutar(rutaEntrada) {
        console.log(`🚀 Iniciando proceso de traducción para: ${rutaEntrada}`);

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

            } else if (ext === '.db') {
                resultado = TraductorDB.analizar(contenido);
                nombreSalida = 'consultasGeneradas.sql';

            } else if (ext === '.y') { // <-- NUEVA REGLA PARA EL LENGUAJE PRINCIPAL
                // Pasamos la rutaEntrada para que pueda resolver las rutas relativas de los imports
                resultado = TraductorPrincipal.analizar(contenido, rutaEntrada);
                nombreSalida = 'mainGenerado.js';

            } else {
                throw new Error(`Extensión no soportada: ${ext}`);
            }

            // Crear carpeta output si no existe
            const carpetaSalida = './output';
            if (!fs.existsSync(carpetaSalida)) {
                fs.mkdirSync(carpetaSalida);
            }

            const rutaSalida = path.join(carpetaSalida, nombreSalida);
            fs.writeFileSync(rutaSalida, resultado);

            console.log(`✅ Traducción exitosa → ${rutaSalida}\n`);

        } catch (error) {
            console.error(`❌ Error en el motor al procesar ${rutaEntrada}:`);
            console.error(error.message, '\n');
        }
    }
}

module.exports = Motor;


// ----------------------
// PRUEBAS
// ----------------------
Motor.ejecutar('./entrada.styles');
Motor.ejecutar('./entrada.comp');
Motor.ejecutar('./entrada.db');
Motor.ejecutar('./entrada.y');
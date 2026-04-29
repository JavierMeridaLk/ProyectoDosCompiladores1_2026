// --- ARCHIVO PRINCIPAL GENERADO ---

// Imports validados:

// Variables Globales
let usuariosDB = ejecutarSQL(`SELECT username FROM users`);
let currentUser = "Misty";
let isLogged = false;

// Funciones de Lógica y DB
function hacerLogin(user) {
    try {
        ejecutarSQL(`INSERT INTO login_logs (usuario) VALUES ($user)`); // Asume que tienes una función puente para la BD
    } catch(err) {
        alert("Error en la base de datos: " + err.message);
        return; // Detiene la ejecución
    }
    window.location.href = "./home.y";
}

// --- FUNCIÓN PRINCIPAL ---
document.addEventListener("DOMContentLoaded", () => {
    let htmlOutput = "";

    htmlOutput += AppStyleLoader({  });
    let i = 0;
    while (i < 5) {
    if (usuariosDB[i] === currentUser) {
    isLogged = true;
    break;
}
    i = i + 1;
}
    if (isLogged) {
    htmlOutput += Bienvenida({ currentUser });
} else {
    htmlOutput += FormularioLogin({ hacerLogin });
}
    // Renderizamos todo en el contenedor principal
    document.body.innerHTML = htmlOutput;
});

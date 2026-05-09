// ── ARCHIVO PRINCIPAL GENERADO ──


// Variables Globales
let contador = 0;
let promedio = 9.5;
let nombre = "Ash";
let activo = true;
let inicial = 'A';
let temporal = null;
let mensaje = null;
let espacios = new Array(5);
let pokemones = ["Pikachu", "Charmander", "Squirtle", "Bulbasaur"];
let precios = [1.5, 2, 3.75, 4.25];
let nombres_db = ejecutarSQL(`pokemon.nombre`);

// Funciones
function actualizarPokemon(nivel, id) {
    try {
        ejecutarSQL(`pokemon[nivel=$nivel] IN $id`);
    } catch (__err) {
        alert("Error DB: " + __err.message);
        return;
    }
    window.location.href = "./main.y";
}
function guardarBatalla(entrenadorId, pokemonId) {
    try {
        ejecutarSQL(`batalla[entrenador_id=$entrenadorId, pokemon_id=$pokemonId, resultado="victoria", puntos=100] IN $entrenadorId`);
    } catch (__err) {
        alert("Error DB: " + __err.message);
        return;
    }
}

// ── Función Principal ──
document.addEventListener("DOMContentLoaded", () => {
    let __html = "";

    __html += (typeof Header === "function") ? Header() : "";
    __html += (typeof TarjetaUsuario === "function") ? TarjetaUsuario(nombre, contador, activo) : "";
    contador = (contador + 1);
    nombre = "Misty";
    pokemones[0] = "Raichu";
    if (activo) {
        __html += (typeof Dashboard === "function") ? Dashboard(nombre, contador, nombres_db, activo) : "";
    } else if ((contador === 0)) {
        __html += (typeof EmptyState === "function") ? EmptyState("Sin datos") : "";
    } else {
        __html += (typeof ErrorPage === "function") ? ErrorPage("Inactivo") : "";
    }
    switch (nombre) {
        case "Ash":
            __html += (typeof TarjetaUsuario === "function") ? TarjetaUsuario(nombre, contador, activo) : "";
            break;
        case "Misty":
            __html += (typeof TarjetaUsuario === "function") ? TarjetaUsuario(nombre, contador, activo) : "";
            break;
        default:
            __html += (typeof Header === "function") ? Header() : "";
            break;
            break;
    }
    while ((contador < 10)) {
        if ((contador === 3)) {
            contador = (contador + 1);
            continue;
        }
        if ((contador === 8)) {
            break;
        }
        __html += (typeof ListaPokemones === "function") ? ListaPokemones(pokemones) : "";
        contador = (contador + 1);
    }
    do {
        __html += (typeof Header === "function") ? Header() : "";
        contador = (contador - 1);
    } while ((contador > 0));
    for (let i = 0; (i < 4); i = (i + 1)) {
        __html += (typeof TarjetaUsuario === "function") ? TarjetaUsuario(pokemones[i], i, activo) : "";
    }
    for (contador = 0; (contador <= 3); contador = (contador + 1)) {
        __html += (typeof InsigniaEstado === "function") ? InsigniaEstado(pokemones[contador]) : "";
    }
    try {
        ejecutarSQL(`entrenador[nombre="Ash", medallas=8, region="Kanto", activo=1] IN 1`);
    } catch (__err) {
        alert("Error DB: " + __err.message);
    }
    if (((contador >= 5) && activo)) {
        __html += (typeof Dashboard === "function") ? Dashboard(nombre, contador, nombres_db, activo) : "";
    }
    if (((contador < 2) || !(activo))) {
        __html += (typeof Header === "function") ? Header() : "";
    }
    let nivel = 0;
    while ((nivel < 3)) {
        for (let j = 0; (j < (nivel + 1)); j = (j + 1)) {
            if ((j === 0)) {
                __html += (typeof TablaEstadisticas === "function") ? TablaEstadisticas(nombre, pokemones[j], nivel, j) : "";
            } else if ((j === 1)) {
                __html += (typeof TarjetaUsuario === "function") ? TarjetaUsuario(pokemones[j], j, activo) : "";
            } else {
                __html += (typeof Header === "function") ? Header() : "";
            }
        }
        nivel = (nivel + 1);
    }
    __html += (typeof Footer === "function") ? Footer() : "";

    document.body.innerHTML = __html;
});
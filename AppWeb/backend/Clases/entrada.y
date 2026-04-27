/* Archivo de prueba del lenguaje principal
*/

# import "./misComponentes.comp";

/* Variables globales */
int contador = 0;
string saludo = "Bienvenido a la Pokedex";
boolean cargado = True;
float[] baseDeDatos = execute `SELECT * FROM pokemons`;

/* Funciones de lógica */
function recargarApp(int idPokemon) {
    execute `UPDATE stats SET vistas = vistas + 1 WHERE id = $idPokemon`;
    load "./index.html";
}

/* Función principal */
main {
    @Header(saludo);
    
    if (cargado) {
        @Banner();
    } else {
        @Loading();
    }

    for (int i = 0; i < 5; i = i + 1) {
        @PokemonCard(i, recargarApp);
    }
    
    while (contador < 2) {
        @Divisor();
        contador = contador + 1;
    }

    @Footer();
}
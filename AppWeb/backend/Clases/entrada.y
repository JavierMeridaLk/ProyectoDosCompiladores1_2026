/* Prueba avanzada del lenguaje principal */

/* Variables de todos los tipos */
int contador = 0;
float promedio = 9.5;
string nombre = "Ash";
boolean activo = True;
char inicial = 'A';

/* Variables sin inicializar */
int temporal;
string mensaje;

/* Arreglos */
int[] espacios = [5];
string[] pokemones = {"Pikachu", "Charmander", "Squirtle", "Bulbasaur"};
float[] precios = {1.5, 2.0, 3.75, 4.25};

/* Arreglo desde base de datos */
string[] nombres_db = execute `pokemon.nombre`;

/* Funciones */
function actualizarPokemon(int nivel, int id) {
    execute `pokemon[nivel=$nivel] IN $id`;
    load "./main.y";
}

function guardarBatalla(int entrenadorId, int pokemonId) {
    execute `batalla[entrenador_id=$entrenadorId, pokemon_id=$pokemonId, resultado="victoria", puntos=100] IN $entrenadorId`;
}

/* Bloque principal */
main {

    /* Invocacion de componentes */
    @Header();
    @TarjetaUsuario(nombre, contador, activo);

    /* Asignaciones */
    contador = contador + 1;
    nombre = "Misty";
    pokemones[0] = "Raichu";

    /* If else if else */
    if (activo) {
        @Dashboard(nombre, contador, nombres_db, activo);
    } else if (contador == 0) {
        @EmptyState("Sin datos");
    } else {
        @ErrorPage("Inactivo");
    }

    /* Switch con string */
    switch (nombre) {
        case "Ash":
            @TarjetaUsuario(nombre, contador, activo);
            break;
        case "Misty":
            @TarjetaUsuario(nombre, contador, activo);
            break;
        default:
            @Header();
            break;
    }

    /* While con break y continue */
    while (contador < 10) {
        if (contador == 3) {
            contador = contador + 1;
            continue;
        }
        if (contador == 8) {
            break;
        }
        @ListaPokemones(pokemones);
        contador = contador + 1;
    }

    /* Do while */
    do {
        @Header();
        contador = contador - 1;
    } while (contador > 0);

    /* For con declaracion de variable */
    for (int i = 0; i < 4; i = i + 1) {
        @TarjetaUsuario(pokemones[i], i, activo);
    }

    /* For con variable existente */
    for (contador = 0; contador <= 3; contador = contador + 1) {
        @InsigniaEstado(pokemones[contador]);
    }

    /* Execute en main */
    execute `entrenador[nombre="Ash", medallas=8, region="Kanto", activo=1] IN 1`;

    /* Expresiones complejas */
    if (contador >= 5 && activo) {
        @Dashboard(nombre, contador, nombres_db, activo);
    }

    if (contador < 2 || !activo) {
        @Header();
    }

    /* Bloques anidados */
    int nivel = 0;
    while (nivel < 3) {
        for (int j = 0; j < nivel + 1; j = j + 1) {
            if (j == 0) {
                @TablaEstadisticas(nombre, pokemones[j], nivel, j);
            } else if (j == 1) {
                @TarjetaUsuario(pokemones[j], j, activo);
            } else {
                @Header();
            }
        }
        nivel = nivel + 1;
    }

    @Footer();
}
/* Archivo: app.y */

import "./vistas.comp";
import "./theme.styles";

/* Tipos primitivos y booleanos explícitos (True/False según el documento) */
int contador = 0;
boolean esAdmin = True;
char inicial = 'Y';
float impuesto = 0.12;

/* Declaración de arreglos variados */
int[] ids_borrados = [10];
string[] nombres = {"Carlos", "Ana", "Luis"};
float[] saldos = execute `usuarios.saldo`;

/* Función limitada solo a interactuar con DB y LOAD */
function eliminarUsuarioDB(string motivo, boolean confirmar) {
    execute `log_eliminaciones[motivo_txt = $motivo, confirmado = $confirmar]`;
    load "./app.y";
}

main {
    @navbar();
    
    /* Variables locales e invocación de componentes en ciclos */
    int i = 0;
    while (i < 3) {
        if (esAdmin == True && contador <= 10) {
            @panelUsuario(nombres[i], 25, eliminarUsuarioDB);
        } else {
            /* Ciclo anidado para probar precedencia */
            do {
                contador = contador + (1 * 2);
            } while (contador < 5);
        }
        i = i + 1;
    }

    /* For tradicional validando la gramática de declaración interna */
    for (int j = 0; j < 10; j = j + 1) {
        if (j == 5) {
            break;
        }
        continue;
    }
}
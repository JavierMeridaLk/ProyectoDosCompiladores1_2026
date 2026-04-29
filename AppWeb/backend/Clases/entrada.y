/* Test 3: Sistema de Autenticación
   Evalúa: Declaración de array con DB, While, Break
*/

string[] usuariosDB = execute `SELECT username FROM users`;
string currentUser = "Misty";
boolean isLogged = False;

function hacerLogin(string user) {
    execute `INSERT INTO login_logs (usuario) VALUES ($user)`;
    load "./home.y";
}

main {
    @AppStyleLoader();
    
    int i = 0;
    while (i < 5) {
        if (usuariosDB[i] == currentUser) {
            isLogged = True;
            break;
        }
        i = i + 1;
    }

    if (isLogged) {
        @Bienvenida(currentUser);
    } else {
        @FormularioLogin(hacerLogin);
    }
}
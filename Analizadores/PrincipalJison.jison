/* Analizador lexico del lenguaje principal */
%{
    
%}

/* Analizador léxico */
%lex
%options case-sensitive

%%

/* Espacios y comentarios */
\s+                         /* ignorar espacios */
"/*"[\s\S]*?"*/"            /* ignorar comentarios multilínea */
"#".* /* ignorar comentarios de una línea */

/* Palabras Reservadas */
"import"                    return 'IMPORT';
"execute"                   return 'EXECUTE';
"load"                      return 'LOAD';
"function"                  return 'FUNCTION';
"main"                      return 'MAIN';

/* Tipos de Datos */
"int"                       return 'TYPE_INT';
"float"                     return 'TYPE_FLOAT';
"string"                    return 'TYPE_STRING';
"boolean"                   return 'TYPE_BOOLEAN';
"char"                      return 'TYPE_CHAR';
"True"                      return 'TRUE';
"False"                     return 'FALSE';

/* Estructuras de Control */
"if"                        return 'IF';
"else"                      return 'ELSE';
"switch"                    return 'SWITCH';
"case"                      return 'CASE';
"default"                   return 'DEFAULT';
"while"                     return 'WHILE';
"do"                        return 'DO';
"for"                       return 'FOR';
"break"                     return 'BREAK';
"continue"                  return 'CONTINUE';

/* Símbolos Relacionales y Lógicos (¡Siempre antes de los de 1 caracter!) */
"=="                        return '==';
"!="                        return '!=';
"<="                        return '<=';
">="                        return '>=';
"&&"                        return '&&';
"||"                        return '||';

/* Símbolos Simples */
"@"                         return '@';
";"                         return ';';
","                         return ',';
":"                         return ':';
"="                         return '=';
"{"                         return '{';
"}"                         return '}';
"["                         return '[';
"]"                         return ']';
"("                         return '(';
")"                         return ')';
"+"                         return '+';
"-"                         return '-';
"*"                         return '*';
"/"                         return '/';
"%"                         return '%';
"!"                         return '!';
"<"                         return '<';
">"                         return '>';

/* Expresiones Regulares para Valores */
\"([^\"\\]|\\.)*\"          return 'CADENA';
\'([^\'\\]|\\.)\'           return 'CARACTER';
\`([^\`\\]|\\.)*\`          return 'QUERY_SQL';  /* Para el execute */
[0-9]+"."[0-9]+\b           return 'NUM_FLOAT';
[0-9]+\b                    return 'NUM_INT';
[a-zA-Z_][a-zA-Z0-9_]* return 'IDENTIFICADOR';

<<EOF>>                     return 'EOF';
.                           { console.error('Error léxico en línea ' + yylloc.first_line + ': ' + yytext); }

/lex

/* 3. PRECEDENCIA ARITMÉTICA Y LÓGICA */
%left '||'
%left '&&'
%left '==' '!=' '<' '<=' '>' '>='
%left '+' '-'
%left '*' '/' '%'
%right '!'
%right UMINUS

%start inicio

%%

/* 4. REGLAS SINTÁCTICAS */

inicio
    : programa EOF { return $1; }
    ;

programa
    : lista_imports lista_declaraciones lista_funciones MAIN '{' instrucciones_main '}'
    ;

/* --- IMPORTS --- */
lista_imports
    : lista_imports IMPORT CADENA ';'
    | /* vacío */
    ;

/* --- VARIABLES GLOBALES --- */
lista_declaraciones
    : lista_declaraciones declaracion
    | /* vacío */
    ;

declaracion
    : tipo IDENTIFICADOR '=' expresion ';'
    /* Declaración sin inicializar (ej. int i;) */
    | tipo IDENTIFICADOR ';'
    /* Arreglo vacío con tamaño: int[] arr = [3]; */
    | tipo '[' ']' IDENTIFICADOR '=' '[' expresion ']' ';'
    /* Arreglo inicializado: string[] arr = {"a", "b"}; */
    | tipo '[' ']' IDENTIFICADOR '=' '{' lista_expresiones '}' ';'
    /* Arreglo por DB: float[] myTeam = execute `query`; */
    | tipo '[' ']' IDENTIFICADOR '=' EXECUTE QUERY_SQL ';'
    ;

tipo
    : TYPE_INT | TYPE_FLOAT | TYPE_STRING | TYPE_BOOLEAN | TYPE_CHAR
    ;

/* --- FUNCIONES --- */
lista_funciones
    : lista_funciones funcion
    | /* vacío */
    ;

funcion
    : FUNCTION IDENTIFICADOR '(' parametros_opt ')' '{' instrucciones_funcion '}'
    ;

parametros_opt
    : lista_parametros
    | /* vacío */
    ;

lista_parametros
    : lista_parametros ',' tipo IDENTIFICADOR
    | tipo IDENTIFICADOR
    ;

/* Las funciones solo pueden ejecutar DB o cargar archivos/variables */
instrucciones_funcion
    : instrucciones_funcion instruccion_funcion
    | /* vacío */
    ;

instruccion_funcion
    : EXECUTE QUERY_SQL ';'
    | LOAD expresion ';'
    ;

/* --- BLOQUE MAIN Y LÓGICA --- */
instrucciones_main
    : instrucciones_main instruccion_main
    | /* vacío */
    ;

instruccion_main
    : declaracion              /* <-- CORRECCIÓN: Ahora puedes declarar variables locales en el main y en ciclos */
    | invocacion_componente
    | asignacion
    | logica_if
    | logica_switch
    | logica_while
    | logica_do_while
    | logica_for
    | BREAK ';'
    | CONTINUE ';'
    ;

invocacion_componente
    : '@' IDENTIFICADOR '(' lista_expresiones_opt ')' ';'
    ;

asignacion
    : IDENTIFICADOR '=' expresion ';'
    | IDENTIFICADOR '[' expresion ']' '=' expresion ';' /* Asignar a posición de arreglo */
    ;

/* --- ESTRUCTURAS DE CONTROL --- */
logica_if
    : IF '(' expresion ')' '{' instrucciones_main '}' lista_elseif else_opt
    ;

lista_elseif
    : lista_elseif ELSE IF '(' expresion ')' '{' instrucciones_main '}'
    | /* vacío */
    ;

else_opt
    : ELSE '{' instrucciones_main '}'
    | /* vacío */
    ;

logica_switch
    : SWITCH '(' expresion ')' '{' lista_cases default_opt '}'
    ;

lista_cases
    : lista_cases CASE expresion ':' instrucciones_main
    | CASE expresion ':' instrucciones_main
    ;

default_opt
    : DEFAULT ':' instrucciones_main
    | /* vacío */
    ;

logica_while
    : WHILE '(' expresion ')' '{' instrucciones_main '}'
    ;

logica_do_while
    : DO '{' instrucciones_main '}' WHILE '(' expresion ')' ';'
    ;

logica_for
    : FOR '(' asignacion_for ';' expresion ';' asignacion_for ')' '{' instrucciones_main '}'
    ;

/* --- CORRECCIÓN: El for ahora acepta declaraciones con tipo (ej: int i = 0) --- */
asignacion_for
    : tipo IDENTIFICADOR '=' expresion
    | IDENTIFICADOR '=' expresion
    | /* vacío */
    ;

/* --- EXPRESIONES --- */
lista_expresiones_opt
    : lista_expresiones
    | /* vacío */
    ;

lista_expresiones
    : lista_expresiones ',' expresion
    | expresion
    ;

expresion
    : expresion '+' expresion
    | expresion '-' expresion
    | expresion '*' expresion
    | expresion '/' expresion
    | expresion '%' expresion
    | expresion '==' expresion
    | expresion '!=' expresion
    | expresion '<' expresion
    | expresion '<=' expresion
    | expresion '>' expresion
    | expresion '>=' expresion
    | expresion '&&' expresion
    | expresion '||' expresion
    | '!' expresion
    | '-' expresion %prec UMINUS
    | '(' expresion ')'
    | IDENTIFICADOR
    | IDENTIFICADOR '[' expresion ']' /* Acceso a arreglos, ej: pokemons[i] */
    | NUM_INT
    | NUM_FLOAT
    | CADENA
    | CARACTER
    | TRUE
    | FALSE
    ;
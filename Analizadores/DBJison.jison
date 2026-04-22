/* Analizador lexico y sintactico para el lenguaje de DATABASE */
%{
    // Opcional: Lógica para manejar la tabla de símbolos de la DB
%}

/* Analizador lexico */
%lex
%options case-sensitive

%%

\s+                         /* ignorar espacios */
"/*"[\s\S]*?"*/"            /* ignorar comentarios multilínea */

/* Palabras Reservadas */
"TABLE"                     return 'TABLE';
"COLUMNS"                   return 'COLUMNS';
"IN"                        return 'IN';
"DELETE"                    return 'DELETE';

/* Tipos de datos */
"int"                       return 'TYPE_INT';
"string"                    return 'TYPE_STRING';
"number"                    return 'TYPE_NUMBER';
"boolean"                   return 'TYPE_BOOLEAN';
"float"                     return 'TYPE_FLOAT';

/* Valores constantes */
"true"                      return 'TRUE';
"false"                     return 'FALSE';

/* Símbolos Simples */
";"                         return ';';
","                         return ',';
"."                         return '.';
"="                         return '=';
"["                         return '[';
"]"                         return ']';
"("                         return '(';
")"                         return ')';
"{"                         return '{'; /* AGREGADO: Para soportar el archivo de prueba */
"}"                         return '}'; /* AGREGADO: Para soportar el archivo de prueba */
"+"                         return '+';
"-"                         return '-';
"*"                         return '*';
"/"                         return '/';
"%"                         return '%';
"!"                         return '!';

/* Símbolos Lógicos y Relacionales */
"=="                        return '==';
"!="                        return '!=';
"<="                        return '<=';
">="                        return '>=';
"<"                         return '<';
">"                         return '>';
"&&"                        return '&&';
"||"                        return '||';

/* Cadenas de texto, números e Identificadores */
\"([^\"\\]|\\.)*\"          return 'CADENA';
[0-9]+("."[0-9]+)?\b        return 'NUMERO';
[a-zA-Z_][a-zA-Z0-9_]* return 'IDENTIFICADOR';

<<EOF>>                     return 'EOF';
.                           { console.error('Error léxico en DB: ' + yytext); }

/lex

%left '||'
%left '&&'
%left '==' '!=' '<' '<=' '>' '>='
%left '+' '-'
%left '*' '/' '%'
%right '!'
%right UMINUS

%start inicio

%%

inicio
    : lista_consultas EOF { return $1; }
    ;

lista_consultas
    : lista_consultas consulta { $1.push($2); $$ = $1; }
    | consulta                 { $$ = [$1]; }
    ;

/* El punto y coma ahora es opcional para mayor flexibilidad en scripts rápidos */
consulta
    : instruccion ';' { $$ = $1; }
    | instruccion     { $$ = $1; }
    ;

instruccion
    : crear_tabla
    | seleccionar_columna
    | insertar_o_actualizar_registro
    | eliminar_registro
    | consulta_simple
    ;

/* Soporta TABLE usuarios { id, nombre } y TABLE usuarios COLUMNS id=int */
crear_tabla
    : TABLE IDENTIFICADOR '{' lista_columnas_simple '}' 
        { $$ = {tipo: 'CREATE', tabla: $2, cols: $4}; }
    | TABLE IDENTIFICADOR COLUMNS lista_definicion_columnas
        { $$ = {tipo: 'CREATE', tabla: $2, cols: $4}; }
    ;

lista_columnas_simple
    : lista_columnas_simple ',' IDENTIFICADOR { $1.push($3); $$ = $1; }
    | IDENTIFICADOR                           { $$ = [$1]; }
    ;

lista_definicion_columnas
    : lista_definicion_columnas ',' definicion_columna { $1.push($3); $$ = $1; }
    | definicion_columna                               { $$ = [$1]; }
    ;

definicion_columna
    : IDENTIFICADOR '=' tipos_permitidos { $$ = {id: $1, tipo: $3}; }
    ;

tipos_permitidos
    : TYPE_INT | TYPE_STRING | TYPE_NUMBER | TYPE_BOOLEAN | TYPE_FLOAT
    ;

seleccionar_columna
    : IDENTIFICADOR '.' IDENTIFICADOR { $$ = {tipo: 'SELECT_COL', tabla: $1, col: $3}; }
    ;

/* Para casos como el del test: "usuarios, productos, ventas" */
consulta_simple
    : IDENTIFICADOR { $$ = {tipo: 'QUERY_SIMPLE', tabla: $1}; }
    ;

insertar_o_actualizar_registro
    : IDENTIFICADOR '[' lista_asignaciones ']'          
        { $$ = {tipo: 'INSERT', tabla: $1, data: $3}; }
    | IDENTIFICADOR '[' lista_asignaciones ']' IN NUMERO 
        { $$ = {tipo: 'UPDATE', tabla: $1, data: $3, id: $6}; }
    ;

lista_asignaciones
    : lista_asignaciones ',' asignacion { $1.push($3); $$ = $1; }
    | asignacion                        { $$ = [$1]; }
    ;

asignacion
    : IDENTIFICADOR '=' expresion { $$ = {col: $1, val: $3}; }
    ;

eliminar_registro
    : IDENTIFICADOR DELETE NUMERO { $$ = {tipo: 'DELETE', tabla: $1, id: $3}; }
    ;

expresion
    : expresion '+' expresion { $$ = $1 + $3; }
    | expresion '-' expresion
    | expresion '*' expresion
    | expresion '/' expresion
    | '(' expresion ')'       { $$ = $2; }
    | CADENA
    | NUMERO
    | TRUE
    | FALSE
    ;
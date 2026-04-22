/*Analixador de lexico y sintactico para el lenguaje para la DATABASE*/
%{
    
%}

/*  Analixador lexico */
%lex
%options case-sensitive

%%

/* Espacios y comentarios */
\s+                         /* ignorar espacios */
"/*"[\s\S]*?"*/"            /* ignorar comentarios multilínea */

/* Palabras Reservadas */
"TABLE"                     return 'TABLE';
"COLUMNS"                   return 'COLUMNS';
"IN"                        return 'IN';
"DELETE"                    return 'DELETE';

/* Tipos de datos (Heredados del lenguaje principal) */
"int"                       return 'TYPE_INT';
"string"                    return 'TYPE_STRING';
"number"                    return 'TYPE_NUMBER';
"boolean"                   return 'TYPE_BOOLEAN';

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
"+"                         return '+';
"-"                         return '-';
"*"                         return '*';
"/"                         return '/';
"%"                         return '%';
"!"                         return '!';

/* Símbolos Lógicos y Relacionales (Para las expresiones matemáticas/lógicas) */
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
.                           { console.error('Error léxico: ' + yytext); }

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
    : lista_consultas EOF { return $1; }
    ;

lista_consultas
    : lista_consultas consulta { $1.push($2); $$ = $1; }
    | consulta                 { $$ = [$1]; }
    ;

/* Exigimos el PUNTO Y COMA al final de cada consulta para evitar ambigüedades */
consulta
    : instruccion ';' { $$ = $1; }
    ;

instruccion
    : crear_tabla
    | seleccionar_columna
    | insertar_o_actualizar_registro
    | eliminar_registro
    ;

/* CREATE: TABLE table_name COLUMNS column_name=type, ... */
crear_tabla
    : TABLE IDENTIFICADOR COLUMNS lista_definicion_columnas
    ;

lista_definicion_columnas
    : lista_definicion_columnas ',' definicion_columna
    | definicion_columna
    ;

definicion_columna
    : IDENTIFICADOR '=' tipos_permitidos
    ;

tipos_permitidos
    : TYPE_INT | TYPE_STRING | TYPE_NUMBER | TYPE_BOOLEAN
    ;

/* SELECT: table_name.column_name */
seleccionar_columna
    : IDENTIFICADOR '.' IDENTIFICADOR
    ;

/* INSERT / UPDATE: table_name[column="val"] (Opcional: IN id) */
insertar_o_actualizar_registro
    : IDENTIFICADOR '[' lista_asignaciones ']'          /* Insertar */
    | IDENTIFICADOR '[' lista_asignaciones ']' IN NUMERO /* Actualizar */
    ;

lista_asignaciones
    : lista_asignaciones ',' asignacion
    | asignacion
    ;

asignacion
    : IDENTIFICADOR '=' expresion
    ;

/* DELETE: table_name DELETE id */
eliminar_registro
    : IDENTIFICADOR DELETE NUMERO
    ;

/* Soporte para que los valores de los registros puedan ser expresiones matemáticas/lógicas */
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
    | '(' expresion ')'
    | '-' expresion %prec UMINUS
    | CADENA
    | NUMERO
    | TRUE
    | FALSE
    ;
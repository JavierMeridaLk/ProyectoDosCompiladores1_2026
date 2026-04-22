/*  Analixador lexico y sintactico de lenguaje de componentes */

%{

%}

/*  Analixador lexico*/
%lex
%options case-sensitive

%%

/* Espacios y comentarios */
\s+                         /* ignorar espacios */
"/*"[\s\S]*?"*/"            /* ignorar comentarios multilínea */

/* Tipos de Datos */
"int"                       return 'INT';
"string"                    return 'STRING';
"function"                  return 'FUNCTION';

/* Componentes Visuales y Formularios */
"T"                         return 'T';
"IMG"                       return 'IMG';
"FORM"                      return 'FORM';
"SUBMIT"                    return 'SUBMIT';
"INPUT_TEXT"                return 'INPUT_TEXT';
"INPUT_NUMBER"              return 'INPUT_NUMBER';
"INPUT_BOOL"                return 'INPUT_BOOL';

/* Propiedades reservadas */
"id"                        return 'PR_ID';
"label"                     return 'PR_LABEL';
"value"                     return 'PR_VALUE';
"true"                      return 'TRUE';
"false"                     return 'FALSE';

/* Lógica de Control */
"for"                       return 'FOR';
"each"                      return 'EACH';
"track"                     return 'TRACK';
"empty"                     return 'EMPTY';
"if"                        return 'IF';
"else"                      return 'ELSE';
"Switch"                    return 'SWITCH';
"case"                      return 'CASE';
"default"                   return 'DEFAULT';

/* Símbolos Compuestos (Deben ir antes de los simples) */
"[["                        return '[[';
"]]"                        return ']]';
"=="                        return '==';
"!="                        return '!=';
"<="                        return '<=';
">="                        return '>=';
"&&"                        return '&&';
"||"                        return '||';

/* Símbolos Simples */
"["                         return '[';
"]"                         return ']';
"<"                         return '<';
">"                         return '>';
"("                         return '(';
")"                         return ')';
"{"                         return '{';
"}"                         return '}';
","                         return ',';
":"                         return ':';
"+"                         return '+';
"-"                         return '-';
"*"                         return '*';
"/"                         return '/';
"%"                         return '%';
"!"                         return '!';

/* Cadenas y Variables */
\"([^\"\\]|\\.)*\"          return 'CADENA';
"$"[a-zA-Z0-9_]+            return 'VARIABLE';
"@"[a-zA-Z0-9_]+            return 'REF_ID';    /* Para el @valid, @name */
[0-9]+("."[0-9]+)?\b        return 'NUMERO';
[a-zA-Z_][a-zA-Z0-9_]* return 'IDENTIFICADOR';

<<EOF>>                     return 'EOF';
.                           { console.error('Error léxico: ' + yytext); }

/lex

/* 3. PRECEDENCIA (Para las expresiones matemáticas y lógicas) */
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
    : lista_componentes EOF { return $1; }
    ;

lista_componentes
    : lista_componentes componente { $1.push($2); $$ = $1; }
    | componente                   { $$ = [$1]; }
    ;

/* Un componente se define con su nombre (Identificador) */
componente
    : IDENTIFICADOR '(' parametros ')' '{' elementos '}'
    | IDENTIFICADOR '(' ')' '{' elementos '}'
    ;

parametros
    : parametros ',' parametro 
    | parametro
    ;

parametro
    : tipo IDENTIFICADOR
    | tipo VARIABLE
    ;

tipo
    : INT | STRING | FUNCTION
    ;

elementos
    : elementos elemento 
    | /* vacío */
    ;

elemento
    : seccion
    | tabla
    | texto
    | imagen
    | formulario
    | input_form    /* Para permitir inputs sueltos si están en un FORM */
    | logica_for
    | logica_if
    | logica_switch
    ;

estilos_opt
    : '<' lista_ids '>' 
    | /* vacío */
    ;

lista_ids
    : lista_ids ',' IDENTIFICADOR
    | IDENTIFICADOR
    ;

/* --- ESTRUCTURAS DE VISUALIZACIÓN --- */

seccion
    : estilos_opt '[' elementos ']'
    ;

tabla
    : estilos_opt '[[' filas ']]'
    ;

filas
    : filas fila | fila ;

fila
    : '[[' columnas ']]' ;

columnas
    : columnas columna | columna ;

columna
    : '[[' elementos ']]' ;

texto
    : T estilos_opt '(' CADENA ')'
    ;

imagen
    : IMG estilos_opt '(' lista_valores ')'
    ;

lista_valores
    : lista_valores ',' valor
    | valor
    ;

/* --- FORMULARIOS --- */

formulario
    : FORM estilos_opt '{' elementos '}' submit_opt
    ;

submit_opt
    : SUBMIT estilos_opt '{' PR_LABEL ':' valor propiedades_submit_extra '}'
    | /* vacío */
    ;

propiedades_submit_extra
    : /* vacío */
    | ',' FUNCTION ':' VARIABLE '(' lista_ref_id ')' 
    ;

lista_ref_id
    : lista_ref_id ',' REF_ID
    | REF_ID
    ;

input_form
    : INPUT_TEXT estilos_opt '(' props_input ')'
    | INPUT_NUMBER estilos_opt '(' props_input ')'
    | INPUT_BOOL estilos_opt '(' props_input ')'
    ;

props_input
    : prop_input ',' prop_input ',' prop_input
    ;

prop_input
    : PR_ID ':' valor
    | PR_LABEL ':' valor
    | PR_VALUE ':' valor
    ;

valor
    : CADENA
    | VARIABLE
    | NUMERO
    | TRUE
    | FALSE
    ;

/* --- LÓGICA --- */

logica_for
    : FOR EACH '(' VARIABLE ':' VARIABLE ')' '{' elementos '}'
    | FOR '(' lista_vars_for ')' TRACK VARIABLE '{' elementos '}' empty_opt
    ;

lista_vars_for
    : lista_vars_for ',' VARIABLE ':' VARIABLE
    | VARIABLE ':' VARIABLE
    ;

empty_opt
    : EMPTY '{' elementos '}'
    | /* vacío */
    ;

logica_if
    : IF '(' expresion ')' '{' elementos '}' encadenamiento_else
    ;

encadenamiento_else
    : ELSE '(' expresion ')' '{' elementos '}' encadenamiento_else
    | ELSE '{' elementos '}'
    | /* vacío */
    ;

logica_switch
    : SWITCH '(' expresion_switch ')' '{' lista_cases default_opt '}'
    ;

expresion_switch
    : VARIABLE 
    | VARIABLE '[' NUMERO ']'  /* Para soportar $arrayVar[0] */
    ;

lista_cases
    : lista_cases CASE CADENA '{' elementos '}' ','
    | CASE CADENA '{' elementos '}' ','
    | CASE CADENA '{' elementos '}'
    ;

default_opt
    : DEFAULT '{' elementos '}'
    | /* vacío */
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
    | '(' expresion ')'
    | valor
    ;
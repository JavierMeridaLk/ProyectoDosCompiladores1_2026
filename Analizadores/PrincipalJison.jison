/* Analizador lexico y sintactico del lenguaje principal */
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

/* Símbolos Relacionales y Lógicos */
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
\`([^\`\\]|\\.)*\`          return 'QUERY_SQL'; 
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
      { $$ = { imports: $1, globales: $2, funciones: $3, main: $6 }; }
    ;

/* --- IMPORTS --- */
lista_imports
    : lista_imports IMPORT CADENA ';' { $1.push({ path: $3 }); $$ = $1; }
    | /* vacío */                     { $$ = []; }
    ;

/* --- VARIABLES GLOBALES --- */
lista_declaraciones
    : lista_declaraciones declaracion { $1.push($2); $$ = $1; }
    | /* vacío */                     { $$ = []; }
    ;

declaracion
    : tipo IDENTIFICADOR '=' expresion ';'
      { $$ = { tipo: 'DECLARACION', id: $2, exp: $4 }; }
    /* Declaración sin inicializar */
    | tipo IDENTIFICADOR ';'
      { $$ = { tipo: 'DECLARACION', id: $2, exp: null }; }
    /* Arreglo vacío con tamaño*/
    | tipo '[' ']' IDENTIFICADOR '=' '[' expresion ']' ';'
      { $$ = { tipo: 'DECLARACION_ARR_VACIO', id: $4, size: $7 }; }
    /* Arreglo inicializado */
    | tipo '[' ']' IDENTIFICADOR '=' '{' lista_expresiones '}' ';'
      { $$ = { tipo: 'DECLARACION_ARR_VALORES', id: $4, vals: $7 }; }
    /* Arreglo por DB; */
    | tipo '[' ']' IDENTIFICADOR '=' EXECUTE QUERY_SQL ';'
      { $$ = { tipo: 'DECLARACION_ARR_DB', id: $4, query: $7.replace(/^\`|\`$/g, '') }; }
    ;

tipo
    : TYPE_INT | TYPE_FLOAT | TYPE_STRING | TYPE_BOOLEAN | TYPE_CHAR
    ;

/* --- FUNCIONES --- */
lista_funciones
    : lista_funciones funcion { $1.push($2); $$ = $1; }
    | /* vacío */             { $$ = []; }
    ;

funcion
    : FUNCTION IDENTIFICADOR '(' parametros_opt ')' '{' instrucciones_funcion '}'
      { $$ = { id: $2, params: $4, body: $7 }; }
    ;

parametros_opt
    : lista_parametros { $$ = $1; }
    | /* vacío */      { $$ = []; }
    ;

lista_parametros
    : lista_parametros ',' tipo IDENTIFICADOR { $1.push({ tipo: $3, id: $4 }); $$ = $1; }
    | tipo IDENTIFICADOR                      { $$ = [{ tipo: $1, id: $2 }]; }
    ;

instrucciones_funcion
    : instrucciones_funcion instruccion_funcion { $1.push($2); $$ = $1; }
    | /* vacío */                               { $$ = []; }
    ;

instruccion_funcion
    : EXECUTE QUERY_SQL ';' { $$ = { tipo: 'EXECUTE', query: $2.replace(/^\`|\`$/g, '') }; }
    | LOAD expresion ';'    { $$ = { tipo: 'LOAD', path: $2 }; }
    ;

/* --- BLOQUE MAIN Y LÓGICA --- */
instrucciones_main
    : instrucciones_main instruccion_main { $1.push($2); $$ = $1; }
    | /* vacío */                         { $$ = []; }
    ;

instruccion_main
    : declaracion            { $$ = $1; }
    | invocacion_componente  { $$ = $1; }
    | asignacion             { $$ = $1; }
    | logica_if              { $$ = $1; }
    | logica_switch          { $$ = $1; }
    | logica_while           { $$ = $1; }
    | logica_do_while        { $$ = $1; }
    | logica_for             { $$ = $1; }
    | BREAK ';'              { $$ = { tipo: 'BREAK' }; }
    | CONTINUE ';'           { $$ = { tipo: 'CONTINUE' }; }
    ;

invocacion_componente
    : '@' IDENTIFICADOR '(' lista_expresiones_opt ')' ';'
      { $$ = { tipo: 'COMP_CALL', id: $2, args: $4 }; }
    ;

asignacion
    : IDENTIFICADOR '=' expresion ';'
      { $$ = { tipo: 'ASIGNACION', id: $1, exp: $3 }; }
    | IDENTIFICADOR '[' expresion ']' '=' expresion ';' 
      { $$ = { tipo: 'ASIGNACION_ARR', id: $1, index: $3, exp: $6 }; }
    ;

/* --- ESTRUCTURAS DE CONTROL --- */
logica_if
    : IF '(' expresion ')' '{' instrucciones_main '}' lista_elseif else_opt
      { $$ = { tipo: 'IF', cond: $3, body: $6, elseifs: $8, elseBody: $9 }; }
    ;

lista_elseif
    : lista_elseif ELSE IF '(' expresion ')' '{' instrucciones_main '}'
      { $1.push({ cond: $5, body: $8 }); $$ = $1; }
    | /* vacío */
      { $$ = []; }
    ;

else_opt
    : ELSE '{' instrucciones_main '}' { $$ = $3; }
    | /* vacío */                     { $$ = null; }
    ;

logica_switch
    : SWITCH '(' expresion ')' '{' lista_cases default_opt '}'
      { $$ = { tipo: 'SWITCH', exp: $3, cases: $6, def: $7 }; }
    ;

lista_cases
    : lista_cases CASE expresion ':' instrucciones_main { $1.push({ val: $3, body: $5 }); $$ = $1; }
    | CASE expresion ':' instrucciones_main             { $$ = [{ val: $2, body: $4 }]; }
    ;

default_opt
    : DEFAULT ':' instrucciones_main { $$ = $3; }
    | /* vacío */                    { $$ = null; }
    ;

logica_while
    : WHILE '(' expresion ')' '{' instrucciones_main '}'
      { $$ = { tipo: 'WHILE', cond: $3, body: $6 }; }
    ;

logica_do_while
    : DO '{' instrucciones_main '}' WHILE '(' expresion ')' ';'
      { $$ = { tipo: 'DO_WHILE', cond: $7, body: $3 }; }
    ;

logica_for
    : FOR '(' asignacion_for ';' expresion ';' asignacion_for ')' '{' instrucciones_main '}'
      { $$ = { tipo: 'FOR', init: $3, cond: $5, inc: $7, body: $10 }; }
    ;

asignacion_for
    : tipo IDENTIFICADOR '=' expresion { $$ = { tipo: 'DECLARACION', id: $2, exp: $4 }; }
    | IDENTIFICADOR '=' expresion      { $$ = { tipo: 'ASIGNACION', id: $1, exp: $3 }; }
    | /* vacío */                      { $$ = null; }
    ;

/* --- EXPRESIONES --- */
lista_expresiones_opt
    : lista_expresiones { $$ = $1; }
    | /* vacío */       { $$ = []; }
    ;

lista_expresiones
    : lista_expresiones ',' expresion { $1.push($3); $$ = $1; }
    | expresion                       { $$ = [$1]; }
    ;

expresion
    : expresion '+' expresion  { $$ = { tipo: 'BINARIA', op: '+', izq: $1, der: $3 }; }
    | expresion '-' expresion  { $$ = { tipo: 'BINARIA', op: '-', izq: $1, der: $3 }; }
    | expresion '*' expresion  { $$ = { tipo: 'BINARIA', op: '*', izq: $1, der: $3 }; }
    | expresion '/' expresion  { $$ = { tipo: 'BINARIA', op: '/', izq: $1, der: $3 }; }
    | expresion '%' expresion  { $$ = { tipo: 'BINARIA', op: '%', izq: $1, der: $3 }; }
    | expresion '==' expresion { $$ = { tipo: 'BINARIA', op: '===', izq: $1, der: $3 }; } 
    | expresion '!=' expresion { $$ = { tipo: 'BINARIA', op: '!==', izq: $1, der: $3 }; }
    | expresion '<' expresion  { $$ = { tipo: 'BINARIA', op: '<', izq: $1, der: $3 }; }
    | expresion '<=' expresion { $$ = { tipo: 'BINARIA', op: '<=', izq: $1, der: $3 }; }
    | expresion '>' expresion  { $$ = { tipo: 'BINARIA', op: '>', izq: $1, der: $3 }; }
    | expresion '>=' expresion { $$ = { tipo: 'BINARIA', op: '>=', izq: $1, der: $3 }; }
    | expresion '&&' expresion { $$ = { tipo: 'BINARIA', op: '&&', izq: $1, der: $3 }; }
    | expresion '||' expresion { $$ = { tipo: 'BINARIA', op: '||', izq: $1, der: $3 }; }
    | '!' expresion            { $$ = { tipo: 'UNARIA', op: '!', der: $2 }; }
    | '-' expresion %prec UMINUS { $$ = { tipo: 'UNARIA', op: '-', der: $2 }; }
    | '(' expresion ')'        { $$ = $2; }
    | IDENTIFICADOR            { $$ = { tipo: 'ID', val: $1 }; }
    | IDENTIFICADOR '[' expresion ']' { $$ = { tipo: 'ARREGLO_ACCESO', id: $1, index: $3 }; }
    | NUM_INT                  { $$ = { tipo: 'NUM', val: $1 }; }
    | NUM_FLOAT                { $$ = { tipo: 'NUM', val: $1 }; }
    | CADENA                   { $$ = { tipo: 'CADENA', val: $1.replace(/^"|"$/g, '') }; }
    | CARACTER                 { $$ = { tipo: 'CHAR', val: $1.replace(/^'|'$/g, '') }; }
    | TRUE                     { $$ = { tipo: 'BOOL', val: 'True' }; }
    | FALSE                    { $$ = { tipo: 'BOOL', val: 'False' }; }
    ;
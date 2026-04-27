/* Analizador lexico y sintactico de lenguaje de componentes */

%{
    // Aquí puedes incluir contadores de nodos o logs de depuración
%}

/* Analizador lexico*/
%lex
%options case-sensitive

%%

\s+                         /* ignorar espacios */
\/\*[\s\S]*?\*\/            /* ignorar comentarios multilínea */
\/\/.* /* NUEVO: ignorar comentarios de una línea */

/* Tipos de Datos */
"int"                       return 'INT';
"string"                    return 'STRING';
"function"                  return 'FUNCTION';
"bool"                      return 'BOOL';
"boolean"                   return 'BOOL';   /* Soporte para boolean */
"array"                     return 'ARRAY';  /* Soporte para array */

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
"switch"                    return 'SWITCH'; /* Estándar en minúscula */
"Switch"                    return 'SWITCH';
"case"                      return 'CASE';
"default"                   return 'DEFAULT';

/* Símbolos Compuestos */
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
"@"[a-zA-Z0-9_]+            return 'REF_ID';
[0-9]+(?:\.[0-9]+)?\b       return 'NUMERO';
[a-zA-Z_][a-zA-Z0-9_-]* return 'IDENTIFICADOR';

<<EOF>>                     return 'EOF';
.                           { throw new Error('Error léxico en línea ' + yylloc.first_line + ': ' + yytext); }

/lex

/* Precedencia y Asociatividad */
%left '||'
%left '&&'
%left '==' '!='
%left '<' '<=' '>' '>='
%left '+' '-'
%left '*' '/' '%'
%right '!'
%right UMINUS
/* Resolución del Dangling Else: IF tiene menor precedencia que ELSE */
%nonassoc IF_SIN_ELSE
%nonassoc ELSE

%start inicio

%%

inicio
    : lista_componentes EOF { return $1; }
    ;

lista_componentes
    : lista_componentes componente { $1.push($2); $$ = $1; }
    | componente                   { $$ = [$1]; }
    ;

componente
    : IDENTIFICADOR '(' parametros_opt ')' '{' elementos '}'
        { $$ = {tipo: 'COMPONENTE_DEF', id: $1, params: $3, body: $6}; }
    ;

parametros_opt
    : lista_parametros { $$ = $1; }
    | /* vacío */      { $$ = []; }
    ;

lista_parametros
    : lista_parametros ',' parametro { $1.push($3); $$ = $1; }
    | parametro { $$ = [$1]; }
    ;

parametro
    : tipo IDENTIFICADOR { $$ = {tipo: $1, id: $2}; }
    | tipo VARIABLE      { $$ = {tipo: $1, id: $2}; }
    ;

/* NUEVO: Se añade ARRAY a los tipos permitidos */
tipo : INT | STRING | FUNCTION | BOOL | ARRAY ;

/* --- MANEJO DE ELEMENTOS --- */

elementos
    : elementos_no_vacio { $$ = $1; }
    | /* vacío */        { $$ = []; }
    ;

elementos_no_vacio
    : elementos_no_vacio elemento { $1.push($2); $$ = $1; }
    | elemento                    { $$ = [$1]; }
    ;

elemento
    : seccion
    | tabla
    | texto
    | imagen
    | formulario
    | input_form
    | logica_for
    | logica_if
    | logica_switch
    ;

estilos_opt
    : '<' lista_ids '>' { $$ = $2; }
    ;

lista_ids
    : lista_ids ',' IDENTIFICADOR { $1.push($3); $$ = $1; }
    | IDENTIFICADOR               { $$ = [$1]; }
    ;

/* --- ESTRUCTURAS DE VISUALIZACIÓN --- */

seccion
    : estilos_opt '[' elementos ']' { $$ = {tipo: 'SECTION', estilos: $1, contenido: $3}; }
    | '[' elementos ']'             { $$ = {tipo: 'SECTION', estilos: [], contenido: $2}; }
    ;

tabla
    : estilos_opt '[[' lista_filas ']]'   { $$ = {tipo: 'TABLA', estilos: $1, filas: $3}; }
    | '[[' lista_filas ']]'               { $$ = {tipo: 'TABLA', estilos: [], filas: $2}; }
    ;

lista_filas
    : lista_filas fila { $1.push($2); $$ = $1; }
    | fila             { $$ = [$1]; }
    ;

fila
    : '[[' lista_columnas ']]' { $$ = $2; }
    ;

lista_columnas
    : lista_columnas columna { $1.push($2); $$ = $1; }
    | columna                { $$ = [$1]; }
    ;

columna
    : '[[' elementos ']]' { $$ = {tipo: 'CELDA', contenido: $2}; }
    ;

texto
    : T estilos_opt '(' CADENA ')'  { $$ = {tipo: 'TEXTO', estilos: $2, val: $4}; }
    | T '(' CADENA ')'              { $$ = {tipo: 'TEXTO', estilos: [], val: $3}; }
    ;

imagen
    : IMG estilos_opt '(' lista_valores ')' { $$ = {tipo: 'IMG', estilos: $2, vals: $4}; }
    | IMG '(' lista_valores ')'             { $$ = {tipo: 'IMG', estilos: [], vals: $3}; }
    ;

lista_valores
    : lista_valores ',' valor { $1.push($3); $$ = $1; }
    | valor                   { $$ = [$1]; }
    ;

/* --- FORMULARIOS --- */

formulario
    : FORM estilos_opt '{' elementos '}' submit_opt
        { $$ = {tipo: 'FORM', estilos: $2, body: $4, submit: $6}; }
    | FORM '{' elementos '}' submit_opt
        { $$ = {tipo: 'FORM', estilos: [], body: $3, submit: $5}; }
    ;

submit_opt
    : SUBMIT estilos_opt '{' PR_LABEL ':' valor propiedades_submit_extra '}'
        { $$ = {tipo: 'SUBMIT', estilos: $2, label: $6, extra: $7}; }
    | SUBMIT '{' PR_LABEL ':' valor propiedades_submit_extra '}'
        { $$ = {tipo: 'SUBMIT', estilos: [], label: $5, extra: $6}; }
    | /* vacío */ { $$ = null; }
    ;

propiedades_submit_extra
    : /* vacío */ { $$ = []; }
    | ',' FUNCTION ':' VARIABLE '(' lista_ref_id ')' { $$ = {func: $4, refs: $6}; }
    | FUNCTION ':' VARIABLE '(' lista_ref_id ')'      { $$ = {func: $3, refs: $5}; }
    ;

lista_ref_id
    : lista_ref_id ',' REF_ID { $1.push($3); $$ = $1; }
    | REF_ID                  { $$ = [$1]; }
    ;

input_form
    : INPUT_TEXT estilos_opt '(' props_input ')'   { $$ = {tipo: 'INPUT_TEXT', estilos: $2, props: $4}; }
    | INPUT_TEXT '(' props_input ')'               { $$ = {tipo: 'INPUT_TEXT', estilos: [], props: $3}; }
    | INPUT_NUMBER estilos_opt '(' props_input ')' { $$ = {tipo: 'INPUT_NUMBER', estilos: $2, props: $4}; }
    | INPUT_NUMBER '(' props_input ')'             { $$ = {tipo: 'INPUT_NUMBER', estilos: [], props: $3}; }
    | INPUT_BOOL estilos_opt '(' props_input ')'   { $$ = {tipo: 'INPUT_BOOL', estilos: $2, props: $4}; }
    | INPUT_BOOL '(' props_input ')'               { $$ = {tipo: 'INPUT_BOOL', estilos: [], props: $3}; }
    ;

props_input
    : prop_input ',' prop_input ',' prop_input { $$ = [$1, $3, $5]; }
    | prop_input ',' prop_input { $$ = [$1, $3]; }
    | prop_input { $$ = [$1]; }
    ;

prop_input
    : PR_ID ':' valor    { $$ = {id: $3}; }
    | PR_LABEL ':' valor { $$ = {label: $3}; }
    | PR_VALUE ':' valor { $$ = {value: $3}; }
    ;

valor
    : CADENA   { $$ = { tipo: 'STRING', val: yytext.slice(1,-1) }; }
    | VARIABLE { $$ = { tipo: 'VAR', val: yytext }; }
    | NUMERO   { $$ = { tipo: 'NUM', val: Number(yytext) }; }
    | TRUE     { $$ = { tipo: 'BOOL', val: true }; }
    | FALSE    { $$ = { tipo: 'BOOL', val: false }; }
    ;

/* --- LÓGICA --- */

logica_for
    : FOR EACH '(' VARIABLE ':' VARIABLE ')' '{' elementos '}'
        { $$ = {tipo: 'FOR_EACH', iterador: $4, coleccion: $6, body: $9}; }
    | FOR '(' lista_vars_for ')' TRACK VARIABLE '{' elementos '}' empty_opt
        { $$ = {tipo: 'FOR_TRACK', vars: $3, track: $6, body: $8, empty: $10}; }
    ;

lista_vars_for
    : lista_vars_for ',' VARIABLE ':' VARIABLE { $1.push({id: $3, col: $5}); $$ = $1; }
    | VARIABLE ':' VARIABLE { $$ = [{id: $1, col: $3}]; }
    ;

empty_opt
    : EMPTY '{' elementos '}' { $$ = $3; }
    | /* vacío */            { $$ = null; }
    ;

logica_if
    : IF '(' expresion ')' '{' elementos '}' %prec IF_SIN_ELSE
        { $$ = {tipo: 'IF', cond: $3, body: $6, sino: null}; }
    | IF '(' expresion ')' '{' elementos '}' cadena_else
        { $$ = {tipo: 'IF', cond: $3, body: $6, sino: $8}; }
    ;

cadena_else
    : ELSE '(' expresion ')' '{' elementos '}' %prec IF_SIN_ELSE
        { $$ = {tipo: 'IF', cond: $3, body: $6, sino: null}; }
    | ELSE '(' expresion ')' '{' elementos '}' cadena_else
        { $$ = {tipo: 'IF', cond: $3, body: $6, sino: $8}; }
    | ELSE '{' elementos '}'
        { $$ = {tipo: 'ELSE', body: $3}; }
    ;

logica_switch
    : SWITCH '(' expresion_switch ')' '{' lista_cases default_opt '}'
        { $$ = {tipo: 'SWITCH', expr: $3, cases: $6, def: $7}; }
    ;

expresion_switch
    : VARIABLE { $$ = $1; }
    | VARIABLE '[' NUMERO ']' { $$ = {id: $1, index: $3}; }
    ;

lista_cases
    : lista_cases caso { $1.push($2); $$ = $1; }
    | caso { $$ = [$1]; }
    ;

/* NUEVO: Reutiliza la regla "valor" para estructurar correctamente el AST */
caso
    : CASE valor '{' elementos '}' ',' { $$ = {val: $2, body: $4}; }
    | CASE valor '{' elementos '}'     { $$ = {val: $2, body: $4}; }
    ;

default_opt
    : DEFAULT '{' elementos '}' { $$ = $3; }
    | /* vacío */              { $$ = null; }
    ;

expresion
    : expresion '+' expresion   { $$ = {op: '+', izq: $1, der: $3}; }
    | expresion '-' expresion   { $$ = {op: '-', izq: $1, der: $3}; }
    | expresion '*' expresion   { $$ = {op: '*', izq: $1, der: $3}; }
    | expresion '/' expresion   { $$ = {op: '/', izq: $1, der: $3}; }
    | expresion '>' expresion   { $$ = {op: '>', izq: $1, der: $3}; }
    | expresion '<' expresion   { $$ = {op: '<', izq: $1, der: $3}; }
    | expresion '>=' expresion  { $$ = {op: '>=', izq: $1, der: $3}; }
    | expresion '<=' expresion  { $$ = {op: '<=', izq: $1, der: $3}; }
    | expresion '==' expresion  { $$ = {op: '==', izq: $1, der: $3}; }
    | expresion '!=' expresion  { $$ = {op: '!=', izq: $1, der: $3}; }
    | expresion '&&' expresion  { $$ = {op: '&&', izq: $1, der: $3}; }
    | expresion '||' expresion  { $$ = {op: '||', izq: $1, der: $3}; }
    | '!' expresion             { $$ = {op: '!', der: $2}; }
    | '(' expresion ')'         { $$ = $2; }
    | valor                     { $$ = $1; }
    ;
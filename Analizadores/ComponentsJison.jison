/* ============================================================
   ComponentesJison.jison  —  Lenguaje de Componentes (.comp)
   ============================================================ */

%lex
%options case-sensitive

%%

\s+                             /* ignorar espacios y saltos de línea */
\/\*[\s\S]*?\*\/               /* ignorar comentarios multilínea */
\/\/.* /* ignorar comentarios de línea */

/* ── Tipos de datos ── */
"int"                           return 'INT';
"float"                         return 'FLOAT';
"string"                        return 'STRING';
"function"                      return 'FUNCTION';
"bool"                          return 'BOOL';
"boolean"                       return 'BOOL';
"array"                         return 'ARRAY';

/* ── Elementos visuales ── */
"T"                             return 'T';
"IMG"                           return 'IMG';
"FORM"                          return 'FORM';
"SUBMIT"                        return 'SUBMIT';
"INPUT_TEXT"                    return 'INPUT_TEXT';
"INPUT_NUMBER"                  return 'INPUT_NUMBER';
"INPUT_BOOL"                    return 'INPUT_BOOL';

/* ── Propiedades reservadas de inputs ── */
"id"                            return 'PR_ID';
"label"                         return 'PR_LABEL';
"value"                         return 'PR_VALUE';

/* ── Literales booleanos ── */
"true"                          return 'TRUE';
"false"                         return 'FALSE';

/* ── Control de flujo ── */
"for"                           return 'FOR';
"each"                          return 'EACH';
"track"                         return 'TRACK';
"empty"                         return 'EMPTY';
"if"                            return 'IF';
"else"                          return 'ELSE';
"Switch"                        return 'SWITCH';
"switch"                        return 'SWITCH';
"case"                          return 'CASE';
"default"                       return 'DEFAULT';

/* ── Operadores compuestos (antes que los simples) ── */
"[["                            return 'TABLA_OPEN';
"]]"                            return 'TABLA_CLOSE';
"=="                            return 'EQ';
"!="                            return 'NEQ';
"<="                            return 'LTE';
">="                            return 'GTE';
"&&"                            return 'AND';
"||"                            return 'OR';

/* ── Símbolos simples ── */
"["                             return '[';
"]"                             return ']';
"<"                             return '<';
">"                             return '>';
"("                             return '(';
")"                             return ')';
"{"                             return '{';
"}"                             return '}';
","                             return ',';
":"                             return ':';
"+"                             return '+';
"-"                             return '-';
"*"                             return '*';
"/"                             return '/';
"%"                             return '%';
"!"                             return '!';

/* ── Literales ── */
\"([^\"\\]|\\.)*\"              return 'CADENA';
\`[^\`]*\`                      return 'CADENA_EXPR';

/* ── Variables y referencias ── */
"$"[a-zA-Z0-9_]+\[\"[^\"]*\"\]  return 'VARIABLE';
"$"[a-zA-Z0-9_]+\[[0-9]+\]      return 'VARIABLE';
"$"[a-zA-Z0-9_]+                return 'VARIABLE';
"@"[a-zA-Z0-9_]+                return 'REF_ID';

/* ── Números ── */
[0-9]+"."[0-9]+                 return 'NUMERO';
[0-9]+                          return 'NUMERO';

/* ── Identificadores (incluye guión para nombres y estilos) ── */
[a-zA-Z_-][a-zA-Z0-9_-]* return 'IDENTIFICADOR';

<<EOF>>                         return 'EOF';

/* ── Error léxico: captura y continúa ── */
.   {
        yy.errores.push({
            tipo: 'Léxico',
            descripcion: `Carácter no reconocido: "${yytext}"`,
            linea: yylloc.first_line,
            columna: yylloc.first_column + 1
        });
    }

/lex

/* ── Precedencias (de menor a mayor) ── */
%left 'OR'
%left 'AND'
%left 'EQ' 'NEQ'
%left '<' 'LTE' '>' 'GTE'
%left '+' '-'
%left '*' '/' '%'
%right '!'
%right UMINUS
%nonassoc IF_SIN_ELSE
%nonassoc ELSE

%start inicio

%%

/* ══════════════════════════════════════════════════════════
   PUNTO DE ENTRADA
   ══════════════════════════════════════════════════════════ */

inicio
    : lista_componentes EOF
        { return { ast: $1, errores: yy.errores }; }
    ;

lista_componentes
    : lista_componentes componente
        { if ($2) $1.push($2); $$ = $1; }
    | componente
        { $$ = $1 ? [$1] : []; }
    ;

/* ── Definición de componente ── */
componente
    : IDENTIFICADOR '(' parametros_opt ')' '{' elementos '}'
        {
            /* Validar nombre único */
            if (!yy.componentesDefinidos) yy.componentesDefinidos = new Set();
            if (yy.componentesDefinidos.has($1)) {
                yy.errores.push({
                    tipo: 'Semántico',
                    descripcion: `El componente "${$1}" ya está definido`,
                    linea: @1.first_line,
                    columna: @1.first_column + 1
                });
            } else {
                yy.componentesDefinidos.add($1);
            }
            $$ = { tipo: 'COMPONENTE_DEF', id: $1, params: $3, body: $6, linea: @1.first_line };
        }

    | error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Estructura de componente inválida, se descartó el bloque`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

/* ── Parámetros ── */
parametros_opt
    : lista_parametros { $$ = $1; }
    | /* vacío */      { $$ = []; }
    ;

lista_parametros
    : lista_parametros ',' parametro { $1.push($3); $$ = $1; }
    | parametro                      { $$ = [$1]; }
    ;

parametro
    : tipo IDENTIFICADOR { $$ = { tipo: $1, id: $2, linea: @2.first_line }; }
    | tipo VARIABLE      { $$ = { tipo: $1, id: $2, linea: @2.first_line }; }
    ;

/* Tipos soportados */
tipo
    : INT      { $$ = 'int'; }
    | FLOAT    { $$ = 'float'; }
    | STRING   { $$ = 'string'; }
    | FUNCTION { $$ = 'function'; }
    | BOOL     { $$ = 'bool'; }
    | ARRAY    { $$ = 'array'; }
    ;

/* ══════════════════════════════════════════════════════════
   ELEMENTOS
   ══════════════════════════════════════════════════════════ */

elementos
    : elementos_lista { $$ = $1; }
    | /* vacío */     { $$ = []; }
    ;

elementos_lista
    : elementos_lista elemento
        { if ($2 !== null && $2 !== undefined) $1.push($2); $$ = $1; }
    | elemento
        { $$ = ($1 !== null && $1 !== undefined) ? [$1] : []; }
    ;

elemento
    : seccion       { $$ = $1; }
    | tabla         { $$ = $1; }
    | texto         { $$ = $1; }
    | imagen        { $$ = $1; }
    | formulario    { $$ = $1; }
    | input_form    { $$ = $1; }
    | logica_for    { $$ = $1; }
    | logica_if     { $$ = $1; }
    | logica_switch { $$ = $1; }
    | llamada_comp  { $$ = $1; }
    | error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Elemento inválido dentro del componente en línea ${@1.first_line}`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

/* ── Llamada a otros componentes (ej: BadgeTipo($tipo)) ── */
llamada_comp
    : IDENTIFICADOR '(' lista_args_opt ')'
        { $$ = { tipo: 'LLAMADA_COMPONENTE', id: $1, args: $3, linea: @1.first_line }; }
    ;

lista_args_opt
    : lista_valores { $$ = $1; }
    | /* vacío */   { $$ = []; }
    ;

lista_valores
    : lista_valores ',' valor { $1.push($3); $$ = $1; }
    | valor                   { $$ = [$1]; }
    ;

/* ── Lista de ids de estilos (siempre con '<' '>') ── */
lista_ids
    : lista_ids ',' IDENTIFICADOR { $1.push($3); $$ = $1; }
    | IDENTIFICADOR               { $$ = [$1]; }
    ;

/* ── Sección [ ] ── */
seccion
    : '<' lista_ids '>' '[' elementos ']'
        { $$ = { tipo: 'SECTION', estilos: $2, contenido: $5, linea: @4.first_line }; }
    | '[' elementos ']'
        { $$ = { tipo: 'SECTION', estilos: [], contenido: $2, linea: @1.first_line }; }
    ;

/* ── Tabla [[ ]] ── */
tabla
    : '<' lista_ids '>' TABLA_OPEN lista_filas TABLA_CLOSE
        { $$ = { tipo: 'TABLA', estilos: $2, filas: $5, linea: @4.first_line }; }
    | '<' lista_ids '>' TABLA_OPEN TABLA_CLOSE
        { $$ = { tipo: 'TABLA', estilos: $2, filas: [], linea: @4.first_line }; }
    | TABLA_OPEN lista_filas TABLA_CLOSE
        { $$ = { tipo: 'TABLA', estilos: [], filas: $2, linea: @1.first_line }; }
    | TABLA_OPEN TABLA_CLOSE
        { $$ = { tipo: 'TABLA', estilos: [], filas: [], linea: @1.first_line }; }
    ;

lista_filas
    : lista_filas fila { $1.push($2); $$ = $1; }
    | fila             { $$ = [$1]; }
    ;

fila
    : TABLA_OPEN lista_columnas TABLA_CLOSE { $$ = $2; }
    ;

lista_columnas
    : lista_columnas columna { $1.push($2); $$ = $1; }
    | columna                { $$ = [$1]; }
    ;

columna
    : TABLA_OPEN elementos TABLA_CLOSE
        { $$ = { tipo: 'CELDA', contenido: $2 }; }
    ;

/* ── Texto T("...") ── */
texto
    : T '<' lista_ids '>' '(' CADENA ')'
        { $$ = { tipo: 'TEXTO', estilos: $3, val: $6, linea: @1.first_line }; }
    | T '<' lista_ids '>' '(' CADENA_EXPR ')'
        { $$ = { tipo: 'TEXTO', estilos: $3, val: $6, esExpr: true, linea: @1.first_line }; }
    | T '(' CADENA ')'
        { $$ = { tipo: 'TEXTO', estilos: [], val: $3, linea: @1.first_line }; }
    | T '(' CADENA_EXPR ')'
        { $$ = { tipo: 'TEXTO', estilos: [], val: $3, esExpr: true, linea: @1.first_line }; }
    ;

/* ── Imagen IMG<estilos>("url", ...) ── */
imagen
    : IMG '<' lista_ids '>' '(' lista_urls ')'
        { $$ = { tipo: 'IMG', estilos: $3, urls: $6, linea: @1.first_line }; }
    | IMG '(' lista_urls ')'
        { $$ = { tipo: 'IMG', estilos: [], urls: $3, linea: @1.first_line }; }
    ;

lista_urls
    : lista_urls ',' url_valor { $1.push($3); $$ = $1; }
    | url_valor                { $$ = [$1]; }
    ;

/* URL puede ser cadena literal o variable */
url_valor
    : CADENA   { $$ = { tipo: 'STRING', val: $1 }; }
    | VARIABLE { $$ = { tipo: 'VAR',    val: $1 }; }
    ;

/* ══════════════════════════════════════════════════════════
   FORMULARIOS
   ══════════════════════════════════════════════════════════ */

formulario
    : FORM '<' lista_ids '>' '{' elementos '}' submit_opt
        { $$ = { tipo: 'FORM', estilos: $3, body: $6, submit: $8, linea: @1.first_line }; }
    | FORM '{' elementos '}' submit_opt
        { $$ = { tipo: 'FORM', estilos: [], body: $3, submit: $5, linea: @1.first_line }; }
    ;

submit_opt
    : SUBMIT '<' lista_ids '>' '{' props_submit '}'
        { $$ = { tipo: 'SUBMIT', estilos: $3, props: $6, linea: @1.first_line }; }
    | SUBMIT '{' props_submit '}'
        { $$ = { tipo: 'SUBMIT', estilos: [], props: $3, linea: @1.first_line }; }
    | /* vacío */ { $$ = null; }
    ;

/* Props del SUBMIT: label y function */
props_submit
    : props_submit prop_submit { $1.push($2); $$ = $1; }
    | prop_submit              { $$ = [$1]; }
    ;

prop_submit
    : PR_LABEL ':' valor
        { $$ = { clave: 'label', valor: $3 }; }
    | FUNCTION ':' VARIABLE '(' lista_ref_id_opt ')'
        { $$ = { clave: 'function', func: $3, refs: $5 }; }
    ;

lista_ref_id_opt
    : lista_ref_id { $$ = $1; }
    | /* vacío */  { $$ = []; }
    ;

lista_ref_id
    : lista_ref_id ',' REF_ID { $1.push($3); $$ = $1; }
    | REF_ID                  { $$ = [$1]; }
    ;

/* ── Inputs: con y sin estilos, con '(' ')' y '{' '}' ── */
input_form
    : INPUT_TEXT '<' lista_ids '>' '(' props_input ')'
        { $$ = { tipo: 'INPUT_TEXT',   estilos: $3, props: $6, linea: @1.first_line }; }
    | INPUT_TEXT '<' lista_ids '>' '{' props_input '}'
        { $$ = { tipo: 'INPUT_TEXT',   estilos: $3, props: $6, linea: @1.first_line }; }
    | INPUT_TEXT '(' props_input ')'
        { $$ = { tipo: 'INPUT_TEXT',   estilos: [], props: $3, linea: @1.first_line }; }
    | INPUT_TEXT '{' props_input '}'
        { $$ = { tipo: 'INPUT_TEXT',   estilos: [], props: $3, linea: @1.first_line }; }
    | INPUT_NUMBER '<' lista_ids '>' '(' props_input ')'
        { $$ = { tipo: 'INPUT_NUMBER', estilos: $3, props: $6, linea: @1.first_line }; }
    | INPUT_NUMBER '<' lista_ids '>' '{' props_input '}'
        { $$ = { tipo: 'INPUT_NUMBER', estilos: $3, props: $6, linea: @1.first_line }; }
    | INPUT_NUMBER '(' props_input ')'
        { $$ = { tipo: 'INPUT_NUMBER', estilos: [], props: $3, linea: @1.first_line }; }
    | INPUT_NUMBER '{' props_input '}'
        { $$ = { tipo: 'INPUT_NUMBER', estilos: [], props: $3, linea: @1.first_line }; }
    | INPUT_BOOL '<' lista_ids '>' '(' props_input ')'
        { $$ = { tipo: 'INPUT_BOOL',   estilos: $3, props: $6, linea: @1.first_line }; }
    | INPUT_BOOL '<' lista_ids '>' '{' props_input '}'
        { $$ = { tipo: 'INPUT_BOOL',   estilos: $3, props: $6, linea: @1.first_line }; }
    | INPUT_BOOL '(' props_input ')'
        { $$ = { tipo: 'INPUT_BOOL',   estilos: [], props: $3, linea: @1.first_line }; }
    | INPUT_BOOL '{' props_input '}'
        { $$ = { tipo: 'INPUT_BOOL',   estilos: [], props: $3, linea: @1.first_line }; }
    ;

props_input
    : props_input ',' prop_input { $1.push($3); $$ = $1; }
    | prop_input                 { $$ = [$1]; }
    ;

prop_input
    : PR_ID    ':' valor { $$ = { clave: 'id',    valor: $3 }; }
    | PR_LABEL ':' valor { $$ = { clave: 'label', valor: $3 }; }
    | PR_VALUE ':' valor { $$ = { clave: 'value', valor: $3 }; }
    ;

/* ══════════════════════════════════════════════════════════
   VALORES Y EXPRESIONES
   ══════════════════════════════════════════════════════════ */

valor
    : CADENA      { $$ = { tipo: 'STRING', val: $1,          linea: @1.first_line }; }
    | CADENA_EXPR { $$ = { tipo: 'EXPR',   val: $1,          linea: @1.first_line }; }
    | VARIABLE    { $$ = { tipo: 'VAR',    val: $1,          linea: @1.first_line }; }
    | NUMERO      { $$ = { tipo: 'NUM',    val: Number($1),  linea: @1.first_line }; }
    | TRUE        { $$ = { tipo: 'BOOL',   val: true,        linea: @1.first_line }; }
    | FALSE       { $$ = { tipo: 'BOOL',   val: false,       linea: @1.first_line }; }
    ;

/* Expresiones para condiciones (if, switch) */
expresion
    : expresion '+' expresion   { $$ = { op: '+',   izq: $1, der: $3 }; }
    | expresion '-' expresion   { $$ = { op: '-',   izq: $1, der: $3 }; }
    | expresion '*' expresion   { $$ = { op: '*',   izq: $1, der: $3 }; }
    | expresion '/' expresion   { $$ = { op: '/',   izq: $1, der: $3 }; }
    | expresion '%' expresion   { $$ = { op: '%',   izq: $1, der: $3 }; }
    | expresion '>' expresion   { $$ = { op: '>',   izq: $1, der: $3 }; }
    | expresion '<' expresion   { $$ = { op: '<',   izq: $1, der: $3 }; }
    | expresion GTE expresion   { $$ = { op: '>=',  izq: $1, der: $3 }; }
    | expresion LTE expresion   { $$ = { op: '<=',  izq: $1, der: $3 }; }
    | expresion EQ  expresion   { $$ = { op: '==',  izq: $1, der: $3 }; }
    | expresion NEQ expresion   { $$ = { op: '!=',  izq: $1, der: $3 }; }
    | expresion AND expresion   { $$ = { op: '&&',  izq: $1, der: $3 }; }
    | expresion OR  expresion   { $$ = { op: '||',  izq: $1, der: $3 }; }
    | '!' expresion             { $$ = { op: '!',   der: $2 }; }
    | '-' expresion %prec UMINUS{ $$ = { op: 'neg', der: $2 }; }
    | '(' expresion ')'         { $$ = $2; }
    | valor                     { $$ = $1; }
    ;

/* ══════════════════════════════════════════════════════════
   LÓGICA DE CONTROL
   ══════════════════════════════════════════════════════════ */

/* ── For ── */
logica_for
    /* for each simple */
    : FOR EACH '(' VARIABLE ':' VARIABLE ')' '{' elementos '}'
        {
            $$ = {
                tipo: 'FOR_EACH',
                iterador: $4,
                coleccion: $6,
                body: $9,
                linea: @1.first_line
            };
        }
    /* for complejo con track y empty opcional */
    | FOR '(' lista_vars_for ')' TRACK VARIABLE '{' elementos '}' empty_opt
        {
            $$ = {
                tipo: 'FOR_TRACK',
                vars: $3,
                trackVar: $6,
                body: $8,
                empty: $10,
                linea: @1.first_line
            };
        }

    | FOR error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Estructura de ciclo for inválida`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

lista_vars_for
    : lista_vars_for ',' VARIABLE ':' VARIABLE
        { $1.push({ iterador: $3, coleccion: $5 }); $$ = $1; }
    | VARIABLE ':' VARIABLE
        { $$ = [{ iterador: $1, coleccion: $3 }]; }
    ;

empty_opt
    : EMPTY '{' elementos '}' { $$ = $3; }
    | /* vacío */             { $$ = null; }
    ;

/* ── If / else if / else ── */
logica_if
    : IF '(' expresion ')' '{' elementos '}' %prec IF_SIN_ELSE
        { $$ = { tipo: 'IF', cond: $3, body: $6, sino: null, linea: @1.first_line }; }
    | IF '(' expresion ')' '{' elementos '}' cadena_else
        { $$ = { tipo: 'IF', cond: $3, body: $6, sino: $8,   linea: @1.first_line }; }
    /* Recuperación */
    | IF error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Estructura de if inválida`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

cadena_else
    /* Soporte para else if anidados */
    : ELSE IF '(' expresion ')' '{' elementos '}' cadena_else
        { $$ = { tipo: 'ELSE_IF', cond: $4, body: $7, sino: $9, linea: @1.first_line }; }
    
    /* Soporte para else if final (sin else) */
    | ELSE IF '(' expresion ')' '{' elementos '}' %prec IF_SIN_ELSE
        { $$ = { tipo: 'ELSE_IF', cond: $4, body: $7, sino: null, linea: @1.first_line }; }
    
    /* Soporte para el else por defecto */
    | ELSE '{' elementos '}'
        { $$ = { tipo: 'ELSE', body: $3, linea: @1.first_line }; }
    ;

/* ── Switch ── */
logica_switch
    : SWITCH '(' expresion ')' '{' lista_casos default_opt '}'
        { $$ = { tipo: 'SWITCH', cond: $3, casos: $6, def: $7, linea: @1.first_line }; }
    | SWITCH error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Estructura de switch inválida`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

lista_casos
    : lista_casos ',' caso { $1.push($3); $$ = $1; }
    | lista_casos caso     { $1.push($2); $$ = $1; } /* Soporta casos sin coma separadora si se olvida */
    | caso                 { $$ = [$1]; }
    ;

caso
    : CASE valor '{' elementos '}'
        { $$ = { tipo: 'CASE', valor: $2, body: $4, linea: @1.first_line }; }
    ;

default_opt
    : ',' DEFAULT '{' elementos '}'
        { $$ = { tipo: 'DEFAULT', body: $4, linea: @2.first_line }; }
    | DEFAULT '{' elementos '}'
        { $$ = { tipo: 'DEFAULT', body: $3, linea: @1.first_line }; }
    | /* vacío */
        { $$ = null; }
    ;
/* ============================================================
   PrincipalJison.jison  —  Lenguaje Principal (.y)
   ============================================================ */

%lex
%options case-sensitive

%%

/* ── Espacios y comentarios ── */
\s+                                     /* ignorar espacios y saltos */
"/*"[\s\S]*?"*/"                        /* ignorar comentarios multilínea */
"#".*                                   /* ignorar comentarios de línea con # */

/* ── Palabras reservadas ── */
"import"                                return 'IMPORT';
"execute"                               return 'EXECUTE';
"load"                                  return 'LOAD';
"function"                              return 'FUNCTION';
"main"                                  return 'MAIN';

/* ── Tipos de datos ── */
"int"                                   return 'TYPE_INT';
"float"                                 return 'TYPE_FLOAT';
"string"                                return 'TYPE_STRING';
"boolean"                               return 'TYPE_BOOLEAN';
"char"                                  return 'TYPE_CHAR';

/* ── Booleanos ── */
"True"                                  return 'TRUE';
"False"                                 return 'FALSE';

/* ── Estructuras de control ── */
"if"                                    return 'IF';
"else"                                  return 'ELSE';
"switch"                                return 'SWITCH';
"case"                                  return 'CASE';
"default"                               return 'DEFAULT';
"while"                                 return 'WHILE';
"do"                                    return 'DO';
"for"                                   return 'FOR';
"break"                                 return 'BREAK';
"continue"                              return 'CONTINUE';

/* ── Operadores compuestos (antes que simples) ── */
"=="                                    return 'EQ';
"!="                                    return 'NEQ';
"<="                                    return 'LTE';
">="                                    return 'GTE';
"&&"                                    return 'AND';
"||"                                    return 'OR';
"@"[a-zA-Z_][a-zA-Z0-9_]*              return 'COMP_REF';

/* ── Símbolos simples ── */
";"                                     return ';';
","                                     return ',';
":"                                     return ':';
"="                                     return '=';
"{"                                     return '{';
"}"                                     return '}';
"["                                     return '[';
"]"                                     return ']';
"("                                     return '(';
")"                                     return ')';
"+"                                     return '+';
"-"                                     return '-';
"*"                                     return '*';
"/"                                     return '/';
"%"                                     return '%';
"!"                                     return '!';
"<"                                     return '<';
">"                                     return '>';

/* ── Literales ── */
\"([^\"\\]|\\.)*\"                      return 'CADENA';
\'([^\'\\]|\\.)*\'                      return 'CARACTER';
\`([^\`\\]|\\.)*\`                      return 'QUERY_SQL';
[0-9]+"."[0-9]+                         return 'NUM_FLOAT';
[0-9]+                                  return 'NUM_INT';

/* ── Identificadores ── */
[a-zA-Z_][a-zA-Z0-9_]*                 return 'IDENTIFICADOR';

<<EOF>>                                 return 'EOF';

/* ── Error léxico: acumula y continúa ── */
.   {
        yy.errores.push({
            tipo: 'Léxico',
            descripcion: `Carácter no reconocido: "${yytext}"`,
            linea: yylloc.first_line,
            columna: yylloc.first_column + 1
        });
    }

/lex

/* ── Precedencias ── */
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
    : programa EOF
        { return { ast: $1, errores: yy.errores }; }
    ;

programa
    : lista_imports lista_declaraciones lista_funciones bloque_main
        {
            $$ = {
                imports:   $1,
                globales:  $2,
                funciones: $3,
                main:      $4
            };
        }
    ;

/* ══════════════════════════════════════════════════════════
   IMPORTS
   ══════════════════════════════════════════════════════════ */

lista_imports
    : lista_imports import_stmt
        { if ($2) $1.push($2); $$ = $1; }
    | /* vacío */
        { $$ = []; }
    ;

import_stmt
    : IMPORT CADENA ';'
        { $$ = { tipo: 'IMPORT', path: $2.replace(/^"|"$/g, '').trim(), linea: @1.first_line }; }
    | IMPORT error ';'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Import inválido — se esperaba una cadena con la ruta`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

/* ══════════════════════════════════════════════════════════
   DECLARACIONES DE VARIABLES GLOBALES
   ══════════════════════════════════════════════════════════ */

lista_declaraciones
    : lista_declaraciones declaracion
        { if ($2) $1.push($2); $$ = $1; }
    | lista_declaraciones error ';'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Declaración global inválida descartada`,
                linea: @2.first_line,
                columna: @2.first_column + 1
            });
            $$ = $1;
        }
    | /* vacío */
        { $$ = []; }
    ;

declaracion
    /* Variable simple con valor inicial */
    : tipo IDENTIFICADOR '=' expresion ';'
        { $$ = { tipo: 'DECLARACION', id: $2, exp: $4, tipoDato: $1, linea: @2.first_line }; }

    /* Variable simple sin valor inicial */
    | tipo IDENTIFICADOR ';'
        { $$ = { tipo: 'DECLARACION', id: $2, exp: null, tipoDato: $1, linea: @2.first_line }; }

    /* Arreglo vacío con tamaño: int[] arr = [3]; */
    | tipo '[' ']' IDENTIFICADOR '=' '[' expresion ']' ';'
        { $$ = { tipo: 'DECLARACION_ARR_VACIO', id: $4, size: $7, tipoDato: $1, linea: @4.first_line }; }

    /* Arreglo inicializado: string[] arr = {"a", "b"}; */
    | tipo '[' ']' IDENTIFICADOR '=' '{' lista_expresiones '}' ';'
        { $$ = { tipo: 'DECLARACION_ARR_VALORES', id: $4, vals: $7, tipoDato: $1, linea: @4.first_line }; }

    /* Arreglo desde DB: float[] arr = execute `tabla.col`; */
    | tipo '[' ']' IDENTIFICADOR '=' EXECUTE QUERY_SQL ';'
        { $$ = { tipo: 'DECLARACION_ARR_DB', id: $4, query: $7.replace(/^\`|\`$/g, ''), tipoDato: $1, linea: @4.first_line }; }
    ;

tipo
    : TYPE_INT     { $$ = 'int'; }
    | TYPE_FLOAT   { $$ = 'float'; }
    | TYPE_STRING  { $$ = 'string'; }
    | TYPE_BOOLEAN { $$ = 'boolean'; }
    | TYPE_CHAR    { $$ = 'char'; }
    ;

/* ══════════════════════════════════════════════════════════
   FUNCIONES
   ══════════════════════════════════════════════════════════ */

lista_funciones
    : lista_funciones funcion
        { if ($2) $1.push($2); $$ = $1; }
    | /* vacío */
        { $$ = []; }
    ;

funcion
    : FUNCTION IDENTIFICADOR '(' parametros_opt ')' '{' instrucciones_funcion '}'
        {
            $$ = {
                tipo: 'FUNCION',
                id: $2,
                params: $4,
                body: $7,
                linea: @2.first_line
            };
        }
    /* Recuperación */
    | FUNCTION error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Declaración de función inválida`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

parametros_opt
    : lista_parametros { $$ = $1; }
    | /* vacío */      { $$ = []; }
    ;

lista_parametros
    : lista_parametros ',' tipo IDENTIFICADOR
        { $1.push({ tipo: $3, id: $4, linea: @4.first_line }); $$ = $1; }
    | tipo IDENTIFICADOR
        { $$ = [{ tipo: $1, id: $2, linea: @2.first_line }]; }
    ;

//instrucicones
instrucciones_funcion
    : instrucciones_funcion instruccion_funcion
        { if ($2) $1.push($2); $$ = $1; }
    | /* vacío */
        { $$ = []; }
    ;

instruccion_funcion
    : EXECUTE QUERY_SQL ';'
        { $$ = { tipo: 'EXECUTE', query: $2.replace(/^\`|\`$/g, ''), linea: @1.first_line }; }
    | LOAD expresion ';'
        { $$ = { tipo: 'LOAD', path: $2, linea: @1.first_line }; }
    | FUNCTION error '}'
        {
            yy.errores.push({
                tipo: 'Semántico',
                descripcion: `No se permiten funciones anidadas dentro de una función`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    | error ';'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Instrucción inválida dentro de función`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

/* ══════════════════════════════════════════════════════════
   BLOQUE MAIN
   ══════════════════════════════════════════════════════════ */

bloque_main
    : MAIN '{' instrucciones_main '}'
        { $$ = $3; }
    /* Recuperación */
    | MAIN error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Bloque main con estructura inválida`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = [];
        }
    ;

/* ── Instrucciones dentro de main y bloques anidados ── */
instrucciones_main
    : instrucciones_main instruccion_main
        { if ($2) $1.push($2); $$ = $1; }
    | /* vacío */
        { $$ = []; }
    ;

instruccion_main
    : declaracion           { $$ = $1; }
    | invocacion_componente { $$ = $1; }
    | asignacion            { $$ = $1; }
    | logica_if             { $$ = $1; }
    | logica_switch         { $$ = $1; }
    | logica_while          { $$ = $1; }
    | logica_do_while       { $$ = $1; }
    | logica_for            { $$ = $1; }
    | BREAK ';'             { $$ = { tipo: 'BREAK', linea: @1.first_line }; }
    | CONTINUE ';'          { $$ = { tipo: 'CONTINUE', linea: @1.first_line }; }
    | EXECUTE QUERY_SQL ';'
        { $$ = { tipo: 'EXECUTE', query: $2.replace(/^\`|\`$/g, ''), linea: @1.first_line }; }
    /* Recuperación */
    | error ';'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Instrucción inválida en main/bloque`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

invocacion_componente
    : COMP_REF '(' lista_expresiones_opt ')' ';'
        {
            $$ = { tipo: 'COMP_CALL', id: $1.substring(1), args: $3, linea: @1.first_line };
        }
    ;

asignacion
    : IDENTIFICADOR '=' expresion ';'
        { $$ = { tipo: 'ASIGNACION', id: $1, exp: $3, linea: @1.first_line }; }
    | IDENTIFICADOR '[' expresion ']' '=' expresion ';'
        { $$ = { tipo: 'ASIGNACION_ARR', id: $1, index: $3, exp: $6, linea: @1.first_line }; }
    ;

/* ══════════════════════════════════════════════════════════
   ESTRUCTURAS DE CONTROL
   ══════════════════════════════════════════════════════════ */

/* ── If / else if / else ── */
logica_if
    : IF '(' expresion ')' '{' instrucciones_main '}' lista_elseif else_opt
        {
            $$ = {
                tipo: 'IF',
                cond: $3,
                body: $6,
                elseifs: $8,
                elseBody: $9,
                linea: @1.first_line
            };
        }
    | IF error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Estructura if inválida`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

lista_elseif
    : lista_elseif ELSE IF '(' expresion ')' '{' instrucciones_main '}'
        { $1.push({ cond: $5, body: $8, linea: @2.first_line }); $$ = $1; }
    | /* vacío */
        { $$ = []; }
    ;

else_opt
    : ELSE '{' instrucciones_main '}'
        { $$ = $3; }
    | /* vacío */
        { $$ = null; }
    ;

/* ── Switch ── */
logica_switch
    : SWITCH '(' expresion ')' '{' lista_cases default_opt '}'
        { $$ = { tipo: 'SWITCH', exp: $3, cases: $6, def: $7, linea: @1.first_line }; }
    | SWITCH error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Estructura switch inválida`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

lista_cases
    : lista_cases caso_switch { $1.push($2); $$ = $1; }
    | /* vacío */             { $$ = []; }
    ;

caso_switch
    : CASE expresion ':' instrucciones_main BREAK ';'
        { $$ = { val: $2, body: $4, linea: @1.first_line }; }
    | CASE expresion ':'
        { $$ = { val: $2, body: [], fallThrough: true, linea: @1.first_line }; }
    ;

default_opt
    : DEFAULT ':' instrucciones_main
        { $$ = $3; }
    | /* vacío */
        { $$ = null; }
    ;

/* ── While ── */
logica_while
    : WHILE '(' expresion ')' '{' instrucciones_main '}'
        { $$ = { tipo: 'WHILE', cond: $3, body: $6, linea: @1.first_line }; }
    ;

/* ── Do-While ── */
logica_do_while
    : DO '{' instrucciones_main '}' WHILE '(' expresion ')' ';'
        { $$ = { tipo: 'DO_WHILE', cond: $7, body: $3, linea: @1.first_line }; }
    ;

/* ── For ── */
logica_for
    : FOR '(' init_for ';' expresion ';' inc_for ')' '{' instrucciones_main '}'
        { $$ = { tipo: 'FOR', init: $3, cond: $5, inc: $7, body: $10, linea: @1.first_line }; }
    | FOR error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Estructura for inválida`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

init_for
    : tipo IDENTIFICADOR '=' expresion
        { $$ = { tipo: 'DECLARACION', id: $2, exp: $4, tipoDato: $1, linea: @2.first_line }; }
    | IDENTIFICADOR '=' expresion
        { $$ = { tipo: 'ASIGNACION', id: $1, exp: $3, linea: @1.first_line }; }
    | /* vacío */
        { $$ = null; }
    ;

inc_for
    : IDENTIFICADOR '=' expresion
        { $$ = { tipo: 'ASIGNACION', id: $1, exp: $3, linea: @1.first_line }; }
    | /* vacío */
        { $$ = null; }
    ;

/* ══════════════════════════════════════════════════════════
   EXPRESIONES
   ══════════════════════════════════════════════════════════ */

lista_expresiones_opt
    : lista_expresiones { $$ = $1; }
    | /* vacío */       { $$ = []; }
    ;

lista_expresiones
    : lista_expresiones ',' expresion { $1.push($3); $$ = $1; }
    | expresion                       { $$ = [$1]; }
    ;

expresion
    : expresion '+' expresion
        { $$ = { tipo: 'BINARIA', op: '+',   izq: $1, der: $3, linea: @2.first_line }; }
    | expresion '-' expresion
        { $$ = { tipo: 'BINARIA', op: '-',   izq: $1, der: $3, linea: @2.first_line }; }
    | expresion '*' expresion
        { $$ = { tipo: 'BINARIA', op: '*',   izq: $1, der: $3, linea: @2.first_line }; }
    | expresion '/' expresion
        { $$ = { tipo: 'BINARIA', op: '/',   izq: $1, der: $3, linea: @2.first_line }; }
    | expresion '%' expresion
        { $$ = { tipo: 'BINARIA', op: '%',   izq: $1, der: $3, linea: @2.first_line }; }
    | expresion EQ  expresion
        { $$ = { tipo: 'BINARIA', op: '===', izq: $1, der: $3, linea: @2.first_line }; }
    | expresion NEQ expresion
        { $$ = { tipo: 'BINARIA', op: '!==', izq: $1, der: $3, linea: @2.first_line }; }
    | expresion '<' expresion
        { $$ = { tipo: 'BINARIA', op: '<',   izq: $1, der: $3, linea: @2.first_line }; }
    | expresion LTE expresion
        { $$ = { tipo: 'BINARIA', op: '<=',  izq: $1, der: $3, linea: @2.first_line }; }
    | expresion '>' expresion
        { $$ = { tipo: 'BINARIA', op: '>',   izq: $1, der: $3, linea: @2.first_line }; }
    | expresion GTE expresion
        { $$ = { tipo: 'BINARIA', op: '>=',  izq: $1, der: $3, linea: @2.first_line }; }
    | expresion AND expresion
        { $$ = { tipo: 'BINARIA', op: '&&',  izq: $1, der: $3, linea: @2.first_line }; }
    | expresion OR  expresion
        { $$ = { tipo: 'BINARIA', op: '||',  izq: $1, der: $3, linea: @2.first_line }; }
    | '!' expresion
        { $$ = { tipo: 'UNARIA', op: '!', der: $2, linea: @1.first_line }; }
    | '-' expresion %prec UMINUS
        { $$ = { tipo: 'UNARIA', op: '-', der: $2, linea: @1.first_line }; }
    | '(' expresion ')'
        { $$ = $2; }
    | IDENTIFICADOR '[' expresion ']'
        { $$ = { tipo: 'ARREGLO_ACCESO', id: $1, index: $3, linea: @1.first_line }; }
    | IDENTIFICADOR
        { $$ = { tipo: 'ID', val: $1, linea: @1.first_line }; }
    | NUM_INT
        { $$ = { tipo: 'NUM', val: Number($1), linea: @1.first_line }; }
    | NUM_FLOAT
        { $$ = { tipo: 'NUM', val: Number($1), linea: @1.first_line }; }
    | CADENA
        { $$ = { tipo: 'CADENA', val: $1.replace(/^"|"$/g, ''), linea: @1.first_line }; }
    | CARACTER
        { $$ = { tipo: 'CHAR', val: $1.replace(/^'|'$/g, ''), linea: @1.first_line }; }
    | TRUE
        { $$ = { tipo: 'BOOL', val: true, linea: @1.first_line }; }
    | FALSE
        { $$ = { tipo: 'BOOL', val: false, linea: @1.first_line }; }
    ;

%%
//coloreado

var _Y_HL = {
    'IMPORT':'keyword','EXECUTE':'keyword','LOAD':'keyword','FUNCTION':'keyword','MAIN':'keyword',
    'TYPE_INT':'keyword','TYPE_FLOAT':'keyword','TYPE_STRING':'keyword','TYPE_BOOLEAN':'keyword','TYPE_CHAR':'keyword',
    'IF':'keyword','ELSE':'keyword','SWITCH':'keyword','CASE':'keyword','DEFAULT':'keyword',
    'WHILE':'keyword','DO':'keyword','FOR':'keyword','BREAK':'keyword','CONTINUE':'keyword',
    'TRUE':'literal','FALSE':'literal',
    'NUM_INT':'number','NUM_FLOAT':'number',
    'CADENA':'string','CARACTER':'string','QUERY_SQL':'string',
    'COMP_REF':'identifier',
    'IDENTIFICADOR':'identifier',
    'EQ':'operator','NEQ':'operator','LTE':'operator','GTE':'operator','AND':'operator','OR':'operator',
    '+':'operator','-':'operator','*':'operator','/':'operator','%':'operator','!':'operator','<':'operator','>':'operator','=':'operator',
    '{':'delimiter','}':'delimiter','[':'delimiter',']':'delimiter','(':'delimiter',')':'delimiter',
    ';':null,',':null,':':null,
    'EOF':null
};

function _yLexSeg(seg, offset) {
    var out = [], lex = parser.lexer, eofId = parser.symbols_['EOF'] || 1;
    lex.yy = { errores: [] };
    lex.setInput(seg);
    try {
        var tok, name, cls;
        while (true) {
            tok = lex.lex();
            if (!tok || tok === 1 || tok === eofId || lex.done) break;
            name = parser.terminals_[tok] || ('' + tok);
            cls = _Y_HL[name];
            if (cls === undefined) cls = 'identifier';
            if (cls !== null)
                out.push({ startIndex: offset + (lex.yylloc ? lex.yylloc.first_column : 0), scopes: cls });
        }
    } catch(e) {}
    return out;
}

parser.tokenizeLine = function(line, inBlockComment) {
    var tokens = [], inCmt = !!inBlockComment, i = 0, LC = '#';
    while (i <= line.length) {
        if (inCmt) {
            var close = line.indexOf('*/', i);
            tokens.push({ startIndex: i, scopes: 'comment' });
            if (close === -1) return { tokens: tokens, endState: true };
            i = close + 2; inCmt = false; continue;
        }
        var bS = line.indexOf('/*', i);
        var lS = LC ? line.indexOf(LC, i) : -1;
        var nxt = -1, nt = '';
        if (bS !== -1) { nxt = bS; nt = 'block'; }
        if (lS !== -1 && (nxt === -1 || lS < nxt)) { nxt = lS; nt = 'line'; }
        var cEnd = nxt === -1 ? line.length : nxt;
        if (cEnd > i) tokens = tokens.concat(_yLexSeg(line.substring(i, cEnd), i));
        if (nxt === -1) break;
        tokens.push({ startIndex: nxt, scopes: 'comment' });
        if (nt === 'line') break;
        var ca = line.indexOf('*/', nxt + 2);
        if (ca === -1) { inCmt = true; break; }
        i = ca + 2;
    }
    return { tokens: tokens, endState: inCmt };
};
if (typeof window !== 'undefined') window.PrincipalJison = { parser: parser };
/* ============================================================
   DBJison.jison  —  Lenguaje de Base de Datos
   ============================================================ */

%lex
%options case-sensitive

%%

\s+                                     /* ignorar espacios y saltos */
"/*"[\s\S]*?"*/"                        /* ignorar comentarios multilínea */
"//".*                                  /* ignorar comentarios de línea */

/* ── Palabras reservadas ── */
"TABLE"                                 return 'TABLE';
"COLUMNS"                               return 'COLUMNS';
"IN"                                    return 'IN';
"DELETE"                                return 'DELETE';

/* ── Tipos de datos (sincronizados con el lenguaje principal) ── */
"int"                                   return 'TYPE_INT';
"string"                                return 'TYPE_STRING';
"number"                                return 'TYPE_NUMBER';
"boolean"                               return 'TYPE_BOOLEAN';
"float"                                 return 'TYPE_FLOAT';
"double"                                return 'TYPE_DOUBLE';

/* ── Literales booleanos ── */
"true"                                  return 'TRUE';
"false"                                 return 'FALSE';

/* ── Símbolos ── */
";"                                     return ';';
","                                     return ',';
"."                                     return '.';
"="                                     return '=';
"["                                     return '[';
"]"                                     return ']';

/* ── Operadores aritméticos ── */
"+"                                     return '+';
"-"                                     return '-';
"*"                                     return '*';
"/"                                     return '/';

/* ── Literales ── */
\"([^\"\\]|\\.)*\"                      return 'CADENA';
[0-9]+("."[0-9]+)?                      return 'NUMERO';

/* ── Identificadores ── */
[a-zA-Z_][a-zA-Z0-9_]*                 return 'IDENTIFICADOR';

<<EOF>>                                 return 'EOF';

/* ── Error léxico: acumula y continúa   */
.   {
        yy.errores.push({
            tipo: 'Léxico',
            descripcion: `Carácter no reconocido: "${yytext}"`,
            linea: yylloc.first_line,
            columna: yylloc.first_column + 1
        });
    }

/lex

/* ── Precedencia de operadores ── */
%left '+' '-'
%left '*' '/'
%right UMINUS

%start inicio

%%
//incio

inicio
    : lista_consultas EOF
        { return { ast: $1, errores: yy.errores }; }
    ;

/* ── Lista de consultas con recuperación de errores ── */
lista_consultas
    : lista_consultas consulta
        { if ($2) $1.push($2); $$ = $1; }
    | consulta
        { $$ = $1 ? [$1] : []; }

    | lista_consultas error ';'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Instrucción inválida descartada`,
                linea: @2.first_line,
                columna: @2.first_column + 1
            });
            $$ = $1;
        }
    | error ';'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Instrucción inválida descartada`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = [];
        }
    ;

consulta
    : instruccion ';'
        { $$ = $1; }
    ;

instruccion
    : crear_tabla               { $$ = $1; }
    | seleccionar_columna       { $$ = $1; }
    | insertar_registro         { $$ = $1; }
    | actualizar_registro       { $$ = $1; }
    | eliminar_registro         { $$ = $1; }
    ;

//creacion

crear_tabla
    : TABLE IDENTIFICADOR COLUMNS lista_definicion_columnas
        {
            $$ = {
                tipo: 'CREATE',
                tabla: $2,
                cols: $4,
                linea: @1.first_line
            };
        }
    | TABLE error ';'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Definición de tabla inválida`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

lista_definicion_columnas
    : lista_definicion_columnas ',' definicion_columna
        { $1.push($3); $$ = $1; }
    | definicion_columna
        { $$ = [$1]; }
    | lista_definicion_columnas ',' error
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Definición de columna inválida, se descartó`,
                linea: @3.first_line,
                columna: @3.first_column + 1
            });
            $$ = $1;
        }
    ;

definicion_columna
    : IDENTIFICADOR '=' tipos_permitidos
        { $$ = { id: $1, tipo: $3, linea: @1.first_line }; }
    ;

tipos_permitidos
    : TYPE_INT      { $$ = 'TYPE_INT'; }
    | TYPE_STRING   { $$ = 'TYPE_STRING'; }
    | TYPE_NUMBER   { $$ = 'TYPE_NUMBER'; }
    | TYPE_BOOLEAN  { $$ = 'TYPE_BOOLEAN'; }
    | TYPE_FLOAT    { $$ = 'TYPE_FLOAT'; }
    | TYPE_DOUBLE   { $$ = 'TYPE_DOUBLE'; }
    ;

//select

seleccionar_columna
    : IDENTIFICADOR '.' IDENTIFICADOR
        {
            $$ = {
                tipo: 'SELECT_COL',
                tabla: $1,
                col: $3,
                linea: @1.first_line
            };
        }
    ;

//insert

insertar_registro
    : IDENTIFICADOR '[' lista_asignaciones ']'
        {
            $$ = {
                tipo: 'INSERT',
                tabla: $1,
                data: $3,
                linea: @1.first_line
            };
        }
    ;

//actualixacon

actualizar_registro
    : IDENTIFICADOR '[' lista_asignaciones ']' IN expresion_entera
        {
            $$ = {
                tipo: 'UPDATE',
                tabla: $1,
                data: $3,
                id: $6,
                linea: @1.first_line
            };
        }
    ;

//eliminacion

eliminar_registro
    : IDENTIFICADOR DELETE expresion_entera
        {
            $$ = {
                tipo: 'DELETE',
                tabla: $1,
                id: $3,
                linea: @1.first_line
            };
        }
    ;

//asignaciones

lista_asignaciones
    : lista_asignaciones ',' asignacion
        { $1.push($3); $$ = $1; }
    | asignacion
        { $$ = [$1]; }

    | lista_asignaciones ',' error
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Asignación inválida descartada`,
                linea: @3.first_line,
                columna: @3.first_column + 1
            });
            $$ = $1;
        }
    ;

asignacion
    : IDENTIFICADOR '=' expresion
        { $$ = { col: $1, val: $3, linea: @1.first_line }; }
    ;

//expresiones

expresion
    : expresion '+' expresion
        { $$ = { op: '+', izq: $1, der: $3, linea: @2.first_line }; }
    | expresion '-' expresion
        { $$ = { op: '-', izq: $1, der: $3, linea: @2.first_line }; }
    | expresion '*' expresion
        { $$ = { op: '*', izq: $1, der: $3, linea: @2.first_line }; }
    | expresion '/' expresion
        { $$ = { op: '/', izq: $1, der: $3, linea: @2.first_line }; }
    | '-' expresion %prec UMINUS
        { $$ = { op: 'neg', val: $2, linea: @1.first_line }; }
    | '(' expresion ')'
        { $$ = $2; }
    | NUMERO
        { $$ = { tipo: 'NUM', val: Number($1), linea: @1.first_line }; }
    | CADENA
        { $$ = { tipo: 'STR', val: $1, linea: @1.first_line }; }
    | TRUE
        { $$ = { tipo: 'BOOL', val: true, linea: @1.first_line }; }
    | FALSE
        { $$ = { tipo: 'BOOL', val: false, linea: @1.first_line }; }
    | IDENTIFICADOR
        { $$ = { tipo: 'ID', val: $1, linea: @1.first_line }; }
    ;

/* Expresión entera para IDs */
expresion_entera
    : NUMERO
        { $$ = { tipo: 'NUM', val: Number($1), linea: @1.first_line }; }
    | IDENTIFICADOR
        { $$ = { tipo: 'ID', val: $1, linea: @1.first_line }; }
    ;

%%

//coloreafo

var _DB_HL = {
    'TABLE':'keyword','COLUMNS':'keyword','IN':'keyword','DELETE':'keyword',
    'TYPE_INT':'keyword','TYPE_STRING':'keyword','TYPE_NUMBER':'keyword',
    'TYPE_BOOLEAN':'keyword','TYPE_FLOAT':'keyword','TYPE_DOUBLE':'keyword',
    'TRUE':'literal','FALSE':'literal',
    'NUMERO':'number','CADENA':'string',
    'IDENTIFICADOR':'identifier',
    '+':'operator','-':'operator','*':'operator','/':'operator','=':'operator',
    '(':'delimiter',')':'delimiter','[':'delimiter',']':'delimiter',
    ';':'identifier',',':'identifier','.':'identifier',
    'EOF':null
};

function _dbLexSeg(seg, offset) {
    var out = [], lex = parser.lexer, eofId = parser.symbols_['EOF'] || 1;
    lex.yy = { errores: [] };
    lex.setInput(seg);
    try {
        var tok, name, cls;
        while (true) {
            tok = lex.lex();
            if (!tok || tok === 1 || tok === eofId || lex.done) break;
            name = parser.terminals_[tok] || ('' + tok);
            cls = _DB_HL[name];
            if (cls === undefined) cls = 'identifier';
            if (cls !== null)
                out.push({ startIndex: offset + (lex.yylloc ? lex.yylloc.first_column : 0), scopes: cls });
        }
    } catch(e) {}
    return out;
}

parser.tokenizeLine = function(line, inBlockComment) {
    var tokens = [], inCmt = !!inBlockComment, i = 0, LC = '//';
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
        if (cEnd > i) tokens = tokens.concat(_dbLexSeg(line.substring(i, cEnd), i));
        if (nxt === -1) break;
        tokens.push({ startIndex: nxt, scopes: 'comment' });
        if (nt === 'line') break;
        var ca = line.indexOf('*/', nxt + 2);
        if (ca === -1) { inCmt = true; break; }
        i = ca + 2;
    }
    return { tokens: tokens, endState: inCmt };
};
if (typeof window !== 'undefined') window.DBJison = { parser: parser };
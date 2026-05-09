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

/* ══════════════════════════════════════════════════════════
   PUNTO DE ENTRADA
   ══════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════
   CREAR TABLA
   ══════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════
   SELECCIONAR COLUMNA
   ══════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════
   INSERTAR REGISTRO
   ══════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════
   ACTUALIZAR REGISTRO
   ══════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════
   ELIMINAR REGISTRO
   ══════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════
   LISTA DE ASIGNACIONES
   ══════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════
   EXPRESIONES
   ══════════════════════════════════════════════════════════ */

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
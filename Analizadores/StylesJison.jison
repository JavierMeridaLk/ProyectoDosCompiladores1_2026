/* ============================================================
   StylesJison.jison  —  Lenguaje de Estilos (.styles)
   ============================================================ */

%lex
%options case-sensitive

%%

\s+                                         /* ignorar espacios y saltos */
\/\*[\s\S]*?\*\/                            /* comentarios multilínea */

/* ── Palabras clave del @for ── */
"@for"                                      return 'FOR';
"from"                                      return 'FROM';
"through"                                   return 'THROUGH';
"to"                                        return 'TO';
"extends"                                   return 'EXTENDS';

/* ── Propiedades compuestas ── */
"background color"                          return 'BACKGROUND_COLOR';
"border bottom style"                       return 'BORDER_BOTTOM_STYLE';
"border bottom width"                       return 'BORDER_BOTTOM_WIDTH';
"border bottom color"                       return 'BORDER_BOTTOM_COLOR';
"border right style"                        return 'BORDER_RIGHT_STYLE';
"border right width"                        return 'BORDER_RIGHT_WIDTH';
"border right color"                        return 'BORDER_RIGHT_COLOR';
"border left style"                         return 'BORDER_LEFT_STYLE';
"border left width"                         return 'BORDER_LEFT_WIDTH';
"border left color"                         return 'BORDER_LEFT_COLOR';
"border top style"                          return 'BORDER_TOP_STYLE';
"border top width"                          return 'BORDER_TOP_WIDTH';
"border top color"                          return 'BORDER_TOP_COLOR';
"padding bottom"                            return 'PADDING_BOTTOM';
"margin bottom"                             return 'MARGIN_BOTTOM';
"border radius"                             return 'BORDER_RADIUS';
"border bottom"                             return 'BORDER_BOTTOM';
"border right"                              return 'BORDER_RIGHT';
"border left"                               return 'BORDER_LEFT';
"border top"                                return 'BORDER_TOP';
"padding right"                             return 'PADDING_RIGHT';
"margin right"                              return 'MARGIN_RIGHT';
"padding left"                              return 'PADDING_LEFT';
"margin left"                               return 'MARGIN_LEFT';
"border style"                              return 'BORDER_STYLE';
"border width"                              return 'BORDER_WIDTH';
"border color"                              return 'BORDER_COLOR';
"padding top"                               return 'PADDING_TOP';
"margin top"                                return 'MARGIN_TOP';
"text align"                                return 'TEXT_ALIGN';
"text font"                                 return 'TEXT_FONT';
"text size"                                 return 'TEXT_SIZE';
"min-height"                                return 'MIN_HEIGHT';
"max-height"                                return 'MAX_HEIGHT';
"min-width"                                 return 'MIN_WIDTH';
"max-width"                                 return 'MAX_WIDTH';
"padding"                                   return 'PADDING';
"margin"                                    return 'MARGIN';
"border"                                    return 'BORDER';
"height"                                    return 'HEIGHT';
"width"                                     return 'WIDTH';
"color"                                     return 'COLOR';

/* ── Valores de dirección y fuente ── */
"CENTER"|"RIGHT"|"LEFT"                     return 'DIRECCION';
"HELVETICA"|"SANS SERIF"|"SANS"|"MONO"|"CURSIVE"   return 'FONT_FAMILY';

/* ── Estilos de borde */
"DOTTED"|"LINE"|"DOUBLE"|"SOLID"|"solid"   return 'BORDER_KIND';

/* ── Colores con nombre ── */
"lightgray"|"blue"|"white"|"red"|"green"|"violet"|"gray"|"black"  return 'COLOR_NAME';

/* ── Función rgb ── */
"rgb"                                       return 'RGB_FUNC';

/* ── Color hexadecimal ── */
"#"([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b      return 'HEX_COLOR';

/* ── Delimitadores y operadores ── */
"{"                                         return '{';
"}"                                         return '}';
";"                                         return ';';
"="                                         return '=';
","                                         return ',';
"("                                         return '(';
")"                                         return ')';
"*"                                         return '*';
"/"                                         return '/';
"+"                                         return '+';
"-"                                         return '-';
"%"                                         return '%';

/* ── Números y porcentajes ── */
[0-9]+"."[0-9]+"%"                          return 'PORCENTAJE';
[0-9]+"%"                                   return 'PORCENTAJE';
[0-9]+"."[0-9]+                             return 'NUMERO';
[0-9]+                                      return 'NUMERO';

/* ── Identificadores y variables de @for ── */
\$[a-zA-Z0-9_]+                             return 'VARIABLE_FOR';
[a-zA-Z][a-zA-Z0-9-]*                      return 'IDENTIFICADOR';

<<EOF>>                                     return 'EOF';

/* ── Error léxico── */
.   {
        yy.errores.push({
            tipo: 'Léxico',
            descripcion: `Carácter no reconocido: "${yytext}"`,
            linea: yylloc.first_line,
            columna: yylloc.first_column + 1
        });
    }

/lex

/* ── Precedencia de operadores aritméticos ── */
%left '+' '-'
%left '*' '/' '%'
%right UMINUS

%start inicio

%%

/* ══════════════════════════════════════════
   REGLAS GRAMATICALES
   ══════════════════════════════════════════ */

inicio
    : cuerpo EOF
        { return { ast: $1, errores: yy.errores }; }
    ;

/* Lista de elementos */
cuerpo
    : cuerpo elemento
        { if ($2 !== null && $2 !== undefined) $1.push($2); $$ = $1; }
    | elemento
        { $$ = ($1 !== null && $1 !== undefined) ? [$1] : []; }
    ;

elemento
    : definicion_estilo { $$ = $1; }
    | bucle_for         { $$ = $1; }
    | error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Bloque de estilo con estructura inválida, se descartó el bloque`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

/* ── Definición de una clase de estilo ── */
definicion_estilo
    : nombre_clase '{' lista_atributos '}'
        { $$ = { tipo: 'REGLA', selector: $1, propiedades: $3, extiende: null, linea: @1.first_line }; }
    | nombre_clase EXTENDS IDENTIFICADOR '{' lista_atributos '}'
        { $$ = { tipo: 'REGLA', selector: $1, propiedades: $5, extiende: $3, linea: @1.first_line }; }
    | nombre_clase '{' lista_atributos error
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Falta "}" de cierre en el estilo "${$1}"`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = { tipo: 'REGLA', selector: $1, propiedades: $3, extiende: null, linea: @1.first_line };
        }
    ;

/* Nombre de clase*/
nombre_clase
    : IDENTIFICADOR                     { $$ = $1; }
    | IDENTIFICADOR VARIABLE_FOR        { $$ = $1 + $2; }
    | VARIABLE_FOR IDENTIFICADOR        { $$ = $1 + $2; }
    | VARIABLE_FOR                      { $$ = $1; }
    ;

/* ── Lista de atributos dentro de un bloque ── */
lista_atributos
    : lista_atributos atributo
        { if ($2 !== null && $2 !== undefined) $1.push($2); $$ = $1; }
    | /* vacío */
        { $$ = []; }
    ;

/* ── Un atributo ── */
atributo
    /* Propiedades de medida  */
    : propiedad_medida '=' valor_medida ';'
        { $$ = { propiedad: $1, valor: $3, linea: @1.first_line }; }

    /* Propiedades de estilo de borde */
    | propiedad_estilo_borde '=' BORDER_KIND ';'
        { $$ = { propiedad: $1, valor: $3, linea: @1.first_line }; }

    /* Propiedades de color de borde */
    | propiedad_color_borde '=' valor_color ';'
        { $$ = { propiedad: $1, valor: $3, linea: @1.first_line }; }

    /* Atajo de borde*/
    | propiedad_atajo_borde '=' valor_medida BORDER_KIND valor_color ';'
        { $$ = { propiedad: $1, valor: { shorthand: true, w: $3, s: $4, c: $5 }, linea: @1.first_line }; }

    /* Color de fondo */
    | BACKGROUND_COLOR '=' valor_color ';'
        { $$ = { propiedad: 'background color', valor: $3, linea: @1.first_line }; }

    /* Color de texto */
    | COLOR '=' valor_color ';'
        { $$ = { propiedad: 'color', valor: $3, linea: @1.first_line }; }

    /* Alineación de texto */
    | TEXT_ALIGN '=' DIRECCION ';'
        { $$ = { propiedad: 'text align', valor: $3, linea: @1.first_line }; }

    /* Fuente de texto */
    | TEXT_FONT '=' FONT_FAMILY ';'
        { $$ = { propiedad: 'text font', valor: $3, linea: @1.first_line }; }

    /* TEXT_SIZE  */
    | TEXT_SIZE '=' valor_medida ';'
        { $$ = { propiedad: 'text size', valor: $3, linea: @1.first_line }; }

    /* Recuperación de error en atributo individual — descarta hasta el ';' */
    | error ';'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Propiedad o valor inválido en línea ${@1.first_line}, se descartó la declaración`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

/* ── Grupos de propiedades ──*/

propiedad_medida
    : HEIGHT        { $$ = 'height'; }
    | WIDTH         { $$ = 'width'; }
    | MIN_WIDTH     { $$ = 'min-width'; }
    | MAX_WIDTH     { $$ = 'max-width'; }
    | MIN_HEIGHT    { $$ = 'min-height'; }
    | MAX_HEIGHT    { $$ = 'max-height'; }
    | BORDER_RADIUS { $$ = 'border-radius'; }
    | BORDER_WIDTH  { $$ = 'border-width'; }
    | PADDING       { $$ = 'padding'; }
    | MARGIN        { $$ = 'margin'; }
    | PADDING_LEFT  { $$ = 'padding-left'; }
    | PADDING_RIGHT { $$ = 'padding-right'; }
    | PADDING_TOP   { $$ = 'padding-top'; }
    | PADDING_BOTTOM{ $$ = 'padding-bottom'; }
    | MARGIN_LEFT   { $$ = 'margin-left'; }
    | MARGIN_RIGHT  { $$ = 'margin-right'; }
    | MARGIN_TOP    { $$ = 'margin-top'; }
    | MARGIN_BOTTOM { $$ = 'margin-bottom'; }
    ;

propiedad_estilo_borde
    : BORDER_STYLE        { $$ = 'border-style'; }
    | BORDER_TOP_STYLE    { $$ = 'border-top-style'; }
    | BORDER_RIGHT_STYLE  { $$ = 'border-right-style'; }
    | BORDER_BOTTOM_STYLE { $$ = 'border-bottom-style'; }
    | BORDER_LEFT_STYLE   { $$ = 'border-left-style'; }
    ;

propiedad_color_borde
    : BORDER_COLOR        { $$ = 'border-color'; }
    | BORDER_TOP_COLOR    { $$ = 'border-top-color'; }
    | BORDER_RIGHT_COLOR  { $$ = 'border-right-color'; }
    | BORDER_BOTTOM_COLOR { $$ = 'border-bottom-color'; }
    | BORDER_LEFT_COLOR   { $$ = 'border-left-color'; }
    ;

propiedad_atajo_borde
    : BORDER        { $$ = 'border'; }
    | BORDER_TOP    { $$ = 'border-top'; }
    | BORDER_RIGHT  { $$ = 'border-right'; }
    | BORDER_BOTTOM { $$ = 'border-bottom'; }
    | BORDER_LEFT   { $$ = 'border-left'; }
    ;

/* ── Valores ── */

valor_medida
    : expresion_numerica { $$ = $1; }
    | PORCENTAJE         { $$ = $1; }
    ;

valor_color
    : COLOR_NAME { $$ = $1; }
    | HEX_COLOR  { $$ = $1; }
    | RGB_FUNC '(' expresion_numerica ',' expresion_numerica ',' expresion_numerica ')'
        { $$ = { tipo: 'rgb', r: $3, g: $5, b: $7 }; }
    ;

/* ── Expresiones numéricas  ── */
expresion_numerica
    : NUMERO
        { $$ = Number($1); }
    | VARIABLE_FOR
        { $$ = $1; }
    | expresion_numerica '+' expresion_numerica
        { $$ = { op: '+', izq: $1, der: $3 }; }
    | expresion_numerica '-' expresion_numerica
        { $$ = { op: '-', izq: $1, der: $3 }; }
    | expresion_numerica '*' expresion_numerica
        { $$ = { op: '*', izq: $1, der: $3 }; }
    | expresion_numerica '/' expresion_numerica
        { $$ = { op: '/', izq: $1, der: $3 }; }
    | expresion_numerica '%' expresion_numerica
        { $$ = { op: '%', izq: $1, der: $3 }; }
    | '(' expresion_numerica ')'
        { $$ = $2; }
    | '-' expresion_numerica %prec UMINUS
        { $$ = { op: 'neg', val: $2 }; }
    ;

/* ── Bucle @for ── */
bucle_for
    : FOR VARIABLE_FOR FROM expresion_numerica tipo_rango expresion_numerica '{' cuerpo_for '}'
        {
            $$ = {
                tipo: 'FOR',
                variable: $2,
                inicio: $4,
                fin: $6,
                modo: $5,
                cuerpo: $8,
                linea: @1.first_line
            };
        }
    | FOR error '}'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Estructura de @for inválida, se descartó el bucle`,
                linea: @1.first_line,
                columna: @1.first_column + 1
            });
            $$ = null;
        }
    ;

tipo_rango
    : THROUGH { $$ = 'THROUGH'; }
    | TO      { $$ = 'TO'; }
    ;

cuerpo_for
    : cuerpo_for definicion_estilo
        { if ($2) $1.push($2); $$ = $1; }
    | cuerpo_for error ';'
        {
            yy.errores.push({
                tipo: 'Sintáctico',
                descripcion: `Declaración inválida dentro de @for en línea ${@2.first_line}`,
                linea: @2.first_line,
                columna: @2.first_column + 1
            });
            $$ = $1;
        }
    | /* vacío */
        { $$ = []; }
    ;
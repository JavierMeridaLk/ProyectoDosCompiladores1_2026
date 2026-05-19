/* ============================================================
   StylesJison.jison  —  Lenguaje de Estilos (.styles)
   Lenguaje case-sensitive. Solo las propiedades del spec.
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

/* ── Propiedades compuestas — más largas primero ── */
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

/* ── Valores de dirección: CENTER, RIGHT, LEFT (case-sensitive) ── */
"CENTER"|"RIGHT"|"LEFT"                     return 'DIRECCION';

/* ── Fuentes (case-sensitive según spec) ── */
"HELVETICA"|"SANS SERIF"|"SANS"|"MONO"|"CURSIVE"   return 'FONT_FAMILY';

/* ── Estilos de borde ── */

"DOTTED"|"LINE"|"DOUBLE"|"SOLID"|"solid"|"dashed"   return 'BORDER_KIND';

/* ── Colores con nombre (spec: blue, white, red, green, violet, gray, black, lightgray) ── */
"lightgray"|"blue"|"white"|"red"|"green"|"violet"|"gray"|"black"   return 'COLOR_NAME';

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

/* ── Error léxico ── */
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

nombre_clase
    : IDENTIFICADOR                     { $$ = $1; }
    | IDENTIFICADOR VARIABLE_FOR        { $$ = $1 + $2; }
    | VARIABLE_FOR IDENTIFICADOR        { $$ = $1 + $2; }
    | VARIABLE_FOR                      { $$ = $1; }
    ;

lista_atributos
    : lista_atributos atributo
        { if ($2 !== null && $2 !== undefined) $1.push($2); $$ = $1; }
    | /* vacío */
        { $$ = []; }
    ;

/* ── Atributo: todas las propiedades del spec ── */
atributo
    /* Dimensiones y espaciado */
    : propiedad_medida '=' valor_medida ';'
        { $$ = { propiedad: $1, valor: $3, linea: @1.first_line }; }

    /* Estilos de borde (DOTTED, LINE, DOUBLE) */
    | propiedad_estilo_borde '=' BORDER_KIND ';'
        { $$ = { propiedad: $1, valor: $3, linea: @1.first_line }; }

    /* Color de borde por lado */
    | propiedad_color_borde '=' valor_color ';'
        { $$ = { propiedad: $1, valor: $3, linea: @1.first_line }; }

    /* Atajo de borde */
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

    /* Recuperación de error*/
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

/*Propiedades de medida*/
propiedad_medida
    : HEIGHT              { $$ = 'height'; }
    | WIDTH               { $$ = 'width'; }
    | MIN_WIDTH           { $$ = 'min-width'; }
    | MAX_WIDTH           { $$ = 'max-width'; }
    | MIN_HEIGHT          { $$ = 'min-height'; }
    | MAX_HEIGHT          { $$ = 'max-height'; }
    | BORDER_RADIUS       { $$ = 'border-radius'; }
    | BORDER_WIDTH        { $$ = 'border-width'; }
    | BORDER_TOP_WIDTH    { $$ = 'border-top-width'; }
    | BORDER_RIGHT_WIDTH  { $$ = 'border-right-width'; }
    | BORDER_BOTTOM_WIDTH { $$ = 'border-bottom-width'; }
    | BORDER_LEFT_WIDTH   { $$ = 'border-left-width'; }
    | PADDING             { $$ = 'padding'; }
    | MARGIN              { $$ = 'margin'; }
    | PADDING_LEFT        { $$ = 'padding-left'; }
    | PADDING_RIGHT       { $$ = 'padding-right'; }
    | PADDING_TOP         { $$ = 'padding-top'; }
    | PADDING_BOTTOM      { $$ = 'padding-bottom'; }
    | MARGIN_LEFT         { $$ = 'margin-left'; }
    | MARGIN_RIGHT        { $$ = 'margin-right'; }
    | MARGIN_TOP          { $$ = 'margin-top'; }
    | MARGIN_BOTTOM       { $$ = 'margin-bottom'; }
    | TEXT_SIZE           { $$ = 'text size'; }
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

/* ── Expresiones numéricas ── */
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

/* ── Bucle @for  ── */
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

%%
//Coloreado

var _CSS_HL = {
    'FOR':'keyword','FROM':'keyword','THROUGH':'keyword','TO':'keyword','EXTENDS':'keyword','RGB_FUNC':'keyword',
    'BACKGROUND_COLOR':'keyword',
    'BORDER_BOTTOM_STYLE':'keyword','BORDER_BOTTOM_WIDTH':'keyword',
    'BORDER_BOTTOM_COLOR':'keyword','BORDER_RIGHT_STYLE':'keyword','BORDER_RIGHT_WIDTH':'keyword',
    'BORDER_RIGHT_COLOR':'keyword','BORDER_LEFT_STYLE':'keyword','BORDER_LEFT_WIDTH':'keyword',
    'BORDER_LEFT_COLOR':'keyword','BORDER_TOP_STYLE':'keyword','BORDER_TOP_WIDTH':'keyword',
    'BORDER_TOP_COLOR':'keyword','PADDING_BOTTOM':'keyword','MARGIN_BOTTOM':'keyword',
    'BORDER_RADIUS':'keyword','BORDER_BOTTOM':'keyword','BORDER_RIGHT':'keyword',
    'BORDER_LEFT':'keyword','BORDER_TOP':'keyword','PADDING_RIGHT':'keyword',
    'MARGIN_RIGHT':'keyword','PADDING_LEFT':'keyword','MARGIN_LEFT':'keyword',
    'BORDER_STYLE':'keyword','BORDER_WIDTH':'keyword','BORDER_COLOR':'keyword',
    'PADDING_TOP':'keyword','MARGIN_TOP':'keyword','TEXT_ALIGN':'keyword',
    'TEXT_FONT':'keyword','TEXT_SIZE':'keyword','MIN_HEIGHT':'keyword','MAX_HEIGHT':'keyword',
    'MIN_WIDTH':'keyword','MAX_WIDTH':'keyword','PADDING':'keyword','MARGIN':'keyword',
    'BORDER':'keyword','HEIGHT':'keyword','WIDTH':'keyword','COLOR':'keyword',
    'DIRECCION':'literal','FONT_FAMILY':'literal','BORDER_KIND':'literal','COLOR_NAME':'literal',
    'HEX_COLOR':'number','PORCENTAJE':'number','NUMERO':'number',
    'VARIABLE_FOR':'variable',
    'IDENTIFICADOR':'identifier',
    '+':'operator','-':'operator','*':'operator','/':'operator','%':'operator','=':'operator',
    '{':'delimiter','}':'delimiter','(':'delimiter',')':'delimiter',
    ';':null,',':null,
    'EOF':null
};

function _cssLexSeg(seg, offset) {
    var out = [], lex = parser.lexer, eofId = parser.symbols_['EOF'] || 1;
    lex.yy = { errores: [] };
    lex.setInput(seg);
    try {
        var tok, name, cls;
        while (true) {
            tok = lex.lex();
            if (!tok || tok === 1 || tok === eofId || lex.done) break;
            name = parser.terminals_[tok] || ('' + tok);
            cls = _CSS_HL[name];
            if (cls === undefined) cls = 'identifier';
            if (cls !== null)
                out.push({ startIndex: offset + (lex.yylloc ? lex.yylloc.first_column : 0), scopes: cls });
        }
    } catch(e) {}
    return out;
}

parser.tokenizeLine = function(line, inBlockComment) {
    var tokens = [], inCmt = !!inBlockComment, i = 0;
    while (i <= line.length) {
        if (inCmt) {
            var close = line.indexOf('*/', i);
            tokens.push({ startIndex: i, scopes: 'comment' });
            if (close === -1) return { tokens: tokens, endState: true };
            i = close + 2; inCmt = false; continue;
        }
        var bS = line.indexOf('/*', i);
        var cEnd = bS === -1 ? line.length : bS;
        if (cEnd > i) tokens = tokens.concat(_cssLexSeg(line.substring(i, cEnd), i));
        if (bS === -1) break;
        tokens.push({ startIndex: bS, scopes: 'comment' });
        var ca = line.indexOf('*/', bS + 2);
        if (ca === -1) { inCmt = true; break; }
        i = ca + 2;
    }
    return { tokens: tokens, endState: inCmt };
};
if (typeof window !== 'undefined') window.StylesJison = { parser: parser };

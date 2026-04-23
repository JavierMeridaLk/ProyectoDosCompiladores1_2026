%{
    /* Archivo Jison para el analisis lexico y sintactico del lenguaje de estilos */
%}

/* Analizador lexico */ 
%lex
%options case-sensitive

%%

/* Espacios y Comentarios */
\s+                                                                     /* ignorar espacios */
\/\*[\s\S]*?\*\/                                                        /* comentarios multilínea */

/* Palabras Reservadas del Lenguaje */
"@for"                                                                  return 'FOR';
"from"                                                                  return 'FROM';
"through"                                                               return 'THROUGH';
"to"                                                                    return 'TO';
"extends"                                                               return 'EXTENDS';

/* PROPIEDADES (Ordenadas de mayor a menor longitud para evitar conflictos en el lexer) 
*/
"background color"                                                      return 'BACKGROUND_COLOR'; 
"border bottom style"                                                   return 'BORDER_BOTTOM_STYLE';
"border bottom width"                                                   return 'BORDER_BOTTOM_WIDTH';
"border bottom color"                                                   return 'BORDER_BOTTOM_COLOR';
"border right style"                                                    return 'BORDER_RIGHT_STYLE';
"border right width"                                                    return 'BORDER_RIGHT_WIDTH';
"border right color"                                                    return 'BORDER_RIGHT_COLOR';
"border left style"                                                     return 'BORDER_LEFT_STYLE';
"border left width"                                                     return 'BORDER_LEFT_WIDTH';
"border left color"                                                     return 'BORDER_LEFT_COLOR';
"border top style"                                                      return 'BORDER_TOP_STYLE';
"border top width"                                                      return 'BORDER_TOP_WIDTH';
"border top color"                                                      return 'BORDER_TOP_COLOR';
"padding bottom"                                                        return 'PADDING_BOTTOM';
"margin bottom"                                                         return 'MARGIN_BOTTOM';
"border radius"                                                         return 'BORDER_RADIUS';
"border bottom"                                                         return 'BORDER_BOTTOM';
"border right"                                                          return 'BORDER_RIGHT';
"padding right"                                                         return 'PADDING_RIGHT';
"margin right"                                                          return 'MARGIN_RIGHT';
"padding left"                                                          return 'PADDING_LEFT';
"margin left"                                                           return 'MARGIN_LEFT';
"border style"                                                          return 'BORDER_STYLE';
"border width"                                                          return 'BORDER_WIDTH';
"border color"                                                          return 'BORDER_COLOR';
"padding top"                                                           return 'PADDING_TOP';
"margin top"                                                            return 'MARGIN_TOP';
"border left"                                                           return 'BORDER_LEFT';
"border top"                                                            return 'BORDER_TOP';
"text align"                                                            return 'TEXT_ALIGN';
"text font"                                                             return 'TEXT_FONT';
"text size"                                                             return 'TEXT_SIZE';
"min-height"                                                            return 'MIN_HEIGHT';
"max-height"                                                            return 'MAX_HEIGHT';
"min-width"                                                             return 'MIN_WIDTH';
"max-width"                                                             return 'MAX_WIDTH';
"padding"                                                               return 'PADDING';
"margin"                                                                return 'MARGIN';
"border"                                                                return 'BORDER';
"height"                                                                return 'HEIGHT';
"width"                                                                 return 'WIDTH';
"color"                                                                 return 'COLOR';

/* Valores Constantes */
CENTER|RIGHT|LEFT                                                       return 'DIRECCION';
HELVETICA|SANS\s+SERIF|SANS|MONO|CURSIVE                                return 'FONT_FAMILY'; 
DOTTED|LINE|DOUBLE|solid                                                return 'BORDER_KIND';
blue|white|red|green|violet|gray|black|lightgray                        return 'COLOR_NAME';
"rgb"                                                                   return 'RGB_FUNC';
"#"([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b                                    return 'HEX_COLOR';

/* Símbolos y Operadores */
"{"                                                                     return '{';
"}"                                                                     return '}';
";"                                                                     return ';';
"="                                                                     return '=';
","                                                                     return ',';
"("                                                                     return '(';
")"                                                                     return ')';
"*"                                                                     return '*';
"/"                                                                     return '/';
"+"                                                                     return '+';
"-"                                                                     return '-';

/* Identificadores, Porcentajes y Números */
[0-9]+"."[0-9]+"%"                                                      return 'PORCENTAJE';
[0-9]+"%"                                                               return 'PORCENTAJE';
[0-9]+"."[0-9]+\b                                                       return 'NUMERO';
[0-9]+\b                                                                return 'NUMERO';
[a-zA-Z][a-zA-Z0-9-]* return 'IDENTIFICADOR';
\$[a-zA-Z0-9_]+                                                         return 'VARIABLE_FOR';
"$"                                                                     return '$';
"%"                                                                     return '%';
<<EOF>>                                                                 return 'EOF';
.                                                                       { console.error('Error léxico en línea ' + yylloc.first_line + ': ' + yytext); }

/lex

/* PRECEDENCIA ARITMÉTICA */
%left '+' '-'
%left '*' '/' '%'
%right UMINUS

%start inicio

%%

inicio
    : cuerpo EOF { return $1; }
    ;

cuerpo
    : cuerpo elemento { $1.push($2); $$ = $1; }
    | elemento        { $$ = [$1]; }
    ;

elemento
    : definicion_estilo { $$ = $1; }
    | bucle_for         { $$ = $1; }
    ;

definicion_estilo
    : nombre_clase '{' lista_atributos '}' 
        { $$ = { tipo: 'REGLA', selector: $1, propiedades: $3, extends: null }; }
    | nombre_clase EXTENDS IDENTIFICADOR '{' lista_atributos '}'
        { $$ = { tipo: 'REGLA', selector: $1, propiedades: $5, extends: $3 }; }
    ;

/* Permite nombres como .boton-$i */
nombre_clase
    : IDENTIFICADOR 
        { $$ = $1; }
    | IDENTIFICADOR VARIABLE_FOR 
        { $$ = $1 + $2; }
    ;

lista_atributos
    : lista_atributos atributo { $1.push($2); $$ = $1; }
    | /* vacío */              { $$ = []; }
    ;

atributo
    : propiedad_medida '=' valor_medida ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | propiedad_estilo_borde '=' BORDER_KIND ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | propiedad_color_borde '=' valor_color ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | propiedad_atajo_borde '=' valor_medida BORDER_KIND valor_color ';'
        { $$ = { propiedad: $1, valor: `${$3} ${$4} ${$5}` }; }
    | BACKGROUND_COLOR '=' valor_color ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | COLOR '=' valor_color ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | TEXT_ALIGN '=' DIRECCION ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | TEXT_FONT '=' FONT_FAMILY ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    ;

/* --- RETORNO DE LOS NOMBRES DE PROPIEDAD --- */
propiedad_medida
    : HEIGHT | WIDTH | MIN_WIDTH | MAX_WIDTH | MIN_HEIGHT | MAX_HEIGHT 
    | TEXT_SIZE | BORDER_RADIUS | BORDER_WIDTH | PADDING | MARGIN 
    | PADDING_LEFT | PADDING_RIGHT | PADDING_TOP | PADDING_BOTTOM
    | MARGIN_LEFT | MARGIN_RIGHT | MARGIN_TOP | MARGIN_BOTTOM
    { $$ = $1; }
    ;

propiedad_estilo_borde
    : BORDER_STYLE | BORDER_TOP_STYLE | BORDER_RIGHT_STYLE | BORDER_BOTTOM_STYLE | BORDER_LEFT_STYLE
    { $$ = $1; }
    ;

propiedad_color_borde
    : BORDER_COLOR | BORDER_TOP_COLOR | BORDER_RIGHT_COLOR | BORDER_BOTTOM_COLOR | BORDER_LEFT_COLOR
    { $$ = $1; }
    ;

propiedad_atajo_borde
    : BORDER | BORDER_TOP | BORDER_RIGHT | BORDER_BOTTOM | BORDER_LEFT
    { $$ = $1; }
    ;

valor_medida
    : expresion_numerica { $$ = $1; }
    | PORCENTAJE         { $$ = $1; }
    ;

valor_color
    : COLOR_NAME { $$ = $1; }
    | HEX_COLOR  { $$ = $1; }
    | RGB_FUNC '(' expresion_numerica ',' expresion_numerica ',' expresion_numerica ')' 
    { 
        $$ = { 
            tipo: "rgb", 
            r: $3, 
            g: $5, 
            b: $7 
        }; 
    }
    ;

expresion_numerica
    : NUMERO       { $$ = $1; }
    | VARIABLE_FOR { $$ = $1; }
    | expresion_numerica '+' expresion_numerica { $$ = { op: '+', izq: $1, der: $3 }; }
    | expresion_numerica '-' expresion_numerica { $$ = { op: '-', izq: $1, der: $3 }; }
    | expresion_numerica '*' expresion_numerica { $$ = { op: '*', izq: $1, der: $3 }; }
    | expresion_numerica '/' expresion_numerica { $$ = { op: '/', izq: $1, der: $3 }; }
    | expresion_numerica '%' expresion_numerica { $$ = { op: '%', izq: $1, der: $3 }; }
    | '(' expresion_numerica ')' { $$ = $2; }
    | '-' expresion_numerica %prec UMINUS { $$ = { op: 'neg', der: $2 }; }
    ;

bucle_for
    : FOR VARIABLE_FOR FROM expresion_numerica tipo_rango expresion_numerica '{' cuerpo_for '}'
        { 
            $$ = { 
                tipo: 'FOR', 
                variable: $2, 
                inicio: $4, 
                fin: $6, 
                iteracion: $5, 
                cuerpo: $8 
            }; 
        }
    ;

tipo_rango
    : THROUGH { $$ = 'through'; }
    | TO      { $$ = 'to'; }
    ;

cuerpo_for
    : cuerpo_for definicion_estilo { $1.push($2); $$ = $1; }
    | /* vacío */                 { $$ = []; }
    ;
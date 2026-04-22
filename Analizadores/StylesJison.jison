/*  Archivo Jison para el analisis lexicvo y sintactico para el lenguaje de estilos*/
%{

%}

/*  Analizador lexico*/ 
%lex
%options case-sensitive

%%

/* Espacios y Comentarios */
\s+                         /* ignorar espacios */
"/*"[\s\S]*?"*/"            /* comentarios multilínea */

/* Palabras Reservadas y Estructuras */
"@for"                                                                  return 'FOR';
"from"                                                                  return 'FROM';
"through"                                                               return 'THROUGH';
"to"                                                                    return 'TO';
"extends"                                                               return 'EXTENDS';
/* Propiedades*/
"background color"                                                      return 'BACKGROUND_COLOR'; 
"text align"                                                            return 'TEXT_ALIGN'; 
"text size"                                                             return 'TEXT_SIZE'; 
"text font"                                                             return 'TEXT_FONT'; 
"border radius"                                                         return 'BORDER_RADIUS'; 
"border style"                                                          return 'BORDER_STYLE'; 
"border width"                                                          return 'BORDER_WIDTH'; 
"border color"                                                          return 'BORDER_COLOR'; 
"border top style"                                                      return 'BORDER_TOP_STYLE'; 
"height"                                                                return 'HEIGHT';
"width"                                                                 return 'WIDTH';
"min-width"                                                             return 'MIN_WIDTH';
"max-width"                                                             return 'MAX_WIDTH';
"min-height"                                                            return 'MIN_HEIGHT';
"max-height"                                                            return 'MAX_HEIGHT';
"color"                                                                 return 'COLOR';
"padding"(?:\s+(left|top|right|bottom))?    {
    if(!yytext.includes(" "))                                           return 'PADDING';
                                                                        return 'PADDING_' + yytext.split(/\s+/)[1].toUpperCase();
}
"margin"(?:\s+(left|top|right|bottom))?     {
    if(!yytext.includes(" "))                                           return 'MARGIN';
                                                                        return 'MARGIN_' + yytext.split(/\s+/)[1].toUpperCase();
}
"border"(?:\s+(top|right|bottom|left))?     {
    if(!yytext.includes(" "))                                           return 'BORDER';
                                                                        return 'BORDER_' + yytext.split(/\s+/)[1].toUpperCase();
}

/* Valores Constantes */
"CENTER"|"RIGHT"|"LEFT"                                                 return 'DIRECCION';
"HELVETICA"|"SANS SERIF"|"SANS"|"MONO"|"CURSIVE"                        return 'FONT_FAMILY'; 
"DOTTED"|"LINE"|"DOUBLE"|"solid"                                        return 'BORDER_KIND';
"blue"|"white"|"red"|"green"|"violet"|"gray"|"black"|"lightgray"        return 'COLOR_NAME';
"rgb"                                                                   return 'RGB_FUNC';
"#"([a-fA-F0-9]{3}|[a-fA-F0-9]{6})                                      return 'HEX_COLOR';

/* Símbolos y Operadores */
"{"                                                                     return '{';
"}"                                                                     return '}';
";"                                                                     return ';';
"="                                                                     return '=';
"$"                                                                     return '$';
"%"                                                                     return '%';
"("                                                                     return '(';
")"                                                                     return ')';
"*"                                                                     return '*';
"/"                                                                     return '/';
"+"                                                                     return '+';
"-"                                                                     return '-';

/* Identificadores y Números */
[0-9]+("."[0-9]+)?                                                      return 'NUMERO';
[a-zA-Z][a-zA-Z0-9-]*                                                   return 'IDENTIFICADOR';
"$"[a-zA-Z0-9_]+                                                        return 'VARIABLE_FOR';

<<EOF>>                                                                 return 'EOF';
.                                                                       { console.error('Error léxico: ' + yytext); }

/lex

/* PRECEDENCIA ARITMÉTICA */
%left '+' '-'
%left '*' '/'
%left '%'
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
    : definicion_estilo
    | bucle_for
    ;

definicion_estilo
    : nombre_clase '{' lista_atributos '}' 
    | nombre_clase EXTENDS IDENTIFICADOR '{' lista_atributos '}'
    ;

/* Permite nombres como mi-clase-$i */
nombre_clase
    : IDENTIFICADOR
    | IDENTIFICADOR '-' '$' IDENTIFICADOR 
    ;

lista_atributos
    : lista_atributos atributo
    | atributo
    | /* vacío */
    ;

atributo
    : propiedad_simple '=' expresion_numerica ';'
    | PADDING '=' expresion_numerica ';'
    | PADDING_LEFT '=' expresion_numerica ';'
    | BACKGROUND_COLOR '=' valor_color ';'
    | COLOR '=' valor_color ';'
    | TEXT_ALIGN '=' DIRECCION ';'
    | TEXT_FONT '=' FONT_FAMILY ';'
    | BORDER '=' expresion_numerica BORDER_KIND valor_color ';'
    | BORDER_RIGHT '=' expresion_numerica BORDER_KIND valor_color ';'
    /* Agregar las demás variantes de bordes y paddings siguiendo este patrón */
    ;

propiedad_simple
    : HEIGHT | WIDTH | MIN_WIDTH | MAX_WIDTH | MIN_HEIGHT | MAX_HEIGHT 
    | TEXT_SIZE | BORDER_RADIUS | BORDER_WIDTH
    ;

valor_color
    : COLOR_NAME
    | HEX_COLOR
    | RGB_FUNC '(' NUMERO ',' NUMERO ',' NUMERO ')'
    ;

expresion_numerica
    : NUMERO
    | VARIABLE_FOR
    | expresion_numerica '+' expresion_numerica
    | expresion_numerica '-' expresion_numerica
    | expresion_numerica '*' expresion_numerica
    | expresion_numerica '/' expresion_numerica
    | expresion_numerica '%'
    | '(' expresion_numerica ')'
    | '-' expresion_numerica %prec UMINUS
    ;

bucle_for
    : FOR VARIABLE_FOR FROM expresion_numerica tipo_rango expresion_numerica '{' cuerpo_for '}'
    ;

tipo_rango
    : THROUGH
    | TO
    ;

cuerpo_for
    : cuerpo_for definicion_estilo
    | definicion_estilo
    ;
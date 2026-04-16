# Itinerario — Proyecto 2 YFERA Framework

**Entrega: 07 de mayo 2026 | Inicio: 14 de abril**

---

## Semana 1 — Fundamentos y gramáticas

### Días 14–15
- [ ] Documento con todos los tokens identificados para los 4 lenguajes
- [ ] Estructura de la tabla de símbolos definida (qué guarda, cómo se accede)
- [ ] Decisión de arquitectura: cómo se integran los 4 parsers en Node
- [ ] Repositorio GitHub inicializado con estructura de carpetas base
- [ ] Tokens para `.styles`: identificadores de clase, propiedades (`height`, `width`, `color`, `margin`, etc.), valores (`px`, `%`, colores nombrados, direcciones, fuentes, estilos de borde)

### Días 16–17
- [ ] Gramática para definición de una clase simple con propiedades opcionales
- [ ] Gramática para herencia con `extends`
- [ ] Gramática para el bucle `@for` con `through` (inclusivo/exclusivo)
- [ ] Parser `.styles` funcional que recibe texto y no lanza errores en casos válidos
- [ ] Tokens para `.comp`: `component`, `FORM`, `INPUT_TEXT`, `INPUT_NUMBER`, `INPUT_BOOL`, `SUBMIT`, `IMG`, `T`, `for`, `each`, `if`, `else`, `Switch`, `case`, `default`, `empty`, `track`

### Días 18
- [ ] Gramática para definición de componente con y sin parámetros
- [ ] Gramática para secciones `[ ]` anidadas con estilos opcionales `<estilo>`
- [ ] Gramática para tablas `[[ ]]`
- [ ] Gramática para texto `T(...)` con variables `$var` y expresiones `` `expr` ``
- [ ] Gramática para imágenes `IMG` individuales y carrusel
### Dia 19
- [ ] Gramática para formularios con `INPUT_TEXT`, `INPUT_NUMBER`, `INPUT_BOOL` y `SUBMIT`
- [ ] Gramática para `for each`, `for` complejo con `track`, `if/else`, `Switch/case`
- [ ] Parser `.comp` funcional
- [ ] Tokens para DB: `TABLE`, `COLUMNS`, `DELETE`, `IN`, identificadores, tipos
- [ ] Gramática para `TABLE ... COLUMNS ...` (crear tabla)

### Día 20
- [ ] Gramática para select `tabla.columna`
- [ ] Gramática para insert `tabla[col=val, ...]`
- [ ] Gramática para update `tabla[...] IN id`
- [ ] Gramática para delete `tabla DELETE id`
- [ ] Tokens para `.y`: `import`, `int`, `float`, `string`, `boolean`, `char`, `function`, `main`, `while`, `do`, `for`, `if`, `else`, `switch`, `break`, `continue`, `execute`, `load`, `@componente`
- [ ] Gramática para imports con paths relativos
- [ ] Gramática para declaración de variables escalares y arreglos
- [ ] Gramática para funciones con cuerpo limitado a DB + `load`
- [ ] Gramática para bloque `main` con ciclos, condicionales, invocación de componentes `@comp()`
- [ ] Parser `.y` funcional

---

## Semana 2 — Backend y generación de código

### Días 21–22
- [ ] Proyecto Angular inicializado con módulo backend Node separado
- [ ] Los 4 parsers Jison integrados como módulos importables en Node
- [ ] Conexión SQLite con better-sqlite3 funcional (crear/abrir archivo `.sqlite`)
- [ ] Tabla de símbolos en memoria operativa: guardar y consultar variables, componentes, estilos

### Días 23–24
- [ ] Traducción `.styles` → CSS: cada clase genera su bloque CSS equivalente
- [ ] Traducción de `extends` → herencia correcta en CSS generado
- [ ] Traducción del `@for` de estilos → N clases CSS expandidas
- [ ] Traducción `.comp` → HTML: secciones como `<div>`, tablas como `<table>`, texto como `<p>` o `<span>`
- [ ] Traducción de `IMG` individual → `<img>` y carrusel → estructura Bootstrap carousel
- [ ] Traducción de formularios → `<form>` con inputs HTML correspondientes
- [ ] Variables `$var` en textos resueltas desde tabla de símbolos

### Días 25–26
- [ ] Resolución de `import` en `.y`: leer el archivo referenciado y parsear con el parser correcto según extensión
- [ ] Error visible si un import no existe
- [ ] Ejecución del bloque `main`: invocar componentes `@comp()` con parámetros resueltos
- [ ] Ciclos `while`, `do-while`, `for` en `.y` generan el HTML repetido correctamente
- [ ] Condicionales `if/else` en `.y` resueltos con los valores de las variables
- [ ] Reporte de errores funcional: tabla con lexema, línea, columna, tipo y descripción

### Día 27
- [ ] Consola SQL operativa: ejecutar las 5 operaciones DB y ver resultado en pantalla
- [ ] `execute` en `.y` funcional: resultado asignado a variable de tipo arreglo
- [ ] `load` funcional: recarga ejecución del archivo indicado

---

## Semana 3 — IDE y entregables

### Días 28–29
- [ ] Layout del IDE en Angular: sidebar con árbol de trabajo, área de editor, panel de output/preview
- [ ] Árbol de trabajo renderizado con carpetas y archivos, íconos por extensión (`.styles`, `.comp`, `.y`, `.sqlite`)
- [ ] Editor con Monaco integrado, pestañas por archivo abierto
- [ ] Coloreado de sintaxis en editor: operadores verde, variables blanco, strings naranja, otros literales celeste, palabras reservadas morado, llaves/corchetes/paréntesis azul

### Días 30–01 may
- [ ] Botón de indentado automático funcional para los 3 lenguajes
- [ ] Selector de colores integrado que inserta el valor en cualquier formato al código de `.styles`
- [ ] Panel de errores visible al ejecutar: tabla con lexema, línea, columna, tipo, descripción
- [ ] Botón "Ejecutar" que dispara el parser y muestra el HTML generado en panel de preview

### Días 02–03 may
- [ ] Crear nuevo proyecto: genera estructura de carpetas vacía descargable
- [ ] Abrir árbol de trabajo: cargar carpeta/zip existente en el IDE
- [ ] Exportar árbol de trabajo como zip
- [ ] Descargar HTML final generado

### Días 04–05 may
- [ ] Manual técnico: procedimiento de construcción de cada gramática, explicación de cada una, diagrama de clases
- [ ] Manual de usuario: flujo completo con capturas de pantalla
- [ ] Prueba end-to-end del flujo completo: escribir `.styles` + `.comp` + `.y` → ejecutar → ver HTML

### Día 06 may
- [ ] Buffer: corregir bugs encontrados en pruebas
- [ ] Subida final al repositorio con código fuente completo y manuales

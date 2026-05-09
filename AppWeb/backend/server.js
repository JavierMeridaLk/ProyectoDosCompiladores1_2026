'use strict';

const express      = require('express');
const cors         = require('cors');
const Motor        = require('./Clases/motor');
const DBExecutor   = require('./Clases/dbExecutor');
const TraductorDB  = require('./Clases/traductorDB');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// =======================================
// COMPILAR PROYECTO COMPLETO
// =======================================

app.post('/compile', async (req, res) => {
    try {
        const { files } = req.body;

        if (!Array.isArray(files)) {
            return res.status(400).json({ error: 'Se esperaba un array de archivos' });
        }

        const results = [];

        for (const f of files) {
            const r = await Motor.ejecutarDesdeContenido(f.path, f.content);
            results.push({ file: f.path, ...r });
        }

        res.json({ results });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================================
// EJECUTAR SQL EN LA BASE DE DATOS
// =======================================

app.post('/execute-db', async (req, res) => {
    try {
        // NOTA: 'query' ya viene con las variables interpoladas desde el frontend 
        // gracias a los template literals de JS (evaluados antes del fetch).
        const { query } = req.body;

        if (!query || !query.trim()) {
            return res.status(400).json({ ok: false, error: 'Query vacía' });
        }

        const rows = await DBExecutor.ejecutar(query);
        res.json({ ok: true, rows });

    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

// =======================================
// EXECUTE-Y — traduce sintaxis .y a SQL y ejecuta
// =======================================
// Sintaxis soportada (los $vars ya vienen interpolados por JS):
//   tabla.columna           → SELECT columna FROM tabla
//   tabla[c=v, c=v]         → INSERT INTO tabla (c,c) VALUES (v,v)
//   tabla[c=v] IN id        → UPDATE tabla SET c=v WHERE id=id
//   tabla DELETE id         → DELETE FROM tabla WHERE id=id

function _parsearAsignaciones(str) {
    const result = [];
    // Regex que respeta cadenas entre comillas
    const re = /(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^,]+?)(?:\s*,\s*(?=\w+\s*=)|$)/g;
    let m;
    while ((m = re.exec(str)) !== null) {
        result.push({ col: m[1].trim(), val: m[2].trim() });
    }
    return result;
}

function _sqlVal(v) {
    if (v === null || v === undefined || v.toLowerCase() === 'null') return 'NULL';
    if (v.toLowerCase() === 'true')  return '1';
    if (v.toLowerCase() === 'false') return '0';
    if (/^-?\d+(\.\d+)?$/.test(v))  return v;
    // Quitar comillas externas si ya las tiene
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
    }
    return `'${v.replace(/'/g, "''")}'`;
}

function traducirQueryY(q) {
    q = q.trim();

    // tabla.columna  →  SELECT columna FROM tabla
    const mSel = q.match(/^(\w+)\.(\w+)$/);
    if (mSel) return `SELECT ${mSel[2]} FROM ${mSel[1]}`;

    // tabla DELETE id  →  DELETE FROM tabla WHERE id=id
    const mDel = q.match(/^(\w+)\s+DELETE\s+(.+)$/i);
    if (mDel) return `DELETE FROM ${mDel[1]} WHERE id=${_sqlVal(mDel[2].trim())}`;

    // tabla[...] IN id  →  UPDATE
    const mUpd = q.match(/^(\w+)\[(.+)\]\s+IN\s+(\S+)$/);
    if (mUpd) {
        const sets = _parsearAsignaciones(mUpd[2])
            .map(a => `${a.col} = ${_sqlVal(a.val)}`).join(', ');
        return `UPDATE ${mUpd[1]} SET ${sets} WHERE id=${_sqlVal(mUpd[3])}`;
    }

    // tabla[...]  →  INSERT
    const mIns = q.match(/^(\w+)\[(.+)\]$/);
    if (mIns) {
        const asigs = _parsearAsignaciones(mIns[2]);
        const cols  = asigs.map(a => a.col).join(', ');
        const vals  = asigs.map(a => _sqlVal(a.val)).join(', ');
        return `INSERT INTO ${mIns[1]} (${cols}) VALUES (${vals})`;
    }

    return q; // fallback: asumir SQL puro
}

app.post('/execute-y', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query || !query.trim()) {
            return res.status(400).json({ ok: false, error: 'Query vacía' });
        }

        const sql = traducirQueryY(query);

        let rows = [];
        try {
            rows = await DBExecutor.ejecutar(sql);
        } catch (dbErr) {
            return res.json({ ok: false, sql, error: dbErr.message, rows: [] });
        }

        res.json({ ok: true, sql, rows });

    } catch (err) {
        res.status(500).json({ ok: false, error: err.message, sql: '' });
    }
});

// =======================================
// TERMINAL DB — traduce .db y ejecuta
// =======================================

app.post('/db-terminal', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query || !query.trim()) {
            return res.status(400).json({ ok: false, error: 'Query vacía' });
        }

        // Intentar traducir con el lenguaje .db
        const traduccion = await TraductorDB.analizar(query, false);
        let sql          = traduccion.sql ?? '';
        let errores      = traduccion.errores ?? [];

        // Si la traducción no produjo SQL útil (error fatal, semántico, o vacío) → SQL puro
        const sqlUtil = sql.trim() && !sql.startsWith('--');
        if (!sqlUtil) {
            sql    = query.trim();
            errores = [];
        }

        // Ejecutar el SQL
        let rows = [];
        try {
            rows = await DBExecutor.ejecutar(sql);
        } catch (dbErr) {
            return res.json({
                ok: false,
                sql,
                errores: [{ tipo: 'Ejecución', descripcion: dbErr.message, linea: 0, columna: 0 }],
                rows: []
            });
        }

        res.json({ ok: true, sql, errores, rows });

    } catch (err) {
        res.status(500).json({ ok: false, error: err.message, sql: '', errores: [], rows: [] });
    }
});

// =======================================
// VISTA PREVIA — HTML ensamblado
// =======================================

app.post('/preview', async (req, res) => {
    try {
        const { files, titulo } = req.body;

        if (!Array.isArray(files)) {
            return res.status(400).send('Se esperaba un array de archivos');
        }

        const results = [];
        for (const f of files) {
            const r = await Motor.ejecutarDesdeContenido(f.path, f.content);
            results.push({ file: f.path, ...r });
        }

        const html = Motor.ensamblarHTML(results, titulo ?? 'Proyecto LSS');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);

    } catch (err) {
        res.status(500).send(`<pre>Error al generar preview: ${err.message}</pre>`);
    }
});

// =======================================
// EXPORTAR — Carpeta de producción
// =======================================

app.post('/export', async (req, res) => {
    try {
        const { files, nombre } = req.body;

        if (!Array.isArray(files)) {
            return res.status(400).json({ ok: false, error: 'Se esperaba un array de archivos' });
        }

        const results = [];
        for (const f of files) {
            const r = await Motor.ejecutarDesdeContenido(f.path, f.content);
            results.push({ file: f.path, ...r });
        }

        const hasErrors = results.some(r => r.errores?.length > 0);
        if (hasErrors) {
            return res.json({
                ok:      false,
                error:   'El proyecto tiene errores de compilación. Corrígelos antes de exportar.',
                results
            });
        }

        // Devuelve los contenidos; el frontend los escribe en la carpeta del proyecto
        const archivos = Motor.generarArtefactos(results, nombre ?? 'proyecto');
        res.json({ ok: true, archivos });

    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.listen(3000, () => {
    console.log('Backend en http://localhost:3000');
});
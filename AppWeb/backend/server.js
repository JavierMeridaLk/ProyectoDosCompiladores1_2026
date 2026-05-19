'use strict';

const express      = require('express');
const cors         = require('cors');
const Motor        = require('./Clases/motor');
const DBExecutor   = require('./Clases/dbExecutor');
const TraductorDB  = require('./Clases/traductorDB');
const database     = require('./Clases/database');

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

        // Mapa en memoria
        const archivosEnMemoria = new Map(
            files.map(f => [f.path.replace(/\\/g, '/'), f.content])
        );

        const results = [];

        for (const f of files) {
            const r = await Motor.ejecutarDesdeContenido(f.path, f.content, archivosEnMemoria);
            results.push({ file: f.path, ...r });
        }

        res.json({ results });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ejecucion de la db

app.post('/execute-db', async (req, res) => {
    try {
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

// ttraduccin de bd en .y

app.post('/execute-y', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query || !query.trim()) {
            return res.status(400).json({ ok: false, error: 'Query vacía' });
        }

        const traduccion = await TraductorDB.analizar(query, false, database);
        let sql          = traduccion.sql ?? '';
        let errores      = traduccion.errores ?? [];

        const sqlUtil       = sql.trim() && !sql.startsWith('--');
        const tieneSemantic = errores.some(e => e.tipo === 'Semántico');

        if (!sqlUtil) {
            if (tieneSemantic) {
                const msg = errores.map(e => e.descripcion).join('; ');
                return res.json({ ok: false, sql: '', error: msg, rows: [] });
            }
            sql = query.trim();
        } else if (tieneSemantic) {
            const msg = errores
                .filter(e => e.tipo === 'Semántico')
                .map(e => e.descripcion)
                .join('; ');
            return res.json({ ok: false, sql, errores, error: msg, rows: [] });
        }

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

// logica de la terminal para la traduccion de la base de datos

app.post('/db-terminal', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query || !query.trim()) {
            return res.status(400).json({ ok: false, error: 'Query vacía' });
        }

        const traduccion = await TraductorDB.analizar(query, false, database);
        let sql          = traduccion.sql ?? '';
        let errores      = traduccion.errores ?? [];

        const sqlUtil = sql.trim() && !sql.startsWith('--');

        if (!sqlUtil || errores.length) {
            // retornar errores
            return res.json({ ok: false, sql: '', errores, rows: [] });
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

// vista previa del proyecto

app.post('/preview', async (req, res) => {
    try {
        const { files, titulo } = req.body;

        if (!Array.isArray(files)) {
            return res.status(400).send('Se esperaba un array de archivos');
        }

        const archivosEnMemoria = new Map(
            files.map(f => [f.path.replace(/\\/g, '/'), f.content])
        );

        const results = [];
        for (const f of files) {
            const r = await Motor.ejecutarDesdeContenido(f.path, f.content, archivosEnMemoria);
            results.push({ file: f.path, ...r });
        }

        const html = Motor.ensamblarHTML(results, titulo ?? 'Proyecto LSS');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);

    } catch (err) {
        res.status(500).send(`<pre>Error al generar preview: ${err.message}</pre>`);
    }
});

// caragr carpetad e archivos

app.post('/export', async (req, res) => {
    try {
        const { files, nombre } = req.body;

        if (!Array.isArray(files)) {
            return res.status(400).json({ ok: false, error: 'Se esperaba un array de archivos' });
        }

        const archivosEnMemoria = new Map(
            files.map(f => [f.path.replace(/\\/g, '/'), f.content])
        );

        const results = [];
        for (const f of files) {
            const r = await Motor.ejecutarDesdeContenido(f.path, f.content, archivosEnMemoria);
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

        const archivos = Motor.generarArtefactos(results, nombre ?? 'proyecto');
        res.json({ ok: true, archivos });

    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.listen(3000, () => {
    console.log('Backend en http://localhost:3000');
});
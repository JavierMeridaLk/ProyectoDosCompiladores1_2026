'use strict';

const express    = require('express');
const cors       = require('cors');
const Motor      = require('./Clases/motor');
const DBExecutor = require('./Clases/dbExecutor');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// =======================================
// 🚀 COMPILAR PROYECTO COMPLETO
// =======================================
// Body: { files: [{ path: string, content: string }] }
// Response: { results: [{ file, tipo, salida, errores, dbResultado? }] }
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
// 💾 EJECUTAR SQL EN LA BASE DE DATOS
// =======================================
// Body: { query: string }
// Response: { ok: true, rows: [...] } | { ok: false, error: string }
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

app.listen(3000, () => {
    console.log('🔥 Backend en http://localhost:3000');
});

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// asegurar carpeta output
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const dbPath = path.join(outputDir, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error SQLite:', err.message);
    } else {
        console.log('✅ SQLite conectado');
    }
});

module.exports = db;
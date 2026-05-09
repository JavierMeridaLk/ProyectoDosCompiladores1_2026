const db = require('./database');

class DBExecutor {

    static ejecutar(sql) {
        return new Promise((resolve, reject) => {

            const instrucciones = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            const resultados = [];

            const ejecutarSiguiente = (index) => {

                if (index >= instrucciones.length) {
                    return resolve(resultados);
                }

                const query = instrucciones[index];

                if (query.toLowerCase().startsWith('select')) {

                    db.all(query, [], (err, rows) => {
                        if (err) return reject(err);

                        resultados.push({
                            tipo: 'select',
                            resultado: rows
                        });

                        ejecutarSiguiente(index + 1);
                    });

                } else {

                    db.run(query, function (err) {
                        if (err) return reject(err);

                        resultados.push({
                            tipo: 'change',
                            changes: this.changes,
                            lastID: this.lastID
                        });

                        ejecutarSiguiente(index + 1);
                    });

                }
            };

            ejecutarSiguiente(0);
        });
    }
}

module.exports = DBExecutor;
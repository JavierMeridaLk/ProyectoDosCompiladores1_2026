const Motor = require('./motor');

(async () => {
    await Motor.ejecutar('./entrada.db');
})();
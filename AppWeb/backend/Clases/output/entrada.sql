CREATE TABLE IF NOT EXISTS pokemon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    nivel INTEGER,
    hp INTEGER,
    ataque INTEGER,
    defensa INTEGER,
    tipo TEXT,
    imagen TEXT,
    activo INTEGER
);

CREATE TABLE IF NOT EXISTS entrenador (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    medallas INTEGER,
    region TEXT,
    activo INTEGER
);

CREATE TABLE IF NOT EXISTS batalla (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entrenador_id INTEGER,
    pokemon_id INTEGER,
    resultado TEXT,
    puntos REAL,
    fecha TEXT
);

CREATE TABLE IF NOT EXISTS movimiento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pokemon_id INTEGER,
    nombre TEXT,
    poder INTEGER,
    precision INTEGER,
    tipo TEXT
);

INSERT INTO pokemon (nombre, nivel, hp, ataque, defensa, tipo, imagen, activo) VALUES ('Bulbasaur', 10, 45, 49, 49, 'Planta', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png', 1);

INSERT INTO pokemon (nombre, nivel, hp, ataque, defensa, tipo, imagen, activo) VALUES ('Charmander', 12, 39, 52, 43, 'Fuego', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png', 1);

INSERT INTO pokemon (nombre, nivel, hp, ataque, defensa, tipo, imagen, activo) VALUES ('Squirtle', 11, 44, 48, 65, 'Agua', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png', 1);

INSERT INTO pokemon (nombre, nivel, hp, ataque, defensa, tipo, imagen, activo) VALUES ('Pikachu', 25, 35, 55, 40, 'Electrico', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png', 1);

INSERT INTO pokemon (nombre, nivel, hp, ataque, defensa, tipo, imagen, activo) VALUES ('Mewtwo', 70, 106, 110, 90, 'Psiquico', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png', 0);

INSERT INTO pokemon (nombre, nivel, hp, ataque, defensa, tipo, imagen, activo) VALUES ('Snorlax', 30, 160, 110, 65, 'Normal', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/143.png', 0);

INSERT INTO entrenador (nombre, medallas, region, activo) VALUES ('Ash', 8, 'Kanto', 1);

INSERT INTO entrenador (nombre, medallas, region, activo) VALUES ('Misty', 5, 'Cerulean', 1);

INSERT INTO entrenador (nombre, medallas, region, activo) VALUES ('Brock', 10, 'Pewter', 0);

INSERT INTO batalla (entrenador_id, pokemon_id, resultado, puntos, fecha) VALUES (1, 4, 'victoria', 150.5, '2026-01-15');

INSERT INTO batalla (entrenador_id, pokemon_id, resultado, puntos, fecha) VALUES (1, 2, 'derrota', 50, '2026-01-16');

INSERT INTO batalla (entrenador_id, pokemon_id, resultado, puntos, fecha) VALUES (2, 3, 'victoria', 120.75, '2026-01-17');

INSERT INTO batalla (entrenador_id, pokemon_id, resultado, puntos, fecha) VALUES (1, 1, 'victoria', 200, '2026-01-18');

INSERT INTO movimiento (pokemon_id, nombre, poder, precision, tipo) VALUES (1, 'Placaje', 40, 100, 'Normal');

INSERT INTO movimiento (pokemon_id, nombre, poder, precision, tipo) VALUES (1, 'Latigazo', 45, 100, 'Planta');

INSERT INTO movimiento (pokemon_id, nombre, poder, precision, tipo) VALUES (2, 'Aranazo', 40, 100, 'Normal');

INSERT INTO movimiento (pokemon_id, nombre, poder, precision, tipo) VALUES (2, 'Ascuas', 40, 100, 'Fuego');

INSERT INTO movimiento (pokemon_id, nombre, poder, precision, tipo) VALUES (3, 'Placaje', 40, 100, 'Normal');

INSERT INTO movimiento (pokemon_id, nombre, poder, precision, tipo) VALUES (3, 'Pistola Agua', 40, 100, 'Agua');

INSERT INTO movimiento (pokemon_id, nombre, poder, precision, tipo) VALUES (4, 'Impactrueno', 40, 100, 'Electrico');

INSERT INTO movimiento (pokemon_id, nombre, poder, precision, tipo) VALUES (4, 'Rayo', 90, 100, 'Electrico');

INSERT INTO movimiento (pokemon_id, nombre, poder, precision, tipo) VALUES (5, 'Psiquico', 90, 100, 'Psiquico');

INSERT INTO movimiento (pokemon_id, nombre, poder, precision, tipo) VALUES (5, 'Sombra Bola', 80, 100, 'Fantasma');

SELECT nombre FROM pokemon;

SELECT nivel FROM pokemon;

SELECT tipo FROM pokemon;

SELECT imagen FROM pokemon;

SELECT activo FROM pokemon;

SELECT nombre FROM entrenador;

SELECT medallas FROM entrenador;

SELECT resultado FROM batalla;

SELECT puntos FROM batalla;

UPDATE pokemon SET nivel = 26, hp = 40 WHERE id = 4;

UPDATE pokemon SET nivel = 13, ataque = 56 WHERE id = 2;

UPDATE entrenador SET medallas = 9 WHERE id = 1;

UPDATE batalla SET puntos = 175.5 WHERE id = 1;

DELETE FROM batalla WHERE id = 2;
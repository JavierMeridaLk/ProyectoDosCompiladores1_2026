CREATE TABLE IF NOT EXISTS table_name (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    column_name TEXT,
    column2_name REAL
);

SELECT column_name FROM table_name;

INSERT INTO table_name (column_name, column2_name) VALUES ("value", 0.0);

UPDATE table_name SET column_name = "new value", column2_name = 10.10 WHERE id = 1;

DELETE FROM table_name WHERE id = 1;
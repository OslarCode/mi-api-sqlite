// src/db/sqliteClient.mjs

// Importamos sqlite3 desde el paquete instalado.
// sqlite3 trabaja con callbacks, pero lo vamos a encapsular
// para que el resto de la app no tenga que preocuparse de los detalles.
import sqlite3 from "sqlite3";

// Activamos el modo "verbose" para que sqlite3 muestre más información útil
// en caso de errores. Es muy práctico durante el desarrollo.
sqlite3.verbose();

// Definimos la ruta del archivo .db. Aquí usamos una ruta relativa:
// el archivo estará dentro de la carpeta "data" en la raíz del proyecto.
// Nota: __dirname no está disponible directamente en ES Modules, así que
// para simplificar, asumimos que el proceso se lanza desde la raíz del proyecto
// y usamos una ruta relativa simple.
const DB_PATH = "data/app.db";

// Creamos una función que devuelve una instancia de Database abierta.
// Podríamos abrir una sola conexión global, pero encapsularlo en una función
// nos da más control y claridad.
export function createDbConnection() {
  // new sqlite3.Database abre la conexión con el archivo.
  // Si el archivo no existe, sqlite3 lo creará automáticamente.
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error("Error abriendo la base de datos SQLite:", err.message);
    } else {
      console.log("Conexión SQLite abierta en", DB_PATH);
    }
  });

  return db;
}

// Esta función se encargará de ejecutar el SQL de inicialización de la base de datos.
// Su objetivo es garantizar que la tabla "users" exista antes de empezar a usar la API.
export function initializeDatabase(db) {
  // Aquí podríamos tener varias sentencias CREATE TABLE IF NOT EXISTS.
  // De momento, solo creamos una tabla "users" sencilla para el ejemplo.
  const createUsersTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `;

  // db.serialize asegura que las sentencias se ejecutan en orden.
  db.serialize(() => {
    db.run(createUsersTableSQL, (err) => {
      if (err) {
        console.error("Error creando la tabla users:", err.message);
      } else {
        console.log("Tabla users verificada/creada correctamente.");
      }
    });
  });
}
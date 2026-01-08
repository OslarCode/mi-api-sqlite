// src/db/sqliteClient.mjs

// Este módulo se encarga de:
// - Abrir la conexión con el archivo SQLite.
// - Ejecutar la inicialización de la base de datos (crear tablas si no existen).

import sqlite3 from "sqlite3";

sqlite3.verbose();

// Ruta del archivo de base de datos.
// Asumimos que el proceso se levanta desde la raíz del proyecto,
// por lo que "data/app.db" es una ruta válida.
const DB_PATH = "data/app.db";

// Crea y devuelve una nueva conexión a la base de datos.
// En este ejemplo abrimos y cerramos la conexión en cada operación
// para simplificar. Más adelante podrías refactorizarlo a un patrón
// de conexión única o un "pool" simple.
export function createDbConnection() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error("Error abriendo la base de datos SQLite:", err.message);
    } else {
      console.log("Conexión SQLite abierta en", DB_PATH);
    }
  });

  return db;
}

// Inicializa la base de datos creando las tablas necesarias si aún no existen.
// Aquí definimos tanto "users" como "user_deletions_log" para poder
// demostrar operaciones con transacciones.
export function initializeDatabase(db) {
  const createUsersTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `;

  // Tabla para registrar borrados de usuarios.
  // Cada vez que un usuario se borre, insertaremos una fila aquí dentro
  // de una transacción, para tener un historial mínimo.
  const createUserDeletionsLogTableSQL = `
    CREATE TABLE IF NOT EXISTS user_deletions_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

  db.serialize(() => {
    db.run(createUsersTableSQL, (err) => {
      if (err) {
        console.error("Error creando la tabla users:", err.message);
      } else {
        console.log("Tabla users verificada/creada correctamente.");
      }
    });

    db.run(createUserDeletionsLogTableSQL, (err) => {
      if (err) {
        console.error("Error creando la tabla user_deletions_log:", err.message);
      } else {
        console.log("Tabla user_deletions_log verificada/creada correctamente.");
      }
    });
  });
}
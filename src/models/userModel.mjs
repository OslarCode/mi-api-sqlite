// src/models/userModel.mjs

// Este módulo define las operaciones de acceso a datos para la tabla "users".
// No sabe nada de HTTP ni de rutas. Solo sabe hablar con la base de datos.

import { createDbConnection } from "../db/sqliteClient.mjs";

// Función para crear un nuevo usuario.
// Recibe un objeto con email y name, y devuelve una Promise con el nuevo usuario insertado.
export function createUser({ email, name }) {
  const db = createDbConnection();

  // Usamos la fecha actual en formato ISO sencillo.
  const createdAt = new Date().toISOString();

  const sql = `
    INSERT INTO users (email, name, created_at)
    VALUES (?, ?, ?);
  `;

  // Devolvemos una Promise para poder usar async/await en capas superiores.
  return new Promise((resolve, reject) => {
    // db.run ejecuta la sentencia. El segundo parámetro es un array de valores
    // para los placeholders "?" en el mismo orden.
    db.run(sql, [email, name, createdAt], function (err) {
      if (err) {
        // Si hay un error (por ejemplo, email duplicado), lo rechazamos.
        reject(err);
      } else {
        // this.lastID contiene el id autoincrement que SQLite asignó al nuevo registro.
        const newUser = {
          id: this.lastID,
          email,
          name,
          created_at: createdAt
        };
        resolve(newUser);
      }

      // Cerramos la conexión después de la operación para este ejemplo simple.
      // En una app real, podríamos compartir una conexión única o un pool.
      db.close();
    });
  });
}

// Función para obtener todos los usuarios.
export function getAllUsers() {
  const db = createDbConnection();

  const sql = `
    SELECT id, email, name, created_at
    FROM users
    ORDER BY id ASC;
  `;

  return new Promise((resolve, reject) => {
    // db.all devuelve todas las filas que cumplan la consulta.
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
      db.close();
    });
  });
}

// Función para obtener un usuario por id.
export function getUserById(id) {
  const db = createDbConnection();

  const sql = `
    SELECT id, email, name, created_at
    FROM users
    WHERE id = ?;
  `;

  return new Promise((resolve, reject) => {
    // db.get devuelve una sola fila (o undefined si no existe).
    db.get(sql, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
      db.close();
    });
  });
}
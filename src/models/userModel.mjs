// src/models/userModel.mjs

// Este módulo implementa todas las operaciones de acceso a datos
// relacionadas con la entidad "users" y (en una operación concreta)
// la tabla de logs "user_deletions_log".
// No sabe nada de HTTP ni de rutas; solo habla con SQLite.

import { createDbConnection } from "../db/sqliteClient.mjs";

// Crea un usuario nuevo.
export function createUser({ email, name }) {
  const db = createDbConnection();
  const createdAt = new Date().toISOString();

  const sql = `
    INSERT INTO users (email, name, created_at)
    VALUES (?, ?, ?);
  `;

  return new Promise((resolve, reject) => {
    db.run(sql, [email, name, createdAt], function (err) {
      if (err) {
        reject(err);
      } else {
        const newUser = {
          id: this.lastID,
          email,
          name,
          created_at: createdAt
        };
        resolve(newUser);
      }
      db.close();
    });
  });
}

// Obtiene todos los usuarios.
export function getAllUsers() {
  const db = createDbConnection();

  const sql = `
    SELECT id, email, name, created_at
    FROM users
    ORDER BY id ASC;
  `;

  return new Promise((resolve, reject) => {
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

// Obtiene un usuario por id.
export function getUserById(id) {
  const db = createDbConnection();

  const sql = `
    SELECT id, email, name, created_at
    FROM users
    WHERE id = ?;
  `;

  return new Promise((resolve, reject) => {
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

// Actualiza un usuario por id.
// Recibe el id y un objeto con los nuevos valores de email y name.
// Devuelve el usuario ya actualizado o null si no existía.
export function updateUser({ id, email, name }) {
  const db = createDbConnection();

  const sql = `
    UPDATE users
    SET email = ?, name = ?
    WHERE id = ?;
  `;

  return new Promise((resolve, reject) => {
    db.run(sql, [email, name, id], function (err) {
      if (err) {
        db.close();
        reject(err);
        return;
      }

      // this.changes indica cuántas filas han sido afectadas por el UPDATE.
      if (this.changes === 0) {
        db.close();
        resolve(null);
        return;
      }

      // Si se ha actualizado, ahora recuperamos la fila ya modificada.
      const selectSql = `
        SELECT id, email, name, created_at
        FROM users
        WHERE id = ?;
      `;

      db.get(selectSql, [id], (err2, row) => {
        db.close();
        if (err2) {
          reject(err2);
        } else {
          resolve(row || null);
        }
      });
    });
  });
}

// Borra un usuario por id dentro de una transacción y registra un log en user_deletions_log.
// Flujo de la transacción:
//   BEGIN
//   1) SELECT del usuario (para leer email y validar que existe)
//   2) INSERT en user_deletions_log
//   3) DELETE en users
//   COMMIT
// Si algo falla, ROLLBACK y no se borra nada.
export function deleteUserWithLog(id) {
  const db = createDbConnection();

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION;", (err) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }

        // Paso 1: leer el usuario
        const selectSql = `
          SELECT id, email, name, created_at
          FROM users
          WHERE id = ?;
        `;

        db.get(selectSql, [id], (errSelect, userRow) => {
          if (errSelect) {
            db.run("ROLLBACK;", () => {
              db.close();
              reject(errSelect);
            });
            return;
          }

          if (!userRow) {
            // El usuario no existe; deshacemos la transacción y devolvemos null.
            db.run("ROLLBACK;", () => {
              db.close();
              resolve(null);
            });
            return;
          }

          // Paso 2: insertar en el log
          const deletedAt = new Date().toISOString();

          const insertLogSql = `
            INSERT INTO user_deletions_log (user_id, email, deleted_at)
            VALUES (?, ?, ?);
          `;

          db.run(
            insertLogSql,
            [userRow.id, userRow.email, deletedAt],
            function (errInsertLog) {
              if (errInsertLog) {
                db.run("ROLLBACK;", () => {
                  db.close();
                  reject(errInsertLog);
                });
                return;
              }

              // Paso 3: borrar de users
              const deleteSql = `
                DELETE FROM users
                WHERE id = ?;
              `;

              db.run(deleteSql, [id], function (errDelete) {
                if (errDelete) {
                  db.run("ROLLBACK;", () => {
                    db.close();
                    reject(errDelete);
                  });
                  return;
                }

                // Si hemos llegado hasta aquí, todo ha ido bien.
                db.run("COMMIT;", (errCommit) => {
                  db.close();

                  if (errCommit) {
                    reject(errCommit);
                  } else {
                    // Devolvemos información del usuario borrado y el timestamp del borrado.
                    resolve({
                      deleted: true,
                      user: userRow,
                      deleted_at: deletedAt
                    });
                  }
                });
              });
            }
          );
        });
      });
    });
  });
}
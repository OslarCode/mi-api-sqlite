// src/http/server.mjs

// Este archivo arranca un servidor HTTP nativo de Node.js
// que expone una pequeña API REST para la entidad "users":
// - GET /users            -> lista todos los usuarios
// - GET /users/:id        -> obtiene un usuario por id
// - POST /users           -> crea un usuario con JSON { email, name }

import http from "http";
import { initializeDatabase, createDbConnection } from "../db/sqliteClient.mjs";
import {
  handleCreateUser,
  handleGetAllUsers,
  handleGetUserById
} from "../controllers/userController.mjs";

// Primero, nos aseguramos de que la base de datos y la tabla "users" existen.
// Para ello, abrimos una conexión temporal y llamamos a initializeDatabase.
const initDbConnection = createDbConnection();
initializeDatabase(initDbConnection);
// Cerramos la conexión de inicialización cuando termine.
// Aquí usamos un pequeño truco con setTimeout para dar tiempo a que se ejecute el CREATE TABLE.
// En un código más elaborado, podrías usar callbacks o Promises para controlar esto.
setTimeout(() => {
  initDbConnection.close();
}, 500);

// Función auxiliar para enviar respuestas JSON con un status code.
function sendJson(response, statusCode, data) {
  const json = JSON.stringify(data, null, 2);

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(json);
}

// Función auxiliar para leer el cuerpo JSON de una petición POST.
function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let bodyData = "";

    request.on("data", (chunk) => {
      bodyData += chunk.toString("utf-8");
    });

    request.on("end", () => {
      if (!bodyData) {
        resolve(null);
        return;
      }

      try {
        const parsed = JSON.parse(bodyData);
        resolve(parsed);
      } catch (err) {
        const error = new Error("El cuerpo de la petición no es JSON válido.");
        error.statusCode = 400;
        reject(error);
      }
    });

    request.on("error", (err) => {
      reject(err);
    });
  });
}

// Creamos el servidor HTTP.
const server = http.createServer(async (req, res) => {
  try {
    const { method, url } = req;

    // Ruta: GET /users
    if (method === "GET" && url === "/users") {
      const users = await handleGetAllUsers();
      sendJson(res, 200, { ok: true, data: users });
      return;
    }

    // Ruta: GET /users/:id
    // Comprobamos si la URL empieza por "/users/" y tiene algo más.
    if (method === "GET" && url.startsWith("/users/")) {
      const parts = url.split("/");
      const id = parts[2]; // /users/123 -> ["", "users", "123"]

      const user = await handleGetUserById(id);
      sendJson(res, 200, { ok: true, data: user });
      return;
    }

    // Ruta: POST /users
    if (method === "POST" && url === "/users") {
      const body = await parseRequestBody(req);
      const newUser = await handleCreateUser(body);
      sendJson(res, 201, { ok: true, data: newUser });
      return;
    }

    // Si ninguna ruta coincide, devolvemos 404.
    sendJson(res, 404, { ok: false, error: "Ruta no encontrada" });
  } catch (err) {
    // Manejo de errores centralizado.
    console.error("Error en la petición:", err);

    const statusCode = err.statusCode || 500;
    sendJson(res, statusCode, {
      ok: false,
      error: err.message || "Error interno del servidor"
    });
  }
});

// Arrancamos el servidor en un puerto fijo, por ejemplo 3000.
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor HTTP escuchando en http://localhost:${PORT}`);
});

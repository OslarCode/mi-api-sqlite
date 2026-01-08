// src/http/server.mjs

// Este archivo levanta un servidor HTTP "nativo" de Node.js sin usar Express.
// Expone una pequeña API REST para gestionar usuarios ("users").
// Endpoints previstos:
// - GET    /users           -> lista todos los usuarios
// - GET    /users/:id       -> obtiene un usuario por id
// - POST   /users           -> crea un usuario
// - PUT    /users/:id       -> actualiza un usuario existente
// - DELETE /users/:id       -> borra un usuario con registro en log (dentro de una transacción)

import http from "http";
import { initializeDatabase, createDbConnection } from "../db/sqliteClient.mjs";
import {
  handleCreateUser,
  handleGetAllUsers,
  handleGetUserById,
  handleUpdateUser,
  handleDeleteUser
} from "../controllers/userController.mjs";

// Antes de arrancar el servidor, inicializamos la base de datos.
// La idea es:
//   1. Abrir una conexión temporal con createDbConnection().
//   2. Ejecutar initializeDatabase(connection) para crear tablas, índices, etc. si no existen.
//   3. Cerrar esa conexión una vez terminada la inicialización.
//
// Esto suele leer y ejecutar un fichero schema.sql, o crear tablas "al vuelo" en SQLite.
const initDbConnection = createDbConnection();
initializeDatabase(initDbConnection);

// Cerramos la conexión de inicialización tras un pequeño retraso.
// Este setTimeout es una forma sencilla de asegurarnos de que
// initializeDatabase ha terminado antes de cerrar la conexión.
// En un código más robusto, sería mejor esperar a una promesa o callback.
setTimeout(() => {
  initDbConnection.close();
}, 500);

// Función auxiliar para enviar una respuesta JSON uniforme.
// Recibe:
//   - response: el objeto http.ServerResponse de Node.
//   - statusCode: el código HTTP a devolver (200, 201, 400, 500, etc.).
//   - data: cualquier objeto JavaScript que se convertirá a JSON.
//
// Esta función centraliza:
//   - La conversión a JSON (JSON.stringify).
//   - La cabecera Content-Type.
//   - El cierre de la respuesta.
function sendJson(response, statusCode, data) {
  // Convertimos el objeto JS a cadena JSON, con sangría de 2 espacios para que sea legible.
  const json = JSON.stringify(data, null, 2);

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  // Enviamos el cuerpo y cerramos la respuesta.
  response.end(json);
}

// Función auxiliar para leer y parsear el cuerpo JSON de una petición HTTP.
// Como Node nativo trabaja con streams, aquí convertimos los "chunks" en una cadena completa.
// Devuelve una Promise que se resuelve con:
//   - el objeto parseado si el cuerpo es JSON válido,
//   - null si no hay cuerpo,
// o se rechaza con un Error (statusCode 400) si el JSON es inválido.
function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let bodyData = "";

    // El evento "data" se dispara cada vez que llega un fragmento de cuerpo.
    request.on("data", (chunk) => {
      // Vamos concatenando todos los trozos en una sola cadena.
      bodyData += chunk.toString("utf-8");
    });

    // El evento "end" indica que ya no quedan más datos por leer.
    request.on("end", () => {
      // Si no llegó ningún cuerpo (por ejemplo, en una petición sin body),
      // devolvemos null para indicar "no hay datos".
      if (!bodyData) {
        resolve(null);
        return;
      }

      try {
        // Intentamos interpretar la cadena como JSON.
        const parsed = JSON.parse(bodyData);
        resolve(parsed);
      } catch (err) {
        // Si JSON.parse falla, creamos un error específico.
        const error = new Error("El cuerpo de la petición no es JSON válido.");
        error.statusCode = 400; // Bad Request: el cliente envía un cuerpo mal formado.
        reject(error);
      }
    });

    // Si ocurre un error de stream en la propia petición, rechazamos la promesa.
    request.on("error", (err) => {
      reject(err);
    });
  });
}

// Servidor HTTP principal.
// http.createServer recibe una función callback que se ejecuta en cada petición.
// En este callback:
//   - Leemos el método (GET, POST, etc.) y la URL.
//   - Comprobamos qué ruta y método se están usando.
//   - Llamamos al controlador correspondiente (capa intermedia entre HTTP y modelo).
//   - Devolvemos una respuesta JSON uniforme.
//
// El callback se marca como async para poder usar await con los controladores y parseRequestBody.
const server = http.createServer(async (req, res) => {
  try {
    const { method, url } = req;

    // Ruta: GET /users
    // Devuelve un listado de todos los usuarios.
    if (method === "GET" && url === "/users") {
      // Llamamos al controlador, que hablará con la base de datos.
      const users = await handleGetAllUsers();
      // Envolvemos la respuesta en un objeto con ok: true y data: ...
      sendJson(res, 200, { ok: true, data: users });
      return;
    }

    // Ruta: GET /users/:id
    // Ejemplo de URL: /users/3
    // Aquí no usamos un router sofisticado; simplemente partimos la URL por "/".
    if (method === "GET" && url.startsWith("/users/")) {
      const parts = url.split("/");
      // parts[0] = "" (antes del primer /)
      // parts[1] = "users"
      // parts[2] = ":id"
      const id = parts[2];

      // Delegamos la lógica de validación del id y la búsqueda en el controlador.
      const user = await handleGetUserById(id);
      sendJson(res, 200, { ok: true, data: user });
      return;
    }

    // Ruta: POST /users
    // Crea un nuevo usuario. Espera un JSON en el body con al menos "email" y "name".
    if (method === "POST" && url === "/users") {
      // Leemos el cuerpo JSON de la petición.
      const body = await parseRequestBody(req);
      // El controlador valida los campos y llama al modelo para insertar en la base de datos.
      const newUser = await handleCreateUser(body);
      // 201 Created: indica que hemos creado un nuevo recurso.
      sendJson(res, 201, { ok: true, data: newUser });
      return;
    }

    // Ruta: PUT /users/:id
    // Actualiza completamente un usuario (email y name).
    // Este endpoint asume un "replace" de los datos principales, no una actualización parcial.
    if (method === "PUT" && url.startsWith("/users/")) {
      const parts = url.split("/");
      const id = parts[2];

      // Leemos el body, que debería contener los campos a actualizar.
      const body = await parseRequestBody(req);
      // El controlador se encarga de validar id + body y de llamar al modelo.
      const updatedUser = await handleUpdateUser(id, body);
      sendJson(res, 200, { ok: true, data: updatedUser });
      return;
    }

    // Ruta: DELETE /users/:id
    // Borra un usuario y, a la vez, registra el borrado en una tabla de logs dentro de una transacción.
    if (method === "DELETE" && url.startsWith("/users/")) {
      const parts = url.split("/");
      const id = parts[2];

      // El controlador se ocupa de validar el id y ejecutar la transacción de borrado + log.
      const result = await handleDeleteUser(id);
      sendJson(res, 200, { ok: true, data: result });
      return;
    }

    // Si no coincide ninguna de las rutas anteriores, respondemos con 404.
    // Esto actúa como "catch-all" de rutas no definidas.
    sendJson(res, 404, { ok: false, error: "Ruta no encontrada" });
  } catch (err) {
    // Cualquier error no controlado en el flujo de arriba acaba aquí.
    // Puede ser:
    //   - un Error lanzado por los controladores (con statusCode 400, 404, etc.),
    //   - un error inesperado (consultas a BD, bugs de código, etc.).
    console.error("Error en la petición:", err);

    // Si el error tiene un statusCode (puesto por los controladores), lo usamos.
    // Si no, asumimos 500 (Internal Server Error).
    const statusCode = err.statusCode || 500;

    sendJson(res, statusCode, {
      ok: false,
      // Si hay un mensaje específico, lo devolvemos; si no, mostramos un mensaje genérico.
      error: err.message || "Error interno del servidor"
    });
  }
});

// Definimos el puerto donde escuchará el servidor HTTP.
// 3000 es típico para desarrollo (por ejemplo, http://localhost:3000).
const PORT = 3000;

// Ponemos el servidor a escuchar. El callback se ejecuta una vez que el servidor está listo.
// Este console.log es solo para ver en la consola que todo ha arrancado correctamente.
server.listen(PORT, () => {
  console.log(`Servidor HTTP escuchando en http://localhost:${PORT}`);
});
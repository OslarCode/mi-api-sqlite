// src/controllers/userController.mjs

// Este módulo forma parte de la "capa de controladores" de tu aplicación.
// Su responsabilidad principal es:
// 1. Recibir datos "sucios" que vienen de la capa HTTP (por ejemplo, del body de una petición o de params).
// 2. Validar y transformar esos datos (tipos, rangos, campos obligatorios).
// 3. Llamar a las funciones del modelo (userModel.mjs), que son las que hablan con la base de datos.
// 4. Traducir los errores de validación a objetos Error con un statusCode apropiado,
//    para que la capa HTTP (por ejemplo, server.mjs) pueda responder con el código HTTP correcto.

// Importamos las funciones del modelo de usuarios.
// Estas funciones son las que ejecutan consultas a la base de datos o realizan operaciones de negocio.
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUserWithLog
} from "../models/userModel.mjs";

// Crear un usuario nuevo a partir de un body JSON.
// Esta función NO sabe nada de HTTP directamente: solo recibe un "body" ya parseado (por ejemplo, desde server.mjs).
// La idea es que server.mjs se encargue de:
//   - Leer la petición HTTP.
//   - Parsear el JSON del body.
//   - Llamar a handleCreateUser(body).
// Si hay algún problema de validación, lanzamos un Error con statusCode 400 (Bad Request),
// y será la capa HTTP quien lo convierta en una respuesta HTTP.
export async function handleCreateUser(body) {
  // Validamos que el body exista y que tenga email y name como cadenas.
  // Esta validación es muy básica, pero suficiente para demostrar la intención del controlador:
  // asegurarse de que al modelo solo le llegan datos coherentes.
  if (!body || typeof body.email !== "string" || typeof body.name !== "string") {
    const error = new Error("Datos inválidos. Se requieren 'email' y 'name' como cadenas.");
    // Adjuntamos un statusCode personalizado al Error.
    // Más adelante, en server.mjs, podrás leer error.statusCode y devolver ese código HTTP.
    error.statusCode = 400;
    // Al lanzar el error, la promesa se rechaza y el flujo de ejecución pasa al catch de la capa superior.
    throw error;
  }

  // Si los datos son válidos, delegamos la creación real del usuario al modelo.
  // Aquí no se decide cómo se inserta en la base de datos; eso lo hace createUser.
  const newUser = await createUser({
    email: body.email,
    name: body.name
  });

  // Devolvemos el usuario creado. La capa HTTP se encargará de serializarlo a JSON y enviarlo al cliente.
  return newUser;
}

// Obtener todos los usuarios.
// Esta función es muy sencilla: no hay parámetros que validar, simplemente llama al modelo.
// Aun así, la mantenemos en la capa de controladores para ser consistentes con el resto
// y para tener un punto donde, en el futuro, podamos aplicar filtros, paginación, etc.
export async function handleGetAllUsers() {
  const users = await getAllUsers();
  // Devolvemos el array de usuarios tal cual nos lo entrega el modelo.
  return users;
}

// Obtener un usuario por id.
// Aquí sí hay lógica de validación porque el id normalmente viene como string (por ejemplo, de la URL).
// Responsabilidades:
//   1. Convertir el parámetro id (string) a número.
//   2. Comprobar que es un entero positivo.
//   3. Pedir al modelo que busque ese usuario.
//   4. Si no existe, lanzar un error 404.
export async function handleGetUserById(idParam) {
  // Convertimos el parámetro (que probablemente llega como string) a número.
  const idNumber = Number(idParam);

  // Comprobamos que idNumber es un entero y mayor que 0.
  // Esto evita consultas absurdas a la base de datos y nos da errores más claros.
  if (!Number.isInteger(idNumber) || idNumber <= 0) {
    const error = new Error("El parámetro 'id' debe ser un entero positivo.");
    error.statusCode = 400; // Bad Request, porque el cliente envió un parámetro inválido.
    throw error;
  }

  // Si el id es válido, pedimos el usuario al modelo.
  const user = await getUserById(idNumber);

  // Si el modelo devuelve null/undefined, significa que no existe un usuario con ese id.
  if (!user) {
    const error = new Error("Usuario no encontrado.");
    // 404 indica que el recurso solicitado no existe.
    error.statusCode = 404;
    throw error;
  }

  // Si todo va bien, devolvemos el usuario encontrado.
  return user;
}

// Actualizar un usuario por id con datos del body JSON.
// Esta función combina las dos validaciones anteriores:
//   - Validar el id (como en handleGetUserById).
//   - Validar los campos del body (como en handleCreateUser).
// Luego llama al modelo para hacer el update y gestiona el caso de "usuario no encontrado".
export async function handleUpdateUser(idParam, body) {
  // Primero, validamos el id.
  const idNumber = Number(idParam);

  if (!Number.isInteger(idNumber) || idNumber <= 0) {
    const error = new Error("El parámetro 'id' debe ser un entero positivo.");
    error.statusCode = 400;
    throw error;
  }

  // Después, validamos el body (igual que al crear un usuario).
  if (!body || typeof body.email !== "string" || typeof body.name !== "string") {
    const error = new Error("Datos inválidos. Se requieren 'email' y 'name' como cadenas.");
    error.statusCode = 400;
    throw error;
  }

  // Si todo es válido, delegamos en el modelo la actualización real.
  // El modelo decidirá cómo construir y ejecutar la sentencia SQL.
  const updatedUser = await updateUser({
    id: idNumber,
    email: body.email,
    name: body.name
  });

  // Si el modelo devuelve algo "falsy" (por ejemplo, null),
  // interpretamos que el usuario con ese id no existía y no se ha podido actualizar.
  if (!updatedUser) {
    const error = new Error("Usuario no encontrado para actualizar.");
    error.statusCode = 404;
    throw error;
  }

  // Si se ha actualizado correctamente, devolvemos el usuario modificado.
  return updatedUser;
}

// Borrar un usuario por id usando una transacción con log de borrado.
// Aquí suponemos que deleteUserWithLog realiza dos cosas en una sola transacción:
//   1. Borrar el usuario de la tabla principal.
//   2. Insertar un registro en una tabla de logs (por ejemplo, "deleted_users_log").
// De nuevo, la capa de controlador se ocupa de validar id y traducir el caso "no existe" a un error 404.
export async function handleDeleteUser(idParam) {
  // Validación del id, igual que en las otras funciones.
  const idNumber = Number(idParam);

  if (!Number.isInteger(idNumber) || idNumber <= 0) {
    const error = new Error("El parámetro 'id' debe ser un entero positivo.");
    error.statusCode = 400;
    throw error;
  }

  // Llamamos al modelo para ejecutar la lógica de borrado con log.
  // La función del modelo debería encargarse de la transacción (BEGIN/COMMIT/ROLLBACK)
  // y devolver algo que indique si se borró o no realmente el usuario.
  const result = await deleteUserWithLog(idNumber);

  // Si result es falsy, entendemos que no se ha encontrado el usuario a borrar.
  if (!result) {
    const error = new Error("Usuario no encontrado para borrar.");
    error.statusCode = 404;
    throw error;
  }

  // Devolvemos el resultado (por ejemplo, información del usuario borrado o un objeto con metadatos).
  return result;
}
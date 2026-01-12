// src/controllers/userController.mjs

// Este módulo actúa como capa intermedia entre el servidor HTTP
// y el modelo de datos. Se encarga de:
// - Validar datos básicos.
// - Llamar al modelo adecuado.
// - Decidir qué devolver al servidor (objeto, error, etc.).

import {
  createUser,
  getAllUsers,
  getUserById
} from "../models/userModel.mjs";

// Crear un usuario a partir de un cuerpo JSON.
export async function handleCreateUser(body) {
  // Validación muy básica.
  if (!body || typeof body.email !== "string" || typeof body.name !== "string") {
    // Lanzamos un error que luego el servidor traducirá a 400 Bad Request.
    const error = new Error("Datos inválidos. Se requieren 'email' y 'name' como cadenas.");
    error.statusCode = 400;
    throw error;
  }

  // Podrías añadir más validaciones (formato de email, longitud, etc.).
  const newUser = await createUser({
    email: body.email,
    name: body.name
  });

  return newUser;
}

// Obtener todos los usuarios.
export async function handleGetAllUsers() {
  const users = await getAllUsers();
  return users;
}

// Obtener un usuario por id (recibido como string en la URL).
export async function handleGetUserById(idParam) {
  const idNumber = Number(idParam);

  if (!Number.isInteger(idNumber) || idNumber <= 0) {
    const error = new Error("El parámetro 'id' debe ser un entero positivo.");
    error.statusCode = 400;
    throw error;
  }

  const user = await getUserById(idNumber);

  if (!user) {
    const error = new Error("Usuario no encontrado.");
    error.statusCode = 404;
    throw error;
  }

  return user;
}


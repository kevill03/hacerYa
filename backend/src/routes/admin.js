import { Router } from "express";
import { verifyToken, adminOnly } from "../middleware/auth.js";
import * as StatsModel from "../../models/statistics.js";
import bcrypt from "bcryptjs";
import * as UserAdminModel from "../../models/userAdmin.js";
const router = Router();

//En este fichero al ser adminsitrativo Aplicamos ambos middlewares a TODAS las rutas en este archivo.
// Nadie que no sea admin podrá acceder a /api/admin/*
router.use(verifyToken, adminOnly);

// --- RUTAS DEL DASHBOARD ---

// GET /api/admin/kpis
router.get("/kpis", async (req, res) => {
  try {
    const kpis = await StatsModel.getDashboardKPIs();
    res.json(kpis);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener KPIs", error: error.message });
  }
});

// GET /api/admin/tasks-by-status
router.get("/tasks-by-status", async (req, res) => {
  try {
    const data = await StatsModel.getTasksByStatus();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener tareas por estado",
      error: error.message,
    });
  }
});

// GET /api/admin/tasks-per-project
router.get("/tasks-per-project", async (req, res) => {
  try {
    const data = await StatsModel.getTasksPerProject();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener tareas por proyecto",
      error: error.message,
    });
  }
});

// GET /api/admin/active-users
router.get("/active-users", async (req, res) => {
  try {
    const data = await StatsModel.getActiveUsers();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener usuarios activos",
      error: error.message,
    });
  }
});

//Rutas para la gestion de usuarios

// RUTA 1: OBTENER TODOS LOS USUARIOS
// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const users = await UserAdminModel.getAllUsers();
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener usuarios", error: error.message });
  }
});

// RUTA 2: ACTUALIZAR ESTADO (BLOQUEAR/ACTIVAR)
// PUT /api/admin/users/:id/status
router.put("/users/:id/status", async (req, res) => {
  const { id: userIdToUpdate } = req.params;
  const { newStatus } = req.body;
  const actorId = req.userId; // ID del admin que hace la acción

  // Validación
  if (!["active", "blocked"].includes(newStatus)) {
    return res
      .status(400)
      .json({ message: "Estado no válido. Debe ser 'active' o 'blocked'." });
  }

  try {
    await UserAdminModel.updateUserStatus(userIdToUpdate, newStatus, actorId);
    res.json({ message: `Usuario actualizado a ${newStatus}.` });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al actualizar estado", error: error.message });
  }
});

// RUTA 3: ACTUALIZAR DETALLES (NOMBRE, EMAIL, ROL)
// PUT /api/admin/users/:id/details
router.put("/users/:id/details", async (req, res) => {
  const { id: userIdToUpdate } = req.params;
  const { fullName, email, role } = req.body;
  const actorId = req.userId;

  // Validación
  if (!fullName || !email || !role) {
    return res
      .status(400)
      .json({ message: "fullName, email y role son obligatorios." });
  }
  if (!["admin", "user"].includes(role)) {
    return res
      .status(400)
      .json({ message: "Rol no válido. Debe ser 'admin' o 'user'." });
  }

  try {
    await UserAdminModel.updateUserDetails(
      userIdToUpdate,
      { fullName, email, role },
      actorId
    );
    res.json({ message: "Detalles del usuario actualizados." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al actualizar detalles", error: error.message });
  }
});

// RUTA 4: CAMBIAR CONTRASEÑA
// PUT /api/admin/users/:id/password
router.put("/users/:id/password", async (req, res) => {
  const { id: userIdToUpdate } = req.params;
  const { newPassword } = req.body;
  const actorId = req.userId;

  // Validación
  if (!newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "La contraseña debe tener al menos 6 caracteres." });
  }

  try {
    // Hashear la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await UserAdminModel.updateUserPassword(
      userIdToUpdate,
      passwordHash,
      actorId
    );
    res.json({ message: "Contraseña del usuario actualizada." });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error al cambiar la contraseña",
        error: error.message,
      });
  }
});

export default router;

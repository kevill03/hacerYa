import { Router } from "express";
import { verifyToken, adminOnly } from "../middleware/auth.js";
import * as StatsModel from "../../models/statistics.js";

const router = Router();

// ¡CLAVE! Aplicamos ambos middlewares a TODAS las rutas en este archivo.
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

export default router;

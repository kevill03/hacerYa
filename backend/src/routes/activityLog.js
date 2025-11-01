import { Router } from "express";
// Importamos TUS middlewares existentes
import { verifyToken, adminOnly } from "../middleware/auth.js"; // Ajusta la ruta a tu auth.js
import * as ActivityLogModel from "../../models/activityLog.js"; // Ajusta la ruta

const router = Router();

// ----------------------------------------------------------------------
// RUTA: OBTENER BITÁCORA GLOBAL (GET /activity-log)
// ----------------------------------------------------------------------
// Usamos tu cadena de middlewares:
// 1. verifyToken (autentica al usuario)
// 2. adminOnly (autoriza SÓLO si es admin)
//
router.get("/", [verifyToken, adminOnly], async (req, res) => {
  try {
    const logs = await ActivityLogModel.getGlobalActivityLog();
    res.json(logs);
  } catch (error) {
    console.error("Error al obtener la bitácora global:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

export default router;

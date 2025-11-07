import { Router } from "express";
import { verifyToken, adminOnly } from "../middleware/auth.js";
import * as ActivityLogModel from "../../models/activityLog.js";

const router = Router();

// ----------------------------------------------------------------------
// RUTA: OBTENER BITÁCORA GLOBAL (GET /activity-log)
// ----------------------------------------------------------------------
// 1. verifyToken (autentica al usuario)
// 2. adminOnly (autoriza SÓLO si es admin)
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

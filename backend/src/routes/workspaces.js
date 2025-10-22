import { Router } from "express";
import * as WorkspaceModel from "../../models/workspace.js"; // Ruta corregida
import { verifyToken } from "../middleware/auth.js";

const router = Router();

// Middleware de autenticación: Aplica protección a todas las rutas
router.use(verifyToken);

// ----------------------------------------------------------------------
// RUTA 1: OBTENER TODOS LOS WORKSPACES DEL USUARIO (GET /workspaces)
// ----------------------------------------------------------------------
router.get("/", async (req, res) => {
  const userId = req.userId;
  try {
    const workspaces = await WorkspaceModel.getAllWorkspacesByUserId(userId);
    return res.json(workspaces);
  } catch (error) {
    console.error("Error al obtener workspaces:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al listar workspaces." });
  }
});

// ----------------------------------------------------------------------
// RUTA 2: CREAR UN NUEVO WORKSPACE (POST /workspaces)
// ----------------------------------------------------------------------
router.post("/", async (req, res) => {
  const { name, description } = req.body;
  const created_by = req.userId; // Creador es el usuario autenticado

  if (!name) {
    return res
      .status(400)
      .json({ message: "El nombre del workspace es obligatorio." });
  }

  try {
    const newWorkspace = await WorkspaceModel.createWorkspace({
      name,
      description,
      created_by,
    });
    return res.status(201).json(newWorkspace);
  } catch (error) {
    console.error("Error al crear workspace:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al crear workspace." });
  }
});

// ----------------------------------------------------------------------
// RUTA 3: OBTENER WORKSPACE POR ID (GET /workspaces/:id)
// ----------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const workspace = await WorkspaceModel.getWorkspaceById(id, userId);

    if (!workspace) {
      return res
        .status(404)
        .json({ message: "Workspace no encontrado o acceso denegado." });
    }
    return res.json(workspace);
  } catch (error) {
    console.error("Error al obtener workspace por ID:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
});

// ----------------------------------------------------------------------
// RUTA 4: ACTUALIZAR WORKSPACE (PUT /workspaces/:id)
// ----------------------------------------------------------------------
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const userId = req.userId; // ID del usuario que intenta actualizar

  try {
    const updatedWorkspace = await WorkspaceModel.updateWorkspace(
      id,
      data,
      userId
    );

    if (updatedWorkspace.rowCount === 0) {
      return res.status(404).json({
        message:
          "Workspace no encontrado o no tienes permiso para actualizarlo.",
      });
    }
    return res.json({ message: "Workspace actualizado con éxito." });
  } catch (error) {
    console.error("Error al actualizar workspace:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al actualizar workspace." });
  }
});

// ----------------------------------------------------------------------
// RUTA 5: ELIMINAR WORKSPACE (DELETE /workspaces/:id)
// ----------------------------------------------------------------------
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.userId; // ID del usuario que intenta eliminar

  try {
    const result = await WorkspaceModel.deleteWorkspace(id, userId);

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Workspace no encontrado o no tienes permiso para eliminarlo.",
      });
    }
    return res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar workspace:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al eliminar workspace." });
  }
});

export default router;

import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as CommentModel from "../../models/comments.js";
import * as ProjectModel from "../../models/project.js"; // Para el helper de permisos
import { pool } from "../db.js"; // Para buscar el proyecto de la tarea

//mergeParams: true permite a este router acceder a /projects/:id/tasks/:taskId
const router = Router({ mergeParams: true });

// Proteger todas las rutas de comentarios
router.use(verifyToken);

// --- Helper rápido para verificar permisos ---
// (Verifica que el usuario sea miembro del proyecto al que pertenece la tarea)
const checkPermission = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const actorId = req.userId;

    // 1. Encontrar a qué proyecto pertenece la tarea
    const taskRes = await pool.query(
      "SELECT project_id FROM tasks WHERE id = $1",
      [taskId]
    );
    if (taskRes.rowCount === 0) {
      return res.status(404).json({ message: "Tarea no encontrada." });
    }
    const { project_id } = taskRes.rows[0];

    // 2. Verificar si el usuario es miembro de ese proyecto
    // (Usamos la función que ya existe en models/project.js)
    const isMember = await ProjectModel.isProjectMember(project_id, actorId);

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "Acceso denegado a los comentarios de esta tarea." });
    }

    // Si tiene permiso, guardamos el project_id para los logs y continuamos
    req.projectId = project_id;
    next();
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error de permisos", error: error.message });
  }
};

// ----------------------------------------------------------------------
// RUTA 1: OBTENER TODOS LOS COMENTARIOS (GET /projects/:id/tasks/:taskId/comments)
// ----------------------------------------------------------------------
router.get("/", [checkPermission], async (req, res) => {
  const { taskId } = req.params;
  try {
    const comments = await CommentModel.getCommentsByTaskId(taskId);
    res.json(comments);
  } catch (error) {
    console.error("Error al obtener comentarios:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// ----------------------------------------------------------------------
// RUTA 2: AÑADIR UN COMENTARIO (POST /projects/:id/tasks/:taskId/comments)
// ----------------------------------------------------------------------
router.post("/", [checkPermission], async (req, res) => {
  const { taskId } = req.params;
  const actorId = req.userId;
  const { content } = req.body;

  if (!content || content.trim() === "") {
    return res
      .status(400)
      .json({ message: "El contenido del comentario no puede estar vacío." });
  }

  try {
    const newComment = await CommentModel.createComment(
      taskId,
      actorId,
      content
    );
    // Devolvemos 201 y el nuevo comentario (que ya incluye el nombre del autor)
    res.status(201).json(newComment);
  } catch (error) {
    console.error("Error al crear comentario:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

export default router;

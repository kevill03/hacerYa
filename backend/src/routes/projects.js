import { Router } from "express";
// CORRECCIÓN CRÍTICA: Se cambia la ruta relativa de '../models/project.js'
// a '../../models/project.js' para llegar desde src/routes/ hasta backend/models/
import * as ProjectModel from "../../models/project.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

// Middleware de autenticación: Aplica protección a todas las rutas de proyectos
router.use(verifyToken);

// --- RUTAS DE PROYECTOS PROTEGIDAS ---

// GET /api/projects
// Obtener todos los proyectos del usuario (personales + donde es miembro)
router.get("/", async (req, res) => {
  // req.userId fue adjuntado por verifyToken
  try {
    const userId = req.userId;
    const projects = await ProjectModel.getAllProjectsByUserId(userId);
    return res.json(projects);
  } catch (error) {
    console.error("Error al obtener proyectos:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al listar proyectos." });
  }
});

// GET /api/projects/:id
// Obtener un proyecto específico por ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const project = await ProjectModel.getProjectById(id, userId);

    if (!project) {
      return res
        .status(404)
        .json({ message: "Proyecto no encontrado o acceso denegado." });
    }
    return res.json(project);
  } catch (error) {
    console.error("Error al obtener proyecto por ID:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
});

// POST /api/projects
// Crear un nuevo proyecto
router.post("/", async (req, res) => {
  const { name, description, workspace_id, is_personal } = req.body;
  const created_by = req.userId; // Creador es el usuario autenticado

  if (!name) {
    return res
      .status(400)
      .json({ message: "El nombre del proyecto es obligatorio." });
  }

  try {
    const newProject = await ProjectModel.createProject({
      name,
      description,
      workspace_id,
      created_by,
      is_personal,
    });
    return res.status(201).json(newProject);
  } catch (error) {
    console.error("Error al crear proyecto:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al crear proyecto." });
  }
});

// PUT /api/projects/:id
// Actualizar un proyecto existente
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const userId = req.userId; // ID del usuario que intenta actualizar

  try {
    const updatedProject = await ProjectModel.updateProject(id, data, userId);

    if (updatedProject.rowCount === 0) {
      // El proyecto no existe, o el usuario no tiene permisos (es importante la lógica del modelo)
      return res.status(404).json({
        message:
          "Proyecto no encontrado o no tienes permiso para actualizarlo.",
      });
    }
    return res.json({ message: "Proyecto actualizado con éxito." });
  } catch (error) {
    console.error("Error al actualizar proyecto:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al actualizar proyecto." });
  }
});

// DELETE /api/projects/:id
// Eliminar un proyecto existente
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.userId; // ID del usuario que intenta eliminar

  try {
    const result = await ProjectModel.deleteProject(id, userId);

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Proyecto no encontrado o no tienes permiso para eliminarlo.",
      });
    }
    // Retornamos 204 No Content para indicar que la eliminación fue exitosa sin retornar cuerpo.
    return res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar proyecto:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor al eliminar proyecto." });
  }
});

export default router;

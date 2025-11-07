import { Router } from "express";
import * as TaskModel from "../../models/task.js";
import { verifyToken } from "../middleware/auth.js";
import * as ProjectModel from "../../models/project.js";
import commentsRouter from "./comments.js";
// mergeParams: true permite a este router acceder al :id de /projects/:id
const router = Router({ mergeParams: true });

// Proteger todas las rutas de tareas
router.use(verifyToken);

// ----------------------------------------------------------------------
// RUTA 1: OBTENER TODAS LAS TAREAS DEL PROYECTO (GET /projects/:id/tasks)
// ----------------------------------------------------------------------
router.get("/", async (req, res) => {
  const { id: projectId } = req.params; // 'id' es el projectId gracias a mergeParams
  const actorId = req.userId;

  try {
    const tasks = await TaskModel.getTasksByProjectId(projectId, actorId);

    // El modelo devuelve 'null' si el actor no es miembro del proyecto
    if (tasks === null) {
      return res.status(403).json({
        message: "Acceso denegado. No eres miembro de este proyecto.",
      });
    }

    res.json(tasks);
  } catch (error) {
    console.error("Error al obtener tareas:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// ----------------------------------------------------------------------
// RUTA 2: CREAR UNA NUEVA TAREA (POST /projects/:id/tasks)
// ----------------------------------------------------------------------
router.post("/", async (req, res) => {
  const { id: projectId } = req.params;
  const actorId = req.userId;
  const taskData = req.body;

  if (!taskData.title) {
    return res
      .status(400)
      .json({ message: "El título de la tarea es obligatorio." });
  }

  try {
    // Añadimos el project_id (de la URL) a los datos de la tarea
    const dataToCreate = {
      ...taskData,
      project_id: projectId,
    };

    const newTask = await TaskModel.createTask(dataToCreate, actorId);
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Error al crear tarea:", error);
    // Manejar el error de permiso específico del modelo
    if (error.message.includes("Permiso denegado")) {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// ----------------------------------------------------------------------
// RUTA 3: OBTENER UNA TAREA ESPECÍFICA (GET /projects/:id/tasks/:taskId)
// ----------------------------------------------------------------------
router.get("/:taskId", async (req, res) => {
  const { taskId } = req.params;
  const actorId = req.userId;

  try {
    const task = await TaskModel.getTaskById(taskId, actorId);

    // El modelo devuelve 'null' si la tarea no se encuentra O el actor no tiene permiso
    if (!task) {
      return res
        .status(404)
        .json({ message: "Tarea no encontrada o acceso denegado." });
    }
    res.json(task);
  } catch (error) {
    console.error("Error al obtener tarea por ID:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// ----------------------------------------------------------------------
// RUTA 4: ACTUALIZAR ESTADO DE TAREA (KANBAN) (PATCH /projects/:id/tasks/:taskId/status)
// ----------------------------------------------------------------------
/*Se usa PATCH y una ruta específica '/status' porque es una actualización parcial
 y muy específica para el Kanban*/
router.patch("/:taskId/status", async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;
  const actorId = req.userId;

  if (!status) {
    return res.status(400).json({ message: "El 'status' es obligatorio." });
  }

  //Validar que el status sea uno de los permitidos
  const allowedStatus = ["Por hacer", "En progreso", "En revisión", "Hecho"];
  if (!allowedStatus.includes(status)) {
    return res
      .status(400)
      .json({ message: `Status '${status}' no es válido.` });
  }

  try {
    const updatedTask = await TaskModel.updateTaskStatus(
      taskId,
      status,
      actorId
    );
    res.json(updatedTask);
  } catch (error) {
    console.error("Error al actualizar estado de la tarea:", error);
    if (error.message.includes("Tarea no encontrada")) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// ----------------------------------------------------------------------
// RUTA 5: ACTUALIZAR DETALLES DE TAREA (PUT /projects/:id/tasks/:taskId)
// ----------------------------------------------------------------------
//Se usa PUT para la actualización general de la tarea (título, desc, etc.)
router.put("/:taskId", async (req, res) => {
  const { taskId } = req.params;
  const dataToUpdate = req.body;
  const actorId = req.userId;
  const { id: projectId } = req.params;
  try {
    // Verificamos si el usuario está intentando cambiar la fecha de entrega
    if (dataToUpdate.due_date !== undefined) {
      // Si es así, verificamos si tiene rol de 'admin' en el proyecto
      // (Usamos la función que ya existe en models/project.js)
      const hasPermission = await ProjectModel.isProjectAdminOrCreator(
        projectId,
        actorId
      );

      if (!hasPermission) {
        return res.status(403).json({
          message:
            "Permiso denegado. Solo un administrador del proyecto puede cambiar la fecha de entrega.",
        });
      }
    }
    /*Si pasó el chequeo (o no estaba cambiando la fecha)llamamos a la función normal del modelo.
    (TaskModel.updateTask ya verifica que el usuario sea al menos 'miembro')*/
    const updatedTask = await TaskModel.updateTask(
      taskId,
      dataToUpdate,
      actorId
    );
    res.json(updatedTask);
  } catch (error) {
    console.error("Error al actualizar detalles de la tarea:", error);
    if (error.message.includes("Tarea no encontrada")) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// ----------------------------------------------------------------------
// RUTA 6: ELIMINAR TAREA (DELETE /projects/:id/tasks/:taskId)
// ----------------------------------------------------------------------
router.delete("/:taskId", async (req, res) => {
  const { taskId } = req.params;
  const actorId = req.userId;

  try {
    await TaskModel.deleteTask(taskId, actorId);
    res.status(204).send(); // 204 No Content: Éxito, sin nada que devolver
  } catch (error) {
    console.error("Error al eliminar la tarea:", error);
    if (error.message.includes("Tarea no encontrada")) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Error interno del servidor." });
  }
});
router.use("/:taskId/comments", commentsRouter);
export default router;

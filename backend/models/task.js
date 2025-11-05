import { pool } from "../src/db.js";
import { logAction } from "../src/utils/logAction.js";
import { isProjectAdminOrCreator } from "./project.js";
// --- HELPERS DE PERMISOS ---

/**
 * Verifica si un usuario es miembro O EL CREADOR de un proyecto.
 * @param {string} projectId - El ID del proyecto.
 * @param {string} userId - El ID del usuario.
 * @returns {boolean} - True si tiene acceso, false si no.
 */
async function isProjectMember(projectId, userId) {
  // 1. Comprueba si es miembro a través de la tabla project_members
  const memberQuery = `
    SELECT 1 FROM project_members
    WHERE project_id = $1 AND user_id = $2
  `.trim();
  const memberResult = await pool.query(memberQuery, [projectId, userId]);

  if (memberResult.rowCount > 0) {
    return true; // Es miembro (ej. un proyecto de workspace)
  }

  // 2. Si no es miembro, comprueba si es el CREADOR del proyecto
  // (Esto es crucial para los proyectos personales)
  const creatorQuery = `
    SELECT 1 FROM projects
    WHERE id = $1 AND created_by = $2
  `.trim();
  const creatorResult = await pool.query(creatorQuery, [projectId, userId]);

  if (creatorResult.rowCount > 0) {
    return true; // Es el creador (ej. un proyecto personal)
  }

  return false; // No es ninguna de las dos, acceso denegado
}

/**
 * Obtiene los detalles necesarios para los logs (nombres).
 * @param {string} actorId - ID del usuario que hace la acción.
 * @param {string} taskId - ID de la tarea afectada.
 * @returns {object} - { actorName, taskTitle }
 */
async function getLogDetails(actorId, taskId) {
  let actorName = `Usuario (ID: ${actorId})`;
  let taskTitle = `Tarea (ID: ${taskId})`;

  try {
    const actorRes = await pool.query(
      "SELECT full_name FROM users WHERE id = $1",
      [actorId]
    );
    if (actorRes.rowCount > 0) actorName = actorRes.rows[0].full_name;

    const taskRes = await pool.query("SELECT title FROM tasks WHERE id = $1", [
      taskId,
    ]);
    if (taskRes.rowCount > 0) taskTitle = taskRes.rows[0].title;
  } catch (e) {
    console.error("Error buscando detalles para el log de tareas:", e);
  }
  return { actorName, taskTitle };
}

// --- CRUD DE TAREAS ---

/**
 * Crea una nueva tarea en un proyecto.
 */
export async function createTask(taskData, actorId) {
  const {
    project_id,
    assigned_to,
    title,
    description,
    status,
    priority,
    due_date,
  } = taskData;

  // Permiso: Solo miembros del proyecto pueden crear tareas.
  if (!(await isProjectMember(project_id, actorId))) {
    throw new Error("Permiso denegado para crear tareas en este proyecto.");
  }

  const query = `
    INSERT INTO tasks (project_id, assigned_to, title, description, status, priority, due_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `.trim();

  const values = [
    project_id,
    assigned_to || null,
    title,
    description || null,
    status || "Por hacer",
    priority || "Media",
    due_date || null,
  ];

  const { rows } = await pool.query(query, values);
  const newTask = rows[0];

  // Bitácora
  if (newTask) {
    // No necesitamos getLogDetails aquí, ya tenemos el nombre de la tarea
    logAction({
      userId: actorId,
      projectId: project_id,
      // CORREGIDO: String simplificado
      action: `TASK_CREATED: "${newTask.title}"`,
    });
  }

  return newTask;
}

/**
 * Obtiene todas las tareas de un proyecto.
 * Solo si el usuario es miembro del proyecto.
 */
export async function getTasksByProjectId(projectId, actorId) {
  // Permiso: Solo miembros del proyecto pueden ver las tareas.
  if (!(await isProjectMember(projectId, actorId))) {
    return null; // El router interpretará null como "Acceso Denegado"
  }

  const query = `
    SELECT 
      t.*, 
      u.full_name AS assigned_to_name,
      u.email AS assigned_to_email
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.project_id = $1
    ORDER BY t.created_at ASC
  `.trim();

  const { rows } = await pool.query(query, [projectId]);
  return rows;
}

/**
 * Obtiene una tarea específica por su ID.
 * Solo si el usuario es miembro del proyecto.
 */
export async function getTaskById(taskId, actorId) {
  // Obtenemos la tarea y el project_id al mismo tiempo
  const taskQuery = `
    SELECT * FROM tasks WHERE id = $1
  `.trim();
  const taskResult = await pool.query(taskQuery, [taskId]);
  if (taskResult.rowCount === 0) return null; // Tarea no encontrada

  const task = taskResult.rows[0];

  // Permiso: ¿Es el actor miembro del proyecto al que pertenece esta tarea?
  if (!(await isProjectMember(task.project_id, actorId))) {
    return null; // Acceso Denegado
  }

  return task;
}

/**
 * Actualiza el estado de una tarea (KANBAN).
 */
export async function updateTaskStatus(taskId, status, actorId) {
  // 1. Obtener la tarea para verificar permisos
  const task = await getTaskById(taskId, actorId);
  if (!task) {
    throw new Error("Tarea no encontrada o acceso denegado.");
  }

  // 2. Actualizar el estado
  const updateQuery = `
    UPDATE tasks SET status = $2
    WHERE id = $1
    RETURNING *
  `.trim();

  const { rows } = await pool.query(updateQuery, [taskId, status]);
  const updatedTask = rows[0];

  // Bitácora
  if (updatedTask) {
    // No necesitamos actorName, logAction lo tiene
    const { taskTitle } = await getLogDetails(null, taskId);
    logAction({
      userId: actorId,
      projectId: task.project_id,
      // CORREGIDO: String simplificado
      action: `TASK_STATUS_UPDATED: "${taskTitle}" a "${status}"`,
    });
  }
  return updatedTask;
}

/**
 * Actualiza los campos generales de una tarea (título, desc, prioridad, etc.).
 */
export async function updateTask(taskId, data, actorId) {
  // 1. Verificar permisos
  const task = await getTaskById(taskId, actorId);
  if (!task) {
    throw new Error("Tarea no encontrada o acceso denegado.");
  }

  // 2. Construir query dinámica
  const fields = [];
  const values = [];
  let index = 1;

  // Campos permitidos para actualizar
  const allowedFields = [
    "title",
    "description",
    "priority",
    "due_date",
    "assigned_to",
  ];

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${index++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) {
    return task; // No hay nada que actualizar
  }

  values.push(taskId); // Añadir el ID de la tarea al final

  const query = `
    UPDATE tasks
    SET ${fields.join(", ")}
    WHERE id = $${index}
    RETURNING *
  `.trim();

  const { rows } = await pool.query(query, values);
  const updatedTask = rows[0];

  // Bitácora
  if (updatedTask) {
    const { taskTitle } = await getLogDetails(null, taskId);
    logAction({
      userId: actorId,
      projectId: task.project_id,
      // CORREGIDO: String simplificado
      action: `TASK_DETAILS_UPDATED: "${taskTitle}"`,
    });
  }

  return updatedTask;
}

/**
 * Elimina una tarea.
 */
export async function deleteTask(taskId, actorId) {
  // 1. Obtener la tarea para saber a qué proyecto pertenece
  const taskQuery = `SELECT project_id, title FROM tasks WHERE id = $1`.trim();
  const taskResult = await pool.query(taskQuery, [taskId]);
  if (taskResult.rowCount === 0) {
    throw new Error("Tarea no encontrada.");
  }
  const task = taskResult.rows[0];
  const hasPermission = await isProjectAdminOrCreator(task.project_id, actorId);
  if (!hasPermission) {
    throw new Error(
      "Permiso denegado. Solo un admin del proyecto puede eliminar tareas."
    );
  }
  // 3. Si tiene permiso, eliminar la tarea
  const deleteQuery = `DELETE FROM tasks WHERE id = $1 RETURNING *`.trim();
  const { rows } = await pool.query(deleteQuery, [taskId]);

  // 4. Bitácora
  if (rows.length > 0) {
    // (No necesitamos actorName, logAction lo obtiene de 'userId')
    logAction({
      userId: actorId,
      projectId: task.project_id,
      action: `TASK_DELETED: "${task.title}"`,
    });
  }

  return rows[0];
}

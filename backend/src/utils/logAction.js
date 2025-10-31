import { pool } from "../db.js";

/**
 * Mapea un código de acción genérico a una frase descriptiva en español.
 */
const ACTION_MESSAGES = {
  // AUTENTICACIÓN
  USER_REGISTERED: "creó su cuenta.",
  USER_LOGIN_SUCCESS: "Inició Sesión Satisfactoriamente.",
  USER_LOGOUT_SUCCESS: "Cerró Sesión.",

  // PROYECTOS (Debe ser usado con el nombre del proyecto)
  CREATED_PROJECT: "creó el proyecto:",
  UPDATED_PROJECT_DETAILS: "actualizó detalles del proyecto:",
  DELETED_PROJECT: "eliminó el proyecto:",

  // WORKSPACES (Debe ser usado con el nombre del workspace)
  CREATED_WORKSPACE: "creó el espacio de trabajo:",
  UPDATED_WORKSPACE_DETAILS: "actualizó detalles del espacio de trabajo:",
  DELETED_WORKSPACE: "eliminó el espacio de trabajo:",
  MEMBER_ADDED: "añadió un miembro:", // AÑADIDO: Acción para añadir miembros
  MEMBER_ROLE_UPDATED: `actualizó un rol:`,
  MEMBER_REMOVED: `eliminó un miembro:`,

  //tareas
  TASK_CREATED: `creó la tarea:`,
  TASK_STATUS_UPDATED: `actualizó el estado de una tarea:`,
  TASK_DETAILS_UPDATED: `actualizó detalles de la tarea:`,
  TASK_DELETED: `eliminó la tarea:`,
};

/**
 * Función de utilidad para registrar una acción en la bitácora (activity_log).
 * @param {Object} data - Objeto con los detalles de la acción.
 * // ... (parámetros existentes)
 */
export async function logAction({
  userId,
  action,
  workspaceId = null,
  projectId = null,
}) {
  // AÑADIDO: Validación obligatoria para evitar fallos de DB
  if (!userId || !action) {
    console.error(
      "🔴 LOG_ERROR: Faltan datos requeridos para la bitácora (userId o action)."
    );
    return; // Detiene la ejecución si faltan datos críticos
  }

  // --- 1. OBTENER NOMBRE COMPLETO DEL USUARIO ---
  let userName = "Usuario Desconocido";
  const parsedUserId = parseInt(userId);

  try {
    const userQuery = "SELECT full_name FROM users WHERE id = $1";
    const userResult = await pool.query(userQuery, [parsedUserId]);
    if (userResult.rows.length > 0 && userResult.rows[0].full_name) {
      userName = userResult.rows[0].full_name;
    }
  } catch (err) {
    console.error(
      "🔴 LOG_DB_ERROR: Fallo al buscar el nombre del usuario para la bitácora.",
      err.message
    );
  }

  // --- 2. CONSTRUIR EL MENSAJE FINAL ---
  let finalActionMessage = `${userName} `;

  // Obtener la frase base y cualquier detalle adicional del 'action'
  const [actionCode, ...details] = action.split(":");
  const baseMessage =
    ACTION_MESSAGES[actionCode] ||
    `realizó una acción desconocida (${actionCode})`;

  finalActionMessage += baseMessage;

  // Añadir detalles (ej. el nombre del proyecto) si existen
  if (details.length > 0) {
    finalActionMessage += ` ${details.join(":").trim()}`;
  }

  // --- 3. CONVERSIÓN DE TIPOS PARA LA INSERCIÓN ---
  const parsedWorkspaceId = workspaceId ? parseInt(workspaceId) : null;
  const parsedProjectId = projectId ? parseInt(projectId) : null;

  try {
    const query = `
            INSERT INTO activity_log (user_id, workspace_id, project_id, action)
            VALUES ($1, $2, $3, $4)
        `;

    // La variable 'action' ahora contiene la frase descriptiva completa.
    const values = [
      parsedUserId,
      parsedWorkspaceId,
      parsedProjectId,
      finalActionMessage,
    ];

    // Ejecutar la inserción en la base de datos
    await pool.query(query, values);

    // Opcional: imprimir en consola para debugging (usando la variable finalActionMessage)
    console.log(`[LOG]: ${finalActionMessage}`);
  } catch (error) {
    // MUY IMPORTANTE: Se registra el error de DB para debugging
    console.error(
      "🔴 Error CRÍTICO al registrar acción en la bitácora (DB FAILURE):",
      error.message,
      "Query values:",
      [parsedUserId, parsedWorkspaceId, parsedProjectId, finalActionMessage]
    );
  }
}

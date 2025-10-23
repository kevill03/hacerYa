import { pool } from "../src/db.js"; // CORRECCIÓN CLAVE: La ruta ahora es '../src/db.js'
import { logAction } from "../src/utils/logAction.js"; // AÑADIDO: Importar la utilidad de bitácora

/**
 * Módulo para interactuar con la tabla 'projects' y sus relaciones.
 * Este modelo asume que se recibe el userId para comprobaciones de permisos y listado.
 */

// --- Helpers de Proyectos ---

/**
 * Añade un miembro a un proyecto. Utilizado internamente por createProject.
 */
async function addMemberToProject(projectId, userId, role = "member") {
  const query = `
        INSERT INTO project_members (project_id, user_id, role_in_project)
        VALUES ($1, $2, $3)
        ON CONFLICT (project_id, user_id) DO NOTHING;
    `;
  const values = [projectId, userId, role];
  await pool.query(query, values);
}

/**
 * Verifica si el usuario es miembro del workspace dado.
 */
async function isMemberOfWorkspace(workspaceId, userId) {
  const query = `
        SELECT id FROM workspace_members 
        WHERE workspace_id = $1 AND user_id = $2
    `;
  const result = await pool.query(query, [workspaceId, userId]);
  return result.rowCount > 0;
}

// --- Lógica CRUD ---

/**
 * Obtiene todos los proyectos donde el usuario es el creador o un miembro.
 * @param {string} userId - ID del usuario autenticado.
 * @returns {Promise<Array>} - Lista de proyectos, incluyendo el nombre del creador.
 */
export async function getAllProjectsByUserId(userId) {
  const query = `
        SELECT DISTINCT p.*, u.full_name AS created_by_name
        FROM projects p
        INNER JOIN users u ON p.created_by = u.id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.created_by = $1 OR pm.user_id = $1
        ORDER BY p.created_at DESC;
    `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**
 * Obtiene un proyecto específico por ID, solo si el usuario tiene acceso (creador o miembro).
 * @param {string} projectId - ID del proyecto.
 * @param {string} userId - ID del usuario autenticado.
 * @returns {Promise<Object|null>} - El objeto proyecto o null.
 */
export async function getProjectById(projectId, userId) {
  const query = `
        SELECT DISTINCT p.*, u.full_name AS created_by_name
        FROM projects p
        INNER JOIN users u ON p.created_by = u.id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.id = $1 
          AND (p.created_by = $2 OR pm.user_id = $2);
    `;
  const { rows } = await pool.query(query, [projectId, userId]);
  return rows[0] || null;
}

/**
 * Crea un nuevo proyecto y automáticamente establece al usuario como creador.
 * @param {Object} projectData - Datos del proyecto (name, description, workspace_id, created_by, is_personal).
 * @returns {Promise<Object>} - El proyecto recién creado.
 */
export async function createProject({
  name,
  description,
  workspace_id,
  created_by,
  is_personal,
}) {
  // 1. VERIFICACIÓN: Si se proporciona workspace_id y NO es personal, verificar membresía.
  if (!is_personal && workspace_id) {
    const isMember = await isMemberOfWorkspace(workspace_id, created_by);
    if (!isMember) {
      // Este error debe ser capturado y manejado en la capa de rutas (projects.js)
      throw new Error("User is not a member of the specified workspace.");
    }
  }

  // 2. CREACIÓN del Proyecto
  const query = `
        INSERT INTO projects (name, description, workspace_id, created_by, is_personal)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
    `;
  const values = [
    name,
    description || null,
    is_personal ? null : workspace_id || null, // Si es personal, workspace_id es NULL
    created_by,
    is_personal || false,
  ];
  const { rows } = await pool.query(query, values);
  const newProject = rows[0];

  if (newProject) {
    // 3. LÓGICA DE MIEMBROS (si no es personal, añadir al creador como admin/member)
    if (!is_personal) {
      await addMemberToProject(newProject.id, created_by, "admin");
    }

    // 4. BITÁCORA
    logAction({
      userId: created_by,
      workspaceId: newProject.workspace_id,
      projectId: newProject.id,
      action: `CREATED_PROJECT: ${newProject.name}`,
    });
  }

  return newProject;
}

/**
 * Actualiza los datos de un proyecto si el usuario tiene permisos (es el creador).
 * @param {string} projectId - ID del proyecto a actualizar.
 * @param {Object} data - Datos a actualizar (name, description, etc.).
 * @param {string} userId - ID del usuario que realiza la actualización (para chequeo de permisos).
 * @returns {Promise<Object>} - Resultado de la consulta (rowCount).
 */
export async function updateProject(projectId, data, userId) {
  // Lógica para construir la query SET dinámicamente
  const fields = [];
  const values = [];
  let index = 1;

  for (const key in data) {
    // Ignorar campos sensibles o que no deben ser actualizados por el usuario
    if (
      data[key] !== undefined &&
      key !== "id" &&
      key !== "created_by" &&
      key !== "created_at" &&
      key !== "workspace_id" // Generalmente el workspace_id no se cambia después de la creación
    ) {
      fields.push(`${key} = $${index++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) {
    // Si no hay campos para actualizar, retornar 1 para no causar un error innecesario
    return { rowCount: 1 };
  }

  // Añadir el ID del proyecto y el ID del creador para el WHERE final.
  values.push(projectId);
  // El $index ahora apunta a la posición del projectId (el primero después de los campos dinámicos)
  const projectIdIndex = index++;
  values.push(userId);
  const userIdIndex = index;

  // MODIFICACIÓN CLAVE: RETURNING * para obtener el nombre para el log
  const query = `
        UPDATE projects
        SET ${fields.join(", ")}
        WHERE id = $${projectIdIndex} AND created_by = $${userIdIndex}
        RETURNING *;
    `;

  const result = await pool.query(query, values);
  const updatedProject = result.rows[0]; // Capturar el proyecto actualizado

  // BITÁCORA
  if (result.rowCount > 0 && updatedProject) {
    logAction({
      userId: userId,
      projectId: updatedProject.id,
      workspaceId: updatedProject.workspace_id, // Usar el workspace_id del objeto devuelto
      // AÑADIDO EL NOMBRE DEL PROYECTO AL LOG
      action: `UPDATED_PROJECT_DETAILS: ${updatedProject.name}`,
    });
  }

  return result;
}

/**
 * Elimina un proyecto si el usuario es el creador.
 * @param {string} projectId - ID del proyecto a eliminar.
 * @param {string} userId - ID del usuario que intenta eliminar (para chequeo de permisos).
 * @returns {Promise<Object>} - Resultado de la consulta (rowCount).
 */
export async function deleteProject(projectId, userId) {
  // Verificamos y eliminamos en una sola query. Solo el creador puede eliminar.
  // MODIFICACIÓN CLAVE: RETURNING name Y workspace_id para el log
  const query = `
        DELETE FROM projects
        WHERE id = $1 AND created_by = $2
        RETURNING name, workspace_id;
    `;
  const result = await pool.query(query, [projectId, userId]);

  // BITÁCORA
  if (result.rowCount > 0) {
    const deletedProject = result.rows[0]; // Capturar el nombre y workspace_id del proyecto eliminado
    const workspaceId = deletedProject.workspace_id;
    const projectName = deletedProject.name; // Capturar el nombre

    logAction({
      userId: userId,
      // No se puede enviar projectId porque ya fue eliminado de la DB (se usa el id para la consulta)
      workspaceId: workspaceId,
      // AÑADIDO EL NOMBRE DEL PROYECTO AL LOG
      action: `DELETED_PROJECT: ${projectName}`,
    });
  }

  return result;
}

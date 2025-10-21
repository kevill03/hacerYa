import { pool } from "../src/db.js"; // CORRECCIÓN CLAVE: La ruta ahora es '../src/db.js'

/**
 * Módulo para interactuar con la tabla 'projects' y sus relaciones.
 * Este modelo asume que se recibe el userId para comprobaciones de permisos y listado.
 */

// --- Helpers de Permisos ---

/**
 * Verifica si el usuario es el creador del proyecto.
 * NOTA: Para actualización/eliminación, el WHERE en la query final es más seguro,
 * pero esta función ayuda a la legibilidad y a la lógica más compleja (si la hubiera).
 * @param {string} projectId - ID del proyecto.
 * @param {string} userId - ID del usuario.
 * @returns {Promise<boolean>} - Verdadero si tiene permisos de creador.
 */
async function hasProjectPermission(projectId, userId) {
  // Verifica si el usuario es el creador (created_by)
  const query = `
        SELECT id FROM projects 
        WHERE id = $1 AND created_by = $2
    `;
  const result = await pool.query(query, [projectId, userId]);
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
  // Query que asegura que el proyecto existe Y que el usuario tiene acceso
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
  const query = `
        INSERT INTO projects (name, description, workspace_id, created_by, is_personal)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
    `;
  const values = [
    name,
    description || null,
    workspace_id || null,
    created_by,
    is_personal || false,
  ];
  const { rows } = await pool.query(query, values);

  // TODO: Si el proyecto NO es personal (is_personal = false) y se crea correctamente,
  // se debería añadir automáticamente al creador a la tabla project_members como 'admin'.

  return rows[0];
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
      key !== "created_at"
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

  const query = `
        UPDATE projects
        SET ${fields.join(", ")}
        WHERE id = $${projectIdIndex} AND created_by = $${userIdIndex}
        RETURNING *;
    `;

  const result = await pool.query(query, values);
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
  const query = `
        DELETE FROM projects
        WHERE id = $1 AND created_by = $2;
    `;
  const result = await pool.query(query, [projectId, userId]);
  return result;
}

// Nota: No se requiere exportación por defecto (export default) porque
// projects.js usa import * as ProjectModel from ... para importar todas las funciones.

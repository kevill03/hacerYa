import { pool } from "../src/db.js"; // Ruta corregida a la base de datos

/**
 * Módulo para interactuar con la tabla 'workspaces' y 'workspace_members'.
 */

// --- READ (LEER) ---

/**
 * Obtiene todos los workspaces a los que el usuario pertenece (creador o miembro).
 * @param {string} userId - ID del usuario autenticado.
 * @returns {Promise<Array>} - Lista de workspaces.
 */
export async function getAllWorkspacesByUserId(userId) {
  const query = `
        SELECT DISTINCT w.*, u.full_name AS created_by_name
        FROM workspaces w
        INNER JOIN users u ON w.created_by = u.id
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE w.created_by = $1 OR wm.user_id = $1
        ORDER BY w.created_at DESC;
    `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**
 * Obtiene un workspace específico por ID, solo si el usuario tiene acceso.
 * @param {string} workspaceId - ID del workspace.
 * @param {string} userId - ID del usuario autenticado.
 * @returns {Promise<Object|null>} - El objeto workspace o null.
 */
export async function getWorkspaceById(workspaceId, userId) {
  const query = `
        SELECT DISTINCT w.*, u.full_name AS created_by_name
        FROM workspaces w
        INNER JOIN users u ON w.created_by = u.id
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE w.id = $1 
          AND (w.created_by = $2 OR wm.user_id = $2);
    `;
  const { rows } = await pool.query(query, [workspaceId, userId]);
  return rows[0] || null;
}

// --- CREATE (CREAR) ---

/**
 * Crea un nuevo workspace y añade al creador como miembro y administrador.
 * @param {Object} workspaceData - Datos del workspace (name, description, created_by).
 * @returns {Promise<Object>} - El workspace recién creado.
 */
export async function createWorkspace({ name, description, created_by }) {
  // 1. Crear el Workspace
  const createQuery = `
        INSERT INTO workspaces (name, description, created_by)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;
  const values = [name, description || null, created_by];
  const { rows } = await pool.query(createQuery, values);
  const newWorkspace = rows[0];

  // 2. Añadir al creador como miembro administrador
  if (newWorkspace) {
    await addMemberToWorkspace(newWorkspace.id, created_by, "admin");
  }

  return newWorkspace;
}

/**
 * Añade un miembro a un workspace.
 */
export async function addMemberToWorkspace(
  workspaceId,
  userId,
  role = "member"
) {
  const query = `
        INSERT INTO workspace_members (workspace_id, user_id, role_in_workspace)
        VALUES ($1, $2, $3)
        ON CONFLICT (workspace_id, user_id) DO NOTHING;
    `;
  const values = [workspaceId, userId, role];
  await pool.query(query, values);
}

// --- UPDATE & DELETE Helpers ---

/**
 * Verifica si el usuario es el creador/administrador del workspace.
 * @returns {Promise<boolean>} - Verdadero si es el creador.
 */
async function isWorkspaceCreator(workspaceId, userId) {
  const query = `
        SELECT id FROM workspaces 
        WHERE id = $1 AND created_by = $2
    `;
  const result = await pool.query(query, [workspaceId, userId]);
  return result.rowCount > 0;
}

/**
 * Actualiza los datos de un workspace si el usuario es el creador.
 * @param {string} workspaceId - ID del workspace a actualizar.
 * @param {Object} data - Datos a actualizar (name, description).
 * @param {string} userId - ID del usuario que actualiza.
 * @returns {Promise<Object>} - Resultado de la consulta (rowCount).
 */
export async function updateWorkspace(workspaceId, data, userId) {
  // Lógica para construir la query SET dinámicamente
  const fields = [];
  const values = [];
  let index = 1;

  for (const key in data) {
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
    return { rowCount: 1 };
  }

  // Añadir el ID del workspace y el ID del creador para el WHERE final.
  values.push(workspaceId);
  const workspaceIdIndex = index++;
  values.push(userId);
  const userIdIndex = index;

  const query = `
        UPDATE workspaces
        SET ${fields.join(", ")}
        WHERE id = $${workspaceIdIndex} AND created_by = $${userIdIndex}
        RETURNING *;
    `;

  const result = await pool.query(query, values);
  return result;
}

/**
 * Elimina un workspace si el usuario es el creador.
 * @param {string} workspaceId - ID del workspace a eliminar.
 * @param {string} userId - ID del usuario que intenta eliminar.
 * @returns {Promise<Object>} - Resultado de la consulta (rowCount).
 */
export async function deleteWorkspace(workspaceId, userId) {
  // Verificamos y eliminamos en una sola query. Solo el creador puede eliminar.
  const query = `
        DELETE FROM workspaces
        WHERE id = $1 AND created_by = $2;
    `;
  const result = await pool.query(query, [workspaceId, userId]);
  return result;
}

import { pool } from "../src/db.js"; // Ruta corregida a la base de datos
import { logAction } from "../src/utils/logAction.js"; // AÑADIDO: Importar la utilidad de bitácora

/**
 * Módulo para interactuar con la tabla 'workspaces' y 'workspace_members'.
 */

// --- Helpers de Workspaces ---

/**
 * Verifica si el usuario autenticado es el creador del workspace O un administrador.
 */
export async function isWorkspaceAdminOrCreator(workspaceId, userId) {
  // 1. Verificar si es el creador (columna created_by)
  const isCreatorQuery = `
    SELECT id FROM workspaces WHERE id = $1 AND created_by = $2
    `.trim();
  const isCreator = await pool.query(isCreatorQuery, [workspaceId, userId]);

  if (isCreator.rowCount > 0) {
    return true;
  }

  // 2. Si no es el creador, verificar si es administrador en workspace_members
  const isAdminQuery = `
    SELECT id FROM workspace_members 
    WHERE workspace_id = $1 AND user_id = $2 AND role_in_workspace = 'admin'
    `.trim();
  const isAdmin = await pool.query(isAdminQuery, [workspaceId, userId]);

  return isAdmin.rowCount > 0;
}
/**
 * Obtiene el ID y nombre completo de un usuario a partir de su correo electrónico.
 */
export async function getUserIdByEmail(email) {
  const query = `
    SELECT id, full_name FROM users WHERE email = $1
    `.trim();
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null; // Devuelve { id, full_name } o null
}

// --- READ (LEER) ---

/**
 * Obtiene todos los workspaces a los que el usuario pertenece (creador o miembro).
 */
export async function getAllWorkspacesByUserId(userId) {
  const query = `
        SELECT DISTINCT w.*, u.full_name AS created_by_name
        FROM workspaces w
        INNER JOIN users u ON w.created_by = u.id
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE w.created_by = $1 OR wm.user_id = $1
        ORDER BY w.created_at DESC
    `.trim();
  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**
 * Obtiene un workspace específico por ID, solo si el usuario tiene acceso.
 */
export async function getWorkspaceById(workspaceId, userId) {
  const query = `
        SELECT DISTINCT w.*, u.full_name AS created_by_name
        FROM workspaces w
        INNER JOIN users u ON w.created_by = u.id
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE w.id = $1 
          AND (w.created_by = $2 OR wm.user_id = $2)
    `.trim();
  const { rows } = await pool.query(query, [workspaceId, userId]);
  return rows[0] || null;
}

// --- CREATE (CREAR) ---

/**
 * Crea un nuevo workspace y añade al creador como miembro y administrador.
 */
export async function createWorkspace({ name, description, created_by }) {
  // 1. Crear el Workspace
  const createQuery = `
    INSERT INTO workspaces (name, description, created_by)
    VALUES ($1, $2, $3)
    RETURNING *
    `.trim();

  const values = [name, description || null, created_by];
  const { rows } = await pool.query(createQuery, values);
  const newWorkspace = rows[0];

  if (newWorkspace) {
    // Se Loguea la CREACIÓN primero
    logAction({
      userId: created_by,
      workspaceId: newWorkspace.id,
      action: `CREATED_WORKSPACE: ${newWorkspace.name}`, // <-- MENSAJE CORREGIDO
    });

    //Se obtiene el nombre (full_name) del creador (necesario para el log de 'addMember')
    let actorName = "Usuario (ID: " + created_by + ")"; // Valor por defecto
    try {
      const userResult = await pool.query(
        "SELECT full_name FROM users WHERE id = $1",
        [created_by]
      );
      if (userResult.rowCount > 0) {
        actorName = userResult.rows[0].full_name;
      }
    } catch (e) {
      console.error("Error buscando el nombre del creador para el log:", e);
    }

    //Se Añade al creador como miembro
    await addMemberToWorkspace(
      newWorkspace.id, // 1. workspaceId
      created_by, // 2. userId (ID del miembro a añadir)
      "admin", // 3. role
      created_by, // 4. actorId (ID de quien hace la acción)
      actorName, // 5. memberName (Nombre del creador)
      newWorkspace.name // 6. workspaceName (Nombre del nuevo workspace)
    );
  }

  return newWorkspace;
}

/**
 * Añade un miembro a un workspace.
 * @param {string} actorId - ID del usuario que ejecuta la acción.
 * @param {string} memberName - Nombre completo del miembro (para el log).
 */
export async function addMemberToWorkspace(
  workspaceId,
  userId,
  role = "member",
  actorId,
  memberName,
  workspaceName
) {
  const query = `
        INSERT INTO workspace_members (workspace_id, user_id, role_in_workspace)
        VALUES ($1, $2, $3)
        ON CONFLICT (workspace_id, user_id) DO NOTHING
        RETURNING *
    `.trim();

  const values = [workspaceId, userId, role];
  const result = await pool.query(query, values);

  // BITÁCORA: Registra la acción usando el actorId (quien hizo la acción)
  if (result.rowCount > 0 && memberName && workspaceName) {
    logAction({
      userId: actorId, // EL ACTOR de la acción
      workspaceId: workspaceId,
      // Log más claro: "actorId añadió a memberName con rol X en workspaceName"
      action: `MEMBER_ADDED: ${memberName} como ${role} en ${workspaceName}`,
    });
  } else if (result.rowCount > 0) {
    // Fallback por si los nombres no llegaron
    logAction({
      userId: actorId,
      workspaceId: workspaceId,
      action: `MEMBER_ADDED: Usuario ID ${userId} añadido al workspace ID ${workspaceId}`,
    });
  }

  return result;
}

// --- UPDATE & DELETE Helpers ---

/**
 * Verifica si el usuario es el creador/administrador del workspace.
 */
async function isWorkspaceCreator(workspaceId, userId) {
  const query = `
    SELECT id FROM workspaces 
    WHERE id = $1 AND created_by = $2
    `.trim();
  const result = await pool.query(query, [workspaceId, userId]);
  return result.rowCount > 0;
}

/**
 * Actualiza los datos de un workspace si el usuario es el creador.
 * @param {string} workspaceName - Nombre del workspace (pasado desde la ruta para el log).
 */
export async function updateWorkspace(
  workspaceId,
  data,
  userId,
  workspaceName
) {
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

  values.push(workspaceId);
  const workspaceIdIndex = index++;
  values.push(userId);
  const userIdIndex = index;

  const query = `
        UPDATE workspaces
        SET ${fields.join(", ")}
        WHERE id = $${workspaceIdIndex} AND created_by = $${userIdIndex}
        RETURNING *
    `.trim();

  const result = await pool.query(query, values);
  const updatedWorkspace = result.rows[0];

  // LLAMADA A BITÁCORA
  if (result.rowCount > 0 && updatedWorkspace) {
    logAction({
      userId: userId,
      workspaceId: updatedWorkspace.id,
      // Usar el nombre pasado, o el nombre que devolvió la query
      action: `UPDATED_WORKSPACE_DETAILS: ${
        workspaceName || updatedWorkspace.name
      }`,
    });
  }

  return result;
}

/**
 * Elimina un workspace si el usuario es el creador.
 * @param {string} workspaceName - Nombre del workspace (pasado desde la ruta para el log).
 */
export async function deleteWorkspace(workspaceId, userId, workspaceName) {
  // Verificamos y eliminamos en una sola query. Solo el creador puede eliminar.
  const query = `
        DELETE FROM workspaces
        WHERE id = $1 AND created_by = $2
        RETURNING name
    `.trim();

  const result = await pool.query(query, [workspaceId, userId]);
  const deletedWorkspace = result.rows[0];

  // LLAMADA A BITÁCORA
  if (result.rowCount > 0 && deletedWorkspace) {
    logAction({
      userId: userId,
      action: `DELETED_WORKSPACE: ${workspaceName || deletedWorkspace.name}`, // Usar el nombre pasado o el nombre que devolvió la query
    });
  }

  return result;
}

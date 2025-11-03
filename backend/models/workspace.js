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
        SELECT DISTINCT
          w.*,
          u.full_name AS created_by_name,
          wm_user.role_in_workspace AS current_user_role
        FROM workspaces w
        INNER JOIN users u ON w.created_by = u.id
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
        -- Este join busca el rol del usuario actual en CADA workspace
        LEFT JOIN workspace_members wm_user ON w.id = wm_user.workspace_id AND wm_user.user_id = $1
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
  // --- 1. ¡NUEVA VALIDACIÓN DE PERMISOS! ---
  // Reutilizamos el helper que ya existe en este archivo.
  const hasPermission = await isWorkspaceAdminOrCreator(workspaceId, userId);

  if (!hasPermission) {
    // Si no tiene permiso, devolvemos rowCount 0 para que la ruta
    // envíe el error "No encontrado o sin permiso".
    return { rowCount: 0 };
  }

  // --- 2. Lógica para construir la query (sin cambios) ---
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
    return { rowCount: 1 }; // No hay nada que actualizar
  }

  // --- 3. ¡CORRECCIÓN EN LA QUERY! ---
  values.push(workspaceId);
  const workspaceIdIndex = index++;
  // Ya no necesitamos pasar el userId al query, el permiso fue validado.

  const query = `
        UPDATE workspaces
        SET ${fields.join(", ")}
        WHERE id = $${workspaceIdIndex} -- <-- ¡WHERE SIMPLIFICADO!
        RETURNING *
    `.trim();

  const result = await pool.query(query, values);
  const updatedWorkspace = result.rows[0];

  // --- 4. Lógica de Bitácora (sin cambios) ---
  if (result.rowCount > 0 && updatedWorkspace) {
    logAction({
      userId: userId,
      workspaceId: updatedWorkspace.id,
      action: `UPDATED_WORKSPACE_DETAILS: ${
        workspaceName || updatedWorkspace.name
      }`,
    });
  }

  return result;
}

/**
 * Elimina un workspace si el usuario es el creador o el administrador.
 * @param {string} workspaceName - Nombre del workspace (pasado desde la ruta para el log).
 */
export async function deleteWorkspace(workspaceId, userId, workspaceName) {
  // --- 1. ¡NUEVA VALIDACIÓN DE PERMISOS! ---
  const hasPermission = await isWorkspaceAdminOrCreator(workspaceId, userId);

  if (!hasPermission) {
    return { rowCount: 0 };
  }

  // --- 2. ¡CORRECCIÓN EN LA QUERY! ---
  const query = `
        DELETE FROM workspaces
        WHERE id = $1 -- <-- ¡WHERE SIMPLIFICADO!
        RETURNING name, id;
    `.trim();
  // Ahora solo pasamos el workspaceId
  const result = await pool.query(query, [workspaceId]);

  // --- 3. Lógica de Bitácora (sin cambios) ---
  if (result.rowCount > 0) {
    const deletedProject = result.rows[0];
    const workspaceId = deletedProject.workspace_id;
    const projectName = deletedProject.name;

    logAction({
      userId: userId,
      workspaceId: workspaceId,
      action: `DELETED_WORKSPACE: ${projectName}`,
    });
  }

  return result;
}
// ====================================================================
// --- NUEVAS FUNCIONES PARA EL CRUD DE MIEMBROS ---
// ====================================================================

/**
 * Obtiene la lista de miembros de un workspace.
 * Solo permite la consulta si el 'actorId' es miembro de ese workspace.
 */
export async function getMembersByWorkspaceId(workspaceId, actorId) {
  // 1. Verificar si el 'actorId' (quien pregunta) tiene permiso para ver
  const checkAccessQuery = `
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = $1 AND user_id = $2
  `.trim();
  const accessCheck = await pool.query(checkAccessQuery, [
    workspaceId,
    actorId,
  ]);

  if (accessCheck.rowCount === 0) {
    // Si el actor no es miembro, no puede ver la lista
    return null;
  }

  // 2. Si tiene acceso, obtener la lista de todos los miembros
  const getMembersQuery = `
    SELECT u.id, u.full_name, u.email, wm.role_in_workspace
    FROM workspace_members wm
    JOIN users u ON wm.user_id = u.id
    WHERE wm.workspace_id = $1
    ORDER BY u.full_name
  `.trim();
  const { rows } = await pool.query(getMembersQuery, [workspaceId]);
  return rows;
}

/**
 * Actualiza el rol de un miembro en un workspace.
 */
export async function updateMemberRole(
  workspaceId,
  memberId,
  role,
  actorId,
  actorName,
  memberName,
  workspaceName
) {
  const query = `
    UPDATE workspace_members
    SET role_in_workspace = $3
    WHERE workspace_id = $1 AND user_id = $2
    RETURNING *
  `.trim();

  const result = await pool.query(query, [workspaceId, memberId, role]);

  // Bitácora
  if (result.rowCount > 0) {
    logAction({
      userId: actorId,
      workspaceId: workspaceId,
      action: `MEMBER_ROLE_UPDATED: ${memberName} ahora es ${role} en ${workspaceName}`,
    });
  }
  return result;
}

/**
 * Elimina un miembro de un workspace.
 * Incluye lógica de negocio para no permitir eliminar al creador.
 */
export async function removeMemberFromWorkspace(
  workspaceId,
  memberIdToRemove,
  actorId,
  actorName,
  memberName,
  workspaceName
) {
  // 1. Verificar que no se está intentando eliminar al creador del workspace
  const workspaceCheck = await pool.query(
    "SELECT created_by FROM workspaces WHERE id = $1",
    [workspaceId]
  );
  if (
    workspaceCheck.rowCount > 0 &&
    workspaceCheck.rows[0].created_by == memberIdToRemove
  ) {
    // Lanza un error que será capturado por el catch del router
    throw new Error("No se puede eliminar al creador del workspace.");
  }

  // 2. Si no es el creador, proceder con la eliminación
  const deleteQuery = `
    DELETE FROM workspace_members
    WHERE workspace_id = $1 AND user_id = $2
    RETURNING *
  `.trim();

  const result = await pool.query(deleteQuery, [workspaceId, memberIdToRemove]);

  // Bitácora
  if (result.rowCount > 0) {
    logAction({
      userId: actorId,
      workspaceId: workspaceId,
      action: `MEMBER_REMOVED: ${memberName} fue eliminado de ${workspaceName}`,
    });
  }
  return result;
}

import { pool } from "../src/db.js";
import { logAction } from "../src/utils/logAction.js";

/**Añade un miembro a un proyecto. Utilizado internamente por createProject*/
async function internalAddMemberToProject(projectId, userId, role = "member") {
  const query = `
        INSERT INTO project_members (project_id, user_id, role_in_project)
        VALUES ($1, $2, $3)
        ON CONFLICT (project_id, user_id) DO NOTHING;
    `;
  const values = [projectId, userId, role];
  await pool.query(query, values);
}

/**Verifica si el usuario es miembro del workspace dado*/
export async function isMemberOfWorkspace(workspaceId, userId) {
  const query = `
        SELECT id FROM workspace_members 
        WHERE workspace_id = $1 AND user_id = $2
    `;
  const result = await pool.query(query, [workspaceId, userId]);
  return result.rowCount > 0;
}
/**Verifica si un usuario es miembro O EL CREADOR de un proyecto*/
export async function isProjectMember(projectId, userId) {
  // 1. Comprueba si es miembro
  const memberQuery = `
    SELECT 1 FROM project_members
    WHERE project_id = $1 AND user_id = $2
  `.trim();
  const memberResult = await pool.query(memberQuery, [projectId, userId]);
  if (memberResult.rowCount > 0) return true;

  // 2. Comprueba si es el CREADOR
  const creatorQuery = `
    SELECT 1 FROM projects
    WHERE id = $1 AND created_by = $2
  `.trim();
  const creatorResult = await pool.query(creatorQuery, [projectId, userId]);
  if (creatorResult.rowCount > 0) return true;

  return false;
}

/**Verifica si el usuario es el creador del proyecto O un administrador ('admin') del proyecto*/
export async function isProjectAdminOrCreator(projectId, userId) {
  // 1. Verificar si es el creador
  const isCreatorQuery = `
    SELECT 1 FROM projects WHERE id = $1 AND created_by = $2
  `.trim();
  const isCreator = await pool.query(isCreatorQuery, [projectId, userId]);
  if (isCreator.rowCount > 0) return true;

  // 2. Si no, verificar si es 'admin' en project_members
  const isAdminQuery = `
    SELECT 1 FROM project_members 
    WHERE project_id = $1 AND user_id = $2 AND role_in_project = 'admin'
  `.trim();
  const isAdmin = await pool.query(isAdminQuery, [projectId, userId]);
  return isAdmin.rowCount > 0;
}

/**Obtiene todos los proyectos donde el usuario es el creador o un miembro*/
export async function getAllProjectsByUserId(userId) {
  const query = `
        SELECT DISTINCT 
          p.*, 
          u.full_name AS created_by_name,
          pm_user.role_in_project AS current_user_role -- <--- LA LÍNEA MÁGICA
        FROM projects p
        INNER JOIN users u ON p.created_by = u.id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        -- Este join busca el rol del usuario actual en CADA proyecto
        LEFT JOIN project_members pm_user ON p.id = pm_user.project_id AND pm_user.user_id = $1
        WHERE p.created_by = $1 OR pm.user_id = $1
        ORDER BY p.created_at DESC;`.trim();
  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**Obtiene un proyecto específico por ID, solo si el usuario tiene acceso (creador o miembro)*/
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

/**Crea un nuevo proyecto y automáticamente establece al usuario como creador*/
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
      await internalAddMemberToProject(newProject.id, created_by, "admin");
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

/**Actualiza los datos de un proyecto si el usuario tiene permisos (es el creador)*/
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
  // El $index apunta a la posición del projectId (el primero después de los campos dinámicos)
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
  const updatedProject = result.rows[0]; // Capturar el proyecto actualizado

  // BITÁCORA
  if (result.rowCount > 0 && updatedProject) {
    logAction({
      userId: userId,
      projectId: updatedProject.id,
      workspaceId: updatedProject.workspace_id,
      action: `UPDATED_PROJECT_DETAILS: ${updatedProject.name}`,
    });
  }

  return result;
}

/**Elimina un proyecto si el usuario es el creador*/
export async function deleteProject(projectId, userId) {
  // Verificamos y eliminamos en una sola query. Solo el creador puede eliminar.
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

/**Obtiene la lista de miembros de un proyecto Solo si el 'actorId' tiene permiso para ver*/
export async function getMembersByProjectId(projectId, actorId) {
  // 1. Verificar si el 'actorId' (quien pregunta) tiene permiso para ver
  if (!(await isProjectMember(projectId, actorId))) {
    return null; // El router interpretará esto como "Acceso Denegado"
  }

  // 2. Si tiene acceso, obtener la lista de miembros
  const getMembersQuery = `
    SELECT u.id, u.full_name, u.email, pm.role_in_project
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = $1
    ORDER BY u.full_name
  `.trim();
  const { rows } = await pool.query(getMembersQuery, [projectId]);
  return rows;
}

/**Añade un miembro a un proyecto. (Versión PÚBLICA para la API)*/
export async function addMemberToProject(
  projectId,
  userId,
  role = "member",
  actorId,
  actorName,
  memberName,
  projectName
) {
  const query = `
    INSERT INTO project_members (project_id, user_id, role_in_project)
    VALUES ($1, $2, $3)
    ON CONFLICT (project_id, user_id) DO NOTHING
    RETURNING *
  `.trim();

  const values = [projectId, userId, role];
  const result = await pool.query(query, values);

  // Bitácora
  if (result.rowCount > 0) {
    logAction({
      userId: actorId,
      projectId: projectId,
      action: `PROJECT_MEMBER_ADDED: ${memberName} a "${projectName}"`,
    });
  }
  return result;
}

/**Actualiza el rol de un miembro en un proyecto*/
export async function updateMemberRoleInProject(
  projectId,
  memberId,
  role,
  actorId,
  actorName,
  memberName,
  projectName
) {
  const query = `
    UPDATE project_members
    SET role_in_project = $3
    WHERE project_id = $1 AND user_id = $2
    RETURNING *
  `.trim();

  const result = await pool.query(query, [projectId, memberId, role]);

  // Bitácora
  if (result.rowCount > 0) {
    logAction({
      userId: actorId,
      projectId: projectId,
      action: `PROJECT_MEMBER_ROLE_UPDATED: Rol de "${memberName}" a ${role} en "${projectName}"`,
    });
  }
  return result;
}

/** Elimina un miembro de un proyecto*/
export async function removeMemberFromProject(
  projectId,
  memberIdToRemove,
  actorId,
  actorName,
  memberName,
  projectName
) {
  // 1. Verificar que no se está intentando eliminar al creador del proyecto
  const projectCheck = await pool.query(
    "SELECT created_by FROM projects WHERE id = $1",
    [projectId]
  );
  if (
    projectCheck.rowCount > 0 &&
    projectCheck.rows[0].created_by == memberIdToRemove
  ) {
    throw new Error("No se puede eliminar al creador del proyecto.");
  }

  // 2. Si no es el creador, proceder con la eliminación
  const deleteQuery = `
    DELETE FROM project_members
    WHERE project_id = $1 AND user_id = $2
    RETURNING *
  `.trim();

  const result = await pool.query(deleteQuery, [projectId, memberIdToRemove]);

  // Bitácora
  if (result.rowCount > 0) {
    logAction({
      userId: actorId,
      projectId: projectId,
      action: `PROJECT_MEMBER_REMOVED: "${memberName}" de "${projectName}"`,
    });
  }
  return result;
}

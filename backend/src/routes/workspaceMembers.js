import { Router } from "express";
import { pool } from "../db.js";
import * as WorkspaceModel from "../../models/workspace.js";
import { verifyToken } from "../middleware/auth.js";

//mergeParams: true permite a este router acceder al :id de /workspaces/:id
const router = Router({ mergeParams: true });

// Proteger todas las rutas de miembros
router.use(verifyToken);

// --- Funciones para obtener nombres (para los logs)
async function getLogDetails(workspaceId, actorId, memberId) {
  try {
    // Usamos Promise.all para hacer las búsquedas en paralelo
    const [workspaceRes, actorRes, memberRes] = await Promise.all([
      // Obtener el nombre del workspace
      WorkspaceModel.getWorkspaceById(workspaceId, actorId),
      // Obtener el nombre del actor (quien hace la acción)
      pool.query("SELECT full_name FROM users WHERE id = $1", [actorId]),
      // Obtener el nombre del miembro (sobre quien recae la acción)
      pool.query("SELECT full_name FROM users WHERE id = $1", [memberId]),
    ]);

    const workspaceName = workspaceRes
      ? workspaceRes.name
      : "Workspace Desconocido";
    const actorName = actorRes.rows[0]
      ? actorRes.rows[0].full_name
      : "Actor Desconocido";
    const memberName = memberRes.rows[0]
      ? memberRes.rows[0].full_name
      : "Miembro Desconocido";

    return { workspaceName, actorName, memberName };
  } catch (error) {
    console.error("Error al obtener detalles para el log:", error);
    return {
      workspaceName: "Error",
      actorName: "Error",
      memberName: "Error",
    };
  }
}

// ----------------------------------------------------------------------
// RUTA 1: OBTENER TODOS LOS MIEMBROS (GET /workspaces/:id/members)
// ----------------------------------------------------------------------
router.get("/", async (req, res) => {
  const { id: workspaceId } = req.params;
  const actorId = req.userId;

  try {
    const members = await WorkspaceModel.getMembersByWorkspaceId(
      workspaceId,
      actorId
    );

    // Manejar del caso donde el actor no es miembro
    if (members === null) {
      return res.status(403).json({
        message: "Acceso denegado. No eres miembro de este workspace.",
      });
    }

    res.json(members);
  } catch (error) {
    console.error("Error al listar miembros:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// ----------------------------------------------------------------------
// RUTA 2: AÑADIR UN MIEMBRO (POST /workspaces/:id/members)
// ----------------------------------------------------------------------
router.post("/", async (req, res) => {
  const { id: workspaceId } = req.params;
  const { memberEmail, role = "member" } = req.body;
  const actorId = req.userId;

  if (!memberEmail) {
    return res
      .status(400)
      .json({ message: "El correo electrónico del miembro es obligatorio." });
  }

  try {
    // Validar que el actor tenga permisos (Admin/Creador)
    const hasPermission = await WorkspaceModel.isWorkspaceAdminOrCreator(
      workspaceId,
      actorId
    );
    if (!hasPermission) {
      return res.status(403).json({
        message:
          "Permiso denegado. Solo administradores pueden añadir miembros.",
      });
    }

    // Obtener datos del miembro y del workspace
    const member = await WorkspaceModel.getUserIdByEmail(memberEmail);
    if (!member) {
      return res
        .status(404)
        .json({ message: `Usuario con email ${memberEmail} no encontrado.` });
    }
    const memberId = member.id;

    const workspace = await WorkspaceModel.getWorkspaceById(
      workspaceId,
      actorId
    );
    if (!workspace) {
      return res.status(404).json({ message: "Workspace no encontrado." });
    }

    if (workspace.is_personal) {
      return res.status(403).json({
        message: "No se pueden añadir miembros a un workspace personal.",
      });
    }

    const result = await WorkspaceModel.addMemberToWorkspace(
      workspaceId,
      memberId,
      role,
      actorId,
      member.full_name, // memberName (para el log)
      workspace.name // workspaceName (para el log)
    );

    if (result.rowCount > 0) {
      res.status(201).json({
        message: `Usuario ${member.full_name} añadido al workspace.`,
      });
    } else {
      res
        .status(200)
        .json({ message: `Usuario ${member.full_name} ya es miembro.` });
    }
  } catch (error) {
    console.error("Error al añadir miembro:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor al añadir miembro." });
  }
});

// ----------------------------------------------------------------------
// RUTA 3: ACTUALIZAR ROL DE MIEMBRO (PUT /workspaces/:id/members/:userId)
// ----------------------------------------------------------------------
router.put("/:userId", async (req, res) => {
  const { id: workspaceId, userId: memberIdToUpdate } = req.params;
  const { role } = req.body;
  const actorId = req.userId;

  if (!role) {
    return res.status(400).json({ message: "El 'role' es obligatorio." });
  }

  try {
    //Validar que el actor tenga permisos (Admin/Creador)
    const hasPermission = await WorkspaceModel.isWorkspaceAdminOrCreator(
      workspaceId,
      actorId
    );
    if (!hasPermission) {
      return res
        .status(403)
        .json({ message: "Permiso denegado. Solo administradores." });
    }

    //Obtener nombres para el log
    const { workspaceName, actorName, memberName } = await getLogDetails(
      workspaceId,
      actorId,
      memberIdToUpdate
    );

    //Ejecutar actualización
    const result = await WorkspaceModel.updateMemberRole(
      workspaceId,
      memberIdToUpdate,
      role,
      actorId,
      actorName,
      memberName,
      workspaceName
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Miembro no encontrado." });
    }
    res.json({ message: `Rol del miembro actualizado a '${role}'.` });
  } catch (error) {
    console.error("Error al actualizar rol:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// ----------------------------------------------------------------------
// RUTA 4: ELIMINAR MIEMBRO (DELETE /workspaces/:id/members/:userId)
// ----------------------------------------------------------------------
router.delete("/:userId", async (req, res) => {
  const { id: workspaceId, userId: memberIdToRemove } = req.params;
  const actorId = req.userId;

  try {
    //Validar que el actor tenga permisos (Admin/Creador)
    const hasPermission = await WorkspaceModel.isWorkspaceAdminOrCreator(
      workspaceId,
      actorId
    );
    if (!hasPermission) {
      return res
        .status(403)
        .json({ message: "Permiso denegado. Solo administradores." });
    }

    //Obtener nombres para el log
    const { workspaceName, actorName, memberName } = await getLogDetails(
      workspaceId,
      actorId,
      memberIdToRemove
    );

    //Ejecutar eliminación
    const result = await WorkspaceModel.removeMemberFromWorkspace(
      workspaceId,
      memberIdToRemove,
      actorId,
      actorName,
      memberName,
      workspaceName
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Miembro no encontrado." });
    }
    res.status(204).send();
  } catch (error) {
    //Manejo de error específico del modelo
    console.error("Error al eliminar miembro:", error);
    if (error.message.includes("No se puede eliminar al creador")) {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

export default router;

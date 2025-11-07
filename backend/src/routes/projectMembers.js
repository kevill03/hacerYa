import { Router } from "express";
import { pool } from "../db.js";
import * as ProjectModel from "../../models/project.js";
import * as WorkspaceModel from "../../models/workspace.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(verifyToken);

//Funcion especifica para los logs
async function getLogDetails(projectId, actorId, memberId) {
  try {
    const [projectRes, actorRes, memberRes] = await Promise.all([
      pool.query("SELECT name, is_personal FROM projects WHERE id = $1", [
        projectId,
      ]),
      pool.query("SELECT full_name FROM users WHERE id = $1", [actorId]),
      memberId
        ? pool.query("SELECT full_name FROM users WHERE id = $1", [memberId])
        : Promise.resolve(null),
    ]);
    const project = projectRes.rows[0] || {};
    const actorName = actorRes.rows[0]
      ? actorRes.rows[0].full_name
      : "Actor Desconocido";
    const memberName =
      memberRes && memberRes.rows[0]
        ? memberRes.rows[0].full_name
        : "Miembro Desconocido";
    return {
      projectName: project.name || "Proyecto Desconocido",
      isPersonal: project.is_personal || false,
      actorName,
      memberName,
    };
  } catch (error) {
    console.error("Error al obtener detalles para el log:", error);
    return {
      projectName: "Error",
      isPersonal: false,
      actorName: "Error",
      memberName: "Error",
    };
  }
}

// RUTA 1: OBTENER TODOS LOS MIEMBROS (GET /projects/:id/members)
router.get("/", async (req, res) => {
  const { id: projectId } = req.params;
  const actorId = req.userId;
  try {
    const members = await ProjectModel.getMembersByProjectId(
      projectId,
      actorId
    );
    if (members === null) {
      return res.status(403).json({
        message: "Acceso denegado. No eres miembro de este proyecto.",
      });
    }
    res.json(members);
  } catch (error) {
    console.error("Error al listar miembros de proyecto:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// RUTA 2: AÑADIR UN MIEMBRO (POST /projects/:id/members)
router.post("/", async (req, res) => {
  const { id: projectId } = req.params;
  const { memberEmail, role = "member" } = req.body;
  const actorId = req.userId;

  if (!memberEmail) {
    return res
      .status(400)
      .json({ message: "El correo electrónico es obligatorio." });
  }

  try {
    // Validar permisos del Actor
    const hasPermission = await ProjectModel.isProjectAdminOrCreator(
      projectId,
      actorId
    );
    if (!hasPermission) {
      return res.status(403).json({
        message:
          "Permiso denegado. Solo administradores del proyecto pueden añadir miembros.",
      });
    }

    // Obtener datos del miembro a añadir
    const member = await WorkspaceModel.getUserIdByEmail(memberEmail);
    if (!member) {
      return res
        .status(404)
        .json({ message: `Usuario con email ${memberEmail} no encontrado.` });
    }
    const memberId = member.id;

    //Obtener datos del proyecto (para logs y validaciones)
    const { projectName, actorName, isPersonal } = await getLogDetails(
      projectId,
      actorId,
      null
    );

    //Validar si es proyecto personal
    if (isPersonal) {
      return res.status(403).json({
        message: "No se pueden añadir miembros a un proyecto personal.",
      });
    }

    // (Obtenemos el ID del workspace padre)
    const project = (
      await pool.query("SELECT workspace_id FROM projects WHERE id = $1", [
        projectId,
      ])
    ).rows[0];
    const parentWorkspaceId = project.workspace_id;
    const isMemberOfParent = await ProjectModel.isMemberOfWorkspace(
      parentWorkspaceId,
      memberId
    );

    if (!isMemberOfParent) {
      return res.status(403).json({
        message: `El usuario ${memberEmail} no es miembro del workspace padre. Añádelo al workspace primero.`,
      });
    }

    // Ejecutar la adición
    const result = await ProjectModel.addMemberToProject(
      projectId,
      memberId,
      role,
      actorId,
      actorName,
      member.full_name,
      projectName
    );

    if (result.rowCount > 0) {
      res
        .status(201)
        .json({ message: `Usuario ${member.full_name} añadido al proyecto.` });
    } else {
      res
        .status(200)
        .json({ message: `Usuario ${member.full_name} ya es miembro.` });
    }
  } catch (error) {
    console.error("Error al añadir miembro a proyecto:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// RUTA 3: ACTUALIZAR ROL (PUT /projects/:id/members/:userId)
router.put("/:userId", async (req, res) => {
  const { id: projectId, userId: memberIdToUpdate } = req.params;
  const { role } = req.body;
  const actorId = req.userId;

  if (!role || !["admin", "member"].includes(role)) {
    return res
      .status(400)
      .json({ message: "El 'role' debe ser 'admin' o 'member'." });
  }

  try {
    const hasPermission = await ProjectModel.isProjectAdminOrCreator(
      projectId,
      actorId
    );
    if (!hasPermission) {
      return res
        .status(403)
        .json({ message: "Permiso denegado. Solo administradores." });
    }

    const { projectName, actorName, memberName } = await getLogDetails(
      projectId,
      actorId,
      memberIdToUpdate
    );

    const result = await ProjectModel.updateMemberRoleInProject(
      projectId,
      memberIdToUpdate,
      role,
      actorId,
      actorName,
      memberName,
      projectName
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Miembro no encontrado en este proyecto." });
    }
    res.json({ message: `Rol del miembro actualizado a '${role}'.` });
  } catch (error) {
    console.error("Error al actualizar rol en proyecto:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

// RUTA 4: ELIMINAR MIEMBRO (DELETE /projects/:id/members/:userId)
router.delete("/:userId", async (req, res) => {
  const { id: projectId, userId: memberIdToRemove } = req.params;
  const actorId = req.userId;

  try {
    const hasPermission = await ProjectModel.isProjectAdminOrCreator(
      projectId,
      actorId
    );
    if (!hasPermission) {
      return res
        .status(403)
        .json({ message: "Permiso denegado. Solo administradores." });
    }

    const { projectName, actorName, memberName } = await getLogDetails(
      projectId,
      actorId,
      memberIdToRemove
    );

    const result = await ProjectModel.removeMemberFromProject(
      projectId,
      memberIdToRemove,
      actorId,
      actorName,
      memberName,
      projectName
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Miembro no encontrado." });
    }
    res.status(204).send();
  } catch (error) {
    if (error.message.includes("No se puede eliminar al creador")) {
      return res.status(403).json({ message: error.message });
    }
    console.error("Error al eliminar miembro de proyecto:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

export default router;

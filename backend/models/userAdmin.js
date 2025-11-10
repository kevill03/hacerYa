import { pool } from "../src/db.js";
import { logAction } from "../src/utils/logAction.js";

/**Funcion para obtener una lista de todos los usuarios de la aplicación(Menos la contraseña)*/
export async function getAllUsers() {
  const query = `
    SELECT id, email, full_name, role, account_status, created_at
    FROM users
    ORDER BY full_name;
  `.trim();
  const { rows } = await pool.query(query);
  return rows;
}

/**Funcion que actualiza el estado de la cuenta de un usuario (para bloquear/desbloquear)*/
export async function updateUserStatus(userIdToUpdate, newStatus, actorId) {
  const query = `
    UPDATE users
    SET account_status = $1
    WHERE id = $2
    RETURNING full_name, email;
  `.trim();

  const { rows } = await pool.query(query, [newStatus, userIdToUpdate]);
  const user = rows[0];

  // Bitácora
  logAction({
    userId: actorId,
    action: `ADMIN_STATUS_CHANGE: Estado de ${user.full_name} (${user.email}) cambiado a ${newStatus}`,
  });

  return user;
}

/**Funcion para actualizar los detalles de un usuario (rol, nombre, email)*/
export async function updateUserDetails(userIdToUpdate, data, actorId) {
  const { fullName, email, role } = data;
  const query = `
    UPDATE users
    SET full_name = $1, email = $2, role = $3
    WHERE id = $4
    RETURNING full_name;
  `.trim();

  const { rows } = await pool.query(query, [
    fullName,
    email,
    role,
    userIdToUpdate,
  ]);
  const user = rows[0];

  // Bitácora
  logAction({
    userId: actorId,
    action: `ADMIN_USER_EDIT: Detalles de ${user.full_name} actualizados.`,
  });

  return user;
}

/**Funcion para actualizar la contraseña de un usuario.*/
export async function updateUserPassword(
  userIdToUpdate,
  passwordHash,
  actorId
) {
  const query = `
    UPDATE users
    SET password = $1
    WHERE id = $2
    RETURNING full_name, email;
  `.trim();

  const { rows } = await pool.query(query, [passwordHash, userIdToUpdate]);
  const user = rows[0];

  // Bitácora
  logAction({
    userId: actorId,
    action: `ADMIN_PASS_CHANGE: Contraseña de ${user.full_name} (${user.email}) fue cambiada por un admin.`,
  });

  return user;
}

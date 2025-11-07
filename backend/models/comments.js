import { pool } from "../src/db.js";
import { logAction } from "../src/utils/logAction.js";

/**Obtiene todos los comentarios de una tarea específica.Une la tabla 'users' para obtener el nombre del autor.*/
export async function getCommentsByTaskId(taskId) {
  const query = `
    SELECT 
      tc.id,
      tc.content,
      tc.created_at,
      u.full_name AS author_name,
      u.email AS author_email
    FROM task_comments tc
    JOIN users u ON tc.user_id = u.id
    WHERE tc.task_id = $1
    ORDER BY tc.created_at ASC;
  `.trim();

  const { rows } = await pool.query(query, [taskId]);
  return rows;
}

/**Añade un nuevo comentario a una tarea*/
export async function createComment(taskId, userId, content) {
  const query = `
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES ($1, $2, $3)
    RETURNING *;
  `.trim();

  const { rows } = await pool.query(query, [taskId, userId, content]);
  const newComment = rows[0];

  // Bitácora
  if (newComment) {
    // Obtenemos el título de la tarea para el log
    const taskRes = await pool.query(
      "SELECT title, project_id FROM tasks WHERE id = $1",
      [taskId]
    );
    const task = taskRes.rows[0];

    logAction({
      userId: userId,
      projectId: task.project_id,
      action: `TASK_COMMENT_ADDED:"${task.title}"`,
    });
  }

  // Devolvemos el comentario con los datos del usuario para el frontend
  // (Esto evita que el frontend tenga que hacer otra llamada)
  const userRes = await pool.query(
    "SELECT full_name, email FROM users WHERE id = $1",
    [userId]
  );
  return {
    ...newComment,
    author_name: userRes.rows[0].full_name,
    author_email: userRes.rows[0].email,
  };
}

import { pool } from "../src/db.js"; // Ajusta la ruta a tu db.js

export async function getGlobalActivityLog(limit = 100) {
  const query = `
    SELECT 
      log.id,
      log.action,
      log.created_at,
      u.full_name AS user_name,
      u.email AS user_email,
      w.name AS workspace_name,
      p.name AS project_name
    FROM activity_log log
    LEFT JOIN users u ON log.user_id = u.id
    LEFT JOIN workspaces w ON log.workspace_id = w.id
    LEFT JOIN projects p ON log.project_id = p.id
    ORDER BY log.created_at DESC
    LIMIT $1
  `.trim();

  const { rows } = await pool.query(query, [limit]);
  return rows;
}

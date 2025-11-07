import { pool } from "../src/db.js";

/** Obtiene los KPIs principales*/
export async function getDashboardKPIs() {
  // Ejecutamos múltiples conteos simples en paralelo
  const userCountPromise = pool.query("SELECT COUNT(id) FROM users");
  const projectCountPromise = pool.query("SELECT COUNT(id) FROM projects");
  const workspaceCountPromise = pool.query("SELECT COUNT(id) FROM workspaces");
  const tasksDonePromise = pool.query(
    "SELECT COUNT(id) FROM tasks WHERE status = 'Hecho'"
  );

  const [userRes, projectRes, workspaceRes, tasksDoneRes] = await Promise.all([
    userCountPromise,
    projectCountPromise,
    workspaceCountPromise,
    tasksDonePromise,
  ]);

  return {
    totalUsers: parseInt(userRes.rows[0].count, 10),
    totalProjects: parseInt(projectRes.rows[0].count, 10),
    totalWorkspaces: parseInt(workspaceRes.rows[0].count, 10),
    totalTasksCompleted: parseInt(tasksDoneRes.rows[0].count, 10),
  };
}

/**Obtiene el conteo de tareas agrupadas por su estado (para un gráfico de dona)*/
export async function getTasksByStatus() {
  const query = `
    SELECT status, COUNT(id) AS count
    FROM tasks
    GROUP BY status
    ORDER BY status;
  `.trim();

  const { rows } = await pool.query(query);
  return rows; // Devuelve ej: [{status: 'Hecho', count: '5'}, {status: 'En progreso', count: '2'}]
}

/**Obtiene el conteo de tareas por proyecto (para un gráfico de barras)*/
export async function getTasksPerProject(limit = 10) {
  const query = `
    SELECT 
      p.name, 
      COUNT(t.id) AS task_count
    FROM projects p
    JOIN tasks t ON p.id = t.project_id
    GROUP BY p.name
    ORDER BY task_count DESC
    LIMIT $1;
  `.trim();

  const { rows } = await pool.query(query, [limit]);
  return rows; // Devuelve ej: [{name: 'Campaña Black Friday', task_count: '8'}, ...]
}

/**Obtiene los usuarios más activos (basado en la bitácora)*/
export async function getActiveUsers(limit = 5) {
  const query = `
    SELECT 
      u.full_name,
      COUNT(al.id) AS action_count
    FROM activity_log al
    JOIN users u ON al.user_id = u.id
    GROUP BY u.full_name
    ORDER BY action_count DESC
    LIMIT $1;
  `.trim();

  const { rows } = await pool.query(query, [limit]);
  return rows; // Devuelve ej: [{full_name: 'Kevin Medina', action_count: '75'}, ...]
}

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

/**Funcion que Obtiene los KPIs de carga de trabajo actual de un usuario específico*/
export async function getUserKPIs(userId) {
  //Tareas Activas (Status no es 'Hecho')
  const activeQuery = `
    SELECT COUNT(id) 
    FROM tasks 
    WHERE assigned_to = $1 AND status != 'Hecho';
  `;

  //Tareas Vencidas (Activas y fecha de entrega pasada)
  const overdueQuery = `
    SELECT COUNT(id) 
    FROM tasks 
    WHERE assigned_to = $1 AND status != 'Hecho' AND due_date < NOW();
  `;

  // Ejecutamos ambas en paralelo
  const [activeRes, overdueRes] = await Promise.all([
    pool.query(activeQuery, [userId]),
    pool.query(overdueQuery, [userId]),
  ]);

  return {
    totalActive: parseInt(activeRes.rows[0].count, 10),
    totalOverdue: parseInt(overdueRes.rows[0].count, 10),
  };
}

/**Funcion para obtener la distribución de tareas ACTIVAS de un usuario por estado (para gráfico de dona)*/
export async function getUserTasksByStatus(userId) {
  const query = `
    SELECT status, COUNT(id) AS count
    FROM tasks
    WHERE assigned_to = $1 AND status != 'Hecho'
    GROUP BY status
    ORDER BY status;
  `.trim();

  const { rows } = await pool.query(query, [userId]);
  return rows; // Devuelve ej: [{status: 'En progreso', count: '2'}, {status: 'Por hacer', count: '5'}]
}

/**Funcion que obtiene las estadísticas de finalización (a tiempo vs. con retraso) de un usuario*/
export async function getUserCompletionStats(userId) {
  // Esta consulta usa CASE para contar condicionalmente en un solo viaje a la BD
  const query = `
    SELECT 
      COUNT(CASE WHEN completed_at::date <= due_date THEN 1 END) AS on_time,
      COUNT(CASE WHEN completed_at::date > due_date THEN 1 END) AS late
    FROM tasks
    WHERE 
      assigned_to = $1 
      AND status = 'Hecho'
      AND completed_at IS NOT NULL 
      AND due_date IS NOT NULL;
  `.trim();

  const { rows } = await pool.query(query, [userId]);

  return {
    onTime: parseInt(rows[0].on_time, 10),
    late: parseInt(rows[0].late, 10),
  };
}

/**Funcion que obtiene el "Lead Time" (tiempo promedio de finalización) de un usuario*/
export async function getUserLeadTime(userId) {
  // EXTRACT(EPOCH FROM ...) nos da el total de segundos entre dos fechas.
  // Luego promediamos (AVG) y dividimos por 86400 (segundos en un día).
  const query = `
    SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) / 86400 AS avg_lead_time_days
    FROM tasks
    WHERE 
      assigned_to = $1
      AND status = 'Hecho'
      AND completed_at IS NOT NULL;
  `.trim();

  const { rows } = await pool.query(query, [userId]);

  // 'toFixed(1)' redondea a 1 decimal (ej: "3.2 días")
  // '|| 0' maneja el caso si el usuario no tiene tareas completadas (que daría null)
  const avgDays = parseFloat(rows[0].avg_lead_time_days || 0).toFixed(1);

  return {
    avgLeadTimeDays: parseFloat(avgDays), // Devolvemos como número
  };
}

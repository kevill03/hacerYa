import { pool } from "../src/db.js";

/** Obtiene los KPIs principales (excluyendo proyectos personales) */
export async function getDashboardKPIs() {
  // Ejecutamos múltiples conteos simples en paralelo
  const userCountPromise = pool.query("SELECT COUNT(id) FROM users");
  // Contamos solo proyectos que NO son personales
  const projectCountPromise = pool.query(
    "SELECT COUNT(id) FROM projects WHERE is_personal = false"
  );

  const workspaceCountPromise = pool.query("SELECT COUNT(id) FROM workspaces");

  // Contamos solo tareas "Hechas" que pertenecen a proyectos NO personales
  const tasksDonePromise = pool.query(`
    SELECT COUNT(t.id) 
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.status = 'Hecho' AND p.is_personal = false
  `);

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

/** Obtiene el conteo de tareas agrupadas por su estado (excluyendo proyectos personales) */
export async function getTasksByStatus() {
  // Hacemos JOIN con projects para filtrar solo tareas de p.is_personal = false
  const query = `
    SELECT t.status, COUNT(t.id) AS count
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE p.is_personal = false
    GROUP BY t.status
    ORDER BY t.status;
  `.trim();

  const { rows } = await pool.query(query);
  return rows;
}

/** Obtiene el conteo de tareas por proyecto (excluyendo proyectos personales) */
export async function getTasksPerProject(limit = 10) {
  // Añadimos "WHERE p.is_personal = false" para excluir esos proyectos de la lista
  const query = `
    SELECT 
      p.name, 
      COUNT(t.id) AS task_count
    FROM projects p
    JOIN tasks t ON p.id = t.project_id
    WHERE p.is_personal = false
    GROUP BY p.name
    ORDER BY task_count DESC
    LIMIT $1;
  `.trim();

  const { rows } = await pool.query(query, [limit]);
  return rows;
}

/** Obtiene los usuarios más activos (excluyendo actividad de proyectos personales) */
export async function getActiveUsers(limit = 5) {
  // Hacemos LEFT JOIN con projects para excluir logs de proyectos personales.
  // Mantenemos logs que no tienen project_id (como login o creación de workspace).
  const query = `
    SELECT 
      u.full_name,
      COUNT(al.id) AS action_count
    FROM activity_log al
    JOIN users u ON al.user_id = u.id
    LEFT JOIN projects p ON al.project_id = p.id
    WHERE 
      p.is_personal = false -- Incluye logs de proyectos de workspace
      OR al.project_id IS NULL -- Incluye logs que no son de proyecto (login, etc.)
    GROUP BY u.full_name
    ORDER BY action_count DESC
    LIMIT $1;
  `.trim();

  const { rows } = await pool.query(query, [limit]);
  return rows;
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

import { apiRequest } from "./api.js";

// Variable para guardar las instancias de los gráficos y destruirlos
let charts = [];

/**
 * Función principal para renderizar el dashboard de admin.
 */
export async function renderAdminDashboard(container) {
  // Limpiar gráficos anteriores para evitar errores de memoria
  charts.forEach((chart) => chart.destroy());
  charts = [];
  container.innerHTML = `<div class="loading-spinner">Cargando Estadísticas...</div>`;
  try {
    // 1. Definir el HTML del esqueleto del dashboard
    const dashboardHTML = `
      <div class="dashboard-grid">
        <div class="kpi-card" id="kpi-users"><h3>Total Usuarios</h3><p>...</p></div>
        <div class="kpi-card" id="kpi-projects"><h3>Total Proyectos</h3><p>...</p></div>
        <div class="kpi-card" id="kpi-workspaces"><h3>Total Workspaces</h3><p>...</p></div>
        <div class="kpi-card" id="kpi-tasks"><h3>Tareas Completadas</h3><p>...</p></div>

        <div class="chart-card chart-pie">
            <h3>Tareas por Estado</h3>
            <div class="chart-wrapper">
            <canvas id="tasksByStatusChart"></canvas>
            </div>
        </div>
        <div class="chart-card chart-bar">
            <h3>Proyectos Más Activos</h3>
            <div class="chart-wrapper">
            <canvas id="tasksPerProjectChart"></canvas>
            </div>
        </div>
        <div class="list-card">
          <h3>Usuarios Más Activos</h3>
          <ul id="activeUsersList"></ul>
        </div>
        <div class="list-card">
          <h3>Última Actividad</h3>
          <ul id="activityLogList"></ul>
        </div>
      </div>
    `;
    container.innerHTML = dashboardHTML;

    // 2. Llamar a todas las APIs en paralelo
    const [kpis, statusData, projectData, usersData, logData] =
      await Promise.all([
        apiRequest("/admin/kpis", "GET"),
        apiRequest("/admin/tasks-by-status", "GET"),
        apiRequest("/admin/tasks-per-project", "GET"),
        apiRequest("/admin/active-users", "GET"),
        apiRequest("/activity-log", "GET"),
      ]);

    // 3. Rellenar los datos
    populateKPIs(kpis.data);
    populateTasksByStatus(statusData.data);
    populateTasksPerProject(projectData.data);
    populateActiveUsers(usersData.data);
    populateActivityLog(logData.data.slice(0, 10)); // Mostrar solo los 10 más recientes
  } catch (error) {
    console.error("Error al renderizar el dashboard:", error);
    container.innerHTML = `<h2 class="error-message">❌ Error al cargar el dashboard: ${error.message}</h2>`;
  }
}

// --- Funciones "Helper" para rellenar el dashboard ---

function populateKPIs(data) {
  document.getElementById("kpi-users").querySelector("p").textContent =
    data.totalUsers;
  document.getElementById("kpi-projects").querySelector("p").textContent =
    data.totalProjects;
  document.getElementById("kpi-workspaces").querySelector("p").textContent =
    data.totalWorkspaces;
  document.getElementById("kpi-tasks").querySelector("p").textContent =
    data.totalTasksCompleted;
}

function populateTasksByStatus(data) {
  const ctx = document.getElementById("tasksByStatusChart").getContext("2d");
  const chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map((row) => row.status), // ['Hecho', 'En progreso', ...]
      datasets: [
        {
          label: "Tareas",
          data: data.map((row) => row.count), // [5, 2, ...]
          backgroundColor: [
            "#4CAF50", // Hecho (Verde)
            "#FFC107", // En revisión (Amarillo)
            "#2196F3", // En progreso (Azul)
            "#E0E0E0", // Por hacer (Gris)
          ],
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
  charts.push(chart); // Guardar para destruir después
}

function populateTasksPerProject(data) {
  const ctx = document.getElementById("tasksPerProjectChart").getContext("2d");
  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((row) => row.name),
      datasets: [
        {
          label: "Nº de Tareas",
          data: data.map((row) => row.task_count),
          backgroundColor: "#640093", // Tu color de marca
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y", // Hace el gráfico de barras horizontal
    },
  });
  charts.push(chart);
}

function populateActiveUsers(data) {
  const list = document.getElementById("activeUsersList");
  list.innerHTML = data
    .map(
      (user) =>
        `<li>
      <span>${user.full_name}</span>
      <strong>${user.action_count} acciones</strong>
    </li>`
    )
    .join("");
}

function populateActivityLog(data) {
  const list = document.getElementById("activityLogList");

  list.innerHTML = data
    .map((log) => {
      return `<li>
      <div class="activity-log-entry">
        <span>${log.action}</span>
      </div>
      <small>${new Date(log.created_at).toLocaleString()}</small>
    </li>`;
    })
    .join("");
}

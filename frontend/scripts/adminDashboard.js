import { apiRequest } from "./api.js";

// Variable para guardar las instancias de los gráficos y destruirlos
let charts = [];
// Guardará la referencia al contenedor principal del grid
let dashboardGridContainer = null;

/**Función principal para renderizar el dashboard de admin*/
export async function renderAdminDashboard(container) {
  // Limpiar gráficos anteriores para evitar errores de memoria
  charts.forEach((chart) => chart.destroy());
  charts = [];

  container.innerHTML = `<div class="loading-spinner">Cargando panel...</div>`;

  try {
    // 1. Definir el HTML del esqueleto del dashboard (CON EL FILTRO)
    const dashboardHTML = `
      <div class="dashboard-header">
        <div class="dashboard-filter">
          <label for="userFilterSelect">Ver estadísticas para:</label>
          <select id="userFilterSelect">
            <option value="global" selected>Global (Toda la empresa)</option>
            </select>
        </div>
      </div>
      
      <div class="dashboard-grid" id="dashboard-grid-content">
        </div>
    `;
    container.innerHTML = dashboardHTML;

    // Guardar la referencia al contenedor del grid
    dashboardGridContainer = document.getElementById("dashboard-grid-content");

    // 2. Añadir el listener al <select>
    container
      .querySelector("#userFilterSelect")
      .addEventListener("change", handleFilterChange);

    // 3. Cargar la lista de usuarios para el filtro
    await populateUserFilter();

    // 4. Cargar las estadísticas globales por defecto
    await loadGlobalStats();
  } catch (error) {
    console.error("Error al renderizar el dashboard:", error);
    container.innerHTML = `<h2 class="error-message">❌ Error al cargar el dashboard: ${error.message}</h2>`;
  }
}

/**Funcion que escucha los cambios en el dropdown y dispara la recarga de datos*/
async function handleFilterChange(e) {
  const selectedValue = e.target.value;

  if (selectedValue === "global") {
    await loadGlobalStats();
  } else {
    // El valor es un ID de usuario
    await loadUserStats(selectedValue);
  }
}

/**Funcion que Obtiene la lista de usuarios y la añade al <select>*/
async function populateUserFilter() {
  const select = document.getElementById("userFilterSelect");
  if (!select) return;

  try {
    const response = await apiRequest("/admin/users", "GET");
    const users = response.data;

    if (users && Array.isArray(users)) {
      users.forEach((user) => {
        select.innerHTML += `
          <option value="${user.id}">${user.full_name}</option>
        `;
      });
    }
  } catch (error) {
    console.warn(
      "No se pudo cargar la lista de usuarios para el filtro.",
      error
    );
    // No bloqueamos la app, pero el filtro de usuario no funcionará
  }
}

/**Funcion que destruye los gráficos antiguos y prepara el grid para nuevos datos.*/
function clearDashboardGrid() {
  // 1. Destruir instancias de Chart.js
  charts.forEach((chart) => chart.destroy());
  charts = []; // Limpiar el array

  // 2. Mostrar spinner de carga en el grid
  if (dashboardGridContainer) {
    dashboardGridContainer.innerHTML = `<div class="loading-spinner">Cargando estadísticas...</div>`;
  }
}

/**Funcion para Carga de todos los datos GLOBALES y dibujo del dashboard*/
async function loadGlobalStats() {
  clearDashboardGrid();

  try {
    const [kpis, statusData, projectData, usersData, logData] =
      await Promise.all([
        apiRequest("/admin/kpis", "GET"),
        apiRequest("/admin/tasks-by-status", "GET"),
        apiRequest("/admin/tasks-per-project", "GET"),
        apiRequest("/admin/active-users", "GET"),
        apiRequest("/activity-log", "GET"),
      ]);

    // Inyectar el HTML de los contenedores GLOBALES
    dashboardGridContainer.innerHTML = `
      <div class="kpi-card" id="kpi-users"><h3>Total Usuarios</h3><p>...</p></div>
      <div class="kpi-card" id="kpi-projects"><h3>Total Proyectos</h3><p>...</p></div>
      <div class="kpi-card" id="kpi-workspaces"><h3>Total Workspaces</h3><p>...</p></div>
      <div class="kpi-card" id="kpi-tasks"><h3>Tareas Completadas</h3><p>...</p></div>

      <div class="chart-card chart-pie">
        <h3>Tareas por Estado (Global)</h3>
        <div class="chart-wrapper">
          <canvas id="globalTasksByStatusChart"></canvas>
        </div>
      </div>
      <div class="chart-card chart-bar">
        <h3>Proyectos Más Activos (Global)</h3>
        <div class="chart-wrapper">
          <canvas id="globalTasksPerProjectChart"></canvas>
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
    `;

    // Rellenar los datos
    populateGlobalKPIs(kpis.data);
    populateGlobalTasksByStatus(statusData.data);
    populateGlobalTasksPerProject(projectData.data);
    populateActiveUsers(usersData.data);
    populateActivityLog(logData.data.slice(0, 10));
  } catch (error) {
    dashboardGridContainer.innerHTML = `<h2 class="error-message">❌ Error al cargar estadísticas globales: ${error.message}</h2>`;
  }
}

function populateGlobalKPIs(data) {
  document.getElementById("kpi-users").querySelector("p").textContent =
    data.totalUsers;
  document.getElementById("kpi-projects").querySelector("p").textContent =
    data.totalProjects;
  document.getElementById("kpi-workspaces").querySelector("p").textContent =
    data.totalWorkspaces;
  document.getElementById("kpi-tasks").querySelector("p").textContent =
    data.totalTasksCompleted;
}

function populateGlobalTasksByStatus(data) {
  const ctx = document
    .getElementById("globalTasksByStatusChart")
    .getContext("2d");
  const chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map((row) => row.status),
      datasets: [
        {
          label: "Tareas",
          data: data.map((row) => row.count),
          backgroundColor: ["#4CAF50", "#FFC107", "#2196F3", "#E0E0E0"],
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
  charts.push(chart);
}

function populateGlobalTasksPerProject(data) {
  const ctx = document
    .getElementById("globalTasksPerProjectChart")
    .getContext("2d");
  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((row) => row.name),
      datasets: [
        {
          label: "Nº de Tareas",
          data: data.map((row) => row.task_count),
          backgroundColor: "#640093",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
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

/**Funcion para Carga de todos los datos de un usuario en ESPECIFICO y dibuja el dashboard.*/
async function loadUserStats(userId) {
  clearDashboardGrid();

  try {
    const [kpis, statusData, completionData, leadTimeData] = await Promise.all([
      apiRequest(`/admin/stats/user/${userId}/kpis`, "GET"),
      apiRequest(`/admin/stats/user/${userId}/tasks-by-status`, "GET"),
      apiRequest(`/admin/stats/user/${userId}/completion-stats`, "GET"),
      apiRequest(`/admin/stats/user/${userId}/lead-time`, "GET"),
    ]);

    // Inyectar el HTML de los contenedores de USUARIO
    dashboardGridContainer.innerHTML = `
      <div class="kpi-card" id="kpi-user-active"><h3>Tareas Activas</h3><p>...</p></div>
      <div class="kpi-card" id="kpi-user-overdue"><h3>Tareas Vencidas</h3><p>...</p></div>
      <div class="kpi-card" id="kpi-user-ontime"><h3>Finalizadas a Tiempo</h3><p>...</p></div>
      <div class="kpi-card" id="kpi-user-leadtime"><h3>Tiempo Promedio</h3><p>...</p></div>
      
      <div class="chart-card chart-pie">
        <h3>Distribución de Tareas Activas</h3>
        <div class="chart-wrapper"><canvas id="userTasksByStatusChart"></canvas></div>
      </div>
      <div class="chart-card chart-bar">
        <h3>Rendimiento de Entregas</h3>
        <div class="chart-wrapper"><canvas id="userCompletionChart"></canvas></div>
      </div>
    `;

    // Rellenar los datos con funciones específicas de usuario
    populateUserKPIs(kpis.data, completionData.data, leadTimeData.data);
    populateUserTasksByStatus(statusData.data);
    populateUserCompletionStats(completionData.data);
  } catch (error) {
    dashboardGridContainer.innerHTML = `<h2 class="error-message">❌ Error al cargar estadísticas de usuario: ${error.message}</h2>`;
  }
}

// --- Funciones para rellenar el dashboard de USUARIO ---

function populateUserKPIs(kpiData, completionData, leadTimeData) {
  document.getElementById("kpi-user-active").querySelector("p").textContent =
    kpiData.totalActive;
  document.getElementById("kpi-user-overdue").querySelector("p").textContent =
    kpiData.totalOverdue;
  document.getElementById("kpi-user-ontime").querySelector("p").textContent =
    completionData.onTime;
  document
    .getElementById("kpi-user-leadtime")
    .querySelector("p").textContent = `${leadTimeData.avgLeadTimeDays} días`;
}

function populateUserTasksByStatus(data) {
  const ctx = document
    .getElementById("userTasksByStatusChart")
    .getContext("2d");
  const chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map((row) => row.status), // ej: ['En progreso', 'Por hacer']
      datasets: [
        {
          label: "Tareas Activas",
          data: data.map((row) => row.count),
          backgroundColor: ["#2196F3", "#E0E0E0", "#FFC107"],
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
  charts.push(chart);
}

function populateUserCompletionStats(data) {
  const ctx = document.getElementById("userCompletionChart").getContext("2d");
  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["A Tiempo", "Con Retraso"],
      datasets: [
        {
          label: "Nº de Tareas Finalizadas",
          data: [data.onTime, data.late],
          backgroundColor: ["#4CAF50", "#dc3545"], // Verde, Rojo
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
  charts.push(chart);
}

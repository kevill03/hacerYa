import { apiRequest } from "./api.js";
export async function renderKanbanBoard(container, projectId) {
  try {
    // 1. Mostrar un 'Cargando...'
    container.innerHTML = `<p>Cargando tareas...</p>`;

    // 2. Buscar los datos de la API (en paralelo)
    /* Bloque comentado para pruebas iniciales ya que no se tiene el endpoint para esta funcionalidad
    const [tasks, members] = await Promise.all([
      apiRequest(`/projects/${projectId}/tasks`, "GET"),
      apiRequest(`/projects/${projectId}/members`, "GET"), // Necesitamos miembros para el 'asignar a'
    ]);*/
    const tasks = await apiRequest(`/projects/${projectId}/tasks`, "GET");
    const members = [];
    // 3. Construir el esqueleto del Kanban (¡Esto es lo que NO va en el HTML!)
    const kanbanHTML = `
      <div class="kanban-container">
        <div class="kanban-column" id="col-por-hacer" data-status="Por hacer">
          <h3>Por Hacer</h3>
          <div class="kanban-tasks-list"></div>
          <button class="add-task-btn">+ Añadir tarea</button>
        </div>
        <div class="kanban-column" id="col-en-progreso" data-status="En progreso">
          <h3>En Progreso</h3>
          <div class="kanban-tasks-list"></div>
        </div>
        <div class="kanban-column" id="col-en-revision" data-status="En revisión">
          <h3>En Revisión</h3>
          <div class="kanban-tasks-list"></div>
        </div>
        <div class="kanban-column" id="col-hecho" data-status="Hecho">
          <h3>Hecho</h3>
          <div class="kanban-tasks-list"></div>
        </div>
      </div>
    `;

    // 4. Inyectar el esqueleto en el contenedor
    container.innerHTML = kanbanHTML;

    // 5. Poblar las columnas con las tareas
    tasks.forEach((task) => {
      const taskCard = createTaskCard(task);
      const column = container.querySelector(
        `[data-status="${task.status}"] .kanban-tasks-list`
      );
      if (column) {
        column.innerHTML += taskCard;
      }
    });

    // 6. Añadir los Event Listeners (Drag & Drop, clic en botones, etc.)
    // (Esta es la parte más compleja que irá aquí)
    addKanbanEventListeners(container, projectId, members);
  } catch (error) {
    console.error("Error al renderizar el Kanban:", error);
    container.innerHTML = `<p class="error">Error al cargar las tareas.</p>`;
  }
}

function createTaskCard(task) {
  // Genera el HTML para una sola tarjeta de tarea
  return `
    <div class="task-card" draggable="true" data-task-id="${task.id}">
      <h4>${task.title}</h4>
      <p>Prioridad: ${task.priority}</p>
      ${
        task.assigned_to_name
          ? `<span class="task-assignee">${task.assigned_to_name}</span>`
          : ""
      }
    </div>
  `;
}

function addKanbanEventListeners(container, projectId, members) {
  // Aquí va toda la lógica para:
  // - Clic en "Añadir tarea" (abre el modal de crear tarea)
  // - Clic en una tarjeta (abre el modal de editar detalles)
  // - Eventos de Drag & Drop (ondragstart, ondragover, ondrop)
  // - La llamada a la API con PATCH /status cuando se suelta una tarjeta

  // Ejemplo de listener de Drop
  const columns = container.querySelectorAll(".kanban-column");
  columns.forEach((column) => {
    column.addEventListener("dragover", (e) => {
      e.preventDefault(); // Necesario para permitir el drop
    });

    column.addEventListener("drop", async (e) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData("text/plain");
      const newStatus = column.dataset.status;

      console.log(`Moviendo tarea ${taskId} a ${newStatus}`);

      // Aquí harías el PATCH a la API
      // await apiRequest(`/projects/${projectId}/tasks/${taskId}/status`, 'PATCH', { status: newStatus });

      // Mover el elemento en el DOM (lógica de UI)
      const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
      column.querySelector(".kanban-tasks-list").appendChild(taskElement);
    });
  });

  // Ejemplo de listener de Drag
  const cards = container.querySelectorAll(".task-card");
  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.dataset.taskId);
    });
  });
}

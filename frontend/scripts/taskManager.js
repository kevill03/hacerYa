import { apiRequest } from "./api.js";
import { appState } from "./crudMainPage.js"; // Necesitamos el appState para el refresh

// --- 1. FUNCIÓN PRINCIPAL DE RENDERIZADO (CORREGIDA) ---

export async function renderKanbanBoard(container, projectId) {
  try {
    container.innerHTML = `<p>Cargando tareas...</p>`;

    // --- CORRECCIÓN ---
    // Ahora cargamos Tareas y Miembros en paralelo
    const [tasksResponse, membersResponse] = await Promise.all([
      apiRequest(`/projects/${projectId}/tasks`, "GET"),
      apiRequest(`/projects/${projectId}/members`, "GET"),
    ]);

    const tasks = tasksResponse.data;
    const members = membersResponse.data;
    // --- FIN DE LA CORRECCIÓN ---
    const totalTasks = tasks.length;
    const finishedTasks = tasks.filter((t) => t.status === "Hecho").length;
    let progressPercentage = 0;
    if (totalTasks > 0) {
      progressPercentage = Math.round((finishedTasks / totalTasks) * 100);
    }
    const kanbanHTML = `
      <div class="kanban-container">
        <div class="kanban-column" id="col-por-hacer" data-status="Por hacer">
          <h3>Por Hacer</h3>
          <div class="kanban-tasks-list" data-status="Por hacer"></div>
          <button class="add-task-btn">+ Añadir tarea</button>
        </div>
        <div class="kanban-column" id="col-en-progreso" data-status="En progreso">
          <h3>En Progreso</h3>
          <div class="kanban-tasks-list" data-status="En progreso"></div>
        </div>
        <div class="kanban-column" id="col-en-revision" data-status="En revisión">
          <h3>En Revisión</h3>
          <div class="kanban-tasks-list" data-status="En revisión"></div>
        </div>
        <div class="kanban-column" id="col-hecho" data-status="Hecho">
          <h3>Hecho</h3>
          <div class="kanban-tasks-list" data-status="Hecho"></div>
        </div>
      </div>
    `;

    container.innerHTML = kanbanHTML;

    if (tasks && Array.isArray(tasks)) {
      tasks.forEach((task) => {
        const taskCard = createTaskCard(task);
        const columnList = container.querySelector(
          `.kanban-tasks-list[data-status="${task.status}"]`
        );
        if (columnList) {
          columnList.innerHTML += taskCard;
        }
      });
    }

    // Pasamos los miembros a los listeners
    addKanbanEventListeners(container, projectId, members);
  } catch (error) {
    console.error("Error al renderizar el Kanban:", error);
    container.innerHTML = `<p class="error">Error al cargar las tareas: ${error.message}</p>`;
  }
}

// --- 2. FUNCIÓN PARA CREAR TARJETAS (SIN CAMBIOS) ---

function createTaskCard(task) {
  let dueDateHtml = "";
  if (task.due_date) {
    const today = new Date();
    const dueDate = new Date(task.due_date);

    // Normalizamos las fechas a medianoche para una comparación justa de "días"
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    // Usamos Math.ceil para contar el día de hoy
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Formatear el mensaje y la clase CSS
    if (diffDays < 0) {
      const daysAgo = Math.abs(diffDays);
      dueDateHtml = `<span class="task-due overdue">Venció hace ${daysAgo} ${
        daysAgo === 1 ? "día" : "días"
      }</span>`;
    } else if (diffDays === 0) {
      dueDateHtml = `<span class="task-due due-today">⚠️ Vence Hoy</span>`;
    } else if (diffDays === 1) {
      dueDateHtml = `<span class="task-due due-soon">Vence Mañana</span>`;
    } else {
      dueDateHtml = `<span class="task-due">Vence en ${diffDays} días</span>`;
    }
  }
  // --- FIN DE LA LÓGICA DE FECHA ---

  // Genera el HTML de la tarjeta
  return `
    <div class="task-card" draggable="true" data-task-id="${task.id}">
      <h4>${task.title}</h4>
      <p>Prioridad: ${task.priority}</p>
      ${
        task.assigned_to_name
          ? `<span class="task-assignee">${task.assigned_to_name}</span>`
          : ""
      }
      ${dueDateHtml} </div>
  `;
}

// --- 3. MANEJADORES DE EVENTOS (IMPLEMENTACIÓN COMPLETA) ---

function addKanbanEventListeners(container, projectId, members) {
  const columns = container.querySelectorAll(".kanban-column");
  const taskLists = container.querySelectorAll(".kanban-tasks-list");
  const cards = container.querySelectorAll(".task-card");
  const addButtons = container.querySelectorAll(".add-task-btn");

  // --- A. Eventos de Drag & Drop (Arrastrar y Soltar) ---

  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.dataset.taskId);
      setTimeout(() => card.classList.add("dragging"), 0);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });
  });

  taskLists.forEach((list) => {
    list.addEventListener("dragover", (e) => {
      e.preventDefault(); // Necesario para permitir el drop
      const draggingCard = document.querySelector(".dragging");
      if (draggingCard) {
        list.appendChild(draggingCard);
      }
    });

    list.addEventListener("drop", async (e) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData("text/plain");
      const newStatus = list.dataset.status;
      const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);

      // Mover el elemento en el DOM (ya se hizo en dragover, pero confirmamos)
      list.appendChild(taskElement);

      // Llamada a la API
      try {
        await apiRequest(
          `/projects/${projectId}/tasks/${taskId}/status`,
          "PATCH",
          { status: newStatus }
        );
        // Opcional: Pequeña confirmación de éxito no intrusiva
      } catch (error) {
        console.error("Error al mover la tarea:", error);
        Swal.fire(
          "Error",
          `No se pudo mover la tarea: ${error.message}`,
          "error"
        );
        // TODO: Devolver la tarjeta a su columna original si falla la API
      }
    });
  });

  // --- B. Clic en "Añadir tarea" ---
  addButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      const status = e.target.closest(".kanban-column").dataset.status;
      openTaskModal(null, projectId, status, members); // null = Modo Creación
    });
  });

  // --- C. Clic en una tarjeta (para Editar) ---
  cards.forEach((card) => {
    card.addEventListener("click", (e) => {
      const taskId = e.target.closest(".task-card").dataset.taskId;
      openTaskModal(taskId, projectId, null, members); // taskId = Modo Edición
    });
  });
}

// --- 4. LÓGICA DEL MODAL DE TAREAS (¡NUEVO!) ---
// (Asume que el HTML del modal está en mainPage.html con id="taskModal")

const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const taskFormTitle = document.getElementById("taskFormTitle");
const submitTaskBtn = document.getElementById("submitTaskBtn");
const taskAssigneeSelect = document.getElementById("taskAssigneeSelect");

/**
 * Abre el modal de Tareas, sea para Crear o Editar.
 */
async function openTaskModal(taskId, projectId, status, members) {
  const form = taskForm; // Referencia al formulario
  form.reset(); // Limpiar el formulario

  // Poblar el <select> de miembros
  taskAssigneeSelect.innerHTML = '<option value="">(Sin asignar)</option>'; // Resetear
  if (members && Array.isArray(members)) {
    members.forEach((member) => {
      taskAssigneeSelect.innerHTML += `
        <option value="${member.id}">${member.full_name}</option>
      `;
    });
  }

  // Almacenar IDs para el submit
  form.dataset.projectId = projectId;
  // --- INICIO DE LA LÓGICA DE PERMISOS (NUEVO) ---
  const deleteBtn = document.getElementById("deleteTaskBtn");

  // 1. Averiguar si el usuario actual es admin de este proyecto
  const project = appState.allProjects.find((p) => p.id == projectId);
  const isOwner = project && project.created_by === appState.currentUser.id;
  const member = members.find((m) => m.id === appState.currentUser.id);
  const isProjectAdmin = member && member.role_in_project === "admin";
  const canManage = isOwner || isProjectAdmin;
  if (taskId) {
    // --- MODO EDICIÓN ---
    taskFormTitle.textContent = "Editar Tarea";
    submitTaskBtn.textContent = "Guardar Cambios";
    form.dataset.taskId = taskId; // Guardar el ID de la tarea
    // 2. Mostrar el botón de eliminar SOLO si es admin Y está en modo edición
    if (canManage) {
      deleteBtn.style.display = "block";
    } else {
      deleteBtn.style.display = "none";
    }
    try {
      // Cargar datos de la tarea
      const response = await apiRequest(
        `/projects/${projectId}/tasks/${taskId}`,
        "GET"
      );
      const task = response.data;

      // Rellenar el formulario
      document.getElementById("taskTitle").value = task.title;
      document.getElementById("taskDescription").value = task.description || "";
      document.getElementById("taskStatusSelect").value = task.status;
      document.getElementById("taskPrioritySelect").value = task.priority;
      document.getElementById("taskAssigneeSelect").value =
        task.assigned_to || "";
      document.getElementById("taskDueDate").value = task.due_date
        ? task.due_date.split("T")[0]
        : ""; // Formatear fecha
    } catch (error) {
      Swal.fire(
        "Error",
        `No se pudieron cargar los datos de la tarea: ${error.message}`,
        "error"
      );
      return;
    }
  } else {
    // --- MODO CREACIÓN ---
    taskFormTitle.textContent = "Crear Nueva Tarea";
    submitTaskBtn.textContent = "Crear Tarea";
    form.dataset.taskId = ""; // Limpiar el ID
    deleteBtn.style.display = "none";
    // Asignar el estado de la columna donde se hizo clic
    if (status) {
      document.getElementById("taskStatusSelect").value = status;
    }
  }

  // Mostrar el modal
  taskModal.classList.remove("hidden");
  document.querySelector(".overlay").classList.remove("hidden");

  // Añadir listeners (solo una vez)
  taskModal
    .querySelector(".closeWindow")
    .addEventListener("click", closeTaskModal, { once: true });
  document
    .querySelector(".overlay")
    .addEventListener("click", closeTaskModal, { once: true });
  form.addEventListener("submit", handleTaskFormSubmit, { once: true });
  deleteBtn.addEventListener("click", handleDeleteTask, { once: true });
}

/**
 * Cierra y resetea el modal de tareas.
 */
function closeTaskModal() {
  taskModal.classList.add("hidden");
  document.querySelector(".overlay").classList.add("hidden");
  // Limpiamos el listener del formulario para evitar envíos duplicados
  taskForm.removeEventListener("submit", handleTaskFormSubmit);
}

/**
 * Maneja el envío (submit) del formulario de Tarea (Crear o Editar).
 */
async function handleTaskFormSubmit(e) {
  e.preventDefault();

  // Obtener IDs
  const projectId = e.target.dataset.projectId;
  const taskId = e.target.dataset.taskId;

  // Determinar si es CREAR (POST) o EDITAR (PUT)
  const isEditing = !!taskId;
  const method = isEditing ? "PUT" : "POST";
  const endpoint = isEditing
    ? `/projects/${projectId}/tasks/${taskId}`
    : `/projects/${projectId}/tasks`;

  // Construir el payload
  const payload = {
    title: document.getElementById("taskTitle").value,
    description: document.getElementById("taskDescription").value,
    status: document.getElementById("taskStatusSelect").value,
    priority: document.getElementById("taskPrioritySelect").value,
    assigned_to: document.getElementById("taskAssigneeSelect").value || null, // Enviar null si está "Sin asignar"
    due_date: document.getElementById("taskDueDate").value || null, // Enviar null si está vacío
  };

  // En modo CREAR, el project_id va en el payload (ya lo hace el backend)
  // En modo EDITAR, no es necesario.

  try {
    await apiRequest(endpoint, method, payload);

    Swal.fire(
      isEditing ? "¡Actualizado!" : "¡Creado!",
      "La tarea ha sido guardada.",
      "success"
    );

    closeTaskModal();

    // --- ¡IMPORTANTE! Refrescar el Kanban para ver el cambio ---
    const mainContainer = document.querySelector(".mainData");
    // Volvemos a llamar a renderKanbanBoard para recargar todo
    await renderKanbanBoard(mainContainer, projectId);
  } catch (error) {
    console.error("Error al guardar la tarea:", error);
    Swal.fire(
      "Error",
      `No se pudo guardar la tarea: ${error.message}`,
      "error"
    );
  }
}
// (Pega esta nueva función en scripts/taskManager.js)

/**
 * Maneja el clic en el botón "Eliminar Tarea".
 */
async function handleDeleteTask(e) {
  e.preventDefault(); // Prevenir cualquier acción de formulario

  const projectId = taskForm.dataset.projectId;
  const taskId = taskForm.dataset.taskId;

  if (!taskId || !projectId) {
    Swal.fire(
      "Error",
      "No se ha seleccionado ninguna tarea para eliminar.",
      "error"
    );
    return;
  }

  // 1. Confirmar con SweetAlert
  Swal.fire({
    title: "¿Estás seguro?",
    text: "¡No podrás revertir esto!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Sí, ¡eliminar tarea!",
    cancelButtonText: "Cancelar",
  }).then(async (result) => {
    if (result.isConfirmed) {
      // 2. Si se confirma, llamar a la API
      try {
        await apiRequest(`/projects/${projectId}/tasks/${taskId}`, "DELETE");

        Swal.fire("¡Eliminada!", "La tarea ha sido eliminada.", "success");

        closeTaskModal();

        // 3. Refrescar el Kanban
        const mainContainer = document.querySelector(".mainData");
        await renderKanbanBoard(mainContainer, projectId);
      } catch (error) {
        console.error("Error al eliminar la tarea:", error);
        Swal.fire(
          "Error",
          `No se pudo eliminar la tarea: ${error.message}`,
          "error"
        );
      }
    }
  });
}

import { apiRequest } from "./api.js";
import { appState } from "./crudMainPage.js"; // Necesitamos el appState para el refresh

let currentTaskSubmitHandler = null;
let currentCommentSubmitHandler = null;

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

// EN: scripts/taskManager.js

function createTaskCard(task) {
  let dueDateHtml = "";
  let dueDateClass = ""; // Para el borde
  let priorityClass = ""; // Para el texto h4

  const isCompleted = task.status === "Hecho";
  const isDraggable = !isCompleted;
  const completedClass = isCompleted ? "is-completed" : ""; // Para el estilo "hecho" (atenuado, tachado)

  // --- INICIO DE LA NUEVA LÓGICA DE FECHAS ---

  if (isCompleted) {
    // --- LÓGICA PARA TAREAS CERRADAS ---

    // Comprobar si tenía fecha de entrega y fecha de finalización
    if (task.completed_at && task.due_date) {
      const completedDate = new Date(task.completed_at);
      const dueDate = new Date(task.due_date);
      completedDate.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      // Comparamos: ¿Se completó *después* de la fecha de entrega?
      const diffTime = completedDate.getTime() - dueDate.getTime();
      // Usamos Math.floor para ser justos (completar el mismo día es 0)
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        // Se completó a tiempo (el mismo día o antes)
        dueDateHtml = `<span class="task-due completed-on-time">✅ Finalizada a tiempo</span>`;
      } else {
        // Se completó tarde
        dueDateClass = "due-overdue"; // Mantenemos el borde rojo para que se note
        dueDateHtml = `<span class="task-due completed-late">🛑 Finalizada con ${diffDays} ${
          diffDays === 1 ? "día" : "días"
        } de retraso</span>`;
      }
    } else {
      // Se completó, pero no tenía fecha de entrega (o de finalización, si hay datos viejos)
      dueDateHtml = `<span class="task-due completed-on-time">✅ Finalizada</span>`;
    }
  } else {
    // --- LÓGICA PARA TAREAS ABIERTAS (Tu código actual) ---
    if (task.due_date) {
      const today = new Date();
      const dueDate = new Date(task.due_date);
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        const daysAgo = Math.abs(diffDays);
        dueDateClass = "due-overdue"; // Borde rojo
        dueDateHtml = `<span class="task-due overdue">Venció hace ${daysAgo} ${
          daysAgo === 1 ? "día" : "días"
        }</span>`;
      } else if (diffDays === 0) {
        dueDateClass = "due-today"; // Borde naranja
        dueDateHtml = `<span class="task-due due-today">⚠️ Vence Hoy</span>`;
      } else if (diffDays === 1) {
        dueDateClass = "due-soon"; // Borde azul
        dueDateHtml = `<span class="task-due due-soon">Vence Mañana</span>`;
      } else {
        dueDateHtml = `<span class="task-due">Vence en ${diffDays} días</span>`;
      }
    }
    // Si no tiene due_date y no está completada, no se muestra nada.
  }

  // --- Lógica de Prioridad (sin cambios) ---
  if (task.priority === "Alta") priorityClass = "priority-alta-text";
  else if (task.priority === "Baja") priorityClass = "priority-baja-text";

  // Genera el HTML de la tarjeta
  return `
    <div class="task-card ${dueDateClass} ${completedClass}" draggable="${isDraggable}" data-task-id="${
    task.id
  }">
      <h4 class="${priorityClass}">${task.title}</h4>
      <p>Prioridad: ${task.priority}</p>
      ${
        task.assigned_to_name
          ? `<span class="task-assignee">${task.assigned_to_name}</span>`
          : ""
      }
      ${dueDateHtml}
    </div>
  `;
}

// --- 3. MANEJADORES DE EVENTOS (IMPLEMENTACIÓN COMPLETA) ---

function addKanbanEventListeners(container, projectId, members) {
  const taskLists = container.querySelectorAll(".kanban-tasks-list");
  const cards = container.querySelectorAll(".task-card");
  const addButtons = container.querySelectorAll(".add-task-btn");

  // --- A. Eventos de Drag & Drop ---

  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      // (No puedes arrastrar si draggable="false", así que esto ya es seguro)
      e.dataTransfer.setData("text/plain", card.dataset.taskId);
      setTimeout(() => card.classList.add("dragging"), 0);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });
  });

  taskLists.forEach((list) => {
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      // Muestra dónde caería la tarjeta
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

      // --- ¡INICIO DE LA NUEVA LÓGICA DE CONFIRMACIÓN! ---

      // Si el nuevo estado es "Hecho", pedimos confirmación
      if (newStatus === "Hecho") {
        Swal.fire({
          title: "¿Finalizar esta tarea?",
          text: "Esto marcará la tarea como completada y la bloqueará.",
          icon: "question",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Sí, ¡finalizar!",
          cancelButtonText: "Cancelar",
        }).then(async (result) => {
          if (result.isConfirmed) {
            // Usuario confirmó: Llama a la API y refresca
            await handleTaskDrop(taskId, newStatus, projectId, container);
          } else {
            // Usuario canceló: Refrescamos el tablero para
            // devolver la tarjeta a su columna original.
            await renderKanbanBoard(container, projectId);
          }
        });
      } else {
        // Si no es "Hecho" (ej. "En Progreso"), solo llama a la API y refresca
        await handleTaskDrop(taskId, newStatus, projectId, container);
      }
      // --- FIN DE LA NUEVA LÓGICA ---
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
      // Prevenir que se abra el modal si estamos arrastrando
      if (e.target.closest(".dragging")) return;

      const taskId = e.target.closest(".task-card").dataset.taskId;
      openTaskModal(taskId, projectId, null, members); // taskId = Modo Edición
    });
  });
}

/**
 * Funcion para llamar a la API para actualizar el estado y refresca el tablero completo.
 */
async function handleTaskDrop(taskId, newStatus, projectId, container) {
  try {
    // 1. Llama a la API para actualizar el estado
    await apiRequest(`/projects/${projectId}/tasks/${taskId}/status`, "PATCH", {
      status: newStatus,
    });
    // Refrescamos el tablero completo. Esto:
    // - Muestra la tarjeta en la nueva columna.
    // - Vuelve a ejecutar createTaskCard(), aplicando 'draggable="false"'
    //   y la clase '.is-completed' a la tarjeta que se movió a "Hecho".
    await renderKanbanBoard(container, projectId);
  } catch (error) {
    console.error("Error al mover la tarea:", error);
    Swal.fire("Error", `No se pudo mover la tarea: ${error.message}`, "error");
    // Si la API falla, refrescamos para restaurar el estado original
    await renderKanbanBoard(container, projectId);
  }
}
//LÓGICA DEL MODAL DE TAREAS(Asume que el HTML del modal está en mainPage.html con id="taskModal")

const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const taskFormTitle = document.getElementById("taskFormTitle");
const submitTaskBtn = document.getElementById("submitTaskBtn");
const taskAssigneeSelect = document.getElementById("taskAssigneeSelect");
const commentsSection = document.querySelector(".task-comments-section");
const commentsListEl = document.getElementById("taskCommentsList");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
/**
 * Abre el modal de Tareas, sea para Crear o Editar.
 */
async function openTaskModal(taskId, projectId, status, members) {
  const form = taskForm;
  form.reset();
  commentForm.reset();

  // 1. Definir los elementos del formulario
  const taskTitleInput = document.getElementById("taskTitle");
  const taskDescInput = document.getElementById("taskDescription");
  const taskStatusSelect = document.getElementById("taskStatusSelect");
  const taskPrioritySelect = document.getElementById("taskPrioritySelect");
  const taskDueDateInput = document.getElementById("taskDueDate");
  const deleteBtn = document.getElementById("deleteTaskBtn");
  const formFields = [
    taskTitleInput,
    taskDescInput,
    taskStatusSelect,
    taskPrioritySelect,
    taskAssigneeSelect,
    taskDueDateInput,
  ];

  // 2. Poblar el <select> de miembros
  taskAssigneeSelect.innerHTML = '<option value="">(Sin asignar)</option>';
  if (members && Array.isArray(members)) {
    members.forEach((member) => {
      taskAssigneeSelect.innerHTML += `
        <option value="${member.id}">${member.full_name}</option>
      `;
    });
  }

  form.dataset.projectId = projectId;

  // 3. Lógica de Permisos
  const project = appState.allProjects.find((p) => p.id == projectId);
  const isOwner = project && project.created_by === appState.currentUser.id;
  const member = members.find((m) => m.id === appState.currentUser.id);
  const isProjectAdmin = member && member.role_in_project === "admin";
  const canManage = isOwner || isProjectAdmin;

  if (taskId) {
    // --- MODO EDICIÓN ---
    taskFormTitle.textContent = "Editar Tarea";
    submitTaskBtn.textContent = "Guardar Cambios";
    form.dataset.taskId = taskId;
    commentsSection.style.display = "none";

    try {
      const [taskResponse, commentsResponse] = await Promise.all([
        apiRequest(`/projects/${projectId}/tasks/${taskId}`, "GET"),
        apiRequest(`/projects/${projectId}/tasks/${taskId}/comments`, "GET"),
      ]);
      const task = taskResponse.data;
      const comments = commentsResponse.data;

      // Rellenar el formulario
      taskTitleInput.value = task.title;
      taskDescInput.value = task.description || "";
      taskStatusSelect.value = task.status;
      taskPrioritySelect.value = task.priority;
      taskAssigneeSelect.value = task.assigned_to || "";
      taskDueDateInput.value = task.due_date ? task.due_date.split("T")[0] : "";

      populateComments(comments);
      commentsSection.style.display = "block";

      // --- ¡CORRECCIÓN DE LISTENER (A)! ---
      // Creamos la función y la guardamos en la variable global
      currentCommentSubmitHandler = (e) =>
        handleCommentSubmit(e, projectId, taskId);
      // La añadimos SIN { once: true }
      commentForm.addEventListener("submit", currentCommentSubmitHandler);

      // Lógica de Read-Only
      const isCompleted = task.status === "Hecho";
      if (isCompleted && !canManage) {
        taskFormTitle.textContent = "Ver Tarea (Completada)";
        formFields.forEach((field) => (field.disabled = true));
        submitTaskBtn.style.display = "none";
        deleteBtn.style.display = "none";
        commentForm.style.display = "none";
      } else {
        formFields.forEach((field) => (field.disabled = false));
        submitTaskBtn.style.display = "block";
        deleteBtn.style.display = canManage ? "block" : "none";
        commentForm.style.display = "flex";
      }
    } catch (error) {
      Swal.fire(
        "Error",
        `No se pudieron cargar los datos: ${error.message}`,
        "error"
      );
      return;
    }
  } else {
    // --- MODO CREACIÓN ---
    taskFormTitle.textContent = "Crear Nueva Tarea";
    submitTaskBtn.textContent = "Crear Tarea";
    form.dataset.taskId = "";
    formFields.forEach((field) => (field.disabled = false));
    submitTaskBtn.style.display = "block";
    deleteBtn.style.display = "none";
    commentsSection.style.display = "none";
    if (status) {
      taskStatusSelect.value = status;
    }
  }

  // Mostrar el modal
  taskModal.classList.remove("hidden");
  document.querySelector(".overlay").classList.remove("hidden");
  taskModal
    .querySelector(".closeWindow")
    .addEventListener("click", closeTaskModal);
  document.querySelector(".overlay").addEventListener("click", closeTaskModal);

  // Creamos y guardamos el listener de detalles de tarea
  currentTaskSubmitHandler = (e) => handleTaskFormSubmit(e);
  form.addEventListener("submit", currentTaskSubmitHandler);
  deleteBtn.addEventListener("click", handleDeleteTask, { once: true });
}

/**
 * Cierra y resetea el modal de tareas.
 */
function closeTaskModal() {
  taskModal.classList.add("hidden");
  document.querySelector(".overlay").classList.add("hidden");

  // --- ¡CORRECCIÓN DE LIMPIEZA! ---
  // 1. Limpiamos los listeners de cierre
  taskModal
    .querySelector(".closeWindow")
    .removeEventListener("click", closeTaskModal);
  document
    .querySelector(".overlay")
    .removeEventListener("click", closeTaskModal);

  // 2. Limpiamos el listener del formulario de TAREAS (si existe)
  if (currentTaskSubmitHandler) {
    taskForm.removeEventListener("submit", currentTaskSubmitHandler);
    currentTaskSubmitHandler = null; // Limpiamos la variable
  }

  // 3. Limpiamos el listener del formulario de COMENTARIOS (si existe)
  if (currentCommentSubmitHandler) {
    commentForm.removeEventListener("submit", currentCommentSubmitHandler);
    currentCommentSubmitHandler = null; // Limpiamos la variable
  }
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
/**
 * Renderiza la lista de comentarios en el HTML.
 */
function populateComments(comments) {
  if (!comments || comments.length === 0) {
    commentsListEl.innerHTML =
      "<p class='no-comments-msg'>No hay comentarios aún.</p>";
    return;
  }

  commentsListEl.innerHTML = comments
    .map(
      (comment) => `
    <div class="comment-item">
      <strong class="comment-author">${comment.author_name}</strong>
      <p class="comment-content">${comment.content}</p>
      <small class="comment-date">${new Date(
        comment.created_at
      ).toLocaleString()}</small>
    </div>
  `
    )
    .join("");

  // Hacer scroll al último comentario
  commentsListEl.scrollTop = commentsListEl.scrollHeight;
}

/**
 * Maneja el envío del formulario de nuevo comentario.
 */
async function handleCommentSubmit(e, projectId, taskId) {
  e.preventDefault();
  const content = commentInput.value.trim();
  if (!content) return;

  // Deshabilitar el formulario para evitar envíos duplicados
  commentInput.disabled = true;
  commentForm.querySelector('button[type="submit"]').disabled = true;

  try {
    // 1. Enviar el nuevo comentario a la API
    const response = await apiRequest(
      `/projects/${projectId}/tasks/${taskId}/comments`,
      "POST",
      { content }
    );
    const newComment = response.data; // La API devuelve el comentario con el nombre

    // 2. Añadir el nuevo comentario al DOM (sin recargar todo)
    const commentHTML = `
      <div class="comment-item">
        <strong class="comment-author">${newComment.author_name}</strong>
        <p class="comment-content">${newComment.content}</p>
        <small class="comment-date">${new Date(
          newComment.created_at
        ).toLocaleString()}</small>
      </div>
    `;

    // Limpiar el "No hay comentarios" si es el primero
    const noCommentsMsg = commentsListEl.querySelector(".no-comments-msg");
    if (noCommentsMsg) {
      commentsListEl.innerHTML = "";
    }

    commentsListEl.innerHTML += commentHTML;
    commentInput.value = ""; // Limpiar el input

    // Hacer scroll al nuevo comentario
    commentsListEl.scrollTop = commentsListEl.scrollHeight;
  } catch (error) {
    console.error("Error al publicar comentario:", error);
    Swal.fire(
      "Error",
      `No se pudo publicar el comentario: ${error.message}`,
      "error"
    );
  } finally {
    // Volver a habilitar el formulario
    commentInput.disabled = false;
    commentForm.querySelector('button[type="submit"]').disabled = false;
    commentInput.focus();
  }
}

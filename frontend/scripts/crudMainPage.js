"use strict";

// --- CONFIGURACIÓN Y CONSTANTES ---
const BASE_API_URL = "https://hacerya.onrender.com/api";

// Declaraciones de los DOS MODALES y sus elementos
const createModal = document.querySelector(".createWindow"); // Modal de Creación
const detailsModal = document.querySelector(".detailsWindow"); // Modal de Detalles (SOLO para Proyectos ahora)
const overlay = document.querySelector(".overlay");
const detailsContentArea = document.getElementById("detailsContent"); // Área donde se inyectarán los detalles

// Botón de SUBMIT DENTRO del modal de creación
const submitCreateBtn = document.getElementById("submitCreateBtn");

// Elementos de la UI principal
const btnChangeView = document.querySelectorAll(".changeViewNav");
const changeViewLogo = document.getElementById("changeViewLogo");
const formTitle = document.getElementById("formTitle"); // Título en el modal de creación
const inputTitle = document.getElementById("inputTitle");
const inputDescription = document.getElementById("inputDescription");
const mainContentArea = document.querySelector(".mainData");
const sideBarButtons = document.querySelectorAll(".sideBarBtn");
const subtitleElement = document.querySelector(".subtitle"); // Título principal (h1)
const createActionButton = document.getElementById("createNavButton"); // Botón principal de acción superior

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let appState = {
  currentWorkspaceId: null, // ID del workspace actualmente visible (null para Proyectos Personales)
  currentWorkspaceName: null, // Nombre para títulos
  currentView: "mis-proyectos",
  allProjects: [], // Cache de todos los proyectos para filtrado local
  allWorkspaces: [], // Cache de todos los workspaces
  currentUser: null, // Almacenar datos del usuario logueado
};

// --- UTILITIES (Modal) ---

// --- UTILITIES (Modal) ---

// NUEVA FUNCIÓN: Abre modal de Creación/Edición
const openEditCreateWindow = function (
  isEditing = false,
  item = null,
  type = null
) {
  // Limpiar inputs
  inputTitle.value = "";
  inputDescription.value = "";

  // Configurar para CREACIÓN o EDICIÓN
  if (isEditing && item && type) {
    appState.editingItem = { type: type, id: item.id, data: item }; // Guardar estado de edición

    // Pre-rellenar formulario
    formTitle.textContent = `Editar ${
      type === "project" ? "Proyecto" : "Workspace"
    }: ${item.name}`;
    inputTitle.value = item.name || "";
    inputDescription.value = item.description || "";

    // Cambiar botón de submit a "Guardar Cambios"
    if (submitCreateBtn) {
      submitCreateBtn.innerHTML = `
                Guardar Cambios
                <img src="images/saveIcon.png" class="actionIcon" alt="guardar"/> `;
      submitCreateBtn.setAttribute("data-submit-type", "edit"); // Indicar modo edición
    }
  } else {
    appState.editingItem = null; // Asegurar que no estamos en modo edición

    // Configurar para CREACIÓN (basado en la vista actual)
    let formTitleText = "";
    let inputTitlePlaceholder = "";
    let inputDescPlaceholder = "";
    let submitBtnText = "";
    let submitBtnIconSrc = "";
    let creationType = "project"; // Tipo por defecto

    if (appState.currentView === "workspaces") {
      formTitleText = "Crea Un Nuevo Workspace Colaborativo";
      inputTitlePlaceholder = "Nombre del Workspace";
      inputDescPlaceholder = "Descripción del Workspace";
      submitBtnText = "Crear Workspace";
      submitBtnIconSrc = "images/workspacesLogo.png";
      creationType = "workspace";
    } else {
      // 'mis-proyectos' o 'viewWorkspaceProjects'
      const inWorkspace = appState.currentWorkspaceId !== null;
      formTitleText = inWorkspace
        ? `Crea Un Proyecto en "${appState.currentWorkspaceName}"`
        : "Crea Un Nuevo Proyecto Personal";
      inputTitlePlaceholder = "Nombre del Proyecto";
      inputDescPlaceholder = "Descripción del Proyecto";
      submitBtnText = "Crear Proyecto";
      submitBtnIconSrc = "images/addImage.png";
      creationType = "project";
    }

    formTitle.textContent = formTitleText;
    inputTitle.placeholder = inputTitlePlaceholder;
    inputDescription.placeholder = inputDescPlaceholder;

    if (submitCreateBtn) {
      submitCreateBtn.innerHTML = `
                ${submitBtnText}
                <img src="${submitBtnIconSrc}" alt="botón crear" class="actionIcon"/>
            `;
      submitCreateBtn.setAttribute("data-submit-type", creationType); // Indicar tipo creación
    }
  }

  createModal.classList.remove("hidden");
  overlay.classList.remove("hidden");
};

const openDetailsWindow = function () {
  // Solo para detalles de PROYECTO
  detailsModal.classList.remove("hidden");
  overlay.classList.remove("hidden");
};

const closeAnyWindow = function () {
  createModal.classList.add("hidden");
  detailsModal.classList.add("hidden");
  overlay.classList.add("hidden");
};

const changeView = function () {
  mainContentArea.classList.toggle("flexContainer");
  mainContentArea.classList.toggle("gridContainer");
  changeViewLogo.setAttribute(
    "src",
    `${
      mainContentArea.classList.contains("gridContainer")
        ? "images/display list.png"
        : "images/display grid button.png"
    }`
  );
};

// --- LOGIC: DATA FETCHING ---
const getToken = () => localStorage.getItem("token");

// FUNCIÓN DE FETCH GENERALIZADA (PARA GET, POST, PUT, DELETE)
const apiRequest = async (endpoint, method = "GET", body = null) => {
  const token = getToken();
  // Validar token para métodos que no sean GET (excepto login/register que no pasan por aquí)
  if (!token && method !== "GET") {
    console.error("Token no encontrado para solicitud autenticada.");
    // Considerar redirigir a login o mostrar mensaje
    // window.location.href = "login.html";
    throw new Error("Autenticación requerida.");
  }

  const options = {
    method: method,
    headers: {}, // Inicializar headers
  };

  if (token) {
    options.headers["Authorization"] = `Bearer ${token}`;
  }

  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_API_URL}${endpoint}`, options);

    // Manejo especial para respuestas sin contenido (ej. DELETE 204)
    if (response.status === 204) {
      return { success: true }; // Indica éxito sin datos
    }

    // Intentar parsear JSON solo si hay contenido
    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.indexOf("application/json") !== -1) {
      data = await response.json();
    } else {
      // Si no es JSON, verificar si la respuesta fue OK igualmente (podría ser texto)
      if (!response.ok) {
        // Si no fue OK y no es JSON, lanzar error genérico
        throw new Error(
          `Error ${response.status}: Respuesta inesperada del servidor.`
        );
      }
      // Si fue OK pero no JSON (raro para una API REST), devolver un estado simple
      return { success: true, status: response.status };
    }

    if (!response.ok) {
      // Usar el mensaje del JSON si existe, sino un mensaje genérico
      throw new Error(
        data.message ||
          data.error ||
          `Error ${response.status}: Fallo en la API.`
      );
    }
    return data; // Devuelve los datos JSON para GET, POST, PUT
  } catch (error) {
    console.error(`Error en API ${method} ${endpoint}:`, error); // Loguear el error completo
    // Mostrar error al usuario de forma más amigable
    // Por ejemplo, podrías tener un div#error-message en tu HTML
    // document.getElementById('error-message').textContent = `Error: ${error.message}`;
    throw error; // Propagar el error para manejo específico si es necesario
  }
};

// --- LOGIC: CONTENT RENDERING ---

/**
 * Función para construir el HTML de la tarjeta simplificada (CLICABLE).
 * SIN ESTILOS INLINE. Asume que style.css maneja .project-card, .workspace-card, .card-details
 */
const createCardHTML = (item, type) => {
  // Añadir clase 'clickable' para diferenciar la acción en el listener si es necesario
  // Aunque e.target.closest('.card-details') ya funciona bien.
  return `
        <div class="${type}-card flexContainer card-details" data-id="${
    item.id
  }" data-type="${type}">
            <h3>${type === "project" ? "📋" : "💼"} ${item.name}</h3>
            <p class="description-short">${
              item.description || "Sin descripción."
            }</p>
        </div>
    `;
};

/**
 * Carga y renderiza la vista de Proyectos (Personales o de Workspace).
 * @param {string|null} workspaceId - ID del workspace a filtrar (null para personales).
 * @param {string|null} workspaceName - Nombre del workspace (para el título).
 */
const renderProjects = async (workspaceId = null, workspaceName = null) => {
  mainContentArea.innerHTML =
    '<div class="loading-spinner">Cargando Proyectos...</div>';

  try {
    // Siempre recargar proyectos al renderizar esta vista
    const projectsData = await apiRequest("/projects");
    if (!projectsData) throw new Error("No se pudieron cargar los proyectos.");
    appState.allProjects = projectsData; // Actualizar cache global
  } catch (error) {
    mainContentArea.innerHTML = `<h2 class="error-message">❌ Error al cargar proyectos: ${error.message}</h2>`;
    return;
  }

  const isPersonalView = workspaceId === null;
  const currentUserId = appState.currentUser?.id;

  // FILTRADO SEGÚN LÓGICA REQUERIDA
  const filteredProjects = appState.allProjects.filter((p) => {
    if (isPersonalView) {
      // REQUISITO: Solo personales (is_personal: true) Y creados por el usuario logueado
      return p.is_personal === true && p.created_by == currentUserId;
    } else {
      // REQUISITO: Solo proyectos del workspace específico
      return p.workspace_id == workspaceId;
    }
  });

  // Actualizar estado y título principal
  appState.currentWorkspaceId = workspaceId;
  appState.currentWorkspaceName = workspaceName;
  subtitleElement.textContent = isPersonalView
    ? "Mis Proyectos Personales"
    : `${workspaceName} | Proyectos 📋`;
  document.title = `${subtitleElement.textContent} | HacerYA`;

  // Actualizar Botón de Acción Principal (Crear Proyecto) - SIEMPRE ES CREAR PROYECTO
  createActionButton.innerHTML = `
        Crear Proyecto
        <img src="images/addImage.png" alt="boton acción" class="actionIcon"/>
    `;
  createActionButton.setAttribute("data-action", "openProjectModal");
  createActionButton.style.display = "flex"; // Siempre visible en vistas de proyectos

  // Renderizar resultado
  if (filteredProjects.length === 0) {
    const message = isPersonalView
      ? "Usa el botón 'Crear Proyecto' para empezar tu primer proyecto personal."
      : `Este workspace no tiene proyectos aún. Usa el botón superior para crear uno.`;
    mainContentArea.innerHTML = `
            <div class="empty-state">
                <h2>No hay proyectos que mostrar.</h2>
                <p>${message}</p>
            </div>
        `;
  } else {
    mainContentArea.innerHTML = filteredProjects
      .map((p) => createCardHTML(p, "project"))
      .join("");
  }
};

/**
 * Carga y renderiza la vista de Workspaces.
 */
const renderWorkspaces = async () => {
  mainContentArea.innerHTML =
    '<div class="loading-spinner">Cargando Workspaces...</div>';

  try {
    const workspacesData = await apiRequest("/workspaces");
    if (!workspacesData)
      throw new Error("No se pudieron cargar los workspaces.");
    appState.allWorkspaces = workspacesData;
  } catch (error) {
    mainContentArea.innerHTML = `<h2 class="error-message">❌ Error al cargar workspaces: ${error.message}</h2>`;
    return;
  }

  // Resetear contexto
  appState.currentWorkspaceId = null;
  appState.currentWorkspaceName = null;
  subtitleElement.textContent = "Workspaces";
  document.title = "Workspaces | HacerYA";

  // Actualizar botón de acción principal
  createActionButton.innerHTML = `
        Crear Workspace
        <img src="images/workspacesLogo.png" alt="boton acción" class="actionIcon"/>
    `;
  createActionButton.setAttribute("data-action", "openWorkspaceModal");
  createActionButton.style.display = "flex";

  if (appState.allWorkspaces.length === 0) {
    mainContentArea.innerHTML = `
            <div class="empty-state">
                <h2>No eres miembro de ningún Workspace.</h2>
                <p>Crea uno usando el botón superior.</p>
            </div>
        `;
  } else {
    mainContentArea.innerHTML = appState.allWorkspaces
      .map((w) => createCardHTML(w, "workspace"))
      .join("");
  }
};

const getStatsHTML = () => {
  subtitleElement.textContent = "Estadísticas y Reportes";
  document.title = "Estadísticas | HacerYA";
  createActionButton.style.display = "none";
  return `
        <div class="admin-view">
            <h2>Vista del Administrador 👮‍♂️</h2>
            <p>Aquí se listarán todas las estadisticas extraídas a partir de los projectos.</p>
        </div>
    `;
};

// --- Modal de Detalles (AHORA GENERALIZADO) ---
// --- Modal de Detalles (AHORA GENERALIZADO) ---
const openDetailsModal = (itemId, itemType) => {
  // <-- CORRECCIÓN: Firma restaurada
  // Buscar el objeto completo: Buscar en el cache de proyectos o workspaces
  const dataCache =
    itemType === "project" ? appState.allProjects : appState.allWorkspaces;
  const itemData = dataCache.find((item) => item.id == itemId);

  if (!itemData) {
    // El error ahora mostrará el tipo correcto
    console.error(`Error: Datos no encontrados para ${itemType} ID: ${itemId}`);
    return;
  }

  // Verificar si el usuario actual es el creador (para botones de admin/owner)
  const isOwner =
    appState.currentUser && appState.currentUser.id == itemData.created_by;

  // 1. Botones de Acción Dinámicos (DEPENDEN DE itemType)
  let actionButtonsHTML = "";
  let modalTitle = "";

  if (itemType === "project") {
    modalTitle = "Detalles del Proyecto 📋";
    // REQUISITO PROYECTOS: Editar, Eliminar (si es dueño), Ver Tareas
    actionButtonsHTML = `
            <button class="btn btnEdit panelBtn" data-id="${
              itemData.id
            }" data-type="project">Editar</button>
            ${
              isOwner
                ? `<button class="btn btnDelete panelBtn" data-id="${itemData.id}" data-type="project">Eliminar</button>`
                : ""
            }
            <button class="btn btnViewTasks panelBtn" data-id="${
              itemData.id
            }">Ver Tareas</button>
        `;
  } else if (itemType === "workspace") {
    modalTitle = "Detalles del Workspace 💼";
    // REQUISITO WORKSPACES: Editar, Eliminar (si es dueño), Añadir Miembro (si es dueño y no personal), Ver Proyectos
    actionButtonsHTML = `
            <button class="btn btnEdit panelBtn" data-id="${
              itemData.id
            }" data-type="workspace">Editar</button>
            ${
              isOwner
                ? `<button class="btn btnDelete panelBtn" data-id="${itemData.id}" data-type="workspace">Eliminar</button>`
                : ""
            }
            ${
              isOwner && !itemData.is_personal
                ? `<button class="btn btnAddMember panelBtn" data-id="${itemData.id}">Añadir Miembro</button>`
                : ""
            }
            <button class="btn btnViewProjects panelBtn" data-id="${
              itemData.id
            }" data-name="${itemData.name}">Ver Proyectos</button>
        `;
  }

  // 2. Crear el HTML detallado para inyectar en el modal
  const detailHTML = `
        <div class="detailsContent">
            <h1>${modalTitle}</h1>
            <h2>${itemData.name}</h2>
            <p><strong>Descripción:</strong> ${
              itemData.description || "N/A"
            }</p>
            <p><strong>Creador:</strong> ${itemData.created_by_name}</p>
            ${
              itemType === "workspace"
                ? `<p><strong>Tipo:</strong> ${
                    itemData.is_personal ? "Personal" : "Colaborativo"
                  }</p>`
                : ""
            }
            ${
              itemType === "project"
                ? `<p><strong>Tipo:</strong> ${
                    itemData.is_personal ? "Personal" : "De Workspace"
                  }</p>`
                : ""
            }
            <p class="itemId hidden" style="display: none;">ID: ${
              itemData.id
            }</p> <!-- Mantenido oculto -->
            <div class="detailActions flexContainer">
                ${actionButtonsHTML}
            </div>
        </div>
    `;

  // 3. Inyectar y abrir el modal de DETALLES
  detailsContentArea.innerHTML = detailHTML;
  openDetailsWindow(); // <-- Asegurarse de que esta línea se ejecute
};
// --- Función principal para cambiar la vista y actualizar UI ---
const renderView = async (
  viewName,
  workspaceId = null,
  workspaceName = null
) => {
  appState.currentView = viewName; // Actualizar vista actual

  // Resetear contexto si es una vista principal del sidebar
  if (["mis-proyectos", "workspaces", "admin-dashboard"].includes(viewName)) {
    appState.currentWorkspaceId = null;
    appState.currentWorkspaceName = null;
  }

  // Ejecutar la función de renderizado correspondiente
  switch (viewName) {
    case "mis-proyectos":
      await renderProjects(null); // Espera a que termine
      break;
    case "workspaces":
      await renderWorkspaces(); // Espera a que termine
      break;
    case "admin-dashboard":
      mainContentArea.innerHTML = getStatsHTML(); // Síncrono
      break;
    case "viewWorkspaceProjects":
      await renderProjects(workspaceId, workspaceName); // Espera a que termine
      break;
    default:
      mainContentArea.innerHTML = "<h2>Vista no encontrada.</h2>";
      createActionButton.style.display = "none";
  }

  // Actualizar Sidebar activo
  sideBarButtons.forEach((btn) => {
    const targetView = btn.getAttribute("href").replace("#", "");
    const isActive =
      targetView === viewName ||
      (viewName === "viewWorkspaceProjects" && targetView === "workspaces");
    btn.classList.toggle("active", isActive);
  });
};

// --- BASE EVENT LISTENERS ---

document
  .querySelector(".createWindow .closeWindow")
  .addEventListener("click", closeAnyWindow);
document
  .querySelector(".detailsWindow .closeWindow")
  .addEventListener("click", closeAnyWindow);
overlay.addEventListener("click", closeAnyWindow);
document.addEventListener("keydown", function (e) {
  if (
    e.key === "Escape" &&
    (!createModal.classList.contains("hidden") ||
      !detailsModal.classList.contains("hidden"))
  ) {
    closeAnyWindow();
  }
});
btnChangeView.forEach((btn) => {
  btn.addEventListener("click", changeView);
});

// --- INICIALIZACIÓN Y LISTENERS PRINCIPALES ---
document.addEventListener("DOMContentLoaded", async () => {
  // 0. Obtener datos del usuario logueado
  const userData = localStorage.getItem("user");
  if (!userData) {
    window.location.href = "login.html";
    return;
  }
  try {
    const parsedData = JSON.parse(userData);
    // Asegurarse de que 'user' exista dentro de los datos parseados
    if (!parsedData || !parsedData.user)
      throw new Error("Formato de datos de usuario inválido.");
    appState.currentUser = parsedData.user;
  } catch (e) {
    console.error("Error parsing user data, redirecting to login", e);
    localStorage.clear();
    window.location.href = "login.html";
    return;
  }

  // 1. Carga inicial basada en Hash
  const initialHash = window.location.hash.replace("#", "");
  let viewToLoad = "mis-proyectos";
  let initialWorkspaceId = null;
  let initialWorkspaceName = null; // Necesario si cargamos directo

  if (initialHash.startsWith("workspaces/")) {
    const parts = initialHash.split("/");
    if (parts.length >= 3 && parts[2] === "projects") {
      // Intenta cargar directo a los proyectos de un workspace
      initialWorkspaceId = parts[1];
      // Necesitamos cargar los workspaces primero para obtener el nombre
      await renderView("workspaces"); // Carga y cachea workspaces
      const workspace = appState.allWorkspaces.find(
        (w) => w.id == initialWorkspaceId
      );
      if (workspace) {
        viewToLoad = "viewWorkspaceProjects";
        initialWorkspaceName = workspace.name;
        // Llama a renderView AHORA con los datos correctos
        await renderView(viewToLoad, initialWorkspaceId, initialWorkspaceName);
      } else {
        console.warn(
          `Workspace ID ${initialWorkspaceId} no encontrado en hash inicial.`
        );
        viewToLoad = "workspaces"; // Fallback a la lista de workspaces
        await renderView(viewToLoad); // Renderiza la lista general
        window.history.replaceState(null, "", "#workspaces"); // Corregir hash
      }
    } else {
      viewToLoad = "workspaces"; // Cargar lista si el hash es solo #workspaces o inválido
      await renderView(viewToLoad);
    }
  } else if (["workspaces", "admin-dashboard"].includes(initialHash)) {
    viewToLoad = initialHash;
    await renderView(viewToLoad);
  } else {
    // 'mis-proyectos' o hash inválido/vacío
    viewToLoad = "mis-proyectos";
    await renderView(viewToLoad);
  }

  // Corrección de URL inicial si no había hash o era inválido
  if (!initialHash && viewToLoad === "mis-proyectos") {
    window.history.replaceState(null, "", "#mis-proyectos");
  }

  // Listener para el botón de acción principal (Superior - Crear)
  createActionButton.addEventListener("click", () => {
    // Abre el modal configurado para CREACIÓN
    openEditCreateWindow(false); // Pasar false para indicar que es creación
  });

  // Listener DELEGADO para clicks en las tarjetas
  // Listener DELEGADO para clicks en las tarjetas (SIMPLIFICADO)
  mainContentArea.addEventListener("click", async (e) => {
    const card = e.target.closest(".card-details");
    if (card) {
      const itemId = card.getAttribute("data-id");
      const itemType = card.getAttribute("data-type"); // 'project' o 'workspace'

      // CORRECCIÓN: Ahora AMBOS tipos abren el modal de detalles
      if (itemId && itemType) {
        openDetailsModal(itemId, itemType); // Llamar siempre a la función del modal
      }
    }
  });

  // Listener DELEGADO para botones DENTRO del modal de DETALLES (AHORA GENERALIZADO)
  detailsModal.addEventListener("click", async (e) => {
    const targetButton = e.target.closest(".panelBtn");
    if (!targetButton) return;

    const itemId = targetButton.getAttribute("data-id"); // ID del Proyecto o Workspace
    // IMPORTANTE: Asegúrate que los botones en openDetailsModal tengan data-type="project" o data-type="workspace"
    const itemType = targetButton.getAttribute("data-type");

    if (!itemId)
      return console.error("Botón sin data-id en modal de detalles.");

    // --- Lógica según el botón presionado ---

    // Botones Comunes (Editar / Eliminar)
    if (targetButton.classList.contains("btnEdit")) {
      if (!itemType) return console.error("Botón Editar sin data-type.");
      // Buscar datos en el cache correspondiente
      const dataCache =
        itemType === "project" ? appState.allProjects : appState.allWorkspaces;
      const itemData = dataCache.find((item) => item.id == itemId);
      if (itemData) {
        closeAnyWindow(); // Cierra modal detalles
        openEditCreateWindow(true, itemData, itemType); // Abre modal creación en modo EDICIÓN
      } else {
        console.error("Datos no encontrados para editar.");
      }
    } else if (targetButton.classList.contains("btnDelete")) {
      if (!itemType) return console.error("Botón Eliminar sin data-type.");
      const itemName =
        targetButton.closest(".detailsContent")?.querySelector("h2")
          ?.textContent ||
        (itemType === "project" ? "este proyecto" : "este workspace");
      const confirmMessage =
        itemType === "project"
          ? `¿Eliminar el proyecto "${itemName}"?`
          : `¿Eliminar el workspace "${itemName}" y TODOS sus proyectos asociados?`; // Mensaje más claro para workspace

      const confirmed = confirm(confirmMessage); // Reemplazar con modal no bloqueante

      if (confirmed) {
        const endpoint = `/${itemType}s/${itemId}`; // /projects/:id o /workspaces/:id
        try {
          await apiRequest(endpoint, "DELETE");
          console.log(`${itemType} ${itemId} eliminado.`);
          closeAnyWindow();
          // Limpiar cache y recargar vista
          if (itemType === "project") appState.allProjects = [];
          if (itemType === "workspace") appState.allWorkspaces = []; // Limpiar workspaces si se elimina uno
          // Determinar a qué vista volver (si eliminamos workspace, volvemos a la lista)
          const viewToRefresh =
            itemType === "workspace" ? "workspaces" : appState.currentView;
          await renderView(
            viewToRefresh,
            appState.currentWorkspaceId,
            appState.currentWorkspaceName
          );
          // Si eliminamos workspace, actualizar hash
          if (itemType === "workspace")
            window.history.pushState(null, "", "#workspaces");
        } catch (error) {
          alert(`Error al eliminar ${itemType}: ${error.message}`); // Reemplazar alert
        }
      }
    }
    // Botones Específicos de Proyecto
    else if (targetButton.classList.contains("btnViewTasks")) {
      console.log(`FUNCIONALIDAD FUTURA: Kanban para proyecto ID: ${itemId}`);
      closeAnyWindow();
    }
    // Botones Específicos de Workspace
    else if (targetButton.classList.contains("btnAddMember")) {
      console.log(
        `FUNCIONALIDAD FUTURA: Abrir modal para añadir miembro a workspace ID: ${itemId}`
      );
      // Aquí abrirías un nuevo modal o formulario para ingresar el email del miembro
      closeAnyWindow(); // Cerrar modal de detalles por ahora
    } else if (targetButton.classList.contains("btnViewProjects")) {
      const workspaceName = targetButton.getAttribute("data-name");
      closeAnyWindow(); // Cierra modal detalles
      // Cambia la vista principal a los proyectos de este workspace
      await renderView("viewWorkspaceProjects", itemId, workspaceName);
      window.history.pushState(null, "", `#workspaces/${itemId}/projects`);
    }
  });
  // Listener para el sidebar (Routing)
  sideBarButtons.forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const viewName = e.currentTarget.getAttribute("href").replace("#", "");
      await renderView(viewName);
      // Actualizar el hash solo si es una vista principal del sidebar
      if (
        ["mis-proyectos", "workspaces", "admin-dashboard"].includes(viewName)
      ) {
        window.history.pushState(null, "", "#" + viewName);
      }
    });
  });

  // Listener para el submit del formulario (CREAR o EDITAR)
  if (submitCreateBtn) {
    submitCreateBtn.addEventListener("click", async () => {
      const title = inputTitle.value.trim();
      const description = inputDescription.value.trim();
      const submitAction = submitCreateBtn.getAttribute("data-submit-type"); // 'project', 'workspace', o 'edit'

      if (!title) {
        console.error("Título es requerido.");
        inputTitle.focus();
        return;
      }

      // Deshabilitar botón
      submitCreateBtn.disabled = true;
      const originalButtonHTML = submitCreateBtn.innerHTML;
      submitCreateBtn.innerHTML =
        submitAction === "edit" ? "Guardando..." : "Creando...";

      let endpoint = "";
      let method = "POST";
      let payload = { name: title, description: description };
      let itemType = "project"; // Tipo para limpiar cache

      try {
        if (submitAction === "edit") {
          // MODO EDICIÓN
          method = "PUT"; // MÉTODO PUT PARA ACTUALIZAR
          if (!appState.editingItem) throw new Error("No hay item en edición.");
          const { type, id } = appState.editingItem;
          itemType = type;
          endpoint = `/${type}s/${id}`; // /projects/:id o /workspaces/:id
        } else {
          // MODO CREACIÓN
          itemType = submitAction; // 'project' or 'workspace'
          if (submitAction === "workspace") {
            endpoint = "/workspaces";
          } else {
            // Crear Proyecto
            endpoint = "/projects";
            const isPersonalProject = appState.currentWorkspaceId === null;
            payload.workspace_id = appState.currentWorkspaceId;
            payload.is_personal = isPersonalProject;
          }
        }

        const resultData = await apiRequest(endpoint, method, payload);

        closeAnyWindow(); // Cierra el modal de creación/edición
        console.log(
          `${submitAction === "edit" ? "Actualización" : "Creación"} exitosa:`,
          resultData
        );

        // Limpiar cache correspondiente
        if (itemType === "project") appState.allProjects = [];
        if (itemType === "workspace") appState.allWorkspaces = [];

        // Determinar vista a refrescar
        let viewToRefresh = appState.currentView;
        if (itemType === "project" && appState.currentWorkspaceId !== null) {
          viewToRefresh = "viewWorkspaceProjects"; // Si creamos/editamos proyecto en workspace
        } else if (
          itemType === "project" &&
          appState.currentWorkspaceId === null
        ) {
          viewToRefresh = "mis-proyectos"; // Si creamos/editamos proyecto personal
        } else if (itemType === "workspace") {
          viewToRefresh = "workspaces"; // Si creamos/editamos workspace
        }

        // Re-renderizar la vista actual
        await renderView(
          viewToRefresh,
          appState.currentWorkspaceId,
          appState.currentWorkspaceName
        );
      } catch (error) {
        console.error(
          `Error en ${
            submitAction === "edit" ? "edición" : "creación"
          } (${endpoint}):`,
          error
        );
        alert(`Error: ${error.message}`); // Reemplazar alert
      } finally {
        submitCreateBtn.disabled = false;
        // El botón se restaurará la próxima vez que se abra el modal
        appState.editingItem = null; // Resetear estado de edición
      }
    });
  }

  // Listener para cambios en el hash (navegación atrás/adelante del navegador)
  window.addEventListener("popstate", async (event) => {
    const hash = window.location.hash.replace("#", "");
    let viewToLoad = "mis-proyectos";
    let workspaceId = null;
    let workspaceName = null;

    if (hash.startsWith("workspaces/")) {
      const parts = hash.split("/");
      if (parts.length >= 3 && parts[2] === "projects") {
        viewToLoad = "viewWorkspaceProjects";
        workspaceId = parts[1];
        // Buscar nombre en cache (si no, tendríamos que cargarlo)
        const workspace = appState.allWorkspaces.find(
          (w) => w.id == workspaceId
        );
        workspaceName = workspace ? workspace.name : "Workspace"; // Fallback
      } else {
        viewToLoad = "workspaces";
      }
    } else if (["workspaces", "admin-dashboard"].includes(hash)) {
      viewToLoad = hash;
    }
    // Renderizar la vista correspondiente al hash
    await renderView(viewToLoad, workspaceId, workspaceName);
  });
});

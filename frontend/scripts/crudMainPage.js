"use strict";
import { renderKanbanBoard } from "./taskManager.js";
import { apiRequest } from "./api.js";
import { renderMemberModal } from "./workspaceMembers.js";
import { renderProjectMemberModal } from "./projectMembers.js";
import { renderAdminDashboard } from "./adminDashboard.js";
import { renderAdminPanel } from "./adminPanel.js";
//------------------------------------------------------------
// Declaraciones de los DOS MODALES y sus elementos
const createModal = document.querySelector(".createWindow"); // Modal de Creación
const detailsModal = document.querySelector(".detailsWindow"); // Modal de Detalles
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
const adminSections = document.querySelectorAll(".admin-link-hidden");
//ESTADO GLOBAL DE LA APLICACIÓN
export let appState = {
  currentWorkspaceId: null, // ID del workspace actualmente visible (null para Proyectos Personales)
  currentWorkspaceName: null, // Nombre para títulos
  currentView: "mis-proyectos",
  allProjects: [], // Cache de todos los proyectos para filtrado local
  allWorkspaces: [], // Cache de todos los workspaces
  currentUser: null, // Almacenar datos del usuario logueado
};

// Abre modal de Creación/Edición
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

    // Configurar para CREACIÓN
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

/**Función para construir el HTML de la tarjeta simplificada (CLICABLE)*/
const createCardHTML = (item, type) => {
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

/**Carga y renderiza la vista de Proyectos (Personales o de Workspace)*/
const renderProjects = async (workspaceId = null, workspaceName = null) => {
  mainContentArea.innerHTML =
    '<div class="loading-spinner">Cargando Proyectos...</div>';

  try {
    // Siempre recargar proyectos al renderizar esta vista
    const response = await apiRequest("/projects"); //Renombra a 'response'
    if (!response || !response.data)
      throw new Error("No se pudieron cargar los proyectos.");
    appState.allProjects = response.data; //Asigna solo la propiedad .data
  } catch (error) {
    mainContentArea.innerHTML = `<h2 class="error-message">❌ Error al cargar proyectos: ${error.message}</h2>`;
    return;
  }

  const isPersonalView = workspaceId === null;
  const currentUserId = appState.currentUser?.id;
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
    : `${workspaceName} | Proyectos`;
  document.title = `${subtitleElement.textContent} | HacerYA`;

  // Actualizar Botón de Acción Principal (Crear Proyecto)
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

/**Carga y renderiza la vista de Workspaces*/
const renderWorkspaces = async () => {
  mainContentArea.innerHTML =
    '<div class="loading-spinner">Cargando Workspaces...</div>';

  try {
    const response = await apiRequest("/workspaces");
    if (!response || !response.data)
      throw new Error("No se pudieron cargar los workspaces.");
    appState.allWorkspaces = response.data;
  } catch (error) {
    mainContentArea.innerHTML = `<h2 class="error-message">❌ Error al cargar workspaces: ${error.message}</h2>`;
    return;
  }

  //Resetear contexto
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

//Modal de Detalles
const openDetailsModal = (itemId, itemType) => {
  // Buscar el objeto completo: Buscar en el cache de proyectos o workspaces
  const dataCache =
    itemType === "project" ? appState.allProjects : appState.allWorkspaces;
  const itemData = dataCache.find((item) => item.id == itemId);

  if (!itemData) {
    // El error mostrará el tipo correcto
    console.error(`Error: Datos no encontrados para ${itemType} ID: ${itemId}`);
    return;
  }

  // Verificar si el usuario actual es el creador (para botones de admin/owner)
  const isOwner =
    appState.currentUser && appState.currentUser.id == itemData.created_by;
  // Lógica para Workspaces
  const isWorkspaceAdmin = itemData.current_user_role === "admin";
  const canManageWorkspace = isOwner || isWorkspaceAdmin;

  // Lógica para Proyectos
  const isProjectAdmin = itemData.current_user_role === "admin";
  const canManageProject = isOwner || isProjectAdmin;
  //Botones de Acción Dinámicos (DEPENDEN DE itemType)
  let actionButtonsHTML = "";
  let modalTitle = "";

  if (itemType === "project") {
    modalTitle = "Detalles del Proyecto 📋";
    // REQUISITO PROYECTOS: Editar y Eliminar solo si es creador o admin, Ver Tareas para ambos niveles de usuario
    actionButtonsHTML = `
            ${
              canManageProject
                ? `
            <button class="btn btnEdit panelBtn" data-id="${itemData.id}" data-type="project">Editar</button>`
                : ""
            }
            ${
              canManageProject
                ? `<button class="btn btnDelete panelBtn" data-id="${itemData.id}" data-type="project">Eliminar</button>`
                : ""
            }
            ${
              canManageProject && !itemData.is_personal
                ? `<button class="btn btnAddProjectMember panelBtn" data-id="${itemData.id}">Gestionar Miembros</button>`
                : ""
            }
            <button class="btn btnViewTasks panelBtn" data-id="${
              itemData.id
            }">Ver Tareas</button>
        `;
  } else if (itemType === "workspace") {
    modalTitle = "Detalles del Workspace 💼";
    // REQUISITO WORKSPACES: Editar y Eliminar (si es creador o admin), Gestionar Miembros (si es creador o admin y no personal), Ver Proyectos
    actionButtonsHTML = `
            ${
              canManageWorkspace
                ? `
                    <button class="btn btnEdit panelBtn" data-id="${itemData.id}" data-type="workspace">Editar</button>`
                : ""
            }
            ${
              canManageWorkspace
                ? `<button class="btn btnDelete panelBtn" data-id="${itemData.id}" data-type="workspace">Eliminar</button>`
                : ""
            }
            ${
              canManageWorkspace && !itemData.is_personal
                ? `<button class="btn btnAddMember panelBtn" data-id="${itemData.id}">Gestionar Miembros</button>`
                : ""
            }
            <button class="btn btnViewProjects panelBtn" data-id="${
              itemData.id
            }" data-name="${itemData.name}">Ver Proyectos</button>
        `;
  }

  // Crear el HTML detallado para inyectar en el modal
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

  // Inyectar y abrir el modal de DETALLES
  detailsContentArea.innerHTML = detailHTML;
  openDetailsWindow();
};
/**Función principal para cambiar la vista y actualizar UI*/
const renderView = async (
  viewName,
  workspaceId = null,
  workspaceName = null,
  projectId = null,
  projectName = null
) => {
  appState.currentView = viewName; // Actualizar vista actual

  // Resetear contexto si es una vista principal del sidebar
  if (["mis-proyectos", "workspaces", "admin-dashboard"].includes(viewName)) {
    appState.currentWorkspaceId = null;
    appState.currentWorkspaceName = null;
  }

  // Resetea el botón "Alternar Vista" para que sea visible por defecto en las vistas que lo usan
  btnChangeView.forEach((btn) => (btn.style.display = "flex"));
  // Ejecutar la función de renderizado correspondiente
  switch (viewName) {
    case "mis-proyectos":
      await renderProjects(null);
      break;
    case "workspaces":
      await renderWorkspaces();
      break;
    case "admin-dashboard":
      createActionButton.style.display = "none";
      btnChangeView.forEach((btn) => (btn.style.display = "none"));
      subtitleElement.textContent = "Estadísticas";
      document.title = "Estadísticas | HacerYA";
      await renderAdminDashboard(mainContentArea);
      break;
    case "admin-panel":
      subtitleElement.textContent = "Gestión de Usuarios";
      document.title = "Gestión de Usuarios | HacerYA";
      createActionButton.style.display = "none";
      btnChangeView.forEach((btn) => (btn.style.display = "none"));
      // Llama al nuevo especialista
      await renderAdminPanel(mainContentArea);
      break;
    case "viewWorkspaceProjects":
      await renderProjects(workspaceId, workspaceName);
      break;
    case "kanban":
      // Ocultar el botón de "Crear Proyecto/Workspace"
      createActionButton.style.display = "none";
      // Ocultar el botón de "Alternar Vista"
      btnChangeView.forEach((btn) => (btn.style.display = "none"));
      // Si estamos en un workspace, usa su nombre. Si no (proyecto personal), usa "Personal".
      const wsName = appState.currentWorkspaceName || "Personal";
      const projName = projectName || "Tareas";
      console.log(projName);
      subtitleElement.textContent = `${wsName} | ${projName}`;
      document.title = `${subtitleElement.textContent} | HacerYA`;
      mainContentArea.classList.add("flexContainer");
      mainContentArea.classList.remove("gridContainer");
      await renderKanbanBoard(mainContentArea, projectId);
      break;
    default:
      mainContentArea.innerHTML = "<h2>Vista no encontrada.</h2>";
      //Oculta ambos botones si la vista no se encuentra
      createActionButton.style.display = "none";
      btnChangeView.forEach((btn) => (btn.style.display = "none"));
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

//Listeners
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

document.addEventListener("DOMContentLoaded", async () => {
  //Obtener datos del usuario logueado
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
    if (adminSections.length > 0) {
      adminSections.forEach((e) => {
        e.style.display =
          appState.currentUser.role === "admin" ? "flex" : "none";
      });
    }
  } catch (e) {
    console.error(
      "Error parseando datos de usuario, redirigiendo a la pagina de inicio de sesion",
      e
    );
    localStorage.clear();
    window.location.href = "login.html";
    return;
  }

  //Carga inicial basada en Hash
  const initialHash = window.location.hash.replace("#", "");
  let viewToLoad = "mis-proyectos";
  let initialWorkspaceId = null;
  let initialWorkspaceName = null;

  if (initialHash.startsWith("workspaces/")) {
    const parts = initialHash.split("/");
    if (parts.length >= 3 && parts[2] === "projects") {
      // Intenta cargar directo a los proyectos de un workspace
      initialWorkspaceId = parts[1];
      // Necesitamos cargar los workspaces primero para obtener el nombre
      await renderView("workspaces");
      const workspace = appState.allWorkspaces.find(
        (w) => w.id == initialWorkspaceId
      );
      if (workspace) {
        viewToLoad = "viewWorkspaceProjects";
        initialWorkspaceName = workspace.name;
        await renderView(viewToLoad, initialWorkspaceId, initialWorkspaceName);
      } else {
        console.warn(
          `Workspace ID ${initialWorkspaceId} no encontrado en hash inicial.`
        );
        viewToLoad = "workspaces";
        await renderView(viewToLoad);
        window.history.replaceState(null, "", "#workspaces");
      }
    } else {
      viewToLoad = "workspaces"; // Cargar lista si el hash es solo #workspaces o inválido
      await renderView(viewToLoad);
    }
  } else if (
    ["workspaces", "admin-dashboard", "admin-panel"].includes(initialHash)
  ) {
    viewToLoad = initialHash;
    await renderView(viewToLoad);
  } else {
    // 'mis-proyectos' o hash inválido/vacío
    viewToLoad = "mis-proyectos";
    await renderView(viewToLoad);
  }

  if (!initialHash && viewToLoad === "mis-proyectos") {
    window.history.replaceState(null, "", "#mis-proyectos");
  }

  // Listener para el botón de acción principal (Superior - Crear)
  createActionButton.addEventListener("click", () => {
    // Abre el modal configurado para CREACIÓN
    openEditCreateWindow(false);
  });

  // Listener para clicks en las tarjetas
  mainContentArea.addEventListener("click", async (e) => {
    const card = e.target.closest(".card-details");
    if (card) {
      const itemId = card.getAttribute("data-id");
      const itemType = card.getAttribute("data-type"); // 'project' o 'workspace'
      if (itemId && itemType) {
        openDetailsModal(itemId, itemType);
      }
    }
  });

  // Listener para botones DENTRO del modal de DETALLES
  detailsModal.addEventListener("click", async (e) => {
    const targetButton = e.target.closest(".panelBtn");
    if (!targetButton) return;
    const itemId = targetButton.getAttribute("data-id"); // ID del Proyecto o Workspace
    const itemType = targetButton.getAttribute("data-type");

    if (!itemId)
      return console.error("Botón sin data-id en modal de detalles.");

    // Lógica según el botón presionado

    // Botones Comunes (Editar / Eliminar)
    if (targetButton.classList.contains("btnEdit")) {
      if (!itemType) return console.error("Botón Editar sin data-type.");
      // Buscar datos en el cache correspondiente
      const dataCache =
        itemType === "project" ? appState.allProjects : appState.allWorkspaces;
      const itemData = dataCache.find((item) => item.id == itemId);
      if (itemData) {
        closeAnyWindow();
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
          : `¿Eliminar el workspace "${itemName}" y TODOS sus proyectos asociados?`;

      const endpoint = `/${itemType}s/${itemId}`;
      Swal.fire({
        title: "¿Estás seguro?",
        text: confirmMessage,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Sí, ¡eliminar!",
        cancelButtonText: "Cancelar",
      }).then(async (result) => {
        if (result.isConfirmed) {
          // Si el usuario hizo clic en "Sí, eliminar"
          try {
            await apiRequest(endpoint, "DELETE");

            // Alerta de éxito
            Swal.fire(
              "¡Eliminado!",
              `${
                itemType === "project" ? "El proyecto" : "El workspace"
              } ha sido eliminado.`,
              "success"
            );

            closeAnyWindow();
            if (itemType === "project") appState.allProjects = [];
            if (itemType === "workspace") appState.allWorkspaces = [];

            const viewToRefresh =
              itemType === "workspace" ? "workspaces" : appState.currentView;

            await renderView(
              viewToRefresh,
              appState.currentWorkspaceId,
              appState.currentWorkspaceName
            );

            if (itemType === "workspace")
              window.history.pushState(null, "", "#workspaces");
          } catch (error) {
            Swal.fire(
              "Error",
              `Error al eliminar ${itemType}: ${error.message}`,
              "error"
            );
          }
        }
      });
    } else if (targetButton.classList.contains("btnViewTasks")) {
      closeAnyWindow();
      const projectId = itemId;

      //Obtenemos el nombre del proyecto desde el H2 del modal
      const projectName =
        targetButton.closest(".detailsContent")?.querySelector("h2")
          ?.textContent || "Proyecto";
      await renderView(
        "kanban",
        appState.currentWorkspaceId, // (El ID del workspace o null si es personal)
        appState.currentWorkspaceName, // (El Nombre del workspace o null)
        projectId,
        projectName
      );
      if (appState.currentWorkspaceId) {
        window.history.pushState(
          null,
          "",
          `#workspaces/${appState.currentWorkspaceId}/projects/${projectId}/tasks`
        );
      } else {
        window.history.pushState(null, "", `#projects/${projectId}/tasks`);
      }
    }
    // Botón Gestionar Miembros
    else if (targetButton.classList.contains("btnAddProjectMember")) {
      const projectId = itemId;
      closeAnyWindow();

      renderProjectMemberModal(projectId);
    }
    // Botones Específicos de Workspace
    else if (targetButton.classList.contains("btnAddMember")) {
      const workspaceId = itemId;

      //Cierra el modal de detalles actual
      closeAnyWindow();
      renderMemberModal(workspaceId);
    } else if (targetButton.classList.contains("btnViewProjects")) {
      const workspaceName = targetButton.getAttribute("data-name");
      closeAnyWindow();
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
        [
          "mis-proyectos",
          "workspaces",
          "admin-dashboard",
          "admin-panel",
        ].includes(viewName)
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
      const submitAction = submitCreateBtn.getAttribute("data-submit-type");

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
          endpoint = `/${type}s/${id}`;
        } else {
          // MODO CREACIÓN
          itemType = submitAction;
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

        const response = await apiRequest(endpoint, method, payload); // 1. Renombra

        closeAnyWindow();
        const successTitle =
          submitAction === "edit" ? "¡Actualizado!" : "¡Creado!";
        const successText = `El ${
          itemType === "project" ? "proyecto" : "workspace"
        } "${title}" ha sido guardado exitosamente.`;
        Swal.fire(successTitle, successText, "success");
        console.log(
          `${submitAction === "edit" ? "Actualización" : "Creación"} exitosa:`,
          response.data
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

        await renderView(
          viewToRefresh,
          appState.currentWorkspaceId,
          appState.currentWorkspaceName
        );
      } catch (error) {
        const errorTitle = `Error en ${
          submitAction === "edit" ? "edición" : "creación"
        }`;
        console.error(`${errorTitle} (${endpoint}):`, error);
        Swal.fire(errorTitle, error.message, "error");
      } finally {
        submitCreateBtn.disabled = false;
        submitCreateBtn.innerHTML = originalButtonHTML;
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
        // Buscar nombre en cache
        const workspace = appState.allWorkspaces.find(
          (w) => w.id == workspaceId
        );
        workspaceName = workspace ? workspace.name : "Workspace";
      } else {
        viewToLoad = "workspaces";
      }
    } else if (
      ["workspaces", "admin-dashboard", "admin-panel"].includes(hash)
    ) {
      viewToLoad = hash;
    }
    await renderView(viewToLoad, workspaceId, workspaceName);
  });
});

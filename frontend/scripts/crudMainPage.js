"use strict";

const modal = document.querySelector(".createWindow");
const overlay = document.querySelector(".overlay");
const btnCloseWindow = document.querySelector(".closeWindow");
const btnsMainAction = document.querySelectorAll(".mainActionBtn"); // Colección de botones a actualizar
const btnChangeView = document.querySelectorAll(".changeViewNav");
const changeViewLogo = document.getElementById("changeViewLogo");
const formTitle = document.getElementById("formTitle");
const inputTitle = document.getElementById("inputTitle");
const inputDescription = document.getElementById("inputDescription");
const mainContentArea = document.querySelector(".mainData");
const sideBarButtons = document.querySelectorAll(".sideBarBtn");
const openWindow = function () {
  modal.classList.remove("hidden");
  overlay.classList.remove("hidden");
};

const closeWindow = function () {
  modal.classList.add("hidden");
  overlay.classList.add("hidden");
};

const changeView = function () {
  // 1. Alterna 'flexContainer'
  mainContentArea.classList.toggle("flexContainer");

  // 2. Alterna 'gridContainer'
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

// Event Listeners base

btnCloseWindow.addEventListener("click", closeWindow);
overlay.addEventListener("click", closeWindow);
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) {
    closeWindow();
  }
});
btnChangeView.forEach((btn) => {
  btn.addEventListener("click", changeView);
});

// Logica de routing
// 2. Definir el HTML para cada vista
const getProjectsHTML = () => {
  return `
        <div class="projects-view">
            <h2>Vista de Mis Proyectos 📋</h2>
            <p>Aquí se cargará la lista de proyectos desde la base de datos.</p>
        </div>
    `;
};

const getWorkspacesHTML = () => {
  return `
        <div class="workspaces-view">
            <h2>Vista de Workspaces 💼</h2>
            <p>Aquí se listarán todos tus espacios de trabajo.</p>
        </div>
    `;
};

const getStatsHTML = function () {
  return `
        <div class="admin-view">
            <h2>Vista del Administrador 👮‍♂️</h2>
            <p>Aquí se listarán todas las estadisticas extraídas a partir de los projectos.</p>
        </div>
    `;
};

// 3. Función principal para cambiar la vista
const renderView = (viewName) => {
  // Primero, limpia el contenido actual
  mainContentArea.innerHTML = "";

  let newHTML = "";
  let newTitle = "";
  let newButtonText = "";
  let newButtonAction = "";
  let newButtonIconSrc = "";
  let newTitlePlaceholder = "";
  let newDescriptionPlaceholder = "";
  let newFormTitle = "";
  let isVisible = true; // Control de visibilidad del botón de acción

  // Selecciona el HTML a inyectar según la vista
  switch (viewName) {
    case "mis-proyectos":
      newHTML = getProjectsHTML();
      newTitle = "Mis Proyectos";
      newButtonText = "Crear Proyecto";
      newButtonAction = "openProjectModal";
      newButtonIconSrc = "images/addImage.png";
      newTitlePlaceholder = "Ingrese el título de su proyecto";
      newDescriptionPlaceholder =
        "Ingrese una breve descripción de su projecto";
      newFormTitle = "Crea Un Nuevo Proyecto";
      break;
    case "workspaces":
      newHTML = getWorkspacesHTML();
      newTitle = "Workspaces";
      newButtonText = "Crear Workspace";
      newButtonAction = "openWorkspaceModal";
      newButtonIconSrc = "images/workspacesLogo.png";
      newTitlePlaceholder = "Ingrese el título del Workspace";
      newDescriptionPlaceholder = "Describa brevemente al Workspace";
      newFormTitle = "Crea Un Nuevo Workspace";
      break;
    case "admin-dashboard":
      newHTML = getStatsHTML();
      newTitle = "Estadisticas y Reportes";
      newButtonText = "Generar Reporte";
      newButtonAction = "generateReport";
      newButtonIconSrc = "images/reportLogo.png";
      break;
    default:
      newHTML = "<h2>Vista no encontrada.</h2>";
      newTitle = "Error";
      newButtonIconSrc = "images/addImage.png";
      isVisible = false;
  }

  // Inyecta el nuevo HTML
  mainContentArea.innerHTML = newHTML;

  // Opcional: Actualiza el título en el topNav
  document.querySelector(".subtitle").textContent = newTitle;
  document.title = newTitle + " | HacerYA";

  // Opcional: Actualiza el botón activo en el sidebar
  sideBarButtons.forEach((btn) => {
    btn.classList.remove("active");
    if (btn.href.endsWith(viewName)) {
      btn.classList.add("active");
    }
  });
  inputTitle.setAttribute("placeholder", newTitlePlaceholder);
  inputDescription.setAttribute("placeholder", newDescriptionPlaceholder);
  formTitle.textContent = newFormTitle;
  // ----------------------------------------------------
  // 👇 CAMBIO: Implementación del forEach para los botones de acción
  // ----------------------------------------------------
  if (btnsMainAction.length > 0) {
    btnsMainAction.forEach((button) => {
      // 1. Cambia el contenido interno (texto + ícono)
      button.innerHTML = `
                ${newButtonText} 
                <img src="${newButtonIconSrc}" alt="boton añadir" class="actionIcon"/>
            `;

      // 2. Cambia el atributo de datos para que el listener sepa qué hacer
      button.setAttribute("data-action", newButtonAction);
      // 3. Controla la visibilidad
      button.style.display = isVisible ? "flex" : "none";
    });
  }
  // ----------------------------------------------------
};

// 4. Lógica para escuchar los clicks en el sidebar
document.addEventListener("DOMContentLoaded", () => {
  // 1. Determina la vista a cargar
  const initialHash = window.location.hash.replace("#", "");

  // Define la variable que contendrá el nombre de la vista.
  const viewToLoad = initialHash || "mis-proyectos";

  // 2. Renderiza la vista inicial
  renderView(viewToLoad);

  // 3. Corrige la URL en la barra de navegación si el usuario entró sin hash.
  if (!initialHash) {
    window.history.pushState(null, "", "#" + viewToLoad);
  }

  // ----------------------------------------------------
  // 👇 CAMBIO: Listener para los botones de acción principal
  // ----------------------------------------------------
  btnsMainAction.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");

      // Asumimos que "openProjectModal" y "openWorkspaceModal" deben abrir el modal
      if (action === "openProjectModal" || action === "openWorkspaceModal") {
        openWindow();
      } else if (action === "generateReport") {
        // Lógica de reportes si es necesario, por ahora solo un log
        console.log("Iniciando generación de reporte...");
      }
    });
  });
  // ----------------------------------------------------

  // Escuchar clicks en el sidebar (Routing)
  sideBarButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const viewName = e.currentTarget.getAttribute("href").replace("#", "");

      renderView(viewName);
      window.history.pushState(null, "", "#" + viewName);
    });
  });
});

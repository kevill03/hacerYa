"use strict";

const modal = document.querySelector(".createProjectWindow");
const overlay = document.querySelector(".overlay");
const btnCloseWindow = document.querySelector(".closeWindow");
const btnsOpenWindow = document.querySelector("#createProjectNav");
const mainContentArea = document.querySelector(".mainData");
const sideBarButtons = document.querySelectorAll(".sideBarBtn");
console.log(btnsOpenWindow);
const openWindow = function () {
  modal.classList.remove("hidden");
  overlay.classList.remove("hidden");
};

const closeWindow = function () {
  modal.classList.add("hidden");
  overlay.classList.add("hidden");
};

btnsOpenWindow.addEventListener("click", openWindow);

btnCloseWindow.addEventListener("click", closeWindow);
overlay.addEventListener("click", closeWindow);

document.addEventListener("keydown", function (e) {
  // console.log(e.key);

  if (e.key === "Escape" && !modal.classList.contains("hidden")) {
    closeWindow();
  }
});

// Logica de routing
// 2. Definir el HTML para cada vista
const getProjectsHTML = () => {
  // Retorna el HTML COMPLETO de la vista "Mis Proyectos"
  return `
        <div class="projects-view">
            <h2>Vista de Mis Proyectos 📋</h2>
            <p>Aquí se cargará la lista de proyectos desde la base de datos.</p>
            </div>
    `;
};

const getWorkspacesHTML = () => {
  // Retorna el HTML COMPLETO de la vista "Workspaces"
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

  // Selecciona el HTML a inyectar según la vista
  switch (viewName) {
    case "mis-proyectos":
      newHTML = getProjectsHTML();
      newTitle = "Mis Proyectos";
      break;
    case "workspaces":
      newHTML = getWorkspacesHTML();
      newTitle = "Workspaces";
      break;
    // Agrega más casos (ej: 'admin-dashboard')
    case "admin-dashboard":
      newHTML = getStatsHTML();
      newTitle = "Estadisticas y Reportes";
      break;
    default:
      newHTML = "<h2>Vista no encontrada.</h2>";
      newTitle = "Error";
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
};

// 4. Lógica para escuchar los clicks en el sidebar
document.addEventListener("DOMContentLoaded", () => {
  // 1. Determina la vista a cargar
  const initialHash = window.location.hash.replace("#", "");

  // Define la variable que contendrá el nombre de la vista.
  // Si la URL está vacía, usa 'mis-proyectos'.
  const viewToLoad = initialHash || "mis-proyectos";

  // 2. Renderiza la vista inicial
  renderView(viewToLoad);

  // 3. Corrige la URL en la barra de navegación si el usuario entró sin hash.
  if (!initialHash) {
    // Ahora 'viewToLoad' está definida y contiene "mis-proyectos"
    window.history.pushState(null, "", "#" + viewToLoad);
  }

  // ----------------------------------------------------

  // Escuchar clicks en el sidebar
  sideBarButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault(); // Detiene el comportamiento predeterminado del link

      // Obtiene el nombre de la vista
      const viewName = e.currentTarget.getAttribute("href").replace("#", "");

      // Cambia el contenido
      renderView(viewName);

      // Actualiza la URL
      window.history.pushState(null, "", "#" + viewName);
    });
  });
});

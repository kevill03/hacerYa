import { apiRequest } from "./api.js";
import { appState } from "./crudMainPage.js";

let currentProjectId = null;
let currentProjectName = ""; // Para los títulos
const overlay = document.querySelector(".overlay");
let membersModal = null; // Guardará la referencia al modal

/**Función principal: Crea el modal, lo muestra y carga los datos*/
export async function renderProjectMemberModal(projectId) {
  currentProjectId = projectId;

  try {
    //Obtener datos del proyecto para el título
    const project = appState.allProjects.find((p) => p.id == projectId);
    if (!project) throw new Error("Proyecto no encontrado en caché.");
    currentProjectName = project.name;

    //Crear y mostrar el esqueleto del modal
    createModalSkeleton(currentProjectName);

    //Cargar la lista de miembros
    await populateMembersList();
  } catch (error) {
    console.error("Error al renderizar modal de miembros de proyecto:", error);
    Swal.fire(
      "Error",
      `No se pudieron cargar los datos del proyecto: ${error.message}`,
      "error"
    );
  }
}

/**Crea el HTML del modal y lo añade al DOM*/
function createModalSkeleton(projectName) {
  if (document.getElementById("projectMembersModal")) return;

  const modalHTML = `
    <div class="detailsWindow" id="projectMembersModal">
      <button class="closeWindow detailsCloseBtn">&times;</button>
      <div class="detailsContent">
        <h1>Gestionar Miembros</h1>
        <h2>${projectName}</h2>
        
        <form id="addProjectMemberForm" class="createActionForm flexContainer">
          <div class="inputGroup flexContainer">
            <input type="email" id="projectMemberEmailInput" placeholder="correo@ejemplo.com" required />
            <select id="projectMemberRoleSelect">
              <option value="member" selected>Miembro</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" class="btn panelBtn">Añadir Miembro</button>
        </form>

        <div class="members-list-container">
          <h3>Miembros Actuales</h3>
          <ul id="projectMembersList" class="members-list">
            <li>Cargando miembros...</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
  membersModal = document.getElementById("projectMembersModal");
  overlay.classList.remove("hidden");

  // Añadir listeners
  membersModal
    .querySelector(".closeWindow")
    .addEventListener("click", closeMemberModal);
  overlay.addEventListener("click", closeMemberModal);
  membersModal
    .querySelector("#addProjectMemberForm")
    .addEventListener("submit", handleAddMember);
  membersModal
    .querySelector("#projectMembersList")
    .addEventListener("click", handleListClick);
}

/**Cierra el modal y lo elimina del DOM*/
function closeMemberModal() {
  if (membersModal) {
    membersModal.remove();
    membersModal = null;
  }
  overlay.classList.add("hidden");
  overlay.removeEventListener("click", closeMemberModal);
}

/**Busca los miembros del proyecto y los renderiza*/
async function populateMembersList() {
  const listElement = membersModal.querySelector("#projectMembersList");
  listElement.innerHTML = "<li>Cargando miembros...</li>";

  try {
    const response = await apiRequest(
      `/projects/${currentProjectId}/members`,
      "GET"
    );
    const members = response.data;

    if (members.length === 0) {
      listElement.innerHTML = "<li>No hay miembros en este proyecto.</li>";
      return;
    }

    listElement.innerHTML = members
      .map((member) => createMemberHTML(member))
      .join("");
  } catch (error) {
    console.error("Error al cargar miembros de proyecto:", error);
    listElement.innerHTML = `<li class="error">Error al cargar miembros.</li>`;
  }
}

/**Genera el HTML para un solo miembro.*/
function createMemberHTML(member) {
  const isCurrentUser = member.id === appState.currentUser.id;
  return `
    <li class="member-item" data-member-id="${member.id}">
      <div class="member-info">
        <strong>${member.full_name}</strong>
        <span>${member.email}</span>
      </div>
      <div class="member-actions">
        <select class="role-select" data-member-id="${member.id}" ${
    isCurrentUser ? "disabled" : ""
  }>
          <option value="member" ${
            member.role_in_project === "member" ? "selected" : ""
          }>Miembro</option>
          <option value="admin" ${
            member.role_in_project === "admin" ? "selected" : ""
          }>Admin</option>
        </select>
        <button class="btn-delete-member" data-member-id="${member.id}" ${
    isCurrentUser ? "disabled" : ""
  }>
          &times;
        </button>
      </div>
    </li>
  `;
}

// --- Manejadores de Eventos CRUD ---

/** Maneja el envío del formulario "Añadir Miembro"*/
async function handleAddMember(e) {
  e.preventDefault();
  const emailInput = membersModal.querySelector("#projectMemberEmailInput");
  const roleSelect = membersModal.querySelector("#projectMemberRoleSelect");
  const email = emailInput.value.trim();
  const role = roleSelect.value;

  if (!email) return;

  try {
    const response = await apiRequest(
      `/projects/${currentProjectId}/members`,
      "POST",
      { memberEmail: email, role: role }
    );

    if (response.status === 201) {
      Swal.fire("¡Éxito!", `Usuario ${email} añadido al proyecto.`, "success");
    } else if (response.status === 200) {
      Swal.fire("Información", `El usuario ${email} ya es miembro.`, "info");
    }

    emailInput.value = "";
    await populateMembersList();
  } catch (error) {
    console.error("Error al añadir miembro al proyecto:", error);
    Swal.fire("Error", `No se pudo añadir: ${error.message}`, "error");
  }
}

/**Maneja los clics en la lista (Cambiar Rol o Eliminar)*/
async function handleListClick(e) {
  const target = e.target;

  //Clic en el botón de Eliminar
  if (target.classList.contains("btn-delete-member")) {
    const memberId = target.dataset.memberId;
    Swal.fire({
      title: "¿Estás seguro?",
      text: "¡No podrás revertir esto!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminarlo!",
      cancelButtonText: "Cancelar",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await apiRequest(
            `/projects/${currentProjectId}/members/${memberId}`,
            "DELETE"
          );
          Swal.fire("¡Eliminado!", "El miembro ha sido eliminado.", "success");
          await populateMembersList();
        } catch (error) {
          console.error("Error al eliminar miembro:", error);
          Swal.fire("Error", `No se pudo eliminar: ${error.message}`, "error");
        }
      }
    });
  }

  //Clic en el <select> de Rol
  if (target.classList.contains("role-select")) {
    target.addEventListener("change", async (event) => {
      const memberId = event.target.dataset.memberId;
      const newRole = event.target.value;

      try {
        await apiRequest(
          `/projects/${currentProjectId}/members/${memberId}`,
          "PUT",
          { role: newRole }
        );
        Swal.fire("¡Actualizado!", `Rol actualizado a ${newRole}.`, "success");
        await populateMembersList();
      } catch (error) {
        console.error("Error al cambiar rol:", error);
        Swal.fire(
          "Error",
          `No se pudo cambiar el rol: ${error.message}`,
          "error"
        );
        target.value = newRole === "admin" ? "member" : "admin";
      }
    });
  }
}

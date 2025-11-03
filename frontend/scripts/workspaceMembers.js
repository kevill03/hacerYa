import { apiRequest } from "./api.js";
import { appState } from "./crudMainPage.js";

// --- Variables del Módulo ---
let currentWorkspaceId = null;
let currentWorkspaceName = ""; // Para los títulos
const overlay = document.querySelector(".overlay");
let membersModal = null; // Guardará la referencia al modal

/**
 * Función principal: Crea el modal, lo muestra y carga los datos.
 * Esta es la función que llamas desde crudMainPage.js
 */
export async function renderMemberModal(workspaceId) {
  currentWorkspaceId = workspaceId;

  // 1. Obtener datos del workspace para el título
  try {
    const workspace = appState.allWorkspaces.find((w) => w.id == workspaceId);
    if (!workspace) throw new Error("Workspace no encontrado en caché.");
    currentWorkspaceName = workspace.name;

    // 2. Crear y mostrar el esqueleto del modal
    createModalSkeleton(currentWorkspaceName);

    // 3. Cargar la lista de miembros
    await populateMembersList();
  } catch (error) {
    console.error("Error al renderizar modal de miembros:", error);
    Swal.fire(
      "Error",
      `No se pudieron cargar los datos del workspace: ${error.message}`,
      "error"
    );
  }
}

/**
 * Crea el HTML del modal y lo añade al DOM.
 */
function createModalSkeleton(workspaceName) {
  // Si el modal ya existe, no lo dupliques
  if (document.getElementById("membersModal")) return;

  const modalHTML = `
    <div class="detailsWindow" id="membersModal">
      <button class="closeWindow detailsCloseBtn">&times;</button>
      <div class="detailsContent">
        <h1>Gestionar Miembros</h1>
        <h2>${workspaceName}</h2>
        
        <form id="addMemberForm" class="createActionForm flexContainer">
          <div class="inputGroup flexContainer">
            <input type="email" id="memberEmailInput" placeholder="correo@ejemplo.com" required />
            <select id="memberRoleSelect">
              <option value="member" selected>Miembro</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" class="btn panelBtn">Añadir Miembro</button>
        </form>

        <div class="members-list-container">
          <h3>Miembros Actuales</h3>
          <ul id="membersList" class="members-list">
            <li>Cargando miembros...</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  // Añadir el modal al body
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Guardar la referencia y mostrar
  membersModal = document.getElementById("membersModal");
  overlay.classList.remove("hidden");

  // Añadir listeners de cierre (¡importante!)
  membersModal
    .querySelector(".closeWindow")
    .addEventListener("click", closeMemberModal);
  overlay.addEventListener("click", closeMemberModal);

  // Añadir listeners de acciones (submit y clics en la lista)
  membersModal
    .querySelector("#addMemberForm")
    .addEventListener("submit", handleAddMember);
  membersModal
    .querySelector("#membersList")
    .addEventListener("click", handleListClick);
}

/**
 * Cierra el modal y lo elimina del DOM.
 */
function closeMemberModal() {
  if (membersModal) {
    membersModal.remove(); // Elimina el elemento del DOM
    membersModal = null;
  }
  overlay.classList.add("hidden");
  // Limpiar el listener del overlay que se añadió en crudMainPage
  overlay.removeEventListener("click", closeMemberModal);
}

/**
 * Busca los miembros del workspace y los renderiza en la lista.
 */
async function populateMembersList() {
  const listElement = membersModal.querySelector("#membersList");
  listElement.innerHTML = "<li>Cargando miembros...</li>";

  try {
    const members = await apiRequest(
      `/workspaces/${currentWorkspaceId}/members`,
      "GET"
    );

    if (members.length === 0) {
      listElement.innerHTML = "<li>No hay miembros en este workspace.</li>";
      return;
    }

    listElement.innerHTML = members
      .map((member) => createMemberHTML(member))
      .join("");
  } catch (error) {
    console.error("Error al cargar miembros:", error);
    listElement.innerHTML = `<li class="error">Error al cargar miembros.</li>`;
  }
}

/**
 * Genera el HTML para un solo miembro en la lista.
 */
function createMemberHTML(member) {
  const isCurrentUser = member.id === appState.currentUser.id;
  const isOwner = false; // TODO: Necesitaríamos saber quién es el 'created_by' para deshabilitar su eliminación.
  // Por ahora, confiamos en la lógica del backend.

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
            member.role_in_workspace === "member" ? "selected" : ""
          }>Miembro</option>
          <option value="admin" ${
            member.role_in_workspace === "admin" ? "selected" : ""
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

/**
 * Maneja el envío del formulario "Añadir Miembro".
 */
async function handleAddMember(e) {
  e.preventDefault();
  const emailInput = membersModal.querySelector("#memberEmailInput");
  const roleSelect = membersModal.querySelector("#memberRoleSelect");
  const email = emailInput.value.trim();
  const role = roleSelect.value;

  if (!email) return;

  try {
    await apiRequest(`/workspaces/${currentWorkspaceId}/members`, "POST", {
      memberEmail: email,
      role: role,
    });

    Swal.fire("¡Éxito!", `Usuario ${email} añadido.`, "success");
    emailInput.value = ""; // Limpiar input
    await populateMembersList(); // Recargar la lista
  } catch (error) {
    console.error("Error al añadir miembro:", error);
    Swal.fire(
      "Error",
      `No se pudo añadir al miembro: ${error.message}`,
      "error"
    );
  }
}

/**
 * Maneja los clics en la lista (delegación de eventos para Cambiar Rol o Eliminar).
 */
async function handleListClick(e) {
  const target = e.target;

  // --- Caso 1: Clic en el botón de Eliminar ---
  if (target.classList.contains("btn-delete-member")) {
    const memberId = target.dataset.memberId;

    // Confirmación con SweetAlert
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
            `/workspaces/${currentWorkspaceId}/members/${memberId}`,
            "DELETE"
          );
          Swal.fire("¡Eliminado!", "El miembro ha sido eliminado.", "success");
          await populateMembersList(); // Recargar la lista
        } catch (error) {
          console.error("Error al eliminar miembro:", error);
          Swal.fire(
            "Error",
            `No se pudo eliminar al miembro: ${error.message}`,
            "error"
          );
        }
      }
    });
  }

  // --- Caso 2: Clic en el <select> de Rol ---
  if (target.classList.contains("role-select")) {
    // Escuchar por el evento 'change'
    target.addEventListener("change", async (event) => {
      const memberId = event.target.dataset.memberId;
      const newRole = event.target.value;

      try {
        await apiRequest(
          `/workspaces/${currentWorkspaceId}/members/${memberId}`,
          "PUT",
          {
            role: newRole,
          }
        );
        Swal.fire("¡Actualizado!", `Rol actualizado a ${newRole}.`, "success");
        await populateMembersList(); // Recargar (para confirmar visualmente)
      } catch (error) {
        console.error("Error al cambiar rol:", error);
        Swal.fire(
          "Error",
          `No se pudo cambiar el rol: ${error.message}`,
          "error"
        );
        // Revertir el <select> a su valor anterior
        target.value = newRole === "admin" ? "member" : "admin";
      }
    });
  }
}

import { apiRequest } from "./api.js";
import { appState } from "./crudMainPage.js";

// Guardará la lista de usuarios para no tener que recargarla
let userCache = [];
let adminModal = null; // Referencia al modal de edición
const overlay = document.querySelector(".overlay");

/**Función principal para renderizar el panel de admin de usuarios.*/
export async function renderAdminPanel(container) {
  container.innerHTML = `<div class="loading-spinner">Cargando panel de administración...</div>`;
  try {
    // Crear el esqueleto de la tabla (con la barra de búsqueda)
    const panelHTML = `
      <div class="admin-panel-container">
        <p>Edita el rol, estado de la cuenta o detalles de los usuarios.</p>
        <div class="admin-search-bar">
          <input type="search" id="adminUserSearchInput" placeholder="Buscar por nombre o email...">
        </div>
        <div class="user-table-container">
          <table class="user-admin-table">
            <thead>
              <tr>
                <th>Nombre Completo</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="user-admin-tbody">
              </tbody>
          </table>
        </div>
      </div>
    `;
    container.innerHTML = panelHTML;

    await populateUserTable();
    const searchInput = document.getElementById("adminUserSearchInput");
    searchInput.addEventListener("input", handleUserSearch);
  } catch (error) {
    console.error("Error al renderizar el panel de admin:", error);
    container.innerHTML = `<h2 class="error-message">❌ Error al cargar usuarios: ${error.message}</h2>`;
  }
}

/**Funcion que llama a la API para obtener los usuarios y los renderiza en la tabla*/
async function populateUserTable() {
  const tbody = document.getElementById("user-admin-tbody");
  tbody.innerHTML = `<tr><td colspan="5">Cargando usuarios...</td></tr>`;
  const response = await apiRequest("/admin/users", "GET");
  userCache = response.data; // Guardar en caché
  // Llama a la nueva función de renderizado con la lista completa
  renderUserRows(userCache);
}

/**Funcion que renderiza las filas de la tabla de usuarios en el <tbody> */
function renderUserRows(users) {
  const tbody = document.getElementById("user-admin-tbody");

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No se encontraron usuarios que coincidan.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map((user) => createUserRowHTML(user)).join("");

  tbody.querySelectorAll(".btn-edit-user").forEach((btn) => {
    btn.addEventListener("click", () => openUserEditModal(btn.dataset.userId));
  });
  tbody.querySelectorAll(".btn-change-pass").forEach((btn) => {
    btn.addEventListener("click", () =>
      openPasswordChangeModal(btn.dataset.userId)
    );
  });
}

/**Funcion para manejar el evento 'input' de la barra de búsqueda
 * Y que filtra 'userCache' y llama a 'renderUserRows' con los resultados.
 */
function handleUserSearch(e) {
  const searchTerm = e.target.value.toLowerCase().trim();

  // Si la barra está vacía, mostrar a todos los usuarios
  if (searchTerm === "") {
    renderUserRows(userCache);
    return;
  }

  // Filtrar la caché
  const filteredUsers = userCache.filter((user) => {
    const name = user.full_name ? user.full_name.toLowerCase() : "";
    const email = user.email ? user.email.toLowerCase() : "";

    return name.includes(searchTerm) || email.includes(searchTerm);
  });

  // Renderizar solo los usuarios filtrados
  renderUserRows(filteredUsers);
}
/**Funcion que genera el HTML para una sola fila (<tr>) de la tabla de usuarios.
 */
function createUserRowHTML(user) {
  const isBlocked = user.account_status === "blocked";
  // No se puede editar/bloquear al usuario admin principal (Se asume ID 1 o el propio ID)
  const isSelf = user.id === appState.currentUser.id;

  return `
    <tr data-user-id="${user.id}">
      <td>${user.full_name}</td>
      <td>${user.email}</td>
      <td>
        <span class="status-pill ${
          user.role === "admin" ? "role-admin" : "role-user"
        }">
          ${user.role}
        </span>
      </td>
      <td>
        <span class="status-pill ${
          isBlocked ? "status-blocked" : "status-active"
        }">
          ${isBlocked ? "Bloqueado" : "Activo"}
        </span>
      </td>
      <td class="user-actions">
        <button class="btn-edit-user panelBtn" data-user-id="${user.id}" ${
    isSelf ? "disabled" : ""
  }>Editar</button>
        <button class="btn-change-pass panelBtn" data-user-id="${user.id}" ${
    isSelf ? "disabled" : ""
  }>Cambiar Clave</button>
      </td>
    </tr>
  `;
}

//Lógica del Modal de Edición
/**Funcion que cierra cualquier modal de admin abierto.
 */
function closeAdminModal() {
  if (adminModal) {
    adminModal.remove();
    adminModal = null;
  }
  overlay.classList.add("hidden");
  overlay.removeEventListener("click", closeAdminModal);

  //Se limpian los listeners de los formularios
  const form = document.getElementById("adminEditForm");
  if (form) {
    form.removeEventListener("submit", handleEditUserSubmit);
  }
}

/**Funcion que abre el modal para editar Nombre, Email, Rol y Estado.*/
function openUserEditModal(userId) {
  const user = userCache.find((u) => u.id == userId);
  if (!user) return;

  const modalHTML = `
    <div class="detailsWindow" id="adminEditModal">
      <button class="closeWindow detailsCloseBtn">&times;</button>
      <div class="detailsContent">
        <h1>Editar Usuario</h1>
        <h2>${user.full_name}</h2>
        
        <form id="adminEditForm" class="createActionForm flexContainer">
          <input type="hidden" id="adminUserId" value="${user.id}">
          
          <div class="inputGroup flexContainer">
            <label for="adminFullName">Nombre Completo</label>
            <input type="text" id="adminFullName" value="${
              user.full_name
            }" required>
          </div>
          
          <div class="inputGroup flexContainer">
            <label for="adminEmail">Email</label>
            <input type="email" id="adminEmail" value="${user.email}" required>
          </div>

          <div class="input-row flexContainer">
            <div class="inputGroup flexContainer">
              <label for="adminRoleSelect">Rol</label>
              <select id="adminRoleSelect">
                <option value="user" ${
                  user.role === "user" ? "selected" : ""
                }>User</option>
                <option value="admin" ${
                  user.role === "admin" ? "selected" : ""
                }>Admin</option>
              </select>
            </div>
            
            <div class="inputGroup flexContainer">
              <label for="adminStatusSelect">Estado de Cuenta</label>
              <select id="adminStatusSelect">
                <option value="active" ${
                  user.account_status === "active" ? "selected" : ""
                }>Activo</option>
                <option value="blocked" ${
                  user.account_status === "blocked" ? "selected" : ""
                }>Bloqueado</option>
              </select>
            </div>
          </div>
          
          <button type="submit" class="btn panelBtn mainActionBtn">Guardar Cambios</button>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
  adminModal = document.getElementById("adminEditModal");
  overlay.classList.remove("hidden");

  // Añadir listeners
  adminModal
    .querySelector(".closeWindow")
    .addEventListener("click", closeAdminModal);
  overlay.addEventListener("click", closeAdminModal);
  adminModal
    .querySelector("#adminEditForm")
    .addEventListener("submit", handleEditUserSubmit);
}

/**Funcion que maneja el envío del formulario de Edición de Usuario*/
async function handleEditUserSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById("adminUserId").value;

  //Se Guardan cambios de Detalles (Nombre, Email, Rol)
  const detailsPayload = {
    fullName: document.getElementById("adminFullName").value,
    email: document.getElementById("adminEmail").value,
    role: document.getElementById("adminRoleSelect").value,
  };

  // Se Guardan cambios de Estado (Activo/Bloqueado)
  const statusPayload = {
    newStatus: document.getElementById("adminStatusSelect").value,
  };

  try {
    // Se envian ambas peticiones en paralelo
    await Promise.all([
      apiRequest(`/admin/users/${userId}/details`, "PUT", detailsPayload),
      apiRequest(`/admin/users/${userId}/status`, "PUT", statusPayload),
    ]);

    Swal.fire("¡Éxito!", "Usuario actualizado correctamente.", "success");
    closeAdminModal();
    await populateUserTable(); // Recargar la tabla
  } catch (error) {
    Swal.fire(
      "Error",
      `No se pudo actualizar el usuario: ${error.message}`,
      "error"
    );
  }
}

/**Funcion que abre el modal simple para cambiar la contraseña.
 */
function openPasswordChangeModal(userId) {
  const user = userCache.find((u) => u.id == userId);
  if (!user) return;

  Swal.fire({
    title: `Cambiar contraseña de ${user.full_name}`,
    input: "password",
    inputLabel: "Nueva Contraseña",
    inputPlaceholder: "Escribe la nueva contraseña (mín. 6 caracteres)",
    inputAttributes: {
      "aria-label": "Escribe la nueva contraseña",
    },
    showCancelButton: true,
    confirmButtonText: "Cambiar",
    cancelButtonText: "Cancelar",
    showLoaderOnConfirm: true,
    preConfirm: async (newPassword) => {
      if (!newPassword || newPassword.length < 6) {
        Swal.showValidationMessage(
          "La contraseña debe tener al menos 6 caracteres."
        );
        return false;
      }
      try {
        await apiRequest(`/admin/users/${userId}/password`, "PUT", {
          newPassword,
        });
        return true;
      } catch (error) {
        Swal.showValidationMessage(`Error: ${error.message}`);
        return false;
      }
    },
    allowOutsideClick: () => !Swal.isLoading(),
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire("¡Éxito!", "La contraseña ha sido cambiada.", "success");
    }
  });
}

const logoutBtn = document.querySelector(".logoutBtn");

window.addEventListener("load", () => {
  const userData = localStorage.getItem("user");

  // Verificación simple para evitar errores si no hay user
  if (!userData) {
    console.error(
      "No se encontró usuario en localStorage. Redirigiendo a login."
    );
    // Si por alguna razón no hay usuario, forzamos la salida
    localStorage.removeItem("token");
    sessionStorage.clear();
    window.location.replace("login.html");
    return;
  }

  const stored = JSON.parse(userData);
  const user = stored.user;
  console.log("Usuario logueado:", user["full_name"]);

  const adminLink = document.querySelector(".admin-link-hidden");
  if (adminLink) {
    adminLink.style.display = user.role === "admin" ? "flex" : "none";
  }
});

// MODIFICACIÓN: La lógica async ahora está DENTRO del .then() de SweetAlert
logoutBtn.addEventListener("click", function () {
  // <--- Quitamos el async de aquí

  // 1. REEMPLAZO: Mostramos alerta de CONFIRMACIÓN primero
  Swal.fire({
    title: "¿Estás seguro?",
    text: "Tu sesión actual se cerrará.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33", // Rojo para la acción de "salir"
    cancelButtonColor: "#3085d6", // Azul para "cancelar"
    confirmButtonText: "Sí, cerrar sesión",
    cancelButtonText: "Cancelar",
  }).then(async (result) => {
    // <--- Ponemos el async aquí

    // 2. Si el usuario confirma...
    if (result.isConfirmed) {
      // 3. (Opcional) Mostramos una alerta de "Cerrando sesión..."
      Swal.fire({
        title: "Cerrando sesión...",
        text: "Guardando registro y limpiando datos.",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      const token = localStorage.getItem("token");
      const PROD_API_URL = "https://hacerya.onrender.com/auth/logout"; // Tu URL real
      const DEV_API_URL = "http://localhost:3000/auth/logout";

      const logoutUrl =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
          ? DEV_API_URL
          : PROD_API_URL;

      try {
        console.log("LOGOUT: Token encontrado:", !!token);
        console.log("LOGOUT: URL de destino:", logoutUrl);
        if (token) {
          const response = await fetch(logoutUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
          console.log(
            `LOGOUT: Servidor respondió con estado ${response.status}`
          );
        }
      } catch (error) {
        console.error(
          "🔴 FALLO CRÍTICO DE RED/SERVIDOR AL HACER LOGOUT:",
          error
        );
      } finally {
        // Esta limpieza se ejecuta sí o sí, lo cual es perfecto.
        // La redirección cerrará automáticamente la alerta de "Cerrando sesión..."
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        sessionStorage.clear();
        window.location.replace("login.html");
      }
      // --- FIN DE TU LÓGICA ORIGINAL ---
    }
  });
});

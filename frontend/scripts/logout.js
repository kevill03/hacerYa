const logoutBtn = document.querySelector(".logoutBtn");

window.addEventListener("load", () => {
  const userData = localStorage.getItem("user"); /*if (!userData) {
      window.location.href = "login.html";
      return;
    }*/

  const stored = JSON.parse(userData);
  const user = stored.user;
  console.log("Usuario logueado:", user["full_name"]);

  const adminLink = document.querySelector(".admin-link-hidden"); // Si no es admin, ocultamos el enlace de estadísticas

  if (adminLink) {
    adminLink.style.display = user.role === "admin" ? "flex" : "none";
  }
});

// MODIFICACIÓN CRÍTICA: La función ahora es ASYNC y llama al backend antes de limpiar.
logoutBtn.addEventListener("click", async function () {
  const token = localStorage.getItem("token");
  const logoutUrl = "http://localhost:3000/auth/logout"; // 🔴 URL de destino // 1. Intentar notificar al backend para registrar la bitácora

  try {
    // Log de diagnóstico antes del fetch
    console.log("LOGOUT: Token encontrado:", !!token);
    console.log("LOGOUT: URL de destino:", logoutUrl);
    if (token) {
      const response = await fetch(logoutUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", // Enviar el token en el encabezado de autorización
          Authorization: `Bearer ${token}`,
        },
      });

      // Log de diagnóstico después del fetch
      console.log(`LOGOUT: Servidor respondió con estado ${response.status}`); // NOTA: No importa si la llamada falla o tiene éxito; la limpieza local debe continuar.
    }
  } catch (error) {
    // Registro del error de red en la consola del navegador
    console.error("🔴 FALLO CRÍTICO DE RED/SERVIDOR AL HACER LOGOUT:", error);
  } finally {
    //  Limpieza de almacenamiento local y redirigir (siempre se ejecuta)
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    sessionStorage.clear();
    window.location.replace("login.html");
  }
});

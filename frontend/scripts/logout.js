const logoutBtn = document.querySelector(".logoutBtn");

logoutBtn.addEventListener("click", function () {
  Swal.fire({
    title: "¿Estás seguro?",
    text: "Tu sesión actual se cerrará.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Sí, cerrar sesión",
    cancelButtonText: "Cancelar",
  }).then(async (result) => {
    //Si el usuario confirma
    if (result.isConfirmed) {
      Swal.fire({
        title: "Cerrando sesión...",
        text: "Guardando registro y limpiando datos.",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      const token = localStorage.getItem("token");
      const PROD_API_URL = "https://hacerya.onrender.com/auth/logout";
      const DEV_API_URL = "http://localhost:3000/auth/logout";
      const logoutUrl =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
          ? DEV_API_URL
          : PROD_API_URL;

      try {
        if (token) {
          const response = await fetch(logoutUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
        }
      } catch (error) {
        console.error(
          "🔴 FALLO CRÍTICO DE RED/SERVIDOR AL HACER LOGOUT:",
          error
        );
      } finally {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        sessionStorage.clear();
        window.location.replace("login.html");
      }
    }
  });
});

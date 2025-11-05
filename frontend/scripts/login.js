const PROD_API_URL = "https://hacerya.onrender.com";
const DEV_API_URL = "http://localhost:3000";

const BASE_API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? DEV_API_URL
    : PROD_API_URL;
document.querySelector(".loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailUser").value.trim();
  const password = document.getElementById("passwordUser").value.trim();
  const form = document.querySelector(".loginForm");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Alerta de "Cargando..." con el contexto de Render
  Swal.fire({
    title: "Conectando con el servidor...",
    html: `
      ¡Gracias por tu paciencia!
      <br><br>
      <small style="font-size: 0.8em; line-height: 1.4;">
        Este es un proyecto universitario. El servidor gratuito (Render) 
        se suspende tras 15 minutos de inactividad.
        <br>
        <b>Si es la primera visita, puede tardar hasta un minuto en arrancar.</b>
      </small>
    `,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  try {
    const response = await fetch(`${BASE_API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data));

      // Alerta de Éxito
      Swal.fire({
        icon: "success",
        title: "¡Bienvenido!",
        text: "Inicio de sesión exitoso.",
        showConfirmButton: false,
        timer: 1500,
      }).then(() => {
        window.location.href = "mainPage.html";
      });
    } else {
      // Alerta de Error (Credenciales inválidas)
      Swal.fire({
        icon: "error",
        title: "Error de autenticación",
        text: data.error || "El correo o la contraseña son incorrectos.",
      });
    }
  } catch (error) {
    // Alerta de Error (Fallo de conexión)
    console.error("Error de conexión:", error);
    Swal.fire({
      icon: "error",
      title: "Error de conexión",
      text: "No se pudo conectar con el servidor. Por favor, intenta de nuevo más tarde.",
    });
  }
});

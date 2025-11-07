const PROD_API_URL = "https://hacerya.onrender.com/auth/register"; // URL en render
const DEV_API_URL = "http://localhost:3000/auth/register";

const BASE_API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? DEV_API_URL
    : PROD_API_URL;

document.getElementById("signUpBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailUser").value.trim();
  const password = document.getElementById("passwordUser").value.trim();
  const confirmPassword = document
    .getElementById("confirmPasswordUser")
    .value.trim();
  const nameUser = document.getElementById("nameUser").value.trim();
  const lastNameUser = document.getElementById("lastNameUser").value.trim();
  const form = document.querySelector(".loginForm");
  const full_name = `${nameUser} ${lastNameUser}`;

  //Validación de formulario nativa (campos vacíos)
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  //Alerta de contraseñas no coincidentes
  if (password !== confirmPassword) {
    Swal.fire({
      icon: "warning",
      title: "Las contraseñas no coinciden",
      text: "Por favor, verifica e inténtalo de nuevo.",
    });
    return;
  }

  //Alerta de "Cargando..." con contexto de Render
  Swal.fire({
    title: "Creando tu cuenta...",
    html: `
      ¡Gracias por tu paciencia! 🙏
      <br><br>
      <small style="font-size: 0.8em; line-height: 1.4;">
        Este es un proyecto universitario. El servidor gratuito (Render) 
        se suspende tras 15 minutos de inactividad.
        <br>
        <b>Puede tardar hasta un minuto en arrancar.</b>
      </small>
    `,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  try {
    const response = await fetch(`${BASE_API_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, full_name }),
    });

    const data = await response.json();

    if (response.ok) {
      //Alerta de Éxito y redirección
      localStorage.setItem("user", JSON.stringify(data));

      Swal.fire({
        icon: "success",
        title: "¡Registro Exitoso!",
        text: `Bienvenido, ${full_name}. Serás redirigido para iniciar sesión.`,
        showConfirmButton: false,
        timer: 2500,
      }).then(() => {
        window.location.href = "login.html";
      });
    } else {
      //Alerta de Error (Como por ejemplo, email duplicado)
      Swal.fire({
        icon: "error",
        title: "Error en el registro",
        text:
          data.error ||
          "No se pudo crear el usuario. Es posible que el correo ya esté en uso.",
      });
    }
  } catch (error) {
    //Alerta de Error de Conexión
    console.error("Error al conectar con el servidor:", error);
    Swal.fire({
      icon: "error",
      title: "Error de conexión",
      text: "No se pudo conectar con el servidor. Por favor, intenta de nuevo más tarde.",
    });
  }
});

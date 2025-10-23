document.querySelector(".loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailUser").value.trim();
  const password = document.getElementById("passwordUser").value.trim();
  const form = document.querySelector(".loginForm"); // Usar validación nativa del formulario para campos requeridos
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // CORRECCIÓN CRÍTICA: Guardar el token en su propia clave
      localStorage.setItem("token", data.token);

      // Guardar solo los datos del usuario (opcional, ya que el token contiene info)
      localStorage.setItem("user", JSON.stringify(data));
      window.location.href = "mainPage.html";
    } else {
      // Reemplazar alert() por un console.error o un mensaje visible en la UI
      console.error(
        "Fallo de autenticación:",
        data.error || "Credenciales inválidas"
      ); // Aquí deberías mostrar un mensaje de error en la interfaz de usuario.
    }
  } catch (error) {
    console.error("Error al conectar con el servidor:", error); // Aquí deberías mostrar un mensaje de error de conexión en la interfaz de usuario.
  }
});

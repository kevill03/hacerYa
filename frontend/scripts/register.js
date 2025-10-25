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

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  if (password !== confirmPassword) {
    // Usamos console.error ya que alert() no debe usarse.
    console.error("Las contraseñas no coinciden. Inténtelo de nuevo");
    return;
  }

  try {
    const response = await fetch("https://hacerya.onrender.com/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, full_name }),
    });

    const data = await response.json();

    if (response.ok) {
      // NOTA: El backend de /register actualmente NO devuelve un token.
      // Si quieres login automático, el backend debe modificarse.
      // localStorage.setItem("token", data.token); // Esta línea FALLARÍA

      localStorage.setItem("user", JSON.stringify(data));

      // La mejor práctica después del registro es redirigir al login
      window.location.href = "login.html";
      console.log(`Registro exitoso. Bienvenido ${full_name}.`);
    } else {
      console.error(
        "Error al registrar:",
        data.error || "El usuario no fue creado"
      );
    }
  } catch (error) {
    console.error("Error al conectar con el servidor:", error);
  }
});

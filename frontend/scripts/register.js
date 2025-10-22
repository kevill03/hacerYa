document.getElementById("signUpBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailUser").value.trim();
  const password = document.getElementById("passwordUser").value.trim();
  const confirmPassword = document
    .getElementById("confirmPasswordUser")
    .value.trim();
  const nameUser = document.getElementById("nameUser").value.trim();
  const lastNameUser = document.getElementById("lastNameUser").value.trim();
  const form = document.querySelector(".loginForm");
  const fullName = `${nameUser} ${lastNameUser}`;
  if (!form.checkValidity()) {
    form.reportValidity();
    // Si el formulario no es válido, el navegador muestra el mensaje y el código se detiene aquí.
    return;
  }
  if (!email || !password || !confirmPassword || !nameUser || !lastNameUser) {
    alert("Por favor, completa todos los campos");
    return;
  }
  if (password !== confirmPassword) {
    alert("Las contraseñas no coinciden. Inténtelo de nuevo");
    return;
  }
  try {
    const response = await fetch("http://localhost:3000/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, fullName }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("user", JSON.stringify(data));
      window.location.href = "mainPage.html";
      alert(data.message || `Bienvenido ${fullName}`);
    } else {
      alert(data.error || "El usuario no fue creado");
    }
  } catch (error) {
    console.error("Error al crear la cuenta:", error);
    alert("Error al conectar con el servidor");
  }
});

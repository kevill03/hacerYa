document.querySelector(".loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailUser").value.trim();
  const password = document.getElementById("passwordUser").value.trim();
  const form = document.querySelector(".loginForm");
  if (!form.checkValidity()) {
    form.reportValidity();
    // Si el formulario no es válido, el navegador muestra el mensaje y el código se detiene aquí.
    return;
  }
  if (!email || !password) {
    alert("Por favor, completa todos los campos");
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
      localStorage.setItem("user", JSON.stringify(data));
      window.location.href = "mainPage.html";
    } else {
      alert(data.error || "Credenciales inválidas");
    }
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    alert("Error al conectar con el servidor");
  }
});

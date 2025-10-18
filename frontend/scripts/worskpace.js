const logoutBtn = document.querySelector(".logoutBtn");

window.addEventListener("load", () => {
  const userData = localStorage.getItem("user");

  if (!userData) {
    window.location.href = "login.html";
    return;
  }

  const stored = JSON.parse(userData);
  const user = stored.user;
  console.log("Usuario logueado:", user["full_name"]);

  const adminLink = document.querySelector(".admin-link-hidden");

  // Si no es admin, ocultamos el enlace de estadísticas
  if (adminLink) {
    adminLink.style.display = user.role === "admin" ? "flex" : "none";
  }
});

logoutBtn.addEventListener("click", function () {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  sessionStorage.clear();
  window.location.replace("login.html");
});

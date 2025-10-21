import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js"; // Importamos las rutas de proyectos

//import { authRequired } from "./middleware/auth.js"; // Comentado, como lo tenías

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// RUTAS DE AUTENTICACIÓN:
app.use("/auth", authRoutes);

// RUTAS DE PROYECTOS (PROTEGIDAS):
// Usamos el prefijo '/api/projects'.
// projectRoutes ya incluye el middleware de autenticación (authMiddleware.verifyToken)
// para proteger todas sus rutas (GET, POST, PATCH, DELETE).
app.use("/api/projects", projectRoutes);

/*El bloque comentado forma parte de pruebas personales y no estan contempladas para el primer entregable del Modulo 1
app.get("/profile", authRequired, (req, res) => {
  res.json({ message: "Ruta protegida", user: req.user });
});

import { adminOnly } from "./middleware/auth.js";
app.get("/admin/stats", authRequired, adminOnly, (req, res) => {
  res.json({ msg: "Solo admins pueden ver esto" });
});*/

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

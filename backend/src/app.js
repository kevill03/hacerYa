import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js"; // Importamos las rutas de proyectos
import workspacesRoutes from "./routes/workspaces.js";
import activityLogRouter from "./routes/activityLog.js";

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

// RUTAS DE Workspaces (PROTEGIDAS):
// Usamos el prefijo '/api/workspaces'.
// wrokspacesRoutes ya incluye el middleware de autenticación (authMiddleware.verifyToken)
// para proteger todas sus rutas (GET, POST, PATCH, DELETE).

app.use("/api/workspaces", workspacesRoutes);

//Ruta para la bitacora de acciones
app.use("/api/activity-log", activityLogRouter);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import workspacesRoutes from "./routes/workspaces.js";
import activityLogRouter from "./routes/activityLog.js";
import adminRouter from "./routes/admin.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// RUTAS DE AUTENTICACIÓN:
app.use("/auth", authRoutes);

// RUTAS DE PROYECTOS (PROTEGIDAS):
app.use("/api/projects", projectRoutes);

// RUTAS DE Workspaces (PROTEGIDAS):
app.use("/api/workspaces", workspacesRoutes);

//Ruta para la bitacora de acciones
app.use("/api/activity-log", activityLogRouter);
//Ruta para el panel administrativo
app.use("/api/admin", adminRouter);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

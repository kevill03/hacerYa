import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.js";
//import { authRequired } from "./middleware/auth.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);

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

import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { logAction } from "../utils/logAction.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "secret";

// ----------------------------------------------------------------------
// RUTA: REGISTRO DE USUARIOS (POST /register) - ACTIVA
// ----------------------------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body; //Validación básica de campos requeridos
    if (!email || !password)
      return res.status(400).json({ error: "Email y contraseña requeridos" }); //Verificación de usuario existente
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (rows.length)
      return res.status(409).json({ error: "Email ya registrado" }); //Inserción del nuevo usuario
    const insert = await pool.query(
      "INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role, full_name",
      [email, password, full_name || null, role || "user"]
    );
    const newUser = insert.rows[0]; //LLAMADA A BITÁCORA (Registro Exitoso)

    logAction({
      userId: newUser.id,
      action: `USER_REGISTERED: ${newUser.email}`,
    }); // 5. Respuesta de éxito

    return res.status(201).json({ user: newUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error en servidor" });
  }
});

// ----------------------------------------------------------------------
// RUTA: LOGIN de usuarios (POST /login) - ACTIVA
// ----------------------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email y contraseña requeridos" });

    const { rows } = await pool.query(
      "SELECT id, email, password, role, full_name FROM users WHERE email = $1",
      [email]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    if (password !== user.password) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    //Creación del Token
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: "2h" }
    ); //LLAMADA A BITÁCORA (Login Exitoso)

    logAction({
      userId: user.id,
      action: "USER_LOGIN_SUCCESS",
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error en servidor" });
  }
});

// ----------------------------------------------------------------------
// RUTA: LOGOUT de usuarios (POST /logout) - ACTIVA
// ----------------------------------------------------------------------
router.post("/logout", verifyToken, async (req, res) => {
  // El verifyToken ya ha garantizado que el token es válido y ha adjuntado req.userId

  try {
    // LLAMADA A BITÁCORA (Logout Exitoso)
    logAction({
      userId: req.userId,
      action: "USER_LOGOUT_SUCCESS",
    });

    //El frontend eliminará el token.
    return res.status(204).send(); // 204 No Content para éxito sin cuerpo
  } catch (error) {
    console.error("Error al registrar logout en bitácora:", error);
    /*Si la bitácora falla, devolvemos 204 de todas formas,
     ya que la acción principal (cerrar sesión en el frontend) no debe ser interrumpida.*/
    return res.status(204).send();
  }
});

export default router;

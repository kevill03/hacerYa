import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "secret";

// ----------------------------------------------------------------------
// RUTA: REGISTRO DE USUARIOS (POST /register) - ACTIVA
// ----------------------------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;

    // 1. Validación básica de campos requeridos
    if (!email || !password)
      return res.status(400).json({ error: "Email y contraseña requeridos" });

    // 2. Verificación de usuario existente
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (rows.length)
      return res.status(409).json({ error: "Email ya registrado" });

    // 3. Inserción del nuevo usuario
    // NOTA: Se mantiene la contraseña en texto plano según lo solicitado para el módulo inicial.
    const insert = await pool.query(
      "INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role, full_name",
      [email, password, full_name || null, role || "user"]
    );

    // 4. Respuesta de éxito
    return res.status(201).json({ user: insert.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error en servidor" });
  }
});

// ----------------------------------------------------------------------
// RUTA: LOGIN de usuarios (POST /register) - ACTIVA
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
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });
    if (password !== user.password)
      return res.status(401).json({ error: "Credenciales inválidas" });

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

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

export default router;

import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { logAction } from "../utils/logAction.js";
import { verifyToken } from "../middleware/auth.js";
import bcrypt from "bcryptjs";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "secret";

// RUTA: REGISTRO DE USUARIOS (POST /register)

router.post("/register", async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email y contraseña requeridos" });

    // Verificación de usuario existente
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (rows.length)
      return res.status(409).json({ error: "Email ya registrado" });

    // Se Hashea la contraseña antes de guardarla ---
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Inserción del nuevo usuario (guardamos el HASH, no la contraseña)
    const insert = await pool.query(
      "INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role, full_name",
      [email, passwordHash, full_name || null, role || "user"] // <-- Usamos passwordHash
    );
    const newUser = insert.rows[0];

    // LLAMADA A BITÁCORA (Registro Exitoso)
    logAction({
      userId: newUser.id,
      action: `USER_REGISTERED: ${newUser.email}`,
    });

    return res.status(201).json({ user: newUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error en servidor" });
  }
});

// RUTA: LOGIN de usuarios (POST /login)

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email y contraseña requeridos" });

    const { rows } = await pool.query(
      "SELECT id, email, password, role, full_name, account_status FROM users WHERE email = $1",
      [email]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    let isMatch = false;
    const dbPassword = user.password; // Contraseña guardada en la BD

    // Se Revisa si la contraseña de la BD es un hash de bcrypt
    // (Segun documentacion, Los hashes de bcrypt siempre empiezan con $2a$, $2b$, o $2y$)
    if (
      dbPassword &&
      (dbPassword.startsWith("$2a$") || dbPassword.startsWith("$2b$"))
    ) {
      // Si es un HASH. Usamos bcrypt.compare
      isMatch = await bcrypt.compare(password, dbPassword);
    } else {
      // Si no es un hash. Es texto plano
      // (Es necesario este cambio ya que la logica de bcrypt se empezó a implementar el 08/11/2025)
      console.warn(
        `Usuario ${email} tiene contraseña en texto plano. Se recomienda actualizar.`
      );
      isMatch = password === dbPassword;
    }

    if (!isMatch) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Verificacion si la cuenta está bloqueada ---
    if (user.account_status === "blocked") {
      logAction({
        userId: user.id,
        action: "USER_LOGIN_FAILED_BLOCKED", // Log de intento de login bloqueado
      });
      return res
        .status(403)
        .json({ error: "Esta cuenta ha sido bloqueada por un administrador." });
    }

    //Creación del Token
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    //LLAMADA A BITÁCORA (Login Exitoso)
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

// RUTA: LOGOUT de usuarios (POST /logout) - (SIN CAMBIOS)

router.post("/logout", verifyToken, async (req, res) => {
  try {
    logAction({
      userId: req.userId,
      action: "USER_LOGOUT_SUCCESS",
    });
    return res.status(204).send();
  } catch (error) {
    console.error("Error al registrar logout en bitácora:", error);
    return res.status(204).send();
  }
});

export default router;

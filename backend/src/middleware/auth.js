import jwt from "jsonwebtoken";

// Asegúrate de que esta clave secreta coincida con la usada en src/routes/auth.js
const JWT_SECRET = process.env.JWT_SECRET || "secret";

/**
 * Middleware para verificar un token JWT, asegurar la autenticación
 * y adjuntar la información del usuario a req.user y req.userId.
 * RENOMBRADO de 'authRequired' a 'verifyToken' para compatibilidad con las rutas.
 */
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Mejoramos el mensaje para ser más específico que "Token faltante"
    return res
      .status(401)
      .json({
        error:
          "Token de autorización faltante o formato incorrecto (Bearer token).",
      });
  }

  // Extraemos el token eliminando "Bearer "
  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Adjuntamos el payload decodificado a req.user (contiene id, role, email)
    req.user = payload;
    // Para el controlador de proyectos, adjuntamos el ID directamente
    req.userId = payload.id;

    next();
  } catch (err) {
    // Manejo de token inválido o expirado
    return res.status(403).json({ error: "Token inválido o expirado." });
  }
};

/**
 * Middleware para restringir el acceso solo a usuarios con rol 'admin'.
 * Requiere que verifyToken se ejecute previamente.
 */
export const adminOnly = (req, res, next) => {
  // Si la verificación falló o no se ejecutó
  if (!req.user) {
    return res
      .status(401)
      .json({ error: "Acceso denegado. Se requiere autenticación." });
  }

  // Verificación de rol
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Acceso restringido. Se requiere rol de administrador." });
  }

  next();
};

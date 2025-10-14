import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "secret";

export const authRequired = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token faltante" });
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // payload contiene { id, role, email, iat, exp }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};

export const adminOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  if (req.user.role !== "admin")
    return res
      .status(403)
      .json({ error: "Acceso restringido a administradores" });
  next();
};

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { all, DATA_DIR, get, logActividad, run } from "./db.ts";

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: "admin" | "operador";
  activo: number;
  ultimo_acceso: string | null;
  created_at: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: Usuario;
  }
}

/** Secreto JWT: variable de entorno o uno aleatorio persistido en server/data. */
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const f = path.join(DATA_DIR, ".jwt_secret");
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(48).toString("hex"));
  return fs.readFileSync(f, "utf8").trim();
}
const SECRET = loadSecret();
const PUBLIC_COLS = "id, nombre, email, rol, activo, ultimo_acceso, created_at";

const sign = (u: Usuario) => jwt.sign({ sub: u.id }, SECRET, { expiresIn: "12h" });

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Las imágenes (<img src>) no pueden mandar cabeceras: aceptamos el token también como ?t=
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    (typeof req.query.t === "string" ? req.query.t : undefined);
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    const { sub } = jwt.verify(token, SECRET) as unknown as { sub: number };
    const u = get<Usuario>(`SELECT ${PUBLIC_COLS} FROM usuarios WHERE id = ?`, [sub]);
    if (!u || !u.activo) return res.status(401).json({ error: "Usuario inactivo o inexistente" });
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: "Sesión expirada, inicia sesión de nuevo" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.rol !== "admin") return res.status(403).json({ error: "Requiere rol administrador" });
  next();
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const nombre = String(req.body?.nombre ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (nombre.length < 2) return res.status(400).json({ error: "Nombre requerido" });
  if (!emailOk(email)) return res.status(400).json({ error: "Correo inválido" });
  if (password.length < 8) return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  if (get("SELECT id FROM usuarios WHERE email = ?", [email]))
    return res.status(409).json({ error: "Ese correo ya está registrado" });
  // El primer usuario del sistema queda como administrador.
  const primero = !get<{ n: number }>("SELECT COUNT(*) n FROM usuarios")?.n;
  const hash = await bcrypt.hash(password, 10);
  const { id } = run("INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)", [
    nombre,
    email,
    hash,
    primero ? "admin" : "operador",
  ]);
  const u = get<Usuario>(`SELECT ${PUBLIC_COLS} FROM usuarios WHERE id = ?`, [id])!;
  logActividad(id, "registro", email);
  res.status(201).json({ token: sign(u), user: u });
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const row = get<Usuario & { password_hash: string }>("SELECT * FROM usuarios WHERE email = ?", [email]);
  if (!row || !(await bcrypt.compare(password, row.password_hash)))
    return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  if (!row.activo) return res.status(403).json({ error: "Tu usuario está desactivado. Contacta al administrador." });
  run("UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?", [row.id]);
  const u = get<Usuario>(`SELECT ${PUBLIC_COLS} FROM usuarios WHERE id = ?`, [row.id])!;
  logActividad(u.id, "login");
  res.json({ token: sign(u), user: u });
});

authRouter.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

authRouter.put("/me", requireAuth, async (req, res) => {
  const nombre = String(req.body?.nombre ?? "").trim();
  const actual = String(req.body?.password_actual ?? "");
  const nueva = String(req.body?.password_nueva ?? "");
  if (nombre.length >= 2) run("UPDATE usuarios SET nombre = ? WHERE id = ?", [nombre, req.user!.id]);
  if (nueva) {
    if (nueva.length < 8) return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
    const row = get<{ password_hash: string }>("SELECT password_hash FROM usuarios WHERE id = ?", [req.user!.id])!;
    if (!(await bcrypt.compare(actual, row.password_hash)))
      return res.status(400).json({ error: "La contraseña actual no es correcta" });
    run("UPDATE usuarios SET password_hash = ? WHERE id = ?", [await bcrypt.hash(nueva, 10), req.user!.id]);
  }
  res.json({ user: get<Usuario>(`SELECT ${PUBLIC_COLS} FROM usuarios WHERE id = ?`, [req.user!.id]) });
});

/* ---------- Gestión de usuarios (solo admin) ---------- */
export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

usersRouter.get("/", (_req, res) => {
  res.json(
    all(
      `SELECT ${PUBLIC_COLS.split(", ").map((c) => "u." + c).join(", ")},
        (SELECT COUNT(*) FROM registros r WHERE r.created_by = u.id) AS registros
       FROM usuarios u ORDER BY u.created_at DESC`,
    ),
  );
});

usersRouter.post("/", async (req, res) => {
  const nombre = String(req.body?.nombre ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const rol = req.body?.rol === "admin" ? "admin" : "operador";
  if (nombre.length < 2 || !emailOk(email) || password.length < 8)
    return res.status(400).json({ error: "Datos inválidos (contraseña mínimo 8 caracteres)" });
  if (get("SELECT id FROM usuarios WHERE email = ?", [email]))
    return res.status(409).json({ error: "Ese correo ya está registrado" });
  const { id } = run("INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)", [
    nombre,
    email,
    await bcrypt.hash(password, 10),
    rol,
  ]);
  logActividad(req.user!.id, "crear_usuario", email);
  res.status(201).json(get(`SELECT ${PUBLIC_COLS} FROM usuarios WHERE id = ?`, [id]));
});

usersRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const target = get<Usuario>(`SELECT ${PUBLIC_COLS} FROM usuarios WHERE id = ?`, [id]);
  if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
  const { rol, activo, password } = req.body ?? {};
  const quitaAdmin = target.rol === "admin" && (rol === "operador" || activo === false);
  if (quitaAdmin) {
    const admins = get<{ n: number }>("SELECT COUNT(*) n FROM usuarios WHERE rol='admin' AND activo=1")!.n;
    if (admins <= 1) return res.status(400).json({ error: "Debe quedar al menos un administrador activo" });
  }
  if (rol === "admin" || rol === "operador") run("UPDATE usuarios SET rol = ? WHERE id = ?", [rol, id]);
  if (typeof activo === "boolean") run("UPDATE usuarios SET activo = ? WHERE id = ?", [activo ? 1 : 0, id]);
  if (typeof password === "string" && password) {
    if (password.length < 8) return res.status(400).json({ error: "Contraseña mínimo 8 caracteres" });
    run("UPDATE usuarios SET password_hash = ? WHERE id = ?", [await bcrypt.hash(password, 10), id]);
  }
  logActividad(req.user!.id, "editar_usuario", target.email);
  res.json(get(`SELECT ${PUBLIC_COLS} FROM usuarios WHERE id = ?`, [id]));
});

usersRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
  const target = get<Usuario>(`SELECT ${PUBLIC_COLS} FROM usuarios WHERE id = ?`, [id]);
  if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
  if (target.rol === "admin") {
    const admins = get<{ n: number }>("SELECT COUNT(*) n FROM usuarios WHERE rol='admin' AND activo=1")!.n;
    if (admins <= 1) return res.status(400).json({ error: "Debe quedar al menos un administrador activo" });
  }
  run("DELETE FROM usuarios WHERE id = ?", [id]);
  logActividad(req.user!.id, "eliminar_usuario", target.email);
  res.json({ ok: true });
});

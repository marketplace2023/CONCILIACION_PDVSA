import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { authRouter, requireAuth, usersRouter } from "./auth.ts";
import { all, flushDb, initDb, UPLOAD_DIR } from "./db.ts";
import { estacionesRouter, ocrRouter, registrosRouter } from "./registros.ts";
import { claudeEnabled } from "./ocr.ts";
import { requireAdmin } from "./auth.ts";

await initDb();

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/usuarios", usersRouter);
app.use("/api/registros", registrosRouter);
app.use("/api/estaciones", estacionesRouter);
app.use("/api/ocr", ocrRouter);

app.get("/api/actividad", requireAuth, requireAdmin, (_req, res) => {
  res.json(
    all(
      `SELECT a.*, u.nombre FROM actividad a LEFT JOIN usuarios u ON u.id = a.usuario_id
       ORDER BY a.id DESC LIMIT 100`,
    ),
  );
});

// Archivos subidos (facturas / comprobantes), solo para usuarios autenticados.
app.get("/api/files/:name", requireAuth, (req, res) => {
  const name = path.basename(String(req.params.name));
  const p = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.setHeader("Cache-Control", "private, max-age=86400").sendFile(p);
});

// En producción servimos el frontend compilado.
const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express identifica el manejador de errores por sus 4 argumentos
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Error interno" });
});

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`API conciliación lista en http://localhost:${PORT}  (OCR IA: ${claudeEnabled() ? "Claude" : "desactivado → Tesseract en el navegador"})`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    flushDb();
    process.exit(0);
  });
}

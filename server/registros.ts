import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type Request } from "express";
import multer from "multer";
import { requireAdmin, requireAuth } from "./auth.ts";
import { all, get, logActividad, run, UPLOAD_DIR } from "./db.ts";
import { buildConciliacionXlsx, type RegistroExcel } from "./excel.ts";
import { claudeEnabled, extractWithClaude } from "./ocr.ts";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + (EXT[file.mimetype] ?? "")),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.has(file.mimetype)),
});
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.has(file.mimetype)),
});

export interface Registro extends RegistroExcel {
  id: number;
  nro_control: string | null;
  total_factura: number | null;
  factura_img: string | null;
  comprobante_img: string | null;
  origen: string;
  created_by: number | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

const str = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  return s === "" || s === "null" || s === "undefined" ? null : s;
};
const num = (v: unknown) => {
  const s = str(v);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const isoDate = (v: unknown) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

type Files = Record<string, Express.Multer.File[]> | undefined;
const fileOf = (req: Request, name: string) => (req.files as Files)?.[name]?.[0];
const removeUpload = (name: string | null) => {
  if (!name) return;
  const p = path.join(UPLOAD_DIR, path.basename(name));
  fs.promises.unlink(p).catch(() => {});
};

function buildWhere(q: Request["query"]) {
  const where: string[] = [];
  const p: (string | number)[] = [];
  const text = str(q.q);
  if (text) {
    where.push("(r.nro_factura LIKE ? OR r.referencia LIKE ? OR r.estacion LIKE ? OR r.observaciones LIKE ?)");
    p.push(...Array(4).fill(`%${text}%`));
  }
  if (str(q.estacion)) {
    where.push("r.estacion = ?");
    p.push(str(q.estacion)!);
  }
  if (isoDate(q.desde)) {
    where.push("r.fecha_emision >= ?");
    p.push(isoDate(q.desde)!);
  }
  if (isoDate(q.hasta)) {
    where.push("r.fecha_emision <= ?");
    p.push(isoDate(q.hasta)!);
  }
  if (isoDate(q.pago_desde)) {
    where.push("r.fecha_pago >= ?");
    p.push(isoDate(q.pago_desde)!);
  }
  if (isoDate(q.pago_hasta)) {
    where.push("r.fecha_pago <= ?");
    p.push(isoDate(q.pago_hasta)!);
  }
  if (q.estado === "pagada") where.push("r.pago_bs IS NOT NULL AND r.referencia IS NOT NULL");
  if (q.estado === "pendiente") where.push("(r.pago_bs IS NULL OR r.referencia IS NULL)");
  return { sql: where.length ? "WHERE " + where.join(" AND ") : "", p };
}

const SELECT = `SELECT r.*, u.nombre AS creado_por FROM registros r LEFT JOIN usuarios u ON u.id = r.created_by`;
const ORDER = "ORDER BY r.estacion COLLATE NOCASE, r.fecha_emision, r.nro_factura, r.fecha_pago";

function findDuplicate(nro_factura: string, referencia: string | null, exceptId?: number) {
  return get<Registro>(
    `SELECT * FROM registros WHERE nro_factura = ? AND COALESCE(referencia,'') = COALESCE(?, '') AND id != ?`,
    [nro_factura, referencia, exceptId ?? -1],
  );
}

export const registrosRouter = Router();
registrosRouter.use(requireAuth);

registrosRouter.get("/", (req, res) => {
  const { sql, p } = buildWhere(req.query);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const totals = get<{ total: number; suma: number | null }>(
    `SELECT COUNT(*) total, SUM(r.pago_bs) suma FROM registros r ${sql}`,
    p,
  )!;
  const items = all<Registro>(`${SELECT} ${sql} ${ORDER} LIMIT ? OFFSET ?`, [...p, limit, (page - 1) * limit]);
  res.json({ items, total: totals.total, suma: totals.suma ?? 0, page, limit });
});

registrosRouter.get("/stats", (_req, res) => {
  const resumen = get(
    `SELECT COUNT(*) total, COALESCE(SUM(pago_bs),0) pagado,
      SUM(CASE WHEN pago_bs IS NULL OR referencia IS NULL THEN 1 ELSE 0 END) pendientes,
      COUNT(DISTINCT nro_factura) facturas,
      SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) hoy
     FROM registros`,
  );
  const porEstacion = all(
    `SELECT COALESCE(estacion,'Sin estación') estacion, COUNT(*) registros, COALESCE(SUM(pago_bs),0) pagado
     FROM registros GROUP BY 1 ORDER BY pagado DESC`,
  );
  const porMes = all(
    `SELECT substr(fecha_pago,1,7) mes, COALESCE(SUM(pago_bs),0) pagado, COUNT(*) registros
     FROM registros WHERE fecha_pago IS NOT NULL GROUP BY 1 ORDER BY 1 DESC LIMIT 6`,
  ).reverse();
  const recientes = all(`${SELECT} ORDER BY r.created_at DESC, r.id DESC LIMIT 6`);
  res.json({ resumen, porEstacion, porMes, recientes });
});

registrosRouter.get("/export.xlsx", async (req, res) => {
  const { sql, p } = buildWhere(req.query);
  const rows = all<Registro>(`${SELECT} ${sql} ${ORDER}`, p);
  const buf = await buildConciliacionXlsx(rows);
  const hoy = new Date();
  const f = `${String(hoy.getDate()).padStart(2, "0")}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${hoy.getFullYear()}`;
  logActividad(req.user!.id, "exportar_excel", `${rows.length} filas`);
  res
    .setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .setHeader(
      "Content-Disposition",
      `attachment; filename="CONCILIACION_PDVSA_${f}.xlsx"; filename*=UTF-8''${encodeURIComponent(`CONCILIACIÓN PDVSA ACTUALIZADO AL ${f}.xlsx`)}`,
    )
    .send(buf);
});

registrosRouter.get("/duplicado", (req, res) => {
  const f = str(req.query.nro_factura);
  if (!f) return res.json({ duplicado: null });
  res.json({ duplicado: findDuplicate(f, str(req.query.referencia)) ?? null });
});

registrosRouter.get("/:id", (req, res) => {
  const r = get<Registro>(`${SELECT} WHERE r.id = ?`, [Number(req.params.id)]);
  if (!r) return res.status(404).json({ error: "Registro no encontrado" });
  res.json(r);
});

const fields = upload.fields([
  { name: "factura", maxCount: 1 },
  { name: "comprobante", maxCount: 1 },
]);

function readBody(b: Record<string, unknown>) {
  return {
    fecha_emision: isoDate(b.fecha_emision),
    codigo: str(b.codigo),
    estacion: str(b.estacion),
    nro_factura: str(b.nro_factura)?.replace(/\s/g, "") ?? null,
    nro_control: str(b.nro_control),
    total_factura: num(b.total_factura),
    pago_bs: num(b.pago_bs),
    fecha_pago: isoDate(b.fecha_pago),
    referencia: str(b.referencia)?.replace(/\s/g, "") ?? null,
    observaciones: str(b.observaciones),
    origen: ["ocr", "pdf", "manual"].includes(String(b.origen)) ? String(b.origen) : "manual",
  };
}

registrosRouter.post("/", fields, (req, res) => {
  const d = readBody(req.body ?? {});
  const fac = fileOf(req, "factura");
  const comp = fileOf(req, "comprobante");
  const cleanup = () => [fac, comp].forEach((f) => f && removeUpload(f.filename));
  if (!d.nro_factura) {
    cleanup();
    return res.status(400).json({ error: "El N° de factura es obligatorio" });
  }
  const dup = findDuplicate(d.nro_factura, d.referencia);
  if (dup && req.body?.forzar !== "true") {
    cleanup();
    return res.status(409).json({ error: "Ya existe un registro con esa factura y referencia de pago", duplicado: dup });
  }
  const { id } = run(
    `INSERT INTO registros (fecha_emision, codigo, estacion, nro_factura, nro_control, total_factura, pago_bs,
      fecha_pago, referencia, observaciones, factura_img, comprobante_img, origen, created_by, updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      d.fecha_emision,
      d.codigo,
      d.estacion,
      d.nro_factura,
      d.nro_control,
      d.total_factura,
      d.pago_bs,
      d.fecha_pago,
      d.referencia,
      d.observaciones,
      fac?.filename ?? null,
      comp?.filename ?? null,
      d.origen,
      req.user!.id,
      req.user!.id,
    ],
  );
  logActividad(req.user!.id, "crear_registro", d.nro_factura);
  res.status(201).json(get(`${SELECT} WHERE r.id = ?`, [id]));
});

registrosRouter.put("/:id", fields, (req, res) => {
  const id = Number(req.params.id);
  const prev = get<Registro>("SELECT * FROM registros WHERE id = ?", [id]);
  const fac = fileOf(req, "factura");
  const comp = fileOf(req, "comprobante");
  if (!prev) {
    [fac, comp].forEach((f) => f && removeUpload(f.filename));
    return res.status(404).json({ error: "Registro no encontrado" });
  }
  const d = readBody({ ...prev, ...req.body, origen: prev.origen });
  if (!d.nro_factura) return res.status(400).json({ error: "El N° de factura es obligatorio" });
  const dup = findDuplicate(d.nro_factura, d.referencia, id);
  if (dup) return res.status(409).json({ error: "Ya existe otro registro con esa factura y referencia", duplicado: dup });
  if (fac) removeUpload(prev.factura_img);
  if (comp) removeUpload(prev.comprobante_img);
  run(
    `UPDATE registros SET fecha_emision=?, codigo=?, estacion=?, nro_factura=?, nro_control=?, total_factura=?,
      pago_bs=?, fecha_pago=?, referencia=?, observaciones=?, factura_img=?, comprobante_img=?,
      updated_by=?, updated_at=datetime('now') WHERE id=?`,
    [
      d.fecha_emision,
      d.codigo,
      d.estacion,
      d.nro_factura,
      d.nro_control,
      d.total_factura,
      d.pago_bs,
      d.fecha_pago,
      d.referencia,
      d.observaciones,
      fac?.filename ?? prev.factura_img,
      comp?.filename ?? prev.comprobante_img,
      req.user!.id,
      id,
    ],
  );
  logActividad(req.user!.id, "editar_registro", d.nro_factura);
  res.json(get(`${SELECT} WHERE r.id = ?`, [id]));
});

registrosRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const prev = get<Registro>("SELECT * FROM registros WHERE id = ?", [id]);
  if (!prev) return res.status(404).json({ error: "Registro no encontrado" });
  if (req.user!.rol !== "admin" && prev.created_by !== req.user!.id)
    return res.status(403).json({ error: "Solo el administrador o quien lo creó puede eliminarlo" });
  run("DELETE FROM registros WHERE id = ?", [id]);
  removeUpload(prev.factura_img);
  removeUpload(prev.comprobante_img);
  logActividad(req.user!.id, "eliminar_registro", prev.nro_factura);
  res.json({ ok: true });
});

/* ---------- OCR con Claude (opcional) ---------- */
export const ocrRouter = Router();
ocrRouter.use(requireAuth);
ocrRouter.get("/status", (_req, res) => res.json({ claude: claudeEnabled() }));
ocrRouter.post(
  "/",
  memUpload.fields([
    { name: "factura", maxCount: 1 },
    { name: "comprobante", maxCount: 1 },
  ]),
  async (req, res) => {
    if (!claudeEnabled()) return res.status(501).json({ error: "OCR con IA no configurado" });
    const files = (["factura", "comprobante"] as const).flatMap((k) => {
      const f = fileOf(req, k);
      return f ? [{ label: k === "factura" ? "Factura PDVSA" : "Comprobante de pago", mime: f.mimetype, data: f.buffer }] : [];
    });
    if (!files.length) return res.status(400).json({ error: "Sube al menos una imagen" });
    try {
      res.json(await extractWithClaude(files));
    } catch (e) {
      console.error("[ocr]", e);
      res.status(502).json({ error: "No se pudo leer el documento con IA" });
    }
  },
);

/* ---------- Estaciones ---------- */
export const estacionesRouter = Router();
estacionesRouter.use(requireAuth);
estacionesRouter.get("/", (_req, res) => res.json(all("SELECT * FROM estaciones ORDER BY nombre COLLATE NOCASE")));
estacionesRouter.post("/", requireAdmin, (req, res) => {
  const nombre = str(req.body?.nombre);
  const codigo = str(req.body?.codigo) ?? "509002";
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  if (get("SELECT id FROM estaciones WHERE nombre = ?", [nombre])) return res.status(409).json({ error: "Ya existe" });
  const alias = str(req.body?.alias) ?? nombre.toUpperCase();
  const { id } = run("INSERT INTO estaciones (codigo, nombre, alias) VALUES (?,?,?)", [codigo, nombre, alias]);
  res.status(201).json(get("SELECT * FROM estaciones WHERE id = ?", [id]));
});
estacionesRouter.delete("/:id", requireAdmin, (req, res) => {
  run("DELETE FROM estaciones WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
});

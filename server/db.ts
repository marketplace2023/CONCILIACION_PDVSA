import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import initSqlJs, { type Database, type SqlValue } from "sql.js";

const require = createRequire(import.meta.url);

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "server/data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "conciliacion.sqlite");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let db: Database;

/** Estaciones de servicio conocidas (de la hoja modelo). `alias` = palabras clave para reconocerlas en OCR/PDF. */
const ESTACIONES_SEED: Array<[string, string, string]> = [
  ["509002", "Lagoamerica", "LAGOAMERICA,LAGO AMERICA"],
  ["509002", "La Creole", "CREOLE"],
  ["509002", "Arellano", "ARELLANO"],
  ["509002", "Libertad", "LIBERTAD"],
  ["509002", "Albalago", "ALBALAGO"],
  ["509002", "Llanitos", "LLANITOS"],
  ["509002", "Palmarito", "PALMARITO"],
];

export async function initDb() {
  const SQL = await initSqlJs({
    useOldExtensionFunctions: false,
    locateFile: (f: string) => require.resolve(`sql.js/dist/${f}`),
  });
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'operador' CHECK (rol IN ('admin','operador')),
      activo INTEGER NOT NULL DEFAULT 1,
      ultimo_acceso TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS estaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL,
      nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
      alias TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_emision TEXT,
      codigo TEXT,
      estacion TEXT,
      nro_factura TEXT NOT NULL,
      nro_control TEXT,
      total_factura REAL,
      pago_bs REAL,
      fecha_pago TEXT,
      referencia TEXT,
      observaciones TEXT,
      factura_img TEXT,
      comprobante_img TEXT,
      origen TEXT NOT NULL DEFAULT 'manual',
      created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reg_factura ON registros(nro_factura);
    CREATE INDEX IF NOT EXISTS idx_reg_fecha ON registros(fecha_emision);
    CREATE TABLE IF NOT EXISTS actividad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      accion TEXT NOT NULL,
      detalle TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  if (!get<{ n: number }>("SELECT COUNT(*) n FROM estaciones")?.n) {
    for (const [codigo, nombre, alias] of ESTACIONES_SEED) {
      run("INSERT INTO estaciones (codigo, nombre, alias) VALUES (?,?,?)", [codigo, nombre, alias]);
    }
  }
  persist();
}

let saveTimer: NodeJS.Timeout | null = null;
/** sql.js trabaja en memoria: volcamos a disco tras cada escritura (agrupado en 150 ms). */
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, Buffer.from(db.export()));
    fs.renameSync(tmp, DB_FILE);
  }, 150);
}

export function flushDb() {
  if (saveTimer) clearTimeout(saveTimer);
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

type Params = SqlValue[] | Record<string, SqlValue>;

export function all<T = Record<string, unknown>>(sql: string, params: Params = []): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export function get<T = Record<string, unknown>>(sql: string, params: Params = []): T | undefined {
  return all<T>(sql, params)[0];
}

export function run(sql: string, params: Params = []) {
  db.run(sql, params);
  const id = (db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] as number) ?? 0;
  const changes = db.getRowsModified();
  persist();
  return { id, changes };
}

export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    persist();
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function logActividad(usuarioId: number | null, accion: string, detalle?: string) {
  run("INSERT INTO actividad (usuario_id, accion, detalle) VALUES (?,?,?)", [usuarioId, accion, detalle ?? null]);
}

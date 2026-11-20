import { createWorker, PSM, type Worker } from "tesseract.js";
import { api } from "./api";
import { openPdf, pageText, renderPage } from "./pdf";
import { matchEstacion, mergeExtracted, parseComprobante, parseEncabezado, parseFactura, type Extracted } from "./parse";
import type { Estacion } from "./types";

export type Motor = "claude" | "tesseract";

/** Redimensiona / comprime fotos de cámara para no guardar imágenes de 10 MB. */
export async function compressImage(file: File | Blob, maxSide = 2200, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", quality));
}

/** Escala de grises + contraste (mejora mucho a Tesseract con fotos de papel) y giro opcional. */
async function preprocess(img: Blob, grados: 0 | 90 | 180 | 270 = 0): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(img);
  const scale = Math.min(2.5, 2400 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const lado = grados === 90 || grados === 270;
  const c = document.createElement("canvas");
  c.width = lado ? h : w;
  c.height = lado ? w : h;
  const ctx = c.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.6) brightness(1.05)";
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((grados * Math.PI) / 180);
  ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close();
  return c;
}

let workerP: Promise<Worker> | null = null;
let progressCb: ((p: number) => void) | null = null;
function getWorker() {
  workerP ??= createWorker("spa", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") progressCb?.(m.progress);
    },
  });
  return workerP;
}

async function tesseractText(
  img: Blob,
  grados: 0 | 90 | 180 | 270,
  onProgress?: (p: number) => void,
  disperso = false,
) {
  const worker = await getWorker();
  // SPARSE_TEXT lee mejor las casillas sueltas de la factura (FACTURA, CLIENTE, FECHA EMISION)
  await worker.setParameters({ tessedit_pageseg_mode: disperso ? PSM.SPARSE_TEXT : PSM.AUTO });
  progressCb = onProgress ?? null;
  const { data } = await worker.recognize(await preprocess(img, grados));
  progressCb = null;
  return data.text;
}

const contarCampos = (d: Extracted) => Object.values(d).filter(Boolean).length;

/**
 * OCR con detección de orientación: si la foto está de lado o al revés casi no se lee nada,
 * así que se prueban los otros giros y se queda con el que más campos útiles obtiene.
 */
async function leerConGiro(
  img: Blob,
  parse: (t: string) => Extracted,
  minimo: number,
  claves: (keyof Extracted)[],
  etiqueta: string,
  onStep?: (msg: string, progress?: number) => void,
) {
  let mejor = { texto: "", datos: {} as Extracted, n: -1, grados: 0 as 0 | 90 | 180 | 270 };
  for (const g of [0, 90, 270, 180] as const) {
    const msg = g === 0 ? `Leyendo ${etiqueta}…` : `Probando ${etiqueta} girada ${g}°…`;
    onStep?.(msg, 0);
    const texto = await tesseractText(img, g, (p) => onStep?.(msg, p));
    const datos = parse(texto);
    const n = contarCampos(datos);
    if (n > mejor.n) mejor = { texto, datos, n, grados: g };
    if (n >= minimo) break;
  }
  if (claves.some((k) => !mejor.datos[k])) {
    const msg = `Buscando datos faltantes de la ${etiqueta}…`;
    onStep?.(msg, 0);
    const texto = await tesseractText(img, mejor.grados, (p) => onStep?.(msg, p), true);
    mejor.datos = mergeExtracted(mejor.datos, parse(texto));
    mejor.texto += `
--- segunda pasada (texto disperso) ---
${texto}`;
  }
  return mejor;
}

/** Si es PDF: devuelve su texto (si tiene) y la primera página como imagen. */
async function fromPdf(file: File) {
  const doc = await openPdf(file);
  let text = "";
  for (let n = 1; n <= Math.min(doc.numPages, 3); n++) text += (await pageText(doc, n)) + "\n";
  const image = await renderPage(doc, 1);
  return { text, image };
}

export interface LecturaResultado {
  datos: Extracted;
  motor: Motor | "pdf-texto";
  textoCrudo: string;
}

/**
 * Lee factura y/o comprobante. Prioridad:
 * 1) texto embebido del PDF (exacto) · 2) Claude visión (si está configurado) · 3) Tesseract en el navegador.
 */
export async function leerDocumentos(
  opts: { factura?: File | null; comprobante?: File | null; motor: Motor; estaciones: Estacion[] },
  onStep?: (msg: string, progress?: number) => void,
): Promise<LecturaResultado> {
  const { factura, comprobante, motor, estaciones } = opts;
  const partes: Extracted[] = [];
  let crudo = "";
  let usado: LecturaResultado["motor"] = motor;
  const imgs: { factura?: Blob; comprobante?: Blob } = {};

  for (const [tipo, file] of [
    ["factura", factura],
    ["comprobante", comprobante],
  ] as const) {
    if (!file) continue;
    if (file.type === "application/pdf") {
      onStep?.(`Leyendo PDF de ${tipo}…`);
      const { text, image } = await fromPdf(file);
      const util = tipo === "factura" ? parseFactura(text, estaciones) : parseComprobante(text, estaciones);
      const tieneDatos = tipo === "comprobante" ? !!util.referencia : !!(util.nro_factura && parseEncabezado(text));
      if (tieneDatos) {
        partes.push(util);
        crudo += `--- ${tipo} (PDF) ---\n${text}\n`;
        usado = "pdf-texto";
        // Un PDF modelo trae factura+comprobante: aprovechamos ambos parsers
        partes.push(parseComprobante(text, estaciones), parseFactura(text, estaciones));
        continue;
      }
      imgs[tipo] = image;
    } else {
      imgs[tipo] = file;
    }
  }

  if (imgs.factura || imgs.comprobante) {
    if (motor === "claude") {
      onStep?.("Analizando con IA (Claude)…");
      const fd = new FormData();
      if (imgs.factura) fd.append("factura", await compressImage(imgs.factura, 2400, 0.9), "factura.jpg");
      if (imgs.comprobante) fd.append("comprobante", await compressImage(imgs.comprobante, 2400, 0.9), "comprobante.jpg");
      const r = await api<Record<string, string | number | null>>("/ocr", { method: "POST", body: fd });
      const s = (v: unknown) => (v == null ? undefined : String(v));
      partes.unshift({
        nro_factura: s(r.nro_factura),
        nro_control: s(r.nro_control),
        codigo: s(r.codigo_cliente),
        fecha_emision: s(r.fecha_emision),
        estacion: matchEstacion(s(r.estacion), estaciones) ?? s(r.estacion),
        total_factura: s(r.total_factura),
        pago_bs: s(r.pago_bs),
        fecha_pago: s(r.fecha_pago),
        referencia: s(r.referencia),
      });
      crudo += JSON.stringify(r, null, 2);
      usado = "claude";
    } else {
      if (imgs.factura) {
        onStep?.("Cargando OCR…", 0);
        // factura bien leída: N° factura, fecha, estación, total… (el código 509002 casi siempre sale)
        const r = await leerConGiro(imgs.factura, (t) => parseFactura(t, estaciones), 4, ["nro_factura", "fecha_emision"], "factura", onStep);
        crudo += `--- factura ---
${r.texto}
`;
        partes.push(r.datos);
      }
      if (imgs.comprobante) {
        const r = await leerConGiro(imgs.comprobante, (t) => parseComprobante(t, estaciones), 3, ["pago_bs", "referencia", "fecha_pago"], "comprobante", onStep);
        crudo += `--- comprobante ---
${r.texto}
`;
        partes.push(r.datos);
      }
      usado = "tesseract";
    }
  }

  const datos = mergeExtracted(...partes);
  // `concepto` no es campo del registro
  delete (datos as Record<string, unknown>).concepto;
  return { datos, motor: usado, textoCrudo: crudo };
}


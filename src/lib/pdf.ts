import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { matchEstacion, parseComprobante, parseEncabezado } from "./parse";
import type { Estacion, RegistroDraft } from "./types";
import { emptyDraft } from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

type PDFDoc = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;

export async function openPdf(file: File) {
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

export async function pageText(doc: PDFDoc, n: number) {
  const page = await doc.getPage(n);
  const tc = await page.getTextContent();
  return tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("");
}

export async function renderPage(doc: PDFDoc, n: number, maxWidth = 1600): Promise<Blob> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, maxWidth / base.width) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("render"))), "image/jpeg", 0.85));
}

const isComprobante = (t: string) => /Resumen de la operaci/i.test(t) || /Monto\s*Bs/i.test(t);

export interface PdfItem {
  key: string;
  draft: RegistroDraft;
  facturaPage: number | null;
  comprobantePage: number | null;
  archivo: string;
}

/**
 * Lee un PDF modelo (página de factura + página(s) de comprobante) y arma un registro por pago.
 * Las facturas sin comprobante quedan como registro pendiente de pago.
 */
export async function analizarPdfModelo(
  file: File,
  estaciones: Estacion[],
  onProgress?: (done: number, total: number) => void,
) {
  const doc = await openPdf(file);
  const facturas = new Map<string, { page: number; fecha?: string; estacion?: string }>();
  const pagos: Array<{ page: number; factura: string; data: ReturnType<typeof parseComprobante> }> = [];
  const orden: string[] = [];

  for (let n = 1; n <= doc.numPages; n++) {
    const text = await pageText(doc, n);
    const head = parseEncabezado(text);
    if (isComprobante(text)) {
      const data = parseComprobante(text, estaciones);
      const factura = data.nro_factura ?? head?.draft.nro_factura;
      if (factura) {
        pagos.push({ page: n, factura, data });
        if (!orden.includes(factura)) orden.push(factura);
      }
    } else if (head?.draft.nro_factura) {
      const f = head.draft.nro_factura;
      if (!facturas.has(f))
        facturas.set(f, {
          page: n,
          fecha: head.draft.fecha_emision,
          estacion: matchEstacion(head.estacionTexto, estaciones) ?? head.estacionTexto,
        });
      if (!orden.includes(f)) orden.push(f);
    }
    onProgress?.(n, doc.numPages);
  }

  const items: PdfItem[] = [];
  for (const f of orden) {
    const fac = facturas.get(f);
    const ps = pagos.filter((p) => p.factura === f);
    const base: RegistroDraft = {
      ...emptyDraft(),
      nro_factura: f,
      fecha_emision: fac?.fecha ?? "",
      estacion: fac?.estacion ?? "",
    };
    if (!ps.length) {
      items.push({ key: `${file.name}-${f}`, draft: { ...base, observaciones: "Sin comprobante de pago en el PDF" }, facturaPage: fac?.page ?? null, comprobantePage: null, archivo: file.name });
      continue;
    }
    ps.forEach((p, i) => {
      const d = p.data;
      const concepto = d.concepto ?? "";
      const parcial = ps.length > 1 || /\b(2DO|SEGUNDO|ABONO|PARCIAL|RESTO)\b/i.test(concepto);
      items.push({
        key: `${file.name}-${f}-${d.referencia ?? i}`,
        draft: {
          ...base,
          fecha_emision: base.fecha_emision || d.fecha_emision || "",
          estacion: base.estacion || d.estacion || "",
          pago_bs: d.pago_bs ?? "",
          fecha_pago: d.fecha_pago ?? "",
          referencia: d.referencia ?? "",
          observaciones: parcial ? `Pago ${i + 1} de ${ps.length}. Concepto: ${concepto}` : "",
        },
        facturaPage: fac?.page ?? null,
        comprobantePage: p.page,
        archivo: file.name,
      });
    });
  }
  return { doc, items };
}

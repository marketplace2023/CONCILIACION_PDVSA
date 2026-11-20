import Anthropic from "@anthropic-ai/sdk";

/**
 * Extracción con visión de Claude (opcional). Se activa si ANTHROPIC_API_KEY está definida
 * en el .env del servidor. Si no, el cliente usa Tesseract.js en el navegador.
 */
export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const client = () => new Anthropic();

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "nro_factura",
    "nro_control",
    "codigo_cliente",
    "fecha_emision",
    "estacion",
    "total_factura",
    "pago_bs",
    "fecha_pago",
    "referencia",
    "concepto",
  ],
  properties: {
    nro_factura: { type: ["string", "null"], description: "Factura PDVSA: valor de la casilla FACTURA (9 dígitos, ej. 321057432)" },
    nro_control: { type: ["string", "null"], description: "Nº DE CONTROL, ej. 00-18812889" },
    codigo_cliente: { type: ["string", "null"], description: "Factura PDVSA: valor de la casilla CLIENTE (código, ej. 509002)" },
    fecha_emision: { type: ["string", "null"], description: "Factura PDVSA: casilla FECHA EMISION (viene DD.MM.YYYY), en formato YYYY-MM-DD" },
    estacion: {
      type: ["string", "null"],
      description:
        "Factura PDVSA: estación de servicio según la casilla NRO. ORDEN (ej. 'PD BG ALBALAGO' -> ALBALAGO), sin prefijos PD BG, E/S o M/P. Si no se lee, usa el campo Solicitante",
    },
    total_factura: { type: ["number", "null"], description: "Factura PDVSA: Total a pagar (Bs.), como número" },
    pago_bs: { type: ["number", "null"], description: "Comprobante 'Resumen de la operación': campo Monto Bs., como número" },
    fecha_pago: { type: ["string", "null"], description: "Comprobante 'Resumen de la operación': campo Fecha (DD/MM/YYYY), en formato YYYY-MM-DD" },
    referencia: { type: ["string", "null"], description: "Comprobante 'Resumen de la operación': campo Número de Referencia" },
    concepto: { type: ["string", "null"], description: "Concepto del comprobante de pago" },
  },
} as const;

export interface OcrResult {
  nro_factura: string | null;
  nro_control: string | null;
  codigo_cliente: string | null;
  fecha_emision: string | null;
  estacion: string | null;
  total_factura: number | null;
  pago_bs: number | null;
  fecha_pago: string | null;
  referencia: string | null;
  concepto: string | null;
}

type ImgMedia = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export async function extractWithClaude(files: Array<{ label: string; mime: string; data: Buffer }>): Promise<OcrResult> {
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  for (const f of files) {
    content.push({ type: "text", text: `Documento: ${f.label}` });
    if (f.mime === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: f.data.toString("base64") },
      });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: f.mime as ImgMedia, data: f.data.toString("base64") },
      });
    }
  }
  content.push({
    type: "text",
    text:
      "Extrae los datos de estos documentos venezolanos: una factura de combustible PDVSA Petróleo y/o un " +
      "comprobante de transferencia bancaria (Banco del Tesoro) que paga esa factura. " +
      "Los montos usan punto como separador de miles y coma decimal (5.304.400,32 = 5304400.32). " +
      "Las fechas de la factura vienen como DD.MM.YYYY y las del comprobante como DD/MM/YYYY; devuélvelas como YYYY-MM-DD. " +
      "Ignora los números escritos a mano (precintos). Si un campo no aparece o no es legible, usa null; no inventes valores.",
  });

  const response = await client().beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new Error("El modelo no pudo procesar el documento");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return JSON.parse(text) as OcrResult;
}

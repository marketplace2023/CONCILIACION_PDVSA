import { parseMonto, toIso } from "./format";
import type { Estacion, RegistroDraft } from "./types";

export type Extracted = Partial<RegistroDraft>;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

/** Busca a qué estación corresponde un texto (Solicitante, encabezado del PDF, concepto...). */
export function matchEstacion(text: string | null | undefined, estaciones: Estacion[]): string | null {
  if (!text) return null;
  const t = norm(text);
  let best: { nombre: string; len: number } | null = null;
  for (const e of estaciones) {
    const keys = [e.nombre, ...e.alias.split(",")].map((k) => norm(k.trim())).filter((k) => k.length >= 4);
    for (const k of keys) {
      if (t.includes(k) && (!best || k.length > best.len)) best = { nombre: e.nombre, len: k.length };
    }
  }
  return best?.nombre ?? null;
}

// Exactamente 2 decimales: "23.197,190" (litros) no es un monto en Bs.
const AMOUNT_RE = /(?<![\d.,])\d{1,3}(?:[.\s]\d{3})+,\d{2}(?!\d)/g;
const DATE_RE = /(\d{2})\s?[./-]\s?(\d{2})\s?[./-]\s?(20\d{2})/;

/**
 * Texto OCR/PDF de una factura PDVSA -> campos. Equivalencias con el Excel:
 *  FECHA EMISION -> fecha_emision · CLIENTE -> codigo · NRO. ORDEN ("PD BG ALBALAGO") -> estacion
 *  FACTURA -> nro_factura · Total a pagar (Bs.) -> total_factura
 */
export function parseFactura(raw: string, estaciones: Estacion[]): Extracted {
  const text = raw.replace(/\r/g, "");
  const flat = text.replace(/\s+/g, " ");
  const out: Extracted = {};

  // Encabezado de los PDF modelo: "M/P PALMARITO | 23/08/2026 | Factura N. 321049798"
  const head = parseEncabezado(text);
  if (head) {
    Object.assign(out, head.draft);
    const e = matchEstacion(head.estacionTexto, estaciones);
    if (e) out.estacion = e;
  }

  const fac = /FACTURA\D{0,25}(3\d[\d\s]{7,9})/i.exec(flat)?.[1]?.replace(/\s/g, "") ?? /\b(32\d{7})\b/.exec(flat)?.[1];
  if (fac && /^\d{9}$/.test(fac)) out.nro_factura ??= fac;

  const cli = /CLIENTE\D{0,20}(\d{6})\b/i.exec(flat)?.[1] ?? /\b(509\d{3})\b/.exec(flat)?.[1];
  if (cli) out.codigo = cli;

  const ctrl = /CONTROL\s*:?\s*([0O]{2}\s*-\s*[\d\s]{7,10})/i.exec(flat)?.[1];
  if (ctrl) out.nro_control = ctrl.replace(/O/g, "0").replace(/\s/g, "");

  const fe = /EMISI[OÓ0]N[^\d]{0,70}(\d{2})\s?[./-]\s?(\d{2})\s?[./-]\s?(20\d{2})/i.exec(flat) ?? DATE_RE.exec(flat);
  if (fe && !out.fecha_emision) out.fecha_emision = toIso(fe[1], fe[2], fe[3]) ?? undefined;

  // El total aparece varias veces (Total a pagar, Monto Exento, Monto Bs.): tomamos el más repetido / mayor.
  const amounts = (flat.match(AMOUNT_RE) ?? []).map((a) => parseMonto(a.replace(/\s/g, ".")) ?? 0).filter((n) => n > 0);
  if (amounts.length) {
    const freq = new Map<number, number>();
    amounts.forEach((a) => freq.set(a, (freq.get(a) ?? 0) + 1));
    const total = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    out.total_factura = String(total);
  }

  // Estación: la casilla NRO. ORDEN ("PD BG ALBALAGO") manda; luego Solicitante ("E/S ALBALAGO"); luego todo el texto.
  const orden =
    /\bP\.?\s?D\.?\s+B\.?\s?G\.?\s+([A-ZÑ][A-ZÑ.\s]{2,30})/i.exec(flat)?.[1] ??
    /N\s*R\s*O\.?\s*(?:DE\s*)?ORDEN\W{0,5}([^\n]{0,80})/i.exec(flat)?.[1];
  const solicitante = /Solicitante\s*:?\s*([^\n|]{3,40})/i.exec(text)?.[1];
  const est =
    matchEstacion(orden, estaciones) ??
    (head ? matchEstacion(head.estacionTexto, estaciones) : null) ??
    matchEstacion(solicitante, estaciones) ??
    matchEstacion(text, estaciones);
  if (est) out.estacion = est;
  return out;
}

/**
 * Texto del comprobante Banco del Tesoro ("Resumen de la operación") -> campos de pago:
 *  Monto Bs. -> pago_bs · Fecha -> fecha_pago · Número de Referencia -> referencia
 */
export function parseComprobante(raw: string, estaciones: Estacion[]): Extracted & { concepto?: string } {
  const text = raw.replace(/\r/g, "");
  const out: Extracted & { concepto?: string } = {};

  const head = parseEncabezado(text);
  if (head) {
    Object.assign(out, head.draft);
    const e = matchEstacion(head.estacionTexto, estaciones);
    if (e) out.estacion = e;
  }

  // Respaldos sin etiqueta solo si el texto es de verdad un comprobante (no la factura)
  const esComprobante = /Resumen\s*de\s*la\s*operaci|Referencia|Tesoro|Beneficiario/i.test(text);
  const monto =
    /Monto\s*Bs\.?\s*:?\s*([\d. ]+,\s?\d{2})/i.exec(text)?.[1] ?? (esComprobante ? text.match(AMOUNT_RE)?.[0] : undefined);
  const m = parseMonto(monto?.replace(/\s/g, ""));
  if (m != null) out.pago_bs = String(m);

  const fp =
    /Fecha\s*:?\s*(\d{2})\/(\d{2})\/(20\d{2})/i.exec(text) ??
    /Fecha\s*:?\s*(\d{2})-(\d{2})-(20\d{2})/i.exec(text) ??
    (esComprobante ? /\b(\d{2})\/(\d{2})\/(20\d{2})\b/.exec(text) : null);
  if (fp) out.fecha_pago = toIso(fp[1], fp[2], fp[3]) ?? undefined;

  // "Número de Referencia: 121044066" (sin saltar de línea, para no pegar otros números)
  const ref = /(?:N[uú]mero\s*de\s*)?Referencia\s*:?\s*(\d[\d ]{4,})/i.exec(text)?.[1];
  if (ref) out.referencia = ref.replace(/\s/g, "");

  const concepto = /Concepto\s*:?\s*([^\n]+)/i.exec(text)?.[1]?.trim();
  if (concepto) {
    out.concepto = concepto;
    const fac = /\b(3\d{8})\b/.exec(concepto)?.[1];
    if (fac) out.nro_factura ??= fac;
    const est = matchEstacion(concepto, estaciones);
    if (est) out.estacion ??= est;
  }
  return out;
}

/** "ALBALAGO | 18/09/2026 | Factura N. 321057432" (texto que traen los PDF modelo en cada página) */
export function parseEncabezado(text: string) {
  const m = /^\s*(.+?)\s*\|\s*(\d{2})\/(\d{2})\/(\d{4})\s*\|\s*Factura\s*N[.º°]?\s*(\d{6,})/im.exec(text);
  if (!m) return null;
  return {
    estacionTexto: m[1].trim(),
    draft: { fecha_emision: toIso(m[2], m[3], m[4]) ?? undefined, nro_factura: m[5] } satisfies Extracted,
  };
}

/** Mezcla resultados: los primeros tienen prioridad, se ignoran valores vacíos */
export function mergeExtracted(...parts: Extracted[]): Extracted {
  const out: Extracted = {};
  for (const p of parts) {
    for (const [k, v] of Object.entries(p) as [keyof RegistroDraft, string | undefined][]) {
      if (v && !out[k]) out[k] = v;
    }
  }
  return out;
}

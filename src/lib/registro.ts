import type { RegistroDraft } from "./types";

export const REQUIRED: (keyof RegistroDraft)[] = ["nro_factura", "fecha_emision", "estacion"];

export function validarDraft(d: RegistroDraft) {
  const errs: Partial<Record<keyof RegistroDraft, string>> = {};
  if (!/^\d{6,12}$/.test(d.nro_factura.trim())) errs.nro_factura = "N° de factura inválido";
  if (!d.fecha_emision) errs.fecha_emision = "Requerida";
  if (!d.estacion.trim()) errs.estacion = "Requerida";
  if (d.pago_bs && !(Number(d.pago_bs) > 0)) errs.pago_bs = "Monto inválido";
  if (d.pago_bs && !d.referencia) errs.referencia = "Indica la referencia del pago";
  if (d.referencia && !/^\d{4,20}$/.test(d.referencia.trim())) errs.referencia = "Solo números";
  return errs;
}

export function draftToFormData(d: RegistroDraft, extra: Record<string, string | Blob | undefined> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(d)) fd.append(k, String(v ?? "").trim());
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) continue;
    if (v instanceof Blob) fd.append(k, v, k + (v.type === "application/pdf" ? ".pdf" : ".jpg"));
    else fd.append(k, v);
  }
  return fd;
}

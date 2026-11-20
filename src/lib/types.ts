export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: "admin" | "operador";
  activo: number;
  ultimo_acceso: string | null;
  created_at: string;
  registros?: number;
}

export interface Estacion {
  id: number;
  codigo: string;
  nombre: string;
  alias: string;
}

export interface Registro {
  id: number;
  fecha_emision: string | null;
  codigo: string | null;
  estacion: string | null;
  nro_factura: string;
  nro_control: string | null;
  total_factura: number | null;
  pago_bs: number | null;
  fecha_pago: string | null;
  referencia: string | null;
  observaciones: string | null;
  factura_img: string | null;
  comprobante_img: string | null;
  origen: "ocr" | "pdf" | "manual";
  created_by: number | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Datos editables de un registro (lo que llena el OCR / el formulario) */
export interface RegistroDraft {
  fecha_emision: string;
  codigo: string;
  estacion: string;
  nro_factura: string;
  nro_control: string;
  total_factura: string;
  pago_bs: string;
  fecha_pago: string;
  referencia: string;
  observaciones: string;
}

export const emptyDraft = (): RegistroDraft => ({
  fecha_emision: "",
  codigo: "509002",
  estacion: "",
  nro_factura: "",
  nro_control: "",
  total_factura: "",
  pago_bs: "",
  fecha_pago: "",
  referencia: "",
  observaciones: "",
});

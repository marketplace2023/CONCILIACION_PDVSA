import ExcelJS from "exceljs";

export interface RegistroExcel {
  fecha_emision: string | null;
  codigo: string | null;
  estacion: string | null;
  nro_factura: string;
  pago_bs: number | null;
  fecha_pago: string | null;
  referencia: string | null;
  observaciones: string | null;
}

const toDate = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : null;
};
const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const ddmmyyyy = (d: Date) => `${ddmm(d)}/${d.getUTCFullYear()}`;

/**
 * Genera el Excel con el mismo formato que "CONCILIACIÓN PDVSA ACTUALIZADO AL ...xlsx":
 * título (A1), rango de pagos (A2), encabezados en la fila 4 y datos desde la fila 5.
 */
export async function buildConciliacionXlsx(rows: RegistroExcel[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Conciliación PDVSA";
  wb.created = new Date();
  const ws = wb.addWorksheet("CONCILIACION ", { views: [{ state: "frozen", ySplit: 4 }] });

  ws.columns = [
    { key: "fecha_emision", width: 13 },
    { key: "codigo", width: 13 },
    { key: "estacion", width: 16.29 },
    { key: "nro_factura", width: 17 },
    { key: "pago_bs", width: 14.43 },
    { key: "fecha_pago", width: 13.71 },
    { key: "referencia", width: 16.43 },
    { key: "observaciones", width: 42.57 },
  ];

  const pagos = rows.map((r) => toDate(r.fecha_pago)).filter((d): d is Date => !!d).sort((a, b) => +a - +b);
  const titleFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 14, bold: true };
  ws.getCell("A1").value = "Conciliación de Pagos - Estaciones de Servicio CORPOMÉRIDA";
  ws.getCell("A1").font = titleFont;
  ws.getCell("A2").value = pagos.length
    ? `Desde el ${ddmm(pagos[0])} al ${ddmmyyyy(pagos[pagos.length - 1])}`
    : `Generado el ${ddmmyyyy(new Date())}`;
  ws.getCell("A2").font = titleFont;

  const thin: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  const headers = [
    "Fecha de Emisión ",
    "Código",
    "Estación de Servicio",
    "N° Factura",
    "Pago Bs. ",
    "Fecha de Pago",
    "Referencia de Pago",
    "Observaciones",
  ];
  const head = ws.getRow(4);
  head.height = 31.5;
  headers.forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h;
    c.font = { name: "Calibri", size: 12, bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFBFBF" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = thin;
  });

  rows.forEach((r, i) => {
    // Número como en el modelo, salvo que empiece por 0 (se perdería el cero de la referencia)
    const asNum = (v: string | null) => (v && /^[1-9]\d{0,14}$/.test(v) ? Number(v) : v);
    const row = ws.getRow(5 + i);
    row.values = [
      toDate(r.fecha_emision),
      asNum(r.codigo),
      r.estacion,
      r.nro_factura,
      r.pago_bs,
      toDate(r.fecha_pago),
      asNum(r.referencia),
      r.observaciones || null,
    ];
    row.eachCell({ includeEmpty: true }, (c, col) => {
      if (col > 8) return;
      c.font = { name: "Calibri", size: 11 };
      c.border = thin;
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: col === 8 };
    });
    row.getCell(1).numFmt = "dd/mm/yyyy";
    row.getCell(4).numFmt = "@";
    row.getCell(5).numFmt = '_ * #,##0.00_ ;_ * \\-#,##0.00_ ;_ * "-"??_ ;_ @_ ';
    row.getCell(6).numFmt = "dd/mm/yyyy";
    row.getCell(8).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  });

  // Fila de total
  if (rows.length) {
    const tr = ws.getRow(5 + rows.length);
    tr.getCell(4).value = "TOTAL";
    tr.getCell(5).value = { formula: `SUM(E5:E${4 + rows.length})` };
    tr.getCell(5).numFmt = '_ * #,##0.00_ ;_ * \\-#,##0.00_ ;_ * "-"??_ ;_ @_ ';
    [4, 5].forEach((c) => {
      tr.getCell(c).font = { name: "Calibri", size: 11, bold: true };
      tr.getCell(c).border = thin;
      tr.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
    });
  }

  ws.autoFilter = { from: "A4", to: "H4" };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

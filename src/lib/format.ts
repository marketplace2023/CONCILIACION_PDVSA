const bs = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtBs = (n: number | null | undefined) => (n == null ? "—" : `Bs. ${bs.format(n)}`);
export const fmtNum = (n: number | null | undefined) => (n == null ? "—" : bs.format(n));

/** "2026-09-23" -> "23/09/2026" */
export const fmtFecha = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

/** "2026-11-20 14:05:00" (UTC de SQLite) -> fecha/hora local legible */
export const fmtFechaHora = (sqlUtc: string | null | undefined) => {
  if (!sqlUtc) return "—";
  const d = new Date(sqlUtc.replace(" ", "T") + "Z");
  return d.toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
};

/** "5.304.400,32" | "5304400.32" -> 5304400.32 */
export function parseMonto(raw: string | null | undefined): number | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** dd/mm/yyyy | dd.mm.yyyy | dd-mm-yyyy -> yyyy-mm-dd */
export function toIso(d: string, m: string, y: string) {
  const yy = y.length === 2 ? `20${y}` : y;
  const dd = d.padStart(2, "0");
  const mm = m.padStart(2, "0");
  const ok = +mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31;
  return ok ? `${yy}-${mm}-${dd}` : null;
}

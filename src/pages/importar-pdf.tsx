import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  HiCheckCircle,
  HiExclamationTriangle,
  HiOutlineArrowUpTray,
  HiOutlineDocumentDuplicate,
  HiOutlineTrash,
  HiXCircle,
} from "react-icons/hi2";
import { BorderBeam } from "@/components/magicui/border-beam";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { draftToFormData, validarDraft } from "@/lib/registro";
import { api, ApiError } from "@/lib/api";
import { fmtBs, fmtFecha } from "@/lib/format";
import { useEstaciones } from "@/lib/hooks";
import { analizarPdfModelo, renderPage, type PdfItem } from "@/lib/pdf";
import { cn } from "@/lib/utils";
import { PageHeader } from "./app-layout";

type Estado = "listo" | "guardando" | "guardado" | "duplicado" | "error" | "invalido";
interface Fila extends PdfItem {
  estado: Estado;
  msg?: string;
  incluir: boolean;
}
type Doc = Awaited<ReturnType<typeof analizarPdfModelo>>["doc"];

const BADGE: Record<Estado, { cls: string; label: string; icon?: React.ReactNode }> = {
  listo: { cls: "bg-muted text-muted-foreground", label: "Listo" },
  guardando: { cls: "bg-accent text-accent-foreground", label: "Guardando…" },
  guardado: { cls: "bg-success/15 text-success", label: "Guardado", icon: <HiCheckCircle /> },
  duplicado: { cls: "bg-warning/20 text-foreground", label: "Ya existía", icon: <HiOutlineDocumentDuplicate /> },
  error: { cls: "bg-destructive/15 text-destructive", label: "Error", icon: <HiXCircle /> },
  invalido: { cls: "bg-destructive/15 text-destructive", label: "Incompleto", icon: <HiExclamationTriangle /> },
};

export function ImportarPdfPage() {
  const { estaciones } = useEstaciones();
  const inputRef = useRef<HTMLInputElement>(null);
  const docs = useRef(new Map<string, Doc>());
  const [filas, setFilas] = useState<Fila[]>([]);
  const [analizando, setAnalizando] = useState<{ archivo: string; done: number; total: number } | null>(null);
  const [guardando, setGuardando] = useState<{ done: number; total: number } | null>(null);
  const [conImagenes, setConImagenes] = useState(true);

  const analizar = async (list: FileList | File[]) => {
    const pdfs = [...list].filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return toast.error("Selecciona archivos PDF");
    for (const file of pdfs) {
      try {
        setAnalizando({ archivo: file.name, done: 0, total: 1 });
        const { doc, items } = await analizarPdfModelo(file, estaciones, (done, total) =>
          setAnalizando({ archivo: file.name, done, total }),
        );
        docs.current.set(file.name, doc);
        setFilas((prev) => [
          ...prev.filter((p) => p.archivo !== file.name),
          ...items.map((it) => {
            const inval = Object.keys(validarDraft(it.draft)).length > 0;
            return { ...it, estado: (inval ? "invalido" : "listo") as Estado, incluir: !inval, msg: inval ? Object.values(validarDraft(it.draft)).join(", ") : undefined };
          }),
        ]);
        toast.success(`${file.name}: ${items.length} registros encontrados`);
      } catch (e) {
        console.error(e);
        toast.error(`No se pudo leer ${file.name}`);
      }
    }
    setAnalizando(null);
  };

  const guardarTodo = async () => {
    const pendientes = filas.filter((f) => f.incluir && (f.estado === "listo" || f.estado === "error"));
    if (!pendientes.length) return toast.info("No hay registros pendientes por guardar");
    setGuardando({ done: 0, total: pendientes.length });
    const imgCache = new Map<string, Blob>();
    const img = async (archivo: string, page: number | null) => {
      if (!conImagenes || !page) return undefined;
      const k = `${archivo}#${page}`;
      if (!imgCache.has(k)) imgCache.set(k, await renderPage(docs.current.get(archivo)!, page, 1400));
      return imgCache.get(k);
    };
    let ok = 0;
    let dups = 0;
    for (let i = 0; i < pendientes.length; i++) {
      const f = pendientes[i];
      setFilas((prev) => prev.map((p) => (p.key === f.key ? { ...p, estado: "guardando" } : p)));
      let estado: Estado = "guardado";
      let msg: string | undefined;
      try {
        const fd = draftToFormData(f.draft, {
          factura: await img(f.archivo, f.facturaPage),
          comprobante: await img(f.archivo, f.comprobantePage),
          origen: "pdf",
        });
        await api("/registros", { method: "POST", body: fd });
        ok++;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          estado = "duplicado";
          dups++;
        } else {
          estado = "error";
          msg = (e as Error).message;
        }
      }
      setFilas((prev) => prev.map((p) => (p.key === f.key ? { ...p, estado, msg } : p)));
      setGuardando({ done: i + 1, total: pendientes.length });
    }
    setGuardando(null);
    toast.success(`${ok} registros guardados${dups ? ` · ${dups} ya existían` : ""}`);
  };

  const total = filas.filter((f) => f.incluir).reduce((s, f) => s + (Number(f.draft.pago_bs) || 0), 0);
  const listos = filas.filter((f) => f.incluir && (f.estado === "listo" || f.estado === "error")).length;

  return (
    <>
      <PageHeader
        title="Importar PDF de estación"
        subtitle="Sube los PDF con facturas y comprobantes (como ALBALAGO_MODELO.pdf). Se leen sin errores de OCR porque los comprobantes traen el texto."
        actions={
          filas.length > 0 && (
            <button className="btn-ghost" onClick={() => setFilas([])} disabled={!!guardando}>
              <HiOutlineTrash /> Limpiar lista
            </button>
          )
        }
      />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void analizar(e.dataTransfer.files);
        }}
        className="card relative flex cursor-pointer flex-col items-center justify-center overflow-hidden border-dashed px-6 py-10 text-center transition hover:border-primary/50"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void analizar(e.target.files);
            e.target.value = "";
          }}
        />
        <motion.span
          animate={analizando ? { y: [0, -6, 0] } : {}}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="grid size-14 place-items-center rounded-2xl bg-accent text-2xl text-accent-foreground"
        >
          <HiOutlineArrowUpTray />
        </motion.span>
        {analizando ? (
          <>
            <p className="mt-4 font-medium">Analizando {analizando.archivo}…</p>
            <p className="text-sm text-muted-foreground">
              Página {analizando.done} de {analizando.total}
            </p>
            <div className="mt-3 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${(analizando.done / analizando.total) * 100}%` }} />
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 font-medium">Arrastra aquí uno o varios PDF, o haz clic para elegirlos</p>
            <p className="text-sm text-muted-foreground">Cada página de factura se empareja con su comprobante de pago.</p>
          </>
        )}
        {analizando && <BorderBeam size={200} duration={5} />}
      </div>

      {filas.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                <b>{filas.length}</b> registros
              </span>
              <span>
                Total pagos: <b className="tabular">{fmtBs(total)}</b>
              </span>
              {guardando && (
                <span className="text-primary">
                  Guardando {guardando.done}/{guardando.total}…
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={conImagenes} onChange={(e) => setConImagenes(e.target.checked)} />
                Guardar imágenes de las páginas
              </label>
              <ShimmerButton onClick={guardarTodo} disabled={!!guardando || !listos} className="h-10">
                <HiCheckCircle className="size-5" /> Guardar {listos} en la base de datos
              </ShimmerButton>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-8 px-3 py-2.5" />
                    <th className="px-3 py-2.5">Estación</th>
                    <th className="px-3 py-2.5">N° Factura</th>
                    <th className="px-3 py-2.5">Emisión</th>
                    <th className="px-3 py-2.5 text-right">Pago Bs.</th>
                    <th className="px-3 py-2.5">Fecha pago</th>
                    <th className="px-3 py-2.5">Referencia</th>
                    <th className="px-3 py-2.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filas.map((f) => {
                    const b = BADGE[f.estado];
                    return (
                      <tr key={f.key} className={cn("transition-colors", !f.incluir && "opacity-50")}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="accent-primary"
                            checked={f.incluir}
                            disabled={f.estado === "guardado" || f.estado === "invalido"}
                            onChange={(e) => setFilas((prev) => prev.map((p) => (p.key === f.key ? { ...p, incluir: e.target.checked } : p)))}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{f.draft.estacion || "—"}</td>
                        <td className="tabular px-3 py-2">{f.draft.nro_factura}</td>
                        <td className="tabular px-3 py-2">{fmtFecha(f.draft.fecha_emision)}</td>
                        <td className="tabular px-3 py-2 text-right">{f.draft.pago_bs ? fmtBs(Number(f.draft.pago_bs)).replace("Bs. ", "") : "—"}</td>
                        <td className="tabular px-3 py-2">{fmtFecha(f.draft.fecha_pago)}</td>
                        <td className="tabular px-3 py-2">{f.draft.referencia || "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            title={f.msg ?? f.draft.observaciones}
                            className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", b.cls)}
                          >
                            {b.icon} {f.estado === "listo" && !f.draft.referencia ? "Sin pago" : b.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Al terminar puedes revisar y editar todo en <Link to="/registros" className="text-primary hover:underline">Registros</Link>.
          </p>
        </div>
      )}
    </>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  HiChevronLeft,
  HiChevronRight,
  HiOutlineCamera,
  HiOutlineFunnel,
  HiOutlineMagnifyingGlass,
  HiOutlinePencilSquare,
  HiOutlinePhoto,
  HiOutlineTrash,
} from "react-icons/hi2";
import { PiMicrosoftExcelLogo } from "react-icons/pi";
import { Modal } from "@/components/modal";
import { RegistroForm } from "@/components/registro-form";
import { draftToFormData, validarDraft } from "@/lib/registro";
import { api, download, fileUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtBs, fmtFecha, fmtFechaHora } from "@/lib/format";
import { useEstaciones } from "@/lib/hooks";
import { compressImage } from "@/lib/ocr";
import type { Registro, RegistroDraft } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "./app-layout";

interface Resp {
  items: Registro[];
  total: number;
  suma: number;
  page: number;
  limit: number;
}
const FILTROS0 = { q: "", estacion: "", desde: "", hasta: "", pago_desde: "", pago_hasta: "", estado: "" };

const toDraft = (r: Registro): RegistroDraft => ({
  fecha_emision: r.fecha_emision ?? "",
  codigo: r.codigo ?? "",
  estacion: r.estacion ?? "",
  nro_factura: r.nro_factura,
  nro_control: r.nro_control ?? "",
  total_factura: r.total_factura?.toString() ?? "",
  pago_bs: r.pago_bs?.toString() ?? "",
  fecha_pago: r.fecha_pago ?? "",
  referencia: r.referencia ?? "",
  observaciones: r.observaciones ?? "",
});

function Estado({ r }: { r: Registro }) {
  const ok = r.pago_bs != null && r.referencia;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        ok ? "bg-success/15 text-success" : "bg-warning/20 text-foreground",
      )}
    >
      {ok ? "Pagada" : "Pendiente"}
    </span>
  );
}

export function RegistrosPage() {
  const { user } = useAuth();
  const { estaciones } = useEstaciones();
  const [f, setF] = useState(FILTROS0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [edit, setEdit] = useState<Registro | null>(null);
  const [ver, setVer] = useState<Registro | null>(null);
  const [borrar, setBorrar] = useState<Registro | null>(null);

  // búsqueda con retardo
  useEffect(() => {
    const t = setTimeout(() => {
      setF((p) => ({ ...p, q }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return p;
  }, [f]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams(params);
      p.set("page", String(page));
      p.set("limit", "25");
      setData(await api<Resp>(`/registros?${p}`));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [params, page]);

  useEffect(() => {
    // carga de datos al cambiar filtros/página
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const setFiltro = (k: keyof typeof FILTROS0) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((p) => ({ ...p, [k]: e.target.value }));
    setPage(1);
  };
  const activos = Object.entries(f).filter(([k, v]) => k !== "q" && v).length;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const exportar = () =>
    toast.promise(download(`/registros/export.xlsx?${params}`, "conciliacion.xlsx"), {
      loading: "Generando Excel…",
      success: "Excel descargado",
      error: (e) => e.message,
    });

  const eliminar = async () => {
    if (!borrar) return;
    try {
      await api(`/registros/${borrar.id}`, { method: "DELETE" });
      toast.success("Registro eliminado");
      setBorrar(null);
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Registros"
        subtitle="Facturas y pagos guardados en la base de datos."
        actions={
          <>
            <Link to="/escanear" className="btn-outline">
              <HiOutlineCamera /> Nuevo
            </Link>
            <button className="btn-primary" onClick={exportar}>
              <PiMicrosoftExcelLogo /> Descargar Excel
            </button>
          </>
        }
      />

      {/* Filtros */}
      <div className="card mb-4 p-3 sm:p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <HiOutlineMagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field-input pl-9"
              placeholder="Buscar por factura, referencia, estación u observación…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className={cn("btn-outline", showFiltros && "border-primary/50")} onClick={() => setShowFiltros((s) => !s)}>
            <HiOutlineFunnel />
            <span className="hidden sm:inline">Filtros</span>
            {activos > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activos}</span>}
          </button>
        </div>
        {showFiltros && (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            <label className="col-span-2 md:col-span-1 lg:col-span-1">
              <span className="field-label">Estación</span>
              <select className="field-input" value={f.estacion} onChange={setFiltro("estacion")}>
                <option value="">Todas</option>
                {estaciones.map((e) => (
                  <option key={e.id}>{e.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Estado</span>
              <select className="field-input" value={f.estado} onChange={setFiltro("estado")}>
                <option value="">Todos</option>
                <option value="pagada">Pagadas</option>
                <option value="pendiente">Pendientes</option>
              </select>
            </label>
            <span className="hidden md:block lg:hidden" />
            {(
              [
                ["desde", "Emisión desde"],
                ["hasta", "Emisión hasta"],
                ["pago_desde", "Pago desde"],
                ["pago_hasta", "Pago hasta"],
              ] as const
            ).map(([k, l]) => (
              <label key={k}>
                <span className="field-label">{l}</span>
                <input type="date" className="field-input" value={f[k]} onChange={setFiltro(k)} />
              </label>
            ))}
            <div className="flex items-end">
              <button
                className="btn-ghost w-full"
                onClick={() => {
                  setF({ ...FILTROS0, q: f.q });
                  setPage(1);
                }}
              >
                Quitar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {data?.total ?? 0} registros · Total pagado <b className="tabular text-foreground">{fmtBs(data?.suma ?? 0)}</b>
        </span>
        {loading && <span className="animate-pulse">Cargando…</span>}
      </div>

      {/* Tabla (escritorio) */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Emisión</th>
                <th className="px-3 py-3">Código</th>
                <th className="px-3 py-3">Estación</th>
                <th className="px-3 py-3">N° Factura</th>
                <th className="px-3 py-3 text-right">Pago Bs.</th>
                <th className="px-3 py-3">Fecha pago</th>
                <th className="px-3 py-3">Referencia</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.items.map((r) => (
                <tr key={r.id} className="group hover:bg-muted/40">
                  <td className="tabular px-3 py-2.5">{fmtFecha(r.fecha_emision)}</td>
                  <td className="tabular px-3 py-2.5 text-muted-foreground">{r.codigo ?? "—"}</td>
                  <td className="px-3 py-2.5 font-medium">{r.estacion ?? "—"}</td>
                  <td className="tabular px-3 py-2.5">{r.nro_factura}</td>
                  <td className="tabular px-3 py-2.5 text-right">{r.pago_bs != null ? fmtBs(r.pago_bs).replace("Bs. ", "") : "—"}</td>
                  <td className="tabular px-3 py-2.5">{fmtFecha(r.fecha_pago)}</td>
                  <td className="tabular px-3 py-2.5">{r.referencia ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <Estado r={r} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Acciones r={r} canDelete={user?.rol === "admin" || r.created_by === user?.id} onVer={setVer} onEdit={setEdit} onDelete={setBorrar} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.items.length && <p className="py-12 text-center text-sm text-muted-foreground">No hay registros con estos filtros.</p>}
        </div>
      </div>

      {/* Tarjetas (móvil) */}
      <div className="space-y-3 md:hidden">
        {data?.items.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.estacion ?? "—"}</p>
                <p className="tabular text-xs text-muted-foreground">
                  Factura {r.nro_factura} · {fmtFecha(r.fecha_emision)}
                </p>
              </div>
              <Estado r={r} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Pago</p>
                <p className="tabular font-medium">{fmtBs(r.pago_bs)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fecha pago</p>
                <p className="tabular font-medium">{fmtFecha(r.fecha_pago)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Referencia</p>
                <p className="tabular font-medium">{r.referencia ?? "—"}</p>
              </div>
            </div>
            <div className="mt-2 flex justify-end border-t pt-2">
              <Acciones r={r} canDelete={user?.rol === "admin" || r.created_by === user?.id} onVer={setVer} onEdit={setEdit} onDelete={setBorrar} />
            </div>
          </div>
        ))}
        {data && !data.items.length && <p className="py-12 text-center text-sm text-muted-foreground">No hay registros.</p>}
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <button className="btn-icon border" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Anterior">
            <HiChevronLeft />
          </button>
          <span className="tabular px-2">
            Página {page} de {pages}
          </span>
          <button className="btn-icon border" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Siguiente">
            <HiChevronRight />
          </button>
        </div>
      )}

      <EditarModal key={edit?.id ?? "none"} registro={edit} onClose={() => setEdit(null)} onSaved={load} />
      <VerModal registro={ver} onClose={() => setVer(null)} />
      <Modal open={!!borrar} onClose={() => setBorrar(null)} title="Eliminar registro" size="sm">
        <p className="text-sm">
          ¿Eliminar la factura <b className="tabular">{borrar?.nro_factura}</b> ({borrar?.estacion}, referencia {borrar?.referencia ?? "—"})?
          Se borrarán también sus imágenes. Esta acción no se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setBorrar(null)}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={eliminar}>
            <HiOutlineTrash /> Eliminar
          </button>
        </div>
      </Modal>
    </>
  );
}

function Acciones({
  r,
  canDelete,
  onVer,
  onEdit,
  onDelete,
}: {
  r: Registro;
  canDelete: boolean;
  onVer: (r: Registro) => void;
  onEdit: (r: Registro) => void;
  onDelete: (r: Registro) => void;
}) {
  return (
    <div className="flex justify-end gap-0.5">
      <button className="btn-icon" title="Ver documentos" onClick={() => onVer(r)} disabled={!r.factura_img && !r.comprobante_img}>
        <HiOutlinePhoto />
      </button>
      <button className="btn-icon" title="Editar" onClick={() => onEdit(r)}>
        <HiOutlinePencilSquare />
      </button>
      {canDelete && (
        <button className="btn-icon hover:text-destructive" title="Eliminar" onClick={() => onDelete(r)}>
          <HiOutlineTrash />
        </button>
      )}
    </div>
  );
}

function DocPreview({ name, label }: { name: string | null; label: string }) {
  const url = fileUrl(name);
  if (!url) return <div className="grid h-40 place-items-center rounded-xl bg-muted text-xs text-muted-foreground">Sin {label.toLowerCase()}</div>;
  const pdf = name!.endsWith(".pdf");
  return (
    <div>
      <p className="field-label">{label}</p>
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border bg-muted">
        {pdf ? (
          <iframe src={url} title={label} className="h-[60svh] w-full" />
        ) : (
          <img src={url} alt={label} className="max-h-[60svh] w-full object-contain" />
        )}
      </a>
    </div>
  );
}

function VerModal({ registro: r, onClose }: { registro: Registro | null; onClose: () => void }) {
  return (
    <Modal
      open={!!r}
      onClose={onClose}
      size="xl"
      title={r ? `${r.estacion ?? ""} · Factura ${r.nro_factura}` : ""}
      description={r ? `Cargado por ${r.creado_por ?? "—"} el ${fmtFechaHora(r.created_at)} · origen: ${r.origen}` : undefined}
    >
      {r && (
        <div className="grid gap-4 md:grid-cols-2">
          <DocPreview name={r.factura_img} label="Factura" />
          <DocPreview name={r.comprobante_img} label="Comprobante" />
        </div>
      )}
    </Modal>
  );
}

function EditarModal({ registro, onClose, onSaved }: { registro: Registro | null; onClose: () => void; onSaved: () => void }) {
  const { estaciones } = useEstaciones();
  const [d, setD] = useState<RegistroDraft | null>(() => (registro ? toDraft(registro) : null));
  const [fac, setFac] = useState<File | null>(null);
  const [comp, setComp] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const errors = d && submitted ? validarDraft(d) : {};
  const save = async () => {
    if (!registro || !d) return;
    setSubmitted(true);
    if (Object.keys(validarDraft(d)).length) return;
    setSaving(true);
    try {
      const prep = async (f: File | null) => (f ? (f.type === "application/pdf" ? f : await compressImage(f)) : undefined);
      await api(`/registros/${registro.id}`, {
        method: "PUT",
        body: draftToFormData(d, { factura: await prep(fac), comprobante: await prep(comp) }),
      });
      toast.success("Registro actualizado");
      onClose();
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!registro} onClose={onClose} title="Editar registro" size="lg">
      {d && (
        <>
          <RegistroForm value={d} onChange={setD} estaciones={estaciones} errors={errors} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Reemplazar foto de factura", setFac, fac],
                ["Reemplazar comprobante", setComp, comp],
              ] as const
            ).map(([l, set, file]) => (
              <label key={l} className="block">
                <span className="field-label">{l}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="field-input pt-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1"
                  onChange={(e) => set(e.target.files?.[0] ?? null)}
                />
                {file && <span className="mt-1 block truncate text-[11px] text-muted-foreground">{file.name}</span>}
              </label>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
